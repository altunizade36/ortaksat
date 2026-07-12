import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter, type Href } from "expo-router";
import { memo, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { BrandFilter } from "@/components/brand-filter";
import { Mascot } from "@/components/brand/Mascot";
import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { useCompare } from "@/lib/compare";
import { getCategoryIcon, getCategoryShortLabel } from "@/lib/categories";
import { getFormSchema, resolveFormKey, type CategoryNode, type FieldDef } from "@/lib/category-tree";
import { LocationSelector, type LocationValue } from "@/components/location-selector";
import { NUM_RANGE_FILTERS } from "@/lib/filter-fields";
import { matchesLocationFilter } from "@/lib/locations";
import { commissionAmount, moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { MarketplaceRetry } from "@/components/marketplace-retry";
import { Skeleton } from "@/components/skeleton";
import { getRecent } from "@/lib/recent";
import { displayText } from "@/lib/text";
import type { Listing } from "@/lib/types";
import { useStore } from "@/lib/use-store";


// Bir kategori düğümünün tüm alt etiketleri (hiyerarşik filtre için).
function descendantLabels(node: CategoryNode, out: string[] = []): string[] {
  out.push(node.label);
  for (const ch of node.children ?? []) descendantLabels(ch, out);
  return out;
}

export function HomeDesktop() {
  const { language } = useLanguage();
  const router = useRouter();
  const { categoryTree, listings, isFavorite, toggleFavorite, marketplaceInitialLoading, marketplaceLoadFailed, retryMarketplace } = useStore();

  const active = useMemo(() => listings.filter((l) => l.status === "active"), [listings]);
  // Filtreler
  const [selectedNode, setSelectedNode] = useState<CategoryNode | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  // Konum: eskiden yalnız MEVCUT ilanlarda geçen şehirlerden (en fazla 60) seçilebiliyordu
  // ve ilçe yoktu. Artık tüm 81 il + ilçe seçilebilir (keşfet/kategori ile aynı seçici).
  const [loc, setLoc] = useState<LocationValue>({});
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [minCommission, setMinCommission] = useState(0);
  const [inStock, setInStock] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  // Kategori-özel facet (Yakıt/Isıtma/İç Özellik…) + sayısal aralık (m²/km/yıl…) — Keşfet paritesi.
  const [attrFilters, setAttrFilters] = useState<Record<string, string[]>>({});
  const [numRange, setNumRange] = useState<Record<string, { min: string; max: string }>>({});
  const [sortMode, setSortMode] = useState<"featured" | "newest" | "priceAsc" | "priceDesc" | "commission">("featured");
  const [visibleCount, setVisibleCount] = useState(18);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => { setRecentIds(getRecent()); }, []);
  const recentListings = useMemo(() => recentIds.map((id) => listings.find((l) => l.id === id)).filter((l): l is Listing => !!l && l.status === "active").slice(0, 8), [recentIds, listings]);

  const pMin = Number(priceMin.replace(/[^\d]/g, "")) || 0;
  const pMax = Number(priceMax.replace(/[^\d]/g, "")) || 0;

  // Seçili kategorinin (ve tüm alt kategorilerinin) etiket kümesi.
  const catLabelSet = useMemo(() => (selectedNode ? new Set(descendantLabels(selectedNode).map((s) => s.toLocaleLowerCase("tr-TR"))) : null), [selectedNode]);

  // Kategori-özel filtre: seçili düğümün şemasından facet + sayısal alanlar (Keşfet ile aynı mantık).
  const catSchema = useMemo(() => (selectedNode ? getFormSchema(resolveFormKey([selectedNode])) : undefined), [selectedNode]);
  const catFacets = useMemo<FieldDef[]>(() => (catSchema ? catSchema.fields.filter((f) => {
    const n = f.options?.length ?? 0;
    if (f.key === "seller") return false;
    if (f.key === "brand" && f.type === "select" && n > 16) return false; // marka ayrı aranabilir filtreye
    if (f.type === "select") return n >= 2 && n <= 80;
    if (f.type === "multiselect") return n >= 2 && n <= 80;
    return false;
  }) : []), [catSchema]);
  const catBrandField = useMemo<FieldDef | undefined>(() => (catSchema ? catSchema.fields.find((f) => f.key === "brand" && f.type === "select" && (f.options?.length ?? 0) > 16) : undefined), [catSchema]);
  const catNums = useMemo(() => {
    if (!catSchema) return [] as Array<{ key: string; label: string; suffix?: string }>;
    const keys = new Set(catSchema.fields.map((f) => f.key));
    const seen = new Set<string>();
    return NUM_RANGE_FILTERS.filter((f) => keys.has(f.key) && !seen.has(f.label) && (seen.add(f.label), true));
  }, [catSchema]);
  const toggleAttr = (key: string, val: string) => setAttrFilters((s) => { const cur = s[key] ?? []; const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]; const copy = { ...s }; if (next.length) copy[key] = next; else delete copy[key]; return copy; });
  const setNum = (key: string, side: "min" | "max", v: string) => setNumRange((s) => ({ ...s, [key]: { min: s[key]?.min ?? "", max: s[key]?.max ?? "", [side]: v } }));
  // Kategori değişince facet/sayısal seçimler kategoriye özel olduğundan sıfırlanır.
  useEffect(() => { setAttrFilters({}); setNumRange({}); }, [selectedNode?.key]);
  const matchesCat = (l: Listing) => {
    if (!catLabelSet) return true;
    const c = l.category.toLocaleLowerCase("tr-TR").trim();
    const short = getCategoryShortLabel(l.category).toLocaleLowerCase("tr-TR").trim();
    if (catLabelSet.has(c) || catLabelSet.has(short)) return true;
    // explore/kategori yüzeyleriyle aynı bulanık eşleşme (yüzeyler arası tutarlılık):
    // önceden home tam-eşitlik yapıp aynı ilanları gizleyebiliyordu.
    return [...catLabelSet].some((label) => c === label || c.includes(label) || label.includes(c));
  };

  const filtered = useMemo(() => {
    return active.filter((l) => {
      if (!matchesCat(l)) return false;
      if (pMin && l.price < pMin) return false;
      if (pMax && l.price > pMax) return false;
      if (!matchesLocationFilter(l, loc.provinceId, loc.districtId)) return false;
      if (onlyOpen && l.partnershipMode !== "open") return false;
      if (onlyFeatured && !l.featured) return false;
      if (minCommission && commissionAmount(l) < minCommission) return false;
      if (inStock && l.stockCount <= 0) return false;
      if (onlyNew && !(Date.parse(l.createdAt ?? "") > Date.now() - 7 * 86400000)) return false;
      // Kategori-özel facet eşleşmesi (Yakıt=Dizel…): ilan attribute'u seçili değerlerden biriyse geçer.
      for (const key of Object.keys(attrFilters)) {
        const want = attrFilters[key];
        const have = l.attributes?.[key];
        const ok = Array.isArray(have) ? have.some((v) => want.includes(String(v))) : want.includes(String(have ?? ""));
        if (!ok) return false;
      }
      // Sayısal aralık (m²/km/yıl…): değer yoksa eler; değer=0 geçerlidir ("yok" ≠ "0").
      for (const nf of catNums) {
        const r = numRange[nf.key];
        const mn = r?.min?.trim() ? Number(r.min) : null;
        const mx = r?.max?.trim() ? Number(r.max) : null;
        if (mn === null && mx === null) continue;
        const raw = l.attributes?.[nf.key] ?? (nf.key === "grossM2" ? l.attributes?.m2 : undefined);
        if (raw === undefined || raw === null || raw === "") return false;
        const val = Number(raw);
        if (!Number.isFinite(val)) return false;
        if (mn !== null && val < mn) return false;
        if (mx !== null && val > mx) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, catLabelSet, pMin, pMax, loc.provinceId, loc.districtId, onlyOpen, onlyFeatured, minCommission, inStock, onlyNew, attrFilters, numRange, catNums]);

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
  useEffect(() => { setVisibleCount(18); }, [selectedNode, pMin, pMax, loc.provinceId, loc.districtId, onlyOpen, onlyFeatured, minCommission, inStock, onlyNew, sortMode, attrFilters, numRange]);

  const topCats = categoryTree.filter((c) => c.label !== "Diğer");
  const popular = topCats.slice(0, 12);
  // Ortak-satış modeli: en çok kazandıran (en yüksek komisyonlu) fırsatlar.
  const topEarn = useMemo(() => [...active].filter((l) => commissionAmount(l) > 0).sort((a, b) => commissionAmount(b) - commissionAmount(a)).slice(0, 10), [active]);
  const activeFilterCount = (selectedNode ? 1 : 0) + (pMin || pMax ? 1 : 0) + (loc.provinceId != null ? 1 : 0) + (onlyOpen ? 1 : 0) + (onlyFeatured ? 1 : 0) + (minCommission ? 1 : 0) + (inStock ? 1 : 0) + (onlyNew ? 1 : 0) + Object.keys(attrFilters).length + Object.keys(numRange).length;
  const resetFilters = () => { setSelectedNode(null); setExpandedKey(null); setPriceMin(""); setPriceMax(""); setLoc({}); setOnlyOpen(false); setOnlyFeatured(false); setMinCommission(0); setInStock(false); setOnlyNew(false); setAttrFilters({}); setNumRange({}); };
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

          {/* Konum: tüm 81 il + ilçe (keşfet/kategori ile aynı LocationSelector) */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Konum (İl / İlçe)", language)}</Text>
            <LocationSelector mode="filter" showNeighborhood={false} value={loc} onChange={setLoc} />
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

          {/* Kategori-özel filtreler (Keşfet paritesi): kategori seçilince şemasından
              sayısal aralık (m²/km/yıl…) + facet (Yakıt/Isıtma/İç Özellik…) gelir. */}
          {!selectedNode ? (
            <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 11, paddingVertical: 9 }}>
              <MaterialCommunityIcons name="filter-plus-outline" size={15} color={colors.muted} />
              <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "700" }}>{translateCopy("Detaylı filtreler için soldan kategori seçin", language)}</Text>
            </View>
          ) : (catNums.length > 0 || catFacets.length > 0 || catBrandField) ? (
            <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 12, paddingTop: 12 }}>
              <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>{translateCopy(selectedNode.label, language)} {translateCopy("özellikleri", language)}</Text>
              {catBrandField ? (
                <BrandFilter label={catBrandField.label} options={catBrandField.options ?? []} selected={attrFilters.brand ?? []} onToggle={(b) => toggleAttr("brand", b)} language={language} />
              ) : null}
              {catNums.map((nf) => (
                <View key={nf.key} style={{ gap: 5 }}>
                  <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{translateCopy(nf.label, language)}{nf.suffix ? ` (${nf.suffix})` : ""}</Text>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                    <TextInput value={numRange[nf.key]?.min ?? ""} onChangeText={(v) => setNum(nf.key, "min", v)} keyboardType="numeric" placeholder={translateCopy("En az", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 9, borderWidth: 1, color: colors.ink, flexBasis: 0, flexGrow: 1, fontSize: 12.5, minHeight: 38, minWidth: 0, paddingHorizontal: 8, textAlign: "center" }} />
                    <Text style={{ color: colors.subtle }}>—</Text>
                    <TextInput value={numRange[nf.key]?.max ?? ""} onChangeText={(v) => setNum(nf.key, "max", v)} keyboardType="numeric" placeholder={translateCopy("En çok", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 9, borderWidth: 1, color: colors.ink, flexBasis: 0, flexGrow: 1, fontSize: 12.5, minHeight: 38, minWidth: 0, paddingHorizontal: 8, textAlign: "center" }} />
                  </View>
                </View>
              ))}
              {catFacets.map((f) => {
                const opts = f.options ?? [];
                const selected = attrFilters[f.key] ?? [];
                // Çok seçenekli facet (İç Özellikler, Muhit, renk…) → aranabilir kutu; azsa çip.
                if (opts.length > 12) {
                  return <BrandFilter key={f.key} label={f.label} options={opts} selected={selected} onToggle={(v) => toggleAttr(f.key, v)} language={language} />;
                }
                return (
                  <View key={f.key} style={{ gap: 5 }}>
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{translateCopy(f.label, language)}{selected.length ? ` · ${selected.length}` : ""}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                      {opts.map((opt) => {
                        const on = selected.includes(opt);
                        return (
                          <Pressable key={opt} onPress={() => toggleAttr(f.key, opt)} style={{ backgroundColor: on ? colors.primarySoft : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 }}>
                            <Text style={{ color: on ? colors.primaryDark : colors.ink, fontSize: 11, fontWeight: "800" }}>{translateCopy(opt, language)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, paddingVertical: 11 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{filtered.length} {translateCopy("sonuç bulundu", language)}</Text>
          </View>
        </View>
      </View>

      {/* SAĞ: ana içerik */}
      <View style={{ flex: 1, gap: 18, minWidth: 0 }}>
        {/* Hero + istatistikler */}
        <View style={{ alignItems: "stretch", flexDirection: "row", gap: 16 }}>
          <LinearGradient colors={["#14B8C4", "#0EA5B7", "#0891B2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, flex: 1, flexDirection: "row", minWidth: 0, overflow: "hidden", paddingHorizontal: 22, paddingVertical: 18 }}>
            <View style={{ flex: 1.5, gap: 11, justifyContent: "center", minWidth: 0 }}>
              <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: "#FFFFFF", fontSize: 21, fontWeight: "900", lineHeight: 26 }}>
                {translateCopy("Ortak satış pazaryeri — ", language)}<Text style={{ color: colors.gold }}>{translateCopy("iki taraf da kazanır", language)}</Text>
              </Text>
              {/* İKİ AYRI KULLANICI YOLU (satıcı / ortak) — mesaj netliği */}
              <Link href="/create" asChild>
                <Pressable style={({ pressed }) => ({ backgroundColor: "#FFFFFF", borderRadius: 12, gap: 3, opacity: pressed ? 0.92 : 1, paddingHorizontal: 14, paddingVertical: 11 })}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                    <MaterialCommunityIcons name="store-plus-outline" size={16} color={colors.primaryDark} />
                    <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Satıcıyım · Ürünümü Ortak Satışa Aç", language)}</Text>
                    <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primaryDark} />
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 15 }}>{translateCopy("Ürününü ortaklarla daha geniş kitleye ulaştır; yalnızca sonuç aldığında belirlediğin komisyonu öde.", language)}</Text>
                </Pressable>
              </Link>
              <Link href="/partner" asChild>
                <Pressable style={({ pressed }) => ({ backgroundColor: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.45)", borderRadius: 12, borderWidth: 1, gap: 3, opacity: pressed ? 0.92 : 1, paddingHorizontal: 14, paddingVertical: 11 })}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                    <MaterialCommunityIcons name="handshake-outline" size={16} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", flex: 1, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Ortağım · Kazanç Fırsatlarını İncele", language)}</Text>
                    <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11.5, fontWeight: "600", lineHeight: 15 }}>{translateCopy("Ürünleri paylaş; doğrulanan satış veya taleplerden komisyon kazan. Sermaye ve stok gerekmez.", language)}</Text>
                </Pressable>
              </Link>
            </View>
            {/* OrtakSat maskotu (başparmak yukarı) — açık daire arkalıkta, tam gövde önde. */}
            <View style={{ alignItems: "center", alignSelf: "center", flex: 0.9, justifyContent: "center", minHeight: 210, minWidth: 0, position: "relative", width: "100%" }}>
              <Mascot name="success" size={228} priority panel panelColor="#F0FDFF" />
            </View>
          </LinearGradient>

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
        ) : grid.length === 0 && active.length === 0 && marketplaceLoadFailed ? (
          // Yükleme başarısız → "Henüz ilan yok" YERİNE yeniden-dene (yanıltıcı olmasın).
          <MarketplaceRetry onRetry={retryMarketplace} />
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

function HomeCardBase({ listing, favorited, onFav, onOpen }: { listing: Listing; favorited: boolean; onFav: () => void; onOpen: () => void }) {
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
        <View style={{ backgroundColor: colors.surfaceAlt, height: 150, width: "100%" }}>
          <SafeRemoteImage uri={listing.image} alt={`${listing.title} — ${listing.category} · OrtakSat ilanı`} accessibilityLabel={listing.title} style={{ height: 150, width: "100%" }} contentFit="cover" />
          <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, flexDirection: "row", gap: 4, left: 10, paddingHorizontal: 8, paddingVertical: 4, position: "absolute", top: 10 }}>
            <MaterialCommunityIcons name="handshake-outline" size={12} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" }}>{translateCopy("Ortak Satışa", language)}</Text>
          </View>
          {listing.demo ? (
            <View style={{ alignItems: "center", backgroundColor: "rgba(245,197,24,0.96)", borderRadius: 999, bottom: 10, flexDirection: "row", gap: 3, paddingHorizontal: 8, paddingVertical: 3, position: "absolute", right: 10, shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3 }}>
              <MaterialCommunityIcons name="eye-outline" size={10} color="#1A1A00" />
              <Text style={{ color: "#1A1A00", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.4 }}>{translateCopy("ÖRNEK", language)}</Text>
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

// Grid'de ~90 kart; parent (mesaj/favori/loading gibi) re-render'larında hepsi
// boşuna render olmasın. Yalnız listing kimliği veya favori durumu değişince
// render et. onFav/onOpen kimliği yok sayılır (davranışsal olarak sabit: id'ye
// göre favori toggle / ilana git).
const HomeCard = memo(HomeCardBase, (a, b) => a.listing === b.listing && a.favorited === b.favorited);

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

