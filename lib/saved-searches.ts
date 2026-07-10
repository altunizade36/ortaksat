import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

// Kayıtlı aramalar: localStorage (anon) + sunucu (girişli, cihazlar arası senkron).
// Her kayıt: sorgu + aktif filtreler + kaydedildiği an. `f` = kaydedildiği andaki filtre
// kümesi (fiyat/komisyon/kategori/şehir/sıralama…), tıklanınca geri yüklenir.
export type SavedFilters = {
  price?: string;
  comm?: number;
  cat?: string;
  city?: string;
  open?: boolean;
  stock?: string;
  sort?: string;
  // Kategori-özel filtreler: facet (attribute) seçimleri + sayısal aralıklar.
  attr?: Record<string, string[]>;
  num?: Record<string, { min: string; max: string }>;
};
export type SavedSearch = { id: string; q: string; ts: number; f?: SavedFilters };
const KEY = "ortaksat_saved_searches_v1";
const MAX = 12;
const listeners = new Set<() => void>();
let items: SavedSearch[] = load();
let currentUserId: string | null = null; // girişli kullanıcı → sunucu write-through + senkron

function keyOf(s: SavedSearch): string {
  return `${(s.q || "").toLocaleLowerCase("tr-TR")}|${s.f ? JSON.stringify(s.f) : ""}`;
}
async function pushServer(userId: string, s: SavedSearch) {
  if (!supabase) return;
  try { await supabase.from("saved_searches").upsert({ id: s.id, user_id: userId, q: s.q, filters: s.f ?? null }); } catch { /* sessiz */ }
}
// Giriş/çıkışta çağrılır. userId varsa: sunucu kayıtlarını çek + yerelle birleştir (dedup),
// yalnız-yereldekileri sunucuya it. userId null (çıkış): yereli temizle (paylaşılan tarayıcı gizliliği).
export async function syncSavedForUser(userId: string | null) {
  currentUserId = userId;
  if (!userId) { items = []; emit(); return; }
  if (!supabase) return;
  try {
    const { data } = await supabase.from("saved_searches").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(MAX);
    const server: SavedSearch[] = (data ?? []).map((r: { id: string; q?: string; filters?: SavedFilters | null; created_at: string }) => ({
      id: r.id, q: r.q ?? "", ts: Date.parse(r.created_at) || 0, ...(r.filters ? { f: r.filters } : {})
    }));
    const serverKeys = new Set(server.map(keyOf));
    const byKey = new Map<string, SavedSearch>();
    for (const s of [...server, ...items]) { const k = keyOf(s); if (!byKey.has(k)) byKey.set(k, s); }
    const merged = [...byKey.values()].sort((a, b) => b.ts - a.ts).slice(0, MAX);
    // Yalnız-yerel (sunucuda olmayan) kayıtları sunucuya it.
    for (const s of merged) if (!serverKeys.has(keyOf(s))) void pushServer(userId, s);
    items = merged;
    emit();
  } catch { /* sessiz — çevrimdışı: yerel kalır */ }
}

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
  const entry: SavedSearch = { id: `${ts}-${query.slice(0, 12) || "flt"}`, q: query, ts, ...(hasFilters ? { f } : {}) };
  items = [entry, ...items].slice(0, MAX);
  emit();
  if (currentUserId) void pushServer(currentUserId, entry);
}
export function removeSaved(id: string) {
  items = items.filter((s) => s.id !== id);
  emit();
  if (currentUserId && supabase) { void supabase.from("saved_searches").delete().eq("id", id); }
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
