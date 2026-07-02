import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { commissionAmount, moneyIn } from "@/lib/format";
import { useCompare } from "@/lib/compare";
import { getCategoryShortLabel } from "@/lib/categories";
import { useIsWideWeb } from "@/lib/layout";
import { displayText } from "@/lib/text";
import type { Listing } from "@/lib/types";
import { useStore } from "@/lib/use-store";

export function CompareBar() {
  const isWideWeb = useIsWideWeb();
  const router = useRouter();
  const { ids, remove, clear } = useCompare();
  const { listings } = useStore();
  const [open, setOpen] = useState(false);

  const items = ids.map((id) => listings.find((l) => l.id === id)).filter((l): l is Listing => !!l);
  if (!isWideWeb || items.length === 0) return null;

  const rows: Array<{ label: string; get: (l: Listing) => string }> = [
    { label: "Fiyat", get: (l) => moneyIn(l.price, l.currency) },
    { label: "Ortak kazancı", get: (l) => moneyIn(commissionAmount(l), l.currency) },
    { label: "Komisyon", get: (l) => (l.commissionType === "rate" ? `%${l.commissionValue}` : moneyIn(l.commissionValue, l.currency)) },
    { label: "Kategori", get: (l) => getCategoryShortLabel(l.category) },
    { label: "Konum", get: (l) => displayText(l.location) },
    { label: "Stok", get: (l) => `${l.stockCount} adet` },
    { label: "Ortaklık", get: (l) => (l.partnershipMode === "open" ? "Anında" : l.partnershipMode === "approval" ? "Onaylı" : "Davetli") }
  ];

  return (
    <>
      {/* Yüzen bar */}
      <View pointerEvents="box-none" style={{ alignItems: "center", bottom: 18, left: 0, position: "absolute", right: 0, zIndex: 2000 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.ink, borderRadius: 999, flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 10, shadowColor: "#101828", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24 }}>
          <View style={{ flexDirection: "row" }}>
            {items.map((l, i) => (
              <View key={l.id} style={{ borderColor: colors.ink, borderRadius: 8, borderWidth: 2, height: 36, marginLeft: i === 0 ? 0 : -8, overflow: "hidden", width: 36 }}>
                <SafeRemoteImage uri={l.image} style={{ height: "100%", width: "100%" }} contentFit="cover" />
              </View>
            ))}
          </View>
          <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" }}>{items.length} ürün seçildi</Text>
          <Pressable onPress={() => setOpen(true)} disabled={items.length < 2} style={{ alignItems: "center", backgroundColor: items.length < 2 ? "rgba(255,255,255,0.25)" : colors.primary, borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 9 }}>
            <MaterialCommunityIcons name="compare-horizontal" size={16} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>Karşılaştır</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Karşılaştırmayı temizle" onPress={clear} hitSlop={8}>
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
              <Text style={{ color: colors.ink, flex: 1, fontSize: 17, fontWeight: "900" }}>Ürün Karşılaştırma</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Kapat" style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 34, justifyContent: "center", width: 34 }}>
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
                          <Pressable onPress={() => remove(l.id)} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, height: 24, justifyContent: "center", position: "absolute", right: 6, top: 6, width: 24 }}>
                            <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                          </Pressable>
                        </View>
                        <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 13, fontWeight: "800", lineHeight: 17, minHeight: 34 }}>{displayText(l.title)}</Text>
                        <Pressable onPress={() => { setOpen(false); router.push(`/listing/${l.id}`); }} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, paddingVertical: 7 }}>
                          <Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "900" }}>İlanı Aç</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                  {/* Özellik satırları */}
                  {rows.map((r, ri) => (
                    <View key={r.label} style={{ backgroundColor: ri % 2 === 0 ? colors.surfaceAlt : "transparent", borderRadius: 8, flexDirection: "row", marginTop: 6 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800", paddingHorizontal: 10, paddingVertical: 12, width: 128 }}>{r.label}</Text>
                      {items.map((l) => (
                        <Text key={l.id} numberOfLines={1} style={{ color: r.label === "Ortak kazancı" ? colors.primaryDark : colors.ink, fontSize: 13, fontWeight: r.label === "Fiyat" || r.label === "Ortak kazancı" ? "900" : "700", paddingHorizontal: 8, paddingVertical: 12, width: 190 }}>{r.get(l)}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
