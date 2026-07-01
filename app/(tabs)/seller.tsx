import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { Card, EmptyState, Metric, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { commissionAmount, money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { searchKey } from "@/lib/locale";
import { displayText } from "@/lib/text";
import { calculateUserTrustScores } from "@/lib/trust-score";
import type { Lead, LeadSource, Listing, Partnership, PurchaseIntent, Sale, SaleStatus } from "@/lib/types";
import { useStore } from "@/lib/use-store";
import { WebContainer } from "@/components/web-container";

const saleLabels: Record<SaleStatus, string> = {
  pending: "Bekliyor",
  return_pending: "İade süresi",
  approved: "Onaylandı",
  seller_paid: "Satıcı ödedi",
  paid: "Ortak onayladı",
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

type SellerFilter = "all" | "needsAction" | "active" | "paused" | "withLeads" | "applications" | "payments" | "lowStock";

export default function SellerScreen() {
  const { language, t } = useLanguage();
  const router = useRouter();
  const {
    approvePartnership,
    canReviewSale,
    createSaleReview,
    createSaleFromLead,
    currentUser,
    findUser,
    leads,
    listings,
    partnerships,
    rejectPartnership,
    reports,
    reviews,
    sales,
    startConversation,
    updateLeadStatus,
    updateListingStatus,
    updateSaleStatus
  } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SellerFilter>("all");
  const myListings = listings.filter((listing) => listing.ownerId === currentUser.id && listing.status !== "rejected");
  const myListingIds = new Set(myListings.map((listing) => listing.id));
  const myLeads = leads.filter((lead) => myListingIds.has(lead.listingId));
  const mySales = sales.filter((sale) => myListingIds.has(sale.listingId));
  const myApplications = partnerships.filter((partnership) => myListingIds.has(partnership.listingId) && partnership.status === "pending");
  const openCommission = mySales.filter((sale) => sale.status !== "paid").reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const paidCommission = mySales.filter((sale) => sale.status === "paid").reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const newLeads = myLeads.filter((lead) => lead.status === "new");
  const contactedLeads = myLeads.filter((lead) => lead.status === "contacted");
  const convertedLeads = myLeads.filter((lead) => lead.status === "converted");
  const unpaidSales = mySales.filter((sale) => sale.status !== "paid");
  const lowStockListings = myListings.filter((listing) => listing.status === "active" && listing.stockCount <= 3);
  const activePartnerCount = partnerships.filter((partnership) => myListingIds.has(partnership.listingId) && partnership.status === "active").length;
  const totalActionCount = newLeads.length + myApplications.length + unpaidSales.length + lowStockListings.length;
  const totalConversionRate = myLeads.length > 0 ? Math.round((convertedLeads.length / myLeads.length) * 100) : 0;
  const sellerHealth =
    totalActionCount === 0
      ? { label: "Panel temiz", tone: "success" as const, detail: "Yeni aksiyon yok; ilan ve ortak performansını izlemeye devam et." }
      : { label: "Aksiyon gerekli", tone: "warning" as const, detail: "Başvuru, talep, ödeme veya stok bekleyen işleri sırayla kapat." };
  const tokens = searchKey(query).split(" ").filter(Boolean);
  const visibleListings = myListings.filter((listing) => {
    const listingLeads = myLeads.filter((lead) => lead.listingId === listing.id);
    const listingSales = mySales.filter((sale) => sale.listingId === listing.id);
    const pendingApplications = partnerships.filter((partnership) => partnership.listingId === listing.id && partnership.status === "pending");
    const listingNeedsAction =
      listingLeads.some((lead) => lead.status === "new") ||
      listingSales.some((sale) => sale.status !== "paid") ||
      listing.stockCount <= 3 ||
      pendingApplications.length > 0;
    if (filter === "needsAction" && !listingNeedsAction) return false;
    if (filter === "active" && listing.status !== "active") return false;
    if (filter === "paused" && listing.status !== "paused") return false;
    if (filter === "withLeads" && listingLeads.length === 0) return false;
    if (filter === "applications" && pendingApplications.length === 0) return false;
    if (filter === "payments" && !listingSales.some((sale) => sale.status === "approved" || sale.status === "seller_paid" || sale.status === "return_pending" || sale.status === "disputed")) return false;
    if (filter === "lowStock" && !(listing.status === "active" && listing.stockCount <= 3)) return false;
    if (tokens.length === 0) return true;
    const haystack = searchKey([listing.title, listing.category, listing.location, listing.description, ...listing.tags].join(" "));
    return tokens.every((token) => haystack.includes(token));
  }).sort((a, b) => sellerPriority(b, myLeads, mySales, partnerships) - sellerPriority(a, myLeads, mySales, partnerships));

  function convertLead(leadId: string) {
    const sale = createSaleFromLead(leadId);
    if (!sale) {
      Alert.alert(t("saleCreateFailed"), t("saleCreateFailedBody"));
      return;
    }
    Alert.alert(t("saleApproved"), t("saleApprovedBody"));
  }

  function confirmConvertLead(leadId: string) {
    Alert.alert(translateCopy("Satışa Çevir", language), t("convertLeadConfirmBody"), [
      { text: t("cancel"), style: "cancel" },
      { text: translateCopy("Satışa Çevir", language), onPress: () => convertLead(leadId) }
    ]);
  }

  function confirmRejectPartnership(partnershipId: string) {
    Alert.alert(t("rejectApplication"), t("rejectApplicationBody"), [
      { text: t("cancel"), style: "cancel" },
      { text: translateCopy("Reddet", language), style: "destructive", onPress: () => rejectPartnership(partnershipId) }
    ]);
  }

  function confirmPaidSale(saleId: string) {
    Alert.alert(t("commissionPaidQuestion"), t("commissionPaidQuestionBody"), [
      { text: t("cancel"), style: "cancel" },
      { text: translateCopy("Ödendi Bildir", language), onPress: () => updateSaleStatus(saleId, "seller_paid") }
    ]);
  }

  function confirmRemoveListing(listingId: string) {
    Alert.alert(t("removeListingQuestion"), t("removeListingQuestionBody"), [
      { text: t("cancel"), style: "cancel" },
      { text: translateCopy("Kaldır", language), style: "destructive", onPress: () => updateListingStatus(listingId, "rejected") }
    ]);
  }

  function openConversation(listingId: string, receiverId: string | undefined, body: string) {
    if (!receiverId) return;
    const conversation = startConversation(listingId, receiverId, body);
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 12, paddingBottom: 96 }}>
      <WebContainer max={1200} padding={0} style={{ gap: 14 }}>
      <Card>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 48, justifyContent: "center", width: 48 }}>
            <MaterialCommunityIcons name="storefront" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <Text selectable numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 20, fontWeight: "900" }}>
                {translateCopy("Satıcı paneli", language)}
              </Text>
              <StatusPill label={sellerHealth.label} tone={sellerHealth.tone} />
            </View>
            <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
              {t("sellerPanelBody")}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <Metric label="Başvuru" value={`${myApplications.length}`} />
          <Metric label="Açık komisyon" value={money(openCommission)} />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Metric label="Ödenen" value={money(paidCommission)} />
          <Metric label="Aktif ilan" value={`${myListings.filter((listing) => listing.status === "active").length}`} />
        </View>
        <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800", lineHeight: 18 }}>
          {translateCopy(sellerHealth.detail, language)}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton href="/create" icon="store-plus-outline">{translateCopy("Yeni ilan aç", language)}</PrimaryButton>
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton href={{ pathname: "/store/[id]", params: { id: currentUser.id } }} tone="secondary" icon="store-search-outline">
              {translateCopy("Mağazam", language)}
            </PrimaryButton>
          </View>
        </View>
      </Card>

      <Card>
        <SectionTitle title="Bugün dikkat isteyenler" action={`${newLeads.length + myApplications.length + unpaidSales.length + lowStockListings.length} ${t("taskShort")}`} />
        <View style={{ gap: 8 }}>
          <TaskRow icon="account-plus-outline" label={translateCopy("Yeni ortak başvurusu", language)} value={`${myApplications.length}`} tone={myApplications.length ? "warning" : "neutral"} />
          <TaskRow icon="account-clock-outline" label={translateCopy("Yeni müşteri talebi", language)} value={`${newLeads.length}`} tone={newLeads.length ? "warning" : "neutral"} />
          <TaskRow icon="cash-clock" label={translateCopy("Ödeme bekleyen komisyon", language)} value={`${unpaidSales.length}`} tone={unpaidSales.length ? "warning" : "neutral"} />
          <TaskRow icon="package-variant" label={translateCopy("Az stoklu ilan", language)} value={`${lowStockListings.length}`} tone={lowStockListings.length ? "warning" : "neutral"} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <View style={{ flexBasis: "47%", flexGrow: 1 }}>
            <PrimaryButton tone={filter === "applications" ? "soft" : "secondary"} icon="account-plus-outline" onPress={() => setFilter("applications")}>Başvuruları Gör</PrimaryButton>
          </View>
          <View style={{ flexBasis: "47%", flexGrow: 1 }}>
            <PrimaryButton tone={filter === "withLeads" ? "soft" : "secondary"} icon="phone-in-talk-outline" onPress={() => setFilter("withLeads")}>Talepleri Ara</PrimaryButton>
          </View>
          <View style={{ flexBasis: "47%", flexGrow: 1 }}>
            <PrimaryButton tone={filter === "payments" ? "soft" : "secondary"} icon="cash-check" onPress={() => setFilter("payments")}>Komisyon Öde</PrimaryButton>
          </View>
          <View style={{ flexBasis: "47%", flexGrow: 1 }}>
            <PrimaryButton tone={filter === "lowStock" ? "soft" : "secondary"} icon="package-variant-closed" onPress={() => setFilter("lowStock")}>Stok Güncelle</PrimaryButton>
          </View>
        </View>
      </Card>

      <Card>
        <SectionTitle title="Satış hattı" action={`${totalConversionRate}%`} />
        <SellerPipeline
          activePartners={activePartnerCount}
          applications={myApplications.length}
          leads={myLeads.length}
          paidSales={mySales.filter((sale) => sale.status === "paid").length}
          sales={mySales.length}
          unpaidSales={unpaidSales.length}
        />
      </Card>

      <Card>
        <SectionTitle title="Operasyon özeti" action={`${newLeads.length + myApplications.length + unpaidSales.length} ${translateCopy("aksiyon", language)}`} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <OperationTile icon="account-clock-outline" label="Yeni talep" tone={newLeads.length ? "warning" : "neutral"} value={`${newLeads.length}`} />
          <OperationTile icon="phone-check-outline" label="Aranan" tone="neutral" value={`${contactedLeads.length}`} />
          <OperationTile icon="cart-check" label="Satış" tone={convertedLeads.length ? "success" : "neutral"} value={`${convertedLeads.length}`} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <OperationTile icon="cash-clock" label="Ödeme bekleyen" tone={unpaidSales.length ? "warning" : "neutral"} value={`${unpaidSales.length}`} />
          <OperationTile icon="package-variant" label="Az stok" tone={lowStockListings.length ? "warning" : "neutral"} value={`${lowStockListings.length}`} />
          <OperationTile icon="account-plus-outline" label="Başvuru" tone={myApplications.length ? "warning" : "neutral"} value={`${myApplications.length}`} />
        </View>
      </Card>

      <Card>
        <SectionTitle title="İlan yönetimi" action={`${visibleListings.length}`} />
        <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 48, paddingHorizontal: 12 }}>
          <MaterialCommunityIcons name="magnify" size={21} color={colors.primary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("sellerSearchPlaceholder")}
            placeholderTextColor={colors.muted}
            style={{ color: colors.ink, flex: 1, fontSize: 15, minHeight: 46, paddingVertical: 8 }}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Aramayı temizle">
              <MaterialCommunityIcons name="close-circle" size={19} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          <PanelFilterChip active={filter === "all"} icon="view-grid" label="Tümü" onPress={() => setFilter("all")} />
          <PanelFilterChip active={filter === "needsAction"} icon="alert-circle-outline" label="Aksiyon" onPress={() => setFilter("needsAction")} />
          <PanelFilterChip active={filter === "active"} icon="check-circle-outline" label="Aktif" onPress={() => setFilter("active")} />
          <PanelFilterChip active={filter === "paused"} icon="pause-circle-outline" label="Pasif" onPress={() => setFilter("paused")} />
          <PanelFilterChip active={filter === "withLeads"} icon="account-clock-outline" label="Talepli" onPress={() => setFilter("withLeads")} />
          <PanelFilterChip active={filter === "payments"} icon="cash-clock" label="Ödeme" onPress={() => setFilter("payments")} />
          <PanelFilterChip active={filter === "lowStock"} icon="package-variant" label="Az stok" onPress={() => setFilter("lowStock")} />
        </ScrollView>
      </Card>

      {myApplications.length > 0 ? (
        <Card>
          <SectionTitle title="Ortak başvuruları" action={`${myApplications.length}`} />
          {myApplications.map((application) => {
            const listing = listings.find((item) => item.id === application.listingId);
            const partner = findUser(application.partnerId);
            const partnerTrust = partner ? calculateUserTrustScores({ leads, listings, partnerships, reports, reviews, sales, user: partner }).partner : undefined;
            return (
              <View key={application.id} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, gap: 8, padding: 12 }}>
                <Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>
                  {displayText(partner?.name, translateCopy("Kullanıcı", language))} · {displayText(listing?.title)}
                </Text>
                <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                  {application.note}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <StatusPill label={application.shareChannel || t("channelMissingShort")} />
                  <StatusPill label={application.platformHandle || t("accountMissing")} tone="info" />
                  <StatusPill label={`${application.reachEstimate ?? 0} ${t("reach")}`} tone="info" />
                </View>
                {application.audience ? (
                  <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                    {t("targetAudience")}: {application.audience}
                  </Text>
                ) : null}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Metric label="Ortak puanı" value={`${partner?.rating ?? 0}`} />
                  <Metric label="Ortak güveni" value={partnerTrust ? `%${partnerTrust.score}` : "-"} />
                  <Metric label="Min. puan" value={`${listing?.minPartnerRating ?? 0}`} />
                </View>
                {partnerTrust ? <StatusPill label={partnerTrust.label} tone={partnerTrust.score >= 70 ? "success" : "warning"} /> : null}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton tone="soft" onPress={() => approvePartnership(application.id)}>Kabul Et</PrimaryButton>
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton tone="secondary" onPress={() => confirmRejectPartnership(application.id)}>Reddet</PrimaryButton>
                  </View>
                </View>
                <PrimaryButton
                  tone="secondary"
                  icon="message-text-outline"
                  onPress={() => openConversation(application.listingId, application.partnerId, `${displayText(listing?.title)} ortaklık başvurun hakkında konuşalım.`)}
                >
                  Ortağa mesaj yaz
                </PrimaryButton>
              </View>
            );
          })}
        </Card>
      ) : null}

      {myListings.length === 0 ? (
        <Card>
          <EmptyState title={t("noSellerListings")} body={t("noSellerListingsBody")} />
          <PrimaryButton href="/create" icon="store-plus-outline">Yeni ilan aç</PrimaryButton>
        </Card>
      ) : null}
      {myListings.length > 0 && visibleListings.length === 0 ? (
        <EmptyState title={t("noResults")} body={t("sellerNoResultBody")} />
      ) : null}

      {visibleListings.map((listing) => {
        const listingPartnerships = partnerships.filter((partnership) => partnership.listingId === listing.id);
        const listingLeads = myLeads.filter((lead) => lead.listingId === listing.id);
        const listingSales = mySales.filter((sale) => sale.listingId === listing.id);
        const activePartners = listingPartnerships.filter((item) => item.status === "active").length;
        const pendingPartners = listingPartnerships.filter((item) => item.status === "pending").length;
        const unpaidListingSales = listingSales.filter((sale) => sale.status !== "paid");
        const convertedListingLeads = listingLeads.filter((lead) => lead.status === "converted").length;
        const conversionRate = listingLeads.length > 0 ? Math.round((convertedListingLeads / listingLeads.length) * 100) : 0;
        const nextAction = sellerNextAction(listing, listingLeads, listingSales, pendingPartners);
        const hasSaleForLead = (leadId: string) => listingSales.some((sale) => sale.leadId === leadId);

        return (
          <Card key={listing.id}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <Image source={{ uri: listing.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 64, width: 64 }} />
              <View style={{ flex: 1, gap: 5 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  <Text selectable numberOfLines={2} style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900", lineHeight: 22 }}>
                    {displayText(listing.title)}
                  </Text>
                  <StatusPill label={listing.status === "active" ? "Aktif" : listing.status === "paused" ? "Pasif" : "Satıldı"} tone={listing.status === "active" ? "success" : "warning"} />
                </View>
                <Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
                  {translateCopy(displayText(listing.category), language)} · {displayText(listing.location)} · {translateCopy(listing.partnershipMode === "open" ? "Anında ortaklık" : listing.partnershipMode === "approval" ? "Onaylı ortaklık" : "Davetli ortaklık", language)}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <StatusPill label={nextAction.label} tone={nextAction.tone} />
                  {pendingPartners > 0 ? <StatusPill label={`${pendingPartners} başvuru`} tone="warning" /> : null}
                </View>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Metric label="Fiyat" value={money(listing.price)} />
              <Metric label="Komisyon" value={money(commissionAmount(listing))} />
              <Metric label="Stok" value={`${listing.stockCount}`} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Metric label="Ödeme vadesi" value={`${listing.commissionDueDays} gün`} />
              <Metric label="İade penceresi" value={`${listing.returnWindowDays} gün`} />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <InsightTile label="Dönüşüm" value={`%${conversionRate}`} tone={conversionRate >= 30 ? "success" : conversionRate > 0 ? "warning" : "neutral"} />
              <InsightTile label="Aktif ortak" value={`${activePartners}`} tone={activePartners > 0 ? "success" : "warning"} />
              <InsightTile label="Bekleyen ödeme" value={money(unpaidListingSales.reduce((sum, sale) => sum + sale.commissionAmount, 0))} tone={unpaidListingSales.length ? "warning" : "neutral"} />
            </View>
            <SellerActionBand
              listing={listing}
              newLeadCount={listingLeads.filter((lead) => lead.status === "new").length}
              nextAction={nextAction}
              pendingPartners={pendingPartners}
              unpaidSaleCount={unpaidListingSales.length}
              updateListingStatus={updateListingStatus}
              setFilter={setFilter}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                <PrimaryButton tone={listing.status === "active" ? "secondary" : "soft"} onPress={() => updateListingStatus(listing.id, listing.status === "active" ? "paused" : "active")}>
                  {listing.status === "active" ? "Pasife Al" : "Aktifleştir"}
                </PrimaryButton>
              </View>
              <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                <PrimaryButton href={{ pathname: "/listing-edit/[id]", params: { id: listing.id } }} tone="soft">Düzenle</PrimaryButton>
              </View>
              <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                <PrimaryButton href={`/listing/${listing.id}`} tone="secondary">Detay</PrimaryButton>
              </View>
              <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                <PrimaryButton tone="danger" onPress={() => confirmRemoveListing(listing.id)}>Kaldır</PrimaryButton>
              </View>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <StatusPill label={`${listingPartnerships.filter((item) => item.status === "active").length} aktif ortak`} />
              <StatusPill label={`${listingLeads.length} talep`} />
              <StatusPill label={`${listingSales.length} satış`} />
              {listing.stockCount <= 3 && listing.status === "active" ? <StatusPill label="Az stok" tone="warning" /> : null}
            </View>

            <SectionTitle title="Gelen talepler" action={`${listingLeads.length}`} />
            {listingLeads.length === 0 ? <Text selectable style={{ color: colors.muted, fontSize: 14 }}>Bu ilana henüz talep gelmedi.</Text> : null}
            {listingLeads
              .slice()
              .sort((a, b) => leadPriority(b) - leadPriority(a))
              .map((lead) => {
                const partnership = partnerships.find((item) => item.id === lead.partnershipId);
                const partner = partnership ? findUser(partnership.partnerId) : undefined;
                return (
                  <View key={lead.id} style={{ backgroundColor: lead.status === "new" ? colors.warningSoft : colors.surfaceAlt, borderRadius: 8, gap: 8, padding: 12 }}>
                    <Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>
                      {lead.buyerName} · {lead.buyerPhone}
                    </Text>
                    <Text selectable style={{ color: colors.muted, fontSize: 13 }}>{translateCopy("Ortak", language)}: {partner?.name ?? translateCopy("Bilinmiyor", language)}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      <StatusPill label={sourceLabels[lead.source]} />
                      <StatusPill label={intentLabels[lead.intent]} tone={lead.intent === "hot" ? "warning" : "info"} />
                      <StatusPill label={lead.status === "converted" ? "Satışa döndü" : lead.status === "interested" ? "İlgileniyor" : lead.status === "contacted" ? "Arandı" : lead.status === "lost" ? "Kayıp" : "Yeni"} tone={lead.status === "converted" ? "success" : "info"} />
                    </View>
                    <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{lead.note}</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton tone="secondary" onPress={() => updateLeadStatus(lead.id, "contacted")}>Arandı</PrimaryButton>
                      </View>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton tone="secondary" onPress={() => updateLeadStatus(lead.id, "interested")}>İlgileniyor</PrimaryButton>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton tone="secondary" onPress={() => updateLeadStatus(lead.id, "lost")}>Kayıp</PrimaryButton>
                      </View>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton tone="secondary" onPress={() => openConversation(listing.id, partnership?.partnerId, `${lead.buyerName} talebi hakkında konuşalım. Kaynak: ${sourceLabels[lead.source]}, durum: ${lead.status}.`)}>Mesaj</PrimaryButton>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton tone={hasSaleForLead(lead.id) ? "soft" : "primary"} onPress={() => (hasSaleForLead(lead.id) ? undefined : confirmConvertLead(lead.id))}>
                          {hasSaleForLead(lead.id) ? "Satış Kaydı Var" : "Satışa Çevir"}
                        </PrimaryButton>
                      </View>
                    </View>
                  </View>
                );
              })}

            {listingSales.length > 0 ? <SectionTitle title="Komisyon ödemeleri" /> : null}
            {listingSales.map((sale) => (
              <View key={sale.id} style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 10, paddingTop: 12 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Metric label="Satış" value={money(sale.amount)} />
                  <Metric label="Komisyon" value={money(sale.commissionAmount)} />
                </View>
                <StatusPill label={saleLabels[sale.status]} tone={sale.status === "paid" ? "success" : "warning"} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Metric label="Adet" value={`${sale.quantity ?? 1}`} />
                  <Metric label="Teslim" value={sale.deliveryStatus === "delivered" ? "Teslim" : sale.deliveryStatus === "cancelled" ? "İptal" : "Bekliyor"} />
                  <Metric label="İade sonu" value={sale.returnUntil ?? "-"} />
                </View>
                {sale.payoutNote ? (
                  <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                    {sale.payoutNote}
                  </Text>
                ) : null}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton tone="secondary" onPress={() => updateSaleStatus(sale.id, "approved")}>İade Bitti</PrimaryButton>
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton tone="soft" onPress={() => confirmPaidSale(sale.id)}>Ödendi Bildir</PrimaryButton>
                  </View>
                </View>
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
      <Text selectable style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy("Ortağı değerlendir", language)}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {[5, 4, 3].map((item) => (
          <View key={item} style={{ flexBasis: "31%", flexGrow: 1 }}>
            <PrimaryButton tone={rating === item ? "soft" : "secondary"} onPress={() => setRating(item)}>{item} {translateCopy("yıldız", language)}</PrimaryButton>
          </View>
        ))}
      </View>
      <TextInput
        value={comment}
        onChangeText={setComment}
        multiline
        placeholder={translateCopy("Ortak satıcı alıcıyı doğru yönlendirdi mi?", language)}
        placeholderTextColor={colors.muted}
        style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, minHeight: 74, padding: 10, textAlignVertical: "top" }}
      />
      <PrimaryButton tone="secondary" onPress={() => { if (comment.trim()) createSaleReview(sale.id, rating, comment.trim()); }}>Yorumu kaydet</PrimaryButton>
    </View>
  );
}

function sellerPriority(listing: Listing, leads: Lead[], sales: Sale[], partnerships: Partnership[]) {
  const listingLeads = leads.filter((lead) => lead.listingId === listing.id);
  const listingSales = sales.filter((sale) => sale.listingId === listing.id);
  const pendingApplications = partnerships.filter((partnership) => partnership.listingId === listing.id && partnership.status === "pending").length;
  const newLeadScore = listingLeads.filter((lead) => lead.status === "new").length * 40;
  const hotLeadScore = listingLeads.filter((lead) => lead.intent === "hot" && lead.status !== "converted").length * 14;
  const unpaidScore = listingSales.filter((sale) => sale.status !== "paid").length * 18;
  const stockScore = listing.status === "active" && listing.stockCount <= 3 ? 12 : 0;

  return newLeadScore + hotLeadScore + unpaidScore + pendingApplications * 10 + stockScore;
}

function sellerNextAction(listing: Listing, leads: Lead[], sales: Sale[], pendingPartners: number): { label: string; tone: "info" | "success" | "warning" } {
  if (leads.some((lead) => lead.status === "new" && lead.intent === "hot")) return { label: "Sıcak talebi ara", tone: "warning" };
  if (leads.some((lead) => lead.status === "new")) return { label: "Yeni talebi işle", tone: "warning" };
  if (pendingPartners > 0) return { label: "Başvuruyu değerlendir", tone: "warning" };
  if (sales.some((sale) => sale.status !== "paid")) return { label: "Komisyonu kapat", tone: "warning" };
  if (listing.status === "active" && listing.stockCount <= 3) return { label: "Stok kontrolü", tone: "warning" };
  if (listing.status !== "active") return { label: "Yayına almayı değerlendir", tone: "info" };
  return { label: "Akış temiz", tone: "success" };
}

function leadPriority(lead: { intent: PurchaseIntent; status: string }) {
  const statusScore = lead.status === "new" ? 30 : lead.status === "contacted" ? 20 : lead.status === "converted" ? 5 : 0;
  const intentScore = lead.intent === "hot" ? 10 : lead.intent === "warm" ? 5 : 1;
  return statusScore + intentScore;
}

function SellerPipeline({
  activePartners,
  applications,
  leads,
  paidSales,
  sales,
  unpaidSales
}: {
  activePartners: number;
  applications: number;
  leads: number;
  paidSales: number;
  sales: number;
  unpaidSales: number;
}) {
  const { language } = useLanguage();
  const maxValue = Math.max(1, applications, activePartners, leads, sales, paidSales + unpaidSales);
  const rows = [
    { icon: "account-plus-outline" as const, label: "Başvuru", value: applications, helper: "Satıcı onayı bekleyen ortaklar", tone: applications > 0 ? "warning" : "neutral" },
    { icon: "handshake-outline" as const, label: "Aktif ortak", value: activePartners, helper: "Linki açık ortak satıcılar", tone: activePartners > 0 ? "success" : "neutral" },
    { icon: "account-clock-outline" as const, label: "Talep", value: leads, helper: "Ortak linkten gelen müşteriler", tone: leads > 0 ? "success" : "neutral" },
    { icon: "cart-check" as const, label: "Satış", value: sales, helper: "Satışa çevrilen talepler", tone: sales > 0 ? "success" : "neutral" },
    { icon: "cash-clock" as const, label: "Komisyon", value: paidSales + unpaidSales, helper: unpaidSales > 0 ? "Ödeme bekleyen komisyon var" : "Komisyon kuyruğu temiz", tone: unpaidSales > 0 ? "warning" : paidSales > 0 ? "success" : "neutral" }
  ];

  return (
    <View style={{ gap: 10 }}>
      {rows.map((row) => {
        const color = row.tone === "warning" ? colors.warning : row.tone === "success" ? colors.success : colors.primary;
        const width = `${Math.max(8, Math.round((row.value / maxValue) * 100))}%` as const;

        return (
          <View key={row.label} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, gap: 8, padding: 10 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <MaterialCommunityIcons name={row.icon} size={18} color={color} />
              <Text selectable numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900" }}>
                {translateCopy(row.label, language)}
              </Text>
              <Text selectable numberOfLines={1} style={{ color, fontSize: 15, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
                {row.value}
              </Text>
            </View>
            <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 7, overflow: "hidden" }}>
              <View style={{ backgroundColor: color, borderRadius: 999, height: "100%", width }} />
            </View>
            <Text selectable numberOfLines={2} style={{ color: colors.muted, fontSize: 11, fontWeight: "800", lineHeight: 15 }}>
              {translateCopy(row.helper, language)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function SellerActionBand({
  listing,
  newLeadCount,
  nextAction,
  pendingPartners,
  setFilter,
  unpaidSaleCount,
  updateListingStatus
}: {
  listing: Listing;
  newLeadCount: number;
  nextAction: { label: string; tone: "info" | "success" | "warning" };
  pendingPartners: number;
  setFilter: (filter: SellerFilter) => void;
  unpaidSaleCount: number;
  updateListingStatus: (listingId: string, status: Listing["status"]) => void;
}) {
  const { language } = useLanguage();
  const primaryAction =
    pendingPartners > 0
      ? { icon: "account-plus-outline" as const, label: "Başvuruları Gör", onPress: () => setFilter("applications") }
      : newLeadCount > 0
        ? { icon: "phone-in-talk-outline" as const, label: "Talepleri Ara", onPress: () => setFilter("withLeads") }
        : unpaidSaleCount > 0
          ? { icon: "cash-check" as const, label: "Komisyon Öde", onPress: () => setFilter("payments") }
          : listing.status === "active" && listing.stockCount <= 3
            ? { icon: "package-variant-closed" as const, label: "Stok Güncelle", onPress: () => setFilter("lowStock") }
            : listing.status !== "active"
              ? { icon: "play-circle-outline" as const, label: "Aktifleştir", onPress: () => updateListingStatus(listing.id, "active") }
              : { icon: "eye-outline" as const, label: "Detayı İncele", onPress: () => setFilter("all") };

  return (
    <View style={{ backgroundColor: nextAction.tone === "warning" ? colors.warningSoft : colors.primarySoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1, gap: 9, padding: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name={primaryAction.icon} size={20} color={nextAction.tone === "warning" ? colors.warning : colors.primaryDark} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} selectable style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>
            {translateCopy("Sıradaki aksiyon", language)}: {translateCopy(nextAction.label, language)}
          </Text>
          <Text numberOfLines={1} selectable style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>
            {pendingPartners} {translateCopy("başvuru", language)} · {newLeadCount} {translateCopy("yeni talep", language)} · {unpaidSaleCount} {translateCopy("ödeme", language)}
          </Text>
        </View>
      </View>
      <PrimaryButton tone={nextAction.tone === "warning" ? "soft" : "secondary"} icon={primaryAction.icon} onPress={primaryAction.onPress}>
        {primaryAction.label}
      </PrimaryButton>
    </View>
  );
}

function TaskRow({
  icon,
  label,
  tone,
  value
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  tone: "warning" | "neutral";
  value: string;
}) {
  const { language } = useLanguage();
  const active = tone === "warning";

  return (
    <View style={{ alignItems: "center", backgroundColor: active ? colors.warningSoft : colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 44, paddingHorizontal: 10, paddingVertical: 8 }}>
      <View style={{ alignItems: "center", backgroundColor: active ? "#FFFFFF" : colors.surface, borderRadius: 8, height: 30, justifyContent: "center", width: 30 }}>
        <MaterialCommunityIcons name={icon} size={17} color={active ? colors.warning : colors.primary} />
      </View>
      <Text ellipsizeMode="tail" numberOfLines={1} selectable style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900" }}>
        {translateCopy(label, language)}
      </Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} selectable style={{ color: active ? colors.warning : colors.muted, fontSize: 16, fontVariant: ["tabular-nums"], fontWeight: "900", minWidth: 28, textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}

function OperationTile({
  icon,
  label,
  tone,
  value
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  tone: "warning" | "success" | "neutral";
  value: string;
}) {
  const { language } = useLanguage();
  const palette =
    tone === "warning"
      ? { backgroundColor: colors.warningSoft, color: colors.warning }
      : tone === "success"
        ? { backgroundColor: colors.successSoft, color: colors.success }
        : { backgroundColor: colors.surfaceAlt, color: colors.primary };

  return (
    <View style={{ backgroundColor: palette.backgroundColor, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flex: 1, gap: 6, padding: 10 }}>
      <MaterialCommunityIcons name={icon} size={19} color={palette.color} />
      <Text ellipsizeMode="tail" numberOfLines={2} selectable style={{ color: colors.muted, fontSize: 11, fontWeight: "800", lineHeight: 14, minHeight: 28 }}>
        {translateCopy(label, language)}
      </Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} selectable style={{ color: colors.ink, fontSize: 18, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
        {value}
      </Text>
    </View>
  );
}

function InsightTile({ label, tone, value }: { label: string; tone: "warning" | "success" | "neutral"; value: string }) {
  const { language } = useLanguage();
  const color = tone === "success" ? colors.success : tone === "warning" ? colors.warning : colors.muted;

  return (
    <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flex: 1, gap: 4, padding: 9 }}>
      <Text ellipsizeMode="tail" numberOfLines={1} selectable style={{ color: colors.muted, fontSize: 10, fontWeight: "800" }}>
        {translateCopy(label, language)}
      </Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} selectable style={{ color, fontSize: 14, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
        {value}
      </Text>
    </View>
  );
}

function PanelFilterChip({ active, icon, label, onPress }: { active?: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  const { language } = useLanguage();
  const translatedLabel = translateCopy(label, language);
  const width = Math.min(132, Math.max(82, translatedLabel.length * 8 + 42));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? colors.primary : colors.surface,
        borderColor: active ? colors.primary : colors.line,
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
      <MaterialCommunityIcons name={icon} size={15} color={active ? "#FFFFFF" : colors.primary} />
      <Text adjustsFontSizeToFit minimumFontScale={0.84} numberOfLines={1} style={{ color: active ? "#FFFFFF" : colors.ink, flex: 1, fontSize: 13, fontWeight: "900" }}>
        {translatedLabel}
      </Text>
    </Pressable>
  );
}
