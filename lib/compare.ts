import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

// Ürün karşılaştırma listesi (en fazla 4). Web'de localStorage (senkron), NATIVE'de AsyncStorage (kalıcı).
const KEY = "ortaksat_compare_v1";
const MAX = 4;
const listeners = new Set<() => void>();
let ids: string[] = load();

function hasStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}
function parseIds(raw: string | null): string[] {
  try {
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}
function load(): string[] {
  if (!hasStorage()) return []; // native: aşağıda AsyncStorage'dan async hidrate edilir
  return parseIds(window.localStorage.getItem(KEY));
}
// NATIVE KALICILIK: eskiden karşılaştırma listesi native'de YALNIZ bellekteydi (localStorage yok)
// → uygulama yeniden başlayınca KAYBOLUYORDU (referral.ts ile aynı desen: hidrate + write-through).
if (!hasStorage()) {
  AsyncStorage.getItem(KEY)
    .then((raw) => { const restored = parseIds(raw); if (restored.length) { ids = restored; listeners.forEach((l) => l()); } })
    .catch(() => {});
}
function persist() {
  if (hasStorage()) {
    try { window.localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* sessiz */ }
  } else {
    AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => {}); // native: fire-and-forget
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
