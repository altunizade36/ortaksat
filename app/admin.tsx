import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { AuthRequired } from "@/components/auth-gate";
import { EmptyState } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { categoryTree } from "@/lib/category-tree";
import { useIsWideWeb } from "@/lib/layout";
import { getDistrict, getProvince } from "@/lib/locations";
import type { SuggestionStatus } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type Tab = "category" | "location" | "manage";

const STATUS_TONE: Record<SuggestionStatus, { tint: string; color: string; label: string }> = {
  pending: { tint: colors.warningSoft, color: colors.warning, label: "İncelemede" },
  approved: { tint: colors.successSoft, color: colors.success, label: "Onaylandı" },
  rejected: { tint: colors.accentSoft, color: colors.accent, label: "Reddedildi" }
};

function AdminScreenInner() {
  const isWideWeb = useIsWideWeb();
  const { categorySuggestions, locationSuggestions, setCategorySuggestionStatus, setLocationSuggestionStatus, currentUser, listings } = useStore();
  const [tab, setTab] = useState<Tab>("category");
  const [expanded, setExpanded] = useState<string | null>(null);

  const isAdmin = currentUser.role === "admin" || currentUser.role === "moderator";
  const pendingCat = categorySuggestions.filter((s) => s.status === "pending").length;
  const pendingLoc = locationSuggestions.filter((s) => s.status === "pending").length;

  const counts: Record<string, number> = {};
  for (const l of listings) counts[l.category] = (counts[l.category] ?? 0) + 1;

  const tabs: Array<{ key: Tab; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; badge?: number }> = [
    { key: "category", icon: "shape-plus", label: "Kategori Önerileri", badge: pendingCat },
    { key: "location", icon: "map-marker-plus-outline", label: "Konum Önerileri", badge: pendingLoc },
    { key: "manage", icon: "folder-cog-outline", label: "Kategori Yönetimi" }
  ];

  const Body = (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 52, justifyContent: "center", width: 52 }}>
          <MaterialCommunityIcons name="shield-crown-outline" size={28} color={colors.primaryDark} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>Yönetim Paneli</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Kategori ve konum önerilerini incele, kategori yapısını yönet.</Text>
        </View>
      </View>

      {!isAdmin ? (
        <View style={{ alignItems: "center", backgroundColor: colors.warningSoft, borderRadius: 12, flexDirection: "row", gap: 10, padding: 12 }}>
          <MaterialCommunityIcons name="information-outline" size={18} color={colors.warning} />
          <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "600" }}>Önizleme: bu panel yalnızca admin/moderatör rolündeki hesaplarda canlıda görünür. Demo amaçlı tüm içerik gösteriliyor.</Text>
        </View>
      ) : null}

      {/* Stat cards */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        <AdminStat icon="shape-plus" tint={colors.violetSoft} color={colors.violet} value={`${pendingCat}`} title="Bekleyen kategori önerisi" />
        <AdminStat icon="map-marker-plus-outline" tint={colors.infoSoft} color={colors.info} value={`${pendingLoc}`} title="Bekleyen konum önerisi" />
        <AdminStat icon="shape-outline" tint={colors.primarySoft} color={colors.primaryDark} value={`${categoryTree.length}`} title="Ana kategori" />
        <AdminStat icon="tag-multiple-outline" tint={colors.goldSoft} color={colors.gold} value={`${listings.length}`} title="Toplam ilan" />
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 14, paddingVertical: 9 }}>
              <MaterialCommunityIcons name={t.icon} size={16} color={on ? "#FFFFFF" : colors.primaryDark} />
              <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "800" }}>{t.label}</Text>
              {t.badge ? <View style={{ alignItems: "center", backgroundColor: on ? "#FFFFFF" : colors.accent, borderRadius: 999, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 5 }}><Text style={{ color: on ? colors.primary : "#FFFFFF", fontSize: 10.5, fontWeight: "900" }}>{t.badge}</Text></View> : null}
            </Pressable>
          );
        })}
      </View>

      {/* Category suggestions */}
      {tab === "category" ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
          {categorySuggestions.length === 0 ? <View style={{ padding: 18 }}><EmptyState title="Öneri yok" body="Henüz kategori önerisi gelmedi." /></View> : null}
          {categorySuggestions.map((s, idx) => (
            <View key={s.id} style={{ borderTopColor: colors.line, borderTopWidth: idx === 0 ? 0 : 1, gap: 8, padding: 16 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                <MaterialCommunityIcons name="shape-plus" size={18} color={colors.violet} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "900" }}>{s.suggestedPath}</Text>
                <View style={{ backgroundColor: STATUS_TONE[s.status].tint, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ color: STATUS_TONE[s.status].color, fontSize: 10.5, fontWeight: "900" }}>{STATUS_TONE[s.status].label}</Text></View>
              </View>
              {s.note ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{s.note}</Text> : null}
              <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>{s.userName ?? "Kullanıcı"} · {s.createdAt}</Text>
              {s.status === "pending" ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={() => setCategorySuggestionStatus(s.id, "approved")} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 9, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}><MaterialCommunityIcons name="check" size={15} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" }}>Onayla & ekle</Text></Pressable>
                  <Pressable onPress={() => setCategorySuggestionStatus(s.id, "rejected")} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}><MaterialCommunityIcons name="close" size={15} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Reddet</Text></Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Location suggestions */}
      {tab === "location" ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
          {locationSuggestions.length === 0 ? <View style={{ padding: 18 }}><EmptyState title="Öneri yok" body="Henüz konum/mahalle önerisi gelmedi." /></View> : null}
          {locationSuggestions.map((s, idx) => {
            const prov = getProvince(s.provinceId)?.name;
            const dist = getDistrict(s.districtId)?.name;
            return (
              <View key={s.id} style={{ borderTopColor: colors.line, borderTopWidth: idx === 0 ? 0 : 1, gap: 8, padding: 16 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                  <MaterialCommunityIcons name="map-marker-plus-outline" size={18} color={colors.info} />
                  <Text style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "900" }}>{s.suggestedName} <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>({s.type})</Text></Text>
                  <View style={{ backgroundColor: STATUS_TONE[s.status].tint, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ color: STATUS_TONE[s.status].color, fontSize: 10.5, fontWeight: "900" }}>{STATUS_TONE[s.status].label}</Text></View>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{[prov, dist].filter(Boolean).join(" / ") || "Konum belirtilmedi"}</Text>
                {s.note ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{s.note}</Text> : null}
                <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>{s.userName ?? "Kullanıcı"} · {s.createdAt}</Text>
                {s.status === "pending" ? (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable onPress={() => setLocationSuggestionStatus(s.id, "approved")} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 9, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}><MaterialCommunityIcons name="check" size={15} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" }}>Onayla & mahalleye ekle</Text></Pressable>
                    <Pressable onPress={() => setLocationSuggestionStatus(s.id, "rejected")} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}><MaterialCommunityIcons name="close" size={15} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Reddet</Text></Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Category management */}
      {tab === "manage" ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>Ana kategoriler ve alt kategori sayıları. (Düzenleme canlıda admin yetkisiyle açılır.)</Text>
          {categoryTree.map((n) => {
            const open = expanded === n.key;
            const subCount = n.children?.length ?? 0;
            return (
              <View key={n.key} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, overflow: "hidden" }}>
                <Pressable onPress={() => setExpanded(open ? null : n.key)} style={{ alignItems: "center", flexDirection: "row", gap: 12, padding: 14 }}>
                  <MaterialCommunityIcons name="folder-outline" size={20} color={colors.primaryDark} />
                  <Text style={{ color: colors.ink, flex: 1, fontSize: 14.5, fontWeight: "900" }}>{n.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{subCount} alt kategori</Text>
                  <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
                </Pressable>
                {open ? (
                  <View style={{ borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 14 }}>
                    {(n.children ?? []).map((c) => (
                      <View key={c.key} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 6 }}>
                        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{c.label}</Text>
                        {c.children?.length ? <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>· {c.children.length}</Text> : null}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  if (isWideWeb) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.background }} contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 0 }}>
        <View style={{ alignSelf: "center", maxWidth: 1100, paddingHorizontal: 20, paddingTop: 16, width: "100%" }}>{Body}</View>
        <View style={{ marginTop: 20 }}><WebFooter /></View>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 14, paddingBottom: 60 }}>{Body}</ScrollView>
  );
}

function AdminStat({ icon, tint, color, value, title }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; color: string; value: string; title: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 200, flexGrow: 1, gap: 8, minWidth: 0, padding: 16 }}>
      <View style={{ alignItems: "center", backgroundColor: tint, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{title}</Text>
    </View>
  );
}

export default function AdminScreen() {
  const auth = useStore();
  if (!auth.isAuthenticated) return <AuthRequired title="Yönetim paneli için giriş yapın" />;
  return <AdminScreenInner />;
}
