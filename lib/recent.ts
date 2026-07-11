// Son gezilen ilanlar. Web'de localStorage (senkron), native'de AsyncStorage (async).
// getRecent() her zaman senkron döner (bellek-içi cache); native hidrasyon tamamlanınca
// subscribeRecent aboneleri güncellenir → "Son gezdiklerin" şeridi native'de de dolar.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const KEY = "ortaksat_recent_v1";
const MAX = 16;
const isWeb = Platform.OS === "web";

let cache: string[] = [];
const listeners = new Set<(ids: string[]) => void>();
const emit = () => { const snap = cache.slice(); for (const l of listeners) l(snap); };

function parse(raw: string | null): string[] {
  try {
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

// Hidrasyon: web senkron (localStorage), native async (AsyncStorage → cache + emit).
if (isWeb) {
  if (typeof window !== "undefined" && window.localStorage) cache = parse(window.localStorage.getItem(KEY));
} else {
  AsyncStorage.getItem(KEY).then((raw) => { cache = parse(raw); if (cache.length) emit(); }).catch(() => {});
}

export function getRecent(): string[] {
  return cache.slice();
}

export function pushRecent(id: string): void {
  if (!id) return;
  cache = [id, ...cache.filter((x) => x !== id)].slice(0, MAX);
  emit();
  try {
    const json = JSON.stringify(cache);
    if (isWeb) {
      if (typeof window !== "undefined" && window.localStorage) window.localStorage.setItem(KEY, json);
    } else {
      AsyncStorage.setItem(KEY, json).catch(() => {});
    }
  } catch {
    // sessiz
  }
}

// Native async hidrasyon sonrası (veya her pushRecent'te) güncel listeyi almak için abone ol.
export function subscribeRecent(cb: (ids: string[]) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
