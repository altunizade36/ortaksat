import { useCallback, useState } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { UserAvatar } from "@/components/user-avatar";
import { moneyIn } from "@/lib/format";
import { relativeTime } from "@/lib/locale";
import { dismissPartnerInvite, fetchMyPartnerInvites, inviteStateLabel, type PartnerInvite } from "@/lib/partner-invite";
import { showToast } from "@/lib/toast";
import { useStore } from "@/lib/use-store";

/**
 * ORTAKLIK DAVETLERİ KUTUSU (2026-11-16) — davet yalnız bildirimde kalmasın diye.
 *  - "Sana gelen davetler": satıcıların seni çağırdığı, hâlâ yanıt bekleyen ilanlar. "İlanı incele" ilana götürür
 *    (başvuru oradan yapılır), "İlgilenmiyorum" daveti kapatır (satıcıya bildirim gitmez).
 *  - "Gönderdiğin davetler": satıcının gönderdiği davetlerin durumu (yanıt bekliyor / başvurdu / ortak oldu / ilgilenmedi).
 * İkisi de boşsa HİÇBİR ŞEY çizmez. Ekran her odaklandığında yenilenir. Kurallar sunucuda: lib/partner-invite.ts.
 * `only="received"`: yalnız gelen davetler (fırsatları keşfet sekmesi — giden davetler orada yersiz).
 * `style` dış kutuya uygulanır; kutu boşken çizilmediği için boşluğu çağıran değil kutu taşır.
 */
const SENT_PREVIEW = 4;

export function PartnerInvitesPanel({ only, style }: { only?: "received"; style?: StyleProp<ViewStyle> } = {}) {
  const router = useRouter();
  const { isAuthenticated, currentUser } = useStore();
  const [invites, setInvites] = useState<PartnerInvite[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAllSent, setShowAllSent] = useState(false);
  const userId = isAuthenticated ? currentUser.id : "";

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!userId) { setInvites([]); return; }
      void fetchMyPartnerInvites().then((rows) => { if (alive) setInvites(rows); });
      return () => { alive = false; };
    }, [userId])
  );

  if (!userId) return null;
  const received = invites.filter((invite) => invite.direction === "received" && invite.state === "pending");
  const sent = only === "received" ? [] : invites.filter((invite) => invite.direction === "sent");
  if (received.length === 0 && sent.length === 0) return null;

  const openListing = (listingId: string) => router.push({ pathname: "/listing/[id]", params: { id: listingId } });

  async function dismiss(invite: PartnerInvite) {
    if (busyId) return;
    setBusyId(invite.id);
    try {
      const done = await dismissPartnerInvite(invite.id);
      if (done) setInvites((previous) => previous.map((row) => (row.id === invite.id ? { ...row, state: "dismissed" } : row)));
      else showToast("Davet kapatılamadı. Lütfen tekrar dene.", "info");
    } finally { setBusyId(null); }
  }

  const sentRows = showAllSent ? sent : sent.slice(0, SENT_PREVIEW);
  return (
    <View testID="partner-invites" style={[{ gap: 12 }, style]}>
      {received.length > 0 ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 14, borderWidth: 1, gap: 10, padding: 12 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
            <MaterialCommunityIcons name="email-heart-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.ink, flex: 1, fontSize: 14.5, fontWeight: "900" }}>Sana gelen davetler</Text>
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{received.length}</Text>
          </View>
          {received.map((invite) => (
            <View key={invite.id} testID="partner-invite-received" style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 9, paddingTop: 10 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                <SafeRemoteImage uri={invite.listingImage ?? undefined} accessibilityLabel={invite.listingTitle} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 9, height: 52, width: 52 }} />
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800", lineHeight: 18 }}>{invite.listingTitle}</Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "700" }}>
                    {moneyIn(invite.price, invite.currency)}
                    {invite.commissionAmount > 0 ? <Text style={{ color: colors.primaryDark, fontWeight: "900" }}> · kazancın {moneyIn(invite.commissionAmount, invite.currency)}</Text> : null}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>{invite.otherName} davet etti · {relativeTime(invite.createdAt)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${invite.listingTitle} ilanını incele`} onPress={() => openListing(invite.listingId)}
                  style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexBasis: 140, flexDirection: "row", flexGrow: 1, gap: 6, justifyContent: "center", maxWidth: 240, minHeight: 40, paddingHorizontal: 12 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>İlanı incele</Text>
                  <MaterialCommunityIcons name="arrow-right" size={15} color="#FFFFFF" />
                </Pressable>
                <Pressable testID="partner-invite-dismiss" accessibilityRole="button" accessibilityLabel="Bu davetle ilgilenmiyorum" disabled={busyId === invite.id} onPress={() => void dismiss(invite)}
                  style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 40, opacity: busyId === invite.id ? 0.5 : 1, paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>İlgilenmiyorum</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {sent.length > 0 ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 8, padding: 12 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
            <MaterialCommunityIcons name="send-outline" size={17} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, flex: 1, fontSize: 14.5, fontWeight: "900" }}>Gönderdiğin davetler</Text>
            <Text style={{ color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "800" }}>{sent.length}</Text>
          </View>
          {sentRows.map((invite) => {
            const positive = invite.state === "active" || invite.state === "applied";
            return (
              <Pressable key={invite.id} testID="partner-invite-sent" accessibilityRole="link" accessibilityLabel={`${invite.otherName} vitrinini aç`} onPress={() => router.push({ pathname: "/ortak/[id]", params: { id: invite.otherId } })}
                style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 9, minHeight: 48, paddingTop: 8 }}>
                <UserAvatar uri={invite.otherAvatar} name={invite.otherName} size={34} />
                <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{invite.otherName}</Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{invite.listingTitle} · {relativeTime(invite.createdAt)}</Text>
                </View>
                <View style={{ backgroundColor: positive ? colors.primary : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <Text style={{ color: positive ? "#FFFFFF" : colors.muted, fontSize: 11, fontWeight: "900" }}>{inviteStateLabel(invite.state)}</Text>
                </View>
              </Pressable>
            );
          })}
          {sent.length > SENT_PREVIEW ? (
            <Pressable accessibilityRole="button" hitSlop={6} onPress={() => setShowAllSent((value) => !value)} style={{ alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 4, minHeight: 34 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "900" }}>{showAllSent ? "Daha az göster" : `Tümünü göster (${sent.length})`}</Text>
              <MaterialCommunityIcons name={showAllSent ? "chevron-up" : "chevron-down"} size={16} color={colors.primaryDark} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
