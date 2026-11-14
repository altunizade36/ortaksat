import { useEffect, useState, type PropsWithChildren } from "react";
import { Platform, View, type ViewStyle } from "react-native";

import { useIsWideWeb } from "@/lib/layout";

/**
 * Centers and width-caps page content on desktop web so forms, lists and text
 * don't stretch edge-to-edge across a wide monitor (which reads as a blown-up
 * mobile app). On narrow web it only adds the side padding; on native see the note
 * inside the component (page-level containers get the same box, tab screens pass through).
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

  // Uygulama (native):
  // - Sayfa kendi kenar boşluğunu ve aralığını bu kapsayıcıya bırakmışsa (`style` verilmiş + padding > 0: bilgi
  //   sayfaları, kategori, toplu ilan) dar web'deki kutunun AYNISI kurulur. Eskiden burada da çıplak children
  //   dönüyordu → `style` (gap, paddingTop) ve `padding` yok sayılıyor, uygulamada kartlar ekran kenarına yapışık,
  //   bölümler arasında boşluksuz çiziliyordu (2026-11-15, emülatörde görüldü).
  // - Diğer kullanımlar (sekme ekranları: padding 0 ya da stilsiz) eskisi gibi şeffaf geçer; onların düzeni
  //   üstteki kaydırma alanından gelir, araya kutu girerse bozulur.
  if (Platform.OS !== "web") {
    if (style && padding > 0) return <View style={[{ paddingHorizontal: Math.min(padding, 14), width: "100%" }, style]}>{children}</View>;
    return <>{children}</>;
  }

  const wide = mounted ? isWideWeb : true;
  // Mobil web: eskiden ÇIPLAK children dönüyordu → `padding` prop'u yok sayılıyor, yalnız
  // WebContainer'a dayanan sayfalar (sss/hakkımızda/güvenli-alışveriş) kenara yapışık
  // (x=0) render oluyordu. Artık mobilde de yatay kenar boşluğu uygulanır (yapı yine
  // <View> → #418 hidrasyon güvenli, wide/narrow yapısal fark yok).
  if (!wide) {
    return (
      <View style={[{ paddingHorizontal: Math.min(padding, 14), width: "100%" }, style]}>
        {children}
      </View>
    );
  }

  return (
    <View style={[{ alignSelf: "center", maxWidth: max, paddingHorizontal: padding, width: "100%" }, style]}>
      {children}
    </View>
  );
}
