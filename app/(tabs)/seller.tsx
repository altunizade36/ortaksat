import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { BulkListingModal } from "@/components/bulk-listing-modal";
import { colors } from "@/components/colors";
import { QuickStart } from "@/components/quick-start";
import { MiniBarChart } from "@/components/mini-bar-chart";
import { Card, EmptyState, Metric, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { commissionAmount, money, moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { loadClickCounts } from "@/lib/live-service";
import { autoFillListing, matchCategory } from "@/lib/listing-autofill";
import { searchKey } from "@/lib/locale";
import { matchesQuery } from "@/lib/search";
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
    createListing,
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});
  // Grafik yalnız istemcide (new Date) render edilsin — SSG hydration uyuşmazlığı olmasın.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Bildirim derin-linki (?focus=<listingId>): ilgili ilanın talep/ödeme yönetimini aç,
  // filtreleri temizle ve listede en üste al.
  const params = useLocalSearchParams<{ focus?: string }>();
  const focusId = Array.isArray(params.focus) ? params.focus[0] : params.focus;
  useEffect(() => {
    if (focusId) { setExpandedId(focusId); setFilter("all"); setQuery(""); }
  }, [focusId]);

  function handleBulkCreate(row: { title: string; price: number; commission: number; category: string; image: string }) {
    // Shopify-tarzı otomatik doldurma: başlık+kategori+fiyat+komisyondan
    // düzenlenebilir açıklama/argüman/etiket/paylaşım metni üretilir; serbest
    // yazılan kategori bilinen kategoriye eşlenir.
    const category = matchCategory(row.category) || row.category;
    const auto = autoFillListing({ title: row.title, category, price: row.price, commission: row.commission });
    createListing({
      title: row.title,
      description: auto.description,
      salesPitch: auto.salesPitch,
      shareTemplates: auto.shareTemplates,
      adAssets: [],
      tags: auto.tags,
      price: row.price,
      currency: "TRY",
      commissionType: "rate",
      commissionValue: row.commission,
      category,
      location: myListings[0]?.location || "Türkiye",
      image: row.image,
      stockCount: 1,
      minPartnerRating: 4,
      commissionDueDays: 3,
      returnWindowDays: 7,
      partnerRules: ["Komisyon sadece onaylı satış kaydında oluşur."],
      deliveryNote: "Teslimat ve ödeme satıcıyla alıcı arasında netleştirilir; Ortaksat para tutmaz.",
      contactMethod: "message",
      partnershipMode: "approval"
    });
  }
  const myListings = listings.filter((listing) => listing.ownerId === currentUser.id && listing.status !== "rejected");
  const myListingIds = new Set(myListings.map((listing) => listing.id));
  const myPartnershipIds = partnerships.filter((partnership) => myListingIds.has(partnership.listingId)).map((partnership) => partnership.id);
  const partnershipIdsKey = myPartnershipIds.join(",");

  useEffect(() => {
    if (!partnershipIdsKey) {
      setClickCounts({});
      return;
    }
    let mounted = true;
    void loadClickCounts(partnershipIdsKey.split(",")).then((counts) => {
      if (mounted) setClickCounts(counts);
    });
    return () => {
      mounted = false;
    };
  }, [partnershipIdsKey]);
  const myLeads = leads.filter((lead) => myListingIds.has(lead.listingId));
  // Son 14 gün gelen talep serisi (gerçek createdAt; istemci tarafında hesaplanır).
  const activitySeries = useMemo(() => {
    const now = new Date();
    const out: Array<{ label: string; value: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const value = myLeads.filter((l) => (l.createdAt ?? "").slice(0, 10) === key).length;
      out.push({ label: `${d.getDate()}.${d.getMonth() + 1}`, value });
    }
    return out;
  }, [myLeads]);
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
    return matchesQuery(listing, undefined, tokens);
  }).sort((a, b) => {
    // Derin-linkten gelen ilan her zaman en üstte.
    if (focusId) { if (a.id === focusId) return -1; if (b.id === focusId) return 1; }
    return sellerPriority(b, myLeads, mySales, partnerships) - sellerPriority(a, myLeads, mySales, partnerships);
  });

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
    // Eskiden tek seçenek "rejected" idi ve ilan panelden geri alınamayacak şekilde
    // kayboluyordu (tuzak). Artık geri alınabilir "Pasife Al" seçeneği burada sunulur.
    Alert.alert(
      translateCopy("İlanı kaldır", language),
      translateCopy(
        "\"Pasife Al\": ilan geçici gizlenir, istediğinde tek tuşla tekrar yayınlarsın. \"Kalıcı Kaldır\": ilan listenden çıkar, geri alınması için destek gerekir.",
        language
      ),
      [
        { text: t("cancel"), style: "cancel" },
        { text: translateCopy("Pasife Al", language), onPress: () => updateListingStatus(listingId, "paused") },
        { text: translateCopy("Kalıcı Kaldır", language), style: "destructive", onPress: () => updateListingStatus(listingId, "rejected") }
      ]
    );
  }

  function openConversation(listingId: string, receiverId: string | undefined, body: string) {
    if (!receiverId) return;
    const conversation = startConversation(listingId, receiverId, body);
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 12, paddingBottom: Platform.OS === "web" ? 28 : 96 }}>
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

      {mounted && myLeads.length > 0 ? (
        <MiniBarChart data={activitySeries} title="Son 14 gün · gelen talep" totalLabel={`${activitySeries.reduce((s, d) => s + d.value, 0)} talep`} />
      ) : null}

      <Card>
        <SectionTitle title="İlan yönetimi" action={`${visibleListings.length}`} />
        <Pressable
          onPress={() => setBulkOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Toplu ilan ekle"
          style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 13, paddingVertical: 8 }}
        >
          <MaterialCommunityIcons name="table-arrow-up" size={16} color={colors.primaryDark} />
          <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "900" }}>Toplu ilan ekle</Text>
        </Pressable>
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

      {myListings.length === 0 ? <QuickStart role="seller" /> : null}
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
        const listingClicks = listingPartnerships.reduce((sum, item) => sum + (clickCounts[item.id] ?? 0), 0);
        const nextAction = sellerNextAction(listing, listingLeads, listingSales, pendingPartners);
        const hasSaleForLead = (leadId: string) => listingSales.some((sale) => sale.leadId === leadId);

        const isExpanded = expandedId === listing.id;
        const unpaidTotal = unpaidListingSales.reduce((sum, sale) => sum + sale.commissionAmount, 0);
        return (
          <Card key={listing.id}>
            {/* Kompakt üst satır (Sahibinden tarzı): görsel · başlık · fiyat · durum */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Image source={{ uri: listing.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 10, height: 88, width: 88 }} />
              <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
                  <Text selectable numberOfLines={2} style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900", lineHeight: 20 }}>
                    {displayText(listing.title)}
                  </Text>
                  <StatusPill label={listing.status === "active" ? "Aktif" : listing.status === "paused" ? "Pasif" : "Satıldı"} tone={listing.status === "active" ? "success" : "warning"} />
                </View>
                <Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                  {translateCopy(displayText(listing.category), language)} · {displayText(listing.location)}
                </Text>
                <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{moneyIn(listing.price, listing.currency)}</Text>
                  <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>ortak kazancı {moneyIn(commissionAmount(listing), listing.currency)}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Tek satır kompakt istatistik şeridi */}
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 10, flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 10 }}>
              <SellerStat label="Stok" value={`${listing.stockCount}`} warn={listing.stockCount <= 3 && listing.status === "active"} />
              <SellerStat label="Aktif ortak" value={`${activePartners}`} />
              <SellerStat label="Link tıklama" value={`${listingClicks}`} />
              <SellerStat label="Talep" value={`${listingLeads.length}`} />
              <SellerStat label="Dönüşüm" value={`%${conversionRate}`} />
              <SellerStat label="Satış" value={`${listingSales.length}`} />
              <SellerStat label="Bekleyen ödeme" value={moneyIn(unpaidTotal, listing.currency)} warn={unpaidListingSales.length > 0} />
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <StatusPill label={nextAction.label} tone={nextAction.tone} />
              {pendingPartners > 0 ? <StatusPill label={`${pendingPartners} başvuru`} tone="warning" /> : null}
            </View>

            {/* Kompakt aksiyon satırı */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                <PrimaryButton href={{ pathname: "/listing-edit/[id]", params: { id: listing.id } }} tone="soft" icon="pencil-outline">Düzenle</PrimaryButton>
              </View>
              <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                <PrimaryButton tone={listing.status === "active" ? "secondary" : "soft"} icon={listing.status === "active" ? "pause" : "play"} onPress={() => updateListingStatus(listing.id, listing.status === "active" ? "paused" : "active")}>
                  {listing.status === "active" ? "Pasife Al" : "Aktifleştir"}
                </PrimaryButton>
              </View>
              <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                <PrimaryButton href={`/listing/${listing.id}`} tone="secondary" icon="eye-outline">Detay</PrimaryButton>
              </View>
              <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                <PrimaryButton tone="danger" icon="trash-can-outline" onPress={() => confirmRemoveListing(listing.id)}>Kaldır</PrimaryButton>
              </View>
            </View>

            {/* Talep & ödeme yönetimi: katlanır (varsayılan kapalı) */}
            {listingLeads.length > 0 || listingSales.length > 0 ? (
              <Pressable onPress={() => setExpandedId(isExpanded ? null : listing.id)} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 11 }}>
                <MaterialCommunityIcons name="clipboard-list-outline" size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "800" }}>Talep & ödeme yönetimi — {listingLeads.length} talep · {listingSales.length} satış</Text>
                <MaterialCommunityIcons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
              </Pressable>
            ) : (
              <Text selectable style={{ color: colors.subtle, fontSize: 12.5, fontWeight: "600" }}>Bu ilana henüz talep gelmedi. Ortak satışa açıkça paylaşarak ilk talebi al.</Text>
            )}

            {isExpanded ? (
            <>
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
                  <Metric label="Satış" value={moneyIn(sale.amount, listing.currency)} />
                  <Metric label="Komisyon" value={moneyIn(sale.commissionAmount, listing.currency)} />
                </View>
                <StatusPill label={saleLabels[sale.status]} tone={sale.status === "paid" ? "success" : "warning"} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Metric label="Adet" value={`${sale.quantity ?? 1}`} />
                  <Metric label="Teslim" value={sale.deliveryStatus === "delivered" ? "Teslim" : sale.deliveryStatus === "cancelled" ? "İptal" : "Bekliyor"} />
                  <Metric label="İade sonu" value={sale.returnUntil ?? "-"} />
                </View>
                {sale.payoutNote ? (
                  <Text selectable style={{ color: sale.status === "disputed" ? colors.accent : colors.muted, fontSize: 13, fontWeight: sale.status === "disputed" ? "800" : "400", lineHeight: 19 }}>
                    {sale.payoutNote}
                  </Text>
                ) : null}
                {sale.status === "paid" ? (
                  <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 8, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 9 }}>
                    <MaterialCommunityIcons name="check-circle" size={15} color={colors.success} />
                    <Text style={{ color: colors.success, fontSize: 12.5, fontWeight: "800" }}>Komisyon kapandı</Text>
                  </View>
                ) : sale.status === "disputed" ? (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}><PrimaryButton tone="soft" onPress={() => confirmPaidSale(sale.id)}>Yeniden Ödedim</PrimaryButton></View>
                    <View style={{ flex: 1 }}><PrimaryButton tone="secondary" onPress={() => updateSaleStatus(sale.id, "cancelled")}>İptal Et</PrimaryButton></View>
                  </View>
                ) : sale.status === "seller_paid" ? (
                  <View style={{ alignItems: "center", backgroundColor: colors.infoSoft, borderRadius: 8, paddingVertical: 9 }}>
                    <Text style={{ color: colors.info, fontSize: 12.5, fontWeight: "800" }}>Ortak onayı bekleniyor</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton tone="secondary" onPress={() => updateSaleStatus(sale.id, "approved")}>İade Bitti</PrimaryButton>
                    </View>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton tone="soft" onPress={() => confirmPaidSale(sale.id)}>Ödendi Bildir</PrimaryButton>
                    </View>
                  </View>
                )}
                <ReviewPrompt sale={sale} canReviewSale={canReviewSale} createSaleReview={createSaleReview} />
              </View>
            ))}
            </>
            ) : null}
          </Card>
        );
      })}
      </WebContainer>
      <BulkListingModal visible={bulkOpen} onClose={() => setBulkOpen(false)} onCreate={handleBulkCreate} />
    </ScrollView>
  );
}




function SellerStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={{ gap: 1, minWidth: 66 }}>
      <Text numberOfLines={1} style={{ color: warn ? colors.accent : colors.ink, fontSize: 14, fontWeight: "900" }}>{value}</Text>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>{label}</Text>
    </View>
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
