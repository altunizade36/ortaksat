// Ortağın referans atfını (attribution) kısa süreli client tarafında saklar.
//
// Amaç: Ortak linki /i/{slug}?ref=REFKOD landing'inde çözülür; ama alıcı oradan
// normal /listing/[id] sayfasına geçerse veya doğrudan /listing/[id]?ref=REFKOD
// (ya da ?p=REFKOD) ile gelirse hangi ortağın yönlendirdiği KAYBOLMASIN.
// Burada ilan bazında { partnershipId, refCode } TTL'li saklanır; alıcı ilan
// detayında satıcıyla iletişime geçince bu atıf üzerinden lead ortağa bağlanır.
//
// Web'de localStorage; native'de (veya storage yoksa) oturum-içi bellek fallback.
// Ödeme/checkout YOK — yalnızca lead atfı için kullanılır.

const KEY = "ortaksat_ref_v1";
// Atıf penceresi: 30 gün. "Kısa süreli" saklama; süresi geçen atıf sessizce yok sayılır.
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX = 40;

export type RefEntry = { partnershipId: string; refCode: string; ts: number };
type RefMap = Record<string, RefEntry>; // listingId -> entry

// Native / storage olmadığında oturum süresince tutulan yedek.
let memoryMap: RefMap = {};

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readAll(): RefMap {
  if (!hasStorage()) return memoryMap;
  try {
    const raw = window.localStorage.getItem(KEY);
    const obj = raw ? (JSON.parse(raw) as unknown) : {};
    return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as RefMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: RefMap): void {
  memoryMap = map;
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // sessiz — quota/private mode
  }
}

/** Bir ilan için ortak referans atfını sakla. Eksik/geçersiz veri sessizce yok sayılır. */
export function saveRefAttribution(listingId: string | undefined, partnershipId: string | undefined, refCode: string | undefined): void {
  if (!listingId || !partnershipId || !refCode) return;
  const map = readAll();
  map[listingId] = { partnershipId, refCode, ts: Date.now() };
  // TTL süresi geçenleri temizle + en yeni MAX kaydı tut.
  const now = Date.now();
  const fresh = Object.entries(map)
    .filter(([, v]) => v && typeof v.ts === "number" && now - v.ts < TTL_MS)
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, MAX);
  writeAll(Object.fromEntries(fresh));
}

/** Bir ilan için geçerli (expired olmayan) ortak atfını döndür; yoksa/expired ise null. */
export function getRefAttribution(listingId: string | undefined): RefEntry | null {
  if (!listingId) return null;
  const map = readAll();
  const entry = map[listingId];
  if (!entry || !entry.partnershipId || typeof entry.ts !== "number") return null;
  if (Date.now() - entry.ts >= TTL_MS) {
    delete map[listingId];
    writeAll(map);
    return null;
  }
  return entry;
}
