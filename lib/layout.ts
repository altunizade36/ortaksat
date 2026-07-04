import { useEffect, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";

/**
 * Max width of the centered web "app shell" (must match #root max-width in app/+html.tsx).
 * On native this is effectively ignored because device width is always smaller.
 */
export const SHELL_MAX_WIDTH = 1440;

/** Breakpoint at/above which the web UI switches to its desktop layout. */
export const WIDE_WEB_BREAKPOINT = 760;

/**
 * Window width clamped to the shell. On desktop web the window can be far wider
 * than the rendered app, so layout math must use the shell width — not the raw
 * window — or grids overflow and clip.
 *
 * On web `useWindowDimensions()` does not reliably update after static-render
 * hydration (no resize fires), so we read `window.innerWidth` once mounted and
 * subscribe to resize. Native keeps using `useWindowDimensions`.
 */
export function useContentWidth() {
  const { width } = useWindowDimensions();
  // ÖNEMLİ: web'de useWindowDimensions().width hidrasyondan sonra güvenilmez ve
  // ilk client render'da büyük bir varsayılan dönebilir; bu da mobilde masaüstü
  // düzeninin yanlışlıkla açılmasına (flaş) yol açardı. Bu yüzden webWidth'i ilk
  // client render'ından itibaren gerçek window.innerWidth ile başlatıyoruz.
  const [webWidth, setWebWidth] = useState<number | null>(
    Platform.OS === "web" && typeof window !== "undefined" ? window.innerWidth : null
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const update = () => setWebWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
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
