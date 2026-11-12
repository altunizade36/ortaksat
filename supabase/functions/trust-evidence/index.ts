import { createClient } from "npm:@supabase/supabase-js@2.107.0";
import { boundedJson } from "../_shared/trust-http.ts";
// Shared pure validation is also exercised by isolated Node tests.
import { approvedScan, fileSignatureMatches, sha256 } from "../_shared/trust-file.mjs";

const json = (body: unknown, status: number, headers: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" } });
Deno.serve(async request => {
  const origin = request.headers.get("Origin"), allowed = new Set((Deno.env.get("TRUST_ALLOWED_ORIGINS") || "https://www.ortaksat.com,https://ortaksat.com").split(","));
  const cors: Record<string, string> = { "Vary": "Origin", "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info", "Access-Control-Allow-Methods": "POST,OPTIONS" };
  if (origin && !allowed.has(origin)) return json({ error: "Origin denied" }, 403, cors);
  if (origin) cors["Access-Control-Allow-Origin"] = origin;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ error: "Service unavailable" }, 503, cors);
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401, cors);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await userClient.auth.getUser(authorization.slice(7));
  if (verified.error || !verified.data.user) return json({ error: "Authentication required" }, 401, cors);
  try {
    // No file bytes accepted here. Storage upload is independently authorized by RLS.
    const body = await boundedJson(request, 1024);
    if (typeof body.evidenceId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.evidenceId)) return json({ error: "Invalid request" }, 400, cors);
    const privileged = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    if (body.operation === "download") {
      const access = await userClient.rpc("trust_v1_authorize_evidence", { p_evidence_id: body.evidenceId });
      if (access.error || !access.data) return json({ error: "Evidence unavailable" }, 403, cors);
      const signed = await privileged.storage.from("trust-evidence").createSignedUrl(access.data.path, 60, { download: true });
      if (signed.error) throw signed.error;
      return json({ url: signed.data.signedUrl, expiresIn: 60 }, 200, cors);
    }
    if (body.operation !== "scan") return json({ error: "Invalid operation" }, 400, cors);
    const scanner = Deno.env.get("TRUST_SCANNER_URL"), scannerKey = Deno.env.get("TRUST_SCANNER_KEY");
    if (!scanner || !scannerKey || !scanner.startsWith("https://")) return json({ error: "Scanner unavailable" }, 503, cors);
    const pending = await userClient.rpc("trust_v1_begin_scan", { p_evidence_id: body.evidenceId });
    if (pending.error || !pending.data) return json({ error: "Scan unavailable or already running" }, 409, cors);
    if (pending.data.alreadyScanned) return json({ status: "clean" }, 200, cors);
    const e = pending.data;
    const downloaded = await privileged.storage.from("trust-evidence").download(e.storage_path);
    if (downloaded.error || !downloaded.data || downloaded.data.size > 5242880) throw new Error("File unavailable");
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer()), hash = await sha256(bytes);
    let clean = false, engine = "file-validation-v1";
    if (bytes.length === e.byte_size && fileSignatureMatches(bytes, e.mime_type)) {
      const scanned = await fetch(scanner, { method: "POST", headers: { "Authorization": `Bearer ${scannerKey}`, "Content-Type": e.mime_type, "X-Content-SHA256": hash }, body: bytes, signal: AbortSignal.timeout(25000), redirect: "error" });
      if (!scanned.ok) throw new Error("Scanner unavailable");
      const result = await boundedJson(scanned, 4096);
      if (!approvedScan(result, hash, bytes.length) || typeof result.clean !== "boolean" || typeof result.engine !== "string") throw new Error("Invalid scanner response");
      clean = result.clean; engine = result.engine;
    }
    const saved = await privileged.rpc("trust_v1_scan_result", { p_evidence_id: e.id, p_clean: clean, p_sha: hash, p_engine: engine, p_bytes: bytes.length });
    if (saved.error) throw saved.error;
    return json({ status: clean ? "clean" : "rejected" }, 200, cors);
  } catch {
    // Neither service keys, scanner errors nor private paths are returned or logged.
    return json({ error: "Request could not be completed" }, 503, cors);
  }
});
