import type { PropsWithChildren } from "react";
import { View, type ViewStyle } from "react-native";

import { useIsWideWeb } from "@/lib/layout";

/**
 * Centers and width-caps page content on desktop web so forms, lists and text
 * don't stretch edge-to-edge across a wide monitor (which reads as a blown-up
 * mobile app). On native and narrow web it is a transparent passthrough, so
 * mobile layouts are completely unaffected.
 *
 * Use a wider `max` for grids/feeds and a narrower one for forms/reading.
 */
/** Site geneli standart içerik genişliği (Sahibinden benzeri): tüm sayfalar aynı
 * genişlikte, ortalı, eşit kenar boşluğu. Tek yerden değişir. */
export const PAGE_MAX_WIDTH = 1280;

export function WebContainer({
  children,
  max = PAGE_MAX_WIDTH,
  padding = 20,
  style
}: PropsWithChildren<{ max?: number; padding?: number; style?: ViewStyle }>) {
  const isWideWeb = useIsWideWeb();

  if (!isWideWeb) return <>{children}</>;

  return (
    <View style={[{ alignSelf: "center", maxWidth: max, paddingHorizontal: padding, width: "100%" }, style]}>
      {children}
    </View>
  );
}
