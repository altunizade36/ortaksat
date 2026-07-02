import { useEffect, useState } from "react";

// Ürün karşılaştırma listesi (en fazla 4). Web'de localStorage'da kalıcı.
const KEY = "ortaksat_compare_v1";
const MAX = 4;
const listeners = new Set<() => void>();
let ids: string[] = load();

function hasStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}
function load(): string[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}
function persist() {
  if (hasStorage()) {
    try { window.localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* sessiz */ }
  }
}
function emit() {
  persist();
  listeners.forEach((l) => l());
}

export function toggleCompare(id: string) {
  if (!id) return;
  if (ids.includes(id)) ids = ids.filter((x) => x !== id);
  else if (ids.length < MAX) ids = [...ids, id];
  emit();
}
export function removeCompare(id: string) {
  ids = ids.filter((x) => x !== id);
  emit();
}
export function clearCompare() {
  ids = [];
  emit();
}
export const COMPARE_MAX = MAX;

/** Reaktif hook: karşılaştırma listesi değişince yeniden render eder. */
export function useCompare() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: toggleCompare,
    remove: removeCompare,
    clear: clearCompare
  };
}
