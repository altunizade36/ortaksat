import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { useCompare } from "@/lib/compare";
import { getCategoryIcon, getCategoryShortLabel } from "@/lib/categories";
import type { CategoryNode } from "@/lib/category-tree";
import { commissionAmount, moneyIn } from "@/lib/format";
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
const HERO = (n: string) => `https://ortaksat.com/hero/${n}.jpg`;
const HERO_FLOAT: Array<{ img: string; x: number; y: number }> = [
  { img: "headphones", x: 15, y: 13 },
  { img: "laptop", x: 83, y: 9 },
  { img: "camera", x: 94, y: 45 },
  { img: "watch", x: 6, y: 44 },
  { img: "plant", x: 21, y: 88 },
  { img: "chair", x: 85, y: 85 }
];

export function HomeDesktop() {
  const router = useRouter();
  const { categoryTree, listings, isFavorite, toggleFavorite } = useStore();

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
  const [conditions, setConditions] = useState<Record<string, boolean>>({});
  const [sellerTypes, setSellerTypes] = useState<Record<string, boolean>>({});
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
  const resetFilters = () => { setSelectedNode(null); setExpandedKey(null); setPriceMin(""); setPriceMax(""); setLocFilter(""); setConditions({}); setSellerTypes({}); setOnlyOpen(false); setOnlyFeatured(false); setMinCommission(0); setInStock(false); setOnlyNew(false); };
  const COMMISSION_PRESETS: Array<[number, string]> = [[500, "500 ₺+"], [1000, "1.000 ₺+"], [5000, "5.000 ₺+"], [25000, "25.000 ₺+"]];
  const PRICE_PRESETS: Array<[string, string, string]> = [["0", "1000", "0 - 1.000 ₺"], ["1000", "5000", "1.000 - 5.000 ₺"], ["5000", "25000", "5.000 - 25.000 ₺"], ["25000", "100000", "25.000 - 100.000 ₺"], ["100000", "", "100.000 ₺ +"]];
  const SORTS: Array<[typeof sortMode, string]> = [["featured", "Öne çıkanlar"], ["newest", "En yeni"], ["priceAsc", "Fiyat ↑"], ["priceDesc", "Fiyat ↓"], ["commission", "Kazanç"]];

  return (
    <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
      {/* SOL: kategori + filtre paneli */}
      <View style={{ gap: 14, width: 248 }}>
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 13 }}>
            <MaterialCommunityIcons name="view-grid-outline" size={18} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>Kategoriler</Text>
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
                    <Text numberOfLines={1} style={{ color: on ? colors.primaryDark : colors.ink, flex: 1, fontSize: 13, fontWeight: on ? "900" : "600" }}>{n.label}</Text>
                    {children.length ? <MaterialCommunityIcons name={expanded ? "chevron-down" : "chevron-right"} size={16} color={colors.subtle} /> : null}
                  </Pressable>
                  {expanded && children.length ? (
                    <View style={{ backgroundColor: colors.surfaceAlt, paddingVertical: 4 }}>
                      <Pressable onPress={() => setSelectedNode(n)} style={{ paddingHorizontal: 16, paddingLeft: 44, paddingVertical: 8 }}>
                        <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Tümü · {n.label}</Text>
                      </Pressable>
                      {children.map((ch) => {
                        const con = selectedNode?.key === ch.key;
                        return (
                          <Pressable key={ch.key} onPress={() => setSelectedNode(con ? n : ch)} style={{ paddingHorizontal: 16, paddingLeft: 44, paddingVertical: 8 }}>
                            <Text numberOfLines={1} style={{ color: con ? colors.primaryDark : colors.ink, fontSize: 12.5, fontWeight: con ? "800" : "600" }}>{ch.label}</Text>
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
                <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 13, fontWeight: "800" }}>Tüm Kategoriler</Text>
              </Pressable>
            </Link>
          </ScrollView>
        </View>

        {/* Filtre paneli */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
              <MaterialCommunityIcons name="tune-variant" size={16} color={colors.primaryDark} />
              <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>Filtrele</Text>
              {activeFilterCount > 0 ? <View style={{ backgroundColor: colors.primary, borderRadius: 999, minWidth: 18, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ color: "#FFFFFF", fontSize: 10.5, fontWeight: "900", textAlign: "center" }}>{activeFilterCount}</Text></View> : null}
            </View>
            <Pressable onPress={resetFilters}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>Temizle</Text></Pressable>
          </View>

          {/* Fiyat aralığı: min/max + hazır aralıklar */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Fiyat Aralığı (₺)</Text>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <TextInput value={priceMin} onChangeText={setPriceMin} keyboardType="numeric" placeholder="En az" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 9, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700", minHeight: 40, paddingHorizontal: 10, textAlign: "center" }} />
              <Text style={{ color: colors.subtle, fontSize: 13, fontWeight: "800" }}>—</Text>
              <TextInput value={priceMax} onChangeText={setPriceMax} keyboardType="numeric" placeholder="En çok" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 9, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700", minHeight: 40, paddingHorizontal: 10, textAlign: "center" }} />
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
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Konum</Text>
            <Pressable onPress={() => setLocOpen((o) => !o)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: locOpen ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 42, paddingHorizontal: 12 }}>
              <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.primary} />
              <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{locFilter || "Tüm Türkiye"}</Text>
              <MaterialCommunityIcons name={locOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
            </Pressable>
            {locOpen ? (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 10, borderWidth: 1, maxHeight: 220, overflow: "hidden" }}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                  {["Tüm Türkiye", ...locations].map((o) => {
                    const on = (locFilter || "Tüm Türkiye") === o;
                    return (
                      <Pressable key={o} onPress={() => { setLocFilter(o === "Tüm Türkiye" ? "" : o); setLocOpen(false); }} style={({ pressed }) => ({ backgroundColor: pressed || on ? colors.surfaceAlt : "transparent", borderBottomColor: colors.line, borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 9 })}>
                        <Text style={{ color: on ? colors.primaryDark : colors.ink, fontSize: 12.5, fontWeight: on ? "800" : "600" }}>{o}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
          </View>

          {/* Ortak kazancı (min komisyon) */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>En Az Ortak Kazancı</Text>
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
            <SwitchRow label="Sadece ortak satışa açık" on={onlyOpen} onPress={() => setOnlyOpen((v) => !v)} />
            <SwitchRow label="Öne çıkan ilanlar" on={onlyFeatured} onPress={() => setOnlyFeatured((v) => !v)} />
            <SwitchRow label="Stokta olanlar" on={inStock} onPress={() => setInStock((v) => !v)} />
            <SwitchRow label="Yeni ilanlar (7 gün)" on={onlyNew} onPress={() => setOnlyNew((v) => !v)} />
          </View>

          {/* Ürün Durumu */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Ürün Durumu</Text>
            {["Sıfır", "İkinci El", "Yenilenmiş"].map((c) => (
              <CheckRow key={c} label={c} on={!!conditions[c]} onPress={() => setConditions((s) => ({ ...s, [c]: !s[c] }))} />
            ))}
          </View>

          {/* Satıcı Tipi */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Satıcı Tipi</Text>
            {["Bireysel", "Kurumsal"].map((c) => (
              <CheckRow key={c} label={c} on={!!sellerTypes[c]} onPress={() => setSellerTypes((s) => ({ ...s, [c]: !s[c] }))} />
            ))}
          </View>

          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, paddingVertical: 11 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{filtered.length} sonuç bulundu</Text>
          </View>
        </View>
      </View>

      {/* SAĞ: ana içerik */}
      <View style={{ flex: 1, gap: 18, minWidth: 0 }}>
        {/* Hero + istatistikler */}
        <View style={{ alignItems: "stretch", flexDirection: "row", gap: 16 }}>
          <View style={{ backgroundColor: colors.primary, borderRadius: 18, flex: 1, flexDirection: "row", minWidth: 0, overflow: "hidden", paddingHorizontal: 22, paddingVertical: 18 }}>
            <View style={{ flex: 1.4, gap: 10, justifyContent: "center", minWidth: 0 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 21, fontWeight: "900", lineHeight: 26 }}>
                Ortak alın, <Text style={{ color: colors.gold }}>kazancınızı katlayın!</Text>
              </Text>
              <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.9)", fontSize: 12.5, fontWeight: "600", lineHeight: 17, maxWidth: 380 }}>
                Binlerce ürünü ortak sat, komisyon kazan. Güvenli, hızlı, kazançlı.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 2 }}>
                <Link href="/create" asChild>
                  <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 9 }}>
                    <MaterialCommunityIcons name="store-plus-outline" size={16} color={colors.primaryDark} />
                    <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>İlan Ver</Text>
                  </Pressable>
                </Link>
                <Link href="/partner" asChild>
                  <Pressable style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.5)", borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 8 }}>
                    <MaterialCommunityIcons name="handshake-outline" size={16} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Ortak Satışa Katıl</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
            {/* Kompakt görsel küme: yeşil daire + ortaklık fotoğrafı + ürünler */}
            <View style={{ alignItems: "center", flex: 0.9, justifyContent: "center", minHeight: 168, minWidth: 0, position: "relative" }}>
              <View style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, height: 150, position: "absolute", width: 150 }} />
              <View style={{ borderColor: "#FFFFFF", borderRadius: 16, borderWidth: 3, height: 116, overflow: "hidden", shadowColor: "#0A3D30", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.26, shadowRadius: 16, width: 132 }}>
                <SafeRemoteImage uri={HERO("people")} style={{ height: "100%", width: "100%" }} contentFit="cover" />
              </View>
              {HERO_FLOAT.map((f) => (
                <View key={f.img} style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 40, left: `${f.x}%`, marginLeft: -20, marginTop: -20, overflow: "hidden", position: "absolute", shadowColor: "#0A3D30", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, top: `${f.y}%`, width: 40 }}>
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
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>{s.label}</Text>
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
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "900" }}>En Çok Kazandıran Fırsatlar</Text>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.8)", fontSize: 11.5, fontWeight: "600" }}>Ortak ol, sat, komisyonu kazan — komisyonu satıcı öder.</Text>
              </View>
              <Link href="/partner" asChild>
                <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>Tümü</Text>
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
                      <Text style={{ color: "#1A1400", fontSize: 9.5, fontWeight: "900" }}>Kazanç {moneyIn(commissionAmount(l), l.currency)}</Text>
                    </View>
                  </View>
                  <View style={{ gap: 4, padding: 9 }}>
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{displayText(l.title)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{moneyIn(l.price, l.currency)}</Text>
                    <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, paddingVertical: 6 }}>
                      <Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "900" }}>Ortak Ol</Text>
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
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Son Gezdiklerin</Text>
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
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Popüler Kategoriler</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
            {popular.map((n) => {
              const on = selectedNode?.key === n.key;
              return (
                <Pressable key={n.key} onPress={() => { setSelectedNode(on ? null : n); setExpandedKey(on ? null : n.key); }} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 14, paddingVertical: 9 }}>
                  <MaterialCommunityIcons name={getCategoryIcon(n.label)} size={16} color={on ? "#FFFFFF" : colors.primary} />
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "800" }}>{n.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* İlanlar başlığı + sıralama */}
        <View style={{ gap: 10 }}>
          <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{selectedNode ? selectedNode.label : "Öne Çıkan İlanlar"}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{filtered.length} ilan listeleniyor</Text>
            </View>
            <Link href="/explore" asChild>
              <Pressable><Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>Tümünü Gör →</Text></Pressable>
            </Link>
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Sırala:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingRight: 12 }}>
              {SORTS.map(([key, lbl]) => {
                const on = sortMode === key;
                return (
                  <Pressable key={key} onPress={() => setSortMode(key)} style={{ backgroundColor: on ? colors.ink : colors.surface, borderColor: on ? colors.ink : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7 }}>
                    <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{lbl}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {grid.length === 0 ? (
          <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 8, padding: 40 }}>
            <MaterialCommunityIcons name="magnify-close" size={30} color={colors.primary} />
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>Sonuç bulunamadı</Text>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Filtreleri değiştirerek tekrar dene.</Text>
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
                <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>Daha fazla göster ({filtered.length - visibleCount})</Text>
              </Pressable>
            ) : (
              <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "700", textAlign: "center" }}>Tüm ilanları gördün · {filtered.length} ilan</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function HomeCard({ listing, favorited, onFav, onOpen }: { listing: Listing; favorited: boolean; onFav: () => void; onOpen: () => void }) {
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
            <Text style={{ color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" }}>Ortak Satışa</Text>
          </View>
          {listing.demo ? (
            <View style={{ backgroundColor: "#F5C518", borderRadius: 6, position: "absolute", right: 44, top: 12, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: "#1A1A00", fontSize: 9, fontWeight: "900" }}>ÖRNEK</Text>
            </View>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Favorilere ekle" onPress={onFav} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, height: 30, justifyContent: "center", position: "absolute", right: 10, top: 10, width: 30 }}>
            <MaterialCommunityIcons name={favorited ? "heart" : "heart-outline"} size={17} color={favorited ? colors.accent : colors.muted} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Karşılaştır" onPress={() => toggle(listing.id)} style={{ alignItems: "center", backgroundColor: inCompare ? colors.primary : "rgba(255,255,255,0.92)", borderRadius: 999, height: 30, justifyContent: "center", position: "absolute", right: 10, top: 46, width: 30 }}>
            <MaterialCommunityIcons name="compare-horizontal" size={16} color={inCompare ? "#FFFFFF" : colors.muted} />
          </Pressable>
          {isNew && !listing.demo ? (
            <View style={{ backgroundColor: colors.info, borderRadius: 6, bottom: 10, left: 10, paddingHorizontal: 7, paddingVertical: 2, position: "absolute" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 9.5, fontWeight: "900" }}>YENİ</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable onPress={onOpen} style={{ gap: 6, padding: 12 }}>
        <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 14, fontWeight: "800", lineHeight: 18, minHeight: 36 }}>{displayText(listing.title)}</Text>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "space-between" }}>
          <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "700" }}>{getCategoryShortLabel(listing.category)}</Text>
          {lowStock ? <Text style={{ color: colors.accent, fontSize: 10.5, fontWeight: "900" }}>Son {listing.stockCount} ürün</Text> : null}
        </View>
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "space-between" }}>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{moneyIn(listing.price, listing.currency)}</Text>
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "900" }}>Kazanç {moneyIn(commission, listing.currency)}</Text>
          </View>
        </View>
        <View style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 5, marginTop: 4, paddingTop: 8 }}>
          <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.subtle} />
          <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "700" }}>{displayText(listing.location)}</Text>
          <MaterialCommunityIcons name={listing.partnershipMode === "open" ? "flash" : "handshake-outline"} size={12} color={colors.primary} />
          <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "800" }}>{listing.partnershipMode === "open" ? "Anında ortak" : "Ortaklığa açık"}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function SwitchRow({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <View style={{ alignItems: on ? "flex-end" : "flex-start", backgroundColor: on ? colors.primary : colors.line, borderRadius: 999, height: 22, justifyContent: "center", paddingHorizontal: 2, width: 38 }}>
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 18, width: 18 }} />
      </View>
      <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function CheckRow({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
      <View style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 6, borderWidth: 1.5, height: 19, justifyContent: "center", width: 19 }}>
        {on ? <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" /> : null}
      </View>
      <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
