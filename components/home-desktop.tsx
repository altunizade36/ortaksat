import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { getCategoryIcon, getCategoryShortLabel } from "@/lib/categories";
import type { CategoryNode } from "@/lib/category-tree";
import { commissionAmount, moneyIn } from "@/lib/format";
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
  const [maxPrice, setMaxPrice] = useState<number>(0); // 0 = sınırsız
  const [trackW, setTrackW] = useState(1);
  const [conditions, setConditions] = useState<Record<string, boolean>>({});
  const [sellerTypes, setSellerTypes] = useState<Record<string, boolean>>({});
  const [locFilter, setLocFilter] = useState<string>("");

  const PRICE_CAP = 5_000_000;
  const locations = useMemo(() => Array.from(new Set(active.map((l) => l.location))).sort((a, b) => a.localeCompare(b, "tr")).slice(0, 40), [active]);

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
      if (maxPrice > 0 && l.price > maxPrice) return false;
      if (locFilter && l.location !== locFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, catLabelSet, maxPrice, locFilter]);

  const grid = useMemo(() => {
    return [...filtered].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 24);
  }, [filtered]);

  const topCats = categoryTree.filter((c) => c.label !== "Diğer");
  const popular = topCats.slice(0, 12);

  function setPriceFromTap(x: number) {
    const frac = Math.max(0, Math.min(1, x / trackW));
    setMaxPrice(frac >= 0.98 ? 0 : Math.round((frac * PRICE_CAP) / 1000) * 1000);
  }
  const priceFrac = maxPrice === 0 ? 1 : Math.min(1, maxPrice / PRICE_CAP);

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
            </View>
            <Pressable onPress={() => { setSelectedNode(null); setExpandedKey(null); setMaxPrice(0); setLocFilter(""); setConditions({}); setSellerTypes({}); }}>
              <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>Temizle</Text>
            </Pressable>
          </View>

          {/* Fiyat aralığı (dokun-ayarla slider) */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Fiyat Aralığı</Text>
            <Pressable onPress={(e) => setPriceFromTap(e.nativeEvent.locationX)} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)} style={{ justifyContent: "center", height: 22 }}>
              <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 5 }} />
              <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: 5, position: "absolute", width: `${priceFrac * 100}%` }} />
              <View style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 999, borderWidth: 3, height: 18, left: `${priceFrac * 100}%`, marginLeft: -9, position: "absolute", width: 18 }} />
            </Pressable>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>₺0</Text>
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{maxPrice === 0 ? "₺5.000.000+" : moneyIn(maxPrice, "TRY")}</Text>
            </View>
          </View>

          {/* Konum */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Konum</Text>
            <FilterDropdown value={locFilter || "Tüm Türkiye"} options={["Tüm Türkiye", ...locations]} onSelect={(v) => setLocFilter(v === "Tüm Türkiye" ? "" : v)} />
          </View>

          {/* Ürün Durumu (görsel filtre) */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Ürün Durumu</Text>
            {["Sıfır", "İkinci El", "Tertemiz"].map((c) => (
              <CheckRow key={c} label={c} on={!!conditions[c]} onPress={() => setConditions((s) => ({ ...s, [c]: !s[c] }))} />
            ))}
          </View>

          {/* Satıcı Tipi (görsel filtre) */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Satıcı Tipi</Text>
            {["Bireysel", "Kurumsal"].map((c) => (
              <CheckRow key={c} label={c} on={!!sellerTypes[c]} onPress={() => setSellerTypes((s) => ({ ...s, [c]: !s[c] }))} />
            ))}
          </View>

          <Pressable onPress={() => {}} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Sonuçları Göster ({filtered.length})</Text>
          </Pressable>
        </View>
      </View>

      {/* SAĞ: ana içerik */}
      <View style={{ flex: 1, gap: 18, minWidth: 0 }}>
        {/* Hero + istatistikler */}
        <View style={{ alignItems: "stretch", flexDirection: "row", gap: 16 }}>
          <View style={{ backgroundColor: colors.primary, borderRadius: 22, flex: 1, flexDirection: "row", minWidth: 0, overflow: "hidden", padding: 30 }}>
            <View style={{ flex: 1.3, gap: 14, justifyContent: "center", minWidth: 0 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 30, fontWeight: "900", lineHeight: 36 }}>
                Ortak alın,{"\n"}<Text style={{ color: colors.gold }}>kazancınızı katlayın!</Text>
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14.5, fontWeight: "600", lineHeight: 21, maxWidth: 460 }}>
                Binlerce ürünü ortak satın, komisyon kazan. Güvenli, hızlı ve kazançlı alışverişin adresi.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 2 }}>
                <Link href="/create" asChild>
                  <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 11, flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 13 }}>
                    <MaterialCommunityIcons name="store-plus-outline" size={18} color={colors.primaryDark} />
                    <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>İlan Ver</Text>
                  </Pressable>
                </Link>
                <Link href="/partner" asChild>
                  <Pressable style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.5)", borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 13 }}>
                    <MaterialCommunityIcons name="handshake-outline" size={18} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>Ortak Satışa Katıl</Text>
                  </Pressable>
                </Link>
              </View>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10, marginTop: 6 }}>
                <View style={{ flexDirection: "row" }}>
                  {["face1", "face2", "face3", "face4"].map((f, i) => (
                    <View key={f} style={{ borderColor: colors.primary, borderRadius: 999, borderWidth: 2, height: 28, marginLeft: i === 0 ? 0 : -9, overflow: "hidden", width: 28 }}>
                      <SafeRemoteImage uri={HERO(f)} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                    </View>
                  ))}
                </View>
                <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.9)", flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 16 }}>
                  Aracı platform · Şeffaf süreç{"\n"}Komisyonu taraflar belirler
                </Text>
              </View>
            </View>
            {/* Gerçek görsellerle illüstrasyon: yeşil daire + ortaklık fotoğrafı + ürünler */}
            <View style={{ alignItems: "center", flex: 1, justifyContent: "center", minHeight: 320, minWidth: 0, position: "relative" }}>
              {/* Yeşil daire arka plan */}
              <View style={{ backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 999, height: 236, position: "absolute", width: 236 }} />
              {/* Merkez: ortaklık fotoğrafı */}
              <View style={{ borderColor: "#FFFFFF", borderRadius: 22, borderWidth: 4, height: 186, overflow: "hidden", shadowColor: "#0A3D30", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 22, width: 200 }}>
                <SafeRemoteImage uri={HERO("people")} style={{ height: "100%", width: "100%" }} contentFit="cover" />
              </View>
              {/* Etrafında gerçek ürün fotoğrafları */}
              {HERO_FLOAT.map((f) => (
                <View key={f.img} style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 60, left: `${f.x}%`, marginLeft: -30, marginTop: -30, overflow: "hidden", position: "absolute", shadowColor: "#0A3D30", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12, top: `${f.y}%`, width: 60 }}>
                  <SafeRemoteImage uri={HERO(f.img)} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                </View>
              ))}
            </View>
          </View>

          {/* İstatistik kartları */}
          <View style={{ gap: 12, width: 210 }}>
            {stats.map((s) => (
              <View key={s.label} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flex: 1, flexDirection: "row", gap: 12, paddingHorizontal: 16 }}>
                <View style={{ alignItems: "center", backgroundColor: s.tint, borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}>
                  <MaterialCommunityIcons name={s.icon} size={21} color={s.color} />
                </View>
                <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 20, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{new Intl.NumberFormat("tr-TR").format(s.value)}</Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{s.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

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

        {/* Öne çıkan ilanlar */}
        <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>Öne Çıkan İlanlar</Text>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>En popüler ve yeni eklenen ilanlar</Text>
          </View>
          <Link href="/explore" asChild>
            <Pressable><Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>Tümünü Gör →</Text></Pressable>
          </Link>
        </View>

        {grid.length === 0 ? (
          <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 8, padding: 40 }}>
            <MaterialCommunityIcons name="magnify-close" size={30} color={colors.primary} />
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>Sonuç bulunamadı</Text>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Filtreleri değiştirerek tekrar dene.</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            {grid.map((l) => (
              <HomeCard key={l.id} listing={l} favorited={isFavorite(l.id)} onFav={() => toggleFavorite(l.id)} onOpen={() => router.push(`/listing/${l.id}`)} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function HomeCard({ listing, favorited, onFav, onOpen }: { listing: Listing; favorited: boolean; onFav: () => void; onOpen: () => void }) {
  const commission = commissionAmount(listing);
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
        </View>
      </Pressable>
      <Pressable onPress={onOpen} style={{ gap: 6, padding: 12 }}>
        <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 14, fontWeight: "800", lineHeight: 18, minHeight: 36 }}>{displayText(listing.title)}</Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{getCategoryShortLabel(listing.category)}</Text>
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "space-between" }}>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{moneyIn(listing.price, listing.currency)}</Text>
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "900" }}>Kazanç {moneyIn(commission, listing.currency)}</Text>
          </View>
        </View>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 6, marginTop: 2 }}>
          <View style={{ flexDirection: "row" }}>
            {["face1", "face2", "face3"].map((f, i) => (
              <View key={f} style={{ borderColor: colors.surface, borderRadius: 999, borderWidth: 1.5, height: 18, marginLeft: i === 0 ? 0 : -6, overflow: "hidden", width: 18 }}>
                <SafeRemoteImage uri={HERO(f)} style={{ height: "100%", width: "100%" }} contentFit="cover" />
              </View>
            ))}
          </View>
          <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.subtle} />
          <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "700" }}>{displayText(listing.location)}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function FilterDropdown({ value, options, onSelect }: { value: string; options: string[]; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ position: "relative", zIndex: open ? 50 : 1 }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: open ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 42, paddingHorizontal: 12 }}>
        <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{value}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 10, borderWidth: 1, maxHeight: 240, overflow: "hidden", position: "absolute", right: 0, left: 0, top: 46, zIndex: 50 }}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 240 }}>
            {options.map((o) => (
              <Pressable key={o} onPress={() => { onSelect(o); setOpen(false); }} style={({ pressed }) => ({ backgroundColor: pressed || o === value ? colors.surfaceAlt : "transparent", borderBottomColor: colors.line, borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 10 })}>
                <Text style={{ color: o === value ? colors.primaryDark : colors.ink, fontSize: 12.5, fontWeight: o === value ? "800" : "600" }}>{o}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
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
