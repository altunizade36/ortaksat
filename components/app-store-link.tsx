import { useCallback, useEffect, useState } from "react";
import { Image, Linking, Platform, Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { isMobileApp } from "@/lib/mobile-app";
import { useStore } from "@/lib/use-store";

/**
 * WEB SİTESİNDE "uygulamayı indir" bağlantıları (yalnız tarayıcıda; uygulamanın içinde hiçbiri çizilmez).
 *
 * Yerler (kullanıcı: "aşağı inmiyor insanlar" + "düğmeye bas açılır estetik değil, globalde nasılsa"):
 *  - masaüstü: başlığın üstünde ince, kapatılabilir şerit — simge, yazı, kare kod ve rozet DOĞRUDAN görünür
 *    (açılır pencere / düğme YOK);
 *  - iPhone / iPad tarayıcısı: başlığın üstünde alışılmış "uygulama bandı" (kapat · simge · ad · İndir);
 *  - giriş / hesap açma ekranında sloganın altı, telefon menüsünün üst kartı; alt bilgi yalnız yedek.
 * Hepsi sunucudaki `platform_settings.ios_app_link` anahtarına bağlıdır: kapalıyken hiçbir şey görünmez.
 * Açma / kapama: `python scripts/app-link.py ac|kapat|durum` (yeniden yayın gerekmez).
 *
 * Android telefonda App Store bağlantısı işe yaramaz → orada gösterilmez. Rozet Apple'ın resmî Türkçe
 * rozetidir (public/app-store-badge-tr.svg); yeniden çizme, rengini değiştirme.
 * Safari'nin kendi bandı (`apple-itunes-app` etiketi) bilerek KULLANILMIYOR: etiket çalışma anında eklenince
 * çalıştığı doğrulanamadı ve kendi bandımızla üst üste binerdi.
 */
export const APP_STORE_ID = "6839320320";
export const APP_STORE_URL = `https://apps.apple.com/tr/app/id${APP_STORE_ID}`;
const APP_ICON = "/apple-touch-icon.png";
const STRIP_LINE = "#C9DCFA";

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

/**
 * Üst şerit / bant kapatıldı mı. Kapatma bu tarayıcıda 14 gün hatırlanır (yalnız kişisel kolaylık; depolama
 * kapalıysa her açılışta yeniden görünür). `null` = henüz okunmadı → hiçbir şey çizilmez (yanıp sönme olmasın).
 */
const CLOSE_KEY = "os-app-strip-closed";
const CLOSE_MS = 14 * 24 * 60 * 60 * 1000;
function useStripClosed(): [boolean | null, () => void] {
  const [closed, setClosed] = useState<boolean | null>(null);
  useEffect(() => {
    let value = false;
    try { const at = Number(window.localStorage.getItem(CLOSE_KEY) ?? 0); value = at > 0 && Date.now() - at < CLOSE_MS; } catch { /* depolama kapalı */ }
    setClosed(value);
  }, []);
  const close = useCallback(() => {
    setClosed(true);
    try { window.localStorage.setItem(CLOSE_KEY, String(Date.now())); } catch { /* depolama kapalı */ }
  }, []);
  return [closed, close];
}

function openStore() {
  if (typeof window !== "undefined") window.open(APP_STORE_URL, "_blank", "noopener");
  else void Linking.openURL(APP_STORE_URL);
}
const storeLink = { href: APP_STORE_URL, hrefAttrs: { target: "_blank", rel: "noopener" } } as object;

function AppIcon({ size }: { size: number }) {
  return <Image source={{ uri: APP_ICON }} accessibilityIgnoresInvertColors style={{ backgroundColor: "#FFFFFF", borderColor: STRIP_LINE, borderRadius: Math.round(size * 0.24), borderWidth: 1, height: size, width: size }} />;
}

/** Apple'ın resmî rozeti. `height` 40 = Apple'ın önerdiği en küçük ekran boyu. */
export function AppStoreBadge({ height = 40 }: { height?: number }) {
  return <Pressable accessibilityRole="link" accessibilityLabel="OrtakSat'ı App Store'dan indir" onPress={openStore} {...storeLink} style={{ minHeight: 44, justifyContent: "center" }}>
    <Image source={{ uri: "/app-store-badge-tr.svg" }} accessibilityIgnoresInvertColors style={{ height, width: Math.round(height * 3.782) }} />
  </Pressable>;
}

/**
 * MASAÜSTÜ: başlığın üstündeki ince şerit. Her şey doğrudan görünür: uygulama simgesi, tek cümle, telefonla
 * okutulacak kare kod ve resmî rozet. Sağdaki çarpı şeridi kapatır.
 */
export function AppStoreTopStrip() {
  const { visible } = useAppStoreLink();
  const [closed, close] = useStripClosed();
  if (!visible || closed !== false) return null;
  return <View testID="top-app-store" style={{ backgroundColor: colors.primarySoft, borderBottomColor: STRIP_LINE, borderBottomWidth: 1, justifyContent: "center" }}>
    <View style={{ alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 12, justifyContent: "center", maxWidth: 1280, minHeight: 58, paddingHorizontal: 56, paddingVertical: 6, width: "100%" }}>
      <AppIcon size={40} />
      <View style={{ flexShrink: 1, gap: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 14.5, fontWeight: "900" }}>OrtakSat artık iPhone ve iPad’de</Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>Uygulamayı ücretsiz indir; ilanların ve ortaklıkların cebinde olsun.</Text>
      </View>
      <View style={{ backgroundColor: STRIP_LINE, height: 30, marginHorizontal: 10, width: 1 }} />
      <Image source={{ uri: "/app-store-qr.svg" }} accessibilityLabel="App Store sayfasının kare kodu" style={{ backgroundColor: "#FFFFFF", borderRadius: 6, height: 46, width: 46 }} />
      <Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "700", lineHeight: 15 }}>Telefonunun{"\n"}kamerasıyla okut</Text>
      <View style={{ width: 6 }} />
      <AppStoreBadge />
    </View>
    <Pressable testID="top-app-store-close" accessibilityRole="button" accessibilityLabel="Uygulama şeridini kapat" onPress={close} style={{ alignItems: "center", bottom: 0, justifyContent: "center", position: "absolute", right: 10, top: 0, width: 40 }}>
      <Icon name="close" size={18} color={colors.muted} />
    </Pressable>
  </View>;
}

/**
 * iPHONE / iPAD TARAYICISI: başlığın üstündeki alışılmış uygulama bandı — kapat · simge · ad · "İndir".
 * Banda ya da düğmeye basınca App Store açılır (uygulama kuruluysa mağaza sayfasında "Aç" görünür).
 */
export function AppStoreMobileBanner() {
  const { visible, device } = useAppStoreLink();
  const [closed, close] = useStripClosed();
  if (!visible || device !== "ios" || closed !== false) return null;
  return <View testID="mobile-app-store" style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderBottomColor: STRIP_LINE, borderBottomWidth: 1, flexDirection: "row", minHeight: 60 }}>
    <Pressable testID="mobile-app-store-close" accessibilityRole="button" accessibilityLabel="Uygulama bandını kapat" onPress={close} style={{ alignItems: "center", height: 60, justifyContent: "center", width: 40 }}>
      <Icon name="close" size={18} color={colors.muted} />
    </Pressable>
    <Pressable accessibilityRole="link" accessibilityLabel="OrtakSat uygulamasını App Store'dan indir" onPress={openStore} {...storeLink} style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: 10, minHeight: 60, minWidth: 0, paddingRight: 12 }}>
      <AppIcon size={40} />
      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 14.5, fontWeight: "900" }}>OrtakSat</Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>App Store’da ücretsiz</Text>
      </View>
      <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, height: 32, justifyContent: "center", paddingHorizontal: 18 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>İndir</Text>
      </View>
    </Pressable>
  </View>;
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

/** Alt bilgideki satır (yedek): telefonda yalnız rozet; masaüstünde rozet + telefonla okutulacak kare kod. */
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
