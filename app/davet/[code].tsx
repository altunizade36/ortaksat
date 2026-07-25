import { MaterialCommunityIcons } from "@/components/icons";
import { useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { Mascot } from "@/components/brand/Mascot";
import { PressLink } from "@/components/ui";
import { captureInvite } from "@/lib/live-service";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/use-store";

// Y8: Davet karşılama sayfası. /davet/<kod> → kodu sakla; girişliyse anında yakala,
// değilse "bir arkadaşın seni davet etti" + Kayıt Ol/Giriş Yap CTA. Kod, giriş sonrası
// InviteCapture (her zaman mount) tarafından da yakalanır → tüm auth yollarını kapsar.
export default function InviteLanding() {
  const params = useLocalSearchParams<{ code?: string }>();
  const code = String(params.code ?? "").trim();
  const { currentUser } = useStore();
  const { language } = useLanguage();
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    if (!code) return;
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem("ortaksat_inv", code);
    } catch {
      /* erişilemez */
    }
    if (currentUser?.id) {
      void captureInvite(code).then((ok) => setCaptured(ok || true)).finally(() => {
        try {
          if (typeof localStorage !== "undefined") localStorage.removeItem("ortaksat_inv");
        } catch {
          /* yok */
        }
      });
    }
  }, [code, currentUser?.id]);

  const t = (tr: string) => translateCopy(tr, language);

  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", padding: 20 }}>
      <Head>
        <title>{t("Bir arkadaşın seni OrtakSat'a davet etti")}</title>
        <meta name="robots" content="noindex, follow" />
      </Head>
      <View style={{ alignItems: "center", gap: 16, maxWidth: 460, width: "100%" }}>
        <Mascot name="success" size={120} />
        <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900", textAlign: "center" }}>
          {t("Bir arkadaşın seni OrtakSat'a davet etti 🎉")}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 21, textAlign: "center" }}>
          {t("OrtakSat'ta ilanını ücretsiz aç ya da beğendiğin ürünlere ortak ol; sattığında komisyon kazan. Aracı platform; para tutmaz, ödeme ve teslimat taraflar arasındadır.")}
        </Text>

        {currentUser?.id ? (
          <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 12, flexDirection: "row", gap: 8, padding: 14, width: "100%" }}>
            <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
            <Text style={{ color: colors.success, flex: 1, fontSize: 13.5, fontWeight: "800" }}>
              {captured ? t("Davet kabul edildi. Hoş geldin!") : t("Zaten giriş yaptın. Keşfetmeye başlayabilirsin.")}
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.subtle, fontSize: 12.5, fontWeight: "700", textAlign: "center" }}>
            {t("Kaydolduğunda daveti otomatik olarak eşleştireceğiz.")}
          </Text>
        )}

        <View style={{ gap: 10, width: "100%" }}>
          {currentUser?.id ? (
            <PressLink href="/(tabs)/explore" accessibilityRole="button" accessibilityLabel={t("İlanları Keşfet")} pressedOpacity={0.9} style={{ alignItems: "center", backgroundColor: colors.primaryDark, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 14 }}>
              <MaterialCommunityIcons name="compass-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{t("İlanları Keşfet")}</Text>
            </PressLink>
          ) : (
            <>
              <PressLink href="/auth" accessibilityRole="button" accessibilityLabel={t("Ücretsiz Kayıt Ol")} pressedOpacity={0.9} style={{ alignItems: "center", backgroundColor: colors.primaryDark, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 14 }}>
                <MaterialCommunityIcons name="account-plus-outline" size={18} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{t("Ücretsiz Kayıt Ol")}</Text>
              </PressLink>
              <PressLink href="/(tabs)/explore" accessibilityRole="button" accessibilityLabel={t("Önce göz at")} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 12, borderWidth: 1, paddingVertical: 13 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>{t("Önce göz at")}</Text>
              </PressLink>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
