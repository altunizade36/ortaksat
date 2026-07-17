import { MaterialCommunityIcons } from "@/components/icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { commissionAmount, moneyIn } from "@/lib/format";
import { FIELD_LABELS } from "@/lib/category-tree";
import { useCompare } from "@/lib/compare";
import { getCategoryShortLabel } from "@/lib/categories";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { fetchListingsByIds } from "@/lib/supabase-data";
import { displayText } from "@/lib/text";
import type { Listing, User } from "@/lib/types";
import { useStore } from "@/lib/use-store";

export function CompareBar() {
  const isWideWeb = useIsWideWeb();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const router = useRouter();
  const { ids, remove, clear } = useCompare();
  const { listings, findUser } = useStore();
  const [open, setOpen] = useState(false);

  // Sunucu-arama sonucu / uzaktan getirilen ilanlar bellek penceresinde (listings)
  // olmayabilir → karşılaştırmaya eklenen id çözülemeyip DÜŞÜYORDU (hiçbiri çözülmezse
  // çubuk hiç görünmüyordu). favorites/following gibi eksikleri sunucudan getir.
  const [fetched, setFetched] = useState<Listing[]>([]);
  const [fetchedUsers, setFetchedUsers] = useState<User[]>([]);
  const attemptedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const missing = ids.filter((id) => !listings.some((l) => l.id === id) && !attemptedRef.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => attemptedRef.current.add(id)); // tek-sefer dene (silinmiş ilanda döngü olmasın)
    void fetchListingsByIds(missing).then((res) => {
      if (res?.listings?.length) setFetched((prev) => [...prev.filter((p) => !res.listings.some((n) => n.id === p.id)), ...res.listings]);
      if (res?.users?.length) setFetchedUsers((prev) => [...prev.filter((p) => !res.users.some((n) => n.id === p.id)), ...res.users]);
    });
  }, [ids, listings]);

  const resolveListing = (id: string) => listings.find((l) => l.id === id) ?? fetched.find((l) => l.id === id);
  const owner = (ownerId: string) => findUser(ownerId) ?? fetchedUsers.find((u) => u.id === ownerId);
  const items = ids.map(resolveListing).filter((l): l is Listing => !!l);
  if (items.length === 0) return null;

  // num + dir olan satırlarda en iyi değer vurgulanır (en düşük fiyat / en yüksek kazanç…).
  type Row = { label: string; get: (l: Listing) => string; num?: (l: Listing) => number; dir?: "min" | "max"; multiline?: boolean };
  const rows: Row[] = [
    { label: "Fiyat", get: (l) => moneyIn(l.price, l.currency), num: (l) => l.price, dir: "min" },
    { label: "Ortak kazancı", get: (l) => moneyIn(commissionAmount(l), l.currency), num: (l) => commissionAmount(l), dir: "max" },
    { label: "Komisyon", get: (l) => (l.commissionType === "rate" ? `%${l.commissionValue}` : moneyIn(l.commissionValue, l.currency)), num: (l) => (l.commissionType === "rate" ? l.commissionValue : commissionAmount(l)), dir: "max" },
    { label: "Bonus", get: (l) => (l.bonusAmount ? `${moneyIn(l.bonusAmount, l.currency)}${l.bonusQuota ? ` · ${l.bonusQuota} adet` : ""}` : "—"), num: (l) => l.bonusAmount ?? 0, dir: "max" },
    { label: "Satıcı puanı", get: (l) => { const o = owner(l.ownerId); return o?.rating ? `${o.rating.toFixed(1)} ★` : translateCopy("Yeni", language); }, num: (l) => owner(l.ownerId)?.rating ?? 0, dir: "max" },
    { label: "Kategori", get: (l) => getCategoryShortLabel(l.category) },
    { label: "Konum", get: (l) => displayText(l.location) },
    { label: "Ortaklık", get: (l) => (l.partnershipMode === "open" ? translateCopy("Anında", language) : l.partnershipMode === "approval" ? translateCopy("Onaylı", language) : translateCopy("Davetli", language)) }
  ];

  // Yapısal kategori özelliklerini (emlak: m²/oda/kat/ısıtma/aidat…) da karşılaştır
  // (spec 76). İlanlarda bulunan tüm attribute anahtarlarının birleşimi satır olur.
  const NUMERIC_ATTR: Record<string, "min" | "max"> = { grossM2: "max", netM2: "max", m2: "max", rooms: "max", dues: "min", deposit: "min", rentalIncome: "max", bathrooms: "max", floorCount: "max" };
  const attrKeys: string[] = [];
  for (const l of items) {
    for (const k of Object.keys(l.attributes ?? {})) {
      if (k.startsWith("_") || k === "listingType" || attrKeys.includes(k)) continue;
      attrKeys.push(k);
    }
  }
  const fmt = (v: string | number | boolean | string[] | undefined, suffix?: string) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return "—";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "boolean") return v ? translateCopy("Evet", language) : translateCopy("Hayır", language);
    return `${v}${suffix ? " " + suffix : ""}`;
  };
  const attrRows: Row[] = attrKeys.map((k) => {
    const def = FIELD_LABELS[k];
    const dir = NUMERIC_ATTR[k];
    return {
      label: def?.label ?? k,
      get: (l: Listing) => fmt(l.attributes?.[k], def?.suffix),
      multiline: true,
      ...(dir ? { num: (l: Listing) => Number(l.attributes?.[k] ?? 0) || 0, dir } : {})
    };
  });
  const allRows = [...rows, ...attrRows];

  return (
    <>
      {/* Yüzen bar */}
      {/* Alt boşluk 3 durumlu: geniş web (bar yok) · mobil WEB (tab bar `display:none` →
          92px ölü boşluktu) · NATIVE (tab bar: bottom=max(insets,12), height=70 → üstünde dur). */}
      <View pointerEvents="box-none" style={{ alignItems: "center", bottom: isWideWeb ? 18 : Platform.OS === "web" ? 18 : Math.max(insets.bottom, 12) + 80, left: 0, paddingHorizontal: 12, position: "absolute", right: 0, zIndex: 2000 }}>
        {/* maxWidth + çocukların flexShrink'i ŞART: RNW'de View varsayılanı flexShrink:0 →
            bar genişliği çocukların TOPLAMI oluyordu (~334-430px) ve 320-390px ekranda
            taşıp TÜM SAYFAYI yana kaydırıyordu (html'de overflow-x:hidden yok). */}
        <View style={{ alignItems: "center", backgroundColor: colors.ink, borderRadius: 999, flexDirection: "row", gap: 12, maxWidth: "100%", paddingHorizontal: 14, paddingVertical: 10, shadowColor: "#101828", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24 }}>
          <View style={{ flexDirection: "row", flexShrink: 0 }}>
            {items.map((l, i) => (
              <View key={l.id} style={{ borderColor: colors.ink, borderRadius: 8, borderWidth: 2, height: 36, marginLeft: i === 0 ? 0 : -8, overflow: "hidden", width: 36 }}>
                <SafeRemoteImage uri={l.image} style={{ height: "100%", width: "100%" }} contentFit="cover" />
              </View>
            ))}
          </View>
          {/* Etiket daralmayı ÜSTLENİR (flexShrink:1 + tek satır) → dar ekranda buton ve
              kapatma X'i asla taşmaz/kırpılmaz. */}
          <Text numberOfLines={1} style={{ color: "#FFFFFF", flexShrink: 1, fontSize: 12.5, fontWeight: "800", minWidth: 0 }}>{items.length < 2 ? translateCopy("1 ürün · 1 daha seç", language) : `${items.length} ${translateCopy("ürün seçildi", language)}`}</Text>
          <Pressable onPress={() => setOpen(true)} disabled={items.length < 2} accessibilityRole="button" accessibilityState={{ disabled: items.length < 2 }} accessibilityLabel={items.length < 2 ? translateCopy("Karşılaştırmak için en az 2 ürün seçin", language) : translateCopy("Seçili ürünleri karşılaştır", language)} style={{ alignItems: "center", backgroundColor: items.length < 2 ? "rgba(255,255,255,0.25)" : colors.primary, borderRadius: 999, flexDirection: "row", flexShrink: 0, gap: 6, paddingHorizontal: 16, paddingVertical: 9 }}>
            <MaterialCommunityIcons name="compare-horizontal" size={16} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>{translateCopy("Karşılaştır", language)}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Karşılaştırmayı temizle", language)} onPress={clear} hitSlop={8} style={{ flexShrink: 0 }}>
            <MaterialCommunityIcons name="close" size={18} color="rgba(255,255,255,0.75)" />
          </Pressable>
        </View>
      </View>

      {/* Karşılaştırma modalı */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ alignItems: "center", backgroundColor: "rgba(16,24,40,0.55)", flex: 1, justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 18, maxHeight: "90%", maxWidth: 980, overflow: "hidden", width: "100%" }}>
            <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingVertical: 15 }}>
              <MaterialCommunityIcons name="compare-horizontal" size={20} color={colors.primaryDark} />
              <Text style={{ color: colors.ink, flex: 1, fontSize: 17, fontWeight: "900" }}>{translateCopy("Ürün Karşılaştırma", language)}</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={translateCopy("Kapat", language)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 34, justifyContent: "center", width: 34 }}>
                <MaterialCommunityIcons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView>
              <ScrollView horizontal contentContainerStyle={{ padding: 16 }}>
                <View style={{ gap: 0 }}>
                  {/* Ürün başlıkları */}
                  <View style={{ flexDirection: "row" }}>
                    <View style={{ width: 128 }} />
                    {items.map((l) => (
                      <View key={l.id} style={{ gap: 6, paddingHorizontal: 8, width: 190 }}>
                        <View style={{ backgroundColor: colors.line, borderRadius: 12, height: 120, overflow: "hidden", width: "100%" }}>
                          <SafeRemoteImage uri={l.image} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                          <Pressable onPress={() => remove(l.id)} accessibilityRole="button" accessibilityLabel={translateCopy("Karşılaştırmadan çıkar", language)} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, height: 24, justifyContent: "center", position: "absolute", right: 6, top: 6, width: 24 }}>
                            <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                          </Pressable>
                        </View>
                        <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 13, fontWeight: "800", lineHeight: 17, minHeight: 34 }}>{displayText(l.title)}</Text>
                        <Pressable onPress={() => { setOpen(false); router.push(`/listing/${l.id}`); }} accessibilityRole="button" accessibilityLabel={`${displayText(l.title)} ${translateCopy("ilanını aç", language)}`} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, paddingVertical: 7 }}>
                          <Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "900" }}>{translateCopy("İlanı Aç", language)}</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                  {/* Özellik satırları (genel + yapısal kategori özellikleri) */}
                  {allRows.map((r, ri) => {
                    let best: number | null = null;
                    if (r.num && r.dir && items.length > 1) {
                      const vals = items.map(r.num);
                      if (new Set(vals).size > 1) best = r.dir === "min" ? Math.min(...vals) : Math.max(...vals);
                    }
                    return (
                      <View key={r.label} style={{ backgroundColor: ri % 2 === 0 ? colors.surfaceAlt : "transparent", borderRadius: 8, flexDirection: "row", marginTop: 6 }}>
                        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800", paddingHorizontal: 10, paddingVertical: 12, width: 128 }}>{translateCopy(r.label, language)}</Text>
                        {items.map((l) => {
                          const isBest = best !== null && r.num!(l) === best;
                          return (
                            <View key={l.id} style={{ alignItems: "flex-start", flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 12, width: 190 }}>
                              <Text numberOfLines={r.multiline ? 5 : 1} style={{ color: isBest || r.label === "Ortak kazancı" ? colors.primaryDark : colors.ink, flex: 1, fontSize: r.multiline ? 12 : 13, fontWeight: isBest || r.label === "Fiyat" || r.label === "Ortak kazancı" ? "900" : "700", lineHeight: r.multiline ? 16 : undefined }}>{r.get(l)}</Text>
                              {isBest ? <MaterialCommunityIcons name="check-circle" size={13} color={colors.primary} /> : null}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
