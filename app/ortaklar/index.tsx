import { MaterialCommunityIcons } from "@/components/icons";
import { Link, router, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { tierFromCount } from "@/components/partner-tier";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { Seo } from "@/components/seo";
import { Chip, EmptyState, LoadingBlock, PrimaryButton, SegButton, StatChip } from "@/components/ui";
import { PAGE_MAX_WIDTH } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { categoryTree } from "@/lib/category-tree";
import { TR_PROVINCES, citySlug } from "@/lib/cities";
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
  const [cityFilter, setCityFilter] = useState<string | null>(null); // bölgesel filtre (il)
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const p = mine ? loadMyFavoritePartners() : loadPartnerDirectory({ category, sort, city: cityFilter });
    p.then(setEntries).catch(() => setEntries([])).finally(() => setLoading(false));
  }, [mine, category, sort, cityFilter]);

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
  const cityQuery = citySearch.trim();
  const filteredProvinces = cityQuery ? TR_PROVINCES.filter((p) => citySlug(p).includes(citySlug(cityQuery))) : TR_PROVINCES;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
      <Seo
        title={t("Uzman Ortaklar — kategoriye göre deneyimli ortak bul | OrtakSat")}
        description={t("OrtakSat uzman ortak dizini: ürününü hangi kategoride satacak deneyimli ortağı bul, performansına ve uzmanlığına göre seç, favorine ekle.")}
        path="/ortaklar"
      />
      <Modal visible={cityOpen} transparent animationType="fade" onRequestClose={() => setCityOpen(false)}>
        <Pressable onPress={() => setCityOpen(false)} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", flex: 1, justifyContent: "center", padding: 20 }}>
          <Pressable onPress={() => undefined} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, gap: 12, maxHeight: 560, maxWidth: 440, padding: 18, width: "100%" }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}>
                <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{t("Şehre göre ortak bul")}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{t("Bölgendeki uzman ortakları öne çıkar")}</Text>
              </View>
              <Pressable onPress={() => setCityOpen(false)} hitSlop={8} accessibilityLabel={t("Kapat")}><MaterialCommunityIcons name="close" size={22} color={colors.muted} /></Pressable>
            </View>
            <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
              <MaterialCommunityIcons name="magnify" size={18} color={colors.muted} />
              <TextInput value={citySearch} onChangeText={setCitySearch} placeholder={t("İl ara…")} placeholderTextColor={colors.muted} style={{ color: colors.ink, flex: 1, fontSize: 14, paddingVertical: 11 }} />
              {citySearch ? <Pressable onPress={() => setCitySearch("")} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={16} color={colors.subtle} /></Pressable> : null}
            </View>
            <ScrollView style={{ maxHeight: 372 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Pressable onPress={() => { setCityFilter(null); setCityOpen(false); setCitySearch(""); }} style={{ alignItems: "center", backgroundColor: !cityFilter ? colors.primarySoft : "transparent", borderRadius: 10, flexDirection: "row", gap: 10, paddingHorizontal: 10, paddingVertical: 12 }}>
                <MaterialCommunityIcons name="earth" size={18} color={!cityFilter ? colors.primaryDark : colors.muted} />
                <Text style={{ color: !cityFilter ? colors.primaryDark : colors.ink, flex: 1, fontSize: 14.5, fontWeight: !cityFilter ? "900" : "600" }}>{t("Tüm şehirler")}</Text>
                {!cityFilter ? <MaterialCommunityIcons name="check" size={18} color={colors.primaryDark} /> : null}
              </Pressable>
              {filteredProvinces.map((p) => {
                const on = p === cityFilter;
                return (
                  <Pressable key={p} onPress={() => { setCityFilter(p); setCityOpen(false); setCitySearch(""); }} style={{ alignItems: "center", backgroundColor: on ? colors.primarySoft : "transparent", borderRadius: 10, flexDirection: "row", gap: 10, paddingHorizontal: 10, paddingVertical: 12 }}>
                    <MaterialCommunityIcons name={on ? "map-marker-check" : "map-marker-outline"} size={18} color={on ? colors.primaryDark : colors.muted} />
                    <Text style={{ color: on ? colors.primaryDark : colors.ink, flex: 1, fontSize: 14.5, fontWeight: on ? "900" : "600" }}>{p}</Text>
                    {on ? <MaterialCommunityIcons name="check" size={18} color={colors.primaryDark} /> : null}
                  </Pressable>
                );
              })}
              {filteredProvinces.length === 0 ? <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", paddingVertical: 16, textAlign: "center" }}>{t("İl bulunamadı")}</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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

        {/* Bölgesel filtre: "Şehrim" hızlı çipi + il seçici → şehir-bazlı ortak sıralaması */}
        {!mine ? (
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={16} color={colors.muted} />
            {currentUser?.city ? (
              <Pressable onPress={() => setCityFilter(cityFilter === currentUser.city ? null : currentUser.city ?? null)} style={{ alignItems: "center", backgroundColor: cityFilter === currentUser.city ? colors.primary : colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 }}>
                <MaterialCommunityIcons name="map-marker-account" size={14} color={cityFilter === currentUser.city ? "#FFFFFF" : colors.primaryDark} />
                <Text style={{ color: cityFilter === currentUser.city ? "#FFFFFF" : colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{t("Şehrim")}: {currentUser.city}</Text>
              </Pressable>
            ) : null}
            {(() => {
              const otherCity = cityFilter && cityFilter !== currentUser?.city;
              return (
                <Pressable onPress={() => { setCitySearch(""); setCityOpen(true); }} style={{ alignItems: "center", backgroundColor: otherCity ? colors.primary : colors.surfaceAlt, borderColor: otherCity ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <MaterialCommunityIcons name="map-marker-outline" size={14} color={otherCity ? "#FFFFFF" : colors.muted} />
                  <Text style={{ color: otherCity ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{cityFilter ?? t("Tüm şehirler")}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={14} color={otherCity ? "#FFFFFF" : colors.muted} />
                </Pressable>
              );
            })()}
            {cityFilter ? (
              <Pressable onPress={() => setCityFilter(null)} hitSlop={6} accessibilityLabel={t("Şehir filtresini temizle")}>
                <MaterialCommunityIcons name="close-circle" size={17} color={colors.subtle} />
              </Pressable>
            ) : null}
          </View>
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
                {cityFilter ? `${cityFilter} ${t("için uzman ortak bulunamadı")}` : category ? `${t(category)} ${t("kategorisinde henüz uzman ortak yok")}` : t("Bu dizinde henüz uzman ortak yok")}
              </Text>
              {cityFilter ? (
                <Pressable onPress={() => setCityFilter(null)} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <MaterialCommunityIcons name="earth" size={15} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{t("Tüm şehirlerde ara")}</Text>
                </Pressable>
              ) : null}
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19, maxWidth: 420, textAlign: "center" }}>
                {t("Sen bir ortak mısın? Profilinde uzmanlık kategorilerini seç — satıcılar seni burada bulup ürünlerini sana emanet etsin. İlk uzman ortaklardan biri ol.")}
              </Text>
              <View style={{ maxWidth: 320, width: "100%" }}>
                <PrimaryButton icon="star-plus" href={isAuthenticated ? "/profile-edit" : "/auth"}>{t("Uzmanlığımı belirle")}</PrimaryButton>
              </View>
            </View>
          )
        ) : (
          <View style={{ alignItems: "stretch", flexDirection: "row", flexWrap: "wrap", gap }}>
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
                {entry.city ? (
                  <>
                    <MaterialCommunityIcons name="map-marker" size={11} color={colors.muted} />
                    <Text numberOfLines={1} style={{ color: colors.muted, flexShrink: 1, fontSize: 11, fontWeight: "800" }}>{entry.city}</Text>
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

      {/* Alt aksiyon: vitrini gör + favori kalp — marginTop:auto → kart uzasa da hep DİPTE (eşit yükseklik). */}
      <View style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: "auto", paddingHorizontal: 14, paddingVertical: 8 }}>
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

