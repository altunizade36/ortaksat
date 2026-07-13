import { MaterialCommunityIcons } from "@/components/icons";
import { Link, useLocalSearchParams, useRouter, type Href } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { JsonLd } from "@/components/json-ld";
import { ListingCard } from "@/components/listing-card";
import { MarketplaceRetry } from "@/components/marketplace-retry";
import { EmptyState } from "@/components/ui";
import { WebContainer } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { type CategoryNode } from "@/lib/category-tree";
import { getCategoryIcon } from "@/lib/categories";
import { CITY_CATEGORY_SLUGS, SEO_CITY_SLUGS, citySlug, findProvince, listingInCity } from "@/lib/cities";
import { commissionAmount } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { responsiveGrid } from "@/lib/layout";
import { useStore } from "@/lib/use-store";

function descendantLabels(node: CategoryNode): string[] {
  const out = [node.label];
  for (const c of node.children ?? []) out.push(...descendantLabels(c));
  return out;
}

// Genişlik-öncelikli (en sığ eşleşme): sl(label) slug çakışmalarında üst kategori kazanır.
function findTrail(nodes: CategoryNode[], slug: string): CategoryNode[] | undefined {
  let frontier = nodes.map((n) => ({ node: n, trail: [n] as CategoryNode[] }));
  while (frontier.length) {
    const hit = frontier.find((f) => f.node.slug === slug || f.node.key === slug);
    if (hit) return hit.trail;
    const next: Array<{ node: CategoryNode; trail: CategoryNode[] }> = [];
    for (const f of frontier) for (const c of f.node.children ?? []) next.push({ node: c, trail: [...f.trail, c] });
    frontier = next;
  }
  return undefined;
}

const cityHref = (slug: string, sehir: string): Href =>
  ({ pathname: "/kategori/[slug]/[sehir]", params: { slug, sehir } }) as unknown as Href;
const catHref = (slug: string): Href => ({ pathname: "/kategori/[slug]", params: { slug } }) as unknown as Href;

const PAGE = 24;

// Statik export: 12 kategori × 12 şehir = 144 sayfayı build'de kendi H1/içeriğiyle
// önceden üret (SEO). Listelenmeyen kombinasyonlar [sehir] fallback ile çalışır.
export async function generateStaticParams(): Promise<Array<{ slug: string; sehir: string }>> {
  return CITY_CATEGORY_SLUGS.flatMap((slug) => SEO_CITY_SLUGS.map((sehir) => ({ slug, sehir })));
}

export default function CityCategoryScreen() {
  const { language } = useLanguage();
  const params = useLocalSearchParams<{ slug: string; sehir: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const sehir = Array.isArray(params.sehir) ? params.sehir[0] : params.sehir;
  const router = useRouter();
  const { width } = useWindowDimensions();
  // Hidrasyon güvenliği (React #418): mount'a kadar sabit genişlik → cardWidth
  // sunucu/istemci uyuşur; mount sonrası gerçek genişlik.
  const [mountedGate, setMountedGate] = useState(false);
  useEffect(() => { setMountedGate(true); }, []);
  const layoutWidth = mountedGate ? width : 1024;
  const { listings, categoryTree, findUser, marketplaceLoadFailed, retryMarketplace } = useStore();
  const [visible, setVisible] = useState(PAGE);
  const [sortMode, setSortMode] = useState<"featured" | "newest" | "priceAsc" | "priceDesc" | "commission">("featured");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const trail = useMemo(() => (slug ? findTrail(categoryTree, slug) : undefined), [categoryTree, slug]);
  const node = trail ? trail[trail.length - 1] : undefined;
  const ancestors = trail ? trail.slice(0, -1) : [];
  const cityName = findProvince(sehir);
  const wantedCity = sehir ? citySlug(sehir) : "";

  // Aynı kategorideki tüm aktif ilanlar (şehir bağımsız) — sıralama + "diğer şehirler" için.
  const catItems = useMemo(() => {
    if (!node) return [];
    const labels = new Set(descendantLabels(node));
    const out = listings.filter((l) => l.status === "active" && labels.has(l.category) && (!onlyOpen || l.partnershipMode === "open"));
    out.sort((a, b) => {
      if (sortMode === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sortMode === "priceAsc") return a.price - b.price;
      if (sortMode === "priceDesc") return b.price - a.price;
      if (sortMode === "commission") return commissionAmount(b) - commissionAmount(a);
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || commissionAmount(b) - commissionAmount(a);
    });
    return out;
  }, [listings, node, onlyOpen, sortMode]);

  const items = useMemo(() => catItems.filter((l) => listingInCity(l.location, wantedCity)), [catItems, wantedCity]);
  const otherCityItems = useMemo(() => catItems.filter((l) => !listingInCity(l.location, wantedCity)).slice(0, 12), [catItems, wantedCity]);

  useEffect(() => { setVisible(PAGE); }, [onlyOpen, sortMode, slug, sehir]);

  const cardWidth = responsiveGrid({ available: Math.min(layoutWidth, 1240) - 24, gap: 12, minCardWidth: 176 }).cardWidth;

  if (!node || !cityName) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ alignItems: "center", flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <EmptyState title={translateCopy("Sayfa bulunamadı", language)} body={translateCopy("Bu kategori veya şehir tanımlı değil.", language)} />
        <Link href="/kategoriler" asChild>
          <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, marginTop: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Tüm Kategoriler", language)}</Text>
          </Pressable>
        </Link>
      </ScrollView>
    );
  }

  const title = `${cityName}'da Komisyonla ${node.label} İlanları | OrtakSat`;
  // SEO açıklaması evergreen — ilan SAYISI YAZMA (SSG bake'te 0'dır, "0 ilan" arama sonucunu boş gösterir).
  const desc = `${cityName}'da komisyonlu ${node.label.toLocaleLowerCase("tr-TR")} ürünlerini keşfet. ${cityName} için ${node.label} kategorisindeki ortak satış ilanlarını incele, ürününü ortak satışla sattır, ortak ol ve kazan. OrtakSat aracıdır; ödeme ve teslimat taraflar arasındadır.`;
  const url = `https://www.ortaksat.com/kategori/${slug}/${wantedCity}`;
  const otherCities = SEO_CITY_SLUGS.filter((c) => c !== wantedCity);
  // BreadcrumbList — Ana Sayfa › Kategoriler › {Kategori} › {Şehir}.
  const breadcrumbLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: "https://www.ortaksat.com/" },
      { "@type": "ListItem", position: 2, name: "Kategoriler", item: "https://www.ortaksat.com/kategoriler" },
      { "@type": "ListItem", position: 3, name: node.label, item: `https://www.ortaksat.com/kategori/${slug}` },
      { "@type": "ListItem", position: 4, name: cityName, item: url }
    ]
  });

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, paddingBottom: 40, paddingTop: 14 }}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={url} />
        {items[0]?.image ? <meta property="og:image" content={items[0].image} /> : null}
      </Head>
      <JsonLd id="breadcrumb" json={breadcrumbLd} />

      <WebContainer max={1240} padding={12} style={{ gap: 14 }}>
        {/* Breadcrumb */}
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          <Link href="/" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{translateCopy("Ana Sayfa", language)}</Text></Pressable></Link>
          <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
          <Link href="/kategoriler" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{translateCopy("Kategoriler", language)}</Text></Pressable></Link>
          {ancestors.map((a) => (
            <View key={a.key} style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
              <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
              <Link href={catHref(a.slug)} asChild><Pressable><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{translateCopy(a.label, language)}</Text></Pressable></Link>
            </View>
          ))}
          <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
          <Link href={catHref(node.slug)} asChild><Pressable><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{translateCopy(node.label, language)}</Text></Pressable></Link>
          <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
          <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{cityName}</Text>
        </View>

        {/* Başlık */}
        <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 14, height: 52, justifyContent: "center", width: 52 }}>
            <MaterialCommunityIcons name={getCategoryIcon(node.label)} size={26} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 23, fontWeight: "900" }}>{cityName}'da {node.label} İlanları</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>{items.length} ortak satış ilanı · komisyonla sattır, ortak ol kazan</Text>
          </View>
        </View>

        {/* SEO tanıtım metni (benzersiz içerik) */}
        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 14 }}>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 20 }}>
            {cityName}'da {node.label.toLocaleLowerCase("tr-TR")} satmak isteyen satıcılar OrtakSat'ta ürününü ücretsiz listeler, komisyon oranını kendi belirler. Ortaklar (influencer/sosyal medya kullanıcıları) ürünü kendi takipçisiyle paylaşır; satış olursa komisyon kazanır. Platform ücret almaz, kargo yapmaz — sadece {cityName}'daki satıcı, ortak ve alıcıyı buluşturur.
          </Text>
        </View>

        {/* Şehir çipleri — diğer şehirlerde aynı kategori (iç bağlantı / SEO) */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "800", textTransform: "uppercase" }}>Diğer şehirlerde {node.label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingRight: 12 }}>
            {otherCities.map((c) => (
              <Link key={c} href={cityHref(node.slug, c)} asChild>
                <Pressable style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{findProvince(c)}</Text>
                </Pressable>
              </Link>
            ))}
            <Link href={catHref(node.slug)} asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 12, paddingVertical: 7 }}>
                <MaterialCommunityIcons name="map-marker-multiple" size={13} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Tüm Türkiye", language)}</Text>
              </Pressable>
            </Link>
          </ScrollView>
        </View>

        {/* Sıralama + hızlı filtre */}
        <View style={{ gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingRight: 12 }}>
            {([["featured", "Öne çıkanlar"], ["newest", "En yeni"], ["commission", "En çok kazandıran"], ["priceAsc", "Fiyat ↑"], ["priceDesc", "Fiyat ↓"]] as const).map(([k, lbl]) => {
              const on = sortMode === k;
              return (
                <Pressable key={k} onPress={() => setSortMode(k)} style={{ backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 }}>
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{translateCopy(lbl, language)}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setOnlyOpen((v) => !v)} style={{ alignItems: "center", backgroundColor: onlyOpen ? colors.primarySoft : colors.surface, borderColor: onlyOpen ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 8 }}>
              <MaterialCommunityIcons name="flash" size={13} color={onlyOpen ? colors.primaryDark : colors.muted} />
              <Text style={{ color: onlyOpen ? colors.primaryDark : colors.ink, fontSize: 12, fontWeight: "800" }}>{translateCopy("Anında ortak", language)}</Text>
            </Pressable>
          </ScrollView>
        </View>

        {items.length > 0 ? (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {items.slice(0, visible).map((l) => (
                <ListingCard key={l.id} listing={l} owner={findUser(l.ownerId)} width={cardWidth} />
              ))}
            </View>
            {visible < items.length ? (
              <Pressable onPress={() => setVisible((v) => v + PAGE)} style={({ pressed }) => ({ alignItems: "center", alignSelf: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, opacity: pressed ? 0.85 : 1, paddingHorizontal: 26, paddingVertical: 13 })}>
                <MaterialCommunityIcons name="chevron-down" size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>Daha fazla göster ({items.length - visible})</Text>
              </Pressable>
            ) : null}
          </>
        ) : marketplaceLoadFailed && listings.length === 0 ? (
          // Katalog hiç yüklenemedi → şehir-boş mesajı yerine yeniden-dene.
          <MarketplaceRetry onRetry={retryMarketplace} />
        ) : (
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 16, gap: 12, padding: 20 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <MaterialCommunityIcons name="storefront-plus-outline" size={24} color={colors.primaryDark} />
              <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>{cityName}'da ilk {node.label.toLocaleLowerCase("tr-TR")} ilanını sen ekle</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 20 }}>
              Bu şehirde bu kategoride henüz ilan yok. Ürününü ücretsiz ekle, komisyonunu belirle; {cityName}'daki ortaklar senin için satsın. İlk olan öne çıkar.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pressable onPress={() => router.push("/create")} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingVertical: 11 }}>
                <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Ücretsiz İlan Ekle", language)}</Text>
              </Pressable>
              <Link href={catHref(node.slug)} asChild>
                <Pressable style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingVertical: 11 }}>
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>Tüm {node.label}</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        )}

        {/* Boşsa: diğer şehirlerden aynı kategori ilanları (içerik + iç bağlantı) */}
        {items.length === 0 && otherCityItems.length > 0 ? (
          <View style={{ gap: 10, marginTop: 6 }}>
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>Diğer şehirlerde {node.label} ilanları</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {otherCityItems.map((l) => (
                <ListingCard key={l.id} listing={l} owner={findUser(l.ownerId)} width={cardWidth} />
              ))}
            </View>
          </View>
        ) : null}
      </WebContainer>
      <WebFooter />
    </ScrollView>
  );
}
