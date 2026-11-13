// Satıcının verdiği XML bağlantısını GÜVENLİ biçimde indirir (feed-fetch ve feed-sync ortak kullanır).
// Sunucu tarafında çalışır çünkü tarayıcı başka sitenin XML'ini okuyamaz (CORS).
//
// Korumalar: yalnız http/https; yerel ve özel ağ adresleri reddedilir; yönlendirmeler elle izlenir ve her
// adım yeniden doğrulanır; boyut ve süre sınırı vardır; yanıt XML değilse (ör. giriş sayfası) reddedilir.

export const MAX_FEED_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 25_000;
const MAX_REDIRECTS = 4;
const USER_AGENT = "OrtakSatFeedBot/1.0 (+https://www.ortaksat.com/kurumsal)";

export class FeedError extends Error {}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(":")) return h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:");
  return false;
}

export function validateFeedUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(String(raw ?? "").trim()); } catch { throw new FeedError("Geçerli bir bağlantı gir (https:// ile başlamalı)."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FeedError("Bağlantı http:// ya da https:// ile başlamalı.");
  if (url.username || url.password) throw new FeedError("Kullanıcı adı ve şifre içeren bağlantılar kabul edilmez.");
  if (isPrivateHost(url.hostname)) throw new FeedError("Bu adrese erişilemez. İnternetten açılabilen bir XML bağlantısı gir.");
  if (url.href.length > 2000) throw new FeedError("Bağlantı çok uzun.");
  return url;
}

function decode(bytes: Uint8Array, contentType: string): string {
  let head = "";
  for (let i = 0; i < Math.min(bytes.length, 200); i++) head += String.fromCharCode(bytes[i]);
  const declared = (/<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(head)?.[1] ?? /charset=([\w-]+)/i.exec(contentType)?.[1] ?? "utf-8").toLowerCase();
  if (declared !== "utf-8" && declared !== "utf8") {
    try { return new TextDecoder(declared).decode(bytes); } catch { /* tanınmayan kodlama → UTF-8 */ }
  }
  return new TextDecoder("utf-8").decode(bytes);
}

export async function fetchFeedText(raw: string): Promise<{ text: string; finalUrl: string; bytes: number }> {
  let url = validateFeedUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, "Accept": "application/xml,text/xml,application/rss+xml,application/atom+xml,*/*;q=0.5" }
      });
      if (response.status >= 300 && response.status < 400) {
        const next = response.headers.get("location");
        await response.body?.cancel();
        if (!next) throw new FeedError("Bağlantı yönlendirme yapıyor ama hedef belirtmiyor.");
        url = validateFeedUrl(new URL(next, url).href);
        response = null;
        continue;
      }
      break;
    }
    if (!response) throw new FeedError("Bağlantı çok fazla yönlendirme yapıyor.");
    if (response.status === 401 || response.status === 403) throw new FeedError("XML bağlantısı erişime kapalı (şifreli ya da yetki istiyor). Herkese açık bir bağlantı gir.");
    if (response.status === 404) throw new FeedError("XML bağlantısı bulunamadı (404). Adresi kontrol et.");
    if (!response.ok) throw new FeedError(`XML bağlantısı yanıt vermedi (HTTP ${response.status}).`);
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_FEED_BYTES) throw new FeedError("XML dosyası çok büyük (en fazla 20 MB).");
    const reader = response.body?.getReader();
    if (!reader) throw new FeedError("XML bağlantısı boş yanıt verdi.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_FEED_BYTES) { await reader.cancel(); throw new FeedError("XML dosyası çok büyük (en fazla 20 MB)."); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const text = decode(bytes, response.headers.get("content-type") ?? "").replace(/^﻿/, "");
    const start = text.trimStart().slice(0, 300).toLowerCase();
    if (!start.startsWith("<")) throw new FeedError("Bu bağlantı XML döndürmüyor. Ürün XML'inin doğrudan adresini gir.");
    if (start.startsWith("<!doctype html") || start.startsWith("<html")) throw new FeedError("Bu bağlantı XML değil, web sayfası döndürüyor. Ürün XML'inin doğrudan adresini gir.");
    return { text, finalUrl: url.href, bytes: total };
  } catch (error) {
    if (error instanceof FeedError) throw error;
    if ((error as { name?: string })?.name === "AbortError") throw new FeedError("XML bağlantısı zamanında yanıt vermedi (25 sn).");
    throw new FeedError("XML bağlantısına ulaşılamadı. Adresi ve sitenin açık olduğunu kontrol et.");
  } finally {
    clearTimeout(timer);
  }
}

const ORIGINS = new Set(["https://www.ortaksat.com", "https://ortaksat.com", "http://localhost:8081", "http://localhost:8087"]);

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://www.ortaksat.com",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  };
}
