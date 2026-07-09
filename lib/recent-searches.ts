import { Platform } from "react-native";

/**
 * Son aramalar — arama kutusu odaklanınca (boş sorgu) hızlı tekrar için gösterilir.
 * Web'de localStorage'da kalıcı; native'de bellek-içi (oturum boyu). Web ağırlıklı
 * kullanım için yeterli; native kalıcılık gerekirse AsyncStorage'a taşınabilir.
 */
const KEY = "ortaksat.recentSearches";
const MAX = 8;
let mem: string[] = [];

function read(): string[] {
  if (Platform.OS !== "web" || typeof window === "undefined") return mem;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return mem;
  }
}

function write(list: string[]): void {
  mem = list;
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* özel mod / kota — bellek-içi yeterli */
  }
}

export function getRecentSearches(): string[] {
  return read();
}

export function pushRecentSearch(query: string): void {
  const q = query.trim();
  if (q.length < 2) return;
  const lower = q.toLocaleLowerCase("tr-TR");
  const next = [q, ...read().filter((s) => s.toLocaleLowerCase("tr-TR") !== lower)].slice(0, MAX);
  write(next);
}

export function removeRecentSearch(query: string): void {
  write(read().filter((s) => s !== query));
}

export function clearRecentSearches(): void {
  write([]);
}
