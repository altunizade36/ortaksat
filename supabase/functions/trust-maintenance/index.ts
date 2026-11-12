import { createClient } from "npm:@supabase/supabase-js@2.107.0";

async function equalSecret(a: string, b: string) {
  const hashes = await Promise.all([a, b].map(s => crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))));
  const x = new Uint8Array(hashes[0]), y = new Uint8Array(hashes[1]); let mismatch = 0;
  for (let i = 0; i < x.length; i++) mismatch |= x[i] ^ y[i];
  return mismatch === 0;
}
Deno.serve(async request => {
  const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("TRUST_MAINTENANCE_SECRET"), supplied = request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
  if (!secret || secret.length < 32 || supplied.length > 256 || !await equalSecret(secret, supplied)) return reply({ error: "Forbidden" }, 403);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply({ error: "Unavailable" }, 503);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc("trust_v1_send_reminders");
  return error ? reply({ error: "Maintenance unavailable" }, 503) : reply({ reminders: data }, 200);
});
