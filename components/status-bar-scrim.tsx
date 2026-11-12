import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isMobileApp } from "@/lib/mobile-app";

/**
 * UYGULAMA (Android 15+ kenardan-kenara / iOS): ekranlar durum çubuğunun ALTINA kadar çizilir.
 * Kaydırılan içerik (başlıklar, fiyatlar) saat/pil simgelerinin arkasından geçip üst üste biniyordu.
 * Bu ince örtü durum çubuğu alanını her ekranda okunur tutar; dokunmaları engellemez.
 */
export function StatusBarScrim() {
  const insets = useSafeAreaInsets();
  if (!isMobileApp || insets.top <= 0) return null;
  return <View pointerEvents="none" style={{ backgroundColor: "#FFFFFFF2", height: insets.top, left: 0, position: "absolute", right: 0, top: 0, zIndex: 40 }} />;
}
