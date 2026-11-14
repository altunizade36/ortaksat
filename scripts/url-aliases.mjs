// Türkçe adres çevirisi — derleme betikleri için (lib/url-aliases.ts ile AYNI mantık, aynı veri dosyası).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const data = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "data", "url-aliases.json"), "utf8"));

function convert(url, toInternal) {
  if (typeof url !== "string" || url[0] !== "/") return url;
  const hashAt = url.indexOf("#");
  const hash = hashAt >= 0 ? url.slice(hashAt) : "";
  const rest = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const queryAt = rest.indexOf("?");
  let path = queryAt >= 0 ? rest.slice(0, queryAt) : rest;
  const query = queryAt >= 0 ? rest.slice(queryAt + 1) : "";
  for (const [internal, pub] of data.paths) {
    const from = toInternal ? pub : internal, to = toInternal ? internal : pub;
    if (path === from || path.startsWith(from + "/")) { path = to + path.slice(from.length); break; }
  }
  if (!query) return path + hash;
  const pairs = query.split("&").map((pair) => {
    const eq = pair.indexOf("=");
    const key = eq >= 0 ? pair.slice(0, eq) : pair, value = eq >= 0 ? pair.slice(eq + 1) : "";
    const internalKey = toInternal ? (Object.keys(data.params).find((k) => data.params[k] === key) ?? key) : key;
    const outKey = toInternal ? internalKey : (data.params[key] ?? key);
    const map = data.values[internalKey];
    let outValue = value;
    if (map) outValue = toInternal ? (Object.keys(map).find((k) => map[k] === value) ?? value) : (map[value] ?? value);
    return eq >= 0 ? `${outKey}=${outValue}` : outKey;
  });
  return `${path}?${pairs.join("&")}${hash}`;
}

export const toPublicUrl = (url) => convert(url, false);
export const toInternalUrl = (url) => convert(url, true);
export const aliasData = data;

const SITE = "https://www.ortaksat.com";
/** Tam adresi (https://www.ortaksat.com/…) ya da kök-göreli yolu Türkçe adrese çevirir; başka her şey aynen kalır. */
export function toPublicAny(value) {
  if (typeof value !== "string") return value;
  if (value.startsWith(SITE + "/")) return SITE + toPublicUrl(value.slice(SITE.length));
  if (value.startsWith("/") && !value.startsWith("//")) return toPublicUrl(value);
  return value;
}

/**
 * Bir HTML belgesindeki site içi adresleri Türkçeye çevirir: <a href>, kanonik bağlantı, og:url ve yapısal veri
 * (JSON-LD) içindeki tam adresler. Varlık yolları (/_expo/…, /fonts/…) eşlemede olmadığı için değişmez.
 */
export function rewriteHtmlUrls(html) {
  let out = html.replace(/\b(href|content)="((?:https:\/\/www\.ortaksat\.com)?\/[^"]*)"/g, (match, attr, value) => {
    const next = toPublicAny(value.replace(/&amp;/g, "&")).replace(/&/g, "&amp;");
    return next === value ? match : `${attr}="${next}"`;
  });
  // JSON-LD ve satır içi veri: "https://www.ortaksat.com/<iç yol>" biçimindeki tam adresler.
  out = out.replace(/https:\/\/www\.ortaksat\.com(\/[A-Za-z0-9\-._~%\/\[\]]*)/g, (match, path) => SITE + toPublicUrl(path));
  return out;
}
