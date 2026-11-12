import type { ReactNode } from "react";
import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MobileHeader, mobile } from "./ui";

/**
 * NATIVE "ayrıntılı" panel çerçevesi (satıcı / ortak / kazanç / ayarlar `?view=advanced`).
 *
 * Bu paneller web düzenini yeniden kullanır ve kendi başlık seçeneğini BELİRLEMEZ. Sonuç native'de
 * geçmişe bağlıydı: aynı sekmedeki mobil ekran `headerShown:false` bırakmışsa panel başlıksız ve
 * geri düğmesiz açılıyor (Android'de içerik durum çubuğunun altına giriyordu), ilk kez açılıyorsa
 * web sitesinin başlığı (arama çubuğu + web gezinme şeridi) uygulamanın içinde görünüyordu.
 * Çerçeve başlığı her iki durumda da AÇIKÇA kapatır ve mobil başlık + geri düğmesi çizer.
 *
 * `hubParams`: panel bir SEKME rotasında (seller/partner) açıldıysa geri düğmesi aynı rotanın
 * mobil ekranına döner (view/focus parametrelerini temizler). Verilmezse normal geri gezinme.
 */
export function NativeAdvancedFrame({ title, hubParams, children }: { title: string; hubParams?: boolean; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const backToHub = hubParams ? () => router.setParams({ view: undefined, focus: undefined } as never) : undefined;
  return (
    <View style={{ backgroundColor: mobile.canvas, flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ backgroundColor: mobile.canvas, paddingTop: insets.top }}>
        <MobileHeader title={title} onBack={backToHub} />
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
