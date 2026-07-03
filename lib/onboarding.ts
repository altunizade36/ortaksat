// Kullanıcının "hoşgeldin / rol seçimi" ekranını görüp görmediğini client tarafında
// saklar. Amaç: yeni üye ilk girişte /hosgeldin rehberine bir KEZ yönlendirilsin,
// sonraki girişlerde doğrudan ana sayfaya gitsin. Hesap/veri değil, sadece UX.
// Web'de localStorage; native/storage yoksa oturum-içi bellek. Hata olursa sessiz.

const KEY = "ortaksat_welcome_v1";

let memorySet: Record<string, true> = {};

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readAll(): Record<string, true> {
  if (!hasStorage()) return memorySet;
  try {
    const raw = window.localStorage.getItem(KEY);
    const obj = raw ? (JSON.parse(raw) as unknown) : {};
    return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Record<string, true>) : {};
  } catch {
    return {};
  }
}

/** Bu kullanıcı hoşgeldin ekranını daha önce gördü mü? */
export function hasSeenWelcome(userId: string | undefined): boolean {
  if (!userId) return true; // kimlik yoksa yönlendirme yapma
  return Boolean(readAll()[userId]);
}

/** Hoşgeldin ekranını görüldü olarak işaretle. */
export function markWelcomeSeen(userId: string | undefined): void {
  if (!userId) return;
  const map = readAll();
  map[userId] = true;
  memorySet = map;
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // sessiz — quota/private mode
  }
}
