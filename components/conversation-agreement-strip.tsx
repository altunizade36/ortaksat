import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { ReasonModal } from "@/components/reason-modal";
import { Alert } from "@/lib/alert";
import { commissionValueLabel, moneyIn, partnershipProposal, partnershipTerms } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { conversationPartnership, latestAcceptedOffer } from "@/lib/inbox-model";
import { isMobileApp } from "@/lib/mobile-app";
import { partnershipStatusLabels } from "@/lib/status-labels";
import { showToast } from "@/lib/toast";
import { useStore } from "@/lib/use-store";
import type { Conversation, Listing, PartnershipStatus } from "@/lib/types";

// Durum rengi: aktif = marka mavisi, bekleyen = kehribar, ret = kırmızı, biten = nötr (yeşil/turkuaz yok).
function statusTone(status: PartnershipStatus): { bg: string; ink: string } {
  if (status === "active") return { bg: colors.primarySoft, ink: colors.primaryDark };
  if (status === "pending") return { bg: colors.warningSoft, ink: colors.goldInk };
  if (status === "rejected") return { bg: colors.accentSoft, ink: colors.accent };
  return { bg: colors.surfaceAlt, ink: colors.muted };
}

const button = { minHeight: 38, borderRadius: 9, borderWidth: 1, flexDirection: "row" as const, gap: 5, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 12 };

/**
 * SOHBETTE ANLAŞMA ŞERİDİ — ilan şeridinin hemen altında, iki rol için.
 *
 * Sohbetin ilanı + iki katılımcısından, ilan sahibi OLMAYAN kişinin o ilandaki ortaklığı bulunur
 * (conversations.partner_id'ye bakılmaz; bkz. lib/inbox-model). Ortaklık yoksa hiçbir şey çizilmez.
 *
 * Gösterilen: durum, geçerli komisyon (anlaşılan ile ortağa özelden YÜKSEK olan — lib/format
 * partnershipTerms, sunucunun satışta uyguladığı değer) ve iki kişi arasındaki son kabul edilmiş
 * teklif varsa anlaşılan fiyat. Tek dokunuş:
 *  - Satıcı: bekleyen başvuruda "Kabul et" / "Reddet" (gerekçeli), aktif ortaklıkta "Satış kaydet".
 *  - Ortak: "Anlaşmayı gör".
 * Platform para tutmaz; şerit yalnız kayıt altındaki anlaşmayı gösterir.
 */
export function ConversationAgreementStrip({ conversation, listing }: { conversation: Conversation; listing?: Listing }) {
  const { currentUser, partnerships, offers, sales, approvePartnership, rejectPartnership } = useStore();
  const { language } = useLanguage();
  const router = useRouter();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const tr = (value: string) => translateCopy(value, language);

  if (!listing || listing.id !== conversation.listingId || !conversation.participantIds.includes(currentUser.id) || !conversation.participantIds.includes(listing.ownerId)) return null;
  const partnership = conversationPartnership(conversation, partnerships, listing.ownerId);
  if (!partnership) return null;
  const isOwner = listing.ownerId === currentUser.id;
  if (!isOwner && partnership.partnerId !== currentUser.id) return null;

  const status = partnership.status;
  const live = status === "active" || status === "pending";
  const acceptedOffer = latestAcceptedOffer(conversation, offers);
  const priorSales = sales.reduce((n, sale) => n + (sale.partnershipId === partnership.id && sale.status !== "cancelled" ? 1 : 0), 0);
  const terms = partnershipTerms(listing, partnership, priorSales);
  const proposalTerms = partnershipProposal(listing, partnership);
  const proposal = proposalTerms ? commissionValueLabel(proposalTerms.type, proposalTerms.value, listing.currency) : "";
  const commissionLabel = commissionValueLabel(terms.type, terms.value, listing.currency);

  const details: string[] = [];
  if (live) details.push(`${tr("Komisyon")}: ${commissionLabel}${terms.type === "rate" && terms.amount > 0 ? ` (≈ ${moneyIn(terms.amount, listing.currency)})` : ""}`);
  if (proposal) details.push(`${tr("Ortağın önerisi")}: ${proposal}`);
  if (acceptedOffer) details.push(`${tr("Anlaşılan fiyat")}: ${moneyIn(acceptedOffer.amount, listing.currency)}`);
  if (status === "rejected" && partnership.rejectionReason) details.push(`${tr("Gerekçe")}: ${partnership.rejectionReason}`);

  const partnershipId = partnership.id;
  const listingId = listing.id;
  const tone = statusTone(status);
  const statusText = tr(partnershipStatusLabels[status]);

  // Satış kaydı satıcı panelindeki mevcut akıştan yapılır: ?focus=<ilan> ilanı "İlanlarım"da açar
  // (uygulamada ayrıntılı panel `view=advanced` ile açılır).
  function openSellerPanel() {
    router.push({ pathname: "/seller", params: isMobileApp ? { view: "advanced", focus: listingId } : { focus: listingId } } as never);
  }
  async function approve(acceptProposal: boolean) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const ok = await approvePartnership(partnershipId, acceptProposal);
      if (ok) showToast(tr("Ortaklık kabul edildi."));
      else setError(tr("Başvuru onayı kaydedilemedi. Tekrar dene."));
    } catch { setError(tr("Bağlantı sorunu oluştu. Tekrar deneyebilirsin.")); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function confirmApprove() {
    if (busyRef.current) return;
    // Ortak daha yüksek komisyon önerdiyse tek dokunuş öneriyi SESSİZCE yok saymasın: satıcı hangi
    // şartla kabul ettiğini seçer (öneriyle kabulde özel oranı sunucu yazar).
    if (!proposal) { void approve(false); return; }
    Alert.alert(tr("Ortağın komisyon önerisi var"), `${tr("Ortağın önerisi")}: ${proposal}. ${tr("İlandaki komisyon")}: ${commissionLabel}. ${tr("Hangi şartla kabul etmek istersin?")}`, [
      { text: tr("Vazgeç"), style: "cancel" },
      { text: tr("İlan şartlarıyla kabul et"), onPress: () => { void approve(false); } },
      { text: tr("Öneriyle kabul et"), onPress: () => { void approve(true); } }
    ]);
  }
  async function reject(reason: string) {
    setRejectOpen(false);
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const ok = await rejectPartnership(partnershipId, reason);
      if (ok) showToast(tr("Başvuru reddedildi."), "info");
      else setError(tr("Başvuru reddi kaydedilemedi. Tekrar dene."));
    } catch { setError(tr("Bağlantı sorunu oluştu. Tekrar deneyebilirsin.")); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return <View testID="conversation-agreement-strip" style={{ backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 10, marginHorizontal: 10, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 8, gap: 6 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <View accessible accessibilityLabel={`${tr("Ortaklık")}: ${statusText}${details.length ? `. ${details.join(". ")}` : ""}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 }}>
        <Icon name="handshake-outline" size={20} color={colors.primaryDark} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{tr("Ortaklık")}:</Text>
            <View testID="conversation-agreement-status" style={{ backgroundColor: tone.bg, borderRadius: 999, flexShrink: 1, paddingHorizontal: 8, paddingVertical: 2 }}><Text numberOfLines={1} style={{ color: tone.ink, fontSize: 11, fontWeight: "700" }}>{statusText}</Text></View>
          </View>
          {details.length ? <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11.5, lineHeight: 16 }}>{details.join(" · ")}</Text> : null}
        </View>
      </View>
      {isOwner && status === "pending" ? <View style={{ flexDirection: "row", gap: 7 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr("Başvuruyu reddet")} disabled={busy} onPress={() => { setError(""); setRejectOpen(true); }} style={{ ...button, backgroundColor: colors.surface, borderColor: colors.line, opacity: busy ? 0.5 : 1 }}><Text numberOfLines={1} style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>{tr("Reddet")}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tr("Başvuruyu kabul et")} disabled={busy} onPress={confirmApprove} style={{ ...button, backgroundColor: colors.primaryDark, borderColor: colors.primaryDark, opacity: busy ? 0.5 : 1 }}><Icon name="check" size={15} color="white" /><Text numberOfLines={1} style={{ color: "white", fontSize: 12, fontWeight: "600" }}>{tr(busy ? "İşleniyor…" : "Kabul et")}</Text></Pressable>
      </View> : null}
      {isOwner && status === "active" ? <Pressable accessibilityRole="button" accessibilityLabel={tr("Satış kaydet")} onPress={openSellerPanel} style={{ ...button, backgroundColor: colors.primaryDark, borderColor: colors.primaryDark }}><Icon name="cash-register" size={15} color="white" /><Text numberOfLines={1} style={{ color: "white", fontSize: 12, fontWeight: "600" }}>{tr("Satış kaydet")}</Text></Pressable> : null}
      {!isOwner ? <Pressable accessibilityRole="button" accessibilityLabel={tr("Anlaşmayı gör")} onPress={() => router.push(`/partnership/${partnershipId}` as never)} style={{ ...button, backgroundColor: colors.surface, borderColor: colors.line }}><Icon name="file-sign" size={15} color={colors.primaryDark} /><Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "600" }}>{tr("Anlaşmayı gör")}</Text></Pressable> : null}
    </View>
    {error ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12 }}>{error}</Text> : null}
    {isOwner && status === "pending" ? <ReasonModal
      visible={rejectOpen}
      title="Başvuruyu reddet"
      intro="Ortağa iletilecek net bir gerekçe seç; başvurusu neden uygun bulunmadığını bilsin."
      reasons={["Kitle/kanal ürüne uygun değil", "Yetersiz erişim veya takipçi", "Eksik veya belirsiz başvuru bilgisi", "Şu an yeni ortak almıyorum", "Diğer"]}
      submitLabel="Reddet"
      icon="account-cancel-outline"
      onClose={() => setRejectOpen(false)}
      onSubmit={(reason) => { void reject(reason); }}
    /> : null}
  </View>;
}
