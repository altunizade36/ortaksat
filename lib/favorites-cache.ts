import { useEffect, useState } from "react";

/**
 * Hafif favori-id önbelleği. Amaç: binlerce memo'lu ListingCard'ın favori
 * durumunu göstermesi için TÜM app-store'a abone olmamak (useCompare ile aynı
 * hafif dış-store deseni). app-store gerçek kaynaktır: favoriler değişince
 * `syncFavorites` ile id kümesini buraya yansıtır ve `registerFavoriteToggle`
 * ile toggle fonksiyonunu kaydeder. Kart yalnızca bu küçük store'a abone olur.
 */
let ids = new Set<string>();
let toggleImpl: ((id: string) => void) | null = null;
const listeners = new Set<() => void>();

export function syncFavorites(list: string[]) {
  const next = new Set(list);
  if (next.size === ids.size && [...next].every((x) => ids.has(x))) return; // değişmediyse render tetikleme
  ids = next;
  listeners.forEach((l) => l());
}
export function registerFavoriteToggle(fn: (id: string) => void) {
  toggleImpl = fn;
}
export function toggleFavoriteCached(id: string) {
  toggleImpl?.(id);
}

/** Kartta favori kalbi için: mevcut durum + toggle. Yalnızca favori kümesine abone. */
export function useFavoriteFlag(id: string): { isFav: boolean; toggle: () => void } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return { isFav: ids.has(id), toggle: () => toggleFavoriteCached(id) };
}
