import Head from "expo-router/head";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Alert, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

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

  return (
    <View style={{ flex: 1 }}>
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
