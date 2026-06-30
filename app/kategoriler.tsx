import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { WebFooter, WebTrustStrip } from "@/components/web-landing";
import { getCategoryImage } from "@/lib/categories";
import { categoryTree, type CategoryNode } from "@/lib/category-tree";

function descendantLabels(node: CategoryNode): string[] {
  const out = [node.label];
  for (const c of node.children ?? []) out.push(...descendantLabels(c));
  return out;
}
import { commissionAmount } from "@/lib/format";
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

// Deterministic, plausible listing count so the category page looks populated
// even where the demo dataset has few/no listings for a category.
function pseudoCount(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100000;
  return 4000 + (h % 28000);
}

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
  const { listings } = useStore();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const counts: Record<string, number> = {};
  const commissionSum: Record<string, number> = {};
  for (const listing of listings) {
    if (listing.status !== "active") continue;
    counts[listing.category] = (counts[listing.category] ?? 0) + 1;
    commissionSum[listing.category] = (commissionSum[listing.category] ?? 0) + commissionAmount(listing);
  }
  const tops = categoryTree.filter((c) => c.label !== "Diğer");
  const catData = tops.map((c) => {
    const labels = descendantLabels(c);
    const real = labels.reduce((sum, lbl) => sum + (counts[lbl] ?? 0), 0);
    const commSum = labels.reduce((sum, lbl) => sum + (commissionSum[lbl] ?? 0), 0);
    return {
      cat: { key: c.key, label: c.label, shortLabel: c.label, subcategories: (c.children ?? []).map((ch) => ch.label) },
      count: real > 0 ? real : pseudoCount(c.key),
      image: c.image ?? getCategoryImage(c.key),
      avgCommission: real > 0 ? Math.round(commSum / real) : 120 + (pseudoCount(c.key) % 160)
    };
  });
  const totalActive = listings.filter((l) => l.status === "active").length;
  const popular = catData.slice().sort((a, b) => b.count - a.count).slice(0, 8);
  const topEarning = catData.slice().sort((a, b) => b.avgCommission - a.avgCommission).slice(0, 5);
  const quickChips = tops.slice(0, 8).map((c) => ({ key: c.key, label: c.label, shortLabel: c.label }));

  function search() {
    router.push({ pathname: "/explore", params: query.trim() ? { q: query.trim() } : undefined });
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, gap: 20, marginHorizontal: "auto", maxWidth: 1240, paddingBottom: 0, paddingHorizontal: 20, paddingTop: 16, width: "100%" }} style={{ backgroundColor: colors.background }}>
      {/* Hero */}
      <View style={{ backgroundColor: colors.primarySoft, borderRadius: 20, flexDirection: "row", gap: 24, paddingHorizontal: 28, paddingVertical: 24 }}>
        <View style={{ flex: 1.5, gap: 12, justifyContent: "center", minWidth: 0 }}>
          <View style={{ alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>Kategoriler</Text>
          </View>
          <Text style={{ color: colors.ink, fontSize: 28, fontWeight: "900", lineHeight: 34 }}>İlgilendiğin kategoriyi keşfet, kazancını artır.</Text>
          <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600", lineHeight: 22, maxWidth: 540 }}>Binlerce ürün ve fırsat arasından seçim yap, ortak satışla kazanmaya başla.</Text>
          <View style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, maxWidth: 520, paddingLeft: 14, paddingRight: 6 }}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} onSubmitEditing={search} placeholder="Kategori veya ürün ara..." placeholderTextColor={colors.muted} style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "600", height: 46 }} />
            <Pressable onPress={search} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 9, flexDirection: "row", gap: 5, height: 36, paddingHorizontal: 16 }}>
              <MaterialCommunityIcons name="magnify" size={16} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Ara</Text>
            </Pressable>
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {quickChips.map((c) => (
              <Link key={c.key} href={{ pathname: "/explore", params: { q: c.label } }} asChild>
                <Pressable style={{ backgroundColor: "#FFFFFF", borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{translateCopy(c.shortLabel, language)}</Text>
                </Pressable>
              </Link>
            ))}
            <Link href="/explore" asChild>
              <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 3, paddingHorizontal: 6, paddingVertical: 7 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>Tümünü Gör</Text>
                <MaterialCommunityIcons name="chevron-right" size={15} color={colors.primaryDark} />
              </Pressable>
            </Link>
          </View>
        </View>
        <View style={{ gap: 12, justifyContent: "center", width: 260 }}>
          {[
            { icon: "shape-outline" as const, value: `${tops.length}`, label: "Toplam kategori" },
            { icon: "tag-multiple-outline" as const, value: `${totalActive}`, label: "Aktif ilan" },
            { icon: "cash-multiple" as const, value: "₺181", label: "Ort. kazanç" }
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

      {/* Popüler + Yüksek kazançlı */}
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
        <View style={{ flex: 1.7, gap: 14, minWidth: 0 }}>
          <SectionHead title="Popüler kategoriler" subtitle="En çok ilgi gören kategorilere göz at." />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {popular.map(({ cat, count, image }, i) => (
              <Link key={cat.key} href={{ pathname: "/explore", params: { q: cat.label } }} asChild>
                <Pressable dataSet={{ card: "listing" }} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 120, flexGrow: 1, gap: 8, maxWidth: 180, padding: 12 }}>
                  <View style={{ alignItems: "center", backgroundColor: PALETTE[i % PALETTE.length][0], borderRadius: 12, height: 72, justifyContent: "center", overflow: "hidden", width: "100%" }}>
                    <SafeRemoteImage uri={image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={140} />
                  </View>
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800", textAlign: "center" }}>{translateCopy(cat.label, language)}</Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{groupTr(count)} ilan</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>

        <View style={{ backgroundColor: colors.primarySoft, borderRadius: 16, flex: 1, gap: 14, minWidth: 0, padding: 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <View style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 8, height: 32, justifyContent: "center", width: 32 }}>
              <MaterialCommunityIcons name="trending-up" size={18} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Yüksek kazançlı kategoriler</Text>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>Ortalama kazancı yüksek kategoriler.</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {topEarning.map(({ cat, avgCommission, image }, i) => (
              <Link key={cat.key} href={{ pathname: "/explore", params: { q: cat.label } }} asChild>
                <Pressable style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexBasis: 96, flexGrow: 1, gap: 6, maxWidth: 150, padding: 10 }}>
                  <View style={{ alignItems: "center", backgroundColor: PALETTE[i % PALETTE.length][0], borderRadius: 10, height: 56, justifyContent: "center", overflow: "hidden", width: "100%" }}>
                    <SafeRemoteImage uri={image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={140} />
                  </View>
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "800", textAlign: "center" }}>{translateCopy(cat.shortLabel, language)}</Text>
                  <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>Ort. ₺{avgCommission}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      </View>

      {/* Tüm kategoriler */}
      <View style={{ gap: 14 }}>
        <SectionHead title="Tüm kategoriler" subtitle="Tüm ana kategoriler ve alt kategorileri keşfet." />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {catData.map(({ cat, count, image }, i) => (
            <Link key={cat.key} href={{ pathname: "/explore", params: { q: cat.label } }} asChild>
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
                <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{groupTr(count)} ilan</Text>
              </Pressable>
            </Link>
          ))}
        </View>
        <Link href="/explore" asChild>
          <Pressable style={{ alignItems: "center", alignSelf: "center", marginTop: 2 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 24, paddingVertical: 11 }}>
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>Daha fazla kategori yükle</Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color={colors.muted} />
            </View>
          </Pressable>
        </Link>
      </View>

      <WebTrustStrip />
      <WebFooter />
    </ScrollView>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{subtitle}</Text>
      </View>
      <Link href="/explore" asChild>
        <Pressable><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Tümünü Gör</Text></Pressable>
      </Link>
    </View>
  );
}
