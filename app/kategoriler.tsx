import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useRouter, type Href } from "expo-router";
import Head from "expo-router/head";

// /kategori/[slug] route'una tip-güvenli kısa yol (typed-routes üreteci yeni route'u
// yakalayana kadar cast; runtime'da route mevcut ve çalışıyor).
const categoryHref = (slug: string): Href => ({ pathname: "/kategori/[slug]", params: { slug } }) as unknown as Href;
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { WebFooter, WebTrustStrip } from "@/components/web-landing";
import { getCategoryImage } from "@/lib/categories";
import { type CategoryNode } from "@/lib/category-tree";
import { useIsWideWeb } from "@/lib/layout";

function descendantLabels(node: CategoryNode): string[] {
  const out = [node.label];
  for (const c of node.children ?? []) out.push(...descendantLabels(c));
  return out;
}
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/use-store";

const PALETTE: Array<[string, string]> = [
  [colors.primarySoft, colors.primaryDark],
  [colors.infoSoft, colors.info],
  [colors.violetSoft, colors.violet],
  [colors.goldSoft, colors.gold],
  [colors.accentSoft, colors.accent],
  [colors.successSoft, colors.success],
  [colors.warningSoft, colors.warning]
];

// Deterministic thousands grouping (no Intl) so SSG and client match (no #418).
function groupTr(value: number) {
  const digits = String(Math.round(value));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ".";
    out += digits[i];
  }
  return out;
}

export default function CategoriesPage() {
  const { language } = useLanguage();
  const { listings, categoryTree } = useStore();
  const router = useRouter();
  const isWideWeb = useIsWideWeb();
  const [query, setQuery] = useState("");

  const counts: Record<string, number> = {};
  for (const listing of listings) {
    if (listing.status !== "active") continue;
    counts[listing.category] = (counts[listing.category] ?? 0) + 1;
  }
  const tops = categoryTree.filter((c) => c.label !== "Diğer");
  // Gerçek ilan sayıları — uydurma veri yok. Boşsa sayı gösterilmez, "İlan ekle" denir.
  const catData = tops.map((c) => {
    const labels = descendantLabels(c);
    const real = labels.reduce((sum, lbl) => sum + (counts[lbl] ?? 0), 0);
    return {
      cat: { key: c.key, label: c.label, shortLabel: c.label, subcategories: (c.children ?? []).map((ch) => ch.label) },
      count: real,
      subCount: descendantLabels(c).length - 1,
      image: c.image ?? getCategoryImage(c.key)
    };
  });
  const totalActive = listings.filter((l) => l.status === "active").length;
  const popular = catData.slice().sort((a, b) => b.count - a.count || b.subCount - a.subCount).slice(0, 8);
  const quickChips = tops.slice(0, 8).map((c) => ({ key: c.key, label: c.label, shortLabel: c.label }));

  const steps: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body: string }> = [
    { icon: "tag-plus-outline", title: "İlanını oluştur", body: "Ürününü kategorisiyle yayınla; ücretsiz." },
    { icon: "account-multiple-outline", title: "Ortak & alıcı bul", body: "İlgilenenler seninle mesajdan iletişime geçer." },
    { icon: "handshake-outline", title: "Kendi aranızda anlaşın", body: "OrtakSat ödeme/kargo işlemez; taraflar doğrudan anlaşır." }
  ];

  function search() {
    router.push({ pathname: "/explore", params: query.trim() ? { q: query.trim() } : undefined });
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
      <Head><title>Tüm Kategoriler — Emlak, Vasıta, Elektronik | OrtakSat</title><meta name="description" content="OrtakSat'ta tüm kategoriler: emlak, vasıta, elektronik, moda, ev & yaşam ve daha fazlası. Ürününü ortak sat, komisyon kazan." /></Head>
      <View style={{ alignSelf: "center", gap: 20, maxWidth: 1280, paddingHorizontal: 20, paddingTop: 16, width: "100%" }}>
      {/* Hero */}
      <View style={{ backgroundColor: colors.primarySoft, borderRadius: 20, flexDirection: isWideWeb ? "row" : "column", gap: isWideWeb ? 24 : 16, paddingHorizontal: isWideWeb ? 28 : 18, paddingVertical: isWideWeb ? 24 : 18 }}>
        <View style={{ flex: 1.5, gap: 12, justifyContent: "center", minWidth: 0 }}>
          <View style={{ alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Kategoriler", language)}</Text>
          </View>
          <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: 28, fontWeight: "900", lineHeight: 34 }}>{translateCopy("İlgilendiğin kategoriyi keşfet, kazancını artır.", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600", lineHeight: 22, maxWidth: 540 }}>{translateCopy("Kategorilere göz at, ortak satışla kazanmaya başla.", language)}</Text>
          <View style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, maxWidth: 520, paddingLeft: 14, paddingRight: 6 }}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} onSubmitEditing={search} placeholder={translateCopy("Kategori veya ürün ara...", language)} placeholderTextColor={colors.muted} style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "600", height: 46 }} />
            <Pressable onPress={search} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 9, flexDirection: "row", gap: 5, height: 36, paddingHorizontal: 16 }}>
              <MaterialCommunityIcons name="magnify" size={16} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Ara", language)}</Text>
            </Pressable>
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {quickChips.map((c) => (
              <Link key={c.key} href={categoryHref(c.key)} asChild>
                <Pressable style={{ backgroundColor: "#FFFFFF", borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{translateCopy(c.shortLabel, language)}</Text>
                </Pressable>
              </Link>
            ))}
            <Link href="/explore" asChild>
              <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 3, paddingHorizontal: 6, paddingVertical: 7 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Tümünü Gör", language)}</Text>
                <MaterialCommunityIcons name="chevron-right" size={15} color={colors.primaryDark} />
              </Pressable>
            </Link>
          </View>
        </View>
        <View style={{ gap: 12, justifyContent: "center", width: isWideWeb ? 260 : "100%" }}>
          {[
            { icon: "shape-outline" as const, value: `${tops.length}`, label: translateCopy("Toplam kategori", language) },
            { icon: "tag-multiple-outline" as const, value: `${totalActive}`, label: translateCopy("Aktif ilan", language) },
            { icon: "gift-outline" as const, value: translateCopy("Ücretsiz", language), label: translateCopy("İlan & başvuru", language) }
          ].map((s) => (
            <View key={s.label} style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
                <MaterialCommunityIcons name={s.icon} size={20} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{s.value}</Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Popüler kategoriler — tam genişlik (sağdaki "nasıl çalışır" kartı
          kaldırıldı; hem gereksiz tekrar hem mobilde bozulmaya yol açıyordu). */}
      <View style={{ gap: 14 }}>
        <SectionHead title={translateCopy("Popüler kategoriler", language)} subtitle={translateCopy("En çok ilgi gören kategorilere göz at.", language)} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {popular.map(({ cat, count, image }, i) => (
            <Link key={cat.key} href={categoryHref(cat.key)} asChild>
              <Pressable dataSet={{ card: "listing" }} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 130, flexGrow: 1, gap: 8, maxWidth: 200, padding: 12 }}>
                <View style={{ alignItems: "center", backgroundColor: PALETTE[i % PALETTE.length][0], borderRadius: 12, height: 84, justifyContent: "center", overflow: "hidden", width: "100%" }}>
                  <SafeRemoteImage uri={image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={140} />
                </View>
                <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800", textAlign: "center" }}>{translateCopy(cat.label, language)}</Text>
                <Text numberOfLines={1} style={{ color: count > 0 ? colors.muted : colors.primaryDark, fontSize: 11, fontWeight: "700" }}>{count > 0 ? `${groupTr(count)} ilan` : translateCopy("İlan ekle →", language)}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </View>

      {/* Tüm kategoriler */}
      <View style={{ gap: 14 }}>
        <SectionHead title={translateCopy("Tüm kategoriler", language)} subtitle={translateCopy("Tüm ana kategoriler ve alt kategorileri keşfet.", language)} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {catData.map(({ cat, count, image }, i) => (
            <Link key={cat.key} href={categoryHref(cat.key)} asChild>
              <Pressable dataSet={{ card: "listing" }} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 250, flexGrow: 1, gap: 10, maxWidth: 360, padding: 16 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
                  <View style={{ backgroundColor: PALETTE[i % PALETTE.length][0], borderRadius: 12, height: 46, overflow: "hidden", width: 46 }}>
                    <SafeRemoteImage uri={image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={140} />
                  </View>
                  <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" }}>{translateCopy(cat.label, language)}</Text>
                </View>
                <View style={{ gap: 4 }}>
                  {cat.subcategories.slice(0, 3).map((sub) => (
                    <View key={sub} style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                      <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: 4, width: 4 }} />
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{translateCopy(sub, language)}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{count > 0 ? `${groupTr(count)} aktif ilan` : `${cat.subcategories.length} alt kategori · İlan ekle`}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
        <Link href="/explore" asChild>
          <Pressable style={{ alignItems: "center", alignSelf: "center", marginTop: 2 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 24, paddingVertical: 11 }}>
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("Daha fazla kategori yükle", language)}</Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color={colors.muted} />
            </View>
          </Pressable>
        </Link>
      </View>
      </View>

      <WebTrustStrip />
      <WebFooter />
    </ScrollView>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{subtitle}</Text>
      </View>
      <Link href="/explore" asChild>
        <Pressable><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Tümünü Gör", language)}</Text></Pressable>
      </Link>
    </View>
  );
}
