import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { Card, EmptyState, Metric, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { listingShareTemplates, money, shareUrl } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { searchKey } from "@/lib/locale";
import type { LeadSource, PurchaseIntent, Sale, SaleStatus } from "@/lib/types";
import { useStore } from "@/lib/use-store";
import { WebContainer } from "@/components/web-container";

const saleLabels: Record<SaleStatus, string> = {
  pending: "Bekliyor",
  return_pending: "İade süresi",
  approved: "Onaylandı",
  seller_paid: "Satıcı ödedi",
  paid: "Ödeme alındı",
  cancelled: "İptal",
  disputed: "Anlaşmazlık"
};

const sourceLabels: Record<LeadSource, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  web: "Web",
  phone: "Telefon"
};

const intentLabels: Record<PurchaseIntent, string> = {
  hot: "Sıcak",
  warm: "Ilık",
  cold: "Soğuk"
};

type PartnerFilter = "all" | "active" | "pending" | "earning";

export default function PartnerScreen() {
  const { canReviewSale, createSaleReview, currentUser, findUser, leads, listings, partnerships, sales, startConversation, updateSaleStatus } = useStore();
  const { language, t } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PartnerFilter>("all");
  const myPartnerships = partnerships.filter((partnership) => partnership.partnerId === currentUser.id);
  const activePartnerships = myPartnerships.filter((item) => item.status === "active");
  const pendingPartnerships = myPartnerships.filter((item) => item.status === "pending");
  const mySales = sales.filter((sale) => myPartnerships.some((partnership) => partnership.id === sale.partnershipId));
  const waiting = mySales.filter((sale) => sale.status === "pending" || sale.status === "return_pending" || sale.status === "disputed").reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const approved = mySales.filter((sale) => sale.status === "approved" || sale.status === "seller_paid").reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const paid = mySales.filter((sale) => sale.status === "paid").reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const tokens = searchKey(query).split(" ").filter(Boolean);
  const visiblePartnerships = myPartnerships.filter((partnership) => {
    const listing = listings.find((item) => item.id === partnership.listingId);
    const listingSales = mySales.filter((sale) => sale.partnershipId === partnership.id);
    if (filter === "active" && partnership.status !== "active") return false;
    if (filter === "pending" && partnership.status !== "pending") return false;
    if (filter === "earning" && listingSales.length === 0) return false;
    if (tokens.length === 0) return true;
    const haystack = searchKey([listing?.title, listing?.category, listing?.location, partnership.note, partnership.shareChannel, partnership.audience].filter(Boolean).join(" "));
    return tokens.every((token) => haystack.includes(token));
  });

  async function copyText(label: string, text: string) {
    await Clipboard.setStringAsync(text);
    Alert.alert(translateCopy("Kopyala", language), language === "en" ? `${translateCopy(label, language)} copied to clipboard.` : `${label} panoya kopyalandı.`);
  }

  async function sharePartnership(listingId: string, refCode: string) {
    const listing = listings.find((item) => item.id === listingId);
    if (!listing) return;
    const url = shareUrl(listing, refCode);
    await Share.share({ title: listing.title, message: `${listingShareTemplates(listing, url).whatsapp}\n${url}`, url });
  }

  async function openWhatsapp(listingId: string, refCode: string) {
    const listing = listings.find((item) => item.id === listingId);
    if (!listing) return;
    const url = shareUrl(listing, refCode);
    const text = encodeURIComponent(`${listingShareTemplates(listing, url).whatsapp}\n${url}`);
    await Linking.openURL(`https://wa.me/?text=${text}`);
  }

  function messageSeller(listingId: string, sellerId: string, title: string) {
    const seller = findUser(sellerId);
    const conversation = startConversation(listingId, sellerId, `${title} ortak satış süreci hakkında konuşmak istiyorum.${seller ? ` Satıcı: ${seller.name}.` : ""}`);
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 12, paddingBottom: 96 }}>
      <WebContainer max={1200} padding={0} style={{ gap: 14 }}>
      <Card>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.infoSoft, borderRadius: 8, height: 48, justifyContent: "center", width: 48 }}>
            <MaterialCommunityIcons name="handshake" size={26} color={colors.info} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{translateCopy("Kazançlarım", language)}</Text>
            <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
              {t("partnerEarningsBody")}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <Metric label="Bekleyen" value={money(waiting)} />
          <Metric label="Onaylanan" value={money(approved)} />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Metric label="Ödenen" value={money(paid)} />
          <Metric label="Satış" value={`${mySales.length}`} />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Metric label="Aktif ortaklık" value={`${activePartnerships.length}`} />
          <Metric label="Başvuru" value={`${pendingPartnerships.length}`} />
        </View>
      </Card>

      <Card>
        <SectionTitle title="Aktif ortaklıklarım" action={`${visiblePartnerships.length}`} />
        <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 48, paddingHorizontal: 12 }}>
          <MaterialCommunityIcons name="magnify" size={21} color={colors.info} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("partnerSearchPlaceholder")}
            placeholderTextColor={colors.muted}
            style={{ color: colors.ink, flex: 1, fontSize: 15, minHeight: 46, paddingVertical: 8 }}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <MaterialCommunityIcons name="close-circle" size={19} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          <PanelFilterChip active={filter === "all"} icon="view-grid" label="Tümü" onPress={() => setFilter("all")} />
          <PanelFilterChip active={filter === "active"} icon="handshake-outline" label="Aktif" onPress={() => setFilter("active")} />
          <PanelFilterChip active={filter === "pending"} icon="clock-outline" label="Bekleyen" onPress={() => setFilter("pending")} />
          <PanelFilterChip active={filter === "earning"} icon="cash-multiple" label="Komisyonlu" onPress={() => setFilter("earning")} />
        </ScrollView>
      </Card>

      {myPartnerships.length === 0 ? (
        <Card>
          <EmptyState title={t("noPartnerships")} body={t("noPartnershipsBody")} />
          <PrimaryButton href="/(tabs)/explore" icon="play-box-multiple-outline">Ortak satış ilanlarını keşfet</PrimaryButton>
        </Card>
      ) : null}
      {myPartnerships.length > 0 && visiblePartnerships.length === 0 ? <EmptyState title={t("noResults")} body={t("partnerNoResultBody")} /> : null}

      {visiblePartnerships.map((partnership) => {
        const listing = listings.find((item) => item.id === partnership.listingId);
        if (!listing) return null;
        const listingLeads = leads.filter((lead) => lead.partnershipId === partnership.id);
        const listingSales = mySales.filter((sale) => sale.partnershipId === partnership.id);
        const clicks = partnerClickEstimate(listing.leadCount, listing.partnerCount, listingLeads.length);
        const earned = listingSales.reduce((sum, sale) => sum + sale.commissionAmount, 0);
        const conversionRate = clicks > 0 ? Math.round((listingSales.length / clicks) * 100) : 0;
        const url = shareUrl(listing, partnership.refCode);
        const templates = listingShareTemplates(listing, url);
        const sellerPaidCount = listingSales.filter((sale) => sale.status === "seller_paid").length;

        return (
          <Card key={partnership.id}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Image source={{ uri: listing.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 74, width: 74 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text selectable numberOfLines={2} style={{ color: colors.ink, fontSize: 18, fontWeight: "900", lineHeight: 22 }}>{listing.title}</Text>
                <Text selectable numberOfLines={2} style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
                  {partnership.shareChannel || t("channelMissing")} · {partnership.reachEstimate ?? 0} {t("reach")}
                </Text>
              </View>
              <StatusPill label={partnership.status === "active" ? "Aktif" : partnership.status === "pending" ? "Bekliyor" : "Reddedildi"} tone={partnership.status === "active" ? "success" : "warning"} />
            </View>

            {partnership.status === "active" ? (
              <>
                <Text selectable style={{ color: colors.info, fontSize: 13, lineHeight: 19 }}>{url}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <View style={{ flexBasis: "31%", flexGrow: 1 }}>
                    <PrimaryButton tone="secondary" onPress={() => copyText("Satış bağlantısı", url)}>Kopyala</PrimaryButton>
                  </View>
                  <View style={{ flexBasis: "31%", flexGrow: 1 }}>
                    <PrimaryButton tone="soft" onPress={() => openWhatsapp(listing.id, partnership.refCode)}>WhatsApp</PrimaryButton>
                  </View>
                  <View style={{ flexBasis: "31%", flexGrow: 1 }}>
                    <PrimaryButton onPress={() => sharePartnership(listing.id, partnership.refCode)}>Paylaş</PrimaryButton>
                  </View>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <View style={{ flexBasis: "48%", flexGrow: 1 }}>
                    <PrimaryButton tone="secondary" onPress={() => copyText("Instagram açıklaması", templates.instagram)}>Instagram Metni</PrimaryButton>
                  </View>
                  <View style={{ flexBasis: "48%", flexGrow: 1 }}>
                    <PrimaryButton tone="secondary" onPress={() => copyText("TikTok açıklaması", templates.tiktok)}>TikTok Metni</PrimaryButton>
                  </View>
                </View>
                <PrimaryButton tone="secondary" icon="message-text-outline" onPress={() => messageSeller(listing.id, listing.ownerId, listing.title)}>
                  Satıcıya mesaj yaz
                </PrimaryButton>
              </>
            ) : (
              <View style={{ gap: 8 }}>
                <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
                  {t("partnerApprovalPendingNote")} {partnership.note}
                </Text>
                <PrimaryButton tone="secondary" icon="message-text-outline" onPress={() => messageSeller(listing.id, listing.ownerId, listing.title)}>
                  Satıcıya mesaj yaz
                </PrimaryButton>
              </View>
            )}

            <PartnerActionBand
              active={partnership.status === "active"}
              leadCount={listingLeads.length}
              sellerPaidCount={sellerPaidCount}
              onCopy={() => copyText("Satış bağlantısı", url)}
              onShare={() => sharePartnership(listing.id, partnership.refCode)}
            />

            <SectionTitle title="Performans" action={`%${conversionRate} dönüşüm`} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Metric label="Tıklama" value={`${clicks}`} />
              <Metric label="Talep" value={`${listingLeads.length}`} />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Metric label="Satış" value={`${listingSales.length}`} />
              <Metric label="Kazanç" value={money(earned)} />
            </View>

            {listingLeads.length > 0 ? <SectionTitle title="Gelen talepler" action="Benim bağlantım" /> : null}
            {listingLeads.map((lead) => (
              <View key={lead.id} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, gap: 6, padding: 12 }}>
                <Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{lead.buyerName} · {lead.buyerPhone}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <StatusPill label={lead.status === "converted" ? "Satışa döndü" : lead.status === "interested" ? "İlgileniyor" : lead.status === "contacted" ? "İletişimde" : lead.status === "lost" ? "Kayıp" : "Yeni"} tone={lead.status === "converted" ? "success" : "info"} />
                  <StatusPill label={sourceLabels[lead.source]} />
                  <StatusPill label={intentLabels[lead.intent]} tone={lead.intent === "hot" ? "warning" : "info"} />
                </View>
                <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{lead.note}</Text>
              </View>
            ))}

            {listingSales.length > 0 ? <SectionTitle title="Komisyonlar" /> : null}
            {listingSales.map((sale) => (
              <View key={sale.id} style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 10, paddingTop: 12 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Metric label="Satış" value={money(sale.amount)} />
                  <Metric label="Komisyon" value={money(sale.commissionAmount)} />
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Metric label="Adet" value={`${sale.quantity ?? 1}`} />
                  <Metric label="İade sonu" value={sale.returnUntil ?? "-"} />
                </View>
                <StatusPill label={saleLabels[sale.status]} tone={sale.status === "paid" ? "success" : "warning"} />
                {sale.payoutNote ? <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{sale.payoutNote}</Text> : null}
                {sale.status === "seller_paid" ? <PrimaryButton tone="soft" onPress={() => updateSaleStatus(sale.id, "paid")}>Ödemeyi Aldım</PrimaryButton> : null}
                {sale.status !== "paid" && sale.status !== "cancelled" ? <PrimaryButton tone="secondary" onPress={() => updateSaleStatus(sale.id, "disputed")}>Anlaşmazlık Bildir</PrimaryButton> : null}
                <ReviewPrompt sale={sale} canReviewSale={canReviewSale} createSaleReview={createSaleReview} />
              </View>
            ))}
          </Card>
        );
      })}
      </WebContainer>
    </ScrollView>
  );
}

function ReviewPrompt({
  canReviewSale,
  createSaleReview,
  sale
}: {
  canReviewSale: (saleId: string) => boolean;
  createSaleReview: (saleId: string, rating: number, comment: string) => unknown;
  sale: Sale;
}) {
  const { language } = useLanguage();
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);
  if (!canReviewSale(sale.id)) return null;

  return (
    <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, gap: 8, padding: 10 }}>
      <Text selectable style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy("Satıcıyı değerlendir", language)}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {[5, 4, 3].map((item) => (
          <View key={item} style={{ flexBasis: "31%", flexGrow: 1 }}>
            <PrimaryButton tone={rating === item ? "soft" : "secondary"} onPress={() => setRating(item)}>{language === "en" ? `${item} stars` : `${item} yıldız`}</PrimaryButton>
          </View>
        ))}
      </View>
      <TextInput
        value={comment}
        onChangeText={setComment}
        multiline
        placeholder={language === "en" ? "How was the sales process, communication, and product information?" : "Satış süreci, iletişim ve ürün bilgisi nasıldı?"}
        placeholderTextColor={colors.muted}
        style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, minHeight: 74, padding: 10, textAlignVertical: "top" }}
      />
      <PrimaryButton tone="secondary" onPress={() => { if (comment.trim()) createSaleReview(sale.id, rating, comment.trim()); }}>Yorumu kaydet</PrimaryButton>
    </View>
  );
}

function partnerClickEstimate(totalLeadCount: number, partnerCount: number, ownLeadCount: number) {
  const sharedDemand = partnerCount > 0 ? Math.round((totalLeadCount * 18) / partnerCount) : ownLeadCount * 24;
  return Math.max(ownLeadCount * 12, sharedDemand, 0);
}

function PartnerActionBand({
  active,
  leadCount,
  onCopy,
  onShare,
  sellerPaidCount
}: {
  active: boolean;
  leadCount: number;
  onCopy: () => void;
  onShare: () => void;
  sellerPaidCount: number;
}) {
  const { language } = useLanguage();
  const label = !active
    ? "Satıcı onayı bekleniyor"
    : sellerPaidCount > 0
      ? "Ödeme onayı ver"
      : leadCount > 0
        ? "Talepleri takip et"
        : "Linkini paylaş";
  const body = !active
    ? "Onaylanınca paylaşım bağlantın açılır."
    : sellerPaidCount > 0
      ? "Satıcı ödeme bildirdi; aldıysan komisyonu kapat."
      : leadCount > 0
        ? "Müşterilerin durumunu ve satışa dönüşünü izle."
        : "İlk müşteriyi getirmek için bağlantını paylaş.";

  return (
    <View style={{ backgroundColor: active ? colors.infoSoft : colors.warningSoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1, gap: 9, padding: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name={active ? "rocket-launch-outline" : "clock-outline"} size={20} color={active ? colors.info : colors.warning} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} selectable style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>
            {translateCopy("Sıradaki aksiyon", language)}: {translateCopy(label, language)}
          </Text>
          <Text numberOfLines={2} selectable style={{ color: colors.muted, fontSize: 11, fontWeight: "800", lineHeight: 15 }}>
            {translateCopy(body, language)}
          </Text>
        </View>
      </View>
      {active ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton tone="secondary" icon="content-copy" onPress={onCopy}>Bağlantıyı Kopyala</PrimaryButton>
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton tone="soft" icon="share-variant-outline" onPress={onShare}>Paylaş</PrimaryButton>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function PanelFilterChip({ active, icon, label, onPress }: { active?: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  const { language } = useLanguage();
  const translatedLabel = translateCopy(label, language);
  const width = Math.min(142, Math.max(82, translatedLabel.length * 8 + 42));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? colors.info : colors.surface,
        borderColor: active ? colors.info : colors.line,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: "row",
        gap: 6,
        justifyContent: "center",
        minHeight: 38,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 10,
        width
      })}
    >
      <MaterialCommunityIcons name={icon} size={15} color={active ? "#FFFFFF" : colors.info} />
      <Text adjustsFontSizeToFit minimumFontScale={0.84} numberOfLines={1} style={{ color: active ? "#FFFFFF" : colors.ink, flex: 1, fontSize: 13, fontWeight: "900" }}>
        {translatedLabel}
      </Text>
    </Pressable>
  );
}
