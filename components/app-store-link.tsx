import { useEffect, useState } from "react";
import { Image, Linking, Platform, Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { isMobileApp } from "@/lib/mobile-app";
import { useStore } from "@/lib/use-store";

/**
 * WEB SİTESİNDE "uygulamayı indir" bağlantıları (yalnız tarayıcıda; uygulamanın içinde hiçbiri çizilmez).
 *
 * Yerler (kullanıcı "aşağı inmiyor insanlar" dedi → asıl yerler ÜSTTE): masaüstü gezinme çubuğunun sağ ucu,
 * telefonda logo satırının sağı, giriş / hesap açma ekranında sloganın altı, telefon menüsünün üst kartı,
 * iPhone Safari üst bandı; alt bilgi yalnız yedek.
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

/**
 * Masaüstü üst gezinme çubuğunun sağ ucundaki mavi "Uygulamayı indir" düğmesi. Basınca küçük bir pencere açılır:
 * kare kod (telefonla okutulur) + resmî rozet. Masaüstünde uygulama kurulamadığı için asıl yol kare koddur.
 */
export function AppStoreNavButton() {
  const { visible } = useAppStoreLink();
  const [open, setOpen] = useState(false);
  if (!visible) return null;
  return <View testID="nav-app-store" style={{ alignSelf: "center", position: "relative", zIndex: open ? 1000 : 1 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="OrtakSat uygulamasını indir" accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, flexDirection: "row", gap: 6, height: 32, paddingHorizontal: 13 }}>
      <Icon name="cellphone-arrow-down" size={17} color="#FFFFFF" />
      <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Uygulamayı indir</Text>
    </Pressable>
    {open ? <>
      <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden onPress={() => setOpen(false)} style={{ bottom: -3000, left: -3000, position: "absolute", right: -3000, top: -3000, zIndex: 900 }} />
      <View testID="nav-app-store-panel" style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, overflow: "hidden", paddingBottom: 14, position: "absolute", right: 0, shadowColor: "#101828", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.18, shadowRadius: 30, top: 40, width: 248, zIndex: 1000 }}>
        <View style={{ alignSelf: "stretch", backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 11 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900", textAlign: "center" }}>OrtakSat iPhone ve iPad’de</Text>
        </View>
        <Image source={{ uri: "/app-store-qr.svg" }} accessibilityLabel="App Store sayfasının kare kodu" style={{ height: 132, width: 132 }} />
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 16, paddingHorizontal: 16, textAlign: "center" }}>Telefonunun kamerasıyla okut, uygulamayı indir.</Text>
        <AppStoreBadge />
      </View>
    </> : null}
  </View>;
}

/** Telefon tarayıcısında logo satırının sağındaki küçük "Uygulama" simgesi (yalnız iPhone / iPad). */
export function AppStoreHeaderIcon({ tight = false }: { tight?: boolean }) {
  const { visible, device } = useAppStoreLink();
  if (!visible || device !== "ios") return null;
  // `tight` (375 px ve altı): "Uygulama" yazısı logoyu 8 px kırpıyordu → yalnız daire, daha dar.
  return <Pressable testID="header-app-store" accessibilityRole="link" accessibilityLabel="OrtakSat uygulamasını App Store'dan indir" onPress={openStore} {...({ href: APP_STORE_URL, hrefAttrs: { target: "_blank", rel: "noopener" } } as object)} style={{ alignItems: "center", gap: 1, justifyContent: "center", minHeight: 44, minWidth: tight ? 34 : 44 }}>
    <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, height: tight ? 30 : 26, justifyContent: "center", width: tight ? 30 : 26 }}>
      <Icon name="cellphone-arrow-down" size={tight ? 18 : 16} color="#FFFFFF" />
    </View>
    {!tight ? <Text numberOfLines={1} style={{ color: colors.primary, fontSize: 9.5, fontWeight: "800", lineHeight: 12 }}>Uygulama</Text> : null}
  </Pressable>;
}

/**
 * Giriş / hesap açma ekranının ÜSTÜNDE, fotoğraflı alanda sloganın hemen altında (yalnız web).
 * Telefonda yalnız rozet; geniş ekranda beyaz kartta kare kod + rozet.
 */
export function AppStoreAuthHero({ wide }: { wide: boolean }) {
  const { visible } = useAppStoreLink();
  if (!visible) return null;
  if (!wide) return <View testID="auth-app-store" style={{ alignItems: "center", marginTop: 8 }}><AppStoreBadge /></View>;
  return <View testID="auth-app-store" style={{ alignItems: "center", backgroundColor: "#FFFFFFE6", borderRadius: 18, flexDirection: "row", gap: 12, marginTop: 20, paddingHorizontal: 14, paddingVertical: 10 }}>
    <Image source={{ uri: "/app-store-qr.svg" }} accessibilityLabel="App Store sayfasının kare kodu" style={{ backgroundColor: "#FFFFFF", borderRadius: 8, height: 68, width: 68 }} />
    <View style={{ gap: 2 }}>
      <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>OrtakSat iPhone ve iPad’de</Text>
      <AppStoreBadge />
    </View>
  </View>;
}

/** Giriş ekranındaki fotoğraflı alan rozet için ne kadar uzasın (telefon tarayıcısı, form açıkken). */
export function useAppStoreAuthExtra(): number {
  return useAppStoreLink().visible ? 50 : 0;
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
