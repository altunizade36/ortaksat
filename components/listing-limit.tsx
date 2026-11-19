import { MaterialCommunityIcons } from "@/components/icons";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { PressLink } from "@/components/ui";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from "@/lib/contact";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { fetchMyListingQuota, type ListingQuota } from "@/lib/live-service";
import { useStore } from "@/lib/use-store";

/**
 * Ücretsiz ilan hakkı (sunucu kuralı: 20261119090000_listing_active_limit.sql).
 * Varsayılan SINIRSIZ; sınır yalnız yöneticinin tanımladığı hesaplara (aynı ilanı tekrar tekrar verenler) uygulanır:
 * en fazla N açık ilan (yayında / incelemede / durdurulmuş / taslak) + aynı kategoride tek ilan.
 * Satıldı, süresi dolan, reddedilen ve kaldırılan ilanlar hak kullanmaz.
 * Sınır sunucuda zorlanır; buradaki ekranlar yalnız kullanıcıya önceden ve açıkça söyler.
 */
export function useListingQuota(): { quota: ListingQuota | null; loading: boolean; refresh: () => void } {
  const { isAuthenticated, currentUser, listings } = useStore();
  const [quota, setQuota] = useState<ListingQuota | null>(null);
  const [loading, setLoading] = useState(isAuthenticated);
  const [tick, setTick] = useState(0);
  // Kendi ilan sayısı değişince (sil/sat/yayınla) yeniden sor.
  const ownCount = listings.filter((l) => l.ownerId === currentUser?.id).length;
  useEffect(() => {
    if (!isAuthenticated) { setQuota(null); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    void fetchMyListingQuota()
      .then((q) => { if (alive) setQuota(q); })
      .catch(() => { /* Ağ hatasında kapı açılmaz; sunucu yine de zorlar. */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isAuthenticated, currentUser?.id, ownCount, tick]);
  return { quota, loading, refresh: () => setTick((t) => t + 1) };
}

/** İlan ver sayfası: hak dolduysa formu açmadan önce gösterilir (emeği boşa gitmesin). */
export function ListingLimitGate({ quota }: { quota: ListingQuota }) {
  const { language } = useLanguage();
  const t = (s: string) => translateCopy(s, language);
  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", backgroundColor: colors.background, flexGrow: 1, justifyContent: "center", padding: 24 }} style={{ backgroundColor: colors.background }}>
      <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, gap: 14, maxWidth: 460, padding: 28, width: "100%" }}>
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 64, justifyContent: "center", width: 64 }}>
          <MaterialCommunityIcons name="playlist-remove" size={32} color={colors.primaryDark} />
        </View>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900", textAlign: "center" }}>{t("İlan sınırına ulaştınız")}</Text>
        <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{quota.used} / {quota.limit} {t("ilan")}</Text>
        <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, textAlign: "center" }}>
          {t("Hesabınız aynı anda en fazla")} {quota.limit} {t("açık ilan tutabilir ve her kategoride yalnız bir ilan verebilir. Yeni ilan vermek için yayındaki ilanlarınızdan birini kaldırın ya da Satıldı olarak işaretleyin. Aynı ilanı tekrar vermek yerine mevcut ilanınızı düzenleyebilirsiniz.")}
        </Text>
        <View style={{ alignSelf: "stretch", backgroundColor: colors.background, borderRadius: 12, gap: 6, padding: 12 }}>
          <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{t("Hak kullanan ilanlar")}</Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{t("Yayında, incelemede, durdurulmuş ve taslak ilanlar. Satıldı, süresi dolan ve kaldırılan ilanlar sayılmaz.")}</Text>
        </View>
        <PressLink href={"/(tabs)/seller" as never} style={{ alignItems: "center", alignSelf: "stretch", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 13 }}>
          <MaterialCommunityIcons name="format-list-bulleted" size={18} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{t("İlanlarımı yönet")}</Text>
        </PressLink>
        <PressLink href={"/kurumsal" as never} style={{ alignItems: "center", alignSelf: "stretch", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 12 }}>
          <MaterialCommunityIcons name="domain" size={18} color={colors.primaryDark} />
          <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>{t("Firmayım, daha fazla ilan gerekiyor")}</Text>
        </PressLink>
        <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(SUPPORT_EMAIL_MAILTO + "?subject=" + encodeURIComponent("Ek ilan hakkı talebi")); }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", textAlign: "center" }}>{t("Ek ilan hakkı için:")} {SUPPORT_EMAIL}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/** İlanlarım / satıcı paneli: "7 / 10 ilan hakkı" çubuğu. Sınırsız hesapta gizlenir. */
export function ListingQuotaBar({ quota }: { quota: ListingQuota | null }) {
  const { language } = useLanguage();
  const t = (s: string) => translateCopy(s, language);
  if (!quota || quota.limit == null || quota.limit <= 0) return null;
  const full = quota.used >= quota.limit;
  const ratio = Math.min(1, quota.used / quota.limit);
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: full ? colors.primary : colors.line, borderRadius: 12, borderWidth: 1, gap: 8, padding: 12 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
        <Text style={{ color: colors.ink, flexShrink: 1, fontSize: 13, fontWeight: "800" }}>{t("İlan hakkı")}</Text>
        <Text style={{ color: full ? colors.primaryDark : colors.ink, fontSize: 13, fontWeight: "900" }}>{quota.used} / {quota.limit}</Text>
      </View>
      <View style={{ backgroundColor: colors.background, borderRadius: 999, height: 6, overflow: "hidden" }}>
        <View style={{ backgroundColor: colors.primary, height: 6, width: `${Math.round(ratio * 100)}%` }} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>
        {full
          ? t("İlan sınırına ulaştınız. Yeni ilan için bir ilanınızı kaldırın ya da Satıldı olarak işaretleyin.")
          : `${quota.remaining ?? 0} ${t("ilan hakkınız kaldı. Her kategoride yalnız bir ilan verebilirsiniz.")}`}
      </Text>
    </View>
  );
}
