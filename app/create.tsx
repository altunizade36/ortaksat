import Head from "expo-router/head";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { AuthRequired } from "@/components/auth-gate";
import { colors } from "@/components/colors";
import { DesktopCreateFlow } from "@/components/desktop-create-flow";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { useStore } from "@/lib/use-store";

/**
 * İlan oluşturma — Sahibinden tarzı çok seviyeli kategori seçimi + kategoriye
 * göre değişen dinamik form + merkezi konum seçici. Masaüstü ve mobil (dar web /
 * native) aynı akışı kullanır; yerleşim responsive olarak sarılır.
 */
export default function CreateListingScreen() {
  const { language } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const { isAuthenticated, platformSettings, emailVerified, isSuspended } = useStore();
  if (!isAuthenticated) return <AuthRequired title={translateCopy("İlan vermek için giriş yapın", language)} body={translateCopy("Ücretsiz hesap aç, ürününü yüzlerce ortağa ulaştır. Gezmeye giriş gerekmez; ilan vermek için gerekir.", language)} icon="store-plus-outline" />;
  if (isSuspended) return <AuthRequired title={translateCopy("Hesabın askıya alındı", language)} body={translateCopy("Hesabın askıda olduğu için ilan veremezsin. İşlem yapabilmek için Yasal & Destek üzerinden bizimle iletişime geçebilirsin.", language)} icon="account-cancel-outline" />;
  // Admin "e-posta doğrulama zorunlu" açıksa, doğrulanmamış hesap ilan veremez.
  if (platformSettings.requireEmailVerification && !emailVerified) {
    return <AuthRequired title={translateCopy("E-posta doğrulaması gerekli", language)} body={translateCopy("İlan verebilmek için e-posta adresini doğrulaman gerekiyor. Kayıt sırasında gönderilen doğrulama bağlantısına tıkla, ardından tekrar giriş yap.", language)} icon="email-alert-outline" />;
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Head>
        <title>Ücretsiz İlan Ver — Ürününü ortak satışa aç | OrtakSat</title>
        <meta name="description" content="Ürününü ücretsiz listele, komisyonunu belirle; ortaklar senin için satsın. Kategoriye özel form, kolay adımlar. OrtakSat'ta ilan vermek ücretsiz." />
        <link rel="canonical" href="https://www.ortaksat.com/create" />
        <meta property="og:title" content="Ücretsiz İlan Ver | OrtakSat" />
        <meta property="og:description" content="Ürününü ücretsiz listele, komisyonunu belirle; ortaklar senin için satsın." />
      </Head>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 48, paddingHorizontal: isWideWeb ? 20 : 12, paddingTop: 16 }}
      >
        <View style={{ alignSelf: "center", maxWidth: 1280, width: "100%" }}>
          <DesktopCreateFlow />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
