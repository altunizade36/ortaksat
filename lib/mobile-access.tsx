import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useGlobalSearchParams, usePathname, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { isMobileApp } from "@/lib/mobile-app";
import { useStore } from "@/lib/use-store";

export function safeAuthRedirect(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !/[\\\r\n]/.test(value) && !/^\/auth(?:[/?#]|$)/.test(value) ? value : null;
}

export function requiresMobileAccount(path: string): boolean {
  return /^\/(create|toplu-ilan|listing-edit|listing-stats|messages|chat|partnership-request|partner|seller|profile|profile-edit|account-settings|account-security|notification-settings|buyer-requests|support|report|reports|review|engellenenler|notifications|favorites|offers|earnings|following|admin)(\/|$)/.test(path);
}

/** (tabs) navigatörünün İÇİNDE render edilen rotalar (ana sayfa, keşfet, ortak satış, ilanlarım, mesajlar, profil, menü). */
export function isTabHref(href: string): boolean {
  return href === "/" || /^\/(explore|partner|seller|messages|profile|menu)(\?|$)/.test(href);
}

/**
 * NATIVE: bir sekme rotasına, kök yığına İKİNCİ bir (tabs) navigatörü eklemeden git.
 * Kök-yığın ekranından (favoriler, bildirimler, ayarlar…) `router.push("/")` yeni bir (tabs)
 * örneği İTİYORDU: her alt-gezinme dokunuşu yığını büyütüyor, Android geri tuşu bayat ekranlardan
 * geçiyor, önceki sekmelerin kaydırma/filtre durumu kayboluyordu.
 *  - Zaten sekmelerin içindeyken → `navigate` (sekme değiştirir).
 *  - Yığında geri dönülecek ekran varken → `dismissTo` (mevcut (tabs)'a kadar POP eder + sekmeyi seçer).
 *  - Aksi halde (dönülecek ekran yok) → güvenli yedek `navigate`.
 */
export function goToTabRoute(router: ReturnType<typeof useRouter>, href: string, inTabs: boolean): void {
  if (inTabs || !router.canDismiss()) router.navigate(href as never);
  else router.dismissTo(href as never);
}

// Açılışta oturum kontrolü ağ yüzünden uzarsa (çevrimdışı + süresi dolmuş token → auth-js ~30sn
// yeniden dener) tam-ekran bekleme katmanı en fazla bu kadar durur; sonra uygulama görünür olur.
const AUTH_OVERLAY_MAX_WAIT_MS = 3000;

const AccessContext = createContext<{ skip: (to?: string) => void }>({ skip: () => {} });
export const useMobileAccess = () => useContext(AccessContext);

export function MobileAccessProvider({ children }: { children: ReactNode }) {
  const { authReady, isAuthenticated } = useStore();
  const [guest, setGuest] = useState(false);
  const [overlayTimedOut, setOverlayTimedOut] = useState(false);
  const previousAuth = useRef(isAuthenticated);
  const path = usePathname();
  const segments = useSegments() as string[];
  const globalParams = useGlobalSearchParams();
  const navigation = useRootNavigationState();
  const router = useRouter();
  // Giriş sonrası dönülecek hedef SORGU DİZGESİYLE birlikte taşınır: usePathname() sorguyu atar →
  // /listing/<id>?p=<ortak kodu> derin linkinde ortağın atıf kodu giriş duvarında kayboluyordu.
  // Dinamik yol parametreleri ([id], [slug]…) zaten yolun içindedir; yalnız gerçek sorgu eklenir.
  const dynamicNames = new Set(segments.filter((segment) => segment.startsWith("[")).map((segment) => segment.replace(/^\[(\.\.\.)?|\]$/g, "")));
  const query = Object.entries(globalParams)
    .filter(([key, value]) => !dynamicNames.has(key) && !key.startsWith("__") && !["screen", "params", "initial", "state"].includes(key) && typeof value === "string" && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`)
    .join("&");
  const redirectTarget = query ? `${path}?${query}` : path;
  // Browsing permission lasts for this launch. Supabase alone persists authenticated sessions.
  const signedOut = previousAuth.current && !isAuthenticated;
  const publicAuthRoute = /^\/(auth|onay|guven-yonlendirme|guven-profili|kullanim-sartlari|gizlilik-politikasi|kvkk|legal|hesap-silme)(\/|$)/.test(path);
  const redirect = isMobileApp && authReady && !isAuthenticated && !publicAuthRoute && (!guest || signedOut || requiresMobileAccount(path));
  useEffect(() => {
    if (!authReady) return;
    if (previousAuth.current && !isAuthenticated) setGuest(false);
    previousAuth.current = isAuthenticated;
  }, [authReady, isAuthenticated]);
  useEffect(() => {
    if (!navigation?.key || !redirect) return;
    router.replace({ pathname: "/auth", params: { redirect: redirectTarget } });
  }, [navigation?.key, redirect, redirectTarget, router]);
  useEffect(() => {
    if (!isMobileApp || authReady) return; // web'de katman yok → zamanlayıcı da yok
    const timer = setTimeout(() => setOverlayTimedOut(true), AUTH_OVERLAY_MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [authReady]);
  // "Geç": hedef verilmişse (giriş duvarına takılan HERKESE AÇIK derin link — ör. paylaşılan ilan)
  // misafir oraya gider; yoksa ana sayfaya. Native'de yığında ekran varken dismissTo kullanılır ki
  // ikinci bir (tabs) / ikinci bir ilan ekranı yığılmasın. Web'de davranış eskisiyle AYNI.
  const skip = (to?: string) => {
    setGuest(true);
    const target = to ?? "/";
    if (isMobileApp && router.canDismiss()) router.dismissTo(target as never);
    else router.replace(target as never);
  };
  return <AccessContext.Provider value={{ skip }}>
    {children}
    {isMobileApp && ((!authReady && !overlayTimedOut) || redirect) && <View accessibilityLabel="Oturum kontrol ediliyor" style={[StyleSheet.absoluteFill, { backgroundColor: "#F6F9FF", alignItems: "center", justifyContent: "center", zIndex: 9999 }]}><ActivityIndicator color="#0645C9" size="large" /></View>}
  </AccessContext.Provider>;
}
