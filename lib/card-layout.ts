/** Tabular prices need room for the complete currency value in narrow web grids. */
export function cardPriceFontSize(label: string, availableWidth: number, preferred = 22): number {
  return Math.max(11, Math.min(preferred, Math.floor(Math.max(70, availableWidth) / Math.max(1, label.length * 0.64))));
}

/** Fixed content slots keep adjacent cards aligned without stretching to page height. */
export const LISTING_GRID_PHOTO_RATIO = 2;
export const LISTING_GRID_BODY_HEIGHT = 96;
/** Marketplace grids add columns before cards grow past the visual standard. */
export function marketplaceCardGrid(options: {
  available: number;
  gap?: number;
  minCardWidth?: number;
  maxCardWidth?: number;
  minColumns?: number;
  maxColumns?: number;
}) {
  const { available, gap = 10, minCardWidth = 148, maxCardWidth = 210, minColumns = 2, maxColumns = 6 } = options;
  const desired = Math.ceil((Math.max(0, available) + gap) / (maxCardWidth + gap));
  const feasible = Math.floor((Math.max(0, available) + gap) / (minCardWidth + gap));
  const columns = Math.max(minColumns, Math.min(maxColumns, Math.max(desired, feasible || minColumns)));
  return { columns, cardWidth: Math.floor((available - gap * (columns - 1)) / columns), gap };
}
