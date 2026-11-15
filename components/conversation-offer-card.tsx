import { isSupabaseConfigured } from "@/lib/supabase";
import { useRef, useState } from "react";
import { Link } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { colors } from "@/components/colors";
import { moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { isPartnershipConversation } from "@/lib/inbox-model";
import { isMobileApp } from "@/lib/mobile-app";
import { useStore } from "@/lib/use-store";
import { parseTrPrice } from "@/lib/validation";
import type { Conversation, Listing } from "@/lib/types";

/** Only persisted offers between the exact conversation parties are displayed. */
export function ConversationOfferCard({ conversation, listing }: { conversation: Conversation; listing?: Listing }) {
  const { offers, partnerships, currentUser, sellerRespondOffer, buyerOfferAction, isUserBlocked } = useStore();
  const { language } = useLanguage();
  const tr = (value: string) => translateCopy(value, language);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterValue, setCounterValue] = useState("");
  const other = conversation.participantIds.find((id) => id !== currentUser.id);
  // Ortaklık sohbeti partnerships durumundan türetilir (conversations.partner_id değil). Ortaklık
  // sohbetinde yalnız SONUÇLANMAMIŞ (yanıt bekleyen / karşı teklifli) teklif gösterilir ki yarım kalmasın;
  // kabul edilen teklifin tutarı anlaşma şeridinde "Anlaşılan fiyat" olarak durur.
  const partnerChat = isPartnershipConversation(conversation, partnerships, listing?.ownerId);
  const offer = offers.filter((item) => item.listingId === conversation.listingId &&
    ((item.sellerId === currentUser.id && item.buyerId === other) || (item.buyerId === currentUser.id && item.sellerId === other)) &&
    (!partnerChat || item.status === "pending" || item.status === "countered"))
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!offer || !listing || listing.id !== conversation.listingId || !conversation.participantIds.includes(currentUser.id)) return null;
  const disabled = !isSupabaseConfigured || busy || conversation.status !== "open" || listing.status !== "active" || (listing.attributes?._formKey !== "arayan" && listing.stockCount <= 0) || !!(other && isUserBlocked(other));
  const seller = offer.sellerId === currentUser.id;
  const canRespond = seller && offer.status === "pending" || !seller && offer.status === "countered";
  // Satıcı karşı teklifi yalnız yanıt bekleyen teklife verebilir (durum geçişini sunucu zorlar).
  const canCounter = seller && offer.status === "pending";
  async function respond(accept: boolean) {
    if (!offer || busyRef.current || disabled) return;
    busyRef.current = true;setBusy(true);setError("");
    try {
      const ok = seller ? await sellerRespondOffer(offer.id, accept ? "accepted" : "rejected") : await buyerOfferAction(offer.id, accept ? "accept_counter" : "reject_counter");
      if (!ok) setError(tr("Teklif güncellenemedi. Durumu kontrol edip tekrar dene."));
    } catch { setError(tr("Bağlantı sorunu oluştu. Tekrar deneyebilirsin.")); }
    finally { busyRef.current = false;setBusy(false); }
  }
  async function sendCounter() {
    if (!offer || busyRef.current || disabled || !canCounter) return;
    // Türkçe sayı: "1.500.000" → 1500000 (Number("1.500.000") NaN olurdu).
    const amount = parseTrPrice(counterValue);
    if (!Number.isFinite(amount) || amount <= 0) { setError(tr("Geçerli bir tutar gir."));return; }
    busyRef.current = true;setBusy(true);setError("");
    try {
      const ok = await sellerRespondOffer(offer.id, "countered", amount);
      if (ok) { setCounterOpen(false);setCounterValue(""); } else setError(tr("Karşı teklif gönderilemedi. Durumu kontrol edip tekrar dene."));
    } catch { setError(tr("Bağlantı sorunu oluştu. Tekrar deneyebilirsin.")); }
    finally { busyRef.current = false;setBusy(false); }
  }
  const status = offer.status === "pending" ? "Yanıt bekleniyor" : offer.status === "countered" ? "Karşı teklif verildi" : offer.status === "accepted" ? "Teklif kabul edildi" : offer.status === "rejected" ? "Teklif reddedildi" : "Teklif geri çekildi";
  // "Teklifleri yönet": alıcı kendi tekliflerine; satıcı gelen tekliflere (web'de satıcı panelinin
  // Teklifler sekmesi; uygulamada Teklifler ekranı "Gelen Teklifler" ile açılır).
  const manageHref = seller && !isMobileApp ? "/seller?tab=teklifler" : "/offers";
  const choice = { flex: 1, minWidth: 0, minHeight: 40, borderRadius: 8, alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 1, paddingHorizontal: 4 };
  return <View testID="conversation-offer" style={{ alignSelf: "flex-start", width: "100%", maxWidth: 360, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 10, gap: 7, marginTop: 12 }}>
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Icon name="handshake-outline" size={22} color={colors.primaryDark} /><View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{tr(offer.status === "countered" ? "Karşı teklif" : "Fiyat teklifi")}: {moneyIn(offer.status === "countered" ? offer.counterAmount ?? offer.amount : offer.amount, listing.currency)}</Text><Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{tr(status)}</Text></View></View>
    {canRespond ? <View style={{ flexDirection: "row", gap: 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={tr("Teklifi reddet")} disabled={disabled} onPress={() => void respond(false)} style={{ ...choice, borderColor: colors.line, backgroundColor: colors.surface, opacity: disabled ? 0.5 : 1 }}><Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: colors.accent }}>{tr(busy ? "İşleniyor…" : "Reddet")}</Text></Pressable>
      {canCounter ? <Pressable testID="conversation-offer-counter" accessibilityRole="button" accessibilityLabel={tr("Karşı teklif ver")} accessibilityState={{ expanded: counterOpen }} disabled={disabled} onPress={() => { setError("");setCounterOpen((value) => !value); }} style={{ ...choice, borderColor: colors.primary, backgroundColor: counterOpen ? colors.primarySoft : colors.surface, opacity: disabled ? 0.5 : 1 }}><Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: colors.primaryDark }}>{tr("Karşı teklif")}</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={tr("Teklifi kabul et")} disabled={disabled} onPress={() => void respond(true)} style={{ ...choice, borderColor: colors.primaryDark, backgroundColor: colors.primaryDark, opacity: disabled ? 0.5 : 1 }}><Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: "white" }}>{tr(busy ? "İşleniyor…" : "Kabul et")}</Text></Pressable>
    </View> : null}
    {canCounter && counterOpen ? <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
      <TextInput testID="conversation-offer-counter-input" accessibilityLabel={tr("Karşı teklif tutarı")} placeholder={`${tr("Karşı teklif tutarı")} (${listing.currency || "TRY"})`} value={counterValue} onChangeText={(value) => { setCounterValue(value.replace(/[^0-9.,]/g, ""));if (error) setError(""); }} keyboardType="decimal-pad" maxLength={18} editable={!busy} onSubmitEditing={() => void sendCounter()} placeholderTextColor={colors.muted} style={{ flex: 1, minWidth: 0, minHeight: 42, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.ink, fontSize: 16 }} />
      <Pressable accessibilityRole="button" accessibilityLabel={tr("Karşı teklifi gönder")} disabled={disabled} onPress={() => void sendCounter()} style={{ minHeight: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, backgroundColor: colors.primaryDark, opacity: disabled ? 0.5 : 1 }}><Text numberOfLines={1} style={{ color: "white", fontSize: 12, fontWeight: "600" }}>{tr(busy ? "Gönderiliyor…" : "Gönder")}</Text></Pressable>
    </View> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12 }}>{error}</Text> : null}
    <Link href={manageHref as never} style={{ color: colors.primaryDark, fontSize: 11 }}>{tr("Teklifleri yönet")}</Link>
    {offer.status === "accepted" ? <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>{tr("Kabul, ödeme veya teslimatın tamamlandığı anlamına gelmez.")}</Text> : null}
  </View>;
}
