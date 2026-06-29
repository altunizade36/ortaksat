import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { Card, EmptyState, Metric, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { calculateUserTrustScores, type RoleTrustScore } from "@/lib/trust-score";
import type { ModerationStatus, Report } from "@/lib/types";
import { useStore } from "@/lib/use-store";

const statusLabels: Record<ModerationStatus, string> = {
  open: "Açık",
  reviewing: "İncelemede",
  resolved: "Çözüldü",
  rejected: "Reddedildi"
};

type TrustFilter = "all" | "open" | "resolved";

export default function TrustScreen() {
  const { language } = useLanguage();
  const { currentUser, findListing, leads, listings, partnerships, reports, reviews, sales, updateReportStatus } = useStore();
  const [filter, setFilter] = useState<TrustFilter>("all");
  const isAdmin = currentUser.role === "admin" || currentUser.role === "moderator";
  const trust = calculateUserTrustScores({ leads, listings, partnerships, reports, reviews, sales, user: currentUser });
  const ownReports = isAdmin ? reports : reports.filter((report) => report.reporterId === currentUser.id || report.reportedUserId === currentUser.id);
  const visibleReports = ownReports.filter((report) => {
    if (filter === "open") return report.status === "open" || report.status === "reviewing";
    if (filter === "resolved") return report.status === "resolved" || report.status === "rejected";
    return true;
  });
  const openReports = ownReports.filter((report) => report.status === "open" || report.status === "reviewing");

  async function setStatus(report: Report, status: ModerationStatus) {
    const ok = await updateReportStatus(report.id, status);
    Alert.alert(translateCopy(ok ? "Güncellendi" : "Yetki gerekli", language), translateCopy(ok ? "Moderasyon kaydı güncellendi." : "Bu işlem için moderatör yetkisi gerekir.", language));
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, maxWidth: 920, marginHorizontal: "auto", padding: 12, paddingBottom: 96, width: "100%" }}>
      <Card>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 54, justifyContent: "center", width: 54 }}>
            <MaterialCommunityIcons name="shield-check" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: "900", lineHeight: 27 }}>
              {translateCopy("Güven merkezi", language)}
            </Text>
            <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
              {translateCopy("Satıcı ve ortak güveni ayrı hesaplanır. Komisyon, talep kalitesi, şikayet ve doğrulamalar burada takip edilir.", language)}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Metric label="Genel güven" value={`%${trust.overall}`} />
          <Metric label="Açık kayıt" value={`${openReports.length}`} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <StatusPill label={currentUser.verifiedPhone ? "Telefon doğrulandı" : "Telefon bekliyor"} tone={currentUser.verifiedPhone ? "success" : "warning"} />
          <StatusPill label={currentUser.verifiedIdentity ? "Kimlik doğrulandı" : "Kimlik bekliyor"} tone={currentUser.verifiedIdentity ? "success" : "info"} />
          <StatusPill label={currentUser.verifiedInstagram ? "Instagram doğrulandı" : "Instagram bekliyor"} tone={currentUser.verifiedInstagram ? "success" : "info"} />
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <TrustRoleCard description="Komisyon ödüyor mu, ürün doğru mu, müşteri memnun mu?" icon="store-check" title="Satıcı güveni" score={trust.seller} />
        </View>
        <View style={{ flex: 1 }}>
          <TrustRoleCard description="Gerçek müşteri getiriyor mu, spam yapıyor mu, ürünü doğru temsil ediyor mu?" icon="account-check" title="Ortak güveni" score={trust.partner} />
        </View>
      </View>

      <Card>
        <SectionTitle title="Puan mantığı" />
        <Rule icon="cellphone-check" text="Telefon doğrulama +10, kimlik doğrulama +20, Instagram doğrulama +10 puan etkisi verir." />
        <Rule icon="cash-check" text="Başarılı satış ve zamanında komisyon ödeme satıcı güvenini artırır." />
        <Rule icon="account-convert" text="Gerçek müşteri getiren, satışa dönen talep oluşturan ortakların ortak güveni yükselir." />
        <Rule icon="clock-alert-outline" text="Geç ödeme, anlaşmazlık, yüksek iade, düşük talep kalitesi ve şikayet puanı düşürür." />
        <Rule icon="message-reply-text" text="Yanıt oranı hem satıcı hem ortak tarafında güven sinyali olarak kullanılır." />
      </Card>

      <SectionTitle title={isAdmin ? "Moderasyon kuyruğu" : "Güven kayıtlarım"} action={`${visibleReports.length}`} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TrustFilterChip active={filter === "all"} label="Tümü" onPress={() => setFilter("all")} />
        <TrustFilterChip active={filter === "open"} label="Açık" onPress={() => setFilter("open")} />
        <TrustFilterChip active={filter === "resolved"} label="Kapanan" onPress={() => setFilter("resolved")} />
      </View>

      {visibleReports.length === 0 ? <EmptyState title="Kayıt yok" body="Bu filtrede bildirilen ilan, kullanıcı veya güven incelemesi bulunmuyor." /> : null}

      {visibleReports.map((report) => {
        const listing = report.listingId ? findListing(report.listingId) : undefined;
        return (
          <Card key={report.id}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text selectable style={{ color: colors.ink, fontSize: 16, fontWeight: "900", lineHeight: 21 }}>
                  {listing?.title ?? translateCopy("İlan / kullanıcı bildirimi", language)}
                </Text>
                <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                  {report.reason} · {report.details || "Detay yok"}
                </Text>
                <Text selectable style={{ color: colors.muted, fontSize: 12 }}>
                  {report.createdAt}
                </Text>
              </View>
              <StatusPill label={statusLabels[report.status]} tone={report.status === "resolved" ? "success" : report.status === "rejected" ? "warning" : "info"} />
            </View>

            {isAdmin ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <View style={{ flexBasis: "31%", flexGrow: 1 }}>
                  <PrimaryButton tone="secondary" onPress={() => void setStatus(report, "reviewing")}>İncele</PrimaryButton>
                </View>
                <View style={{ flexBasis: "31%", flexGrow: 1 }}>
                  <PrimaryButton tone="soft" onPress={() => void setStatus(report, "resolved")}>Çöz</PrimaryButton>
                </View>
                <View style={{ flexBasis: "31%", flexGrow: 1 }}>
                  <PrimaryButton tone="secondary" onPress={() => void setStatus(report, "rejected")}>Reddet</PrimaryButton>
                </View>
              </View>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

function TrustRoleCard({
  description,
  icon,
  score,
  title
}: {
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  score: RoleTrustScore;
  title: string;
}) {
  const { language } = useLanguage();
  const width = `${score.score}%` as const;

  return (
    <Card>
      <View style={{ gap: 8 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
          <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" }}>
            {translateCopy(title, language)}
          </Text>
        </View>
        <Text selectable style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
          {translateCopy(description, language)}
        </Text>
        <Text selectable style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>
          %{score.score}
        </Text>
        <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 8, overflow: "hidden" }}>
          <View style={{ backgroundColor: score.score >= 70 ? colors.primary : colors.warning, borderRadius: 999, height: 8, width }} />
        </View>
        <StatusPill label={score.label} tone={score.score >= 70 ? "success" : "warning"} />
        {score.breakdown.slice(0, 4).map((item) => (
          <View key={`${title}-${item.label}`} style={{ flexDirection: "row", gap: 6 }}>
            <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "700" }}>
              {translateCopy(item.label, language)}
            </Text>
            <Text style={{ color: item.value > 0 ? colors.primary : item.value < 0 ? colors.accent : colors.muted, fontSize: 11, fontWeight: "900" }}>
              {item.value > 0 ? `+${item.value}` : item.value}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function TrustFilterChip({ active, label, onPress }: { active?: boolean; label: string; onPress: () => void }) {
  const { language } = useLanguage();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? colors.ink : colors.surface,
        borderColor: active ? colors.ink : colors.line,
        borderRadius: 999,
        borderWidth: 1,
        flex: 1,
        justifyContent: "center",
        minHeight: 40,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 10
      })}
    >
      <Text adjustsFontSizeToFit minimumFontScale={0.84} numberOfLines={1} style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "900" }}>
        {translateCopy(label, language)}
      </Text>
    </Pressable>
  );
}

function Rule({ icon, text }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <MaterialCommunityIcons name={icon} size={19} color={colors.primary} />
      <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 14, lineHeight: 20 }}>
        {translateCopy(text, language)}
      </Text>
    </View>
  );
}
