import { MaterialCommunityIcons } from "@/components/icons";
import { Link, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { tierFromCount } from "@/components/partner-tier";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { Seo } from "@/components/seo";
import { EmptyState, PrimaryButton } from "@/components/ui";
import { PAGE_MAX_WIDTH } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { categoryTree } from "@/lib/category-tree";
import { moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { responsiveGrid, useIsWideWeb, useMounted } from "@/lib/layout";
import { loadMyFavoritePartnerIds, loadMyFavoritePartners, loadPartnerDirectory, togglePartnerFavorite, type PartnerDirectoryEntry } from "@/lib/supabase-data";
import { useStore } from "@/lib/use-store";

// Uzmanlık kategorileri = ürün taksonomisinin üst düğümleri ("Diğer" hariç) — profil-düzenle
// ExpertisePicker ile AYNI küme (dizin filtresi ↔ ortağın beyanı tutarlı).
const TOP_CATEGORIES: string[] = categoryTree.map((n) => n.label).filter((l) => l && l !== "Diğer");

export default function PartnerDirectoryScreen() {
  return useMounted() ? <Inner /> : <ScreenSkeleton />;
}

function Inner() {
  const { language } = useLanguage();
  const t = (s: string) => translateCopy(s, language);
  const { width } = useWindowDimensions();
  const isWideWeb = useIsWideWeb();
  const { currentUser, isAuthenticated } = useStore();

  const [entries, setEntries] = useState<PartnerDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<"performance" | "favorites">("performance");
  const [mine, setMine] = useState(false); // "Favori Ortaklarım" modu
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    const p = mine ? loadMyFavoritePartners() : loadPartnerDirectory({ category, sort });
    p.then(setEntries).catch(() => setEntries([])).finally(() => setLoading(false));
  }, [mine, category, sort]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isAuthenticated) { setFavIds(new Set()); return; }
    let alive = true;
    loadMyFavoritePartnerIds().then((ids) => { if (alive) setFavIds(ids); }).catch(() => {});
    return () => { alive = false; };
  }, [isAuthenticated]);

  const toggleFav = async (partnerId: string) => {
    if (!isAuthenticated) { void router.push("/auth"); return; }
    const on = !favIds.has(partnerId);
    setFavIds((prev) => { const n = new Set(prev); if (on) n.add(partnerId); else n.delete(partnerId); return n; });
    setEntries((prev) => prev.map((e) => e.partnerId === partnerId ? { ...e, favoriteCount: Math.max(0, e.favoriteCount + (on ? 1 : -1)) } : e));
    const ok = await togglePartnerFavorite(partnerId, on);
    if (!ok) { // geri al
      setFavIds((prev) => { const n = new Set(prev); if (on) n.delete(partnerId); else n.add(partnerId); return n; });
      setEntries((prev) => prev.map((e) => e.partnerId === partnerId ? { ...e, favoriteCount: Math.max(0, e.favoriteCount + (on ? -1 : 1)) } : e));
    } else if (mine && !on) {
      setEntries((prev) => prev.filter((e) => e.partnerId !== partnerId)); // favorilerden çıkınca listeden düş
    }
  };

  const pad = 12;
  const inner = Math.min(width, PAGE_MAX_WIDTH) - pad * 2;
  const gap = 10;
  const cardWidth = responsiveGrid({ available: inner, gap, minCardWidth: isWideWeb ? 240 : 168, minColumns: isWideWeb ? 3 : 2 }).cardWidth;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
      <Seo
        title={t("Uzman Ortaklar — kategoriye göre deneyimli ortak bul | OrtakSat")}
        description={t("OrtakSat uzman ortak dizini: ürününü hangi kategoride satacak deneyimli ortağı bul, performansına ve uzmanlığına göre seç, favorine ekle.")}
        path="/ortaklar"
      />
      <View style={{ alignSelf: "center", maxWidth: PAGE_MAX_WIDTH, paddingHorizontal: pad, paddingTop: 14, width: "100%" }}>
        {/* Başlık */}
        <View style={{ gap: 6, marginBottom: 14 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name="account-star" size={22} color={colors.primary} />
            <Text style={{ color: colors.ink, fontSize: isWideWeb ? 24 : 20, fontWeight: "900" }}>{t("Uzman Ortaklar")}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>
            {t("Ürününü hangi kategoride satacak deneyimli bir ortak mı arıyorsun? Uzmanlığına ve satış performansına göre ortak bul, favorine ekle.")}
          </Text>
        </View>

        {/* Mod + sıralama satırı */}
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <SegBtn active={!mine} icon="account-group" label={t("Tüm ortaklar")} onPress={() => setMine(false)} />
          {isAuthenticated ? <SegBtn active={mine} icon="heart" label={t("Favori Ortaklarım")} onPress={() => setMine(true)} /> : null}
          {!mine ? (
            <View style={{ flexDirection: "row", gap: 6, marginLeft: "auto" }}>
              <SegBtn small active={sort === "performance"} icon="trophy-variant" label={t("En başarılı")} onPress={() => setSort("performance")} />
              <SegBtn small active={sort === "favorites"} icon="heart-multiple" label={t("En çok favori")} onPress={() => setSort("favorites")} />
            </View>
          ) : null}
        </View>

        {/* Kategori çipleri (yalnız tüm-ortaklar modunda) */}
        {!mine ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 2 }} style={{ marginBottom: 14 }}>
            <Chip active={category === null} label={t("Tümü")} onPress={() => setCategory(null)} />
            {TOP_CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} label={t(c)} onPress={() => setCategory(category === c ? null : c)} />
            ))}
          </ScrollView>
        ) : null}

        {/* Liste */}
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 44 }}>
            <MaterialCommunityIcons name="loading" size={28} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 8 }}>{t("Ortaklar yükleniyor…")}</Text>
          </View>
        ) : entries.length === 0 ? (
          mine ? (
            <EmptyState
              title={t("Henüz favori ortağın yok")}
              body={t("Bir ortağın vitrinine gidip kalbe dokun; buradan hızlıca ulaşırsın. Ürününü satacak deneyimli ortakları keşfetmeye başla.")}
            />
          ) : (
            <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 24 }}>
              <MaterialCommunityIcons name="account-star-outline" size={40} color={colors.primary} />
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900", textAlign: "center" }}>
                {category ? `${t(category)} ${t("kategorisinde henüz uzman ortak yok")}` : t("Bu dizinde henüz uzman ortak yok")}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19, maxWidth: 420, textAlign: "center" }}>
                {t("Sen bir ortak mısın? Profilinde uzmanlık kategorilerini seç — satıcılar seni burada bulup ürünlerini sana emanet etsin. İlk uzman ortaklardan biri ol.")}
              </Text>
              <View style={{ maxWidth: 320, width: "100%" }}>
                <PrimaryButton icon="star-plus" href={isAuthenticated ? "/profile-edit" : "/auth"}>{t("Uzmanlığımı belirle")}</PrimaryButton>
              </View>
            </View>
          )
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {entries.map((e) => (
              <PartnerCard key={e.partnerId} entry={e} width={cardWidth} favorited={favIds.has(e.partnerId)} isSelf={currentUser?.id === e.partnerId} onFav={() => void toggleFav(e.partnerId)} />
            ))}
          </View>
        )}
      </View>
      <WebFooter />
    </ScrollView>
  );
}

function SegBtn({ active, icon, label, onPress, small }: { active: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", backgroundColor: active ? colors.primary : colors.surfaceAlt, borderColor: active ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, opacity: pressed ? 0.8 : 1, paddingHorizontal: small ? 10 : 12, paddingVertical: small ? 6 : 8 })}
    >
      <MaterialCommunityIcons name={icon} size={small ? 13 : 15} color={active ? "#FFFFFF" : colors.muted} />
      <Text style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: small ? 11.5 : 12.5, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: active ? colors.primary : colors.surfaceAlt, borderColor: active ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, opacity: pressed ? 0.8 : 1, paddingHorizontal: 12, paddingVertical: 7 })}
    >
      <Text numberOfLines={1} style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function PartnerCard({ entry, width, favorited, isSelf, onFav }: { entry: PartnerDirectoryEntry; width: number; favorited: boolean; isSelf: boolean; onFav: () => void }) {
  const { language } = useLanguage();
  const t = (s: string) => translateCopy(s, language);
  const tier = tierFromCount(entry.confirmedSales);
  const verified = entry.verifiedIdentity || entry.verifiedPhone;
  const initial = (entry.fullName || "?").slice(0, 1).toLocaleUpperCase("tr-TR");
  const chips = entry.expertiseCategories.slice(0, 3);

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden", width }}>
      <Link href={{ pathname: "/ortak/[id]", params: { id: entry.partnerId } }} asChild>
        <Pressable style={{ gap: 10, padding: 14 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 11 }}>
            <View style={{ alignItems: "center", backgroundColor: tier.tint, borderRadius: 999, height: 48, justifyContent: "center", width: 48 }}>
              <Text style={{ color: tier.color, fontSize: 20, fontWeight: "900" }}>{initial}</Text>
            </View>
            <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
                <Text numberOfLines={1} style={{ color: colors.ink, flexShrink: 1, fontSize: 15, fontWeight: "900" }}>{entry.fullName || t("Ortak")}</Text>
                {verified ? <MaterialCommunityIcons name="check-decagram" size={15} color={colors.primary} /> : null}
              </View>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
                <Text style={{ fontSize: 11 }}>{tier.emoji}</Text>
                <Text style={{ color: tier.color, fontSize: 11, fontWeight: "900" }}>{t(tier.label)}</Text>
                {entry.rating ? (
                  <>
                    <MaterialCommunityIcons name="star" size={11} color={colors.gold} />
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{entry.rating.toFixed(1)}</Text>
                  </>
                ) : null}
              </View>
            </View>
          </View>

          {/* Performans satırı: onaylı satış + tamamlanan ortaklık + kazanç */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Stat icon="check-circle" label={`${entry.confirmedSales} ${t("satış")}`} />
            {entry.completedPartnerships > 0 ? <Stat icon="handshake" label={`${entry.completedPartnerships} ${t("ortaklık")}`} /> : null}
            {entry.paidEarned > 0 ? <Stat icon="cash" label={moneyIn(entry.paidEarned, "TRY")} tone="success" /> : null}
          </View>

          {/* Uzmanlık */}
          {chips.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
              {chips.map((c) => (
                <View key={c} style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "800" }}>{t(c)}</Text>
                </View>
              ))}
              {entry.expertiseCategories.length > 3 ? (
                <Text style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "800", paddingVertical: 3 }}>+{entry.expertiseCategories.length - 3}</Text>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </Link>

      {/* Alt aksiyon: vitrini gör + favori kalp */}
      <View style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 8 }}>
        <Link href={{ pathname: "/ortak/[id]", params: { id: entry.partnerId } }} asChild>
          <Pressable accessibilityRole="link" style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{t("Vitrini gör")}</Text>
            <MaterialCommunityIcons name="arrow-right" size={14} color={colors.primaryDark} />
          </Pressable>
        </Link>
        {!isSelf ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: favorited }}
            accessibilityLabel={favorited ? t("Favorilerden çıkar") : t("Favori ortak yap")}
            onPress={onFav}
            hitSlop={8}
            style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 4, opacity: pressed ? 0.6 : 1 })}
          >
            <MaterialCommunityIcons name={favorited ? "heart" : "heart-outline"} size={18} color={favorited ? colors.accent : colors.muted} />
            {entry.favoriteCount > 0 ? <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{entry.favoriteCount}</Text> : null}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Stat({ icon, label, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; tone?: "success" }) {
  const c = tone === "success" ? colors.success : colors.muted;
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 8, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
      <MaterialCommunityIcons name={icon} size={12} color={c} />
      <Text style={{ color: tone === "success" ? colors.success : colors.ink, fontSize: 11, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}
