import { isSupabaseConfigured } from "@/lib/supabase";
import { useRef, useState } from "react";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { colors } from "@/components/colors";
import { moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/use-store";
import type { Conversation, Listing } from "@/lib/types";

/** Only persisted offers between the exact conversation parties are displayed. */
export function ConversationOfferCard({ conversation, listing }: { conversation: Conversation; listing?: Listing }) {
  const { offers, currentUser, sellerRespondOffer, buyerOfferAction, isUserBlocked } = useStore();
  const { language } = useLanguage();
  const tr = (value: string) => translateCopy(value, language);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const other = conversation.participantIds.find((id) => id !== currentUser.id);
  const offer = offers.filter((item) => !conversation.partnerId && item.listingId === conversation.listingId &&
    ((item.sellerId === currentUser.id && item.buyerId === other) || (item.buyerId === currentUser.id && item.sellerId === other)))
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!offer || !listing || listing.id !== conversation.listingId || !conversation.participantIds.includes(currentUser.id)) return null;
  const disabled = !isSupabaseConfigured || busy || conversation.status !== "open" || listing.status !== "active" || (listing.attributes?._formKey !== "arayan" && listing.stockCount <= 0) || !!(other && isUserBlocked(other));
  const seller = offer.sellerId === currentUser.id;
  const canRespond = seller && offer.status === "pending" || !seller && offer.status === "countered";
  async function respond(accept: boolean) {
    if (!offer || busyRef.current || disabled) return;
    busyRef.current = true;setBusy(true);setError("");
    try {
      const ok = seller ? await sellerRespondOffer(offer.id, accept ? "accepted" : "rejected") : await buyerOfferAction(offer.id, accept ? "accept_counter" : "reject_counter");
      if (!ok) setError(tr("Teklif güncellenemedi. Durumu kontrol edip tekrar dene."));
    } catch { setError(tr("Bağlantı sorunu oluştu. Tekrar deneyebilirsin.")); }
    finally { busyRef.current = false;setBusy(false); }
  }
  const status = offer.status === "pending" ? "Yanıt bekleniyor" : offer.status === "countered" ? "Karşı teklif verildi" : offer.status === "accepted" ? "Teklif kabul edildi" : offer.status === "rejected" ? "Teklif reddedildi" : "Teklif geri çekildi";
  return <View testID="conversation-offer" style={{ alignSelf: "flex-start", width: "100%", maxWidth: 360, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 10, gap: 7, marginTop: 12 }}>
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Icon name="handshake-outline" size={22} color={colors.primaryDark} /><View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{tr(offer.status === "countered" ? "Karşı teklif" : "Fiyat teklifi")}: {moneyIn(offer.status === "countered" ? offer.counterAmount ?? offer.amount : offer.amount, listing.currency)}</Text><Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{tr(status)}</Text></View></View>
    {canRespond ? <View style={{ flexDirection: "row", gap: 8 }}>{[false,true].map((accept) => <Pressable key={String(accept)} accessibilityRole="button" accessibilityLabel={tr(accept ? "Teklifi kabul et" : "Teklifi reddet")} disabled={disabled} onPress={() => void respond(accept)} style={{ flex: 1, minHeight: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: accept ? colors.primaryDark : colors.line, backgroundColor: accept ? colors.primaryDark : colors.surface, opacity: disabled ? 0.5 : 1 }}><Text style={{ fontSize: 12, fontWeight: "600", color: accept ? "white" : colors.accent }}>{tr(busy ? "İşleniyor…" : accept ? "Kabul et" : "Reddet")}</Text></Pressable>)}</View> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12 }}>{error}</Text> : null}
    <Link href="/offers" style={{ color: colors.primaryDark, fontSize: 11 }}>{tr("Teklifleri yönet")}</Link>
    {offer.status === "accepted" ? <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>{tr("Kabul, ödeme veya teslimatın tamamlandığı anlamına gelmez.")}</Text> : null}
  </View>;
}
