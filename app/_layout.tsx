import Head from "expo-router/head";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Alert } from "@/lib/alert";
import { AppHeader } from "@/components/app-header";
import { colors } from "@/components/colors";
import { CompareBar } from "@/components/compare-bar";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import { GlobalSeo } from "@/components/global-seo";
import { RouteErrorBoundary } from "@/components/error-boundary";
import { StoreProvider } from "@/data/app-store";
import { LanguageProvider, useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/use-store";

// expo-router, alt ağaçta render hatası yakalarsa bu fallback'i gösterir.
export { RouteErrorBoundary as ErrorBoundary };

// Native açılış ekranını ilk render'a kadar tut (beyaz-flaş/erken-boş-durum yok). Web'de no-op.
if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}
// Google/OAuth tarayıcı oturumunun düzgün tamamlanması için (expo-web-browser önerisi).
WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <StoreProvider>
          <RootStack />
        </StoreProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { t } = useLanguage();

  // İlk render'dan sonra açılış ekranını gizle (beyaz-flaş/erken-boş-durum yok). Web'de no-op.
  // Not: SDK 56 edge-to-edge modunda alt sistem çubuğu şeffaftır; safe-area insets ile yönetilir.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const id = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 80);
    return () => clearTimeout(id);
  }, []);

  return (
    <View nativeID="app-shell" style={{ flex: 1 }}>
      <StatusBar style="dark" />
      {/* Varsayılan <title>/description — sayfaların kendi Head'i (varsa) bunu ezer.
          Böylece hiçbir sayfa BOŞ başlıkla kalmaz (statik export SEO). */}
      <Head>
        <title>OrtakSat — Ortak satış ve ilan platformu</title>
        <meta name="description" content="OrtakSat: ürünlerini ortak sat, komisyon kazan. Emlak, vasıta, elektronik ve daha fazlası. Aracı platform — ödeme ve teslimat taraflar arasında gerçekleşir." />
      </Head>
      <GlobalSeo />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          header: () => <AppHeader />,
          headerShadowVisible: false
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false, presentation: "modal", title: t("emailSignIn") }} />
        <Stack.Screen name="legal" options={{ presentation: "modal", title: t("legalSupport") }} />
        <Stack.Screen name="trust" options={{ presentation: "modal", title: t("trustCenter") }} />
        <Stack.Screen name="create" options={{ presentation: "modal", title: t("createListingTitle") }} />
        <Stack.Screen name="profile-edit" options={{ presentation: "modal", title: t("editProfile") }} />
        <Stack.Screen name="notifications" options={{ title: t("notifications") }} />
        <Stack.Screen name="favorites" options={{ title: t("favorites") }} />
        {/* Sohbet: pazaryeri başlığı (logo+arama) yerine sohbete özel kompakt
            başlık kullanılır (ekran kendi başlığını çizer) — dikey alan israfı yok. */}
        <Stack.Screen name="chat/[id]" options={{ headerShown: false, title: t("chat") }} />
        <Stack.Screen name="store/[id]" options={{ headerLargeTitle: false, title: t("sellerStore") }} />
        <Stack.Screen name="listing-edit/[id]" options={{ presentation: "modal", title: t("editListing") }} />
        <Stack.Screen name="listing/[id]" options={{ headerLargeTitle: false, title: t("listingDetail") }} />
      </Stack>
      <CompareBar />
      <PresenceHeartbeat />
      <SyncErrorListener />
    </View>
  );
}

// Kritik akış yazımı canlıda başarısız olduğunda kullanıcıya görünür hata gösterir
// (rollback store'da yapılır). Demo/mock modda syncError hiç dolmaz.
function SyncErrorListener() {
  const { syncError, clearSyncError } = useStore();
  useEffect(() => {
    if (!syncError) return;
    Alert.alert("Kaydedilemedi", syncError);
    clearSyncError();
  }, [syncError, clearSyncError]);
  return null;
}
