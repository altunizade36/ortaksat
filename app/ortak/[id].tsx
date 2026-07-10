import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { ListingCard } from "@/components/listing-card";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { Seo } from "@/components/seo";
import { tierFromCount } from "@/components/partner-tier";
import { EmptyState, PrimaryButton } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { PAGE_MAX_WIDTH } from "@/components/web-container";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { responsiveGrid, useIsWideWeb, useMounted } from "@/lib/layout";
import { saveRefAttribution } from "@/lib/referral";
import { loadPartnerShopLive, type PartnerShopItem, type PartnerShopProfile } from "@/lib/supabase-data";
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
  const { findUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PartnerShopProfile | null>(null);
  const [items, setItems] = useState<PartnerShopItem[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!partnerId) { setLoading(false); return; }
    setLoading(true);
    loadPartnerShopLive(partnerId)
      .then((res) => {
        if (!alive) return;
        setProfile(res.profile);
        setItems(res.items);
        // Vitrindeki her ilan için ref atfını sakla → normal kart tıklaması ortağa kredilenir.
        res.items.forEach((it) => saveRefAttribution(it.listing.id, it.partnershipId, it.refCode));
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [partnerId]);

  const name = profile?.fullName || translateCopy("Ortak", language);
  const verified = Boolean(profile?.verifiedIdentity || profile?.verifiedPhone);
  const tier = tierFromCount(profile?.confirmedSales ?? 0);
  const shopUrl = `https://www.ortaksat.com/ortak/${partnerId}`;
  const pad = 12;
  const inner = Math.min(width, PAGE_MAX_WIDTH) - pad * 2;
  const gap = 10;
  const cardWidth = responsiveGrid({ available: inner, gap, minCardWidth: isWideWeb ? 205 : 168, minColumns: isWideWeb ? 4 : 2 }).cardWidth;

  const copyShop = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shopUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 40 }}>
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
                  <MaterialCommunityIcons name={tier.icon} size={13} color={tier.color} />
                  <Text style={{ color: tier.color, fontSize: 11.5, fontWeight: "900" }}>{translateCopy(tier.label, language)}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{profile?.confirmedSales ?? 0} {translateCopy("başarılı satış", language)}</Text>
              </View>
            </View>
          </View>
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 12, flexDirection: "row", gap: 8, padding: 12 }}>
            <MaterialCommunityIcons name="handshake-outline" size={18} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 12.5, fontWeight: "700", lineHeight: 18 }}>
              {translateCopy("Bu ortağın önerdiği ilanlar. Buradan bir ilana geçip talep/işlem yaparsan, komisyon bu ortağa yazılır — fiyatın değişmez.", language)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton icon={copied ? "check" : "link-variant"} tone="secondary" onPress={copyShop}>{copied ? translateCopy("Kopyalandı", language) : translateCopy("Vitrin bağlantısını kopyala", language)}</PrimaryButton>
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
              <ListingCard key={it.listing.id} listing={it.listing} owner={findUser(it.listing.ownerId)} width={cardWidth} />
            ))}
          </View>
        )}
      </View>
      <WebFooter />
    </ScrollView>
  );
}
