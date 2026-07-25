import { MaterialCommunityIcons } from "@/components/icons";
import { Link, router, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { tierFromCount } from "@/components/partner-tier";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { Seo } from "@/components/seo";
import { Chip, EmptyState, LoadingBlock, PrimaryButton, SegButton, StatChip } from "@/components/ui";
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

        {/* Çapraz link: aradığını bulamazsan ilansız ortak talebi aç. */}
        <Link href={"/ortak-araniyor" as Href} asChild>
          <Pressable style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, flexDirection: "row", gap: 8, marginBottom: 12, padding: 11 }}>
            <MaterialCommunityIcons name="bullhorn-variant" size={16} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{t("Aradığın ortağı bulamadın mı? İlansız \"Ortak Aranıyor\" talebi aç →")}</Text>
          </Pressable>
        </Link>

        {/* Mod + sıralama satırı */}
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <SegButton active={!mine} icon="account-group" label="Tüm ortaklar" onPress={() => setMine(false)} />
          {isAuthenticated ? <SegButton active={mine} icon="heart" label="Favori Ortaklarım" onPress={() => setMine(true)} /> : null}
          {!mine ? (
            <View style={{ flexDirection: "row", gap: 6, marginLeft: "auto" }}>
              <SegButton small active={sort === "performance"} icon="trophy-variant" label="En başarılı" onPress={() => setSort("performance")} />
              <SegButton small active={sort === "favorites"} icon="heart-multiple" label="En çok favori" onPress={() => setSort("favorites")} />
            </View>
          ) : null}
        </View>

        {/* Kategori çipleri (yalnız tüm-ortaklar modunda) */}
        {!mine ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 2 }} style={{ marginBottom: 14 }}>
            <Chip tone="primary" active={category === null} label="Tümü" onPress={() => setCategory(null)} />
            {TOP_CATEGORIES.map((c) => (
              <Chip key={c} tone="primary" active={category === c} label={c} onPress={() => setCategory(category === c ? null : c)} />
            ))}
          </ScrollView>
        ) : null}

        {/* Liste */}
        {loading ? (
          <LoadingBlock label="Ortaklar yükleniyor…" />
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
            <StatChip icon="check-circle" label={`${entry.confirmedSales} ${t("satış")}`} />
            {entry.completedPartnerships > 0 ? <StatChip icon="handshake" label={`${entry.completedPartnerships} ${t("ortaklık")}`} /> : null}
            {entry.paidEarned > 0 ? <StatChip icon="cash" label={moneyIn(entry.paidEarned, "TRY")} tone="success" /> : null}
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

