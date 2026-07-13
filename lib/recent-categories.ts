// Son kullanılan kategoriler (ilan verme hızlandırıcı).
//
// Neden: aynı satıcı çoğu zaman AYNI kategoride tekrar ilan veriyor; her seferinde
// 4594 yapraklı ağacı baştan gezmek gerekiyordu. Son seçilen kategoriler çip olarak
// sunulur → tek dokunuşla forma geçilir.
//
// Web: localStorage (senkron). Native: AsyncStorage (kalıcı) + bellek cache ile senkron API
// (recent.ts ile aynı desen; getRecentCategories() senkron çağrılıyor).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const KEY = "ortaksat_recent_cats_v1";
const MAX = 6;
const isWeb = Platform.OS === "web";

/** Kategori yolu: kökten yaprağa slug + label listesi (ağaç değişse de gösterilebilir). */
export type RecentCategory = { slugs: string[]; labels: string[] };

let cache: RecentCategory[] = [];
const listeners = new Set<(c: RecentCategory[]) => void>();
const emit = () => { const snap = cache.slice(); for (const l of listeners) l(snap); };

function parse(raw: string | null): RecentCategory[] {
  try {
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is RecentCategory =>
        !!x && typeof x === "object" &&
        Array.isArray((x as RecentCategory).slugs) && Array.isArray((x as RecentCategory).labels) &&
        (x as RecentCategory).labels.length > 0)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

// Hidrasyon
if (isWeb) {
  if (typeof window !== "undefined" && window.localStorage) cache = parse(window.localStorage.getItem(KEY));
} else {
  AsyncStorage.getItem(KEY).then((raw) => { cache = parse(raw); if (cache.length) emit(); }).catch(() => {});
}

function persist() {
  const json = JSON.stringify(cache);
  if (isWeb) {
    try { window.localStorage.setItem(KEY, json); } catch { /* quota/private mode */ }
  } else {
    AsyncStorage.setItem(KEY, json).catch(() => {});
  }
}

/** Senkron okuma (bellek cache). */
export function getRecentCategories(): RecentCategory[] {
  return cache.slice();
}

/** Değişiklikleri dinle (native hidrasyonu sonrası da güncellenir). */
export function subscribeRecentCategories(fn: (c: RecentCategory[]) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Bir kategori seçildiğinde çağır. Aynı yol varsa başa alınır (tekrar etmez). */
export function pushRecentCategory(entry: RecentCategory): void {
  if (!entry?.labels?.length) return;
  const key = entry.slugs.join(">") || entry.labels.join(">");
  cache = [entry, ...cache.filter((c) => (c.slugs.join(">") || c.labels.join(">")) !== key)].slice(0, MAX);
  persist();
  emit();
}
