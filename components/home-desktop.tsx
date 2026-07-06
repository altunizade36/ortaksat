import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { useCompare } from "@/lib/compare";
import { getCategoryIcon, getCategoryShortLabel } from "@/lib/categories";
import type { CategoryNode } from "@/lib/category-tree";
import { commissionAmount, moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { Skeleton } from "@/components/skeleton";
import { getRecent } from "@/lib/recent";
import { displayText } from "@/lib/text";
import type { Listing } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// Bir kategori düğümünün tüm alt etiketleri (hiyerarşik filtre için).
function descendantLabels(node: CategoryNode, out: string[] = []): string[] {
  out.push(node.label);
  for (const ch of node.children ?? []) descendantLabels(ch, out);
  return out;
}

// Hero'da gerçek görseller (ikon değil). public/hero -> ortaksat.com/hero
// Yeni klasör (hero2) — eski /hero/ dosyaları CDN/tarayıcıda önbelleğe takıldığı
// için taze URL'ler kullanılır. Merkez "deal" = ayakta anlaşma/tokalaşma görseli.
const HERO = (n: string) => `https://www.ortaksat.com/hero2/${n}.jpg`;
// SABİT tanıtım kümesi — merkez tokalaşma (anlaşma) fotoğrafı + çevresinde sabit
// ürün görselleri. Bilerek statiktir; canlı ilanlardan çekilmez, değişmez.
// Merkez karta göre SABİT piksel offset'leri (dx,dy) — ekran genişliğinden bağımsız,
// binmeyen dengeli elips halka. Kart ~132x116; daireler 44px.
const HERO_FLOAT: Array<{ img: string; dx: number; dy: number }> = [
  { img: "headphones", dx: -100, dy: -66 },
  { img: "laptop", dx: 100, dy: -66 },
  { img: "watch", dx: -110, dy: 6 },
  { img: "camera", dx: 110, dy: 6 },
  { img: "plant", dx: -88, dy: 76 },
  { img: "chair", dx: 88, dy: 76 }
];

export function HomeDesktop() {
  const { language } = useLanguage();
  const router = useRouter();
  const { categoryTree, listings, isFavorite, toggleFavorite, marketplaceInitialLoading } = useStore();

  const active = useMemo(() => listings.filter((l) => l.status === "active"), [listings]);
  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const openCount = active.filter((l) => l.partnershipMode === "open").length;
    const todayCount = active.filter((l) => (l.createdAt ?? "").slice(0, 10) === today).length;
    const cityCount = new Set(active.map((l) => l.location)).size;
    return [
      { icon: "package-variant-closed" as IconName, tint: colors.primarySoft, color: colors.primaryDark, value: active.length, label: "Aktif ilan" },
      { icon: "handshake-outline" as IconName, tint: colors.violetSoft, color: colors.violet, value: openCount, label: "Ortak satışa açık" },
      { icon: "file-document-outline" as IconName, tint: colors.infoSoft, color: colors.info, value: todayCount, label: "Bugün eklenen" },
      { icon: "map-marker-outline" as IconName, tint: colors.goldSoft, color: colors.gold, value: cityCount, label: "Şehir" }
    ];
  }, [active, today]);

  // Filtreler
  const [selectedNode, setSelectedNode] = useState<CategoryNode | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [locFilter, setLocFilter] = useState<string>("");
  const [locOpen, setLocOpen] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [minCommission, setMinCommission] = useState(0);
  const [inStock, setInStock] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [sortMode, setSortMode] = useState<"featured" | "newest" | "priceAsc" | "priceDesc" | "commission">("featured");
  const [visibleCount, setVisibleCount] = useState(18);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => { setRecentIds(getRecent()); }, []);
  const recentListings = useMemo(() => recentIds.map((id) => listings.find((l) => l.id === id)).filter((l): l is Listing => !!l && l.status === "active").slice(0, 8), [recentIds, listings]);

  const locations = useMemo(() => Array.from(new Set(active.map((l) => l.location))).sort((a, b) => a.localeCompare(b, "tr")).slice(0, 60), [active]);
  const pMin = Number(priceMin.replace(/[^\d]/g, "")) || 0;
  const pMax = Number(priceMax.replace(/[^\d]/g, "")) || 0;

  // Seçili kategorinin (ve tüm alt kategorilerinin) etiket kümesi.
  const catLabelSet = useMemo(() => (selectedNode ? new Set(descendantLabels(selectedNode).map((s) => s.toLocaleLowerCase("tr-TR"))) : null), [selectedNode]);
  const matchesCat = (l: Listing) => {
    if (!catLabelSet) return true;
    const c = l.category.toLocaleLowerCase("tr-TR");
    const short = getCategoryShortLabel(l.category).toLocaleLowerCase("tr-TR");
    return catLabelSet.has(c) || catLabelSet.has(short);
  };

  const filtered = useMemo(() => {
    return active.filter((l) => {
      if (!matchesCat(l)) return false;
      if (pMin && l.price < pMin) return false;
      if (pMax && l.price > pMax) return false;
      if (locFilter && l.location !== locFilter) return false;
      if (onlyOpen && l.partnershipMode !== "open") return false;
      if (onlyFeatured && !l.featured) return false;
      if (minCommission && commissionAmount(l) < minCommission) return false;
      if (inStock && l.stockCount <= 0) return false;
      if (onlyNew && !(Date.parse(l.createdAt ?? "") > Date.now() - 7 * 86400000)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, catLabelSet, pMin, pMax, locFilter, onlyOpen, onlyFeatured, minCommission, inStock, onlyNew]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortMode === "priceAsc") arr.sort((a, b) => a.price - b.price);
    else if (sortMode === "priceDesc") arr.sort((a, b) => b.price - a.price);
    else if (sortMode === "newest") arr.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    else if (sortMode === "commission") arr.sort((a, b) => commissionAmount(b) - commissionAmount(a));
    else arr.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return arr;
  }, [filtered, sortMode]);

  const grid = sorted.slice(0, visibleCount);

  // Filtre/sıralama değişince baştan göster.
  useEffect(() => { setVisibleCount(18); }, [selectedNode, pMin, pMax, locFilter, onlyOpen, onlyFeatured, minCommission, inStock, onlyNew, sortMode]);

  const topCats = categoryTree.filter((c) => c.label !== "Diğer");
  const popular = topCats.slice(0, 12);
  // Ortak-satış modeli: en çok kazandıran (en yüksek komisyonlu) fırsatlar.
  const topEarn = useMemo(() => [...active].filter((l) => commissionAmount(l) > 0).sort((a, b) => commissionAmount(b) - commissionAmount(a)).slice(0, 10), [active]);
  const activeFilterCount = (selectedNode ? 1 : 0) + (pMin || pMax ? 1 : 0) + (locFilter ? 1 : 0) + (onlyOpen ? 1 : 0) + (onlyFeatured ? 1 : 0) + (minCommission ? 1 : 0) + (inStock ? 1 : 0) + (onlyNew ? 1 : 0);
  const resetFilters = () => { setSelectedNode(null); setExpandedKey(null); setPriceMin(""); setPriceMax(""); setLocFilter(""); setOnlyOpen(false); setOnlyFeatured(false); setMinCommission(0); setInStock(false); setOnlyNew(false); };
  const COMMISSION_PRESETS: Array<[number, string]> = [[500, "500 ₺+"], [1000, "1.000 ₺+"], [2500, "2.500 ₺+"], [5000, "5.000 ₺+"]];
  const PRICE_PRESETS: Array<[string, string, string]> = [["0", "1000", "0 - 1.000 ₺"], ["1000", "5000", "1.000 - 5.000 ₺"], ["5000", "25000", "5.000 - 25.000 ₺"], ["25000", "100000", "25.000 - 100.000 ₺"], ["100000", "", "100.000 ₺ +"]];
  const SORTS: Array<[typeof sortMode, string]> = [["featured", "Öne çıkanlar"], ["newest", "En yeni"], ["priceAsc", "Fiyat ↑"], ["priceDesc", "Fiyat ↓"], ["commission", "Kazanç"]];

  return (
    <View style={{ alignItems: "flex-start", alignSelf: "center", flexDirection: "row", gap: 20, maxWidth: 1280, width: "100%" }}>
      {/* SOL: kategori + filtre paneli */}
      <View style={{ gap: 14, width: 248 }}>
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 13 }}>
            <MaterialCommunityIcons name="view-grid-outline" size={18} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>{translateCopy("Kategoriler", language)}</Text>
          </View>
          <View style={{ backgroundColor: colors.line, height: 1 }} />
          <ScrollView style={{ maxHeight: 440 }} nestedScrollEnabled showsVerticalScrollIndicator>
            {topCats.map((n) => {
              const on = selectedNode?.key === n.key;
              const expanded = expandedKey === n.key;
              const children = n.children ?? [];
              return (
                <View key={n.key}>
                  <Pressable
                    onPress={() => { setSelectedNode(n); setExpandedKey(expanded ? null : n.key); }}
                    style={{ alignItems: "center", backgroundColor: on ? colors.primarySoft : "transparent", borderLeftColor: on ? colors.primary : "transparent", borderLeftWidth: 3, flexDirection: "row", gap: 11, paddingHorizontal: 14, paddingVertical: 10 }}
                  >
                    <MaterialCommunityIcons name={getCategoryIcon(n.label)} size={17} color={on ? colors.primaryDark : colors.muted} />
                    <Text numberOfLines={1} style={{ color: on ? colors.primaryDark : colors.ink, flex: 1, fontSize: 13, fontWeight: on ? "900" : "600" }}>{translateCopy(n.label, language)}</Text>
                    {children.length ? <MaterialCommunityIcons name={expanded ? "chevron-down" : "chevron-right"} size={16} color={colors.subtle} /> : null}
                  </Pressable>
                  {expanded && children.length ? (
                    <View style={{ backgroundColor: colors.surfaceAlt, paddingVertical: 4 }}>
                      <Pressable onPress={() => setSelectedNode(n)} style={{ paddingHorizontal: 16, paddingLeft: 44, paddingVertical: 8 }}>
                        <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Tümü", language)} · {translateCopy(n.label, language)}</Text>
                      </Pressable>
                      {children.map((ch) => {
                        const con = selectedNode?.key === ch.key;
                        return (
                          <Pressable key={ch.key} onPress={() => setSelectedNode(con ? n : ch)} style={{ paddingHorizontal: 16, paddingLeft: 44, paddingVertical: 8 }}>
                            <Text numberOfLines={1} style={{ color: con ? colors.primaryDark : colors.ink, fontSize: 12.5, fontWeight: con ? "800" : "600" }}>{translateCopy(ch.label, language)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
            <Link href="/kategoriler" asChild>
              <Pressable style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 11, paddingHorizontal: 16, paddingVertical: 11 }}>
                <MaterialCommunityIcons name="dots-grid" size={17} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 13, fontWeight: "800" }}>{translateCopy("Tüm Kategoriler", language)}</Text>
              </Pressable>
            </Link>
          </ScrollView>
        </View>

        {/* Filtre paneli */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
              <MaterialCommunityIcons name="tune-variant" size={16} color={colors.primaryDark} />
              <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Filtrele", language)}</Text>
              {activeFilterCount > 0 ? <View style={{ backgroundColor: colors.primary, borderRadius: 999, minWidth: 18, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ color: "#FFFFFF", fontSize: 10.5, fontWeight: "900", textAlign: "center" }}>{activeFilterCount}</Text></View> : null}
            </View>
            <Pressable onPress={resetFilters}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Temizle", language)}</Text></Pressable>
          </View>

          {/* Fiyat aralığı: min/max + hazır aralıklar */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Fiyat Aralığı (₺)", language)}</Text>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
              <TextInput value={priceMin} onChangeText={setPriceMin} keyboardType="numeric" placeholder={translateCopy("En az", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 9, borderWidth: 1, color: colors.ink, flexBasis: 0, flexGrow: 1, fontSize: 12.5, fontWeight: "700", minHeight: 40, minWidth: 0, paddingHorizontal: 8, textAlign: "center" }} />
              <Text style={{ color: colors.subtle, fontSize: 13, fontWeight: "800" }}>—</Text>
              <TextInput value={priceMax} onChangeText={setPriceMax} keyboardType="numeric" placeholder={translateCopy("En çok", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 9, borderWidth: 1, color: colors.ink, flexBasis: 0, flexGrow: 1, fontSize: 12.5, fontWeight: "700", minHeight: 40, minWidth: 0, paddingHorizontal: 8, textAlign: "center" }} />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {PRICE_PRESETS.map(([mn, mx, lbl]) => {
                const on = priceMin === mn && priceMax === mx;
                return (
                  <Pressable key={lbl} onPress={() => { if (on) { setPriceMin(""); setPriceMax(""); } else { setPriceMin(mn); setPriceMax(mx); } }} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 10.5, fontWeight: "800" }}>{lbl}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Konum: inline açılır (altta kalmaz, içeriği aşağı iter) */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Konum", language)}</Text>
            <Pressable onPress={() => setLocOpen((o) => !o)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: locOpen ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 42, paddingHorizontal: 12 }}>
              <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.primary} />
              <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{locFilter || translateCopy("Tüm Türkiye", language)}</Text>
              <MaterialCommunityIcons name={locOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
            </Pressable>
            {locOpen ? (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 10, borderWidth: 1, maxHeight: 220, overflow: "hidden" }}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                  {["Tüm Türkiye", ...locations].map((o) => {
                    const on = (locFilter || "Tüm Türkiye") === o;
                    return (
                      <Pressable key={o} onPress={() => { setLocFilter(o === "Tüm Türkiye" ? "" : o); setLocOpen(false); }} style={({ pressed }) => ({ backgroundColor: pressed || on ? colors.surfaceAlt : "transparent", borderBottomColor: colors.line, borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 9 })}>
                        <Text style={{ color: on ? colors.primaryDark : colors.ink, fontSize: 12.5, fontWeight: on ? "800" : "600" }}>{o === "Tüm Türkiye" ? translateCopy("Tüm Türkiye", language) : o}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
          </View>

          {/* Ortak kazancı (min komisyon) */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("En Az Ortak Kazancı", language)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {COMMISSION_PRESETS.map(([v, lbl]) => {
                const on = minCommission === v;
                return (
                  <Pressable key={v} onPress={() => setMinCommission(on ? 0 : v)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 5 }}>
                    <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 11, fontWeight: "800" }}>{lbl}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Hızlı anahtarlar */}
          <View style={{ gap: 10 }}>
            <SwitchRow label={translateCopy("Sadece ortak satışa açık", language)} on={onlyOpen} onPress={() => setOnlyOpen((v) => !v)} />
            <SwitchRow label={translateCopy("Öne çıkan ilanlar", language)} on={onlyFeatured} onPress={() => setOnlyFeatured((v) => !v)} />
            <SwitchRow label={translateCopy("Stokta olanlar", language)} on={inStock} onPress={() => setInStock((v) => !v)} />
            <SwitchRow label={translateCopy("Yeni ilanlar (7 gün)", language)} on={onlyNew} onPress={() => setOnlyNew((v) => !v)} />
          </View>

          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, paddingVertical: 11 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{filtered.length} {translateCopy("sonuç bulundu", language)}</Text>
          </View>
        </View>
      </View>

      {/* SAĞ: ana içerik */}
      <View style={{ flex: 1, gap: 18, minWidth: 0 }}>
        {/* Hero + istatistikler */}
        <View style={{ alignItems: "stretch", flexDirection: "row", gap: 16 }}>
          <View style={{ backgroundColor: colors.primary, borderRadius: 18, flex: 1, flexDirection: "row", minWidth: 0, overflow: "hidden", paddingHorizontal: 22, paddingVertical: 18 }}>
            <View style={{ flex: 1.4, gap: 10, justifyContent: "center", minWidth: 0 }}>
              <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: "#FFFFFF", fontSize: 21, fontWeight: "900", lineHeight: 26 }}>
                {translateCopy("Ortak alın, ", language)}<Text style={{ color: colors.gold }}>{translateCopy("kazancınızı katlayın!", language)}</Text>
              </Text>
              <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.9)", fontSize: 12.5, fontWeight: "600", lineHeight: 17, maxWidth: 380 }}>
                {translateCopy("Ürünleri ortak sat, komisyon kazan. Güvenli, hızlı, kazançlı.", language)}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 2 }}>
                <Link href="/create" asChild>
                  <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 9 }}>
                    <MaterialCommunityIcons name="store-plus-outline" size={16} color={colors.primaryDark} />
                    <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("İlan Ver", language)}</Text>
                  </Pressable>
                </Link>
                <Link href="/partner" asChild>
                  <Pressable style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.5)", borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 8 }}>
                    <MaterialCommunityIcons name="handshake-outline" size={16} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Ortak Satışa Katıl", language)}</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
            {/* Kompakt görsel küme: yeşil daire + ortaklık fotoğrafı + ürünler.
                maxWidth ile ürünler karttan uzaklaşmaz; ring dengeli durur. */}
            <View style={{ alignItems: "center", alignSelf: "center", flex: 0.9, justifyContent: "center", minHeight: 210, minWidth: 0, position: "relative", width: "100%" }}>
              <View style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, height: 150, position: "absolute", width: 150 }} />
              <View style={{ borderColor: "#FFFFFF", borderRadius: 16, borderWidth: 3, height: 116, overflow: "hidden", shadowColor: "#0A3D30", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.26, shadowRadius: 16, width: 132 }}>
                <SafeRemoteImage uri={HERO("deal")} style={{ height: "100%", width: "100%" }} contentFit="cover" />
              </View>
              {HERO_FLOAT.map((f) => (
                <View key={f.img} style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 46, left: "50%", marginLeft: f.dx - 23, marginTop: f.dy - 23, overflow: "hidden", position: "absolute", shadowColor: "#0A3D30", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 8, top: "50%", width: 46 }}>
                  <SafeRemoteImage uri={HERO(f.img)} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                </View>
              ))}
            </View>
          </View>

          {/* İstatistik kartları */}
          <View style={{ gap: 9, width: 178 }}>
            {stats.map((s) => (
              <View key={s.label} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flex: 1, flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
                <View style={{ alignItems: "center", backgroundColor: s.tint, borderRadius: 10, height: 34, justifyContent: "center", width: 34 }}>
                  <MaterialCommunityIcons name={s.icon} size={18} color={s.color} />
                </View>
                <View style={{ flex: 1, gap: 0, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 16.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{new Intl.NumberFormat("tr-TR").format(s.value)}</Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>{translateCopy(s.label, language)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Ortak-satış: nasıl kazanılır + en çok kazandıran fırsatlar */}
        {topEarn.length > 0 ? (
          <View style={{ backgroundColor: colors.primaryDark, borderRadius: 16, gap: 12, padding: 16 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "900" }}>{translateCopy("En Çok Kazandıran Fırsatlar", language)}</Text>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.8)", fontSize: 11.5, fontWeight: "600" }}>{translateCopy("Ortak ol, sat, komisyonu kazan — komisyonu satıcı öder.", language)}</Text>
              </View>
              <Link href="/partner" asChild>
                <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Tümü", language)}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={14} color={colors.primaryDark} />
                </Pressable>
              </Link>
            </View>
            {/* En çok kazandıran fırsatlar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
              {topEarn.map((l) => (
                <Pressable key={l.id} onPress={() => router.push(`/listing/${l.id}`)} style={{ backgroundColor: colors.surface, borderRadius: 14, overflow: "hidden", width: 156 }}>
                  <View style={{ height: 92, width: "100%" }}>
                    <SafeRemoteImage uri={l.image} style={{ height: 92, width: "100%" }} contentFit="cover" />
                    <View style={{ backgroundColor: colors.gold, borderRadius: 6, left: 8, paddingHorizontal: 6, paddingVertical: 2, position: "absolute", top: 8 }}>
                      <Text style={{ color: "#1A1400", fontSize: 9.5, fontWeight: "900" }}>{translateCopy("Kazanç", language)} {moneyIn(commissionAmount(l), l.currency)}</Text>
                    </View>
                  </View>
                  <View style={{ gap: 4, padding: 9 }}>
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{displayText(l.title)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{moneyIn(l.price, l.currency)}</Text>
                    <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, paddingVertical: 6 }}>
                      <Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "900" }}>{translateCopy("Ortak Ol", language)}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Son gezdiklerin */}
        {recentListings.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Son Gezdiklerin", language)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 12 }}>
              {recentListings.map((l) => (
                <Pressable key={l.id} onPress={() => router.push(`/listing/${l.id}`)} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, overflow: "hidden", width: 150 }}>
                  <SafeRemoteImage uri={l.image} style={{ height: 96, width: "100%" }} contentFit="cover" />
                  <View style={{ gap: 3, padding: 9 }}>
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{displayText(l.title)}</Text>
                    <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{moneyIn(l.price, l.currency)}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Popüler kategoriler */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Popüler Kategoriler", language)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
            {popular.map((n) => (
              <Link key={n.key} href={{ pathname: "/kategori/[slug]", params: { slug: n.key } } as unknown as Href} asChild>
                <Pressable accessibilityRole="link" accessibilityLabel={`${translateCopy(n.label, language)} kategorisi`} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 14, paddingVertical: 9 }}>
                  <MaterialCommunityIcons name={getCategoryIcon(n.label)} size={16} color={colors.primary} />
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy(n.label, language)}</Text>
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        </View>

        {/* İlanlar başlığı + sıralama */}
        <View style={{ gap: 10 }}>
          <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{selectedNode ? translateCopy(selectedNode.label, language) : translateCopy("Öne Çıkan İlanlar", language)}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{filtered.length} {translateCopy("ilan listeleniyor", language)}</Text>
            </View>
            <Link href="/explore" asChild>
              <Pressable><Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Tümünü Gör →", language)}</Text></Pressable>
            </Link>
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Sırala:", language)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingRight: 12 }}>
              {SORTS.map(([key, lbl]) => {
                const on = sortMode === key;
                return (
                  <Pressable key={key} onPress={() => setSortMode(key)} style={{ backgroundColor: on ? colors.ink : colors.surface, borderColor: on ? colors.ink : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7 }}>
                    <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{translateCopy(lbl, language)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {grid.length === 0 && marketplaceInitialLoading ? (
          // HomeCard ile birebir aynı flex düzeni — skeleton→içerik geçişinde
          // kart genişliği/satır sayısı değişmez, "pop"/layout-shift olmaz.
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <View key={i} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 176, flexGrow: 1, gap: 9, maxWidth: 240, minWidth: 0, overflow: "hidden", padding: 10 }}>
                <Skeleton style={{ borderRadius: 10, height: 150, marginHorizontal: -10, marginTop: -10, width: "auto" }} />
                <Skeleton style={{ height: 12, width: "55%" }} />
                <Skeleton style={{ height: 15, width: "92%" }} />
                <Skeleton style={{ height: 15, width: "70%" }} />
                <Skeleton style={{ height: 18, width: "42%" }} />
                <Skeleton style={{ borderRadius: 999, height: 22, width: "58%" }} />
              </View>
            ))}
          </View>
        ) : grid.length === 0 && active.length === 0 ? (
          // Katalogda hiç ilan yok → ilk-ilan çağrısı (mobil ile tutarlı).
          <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 44 }}>
            <MaterialCommunityIcons name="storefront-outline" size={34} color={colors.primary} />
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Henüz ilan yok", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", textAlign: "center" }}>{translateCopy("İlk ilanı sen ver, ortaklarınla birlikte sat ve kazan.", language)}</Text>
            <Link href="/create" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("İlk ilanı ver", language)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, flexDirection: "row", gap: 7, marginTop: 4, opacity: pressed ? 0.85 : 1, paddingHorizontal: 22, paddingVertical: 12 })}>
                <MaterialCommunityIcons name="store-plus-outline" size={17} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{translateCopy("İlk İlanı Ver", language)}</Text>
              </Pressable>
            </Link>
          </View>
        ) : grid.length === 0 ? (
          <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 8, padding: 40 }}>
            <MaterialCommunityIcons name="magnify-close" size={30} color={colors.primary} />
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{translateCopy("Sonuç bulunamadı", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{translateCopy("Filtreleri değiştirerek tekrar dene.", language)}</Text>
            {activeFilterCount > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Filtreleri temizle", language)} onPress={resetFilters} style={({ pressed }) => ({ backgroundColor: colors.primarySoft, borderRadius: 9, marginTop: 4, opacity: pressed ? 0.85 : 1, paddingHorizontal: 16, paddingVertical: 8 })}>
                <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "900" }}>{translateCopy("Filtreleri temizle", language)}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              {grid.map((l) => (
                <HomeCard key={l.id} listing={l} favorited={isFavorite(l.id)} onFav={() => toggleFavorite(l.id)} onOpen={() => router.push(`/listing/${l.id}`)} />
              ))}
            </View>
            {visibleCount < filtered.length ? (
              <Pressable onPress={() => setVisibleCount((c) => c + 18)} style={({ pressed }) => ({ alignItems: "center", alignSelf: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, opacity: pressed ? 0.85 : 1, paddingHorizontal: 26, paddingVertical: 13 })}>
                <MaterialCommunityIcons name="chevron-down" size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Daha fazla göster", language)} ({filtered.length - visibleCount})</Text>
              </Pressable>
            ) : (
              <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "700", textAlign: "center" }}>{translateCopy("Tüm ilanları gördün", language)} · {filtered.length} {translateCopy("ilan", language)}</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function HomeCard({ listing, favorited, onFav, onOpen }: { listing: Listing; favorited: boolean; onFav: () => void; onOpen: () => void }) {
  const { language } = useLanguage();
  const { has, toggle } = useCompare();
  const inCompare = has(listing.id);
  const commission = commissionAmount(listing);
  const ageDays = (Date.now() - Date.parse(listing.createdAt ?? "")) / 86400000;
  const isNew = Number.isFinite(ageDays) && ageDays >= 0 && ageDays <= 7;
  const lowStock = listing.stockCount > 0 && listing.stockCount <= 3;
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 176, flexGrow: 1, maxWidth: 240, minWidth: 0, overflow: "hidden", shadowColor: "#101828", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 14 }}>
      <Pressable onPress={onOpen}>
        <View style={{ backgroundColor: colors.line, height: 150, width: "100%" }}>
          <SafeRemoteImage uri={listing.image} style={{ height: 150, width: "100%" }} contentFit="cover" />
          <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, flexDirection: "row", gap: 4, left: 10, paddingHorizontal: 8, paddingVertical: 4, position: "absolute", top: 10 }}>
            <MaterialCommunityIcons name="handshake-outline" size={12} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" }}>{translateCopy("Ortak Satışa", language)}</Text>
          </View>
          {listing.demo ? (
            <View style={{ backgroundColor: "#F5C518", borderRadius: 6, position: "absolute", right: 44, top: 12, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: "#1A1A00", fontSize: 9, fontWeight: "900" }}>{translateCopy("ÖRNEK", language)}</Text>
            </View>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityState={{ selected: favorited }} accessibilityLabel={favorited ? translateCopy("Favorilerden çıkar", language) : translateCopy("Favorilere ekle", language)} onPress={onFav} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, height: 30, justifyContent: "center", position: "absolute", right: 10, top: 10, width: 30 }}>
            <MaterialCommunityIcons name={favorited ? "heart" : "heart-outline"} size={17} color={favorited ? colors.accent : colors.muted} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Karşılaştır", language)} onPress={() => toggle(listing.id)} style={{ alignItems: "center", backgroundColor: inCompare ? colors.primary : "rgba(255,255,255,0.92)", borderRadius: 999, height: 30, justifyContent: "center", position: "absolute", right: 10, top: 46, width: 30 }}>
            <MaterialCommunityIcons name="compare-horizontal" size={16} color={inCompare ? "#FFFFFF" : colors.muted} />
          </Pressable>
          {isNew && !listing.demo ? (
            <View style={{ backgroundColor: colors.info, borderRadius: 6, bottom: 10, left: 10, paddingHorizontal: 7, paddingVertical: 2, position: "absolute" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 9.5, fontWeight: "900" }}>{translateCopy("YENİ", language)}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable onPress={onOpen} style={{ gap: 6, padding: 12 }}>
        <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 14, fontWeight: "800", lineHeight: 18, minHeight: 36 }}>{displayText(listing.title)}</Text>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "space-between" }}>
          <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "700" }}>{getCategoryShortLabel(listing.category)}</Text>
          {lowStock ? <Text style={{ color: colors.accent, fontSize: 10.5, fontWeight: "900" }}>{translateCopy("Son", language)} {listing.stockCount} {translateCopy("ürün", language)}</Text> : null}
        </View>
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "space-between" }}>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{moneyIn(listing.price, listing.currency)}</Text>
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "900" }}>{translateCopy("Kazanç", language)} {moneyIn(commission, listing.currency)}</Text>
          </View>
        </View>
        {listing.bonusAmount && listing.bonusAmount > 0 && listing.bonusQuota ? (
          <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.warningSoft, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
            <MaterialCommunityIcons name="rocket-launch" size={11} color={colors.warning} />
            <Text style={{ color: colors.warning, fontSize: 10, fontWeight: "900" }}>ilk {listing.bonusQuota} satışa +{moneyIn(listing.bonusAmount, listing.currency)}</Text>
          </View>
        ) : null}
        <View style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 5, marginTop: 4, paddingTop: 8 }}>
          <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.subtle} />
          <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "700" }}>{displayText(listing.location)}</Text>
          <MaterialCommunityIcons name={listing.partnershipMode === "open" ? "flash" : "handshake-outline"} size={12} color={colors.primary} />
          <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "800" }}>{listing.partnershipMode === "open" ? translateCopy("Anında ortak", language) : translateCopy("Ortaklığa açık", language)}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function SwitchRow({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <View style={{ alignItems: on ? "flex-end" : "flex-start", backgroundColor: on ? colors.primary : colors.line, borderRadius: 999, height: 22, justifyContent: "center", paddingHorizontal: 2, width: 38 }}>
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 18, width: 18 }} />
      </View>
      <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

