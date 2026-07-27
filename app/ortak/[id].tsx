import { MaterialCommunityIcons } from "@/components/icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { ListingCard } from "@/components/listing-card";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { Seo } from "@/components/seo";
import { tierFromCount } from "@/components/partner-tier";
import { shareOrCopy } from "@/lib/share";
import { EmptyState, PrimaryButton } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { PAGE_MAX_WIDTH } from "@/components/web-container";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { responsiveGrid, useIsWideWeb, useMounted } from "@/lib/layout";
import { saveRefAttribution } from "@/lib/referral";
import { loadMyFavoritePartnerIds, loadPartnerShopLive, togglePartnerFavorite, type PartnerShopItem, type PartnerShopProfile } from "@/lib/supabase-data";
import { useStore } from "@/lib/use-store";

export default function PartnerShopScreen() {
  return useMounted() ? <Inner /> : <ScreenSkeleton />;
}

function Inner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const partnerId = Array.isArray(id) ? id[0] : id;
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const isWideWeb = useIsWideWeb();
  const { currentUser, findUser, isAuthenticated } = useStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PartnerShopProfile | null>(null);
  const [items, setItems] = useState<PartnerShopItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const isOwnShop = Boolean(currentUser?.id && currentUser.id === partnerId);

  useEffect(() => {
    let alive = true;
    if (!partnerId) { setLoading(false); return; }
    setLoading(true);
    loadPartnerShopLive(partnerId)
      .then((res) => {
        if (!alive) return;
        setProfile(res.profile);
        setItems(res.items);
        setFavCount(res.profile?.favoriteCount ?? 0);
        // Vitrindeki her ilan için ref atfını sakla → normal kart tıklaması ortağa kredilenir.
        // ANLAŞILAN pencere (ortaklık snapshot'ı) > canlı ilanınki — satıcı sonradan kısaltamasın.
        res.items.forEach((it) => saveRefAttribution(it.listing.id, it.partnershipId, it.refCode, it.attributionWindowDays ?? it.listing.attributionWindowDays));
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [partnerId]);

  // Favori durumu (yalnız giriş yapılmış + kendi vitrini değilse anlamlı).
  useEffect(() => {
    let alive = true;
    if (!partnerId || !isAuthenticated || isOwnShop) { setFavorited(false); return; }
    loadMyFavoritePartnerIds().then((ids) => { if (alive) setFavorited(ids.has(partnerId)); }).catch(() => {});
    return () => { alive = false; };
  }, [partnerId, isAuthenticated, isOwnShop]);

  const toggleFav = async () => {
    if (!isAuthenticated) { void router.push("/auth"); return; }
    const next = !favorited;
    setFavorited(next); // iyimser
    setFavCount((c) => Math.max(0, c + (next ? 1 : -1)));
    const ok = await togglePartnerFavorite(partnerId!, next);
    if (!ok) { setFavorited(!next); setFavCount((c) => Math.max(0, c + (next ? -1 : 1))); } // geri al
  };

  const name = profile?.fullName || translateCopy("Ortak", language);
  const verified = Boolean(profile?.verifiedIdentity || profile?.verifiedPhone);
  const tier = tierFromCount(profile?.confirmedSales ?? 0);
  const shopUrl = `https://www.ortaksat.com/ortak/${partnerId}`;
  const pad = 12;
  const inner = Math.min(width, PAGE_MAX_WIDTH) - pad * 2;
  const gap = 10;
  const cardWidth = responsiveGrid({ available: inner, gap, minCardWidth: isWideWeb ? 205 : 168, minColumns: isWideWeb ? 4 : 2 }).cardWidth;

  // Native'de OS paylaşım tabakası (Share sheet), web'de navigator.share → panoya düşer.
  const copyShop = async () => {
    const res = await shareOrCopy({
      title: `${name} — Ortak Vitrini`,
      message: `${name} vitrinine göz at:`,
      url: shopUrl
    });
    if (res === "copied") { setCopied(true); setTimeout(() => setCopied(false), 1600); }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
      <Seo
        title={`${name} — Ortak vitrini | OrtakSat`}
        description={`${name} adlı ortağın OrtakSat vitrini: promosyonundaki ${items.length} ilan. İlanları incele, ortak bağlantısıyla satın al.`}
        path={partnerId ? `/ortak/${partnerId}` : undefined}
      />
      <View style={{ alignSelf: "center", maxWidth: PAGE_MAX_WIDTH, paddingHorizontal: pad, paddingTop: 14, width: "100%" }}>
        {/* Ortak profil başlığı */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, gap: 14, padding: 18 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
            <View style={{ alignItems: "center", backgroundColor: tier.tint, borderRadius: 999, height: 60, justifyContent: "center", width: 60 }}>
              <Text style={{ color: tier.color, fontSize: 24, fontWeight: "900" }}>{name.slice(0, 1).toLocaleUpperCase("tr-TR")}</Text>
            </View>
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                <Text numberOfLines={1} style={{ color: colors.ink, flexShrink: 1, fontSize: 20, fontWeight: "900" }}>{name}</Text>
                {verified ? <MaterialCommunityIcons name="check-decagram" size={18} color={colors.primary} /> : null}
              </View>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                <View style={{ alignItems: "center", backgroundColor: tier.tint, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 9, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 12 }}>{tier.emoji}</Text>
                  <Text style={{ color: tier.color, fontSize: 11.5, fontWeight: "900" }}>{translateCopy(tier.label, language)}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{profile?.confirmedSales ?? 0} {translateCopy("başarılı satış", language)}</Text>
              </View>
              {/* Güven sinyalleri: tamamlanan ortaklık + kaç kişi favoriledi (itibar). */}
              <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2 }}>
                {(profile?.completedPartnerships ?? 0) > 0 ? (
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 3 }}>
                    <MaterialCommunityIcons name="handshake" size={12} color={colors.subtle} />
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{profile!.completedPartnerships} {translateCopy("tamamlanan ortaklık", language)}</Text>
                  </View>
                ) : null}
                {favCount > 0 ? (
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 3 }}>
                    <MaterialCommunityIcons name="heart" size={12} color={colors.accent} />
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{favCount} {translateCopy("kişi favoriledi", language)}</Text>
                  </View>
                ) : null}
                {profile?.city ? (
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 3 }}>
                    <MaterialCommunityIcons name="map-marker" size={12} color={colors.subtle} />
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{profile.city}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            {/* Favori: satıcı bu ortağı kaydeder → "Favori Ortaklarım"dan bulur (kendi vitrini hariç). */}
            {!isOwnShop ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: favorited }}
                accessibilityLabel={favorited ? translateCopy("Favorilerden çıkar", language) : translateCopy("Favori ortak yap", language)}
                onPress={() => void toggleFav()}
                style={({ pressed }) => ({ alignItems: "center", backgroundColor: favorited ? colors.accentSoft : colors.surfaceAlt, borderColor: favorited ? colors.accent : colors.line, borderRadius: 999, borderWidth: 1, height: 40, justifyContent: "center", opacity: pressed ? 0.7 : 1, width: 40 })}
              >
                <MaterialCommunityIcons name={favorited ? "heart" : "heart-outline"} size={20} color={favorited ? colors.accent : colors.muted} />
              </Pressable>
            ) : null}
          </View>
          {/* Uzmanlık kategorileri — satıcı, ortağın deneyimli olduğu alanları görür. */}
          {(profile?.expertiseCategories?.length ?? 0) > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {profile!.expertiseCategories.map((cat) => (
                <View key={cat} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 9, paddingVertical: 3 }}>
                  <MaterialCommunityIcons name="star-check-outline" size={12} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "800" }}>{translateCopy(cat, language)}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 12, flexDirection: "row", gap: 8, padding: 12 }}>
            <MaterialCommunityIcons name="handshake-outline" size={18} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 12.5, fontWeight: "700", lineHeight: 18 }}>
              {translateCopy("Bu ortağın önerdiği ilanlar. Buradan bir ilana geçip talep/işlem yaparsan, komisyon bu ortağa yazılır — fiyatın değişmez.", language)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton icon={copied ? "check" : "share-variant"} tone="secondary" onPress={() => void copyShop()}>{copied ? translateCopy("Kopyalandı", language) : translateCopy("Vitrini paylaş", language)}</PrimaryButton>
            </View>
          </View>
        </View>

        {/* Vitrin ilanları */}
        <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900", marginBottom: 10, marginTop: 20 }}>{translateCopy("Vitrindeki ilanlar", language)} {loading ? "" : `· ${items.length}`}</Text>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <MaterialCommunityIcons name="loading" size={28} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 8 }}>{translateCopy("Vitrin yükleniyor…", language)}</Text>
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            title={translateCopy("Vitrin henüz boş", language)}
            body={translateCopy("Bu ortağın şu an aktif promosyon ilanı yok. Ortak, bir ilana katılıp paylaştığında burada listelenir.", language)}
          />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {items.map((it) => (
              <ListingCard key={it.listing.id} listing={it.listing} owner={findUser(it.listing.ownerId)} width={cardWidth} refCode={it.refCode} />
            ))}
          </View>
        )}
      </View>
      <WebFooter />
    </ScrollView>
  );
}
