import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { commissionAmount, moneyIn } from "@/lib/format";
import { displayListingTitle } from "@/lib/listing-title";
import { invitePartnerToListing, inviteResultText } from "@/lib/partner-invite";
import { showToast } from "@/lib/toast";
import { useStore } from "@/lib/use-store";

/**
 * "İLANIMA DAVET ET" (2026-11-15) — satıcı, ortağın vitrininden onu kendi ilanına çağırır.
 * Yalnız giriş yapmış ve bu kişi olmayan kullanıcıya görünür. Düğme bir pencere açar: satıcının YAYINDA ve
 * ORTAKLIĞA AÇIK ilanları listelenir; birine dokununca sunucuya davet gider (ortağa bildirim). Davet yalnız çağrıdır;
 * ortaklık yine ortağın başvurusu ve satıcının kabulüyle kurulur. Sunucu kuralları: lib/partner-invite.ts.
 */
export function PartnerInviteButton({ partnerId, partnerName }: { partnerId: string; partnerName?: string }) {
  const router = useRouter();
  const { currentUser, isAuthenticated, listings } = useStore();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const mine = useMemo(
    () => listings.filter((l) => l.ownerId === currentUser.id && l.status === "active" && l.partnershipMode !== "none" && !l.demo),
    [listings, currentUser.id]
  );
  if (!isAuthenticated || !partnerId || partnerId === currentUser.id) return null;

  async function invite(listingId: string) {
    if (busyId) return;
    setBusyId(listingId); setError("");
    try {
      const result = await invitePartnerToListing(listingId, partnerId);
      if (result.ok) {
        const text = inviteResultText(result.state);
        setDone((previous) => ({ ...previous, [listingId]: text }));
        if (result.state === "sent") showToast("Davet gönderildi");
      } else setError(result.message);
    } finally { setBusyId(null); }
  }

  return (
    <>
      <Pressable testID="partner-invite-open" accessibilityRole="button" accessibilityLabel={`${partnerName || "Bu ortağı"} ilanıma davet et`} onPress={() => { setError(""); setOpen(true); }}
        style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 11, flexDirection: "row", gap: 7, minHeight: 42, paddingHorizontal: 15 }}>
        <MaterialCommunityIcons name="account-plus-outline" size={18} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>İlanıma davet et</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Kapat" onPress={() => setOpen(false)} style={{ alignItems: "center", backgroundColor: "rgba(9,39,94,0.45)", flex: 1, justifyContent: "center", padding: 16 }}>
          {/* İç kutuya dokunmak pencereyi kapatmasın */}
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderRadius: 18, gap: 12, maxHeight: "86%", maxWidth: 480, padding: 16, width: "100%" }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Hangi ilanına davet edeceksin?</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{partnerName ? `${partnerName} bir bildirim alır ve ilanını inceleyip başvurabilir.` : "Ortak bir bildirim alır ve ilanını inceleyip başvurabilir."}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={8} onPress={() => setOpen(false)} style={{ alignItems: "center", height: 40, justifyContent: "center", width: 40 }}>
                <MaterialCommunityIcons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            {error ? <Text accessibilityRole="alert" style={{ backgroundColor: colors.accentSoft, borderRadius: 10, color: colors.accent, fontSize: 12.5, fontWeight: "700", padding: 10 }}>{error}</Text> : null}

            {mine.length === 0 ? (
              <View style={{ alignItems: "flex-start", backgroundColor: colors.surfaceAlt, borderRadius: 12, gap: 8, padding: 14 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>Ortaklığa açık yayında ilanın yok</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>Davet gönderebilmek için yayında ve komisyon belirlenmiş bir ilanın olmalı.</Text>
                <Pressable accessibilityRole="button" onPress={() => { setOpen(false); router.push("/create"); }} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, minHeight: 40, paddingHorizontal: 14 }}>
                  <MaterialCommunityIcons name="plus-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>İlan Ver</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
                {mine.map((listing) => {
                  const note = done[listing.id];
                  const commission = commissionAmount(listing);
                  return (
                    <Pressable key={listing.id} testID="partner-invite-listing" accessibilityRole="button" accessibilityLabel={`${displayListingTitle(listing.title)} ilanına davet et`} disabled={!!note || busyId === listing.id} onPress={() => void invite(listing.id)}
                      style={{ alignItems: "center", backgroundColor: note ? colors.primarySoft : colors.surface, borderColor: note ? colors.primary : colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, opacity: busyId === listing.id ? 0.6 : 1, padding: 9 }}>
                      <SafeRemoteImage uri={listing.image} accessibilityLabel={displayListingTitle(listing.title)} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 48, width: 48 }} />
                      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{displayListingTitle(listing.title)}</Text>
                        <Text numberOfLines={2} style={{ color: note ? colors.primaryDark : colors.muted, fontSize: 11.5, fontWeight: "700", lineHeight: 16 }}>
                          {note ?? `${moneyIn(listing.price, listing.currency)}${commission > 0 ? ` · komisyon ${moneyIn(commission, listing.currency)}` : ""}`}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name={note ? "check-circle" : busyId === listing.id ? "timer-sand" : "send-outline"} size={19} color={colors.primary} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
