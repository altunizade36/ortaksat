import type { CategoryNode } from "@/lib/category-tree";
import { useMemo, useState } from "react";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { useStore } from "@/lib/use-store";
import { categoryByPrefix, categoryTrail, inCategory, mobileCategories } from "@/lib/mobile-catalog";
import { groupThousands } from "@/lib/format";
import { searchKey } from "@/lib/locale";
import { MobileBottomNav, MobileScreen, mobile, useMobileLayout } from "./ui";
import { MobileCategorySelect } from "./category-select";

export function CategoryArtwork({ tile, size = 65 }: { tile: number; size?: number }) {
  return <View style={{ height: size, width: size, borderRadius: 10, overflow: "hidden", backgroundColor: "#EEF0F9" }}><Image source={require("../../assets/mobile/category-atlas.webp")} contentFit="fill" style={{ position: "absolute", width: size * 4, height: size * 4, left: -(tile % 4) * size, top: -Math.floor(tile / 4) * size }} /></View>;
}
export function MobileCategories() {
  const router = useRouter();
  const { listings, categoryTree, marketplaceHasMore } = useStore();
  const { tablet, maxWidth } = useMobileLayout();
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const data = useMemo(() => mobileCategories.map((c) => {
    const node = categoryByPrefix(categoryTree, c.match);
    const trail = node ? categoryTrail(categoryTree, node.slug) : [];
    return { ...c, node, count: node ? listings.filter((l) => l.status === "active" && inCategory(l, trail)).length : 0 };
  }), [categoryTree, listings]);
  const visible = data.filter((c) => searchKey(c.label).includes(searchKey(query)));
  const columns = tablet ? (maxWidth > 950 ? 4 : 3) : 2;
  const cardWidth = Math.floor((maxWidth - 32 - (columns - 1) * 8) / columns);
  return <><MobileScreen title="Kategoriler" bottom={<MobileBottomNav />}>
    <View style={s.search}><Icon name="magnify" size={23} color="#626A79" /><TextInput accessibilityLabel="Kategori veya ürün ara" value={query} onChangeText={setQuery} placeholder="Kategori veya ürün ara..." placeholderTextColor="#7D8594" returnKeyType="search" onSubmitEditing={() => router.push({ pathname: "/explore", params: { q: query } })} style={s.input} /></View>
    <View style={s.grid}>{visible.map((c) => <Pressable key={c.match} accessibilityRole="button" accessibilityLabel={c.label} onPress={() => c.match === "all" ? setAll((v) => !v) : c.node ? router.push(`/kategori/${c.node.slug}` as never) : router.push({ pathname: "/explore", params: { q: c.label } })} style={[s.card, { width: cardWidth }]}>
      <CategoryArtwork tile={c.tile} size={tablet ? 72 : cardWidth < 165 ? 50 : 55} />
      <View style={{ flex: 1, gap: 3 }}><Text style={s.name}>{c.label}</Text><Text style={s.count}>{c.match === "all" ? `${groupThousands(categoryTree.reduce((n, r) => n + countChildren(r), 0))} alt kategori` : c.count ? `${groupThousands(c.count)}${marketplaceHasMore ? "+" : ""} ilan` : "İlanları keşfet"}</Text></View><Icon name="chevron-right" size={18} color="#87909E" />
    </Pressable>)}</View>
    {!visible.length && <Text style={{ textAlign: "center", padding: 24, color: mobile.muted }}>Kategori bulunamadı. Ürün aramak için klavyedeki ara düğmesini kullanabilirsin.</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Ücretsiz ilan ver" onPress={() => router.push("/create")}><LinearGradient colors={["#001B5F", "#003AB2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner}><View style={{ flex: 1 }}><Text style={s.bannerTitle}>Sen de ilan ver,{"\n"}ortaklarla daha hızlı sat!</Text><Text style={s.bannerCopy}>Ücretsiz ilan ver, daha fazla kişiye ulaş.</Text></View><Image source={require("../../assets/mobile/rocket.webp")} contentFit="contain" style={{ width: 110, height: 85 }} /></LinearGradient></Pressable>
  </MobileScreen><MobileCategorySelect visible={all} initial={[]} onClose={() => setAll(false)} onSelect={path => router.push(path.length ? `/kategori/${path[path.length - 1].slug}` as never : "/explore")} /></>;
}
function countChildren(n: CategoryNode): number { return (n.children ?? []).reduce((sum, c) => sum + 1 + countChildren(c), 0); }
const s = StyleSheet.create({ search: { flexDirection: "row", alignItems: "center", gap: 8, borderColor: mobile.line, borderWidth: 1, borderRadius: 15, backgroundColor: "white", paddingHorizontal: 12, marginBottom: 12, boxShadow: "0px 2px 6px #1834400A" }, input: { flex: 1, height: 42, fontSize: 14, color: mobile.ink }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, card: { borderColor: mobile.line, borderWidth: 1, borderRadius: 12, minHeight: 68, padding: 4, backgroundColor: "#FDFEFF", flexDirection: "row", alignItems: "center", gap: 6 }, name: { color: mobile.ink, fontWeight: "700", fontSize: 11, lineHeight: 15 }, count: { color: "#697286", fontSize: 10 }, root: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, borderColor: mobile.line }, banner: { marginTop: 12, borderRadius: 13, padding: 14, flexDirection: "row", alignItems: "center", gap: 8 }, bannerTitle: { color: "white", fontSize: 19, lineHeight: 24, fontWeight: "800", fontStyle: "italic" }, bannerCopy: { color: "#E4ECFC", fontSize: 10, marginTop: 6 } });
