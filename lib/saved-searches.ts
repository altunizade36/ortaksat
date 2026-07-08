import { useEffect, useState } from "react";

// Kayıtlı aramalar (web'de localStorage). Her kayıt: sorgu + aktif filtreler +
// kaydedildiği an. `f` = kaydedildiği andaki filtre kümesi (fiyat/komisyon/
// kategori/şehir/sıralama…), tıklanınca geri yüklenir.
export type SavedFilters = Record<string, string | number | boolean>;
export type SavedSearch = { id: string; q: string; ts: number; f?: SavedFilters };
const KEY = "ortaksat_saved_searches_v1";
const MAX = 12;
const listeners = new Set<() => void>();
let items: SavedSearch[] = load();

function hasStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}
function load(): SavedSearch[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as SavedSearch[]).filter((x) => x && typeof x.q === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}
function persist() {
  if (hasStorage()) {
    try { window.localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* sessiz */ }
  }
}
function emit() {
  persist();
  listeners.forEach((l) => l());
}
export function addSaved(q: string, f?: SavedFilters) {
  const query = q.trim();
  const hasFilters = f && Object.keys(f).length > 0;
  if (!query && !hasFilters) return;
  const ts = Date.now();
  const key = `${query.toLocaleLowerCase("tr-TR")}|${hasFilters ? JSON.stringify(f) : ""}`;
  if (items.some((s) => `${s.q.toLocaleLowerCase("tr-TR")}|${s.f ? JSON.stringify(s.f) : ""}` === key)) return;
  items = [{ id: `${ts}-${query.slice(0, 12) || "flt"}`, q: query, ts, ...(hasFilters ? { f } : {}) }, ...items].slice(0, MAX);
  emit();
}
export function removeSaved(id: string) {
  items = items.filter((s) => s.id !== id);
  emit();
}

export function useSavedSearches() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return { items, add: addSaved, remove: removeSaved };
}
