import { useEffect, useState } from "react";

// Kayıtlı aramalar (web'de localStorage). Her kayıt: sorgu + kaydedildiği an.
export type SavedSearch = { id: string; q: string; ts: number };
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
export function addSaved(q: string) {
  const query = q.trim();
  if (!query) return;
  if (items.some((s) => s.q.toLocaleLowerCase("tr-TR") === query.toLocaleLowerCase("tr-TR"))) return;
  const ts = Date.now();
  items = [{ id: `${ts}-${query.slice(0, 12)}`, q: query, ts }, ...items].slice(0, MAX);
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
