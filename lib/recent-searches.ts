import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Son aramalar — arama kutusu odaklanınca (boş sorgu) hızlı tekrar için gösterilir.
 * Web'de localStorage'da kalıcı; native'de bellek-içi (oturum boyu). Web ağırlıklı
 * kullanım için yeterli; native kalıcılık gerekirse AsyncStorage'a taşınabilir.
 */
const KEY = "ortaksat.recentSearches";
const MAX = 8;
let mem: string[] = [];
function cleanRecents(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of data) {
    if (typeof item !== "string") continue;
    const query = item.replace(/\s+/g, " ").trim().slice(0, 120);
    const key = query.toLocaleLowerCase("tr-TR");
    if (query.length < 2 || seen.has(key)) continue;
    seen.add(key); clean.push(query);
    if (clean.length === MAX) break;
  }
  return clean;
}
let revision = 0;
const listeners = new Set<() => void>();
if (Platform.OS !== "web") {
  const initialRevision = revision;
  void AsyncStorage.getItem(KEY).then(raw => {
    if (initialRevision !== revision) return;
    try { const data = JSON.parse(raw || "[]"); mem = cleanRecents(data); } catch { /* invalid local data */ }
    listeners.forEach(fn=>fn());
  }).catch(()=>{});
}
export function subscribeRecentSearches(fn:()=>void) { listeners.add(fn); return ()=>{listeners.delete(fn);}; }

function read(): string[] {
  if (Platform.OS !== "web" || typeof window === "undefined") return mem;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return cleanRecents(parsed);
  } catch {
    return mem;
  }
}

function write(list: string[]): void {
  revision++;
  mem = list;
  listeners.forEach(fn=>fn());
  if (Platform.OS !== "web") { void AsyncStorage.setItem(KEY,JSON.stringify(list)).catch(()=>{}); return; }
  if (typeof window === "undefined") return;
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
  const q = query.replace(/\s+/g, " ").trim().slice(0, 120);
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
