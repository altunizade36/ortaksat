import { MaterialCommunityIcons } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { AuthRequired } from "@/components/auth-gate";
import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { PrimaryButton } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { fetchBlockedProfiles, type BlockedProfile } from "@/lib/live-service";
import { useMounted } from "@/lib/layout";
import { useStore } from "@/lib/use-store";

type Row = { id: string; name: string; avatar?: string; role?: string };

function roleLabel(role: string | undefined, language: "tr" | "en"): string | null {
  if (!role) return null;
  const map: Record<string, [string, string]> = {
    seller: ["Satıcı", "Seller"],
    partner: ["Ortak", "Affiliate"],
    buyer: ["Alıcı", "Buyer"],
    admin: ["Yönetici", "Admin"]
  };
  const hit = map[role];
  return hit ? (language === "en" ? hit[1] : hit[0]) : null;
}

export default function BlockedUsersScreen() {
  const { language } = useLanguage();
  const { isAuthenticated } = useStore();
  const mounted = useMounted();
  if (!mounted) return <ScreenSkeleton />;
  if (!isAuthenticated) {
    return (
      <AuthRequired
        title={translateCopy("Engellenenler için giriş yap", language)}
        body={translateCopy("Engellediğin kullanıcıları görmek ve engeli kaldırmak için giriş yapman gerekir.", language)}
      />
    );
  }
  return <BlockedUsersInner />;
}

function BlockedUsersInner() {
  const { language } = useLanguage();
  const { blockedUserIds, unblockUser, findUser, backendMode } = useStore();
  const [profiles, setProfiles] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (backendMode !== "supabase") { setProfiles([]); setLoading(false); return; }
    const res = await fetchBlockedProfiles();
    setProfiles(res);
    setLoading(false);
  }, [backendMode]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // blockedUserIds sürücü kaynak (engel kaldırınca anında güncellenir); profiller zenginleştirir.
  const rows: Row[] = blockedUserIds.map((id) => {
    const p = profiles.find((x) => x.id === id);
    if (p) return { id, name: p.name, avatar: p.avatarUrl, role: p.role };
    const u = findUser(id);
    return { id, name: u?.name ?? translateCopy("Kullanıcı", language), avatar: u?.avatar, role: u?.role };
  });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background, flex: 1 }}
      contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={{ alignSelf: "center", gap: 14, maxWidth: 1280, paddingHorizontal: 12, paddingTop: 16, width: "100%" }}>
        <View style={{ gap: 4 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name="account-cancel-outline" size={24} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>{translateCopy("Engellenen Kullanıcılar", language)}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>
            {rows.length > 0
              ? `${rows.length} ${translateCopy("kişiyi engelledin · sana mesaj gönderemezler", language)}`
              : translateCopy("Engellediğin kullanıcılar burada listelenir; sana mesaj gönderemezler.", language)}
          </Text>
        </View>

        {loading ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => <View key={i} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 14, height: 68 }} />)}
          </View>
        ) : rows.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, gap: 12, paddingHorizontal: 20, paddingVertical: 30 }}>
            <View style={{ alignItems: "center", alignSelf: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 62, justifyContent: "center", width: 62 }}>
              <MaterialCommunityIcons name="shield-check-outline" size={30} color={colors.primaryDark} />
            </View>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900", textAlign: "center" }}>{translateCopy("Engellenen kimse yok", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, maxWidth: 460, alignSelf: "center", textAlign: "center" }}>
              {translateCopy("Bir kullanıcıyı sohbet ekranından engelleyebilirsin. Engellediğin kişiler sana mesaj gönderemez.", language)}
            </Text>
          </View>
        ) : (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
            {rows.map((row, i) => (
              <View
                key={row.id}
                style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: i === 0 ? 0 : 1, flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}
              >
                <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 44, justifyContent: "center", overflow: "hidden", width: 44 }}>
                  {row.avatar && /^https?:\/\//.test(row.avatar) ? (
                    <SafeRemoteImage full uri={row.avatar} contentFit="cover" style={{ height: 44, width: 44 }} />
                  ) : (
                    <MaterialCommunityIcons name="account" size={24} color={colors.muted} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14.5, fontWeight: "800" }}>{row.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                    {roleLabel(row.role, language) ?? translateCopy("Engellendi", language)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={translateCopy("Engeli kaldır", language)}
                  onPress={() => void unblockUser(row.id)}
                  style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.7 : 1, paddingHorizontal: 14, paddingVertical: 8 })}
                >
                  <MaterialCommunityIcons name="account-check-outline" size={15} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Engeli kaldır", language)}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={{ alignItems: "center", marginTop: 4 }}>
          <PrimaryButton tone="secondary" icon="chat-outline" href="/(tabs)/messages">{translateCopy("Mesajlara dön", language)}</PrimaryButton>
        </View>
      </View>

      <WebFooter />
    </ScrollView>
  );
}
