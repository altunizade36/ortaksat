import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter, type Href } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { Accordion } from "@/components/accordion";
import { colors } from "@/components/colors";
import { ListingCard } from "@/components/listing-card";
import { EmptyState } from "@/components/ui";
import { WebContainer } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { categoryTree as CATEGORY_TREE, type CategoryNode } from "@/lib/category-tree";
import { getCategoryIcon } from "@/lib/categories";
import { CITY_CATEGORY_SLUGS, SEO_CITY_SLUGS, findProvince } from "@/lib/cities";
import { commissionAmount } from "@/lib/format";
import { responsiveGrid } from "@/lib/layout";
import { useStore } from "@/lib/use-store";

function descendantLabels(node: CategoryNode): string[] {
  const out = [node.label];
  for (const c of node.children ?? []) out.push(...descendantLabels(c));
  return out;
}

// Kök→hedef ata zinciri: breadcrumb'da her üst kategoriye tıklanabilir çıkış için.
function findTrail(nodes: CategoryNode[], slug: string, trail: CategoryNode[] = []): CategoryNode[] | undefined {
  for (const n of nodes) {
    const next = [...trail, n];
    if (n.slug === slug || n.key === slug) return next;
    if (n.children) {
      const found = findTrail(n.children, slug, next);
      if (found) return found;
    }
  }
  return undefined;
}

const catHref = (slug: string): Href => ({ pathname: "/kategori/[slug]", params: { slug } }) as unknown as Href;
const cityHref = (slug: string, sehir: string): Href => ({ pathname: "/kategori/[slug]/[sehir]", params: { slug, sehir } }) as unknown as Href;

// Statik export: üst + alt kategori hub sayfalarını build'de kendi H1/içeriğiyle
// önceden üret (SEO). Marka/model gibi derin slug'lar [slug] fallback ile çalışır.
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const seen = new Set<string>();
  const out: Array<{ slug: string }> = [];
  const add = (slug: string) => { if (slug && !seen.has(slug)) { seen.add(slug); out.push({ slug }); } };
  for (const top of CATEGORY_TREE) {
    add(top.slug);
    for (const sub of top.children ?? []) add(sub.slug);
  }
  // Şehir sayfası olan yüksek-talep retail kategorilerinin hub'ını da garanti et.
  for (const slug of CITY_CATEGORY_SLUGS) add(slug);
  return out;
}

const PAGE = 24;

export default function CategoryLandingScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { listings, categoryTree, findUser } = useStore();
  const [visible, setVisible] = useState(PAGE);
  const [sortMode, setSortMode] = useState<"featured" | "newest" | "priceAsc" | "priceDesc" | "commission">("featured");
  const [band, setBand] = useState<[number, number] | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(false);

  const trail = useMemo(() => (slug ? findTrail(categoryTree, slug) : undefined), [categoryTree, slug]);
  const node = trail ? trail[trail.length - 1] : undefined;
  const ancestors = trail ? trail.slice(0, -1) : [];

  const items = useMemo(() => {
    if (!node) return [];
    const labels = new Set(descendantLabels(node));
    const out = listings.filter((l) => {
      if (l.status !== "active" || !labels.has(l.category)) return false;
      if (band && (l.price < band[0] || l.price > band[1])) return false;
      if (onlyOpen && l.partnershipMode !== "open") return false;
      return true;
    });
    out.sort((a, b) => {
      if (sortMode === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sortMode === "priceAsc") return a.price - b.price;
      if (sortMode === "priceDesc") return b.price - a.price;
      if (sortMode === "commission") return commissionAmount(b) - commissionAmount(a);
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || commissionAmount(b) - commissionAmount(a);
    });
    return out;
  }, [listings, node, band, onlyOpen, sortMode]);

  useEffect(() => { setVisible(PAGE); }, [band, onlyOpen, sortMode, slug]);

  const cardWidth = responsiveGrid({ available: Math.min(width, 1240) - 24, gap: 12, minCardWidth: 176 }).cardWidth;
  const title = node ? `${node.label} ilanları — Ortak satış | OrtakSat` : "Kategori — OrtakSat";
  const desc = node
    ? `${node.label} kategorisinde ${items.length} ortak satış ilanı. Komisyonlu ürünleri keşfet, ortak ol, kazan. OrtakSat aracıdır; ödeme ve teslimat taraflar arasındadır.`
    : "OrtakSat kategori sayfası.";
  const url = `https://ortaksat.com/kategori/${slug}`;

  if (!node) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ alignItems: "center", flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <EmptyState title="Kategori bulunamadı" body="Bu kategori kaldırılmış olabilir." />
        <Link href="/kategoriler" asChild>
          <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, marginTop: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>Tüm Kategoriler</Text>
          </Pressable>
        </Link>
      </ScrollView>
    );
  }

  const faq = [
    { q: `${node.label} ilanları OrtakSat'ta nasıl satılır?`, a: "İlanını ücretsiz eklersin ve komisyon oranını kendin belirlersin. Ortaklar ürününü kendi takipçisiyle paylaşır; satış olursa komisyonu anlaştığın kanaldan doğrudan ortağa ödersin. Ödeme ve teslimat alıcı ile satıcı arasında yapılır." },
    { q: `${node.label} kategorisinde komisyon oranını kim belirler?`, a: "İlanı açan satıcı belirler — yüzde (%) veya sabit tutar (₺) olarak. Ortak, paylaşmadan önce kazancını ilanda net görür." },
    { q: `OrtakSat ${node.label.toLocaleLowerCase("tr-TR")} alım satımında ödeme veya kargo yapar mı?`, a: "Hayır. OrtakSat aracı bir ilan ve eşleşme platformudur; para tutmaz, kargo yapmaz. Ödeme ve teslimatı alıcı ile satıcı kendi arasında yapar." },
    { q: `${node.label} ürününü ortak olarak nasıl paylaşırım?`, a: "Ürüne ortak olursun ve sana özel bir referans linki oluşur. Bu linki Instagram, TikTok veya WhatsApp'ta paylaşırsın; linkten gelen alıcı satın alırsa komisyon senin olur." }
  ];
  const faqLd = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });

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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />
      </Head>

      <WebContainer max={1240} padding={12} style={{ gap: 14 }}>
        {/* Breadcrumb — tam ata zinciri (her üst kategori tıklanabilir) */}
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          <Link href="/" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>Ana Sayfa</Text></Pressable></Link>
          <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
          <Link href="/kategoriler" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>Kategoriler</Text></Pressable></Link>
          {ancestors.map((a) => (
            <View key={a.key} style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
              <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
              <Link href={catHref(a.slug)} asChild><Pressable><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{a.label}</Text></Pressable></Link>
            </View>
          ))}
          <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
          <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{node.label}</Text>
        </View>

        {/* Başlık */}
        <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 14, height: 52, justifyContent: "center", width: 52 }}>
            <MaterialCommunityIcons name={getCategoryIcon(node.label)} size={26} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>{node.label} ilanları</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>{items.length} ortak satış ilanı · komisyonlu ürünleri keşfet</Text>
          </View>
        </View>

        {/* Alt kategoriler (varsa) */}
        {node.children && node.children.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {node.children.map((c) => (
              <Link key={c.key} href={{ pathname: "/kategori/[slug]", params: { slug: c.slug } } as unknown as Href} asChild>
                <Pressable style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{c.label}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : null}

        {/* Sıralama + hızlı filtreler */}
        <View style={{ gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingRight: 12 }}>
            {([["featured", "Öne çıkanlar"], ["newest", "En yeni"], ["commission", "En çok kazandıran"], ["priceAsc", "Fiyat ↑"], ["priceDesc", "Fiyat ↓"]] as const).map(([k, lbl]) => {
              const on = sortMode === k;
              return (
                <Pressable key={k} onPress={() => setSortMode(k)} style={{ backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 }}>
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{lbl}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingRight: 12 }}>
            <Pressable onPress={() => setOnlyOpen((v) => !v)} style={{ alignItems: "center", backgroundColor: onlyOpen ? colors.primarySoft : colors.surface, borderColor: onlyOpen ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 }}>
              <MaterialCommunityIcons name="flash" size={13} color={onlyOpen ? colors.primaryDark : colors.muted} />
              <Text style={{ color: onlyOpen ? colors.primaryDark : colors.ink, fontSize: 12, fontWeight: "800" }}>Anında ortak</Text>
            </Pressable>
            {([[0, 1000, "0–1.000 ₺"], [1000, 5000, "1.000–5.000 ₺"], [5000, 25000, "5.000–25.000 ₺"], [25000, 100000, "25.000–100.000 ₺"], [100000, Number.MAX_SAFE_INTEGER, "100.000 ₺+"]] as const).map(([mn, mx, lbl]) => {
              const on = band?.[0] === mn && band?.[1] === mx;
              return (
                <Pressable key={lbl} onPress={() => setBand(on ? null : [mn, mx])} style={{ backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{lbl}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {items.length === 0 ? (
          <EmptyState title="Bu kategoride ilan yok" body={band || onlyOpen ? "Filtreye uyan ilan yok; filtreleri gevşetmeyi dene." : "Yakında eklenecek. Farklı bir kategoriye göz atabilirsin."} />
        ) : (
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
        )}

        {/* Şehre göre — derin iç bağlantı (şehir×kategori SEO sayfalarına) */}
        <View style={{ gap: 8, marginTop: 6 }}>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Şehre göre {node.label}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SEO_CITY_SLUGS.map((c) => (
              <Link key={c} href={cityHref(node.slug, c)} asChild>
                <Pressable style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{findProvince(c)} {node.label}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>

        {/* SSS — benzersiz içerik + FAQPage zengin sonuç */}
        <View style={{ gap: 10, marginTop: 4 }}>
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{node.label} — Sık Sorulan Sorular</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {faq.map((item) => (
              <View key={item.q} style={{ flexBasis: 440, flexGrow: 1, maxWidth: 720 }}>
                <Accordion title={item.q} icon="comment-question-outline">
                  <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "500", lineHeight: 21 }}>{item.a}</Text>
                </Accordion>
              </View>
            ))}
          </View>
        </View>
      </WebContainer>
      <WebFooter />
    </ScrollView>
  );
}
