import { MaterialCommunityIcons } from "@/components/icons";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { resolveReferralLink } from "@/lib/live-service";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/use-store";

/**
 * ESKİ ortak-satış "landing" rotası (/i/[slug]). MODEL değişti: zorunlu referans linki/kodu/
 * takip YOK; ortak ürünü kendi yöntemiyle tanıtır ve DÜZ ürün sayfası linkini (/listing/[id])
 * paylaşır. Bu rota artık ÜRETİLMİYOR; ama geçmişte paylaşılmış (legacy) linkler kırılmasın diye
 * ürünü çözüp doğrudan ÜRÜN SAYFASINA yönlendirir (lead-form/atıf/tıklama-takibi kaldırıldı).
 */
export default function ReferralRedirectScreen() {
  const { language } = useLanguage();
  const params = useLocalSearchParams<{ slug: string; ref?: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const ref = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const router = useRouter();
  const { listings } = useStore();
  const [notFound, setNotFound] = useState(false);

  const localListing = useMemo(() => listings.find((l) => l.slug === slug), [listings, slug]);

  useEffect(() => {
    let alive = true;
    if (!slug) { setNotFound(true); return; }
    // Bellekte varsa doğrudan ürün sayfasına git.
    if (localListing?.id) { router.replace(`/listing/${localListing.id}`); return; }
    // Legacy remote link (slug+ref): ilanı çöz, ÜRÜN sayfasına yönlendir (takip yok, sadece ürün).
    if (ref) {
      void resolveReferralLink(slug, ref).then((r) => {
        if (!alive) return;
        if (r?.listingId) router.replace(`/listing/${r.listingId}`);
        else setNotFound(true);
      }).catch(() => { if (alive) setNotFound(true); });
    } else {
      setNotFound(true);
    }
    return () => { alive = false; };
  }, [localListing?.id, slug, ref]);

  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", flexGrow: 1, justifyContent: "center", padding: 24 }} style={{ backgroundColor: colors.background }}>
      <Seo title={translateCopy("Ürüne yönlendiriliyorsun — OrtakSat", language)} description={translateCopy("OrtakSat ürün sayfası.", language)} path="/i" noindex />
      <View style={{ alignItems: "center", gap: 14, maxWidth: 420 }}>
        {!notFound ? (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "700" }}>{translateCopy("Ürün sayfasına yönlendiriliyorsun…", language)}</Text>
          </>
        ) : (
          <>
            <MaterialCommunityIcons name="compass-outline" size={40} color={colors.muted} />
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900", textAlign: "center" }}>{translateCopy("Ürün bulunamadı", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, textAlign: "center" }}>{translateCopy("Bu ürün kaldırılmış veya bağlantı artık geçerli değil. Binlerce ürünü keşfetmeye devam et.", language)}</Text>
            <Link href="/explore" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: colors.primaryDark, borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 13 }}>
                <MaterialCommunityIcons name="compass-outline" size={18} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{translateCopy("Ürünleri keşfet", language)}</Text>
              </Pressable>
            </Link>
          </>
        )}
      </View>
    </ScrollView>
  );
}
