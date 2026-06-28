import { useWindowDimensions } from "react-native";

/**
 * Max width of the centered web "app shell" (must match #root max-width in app/+html.tsx).
 * On native this is effectively ignored because device width is always smaller.
 */
export const SHELL_MAX_WIDTH = 1180;

/**
 * Window width clamped to the shell. On desktop web the window can be far wider
 * than the rendered app, so layout math must use the shell width — not the raw
 * window — or grids overflow and clip.
 */
export function useContentWidth() {
  const { width } = useWindowDimensions();
  return Math.min(width, SHELL_MAX_WIDTH);
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
  const { available, minCardWidth = 168, gap = 10, minColumns = 2, maxColumns = 8 } = options;
  const raw = Math.floor((available + gap) / (minCardWidth + gap));
  const columns = Math.max(minColumns, Math.min(maxColumns, raw || minColumns));
  const cardWidth = Math.floor((available - gap * (columns - 1)) / columns);
  return { columns, cardWidth, gap };
}
