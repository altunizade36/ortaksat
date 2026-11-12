import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { isMobileApp } from "@/lib/mobile-app";
import { useStore } from "@/lib/use-store";

export function safeAuthRedirect(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !/[\\\r\n]/.test(value) && !/^\/auth(?:[/?#]|$)/.test(value) ? value : null;
}

export function requiresMobileAccount(path: string): boolean {
  return /^\/(create|toplu-ilan|listing-edit|listing-stats|messages|chat|partnership-request|partner|seller|profile|profile-edit|account-settings|account-security|notification-settings|buyer-requests|support|report|reports|review|engellenenler|notifications|favorites|offers|earnings|following|admin)(\/|$)/.test(path);
}

const AccessContext = createContext({ skip: () => {} });
export const useMobileAccess = () => useContext(AccessContext);

export function MobileAccessProvider({ children }: { children: ReactNode }) {
  const { authReady, isAuthenticated } = useStore();
  const [guest, setGuest] = useState(false);
  const previousAuth = useRef(isAuthenticated);
  const path = usePathname();
  const navigation = useRootNavigationState();
  const router = useRouter();
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
    router.replace({ pathname: "/auth", params: { redirect: path } });
  }, [navigation?.key, redirect, path, router]);
  return <AccessContext.Provider value={{ skip: () => { setGuest(true); router.replace("/"); } }}>
    {children}
    {isMobileApp && (!authReady || redirect) && <View accessibilityLabel="Oturum kontrol ediliyor" style={[StyleSheet.absoluteFill, { backgroundColor: "#F6F9FF", alignItems: "center", justifyContent: "center", zIndex: 9999 }]}><ActivityIndicator color="#0645C9" size="large" /></View>}
  </AccessContext.Provider>;
}
