import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter, type Href } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { ListingCard } from "@/components/listing-card";
import { EmptyState } from "@/components/ui";
import { WebContainer } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { type CategoryNode } from "@/lib/category-tree";
import { commissionAmount } from "@/lib/format";
import { responsiveGrid } from "@/lib/layout";
import { useStore } from "@/lib/use-store";

function descendantLabels(node: CategoryNode): string[] {
  const out = [node.label];
  for (const c of node.children ?? []) out.push(...descendantLabels(c));
  return out;
}

function findBySlug(nodes: CategoryNode[], slug: string): CategoryNode | undefined {
  for (const n of nodes) {
    if (n.slug === slug || n.key === slug) return n;
    const found = n.children ? findBySlug(n.children, slug) : undefined;
    if (found) return found;
  }
  return undefined;
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

  const node = useMemo(() => (slug ? findBySlug(categoryTree, slug) : undefined), [categoryTree, slug]);

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

      <WebContainer max={1240} padding={12} style={{ gap: 14 }}>
        {/* Breadcrumb */}
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          <Link href="/" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>Ana Sayfa</Text></Pressable></Link>
          <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
          <Link href="/kategoriler" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>Kategoriler</Text></Pressable></Link>
          <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
          <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{node.label}</Text>
        </View>

        {/* Başlık */}
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>{node.label} ilanları</Text>
          <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>{items.length} ortak satış ilanı · komisyonlu ürünleri keşfet</Text>
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
      </WebContainer>
      <WebFooter />
    </ScrollView>
  );
}
