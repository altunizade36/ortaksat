import { useEffect, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";

/**
 * Max width of the centered web "app shell" (must match #root max-width in app/+html.tsx).
 * On native this is effectively ignored because device width is always smaller.
 */
export const SHELL_MAX_WIDTH = 1440;

/** Breakpoint at/above which the web UI switches to its desktop layout. */
// A full desktop header and sidebar need room for navigation and readable cards.
// Portrait tablets retain the compact web layout rather than overflowing at 768px.
export const WIDE_WEB_BREAKPOINT = 1024;

/**
 * Window width clamped to the shell. On desktop web the window can be far wider
 * than the rendered app, so layout math must use the shell width — not the raw
 * window — or grids overflow and clip.
 *
 * On web `useWindowDimensions()` does not reliably update after static-render
 * hydration (no resize fires), so we read `window.innerWidth` once mounted and
 * subscribe to resize. Native keeps using `useWindowDimensions`.
 */
// Pencere genişliği TEK yerden okunur ve paylaşılır (2026-11-15).
// Eskiden bu kancayı kullanan HER bileşen kendi durumunu tutuyor, mount olurken `window.innerWidth` okuyor ve kendi
// resize dinleyicisini ekliyordu. `innerWidth` okumak tarayıcıyı o an düzeni yeniden hesaplamaya zorlar; yüzlerce
// bileşen çizim arasında art arda okuyunca (yavaş telefonda) sayfa açılışına ~600 ms ekliyordu. Artık değer bir kez
// ölçülür, yalnız `resize` olayında yenilenir; bileşenler hazır değeri alır.
let sharedWidth: number | null = null;
const widthListeners = new Set<(width: number) => void>();
let resizeBound = false;

function readSharedWidth(): number {
  if (sharedWidth === null) sharedWidth = window.innerWidth;
  if (!resizeBound) {
    resizeBound = true;
    window.addEventListener("resize", () => {
      const next = window.innerWidth;
      if (next === sharedWidth) return;
      sharedWidth = next;
      widthListeners.forEach((listener) => listener(next));
    });
  }
  return sharedWidth;
}

export function useContentWidth() {
  const { width } = useWindowDimensions();
  // ÖNEMLİ: web'de useWindowDimensions().width hidrasyondan sonra güvenilmez ve
  // ilk client render'da büyük bir varsayılan dönebilir; bu da mobilde masaüstü
  // düzeninin yanlışlıkla açılmasına (flaş) yol açardı. Bu yüzden webWidth'i ilk
  // client render'ından itibaren gerçek pencere genişliğiyle başlatıyoruz.
  const [webWidth, setWebWidth] = useState<number | null>(
    Platform.OS === "web" && typeof window !== "undefined" ? readSharedWidth() : null
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    setWebWidth(readSharedWidth());
    widthListeners.add(setWebWidth);
    return () => { widthListeners.delete(setWebWidth); };
  }, []);

  // Web'de daima gerçek pencere genişliğini kullan (useWindowDimensions'a düşme).
  const effective = Platform.OS === "web" ? (webWidth ?? width) : width;
  return Math.min(effective, SHELL_MAX_WIDTH);
}

/**
 * True on web desktop-width viewports. False on native and narrow web.
 *
 * Gated behind a mount flag so the very first render (static export on the
 * server AND the first client render during hydration) agree — both return
 * false — avoiding a hydration mismatch (React #418) from the desktop/mobile
 * branches. After mount it reflects the real viewport.
 */
export function useIsWideWeb() {
  const contentWidth = useContentWidth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (Platform.OS !== "web") return false;
  return mounted && contentWidth >= WIDE_WEB_BREAKPOINT;
}

/**
 * Hidrasyon-gate: web'de ilk render'da (SSG + istemci-ilk) `false`, mount sonrası
 * `true`. Auth-korumalı / uygulama-içi (SEO'suz) sayfalarda, SSG'de bake edilen
 * ağaç (ör. AuthRequired) ile istemcinin girişli ağacı arasındaki React #418
 * uyuşmazlığını gidermek için: `if (!useMounted()) return <iskelet>`. SEO baked
 * içeriği olan sayfalarda (kategori/blog) KULLANMA — SSG'yi boşaltır.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return Platform.OS !== "web" ? true : mounted;
}

/**
 * Responsive column count + exact card width for a wrap grid.
 * Phones land on `minColumns`; wide web shells fill with more columns while
 * keeping each card at least `minCardWidth` wide.
 */
export function responsiveGrid(options: {
  available: number;
  minCardWidth?: number;
  gap?: number;
  minColumns?: number;
  maxColumns?: number;
}) {
  const { available, minCardWidth = 168, gap = 10, minColumns = 2, maxColumns = 14 } = options;
  const raw = Math.floor((available + gap) / (minCardWidth + gap));
  const columns = Math.max(minColumns, Math.min(maxColumns, raw || minColumns));
  const cardWidth = Math.floor((available - gap * (columns - 1)) / columns);
  return { columns, cardWidth, gap };
}
