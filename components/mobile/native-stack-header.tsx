import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MobileBrand } from "@/components/mobile-brand";
import { useBackNavigation } from "@/lib/use-back-navigation";

import { IconButton, mobile } from "./ui";

/**
 * UYGULAMA — kök yığının VARSAYILAN başlığı (2026-11-16).
 *
 * Kendi başlığını çizmeyen ekranlar (ortak dizini, ortak aranıyor, ortak vitrini, takip ettiklerim, blog,
 * nasıl çalışır, kurumsal, toplu ilan, tanıtım sayfaları…) uygulamada SİTE başlığıyla açılıyordu: site arama
 * kutusu ("ortaksat.com'da Ara"), site gezinme şeridi ve "Ücretsiz İlan Ver" düğmesi. Uygulamanın içinde site
 * görünümü hem tutarsızdı hem de mağaza incelemesinde "site sarmalayıcı" izlenimi verir.
 *
 * Bu başlık yalnız geri düğmesi + logo çizer. Yazılı başlık BİLEREK yok: sayfalar kendi başlığını içerikte
 * taşıyor; logo satırının üstüne ayrı yazılı başlık satırı eklenmez. Logoya dokunmak ana sayfaya götürür.
 * Web'de kullanılmaz (app/_layout.tsx yalnız uygulamada seçer); kendi başlığını çizen ekranlar etkilenmez.
 */
export function NativeStackHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = useBackNavigation();
  return (
    <View style={{ backgroundColor: "#FFFFFF", borderBottomColor: mobile.line, borderBottomWidth: 1, paddingTop: insets.top }}>
      <View style={{ alignItems: "center", flexDirection: "row", height: 54, paddingHorizontal: 8 }}>
        <IconButton name="chevron-left" label="Geri" onPress={goBack} />
        <View style={{ alignItems: "center", flex: 1 }}>
          <Pressable accessibilityRole="link" accessibilityLabel="OrtakSat ana sayfa" hitSlop={8} onPress={() => { if (router.canDismiss()) router.dismissTo("/"); else router.replace("/"); }}>
            <MobileBrand size={25} />
          </Pressable>
        </View>
        {/* Geri düğmesiyle aynı genişlikte boşluk: logo tam ortada kalsın. */}
        <View style={{ width: 44 }} />
      </View>
    </View>
  );
}
