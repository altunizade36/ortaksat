import { useEffect, useState, type PropsWithChildren } from "react";
import { Platform, View, type ViewStyle } from "react-native";

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
  // Hidrasyon güvenliği (React #418): SSG'de genişlik bilinmediğinden dar/geniş
  // dalı sunucu↔istemci arasında YAPISAL uyuşmuyordu (geniş=<View> sarar, dar=çıplak
  // children). Mount'a kadar deterministik olarak "geniş" varsay (hep View sar) →
  // ilk render sunucuyla birebir; mount sonrası gerçek genişliğe geç.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Native: mobil düzen etkilenmesin diye şeffaf geçiş.
  if (Platform.OS !== "web") return <>{children}</>;

  const wide = mounted ? isWideWeb : true;
  if (!wide) return <>{children}</>;

  return (
    <View style={[{ alignSelf: "center", maxWidth: max, paddingHorizontal: padding, width: "100%" }, style]}>
      {children}
    </View>
  );
}
