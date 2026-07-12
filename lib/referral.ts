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

export type RefEntry = { partnershipId: string; refCode: string; ts: number; exp?: number };
const DAY_MS = 24 * 60 * 60 * 1000;
// Bir kaydın süresi doldu mu? İlan-bazlı `exp` varsa onu, yoksa eski 30g TTL'i kullan (geriye uyum).
function isExpired(v: RefEntry, now: number): boolean {
  return v.exp ? now > v.exp : now - v.ts >= TTL_MS;
}
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
export function saveRefAttribution(listingId: string | undefined, partnershipId: string | undefined, refCode: string | undefined, windowDays?: number): void {
  if (!listingId || !partnershipId || !refCode) return;
  const now = Date.now();
  const days = windowDays && windowDays > 0 ? windowDays : 30; // ilan-bazlı atıf penceresi (varsayılan 30g)
  const map = readAll();
  // İLK-DOKUNUŞ (first-touch) politikası: geçerli (süresi dolmamış) bir atıf varsa ve onu
  // FARKLI bir ortak taşıyorsa, sonradan gelen ortak bu atfı ÇALAMAZ (haksız kredi engellenir).
  // Aynı ortak yeniden dokunursa ya da eski atıf süresi geçmişse pencere tazelenir/yenilenir.
  const existing = map[listingId];
  const stolenAttempt = existing && !isExpired(existing, now) && existing.partnershipId !== partnershipId;
  if (!stolenAttempt) {
    map[listingId] = { partnershipId, refCode, ts: now, exp: now + days * DAY_MS };
  }
  // Süresi geçenleri temizle + en yeni MAX kaydı tut.
  const fresh = Object.entries(map)
    .filter(([, v]) => v && typeof v.ts === "number" && !isExpired(v, now))
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
  if (isExpired(entry, Date.now())) {
    delete map[listingId];
    writeAll(map);
    return null;
  }
  return entry;
}
