import { useEffect, useState } from "react";

/**
 * Gelen kutusu tercihleri (yıldız / takip / arşiv) — web'de localStorage'da,
 * kullanıcıya göre ayrılmış olarak kalıcı tutulur. Önceden bunlar sayfa-içi
 * useState idi ve her yenilemede kayboluyordu (ölü kontrol hissi).
 *
 * Native'de localStorage yoktur → bellek-içi önbelleğe düşer (eski davranış,
 * regresyon yok). Kalıcılık web geliştirmesidir; canlı trafiğin büyük kısmı web.
 */
type Prefs = { starred: string[]; following: string[]; archived: string[] };
const KEY = "ortaksat_inbox_prefs_v1";
const cache: Record<string, Prefs> = {};
const listeners = new Set<() => void>();

function hasStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}
function keyFor(uid: string) {
  return `${KEY}:${uid}`;
}
function arr(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
}
function load(uid: string): Prefs {
  if (cache[uid]) return cache[uid];
  let p: Prefs = { starred: [], following: [], archived: [] };
  if (hasStorage()) {
    try {
      const raw = window.localStorage.getItem(keyFor(uid));
      if (raw) {
        const o = JSON.parse(raw) as Partial<Prefs>;
        p = { starred: arr(o.starred), following: arr(o.following), archived: arr(o.archived) };
      }
    } catch {
      /* sessiz */
    }
  }
  cache[uid] = p;
  return p;
}
function save(uid: string) {
  if (hasStorage()) {
    try {
      window.localStorage.setItem(keyFor(uid), JSON.stringify(cache[uid]));
    } catch {
      /* sessiz */
    }
  }
  listeners.forEach((l) => l());
}
function toggle(uid: string, kind: keyof Prefs, id: string) {
  if (!id) return;
  const p = load(uid);
  p[kind] = p[kind].includes(id) ? p[kind].filter((x) => x !== id) : [...p[kind], id];
  save(uid);
}
function rec(list: string[]): Record<string, boolean> {
  const r: Record<string, boolean> = {};
  for (const id of list) r[id] = true;
  return r;
}

export function useInboxPrefs(userId: string | undefined) {
  const uid = userId || "anon";
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const p = load(uid);
  return {
    starred: rec(p.starred),
    following: rec(p.following),
    archivedIds: p.archived,
    toggleStar: (id: string) => toggle(uid, "starred", id),
    toggleFollow: (id: string) => toggle(uid, "following", id),
    toggleArchive: (id: string) => toggle(uid, "archived", id)
  };
}
