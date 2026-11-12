import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/lib/supabase";
import { searchFiltersKey } from "@/lib/search-filter-equality";
import type { MobileFilters } from "@/lib/mobile-filters";

// Kayıtlı aramalar: localStorage (anon) + sunucu (girişli, cihazlar arası senkron).
// Her kayıt: sorgu + aktif filtreler + kaydedildiği an. `f` = kaydedildiği andaki filtre
// kümesi (fiyat/komisyon/kategori/şehir/sıralama…), tıklanınca geri yüklenir.
export type SavedFilters = {
  mobile?: MobileFilters;
  province?: string;
  district?: string;
  rate?: number;
  rating?: number;
  verified?: boolean;
  featured?: boolean;
  tab?: string;
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
let accountRevision = 0;
let changed = 0;
let cacheOwner: string | null = hasStorage() ? window.localStorage.getItem(KEY+"_owner") : null;
let syncError: string | null = null;
const uuid = () => "10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(Number(c)^(Math.random()*16)>>(Number(c)/4)).toString(16));
const nativeHydration = !hasStorage() ? Promise.all([AsyncStorage.getItem(KEY),AsyncStorage.getItem(KEY+"_owner")]).then(([raw,owner])=>{
  cacheOwner=owner;
  if(changed) return;
  try { const parsed=JSON.parse(raw||"[]"); if(Array.isArray(parsed))items=parsed.filter(x=>x&&typeof x.q==="string").slice(0,MAX); listeners.forEach(fn=>fn()); } catch { /* invalid local data */ }
}).catch(()=>{}) : Promise.resolve();

function keyOf(s: SavedSearch): string {
  return `${(s.q || "").toLocaleLowerCase("tr-TR")}|${searchFiltersKey(s.f)}`;
}
async function pushServer(userId: string, s: SavedSearch) {
  if (!supabase) return;
  try { const {error}=await supabase.from("saved_searches").upsert({ id: s.id, user_id: userId, q: s.q, filters: s.f ?? null }); if(error)throw error; } catch { if(currentUserId===userId){syncError="Arama bu cihazda kaydedildi; sunucuya eşitlenemedi.";listeners.forEach(fn=>fn());} }
}
// Giriş/çıkışta çağrılır. userId varsa: sunucu kayıtlarını çek + yerelle birleştir (dedup),
// yalnız-yereldekileri sunucuya it. userId null (çıkış): yereli temizle (paylaşılan tarayıcı gizliliği).
export async function syncSavedForUser(userId: string | null) {
  const revision=++accountRevision;
  await nativeHydration;
  if(revision!==accountRevision)return;
  if ((cacheOwner && cacheOwner !== userId) || (currentUserId && currentUserId !== userId)) items=[];
  currentUserId = userId; cacheOwner=userId; syncError=null;
  items=items.map(item=>/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(item.id)?item:{...item,id:uuid()});
  emit();
  if (!userId) { items = []; emit(); return; }
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from("saved_searches").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(MAX);
    if(revision!==accountRevision)return;
    if(error)throw error;
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
  } catch { if(revision===accountRevision){syncError="Sunucudaki kayıtlı aramalar yüklenemedi; cihazdaki kayıtlar gösteriliyor.";listeners.forEach(fn=>fn());} }
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
  changed++;
  if (hasStorage()) {
    try { window.localStorage.setItem(KEY, JSON.stringify(items)); window.localStorage.setItem(KEY+"_owner",cacheOwner||""); } catch { /* sessiz */ }
  } else { void AsyncStorage.multiSet([[KEY,JSON.stringify(items)],[KEY+"_owner",cacheOwner||""]]).catch(()=>{}); }
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
  const key = `${query.toLocaleLowerCase("tr-TR")}|${searchFiltersKey(f)}`;
  if (items.some((s) => `${s.q.toLocaleLowerCase("tr-TR")}|${searchFiltersKey(s.f)}` === key)) return;
  const entry: SavedSearch = { id: uuid(), q: query, ts, ...(hasFilters ? { f } : {}) };
  items = [entry, ...items].slice(0, MAX);
  emit();
  if (currentUserId) void pushServer(currentUserId, entry);
}
export function removeSaved(id: string) {
  const previous=items.find(item=>item.id===id),userId=currentUserId;
  items = items.filter((s) => s.id !== id);
  emit();
  if (userId && supabase) { void Promise.resolve(supabase.from("saved_searches").delete().eq("id", id).eq("user_id",userId)).then(({error})=>{
    if(error&&currentUserId===userId&&previous){items=[...items.filter(item=>item.id!==id),previous].sort((a,b)=>b.ts-a.ts).slice(0,MAX);syncError="Arama silinemedi; kayıt geri yüklendi. Tekrar dene.";emit();}
  }); }
}

export function useSavedSearches() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return { items, add: addSaved, remove: removeSaved, error: syncError };
}
