import { isSupabaseConfigured } from "@/lib/supabase";
import { useRef, useState } from "react";
import { Link } from "expo-router";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { colors } from "@/components/colors";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { listingJoinAction, listingFlowPaths } from "@/lib/listing-actions";
import { parseTrPrice } from "@/lib/validation";
import { moneyIn } from "@/lib/format";
import { displayListingTitle } from "@/lib/listing-title";
import { useStore } from "@/lib/use-store";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { Conversation, Listing } from "@/lib/types";

export function ConversationListingActions({ listing, conversation }: { listing?: Listing; conversation: Conversation }) {
  const { currentUser, partnerships, createOffer, isUserBlocked } = useStore();
  const { language } = useLanguage();
  const tr = (value: string) => translateCopy(value, language);
  const [open, setOpen] = useState(false), [amount,setAmount] = useState(""), [note,setNote] = useState(""), [error,setError] = useState(""), [busy,setBusy] = useState(false);
  const busyRef = useRef(false);
  if (!listing || listing.id !== conversation.listingId || !conversation.participantIds.includes(currentUser.id) || !conversation.participantIds.includes(listing.ownerId)) return null;
  const membership = partnerships.find((p) => p.listingId === listing.id && p.partnerId === currentUser.id);
  const isOwner = listing.ownerId === currentUser.id;
  const blocked = isUserBlocked(listing.ownerId);
  const join = listingJoinAction({ listing, status: membership?.status, isOwner, sellerBlocked: blocked });
  const unavailable = !isSupabaseConfigured || listing.demo || listing.status !== "active" || listing.stockCount <= 0 || blocked || conversation.status !== "open";
  const offerAllowed = !isOwner && listing.attributes?._formKey !== "arayan" && !conversation.partnerId;
  const showJoin = !isOwner && (listing.partnershipMode !== "none" || Boolean(membership));
  // Gösterilecek eylem yoksa (ör. ilan sahibi) boş satır + boş dolgu bırakma.
  if (!offerAllowed && !showJoin) return null;
  const joinHref =join.kind === "view" && membership ? `/partnership/${membership.id}` : listingFlowPaths(listing.id).request;
  const control = { minHeight: 38, borderRadius: 9, flexDirection: "row" as const, gap: 5, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, flex: 1 };
  async function submit() {
    if (!listing || busyRef.current || unavailable) return;
    const value = parseTrPrice(amount);
    if (!Number.isFinite(value) || value <= 0) { setError(tr("Geçerli bir teklif tutarı gir."));return; }
    busyRef.current = true;setBusy(true);setError("");
    try { const result = await createOffer(listing.id, listing.ownerId, value, note.trim());if (result.ok) { setOpen(false);setAmount("");setNote(""); } else setError(result.error || tr("Teklif gönderilemedi. Tekrar dene.")); }
    catch { setError(tr("Bağlantı sorunu oluştu. Tekrar deneyebilirsin.")); }
    finally { busyRef.current = false;setBusy(false); }
  }
  return <View testID="conversation-listing-actions" style={{ flexDirection: "row", gap: 7 }}>
    {offerAllowed ? <Pressable accessibilityRole="button" accessibilityLabel={tr("Teklif ver")} disabled={unavailable} onPress={() => { setError("");setOpen(true); }} style={{ ...control, backgroundColor: colors.primaryDark, borderColor: colors.primaryDark, opacity: unavailable ? 0.45 : 1 }}><Icon name="tag-outline" size={15} color="white" /><Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, fontWeight: "600", color: "white" }}>{tr("Teklif ver")}</Text></Pressable> : null}
    {showJoin ? join.kind === "disabled" ? <View accessibilityLabel={tr(join.reason || join.label)} style={{ ...control, backgroundColor: colors.surfaceAlt }}><Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 11, color: colors.muted }}>{tr(join.label)}</Text></View> : <Link href={joinHref as never} asChild><Pressable accessibilityLabel={tr(join.label)} style={{ ...control, backgroundColor: colors.surface }}><Icon name="account-group-outline" size={15} color={colors.primaryDark} /><Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, fontWeight: "600", color: colors.primaryDark }}>{tr(join.label)}</Text></Pressable></Link> : null}
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}><View style={{ flex: 1, backgroundColor: "#0F172A66", justifyContent: "center" }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 16, alignItems: "center", justifyContent: "center" }}><View accessibilityViewIsModal style={{ backgroundColor: "white", borderRadius: 16, padding: 18, gap: 12, width: "100%", maxWidth: 400 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}><Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700", flex: 1 }}>{tr("Fiyat teklifi")}</Text><Pressable accessibilityRole="button" accessibilityLabel={tr("Teklif penceresini kapat")} disabled={busy} onPress={() => setOpen(false)} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><Icon name="close" size={20} color={colors.muted}/></Pressable></View>
        <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12 }}>{displayListingTitle(listing.title)} · {moneyIn(listing.price,listing.currency)}</Text>
        <TextInput accessibilityLabel={tr("Teklif tutarı")} placeholder={`${tr("Teklif tutarı")} (${listing.currency || "TRY"})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" maxLength={18} placeholderTextColor={colors.muted} style={{ minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 9, padding: 10, color: colors.ink, fontSize: 16 }} />
        <TextInput accessibilityLabel={tr("Teklif notu")} placeholder={tr("Not (isteğe bağlı)")} value={note} onChangeText={setNote} multiline maxLength={1000} placeholderTextColor={colors.muted} style={{ minHeight: 66, maxHeight: 100, borderWidth: 1, borderColor: colors.line, borderRadius: 9, padding: 10, color: colors.ink, fontSize: 16, textAlignVertical: "top" }} />
        {error ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12 }}>{error}</Text> : null}
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>{tr("Teklif, ödeme veya teslimat değildir. Sonucu satıcıyla mesajlaşarak netleştirebilirsin.")}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={tr("Teklifi gönder")} disabled={busy || unavailable} onPress={() => void submit()} style={{ minHeight: 44, backgroundColor: colors.primaryDark, borderRadius: 9, justifyContent: "center", alignItems: "center", opacity: busy || unavailable ? .6 : 1 }}><Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>{tr(busy ? "Gönderiliyor…" : "Teklifi gönder")}</Text></Pressable>
      </View></ScrollView></View></KeyboardAvoidingView>
    </Modal>
  </View>;
}
