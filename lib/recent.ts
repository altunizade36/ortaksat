// Son gezilen ilanlar (web'de localStorage). Native'de sessizce boş döner.
const KEY = "ortaksat_recent_v1";
const MAX = 16;

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getRecent(): string[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(id: string): void {
  if (!hasStorage() || !id) return;
  try {
    const next = [id, ...getRecent().filter((x) => x !== id)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // sessiz
  }
}
