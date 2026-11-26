import { useEffect, useState } from "react";
import { Image, Linking, Platform, Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { isMobileApp } from "@/lib/mobile-app";
import { useStore } from "@/lib/use-store";

/**
 * WEB SİTESİNDE "uygulamayı indir" bağlantıları (yalnız tarayıcıda; uygulamanın içinde hiçbiri çizilmez).
 *
 * Yerler: alt bilgi, telefon menüsü, giriş / hesap açma ekranı, iPhone Safari üst bandı.
 * Hepsi sunucudaki `platform_settings.ios_app_link` anahtarına bağlıdır: kapalıyken hiçbir şey görünmez.
 * Açma / kapama: `python scripts/app-link.py ac|kapat|durum` (yeniden yayın gerekmez).
 *
 * Android telefonda App Store bağlantısı işe yaramaz → orada gösterilmez. Rozet Apple'ın resmî Türkçe
 * rozetidir (public/app-store-badge-tr.svg); yeniden çizme, rengini değiştirme.
 */
export const APP_STORE_ID = "6839320320";
export const APP_STORE_URL = `https://apps.apple.com/tr/app/id${APP_STORE_ID}`;

type Device = "ios" | "android" | "other";
function detectDevice(): Device {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  // iPadOS masaüstü kimliğiyle gelir; dokunmatik Mac yoktur → dokunma noktasıyla ayırt edilir.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1)) return "ios";
  return "other";
}

/** Bağlantı gösterilecek mi + cihaz türü. İlk çizim sunucuyla aynı kalsın diye sonuç mount'tan sonra gelir. */
export function useAppStoreLink(): { visible: boolean; device: Device } {
  const { platformSettings } = useStore();
  const [device, setDevice] = useState<Device | null>(null);
  useEffect(() => { setDevice(detectDevice()); }, []);
  const enabled = Platform.OS === "web" && !isMobileApp && platformSettings.iosAppLink === true;
  return { visible: enabled && device !== null && device !== "android", device: device ?? "other" };
}

function openStore() {
  if (typeof window !== "undefined") window.open(APP_STORE_URL, "_blank", "noopener");
  else void Linking.openURL(APP_STORE_URL);
}

/** Apple'ın resmî rozeti. `height` 40 = Apple'ın önerdiği en küçük ekran boyu. */
export function AppStoreBadge({ height = 40 }: { height?: number }) {
  return <Pressable accessibilityRole="link" accessibilityLabel="OrtakSat'ı App Store'dan indir" onPress={openStore} {...({ href: APP_STORE_URL, hrefAttrs: { target: "_blank", rel: "noopener" } } as object)} style={{ minHeight: 44, justifyContent: "center" }}>
    <Image source={{ uri: "/app-store-badge-tr.svg" }} accessibilityIgnoresInvertColors style={{ height, width: Math.round(height * 3.782) }} />
  </Pressable>;
}

/** Alt bilgideki satır: telefonda yalnız rozet; masaüstünde rozet + telefonla okutulacak kare kod. */
export function AppStoreFooterRow({ compact }: { compact: boolean }) {
  const { visible } = useAppStoreLink();
  if (!visible) return null;
  return <View testID="footer-app-store" style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: compact ? 10 : 14, justifyContent: "center", paddingBottom: 6, paddingTop: 2 }}>
    <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800", textAlign: "center" }}>OrtakSat iPhone ve iPad’de</Text>
    <AppStoreBadge />
    {!compact ? <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
      <Image source={{ uri: "/app-store-qr.svg" }} accessibilityLabel="App Store sayfasının kare kodu" style={{ backgroundColor: "#FFFFFF", borderColor: colors.line, borderRadius: 8, borderWidth: 1, height: 64, width: 64 }} />
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 15, maxWidth: 120 }}>Telefonunun kamerasıyla okut, uygulamayı indir.</Text>
    </View> : null}
  </View>;
}

/** Giriş / hesap açma ekranının altında (yalnız web): ince çizgi, kısa yazı ve ortalanmış rozet. */
export function AppStoreAuthRow() {
  const { visible } = useAppStoreLink();
  if (!visible) return null;
  return <View testID="auth-app-store" style={{ alignItems: "center", borderTopColor: "#DCE6F5", borderTopWidth: 1, gap: 6, marginTop: 20, paddingTop: 16 }}>
    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700", textAlign: "center" }}>OrtakSat iPhone ve iPad’de de yanında</Text>
    <AppStoreBadge />
  </View>;
}

/** Telefon tarayıcısındaki menünün üst kartında: tek satırlık "uygulamayı indir" düğmesi (yalnız iPhone / iPad). */
export function AppStoreMenuRow() {
  const { visible, device } = useAppStoreLink();
  if (!visible || device !== "ios") return null;
  return <Pressable testID="menu-app-store" accessibilityRole="link" accessibilityLabel="OrtakSat uygulamasını App Store'dan indir" onPress={openStore} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 52, paddingHorizontal: 12, paddingVertical: 8 }}>
    <Icon name="cellphone-arrow-down" size={24} color={colors.primary} />
    <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>OrtakSat uygulamasını indir</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>App Store’da ücretsiz</Text>
    </View>
    <Icon name="chevron-right" size={20} color={colors.muted} />
  </Pressable>;
}

/**
 * iPhone / iPad Safari'nin kendi üst bandı ("Aç" ya da "Görüntüle"): sayfaya `apple-itunes-app` etiketi eklenince
 * Safari çizer; uygulama kuruluysa doğrudan açar. Anahtar kapalıyken etiket eklenmez. Kök düzende bir kez çizilir.
 */
export function AppStoreSmartBanner() {
  const { visible, device } = useAppStoreLink();
  useEffect(() => {
    if (!visible || device !== "ios" || typeof document === "undefined") return;
    if (document.querySelector('meta[name="apple-itunes-app"]')) return;
    const meta = document.createElement("meta");
    meta.name = "apple-itunes-app";
    meta.content = `app-id=${APP_STORE_ID}`;
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, [visible, device]);
  return null;
}
