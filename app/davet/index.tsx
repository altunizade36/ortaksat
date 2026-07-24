import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { ShareRow } from "@/components/share-row";
import { loadMyInvites, type MyInvite } from "@/lib/live-service";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { shortDate } from "@/lib/locale";
import { useStore } from "@/lib/use-store";

const SITE = "https://www.ortaksat.com";

// Y8: "Arkadaşını Davet Et" merkezi. Platform PARA TUTMAZ → sahte ödeme YOK; dürüst değer:
// davet edilen kişi platforma katıldıkça ağ büyür (o senin ürünlerine ortak olabilir ya da
// sen onun ilanına ortak olup komisyon kazanabilirsin).
export default function DavetEt() {
  const { currentUser } = useStore();
  const { language } = useLanguage();
  const t = (tr: string) => translateCopy(tr, language);
  const [invites, setInvites] = useState<MyInvite[] | null>(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    let alive = true;
    void loadMyInvites().then((rows) => { if (alive) setInvites(rows); });
    return () => { alive = false; };
  }, [currentUser?.id]);

  const inviteUrl = currentUser?.inviteCode ? `${SITE}/davet/${currentUser.inviteCode}` : "";

  if (!currentUser?.id) {
    return (
      <ScrollView contentContainerStyle={{ alignItems: "center", padding: 20 }}>
        <View style={{ alignItems: "center", gap: 14, maxWidth: 440, width: "100%" }}>
          <MaterialCommunityIcons name="account-heart-outline" size={44} color={colors.primary} />
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900", textAlign: "center" }}>{t("Arkadaşını davet et")}</Text>
          <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, textAlign: "center" }}>{t("Davet linkini almak için giriş yapman gerekiyor.")}</Text>
          <Link href="/auth" asChild>
            <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primaryDark, borderRadius: 12, opacity: pressed ? 0.9 : 1, paddingHorizontal: 24, paddingVertical: 13 })}>
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{t("Giriş Yap / Kayıt Ol")}</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    );
  }

  const activeCount = (invites ?? []).filter((i) => i.hasListing || i.isPartner).length;

  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", padding: 16, paddingBottom: 40 }}>
      <Head><title>{t("Arkadaşını Davet Et")} | OrtakSat</title></Head>
      <View style={{ gap: 16, maxWidth: 620, width: "100%" }}>
        {/* Başlık */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>{t("Arkadaşını Davet Et")}</Text>
          <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>
            {t("Davet ettiğin kişiler platforma katıldıkça ağın büyür: onlar ürünlerine ortak olabilir ya da sen onların ilanına ortak olup komisyon kazanabilirsin. OrtakSat aracıdır; para tutmaz.")}
          </Text>
        </View>

        {/* Davet linki + paylaşım */}
        <View style={{ backgroundColor: colors.primarySoft, borderRadius: 14, gap: 10, padding: 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name="link-variant" size={18} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 13, fontWeight: "900", letterSpacing: 0.3 }}>{t("KİŞİSEL DAVET LİNKİN")}</Text>
          </View>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{inviteUrl}</Text>
          </View>
          <ShareRow url={inviteUrl} text={t("OrtakSat'a katıl: ilanını ücretsiz aç ya da ortak ol, satışta komisyon kazan.")} />
        </View>

        {/* Nasıl işler */}
        <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 10, padding: 16 }}>
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{t("Nasıl işler?")}</Text>
          {[
            { icon: "share-variant-outline" as const, txt: t("Davet linkini paylaş (WhatsApp, Instagram, herhangi bir yer).") },
            { icon: "account-plus-outline" as const, txt: t("Arkadaşın linkten kaydolur; davet otomatik eşleşir.") },
            { icon: "handshake-outline" as const, txt: t("O ürünlerine ortak olur ya da sen onun ilanına ortak olursun — kazanç ortaklıktan gelir.") }
          ].map((s, i) => (
            <View key={i} style={{ alignItems: "flex-start", flexDirection: "row", gap: 9 }}>
              <MaterialCommunityIcons name={s.icon} size={17} color={colors.primaryDark} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "700", lineHeight: 18 }}>{s.txt}</Text>
            </View>
          ))}
        </View>

        {/* Davet ettiklerim */}
        <View style={{ gap: 10 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{t("Davet Ettiklerim")}</Text>
            {invites ? (
              <View style={{ backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 11.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{invites.length}</Text>
              </View>
            ) : null}
            {activeCount > 0 ? (
              <Text style={{ color: colors.success, fontSize: 12, fontWeight: "800" }}>· {activeCount} {t("aktif")}</Text>
            ) : null}
          </View>

          {invites === null ? (
            <Text style={{ color: colors.subtle, fontSize: 12.5, fontWeight: "700" }}>{t("Yükleniyor…")}</Text>
          ) : invites.length === 0 ? (
            <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 6, padding: 24 }}>
              <MaterialCommunityIcons name="account-multiple-plus-outline" size={30} color={colors.subtle} />
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700", textAlign: "center" }}>{t("Henüz kimseyi davet etmedin. Linkini paylaşarak başla!")}</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, overflow: "hidden" }}>
              {invites.map((inv, i) => (
                <View key={inv.id} style={{ alignItems: "center", backgroundColor: i % 2 === 1 ? colors.surfaceAlt : "transparent", flexDirection: "row", gap: 10, paddingHorizontal: 13, paddingVertical: 11 }}>
                  <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 34, justifyContent: "center", width: 34 }}>
                    <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{(inv.fullName || "?").slice(0, 1).toLocaleUpperCase("tr-TR")}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{inv.fullName}</Text>
                    <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>{t("Katıldı")}: {shortDate(inv.joinedAt)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    {inv.hasListing ? <Badge icon="tag-outline" label={t("İlan verdi")} tone="success" /> : null}
                    {inv.isPartner ? <Badge icon="handshake-outline" label={t("Ortak oldu")} tone="primary" /> : null}
                    {!inv.hasListing && !inv.isPartner ? <Badge icon="account-outline" label={t("Kayıt oldu")} tone="muted" /> : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function Badge({ icon, label, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; tone: "success" | "primary" | "muted" }) {
  const c = tone === "success" ? colors.success : tone === "primary" ? colors.primaryDark : colors.subtle;
  const bg = tone === "success" ? colors.successSoft : tone === "primary" ? colors.primarySoft : colors.surfaceAlt;
  return (
    <View style={{ alignItems: "center", backgroundColor: bg, borderRadius: 999, flexDirection: "row", gap: 3, paddingHorizontal: 7, paddingVertical: 2 }}>
      <MaterialCommunityIcons name={icon} size={11} color={c} />
      <Text style={{ color: c, fontSize: 10.5, fontWeight: "900" }}>{label}</Text>
    </View>
  );
}
