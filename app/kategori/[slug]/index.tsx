import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter, type Href } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import { Accordion } from "@/components/accordion";
import { colors } from "@/components/colors";
import { ListingCard } from "@/components/listing-card";
import { EmptyState } from "@/components/ui";
import { WebContainer } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { categoryTree as CATEGORY_TREE, getFormSchema, resolveFormKey, type CategoryNode } from "@/lib/category-tree";
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
  // 0-2. seviye: üst + alt + marka/detay hub'ları (ör. cep-telefonu → apple,
  // vasita → otomobil-markaya-gore → bmw). Model seviyesi (3+) fallback ile çalışır.
  for (const top of CATEGORY_TREE) {
    add(top.slug);
    for (const sub of top.children ?? []) {
      add(sub.slug);
      for (const sub2 of sub.children ?? []) add(sub2.slug);
    }
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
  // Kategoriye özel özellik filtreleri (İlan tipi, Oda, İmar, Tapu…): şemadaki
  // tekli-seçim (select) alanlar filtre çipi olur. Değerler OR'lanır.
  const [attrFilters, setAttrFilters] = useState<Record<string, string[]>>({});
  // Sayısal aralık filtreleri kategoriye göre: emlak → m², vasıta → km/yıl.
  const [numRange, setNumRange] = useState<Record<string, { min: string; max: string }>>({});

  const trail = useMemo(() => (slug ? findTrail(categoryTree, slug) : undefined), [categoryTree, slug]);
  const node = trail ? trail[trail.length - 1] : undefined;
  const ancestors = trail ? trail.slice(0, -1) : [];

  // Seçili kategorinin form şemasından filtrelenebilir (select) alanları çıkar.
  const filterFields = useMemo(() => {
    if (!trail) return [];
    const schema = getFormSchema(resolveFormKey(trail));
    // Tekli-seçim (≤16 seçenek) + kısa çoklu-seçim (etiketler, enerji, oda tipleri…
    // ≤24 seçenek) facet olur. Uzun listeler (iç/site özellikleri) filtreye taşınmaz.
    return schema.fields.filter((f) => {
      const n = f.options?.length ?? 0;
      if (f.key === "seller") return false;
      if (f.type === "select") return n >= 2 && n <= 16;
      if (f.type === "multiselect") return n >= 2 && n <= 24;
      return false;
    });
  }, [trail]);

  // Kategoride bulunan sayısal-aralık alanları (m² / km / yıl). Aynı etiket bir kez.
  const NUM_FILTERS: Array<{ key: string; label: string; suffix?: string }> = [
    { key: "grossM2", label: "m²" }, { key: "m2", label: "m²" }, { key: "km", label: "Kilometre", suffix: "km" }, { key: "year", label: "Yıl" }
  ];
  const numFields = useMemo(() => {
    if (!trail) return [] as typeof NUM_FILTERS;
    const keys = new Set(getFormSchema(resolveFormKey(trail)).fields.map((f) => f.key));
    const seenLabel = new Set<string>();
    return NUM_FILTERS.filter((f) => keys.has(f.key) && !seenLabel.has(f.label) && (seenLabel.add(f.label), true));
  }, [trail]);
  const numActiveCount = numFields.filter((f) => (numRange[f.key]?.min ?? "").trim() || (numRange[f.key]?.max ?? "").trim()).length;
  const setNum = (key: string, side: "min" | "max", v: string) => setNumRange((s) => ({ ...s, [key]: { min: s[key]?.min ?? "", max: s[key]?.max ?? "", [side]: v } }));

  function toggleAttr(key: string, val: string) {
    setAttrFilters((s) => {
      const cur = s[key] ?? [];
      const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
      const copy = { ...s };
      if (next.length) copy[key] = next; else delete copy[key];
      return copy;
    });
  }

  const items = useMemo(() => {
    if (!node) return [];
    const labels = new Set(descendantLabels(node));
    const activeAttrKeys = Object.keys(attrFilters);
    const out = listings.filter((l) => {
      if (l.status !== "active" || !labels.has(l.category)) return false;
      if (band && (l.price < band[0] || l.price > band[1])) return false;
      if (onlyOpen && l.partnershipMode !== "open") return false;
      // Özellik filtreleri: her aktif alan için ilanın attribute değeri seçilenlerden
      // birini içermeli (dizi ise kesişim, tekil ise eşitlik). Değeri olmayan eler.
      for (const key of activeAttrKeys) {
        const want = attrFilters[key];
        const have = l.attributes?.[key];
        const ok = Array.isArray(have) ? have.some((v) => want.includes(String(v))) : want.includes(String(have ?? ""));
        if (!ok) return false;
      }
      // Sayısal aralık(lar): m² / km / yıl — ilanın değeri min-max içinde olmalı.
      for (const nf of numFields) {
        const r = numRange[nf.key];
        const mn = r?.min?.trim() ? Number(r.min) : null;
        const mx = r?.max?.trim() ? Number(r.max) : null;
        if (mn === null && mx === null) continue;
        const val = Number(l.attributes?.[nf.key] ?? (nf.key === "grossM2" ? l.attributes?.m2 : 0) ?? 0) || 0;
        if (!val) return false;
        if (mn !== null && val < mn) return false;
        if (mx !== null && val > mx) return false;
      }
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
  }, [listings, node, band, onlyOpen, sortMode, attrFilters, numRange, numFields]);

  useEffect(() => { setVisible(PAGE); }, [band, onlyOpen, sortMode, slug, attrFilters, numRange]);
  useEffect(() => { setAttrFilters({}); setNumRange({}); }, [slug]);

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

          {/* Kategoriye özel özellik filtreleri (emlak: İlan tipi, Oda, İmar, Tapu…) */}
          {filterFields.length || numFields.length ? (
            <Accordion title={`Detaylı filtreler${Object.keys(attrFilters).length || numActiveCount ? ` · ${Object.values(attrFilters).reduce((a, v) => a + v.length, 0) + numActiveCount} seçili` : ""}`} icon="tune-variant">
              <View style={{ gap: 12 }}>
                {numFields.map((nf) => (
                  <View key={nf.key} style={{ gap: 6 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{nf.label} aralığı</Text>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                      <TextInput value={numRange[nf.key]?.min ?? ""} onChangeText={(v) => setNum(nf.key, "min", v)} keyboardType="numeric" placeholder="En az" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13, minHeight: 40, paddingHorizontal: 12 }} />
                      <Text style={{ color: colors.subtle, fontSize: 13 }}>—</Text>
                      <TextInput value={numRange[nf.key]?.max ?? ""} onChangeText={(v) => setNum(nf.key, "max", v)} keyboardType="numeric" placeholder="En çok" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13, minHeight: 40, paddingHorizontal: 12 }} />
                    </View>
                  </View>
                ))}
                {filterFields.map((f) => (
                  <View key={f.key} style={{ gap: 6 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{f.label}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {(f.options ?? []).map((opt) => {
                        const on = (attrFilters[f.key] ?? []).includes(opt);
                        return (
                          <Pressable key={opt} onPress={() => toggleAttr(f.key, opt)} style={{ alignItems: "center", backgroundColor: on ? colors.primarySoft : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 4, paddingHorizontal: 11, paddingVertical: 6 }}>
                            {on ? <MaterialCommunityIcons name="check" size={12} color={colors.primaryDark} /> : null}
                            <Text style={{ color: on ? colors.primaryDark : colors.ink, fontSize: 12, fontWeight: on ? "800" : "600" }}>{opt}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
                {Object.keys(attrFilters).length || numActiveCount ? (
                  <Pressable onPress={() => { setAttrFilters({}); setNumRange({}); }} style={{ alignSelf: "flex-start", borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "800" }}>Filtreleri temizle</Text>
                  </Pressable>
                ) : null}
              </View>
            </Accordion>
          ) : null}
        </View>

        {items.length === 0 ? (
          band || onlyOpen ? (
            <EmptyState title="Filtreye uyan ilan yok" body="Filtreleri gevşetmeyi dene ya da farklı bir kategoriye göz at." />
          ) : (
            <View style={{ backgroundColor: colors.primarySoft, borderRadius: 16, gap: 12, padding: 20 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                <MaterialCommunityIcons name="storefront-plus-outline" size={24} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>{node.label} kategorisinde ilk ilanı sen ekle</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 20 }}>
                Bu kategoride henüz ilan yok. Ürününü ücretsiz ekle, komisyonunu belirle; ortaklar senin için satsın. İlk olan öne çıkar. Ya da bir ürüne ortak olup kazanmaya başla.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable onPress={() => router.push("/create")} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingVertical: 11 }}>
                  <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Ücretsiz İlan Ver</Text>
                </Pressable>
                <Link href="/influencer-kazanc" asChild>
                  <Pressable style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingVertical: 11 }}>
                    <MaterialCommunityIcons name="cash-multiple" size={16} color={colors.primaryDark} />
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>Ortak Ol, Kazan</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          )
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
