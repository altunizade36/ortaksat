import { MaterialCommunityIcons } from "@/components/icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";

import { Alert } from "@/lib/alert";

import { colors } from "@/components/colors";
import { StarRatingInput } from "@/components/star-rating-input";
import { ReasonModal } from "@/components/reason-modal";
import { RecordSaleModal } from "@/components/record-sale-modal";
import { CommissionOverrideModal } from "@/components/commission-override-modal";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { useIsWideWeb, useMounted } from "@/lib/layout";
import { QuickStart } from "@/components/quick-start";
import { MiniBarChart } from "@/components/mini-bar-chart";
import { Card, EmptyState, Metric, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { commissionAmount, effectiveCommissionAmount, money, moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { shareOrCopy } from "@/lib/share";
import { categoryConversion } from "@/lib/conversion";
import { useNativeRefresh } from "@/lib/use-native-refresh";
import { loadClickCounts } from "@/lib/live-service";
import { searchKey } from "@/lib/locale";
import { parseTrPrice } from "@/lib/validation";
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

// Komisyonu satıcıdan hâlâ "beklenen" satış: ödenmemiş, iptal ve anlaşmazlık hariç.
// (İptal/anlaşmazlık "bekleyen ödeme" sayılmamalı — aksi hâlde sonsuza dek nag eder.)
const saleIsOwed = (s: { status: SaleStatus }) => s.status !== "paid" && s.status !== "cancelled" && s.status !== "disputed";

export default function SellerScreen() {
  // Hidrasyon-gate (#418): SSG-verisiz ↔ istemci-veri uyuşmazlığı için mount'a
  // kadar iskelet.
  return useMounted() ? <SellerScreenInner /> : <ScreenSkeleton />;
}

function SellerScreenInner() {
  const { language, t } = useLanguage();
  const router = useRouter();
  const {
    approvePartnership,
    endPartnership,
    canReviewSale,
    createSaleReview,
    createSaleFromLead,
    recordSaleForPartner,
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
    removeListing,
    updateListingInventory,
    updateSaleStatus,
    recordBatchPayout,
    setPartnershipCommission,
    refreshMarketplace,
    refreshUserData,
    offers,
    sellerRespondOffer
  } = useStore();
  const { refreshing, onRefresh } = useNativeRefresh(() => Promise.all([refreshMarketplace(), refreshUserData()]));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SellerFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Kullanıcının ELLE kapattığı ilanlar (oto-açılmayı ezer).
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  // Toplu işlem: seçili ilan kimlikleri (Trendyol tarzı çoklu seçim).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isWideWeb = useIsWideWeb();
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [saleTarget, setSaleTarget] = useState<{ partnershipId: string; listingId: string; partnerName: string; price: number; currency?: string; commissionType: "rate" | "fixed"; commissionValue: number; leadId?: string } | null>(null);
  const [commissionTarget, setCommissionTarget] = useState<{ partnershipId: string; partnerName: string; currency?: string; defaultLabel: string; currentType?: "rate" | "fixed"; currentValue?: number } | null>(null);
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

  const myListings = listings.filter((listing) => listing.ownerId === currentUser.id && listing.status !== "rejected" && listing.status !== "archived");
  // Reddedilen ilanlar myListings'ten çıkarılır ama SATICI onları görmeli (eskiden sessizce
  // yok oluyorlardı — neden/düzenle/yeniden-gönder yoktu). Ayrı bir uyarı bölümünde gösterilir.
  const rejectedListings = listings.filter((listing) => listing.ownerId === currentUser.id && listing.status === "rejected");
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
  // Yanıt bekleyen teklifler (en yenisi üstte) — satıcının en aksiyon-gerektiren işi.
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const pendingOffers = offers
    .filter((o) => o.sellerId === currentUser.id && o.status === "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Kabul edilenler "Anlaşmalar" bölümünde kalır — yoksa kabul ettiğin an gözden kayboluyordu.
  const acceptedOffers = useMemo(
    () => offers
      .filter((o) => o.sellerId === currentUser.id && o.status === "accepted")
      .sort((a, b) => (b.respondedAt ?? b.createdAt).localeCompare(a.respondedAt ?? a.createdAt))
      .slice(0, 20),
    [offers, currentUser.id]
  );
  function messageBuyer(listingId: string, buyerId: string) {
    const c = startConversation(listingId, buyerId, "Teklifin hakkında konuşalım.");
    if (c) router.push({ pathname: "/chat/[id]", params: { id: c.id } });
  }
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
  // "Açık/ödenecek" komisyon = henüz ödenmemiş AMA iptal/anlaşmazlık DIŞI satışlar.
  // cancelled (iptal) hiç ödenmez; disputed (çözülene dek) limbo — ikisi de "açık
  // komisyon" ve "panel temiz" sinyalini kalıcı bozmasın.
  const isOwedSale = saleIsOwed;
  const openCommission = mySales.filter(isOwedSale).reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const paidCommission = mySales.filter((sale) => sale.status === "paid").reduce((sum, sale) => sum + sale.commissionAmount, 0);
  // Anlaşmazlıktaki (disputed) komisyonlar "açık"tan düşülür ama gizlenmemeli — ayrı tile.
  const disputedCommission = mySales.filter((sale) => sale.status === "disputed").reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const newLeads = myLeads.filter((lead) => lead.status === "new");
  const contactedLeads = myLeads.filter((lead) => lead.status === "contacted");
  const convertedLeads = myLeads.filter((lead) => lead.status === "converted");
  const unpaidSales = mySales.filter(isOwedSale);
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
      listingSales.some(saleIsOwed) ||
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


  function confirmRejectPartnership(partnershipId: string) {
    setRejectTargetId(partnershipId);
  }

  function confirmPaidSale(saleId: string) {
    Alert.alert(t("commissionPaidQuestion"), t("commissionPaidQuestionBody"), [
      { text: t("cancel"), style: "cancel" },
      { text: translateCopy("Ödendi Bildir", language), onPress: () => updateSaleStatus(saleId, "seller_paid") }
    ]);
  }

  function confirmRemoveListing(listingId: string) {
    // Tek net eylem: SİL. (Geçici gizleme için ayrı "Pasife Al" butonu zaten var — eskiden
    // aynı diyalogda iki seçenek web'de sıralı confirm'e dönüşüp kafa karıştırıyordu.)
    // removeListing: geçmişi olan ilanı ARŞİVLER (para/lead korunur), temiz ilanı GERÇEKTEN siler.
    const listing = listings.find((l) => l.id === listingId);
    const hasHistory = listing
      ? partnerships.some((p) => p.listingId === listingId) || leads.some((l) => l.listingId === listingId) || sales.some((s) => s.listingId === listingId)
      : false;
    Alert.alert(
      translateCopy("İlanı sil", language),
      hasHistory
        ? translateCopy("Bu ilanın talep/ortaklık/satış geçmişi var. İlan listenden kaldırılır ve arşivlenir; komisyon ve satış kayıtların korunur. Geçici gizlemek istersen bunun yerine \"Pasife Al\" kullan.", language)
        : translateCopy("İlan kalıcı olarak silinir. Geçici olarak gizlemek istersen bunun yerine \"Pasife Al\" kullanabilirsin.", language),
      [
        { text: t("cancel"), style: "cancel" },
        { text: translateCopy(hasHistory ? "Kaldır ve arşivle" : "Kalıcı sil", language), style: "destructive", onPress: () => removeListing(listingId) }
      ]
    );
  }

  function openConversation(listingId: string, receiverId: string | undefined, body: string) {
    if (!receiverId) return;
    const conversation = startConversation(listingId, receiverId, body);
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
  }

  // Platform dışı satışını yapan satıcı ilanı tek tuşla "Satıldı" işaretler (yayından kalkar,
  // istenirse tekrar aktifleştirilir). Talep/satış varsa uyarır ama engellemez.
  function confirmMarkSold(listingId: string) {
    Alert.alert(
      translateCopy("Satıldı olarak işaretle", language),
      translateCopy("İlan \"Satıldı\" olarak işaretlenir ve yayından kaldırılır. İstediğinde tek tuşla tekrar aktifleştirebilirsin.", language),
      [
        { text: t("cancel"), style: "cancel" },
        { text: translateCopy("Satıldı", language), onPress: () => updateListingStatus(listingId, "sold") }
      ]
    );
  }

  function confirmEndPartnership(partnershipId: string, partnerName: string) {
    Alert.alert(
      translateCopy("Ortaklığı sonlandır", language),
      `${partnerName} ${translateCopy("ile ortaklığı sonlandırmak istiyor musun? Paylaşım linki artık lead getirmez. Kötüye kullanım varsa Engelle'yi seç.", language)}`,
      [
        { text: t("cancel"), style: "cancel" },
        { text: translateCopy("Sonlandır", language), onPress: () => endPartnership(partnershipId, "cancelled") },
        { text: translateCopy("Engelle", language), style: "destructive", onPress: () => endPartnership(partnershipId, "blocked") }
      ]
    );
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Toplu işlem, yalnız seçili + o işleme uygun ilanlara uygulanır.
  // Moderasyon kaçağı yok: updateListingStatus, incelemedeki ilanı sahibin
  // "active" yapmasını zaten engeller.
  function bulkStatus(ids: string[], status: Listing["status"]) {
    ids.forEach((id) => updateListingStatus(id, status));
    clearSelection();
  }

  function confirmBulkRemove(ids: string[]) {
    if (ids.length === 0) return;
    Alert.alert(
      translateCopy("Seçili ilanları kaldır", language),
      `${ids.length} ${translateCopy("ilan pasife alınacak. İstediğinde tekrar yayınlayabilirsin.", language)}`,
      [
        { text: t("cancel"), style: "cancel" },
        { text: translateCopy("Pasife Al", language), onPress: () => bulkStatus(ids, "paused") }
      ]
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, padding: 12, paddingBottom: Platform.OS === "web" ? 28 : 96 }} refreshControl={Platform.OS === "web" ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
      <WebContainer max={1280} padding={0} style={{ gap: 14 }}>
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
        {/* KPI paneli (Trendyol Satıcı Merkezi tarzı) — tüm metrikler türetilmiş veriden. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
          <KpiCard icon="storefront-outline" label={translateCopy("Aktif ilan", language)} value={`${myListings.filter((listing) => listing.status === "active").length}`} />
          <KpiCard icon="cash-clock" label={translateCopy("Açık komisyon", language)} value={money(openCommission)} tone={openCommission > 0 ? "warn" : undefined} />
          <KpiCard icon="cash-check" label={translateCopy("Ödenen komisyon", language)} value={money(paidCommission)} tone="ok" />
          {disputedCommission > 0 ? <KpiCard icon="alert-octagon-outline" label={translateCopy("İhtilaflı komisyon", language)} value={money(disputedCommission)} tone="warn" /> : null}
          <KpiCard icon="account-plus-outline" label={translateCopy("Bekleyen başvuru", language)} value={`${myApplications.length}`} tone={myApplications.length ? "warn" : undefined} />
          <KpiCard icon="account-clock-outline" label={translateCopy("Yeni talep", language)} value={`${newLeads.length}`} tone={newLeads.length ? "warn" : undefined} />
          <KpiCard icon="chart-line" label={translateCopy("Dönüşüm", language)} value={`%${totalConversionRate}`} />
          {mySales.some((s) => s.buyerConfirmToken) ? <KpiCard icon="account-check" label={translateCopy("Alıcı onaylı satış", language)} value={`${mySales.filter((s) => s.buyerConfirmedAt || s.buyerConfirmStatus === "confirmed").length}`} tone="ok" /> : null}
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
        {/* Toplu yükleme: çok ürünü olan satıcılar için CSV ile toplu ilan. */}
        <Pressable onPress={() => router.push("/toplu-ilan")} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, opacity: pressed ? 0.8 : 1, paddingHorizontal: 14, paddingVertical: 11 })}>
          <MaterialCommunityIcons name="file-upload-outline" size={17} color={colors.primaryDark} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{translateCopy("Toplu ilan yükle (CSV)", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{translateCopy("Yüzlerce ürünü tek seferde — kategori/il eşleme + admin onayı", language)}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.muted} />
        </Pressable>
      </Card>

      {/* GELEN TEKLİFLER — eskiden teklif yalnız sohbete serbest metin olarak geliyordu;
          satıcı takip edemiyor, kabul/ret edemiyor, mesaj geçmişinde kayboluyordu. */}
      {pendingOffers.length > 0 ? (
        <Card>
          <SectionTitle title="Gelen teklifler" action={`${pendingOffers.length}`} />
          <View style={{ gap: 10 }}>
            {pendingOffers.map((o) => {
              const l = myListings.find((x) => x.id === o.listingId);
              const buyer = findUser(o.buyerId);
              return (
                <View key={o.id} style={{ backgroundColor: colors.goldSoft, borderColor: colors.gold, borderRadius: 12, borderWidth: 1, gap: 8, padding: 12 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                    <MaterialCommunityIcons name="handshake" size={17} color={colors.goldInk} />
                    <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{l?.title ?? translateCopy("İlan", language)}</Text>
                    <Text style={{ color: colors.goldInk, fontSize: 15, fontWeight: "900" }}>{moneyIn(o.amount, l?.currency)}</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>
                    {buyer?.name ?? translateCopy("Alıcı", language)}
                    {l ? ` · ${translateCopy("liste", language)}: ${moneyIn(l.price, l.currency)}` : ""}
                  </Text>
                  {o.note ? <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>“{o.note}”</Text> : null}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => Alert.alert(
                        translateCopy("Teklifi kabul et", language),
                        `${moneyIn(o.amount, l?.currency)} ${translateCopy("teklifini kabul ediyorsun. Alıcı bilgilendirilecek; ödeme ve teslimatı onunla doğrudan yaparsın.", language)}`,
                        [
                          { text: translateCopy("Vazgeç", language), style: "cancel" },
                          { text: translateCopy("Kabul Et", language), onPress: () => void sellerRespondOffer(o.id, "accepted") }
                        ]
                      )}
                      style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.success, borderRadius: 9, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}
                    >
                      <MaterialCommunityIcons name="check" size={15} color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>{translateCopy("Kabul Et", language)}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void sellerRespondOffer(o.id, "rejected")}
                      style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}
                    >
                      <MaterialCommunityIcons name="close" size={15} color={colors.muted} />
                      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Reddet", language)}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => { setCounterFor(o.id); setCounterAmount(""); }}
                      style={({ pressed }) => ({ alignItems: "center", borderColor: colors.primary, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}
                    >
                      <MaterialCommunityIcons name="swap-horizontal" size={15} color={colors.primaryDark} />
                      <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Karşı Teklif", language)}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => messageBuyer(o.listingId, o.buyerId)}
                      style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 5, opacity: pressed ? 0.7 : 1, paddingHorizontal: 6, paddingVertical: 9 })}
                    >
                      <MaterialCommunityIcons name="message-text-outline" size={15} color={colors.primaryDark} />
                      <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Mesaj", language)}</Text>
                    </Pressable>
                  </View>
                  {counterFor === o.id ? (
                    <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 8, paddingTop: 10 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Karşı teklif tutarın (₺)", language)}</Text>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                        <TextInput
                          value={counterAmount}
                          onChangeText={(t) => setCounterAmount(t.replace(/[^0-9.,]/g, ""))}
                          keyboardType="numeric"
                          autoFocus
                          placeholder={l ? String(l.price) : "0"}
                          placeholderTextColor={colors.subtle}
                          style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 9, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 15, fontWeight: "800", minHeight: 42, paddingHorizontal: 10 }}
                        />
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            const amt = parseTrPrice(counterAmount);
                            if (!(amt > 0)) return;
                            void sellerRespondOffer(o.id, "countered", amt).then(() => setCounterFor(null));
                          }}
                          style={({ pressed }) => ({ backgroundColor: colors.primary, borderRadius: 9, opacity: pressed ? 0.85 : 1, paddingHorizontal: 16, paddingVertical: 11 })}
                        >
                          <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>{translateCopy("Gönder", language)}</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" onPress={() => setCounterFor(null)} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: 6 })}>
                          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Vazgeç", language)}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

      {/* ANLAŞMALAR — kabul edilen teklif "pending" listesinden düşünce satıcının elinde
          hiçbir şey kalmıyordu: anlaşma vardı ama takip edilecek yer yoktu. */}
      {acceptedOffers.length > 0 ? (
        <Card>
          <SectionTitle title="Anlaşmalar" action={`${acceptedOffers.length}`} />
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", marginBottom: 8 }}>
            {translateCopy("Kabul ettiğin teklifler. Ödeme ve teslimatı alıcıyla doğrudan yaparsın — OrtakSat para tutmaz.", language)}
          </Text>
          <View style={{ gap: 10 }}>
            {acceptedOffers.map((o) => {
              const l = myListings.find((x) => x.id === o.listingId);
              const buyer = findUser(o.buyerId);
              return (
                <View key={o.id} style={{ backgroundColor: colors.successSoft, borderColor: colors.success, borderRadius: 12, borderWidth: 1, gap: 8, padding: 12 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                    <MaterialCommunityIcons name="check-decagram" size={17} color={colors.success} />
                    <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{l?.title ?? translateCopy("İlan", language)}</Text>
                    <Text style={{ color: colors.success, fontSize: 15, fontWeight: "900" }}>{moneyIn(o.amount, l?.currency)}</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>
                    {translateCopy("Anlaşılan tutar", language)} · {buyer?.name ?? translateCopy("Alıcı", language)}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => messageBuyer(o.listingId, o.buyerId)}
                      style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 9, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}
                    >
                      <MaterialCommunityIcons name="message-text-outline" size={15} color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>{translateCopy("Alıcıyla mesajlaş", language)}</Text>
                    </Pressable>
                    {l && l.status === "active" ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => confirmMarkSold(o.listingId)}
                        style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}
                      >
                        <MaterialCommunityIcons name="check-circle-outline" size={15} color={colors.muted} />
                        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Satıldı olarak işaretle", language)}</Text>
                      </Pressable>
                    ) : l && l.status === "sold" ? (
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 5, paddingVertical: 9 }}>
                        <MaterialCommunityIcons name="check" size={14} color={colors.success} />
                        <Text style={{ color: colors.success, fontSize: 12, fontWeight: "800" }}>{translateCopy("İlan satıldı", language)}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

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
            <PrimaryButton tone={filter === "payments" ? "soft" : "secondary"} icon="cash-check" onPress={() => setFilter("payments")}>Ödeme Bekleyenler</PrimaryButton>
          </View>
          <View style={{ flexBasis: "47%", flexGrow: 1 }}>
            <PrimaryButton tone={filter === "lowStock" ? "soft" : "secondary"} icon="package-variant-closed" onPress={() => setFilter("lowStock")}>Az Stoklular</PrimaryButton>
          </View>
        </View>
      </Card>

      {/* Masaüstünde iki analitik kartı yan yana (geniş ekran boşluğunu kullanır); mobilde alt alta. */}
      <View style={isWideWeb ? { flexDirection: "row", gap: 14, alignItems: "stretch" } : { gap: 14 }}>
        <View style={isWideWeb ? { flex: 1, minWidth: 0 } : undefined}>
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
        </View>
        <View style={isWideWeb ? { flex: 1, minWidth: 0 } : undefined}>
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
        </View>
      </View>

      {mounted && myLeads.length > 0 ? (
        <MiniBarChart data={activitySeries} title={translateCopy("Son 14 gün · gelen talep", language)} totalLabel={`${activitySeries.reduce((s, d) => s + d.value, 0)} ${translateCopy("talep", language)}`} />
      ) : null}

      <Card>
        <SectionTitle title="İlan yönetimi" action={`${visibleListings.length}`} />
        {rejectedListings.length > 0 ? (
          <View style={{ backgroundColor: colors.warningSoft, borderColor: colors.warning, borderRadius: 12, borderWidth: 1, gap: 10, padding: 12 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
              <MaterialCommunityIcons name="account-cancel-outline" size={17} color={colors.warning} />
              <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{rejectedListings.length} {translateCopy("ilan yayına alınamadı", language)}</Text>
            </View>
            {rejectedListings.map((l) => (
              <View key={l.id} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, gap: 8, padding: 10 }}>
                <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{displayText(l.title)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{displayText(l.rejectionReason || translateCopy("İncelemede uygun bulunmadı.", language))}</Text>
                <PrimaryButton tone="secondary" icon="pencil-outline" href={`/listing-edit/${l.id}` as Href}>{translateCopy("Düzenle & yeniden gönder", language)}</PrimaryButton>
              </View>
            ))}
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{translateCopy("Düzenleyip kaydettiğinde ilan içeriği yeniden taranır; uygunsa yayına döner.", language)}</Text>
          </View>
        ) : null}
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
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateCopy("Aramayı temizle", language)}>
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
        {visibleListings.length > 0 ? (
          (() => {
            const visibleIds = visibleListings.map((item) => item.id);
            const selectedVisible = visibleIds.filter((id) => selectedIds.has(id));
            const allSelected = selectedVisible.length === visibleIds.length;
            return (
              <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable
                  onPress={() => (allSelected ? clearSelection() : setSelectedIds(new Set(visibleIds)))}
                  accessibilityRole="button"
                  style={{ alignItems: "center", flexDirection: "row", gap: 6 }}
                >
                  <MaterialCommunityIcons name={allSelected ? "checkbox-marked" : selectedVisible.length > 0 ? "minus-box" : "checkbox-blank-outline"} size={20} color={selectedVisible.length > 0 ? colors.primary : colors.muted} />
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>
                    {selectedVisible.length > 0 ? `${selectedVisible.length} ${translateCopy("seçili", language)}` : translateCopy("Tümünü seç", language)}
                  </Text>
                </Pressable>
                {selectedVisible.length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginLeft: "auto" }}>
                    <BulkActionBtn icon="play" label={translateCopy("Aktifleştir", language)} onPress={() => bulkStatus(selectedVisible, "active")} />
                    <BulkActionBtn icon="pause" label={translateCopy("Pasife Al", language)} onPress={() => bulkStatus(selectedVisible, "paused")} />
                    <BulkActionBtn icon="trash-can-outline" tone="danger" label={translateCopy("Kaldır", language)} onPress={() => confirmBulkRemove(selectedVisible)} />
                    <BulkActionBtn icon="close" label={translateCopy("Vazgeç", language)} onPress={clearSelection} />
                  </View>
                ) : null}
              </View>
            );
          })()
        ) : null}
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
                    <PrimaryButton tone="soft" onPress={() => { haptic.success(); approvePartnership(application.id); }}>Kabul Et</PrimaryButton>
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
        <EmptyState title={t("noResults")} body={t("sellerNoResultBody")} mascot="thinking" />
      ) : null}

      {visibleListings.map((listing) => {
        const listingPartnerships = partnerships.filter((partnership) => partnership.listingId === listing.id);
        const listingLeads = myLeads.filter((lead) => lead.listingId === listing.id);
        const listingSales = mySales.filter((sale) => sale.listingId === listing.id);
        const activePartners = listingPartnerships.filter((item) => item.status === "active").length;
        const pendingPartners = listingPartnerships.filter((item) => item.status === "pending").length;
        const unpaidListingSales = listingSales.filter(saleIsOwed);
        const convertedListingLeads = listingLeads.filter((lead) => lead.status === "converted").length;
        const conversionRate = listingLeads.length > 0 ? Math.round((convertedListingLeads / listingLeads.length) * 100) : 0;
        const listingClicks = listingPartnerships.reduce((sum, item) => sum + (clickCounts[item.id] ?? 0), 0);
        const nextAction = sellerNextAction(listing, listingLeads, listingSales, pendingPartners);
        const hasSaleForLead = (leadId: string) => listingSales.some((sale) => sale.leadId === leadId);

        // AKSİYON GEREKTİREN İLAN KENDİLİĞİNDEN AÇILIR.
        // Sorun: "Ortaklar" ve "Talep/randevu kaydet" (satış kaydetme) butonu bu KATLANIR
        // bölümün içindeydi ve varsayılan KAPALI idi → ortağı/talebi olan satıcı satışı nasıl
        // kaydedeceğini bulamıyordu (para akışının en kritik adımı görünmez kalıyordu).
        // Artık aktif ortak, gelen talep veya bekleyen başvuru varsa bölüm AÇIK gelir;
        // kullanıcı yine elle kapatabilir (expandedId ile açıkça kapatılmışsa ona saygı duyulur).
        const needsAttention = activePartners > 0 || listingLeads.length > 0 || pendingPartners > 0;
        const isExpanded = collapsedIds.has(listing.id) ? false : expandedId === listing.id || needsAttention;
        const unpaidTotal = unpaidListingSales.reduce((sum, sale) => sum + sale.commissionAmount, 0);
        return (
          <Card key={listing.id}>
            {/* Kompakt üst satır (Sahibinden tarzı): seç · görsel · başlık · fiyat · durum */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => toggleSelect(listing.id)}
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selectedIds.has(listing.id) }}
                accessibilityLabel={translateCopy("Toplu işlem için seç", language)}
                style={{ justifyContent: "center", paddingRight: 2 }}
              >
                <MaterialCommunityIcons name={selectedIds.has(listing.id) ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={selectedIds.has(listing.id) ? colors.primary : colors.muted} />
              </Pressable>
              <Image source={{ uri: listing.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 10, height: 88, width: 88 }} />
              <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
                  <Text selectable numberOfLines={2} style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900", lineHeight: 20 }}>
                    {displayText(listing.title)}
                  </Text>
                  <StatusPill label={listing.status === "active" ? (listing.stockCount <= 0 ? "Tükendi" : "Aktif") : listing.status === "pending_review" ? "İncelemede" : listing.status === "paused" ? "Pasif" : listing.status === "sold" ? "Satıldı" : listing.status} tone={listing.status === "active" ? (listing.stockCount <= 0 ? "danger" : "success") : listing.status === "pending_review" ? "info" : listing.status === "paused" || listing.status === "sold" ? "neutral" : "warning"} />
                </View>
                <Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                  {translateCopy(displayText(listing.category), language)} · {displayText(listing.location)}
                </Text>
                <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{moneyIn(listing.price, listing.currency)}</Text>
                  {listing.partnershipMode !== "none" ? (
                    <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>{translateCopy("ortak kazancı", language)} {moneyIn(commissionAmount(listing), listing.currency)}{listing.commissionType === "rate" ? ` · %${listing.commissionValue}` : ""}</Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{translateCopy("Normal ilan", language)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Tek satır kompakt istatistik şeridi */}
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 10, flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 10 }}>
              <SellerStat label="Stok" value={`${listing.stockCount}`} warn={listing.stockCount <= 3 && listing.status === "active"} />
              <SellerStat label="Aktif ortak" value={`${activePartners}`} />
              <SellerStat label="Talep" value={`${listingLeads.length}`} />
              <SellerStat label="Dönüşüm" value={`%${conversionRate}`} />
              <SellerStat label="Favori" value={`${listing.favoriteCount}`} />
              <SellerStat label="Satış" value={`${listingSales.length}`} />
              <SellerStat label="Bekleyen ödeme" value={moneyIn(unpaidTotal, listing.currency)} warn={unpaidListingSales.length > 0} />
            </View>

            {/* Satır-içi hızlı düzenleme: stok ±/fiyat (Trendyol tarzı) — anında kaydolur */}
            <QuickInventoryEditor
              stock={listing.stockCount}
              price={listing.price}
              currency={listing.currency}
              onSave={(patch) => updateListingInventory(listing.id, patch)}
            />

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <StatusPill label={nextAction.label} tone={nextAction.tone} />
              {pendingPartners > 0 ? <StatusPill label={`${pendingPartners} ${translateCopy("başvuru", language)}`} tone="warning" /> : null}
            </View>

            {/* Kompakt aksiyon satırı */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                <PrimaryButton href={{ pathname: "/listing-edit/[id]", params: { id: listing.id } }} tone="soft" icon="pencil-outline">Düzenle</PrimaryButton>
              </View>
              <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                {listing.status === "pending_review" ? (
                  // Aksiyon değil, DURUM: tıklanabilir buton değil, statik rozet (eskiden ölü onPress).
                  <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 42, paddingHorizontal: 12 }}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("İncelemede", language)}</Text>
                  </View>
                ) : (
                  <PrimaryButton tone={listing.status === "active" ? "secondary" : "soft"} icon={listing.status === "active" ? "pause" : "play"} onPress={() => updateListingStatus(listing.id, listing.status === "active" ? "paused" : "active")}>
                    {listing.status === "active" ? "Pasife Al" : "Aktifleştir"}
                  </PrimaryButton>
                )}
              </View>
              <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                <PrimaryButton href={`/listing/${listing.id}`} tone="secondary" icon="eye-outline">Detay</PrimaryButton>
              </View>
              {listing.status === "active" || listing.status === "paused" ? (
                <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                  <PrimaryButton tone="soft" icon="check-circle-outline" onPress={() => confirmMarkSold(listing.id)}>Satıldı</PrimaryButton>
                </View>
              ) : null}
              <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                <PrimaryButton tone="danger" icon="trash-can-outline" onPress={() => confirmRemoveListing(listing.id)}>Sil</PrimaryButton>
              </View>
            </View>

            {/* Talep & ödeme yönetimi: katlanır (varsayılan kapalı) */}
            {listingLeads.length > 0 || listingSales.length > 0 || activePartners > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (isExpanded) {
                    // Kapat: oto-açılmış olabilir → açıkça "kapatıldı" diye işaretle.
                    setCollapsedIds((s2) => new Set(s2).add(listing.id));
                    setExpandedId(null);
                  } else {
                    setCollapsedIds((s2) => { const n = new Set(s2); n.delete(listing.id); return n; });
                    setExpandedId(listing.id);
                  }
                }}
                style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 11 }}
              >
                <MaterialCommunityIcons name="clipboard-list-outline" size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "800" }}>{translateCopy("Talep & ödeme yönetimi", language)} — {activePartners} {translateCopy("ortak", language)} · {listingLeads.length} {translateCopy("talep", language)} · {listingSales.length} {translateCopy("satış", language)}</Text>
                <MaterialCommunityIcons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
              </Pressable>
            ) : (
              <Text selectable style={{ color: colors.subtle, fontSize: 12.5, fontWeight: "600" }}>{translateCopy("Bu ilana henüz talep gelmedi. Ortakların ürününü tanıtması veya alıcının iletişime geçmesiyle talepler burada görünür.", language)}</Text>
            )}

            {isExpanded ? (
            <>
            <SectionTitle title="Gelen talepler" action={`${listingLeads.length}`} />
            {listingLeads.length === 0 ? <Text selectable style={{ color: colors.muted, fontSize: 14 }}>{translateCopy("Bu ilana henüz talep gelmedi.", language)}</Text> : null}
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
                    {(() => {
                      const converted = hasSaleForLead(lead.id);
                      // İlan pasif/tükendiyse createSaleFromLead reddeder → butonu boşuna
                      // "aktif ama hata veren" bırakmak yerine nedenini göster (satıcı ilanı
                      // yeniden yayınlar/stok ekler).
                      const canConvert = listing.status === "active" && listing.stockCount > 0;
                      const label = converted
                        ? translateCopy("Satış Kaydı Var", language)
                        : !canConvert
                          ? (listing.stockCount <= 0 ? translateCopy("Stok tükendi — önce stok ekle", language) : translateCopy("İlan pasif — önce yayına al", language))
                          : translateCopy("Satışa Çevir", language);
                      return (
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <View style={{ flex: 1 }}>
                            <PrimaryButton tone={converted || !canConvert ? "soft" : "primary"} onPress={() => (converted || !canConvert ? undefined : setSaleTarget({ partnershipId: lead.partnershipId, listingId: listing.id, partnerName: findUser(partnership?.partnerId ?? "")?.name ?? translateCopy("Ortak", language), price: listing.price, currency: listing.currency, commissionType: listing.commissionType, commissionValue: listing.commissionValue, leadId: lead.id }))}>
                              {label}
                            </PrimaryButton>
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                );
              })}

            {(() => {
              const activeList = listingPartnerships.filter((item) => item.status === "active");
              if (activeList.length === 0) return null;
              const canSell = listing.status === "active" && listing.stockCount > 0;
              return (
                <>
                  <SectionTitle title="Ortaklar" action={`${activeList.length}`} />
                  <Text selectable style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 17 }}>{translateCopy("Ortağın kendi yöntemiyle getirdiği alıcı site dışında (WhatsApp/elden) satın aldıysa, satışı ilgili ortağa ekle; komisyonu başlasın.", language)}</Text>
                  {activeList.map((p) => {
                    const partner = findUser(p.partnerId);
                    // Bu ortağın bu ilandaki performansı + satıcının ona borcu.
                    const pLeads = listingLeads.filter((l) => l.partnershipId === p.id).length;
                    const pSales = listingSales.filter((s) => s.partnershipId === p.id);
                    const pOwed = pSales.filter(saleIsOwed).reduce((sum, s) => sum + s.commissionAmount, 0);
                    // Toplu ödeme YALNIZ return_pending/approved komisyonları kapatır (seller_paid
                    // hariç — o zaten ortağın onayını bekliyor). Buton/tutar bu ödenebilir kümeden.
                    const pPayable = pSales.filter((s) => s.status === "return_pending" || s.status === "approved").reduce((sum, s) => sum + s.commissionAmount, 0);
                    const partnerName = partner?.name ?? translateCopy("Ortak", language);
                    return (
                      <View key={p.id} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, gap: 8, padding: 10 }}>
                        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                          <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>{partnerName}</Text>
                            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>★ {partner?.rating ?? 0} · {pLeads} {translateCopy("talep", language)} · {pSales.length} {translateCopy("satış", language)}</Text>
                            {p.commissionOverrideType && p.commissionOverrideValue ? (
                              <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>{translateCopy("Özel komisyon", language)}: {p.commissionOverrideType === "rate" ? `%${p.commissionOverrideValue}` : moneyIn(p.commissionOverrideValue, listing.currency)}</Text>
                            ) : null}
                          </View>
                          {pOwed > 0 ? (
                            <View style={{ alignItems: "flex-end" }}>
                              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "900" }}>{moneyIn(pOwed, listing.currency)}</Text>
                              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>{translateCopy("borç", language)}</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          <Pressable
                            onPress={() => canSell ? setSaleTarget({ partnershipId: p.id, listingId: listing.id, partnerName, price: listing.price, currency: listing.currency, commissionType: listing.commissionType, commissionValue: listing.commissionValue }) : undefined}
                            style={({ pressed }) => ({ alignItems: "center", backgroundColor: canSell ? colors.primary : colors.line, borderRadius: 8, flexDirection: "row", flexGrow: 1, gap: 5, justifyContent: "center", opacity: pressed ? 0.85 : 1, paddingHorizontal: 12, paddingVertical: 9 })}
                          >
                            <MaterialCommunityIcons name="cash-plus" size={15} color="#FFFFFF" />
                            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900" }}>{translateCopy(canSell ? categoryConversion(listing.category).sellerVerb : (listing.stockCount <= 0 ? "Stok yok" : "İlan pasif"), language)}</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setCommissionTarget({ partnershipId: p.id, partnerName, currency: listing.currency, defaultLabel: listing.commissionType === "rate" ? `%${listing.commissionValue}` : moneyIn(listing.commissionValue, listing.currency), currentType: p.commissionOverrideType, currentValue: p.commissionOverrideValue })}
                            style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 5, justifyContent: "center", opacity: pressed ? 0.85 : 1, paddingHorizontal: 12, paddingVertical: 9 })}
                          >
                            <MaterialCommunityIcons name="cash-edit" size={15} color={colors.primaryDark} />
                            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Komisyon", language)}</Text>
                          </Pressable>
                          {pPayable > 0 ? (
                            <Pressable
                              onPress={() => Alert.alert(translateCopy("Toplu ödeme kaydet", language), `${partnerName} — ${moneyIn(pPayable, listing.currency)} ${translateCopy("tutarındaki borçlu komisyonları ödediğini kaydet? Ortak onayınca kapanır. OrtakSat para tutmaz; ödeme aranızda yapılır.", language)}`, [{ text: t("cancel"), style: "cancel" }, { text: translateCopy("Ödedim, kaydet", language), onPress: () => recordBatchPayout(p.partnerId, listing.id) }])}
                              style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.successSoft, borderColor: colors.success, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 5, justifyContent: "center", opacity: pressed ? 0.85 : 1, paddingHorizontal: 12, paddingVertical: 9 })}
                            >
                              <MaterialCommunityIcons name="cash-check" size={15} color={colors.success} />
                              <Text style={{ color: colors.success, fontSize: 12, fontWeight: "900" }}>{translateCopy("Ödeme kaydet", language)}</Text>
                            </Pressable>
                          ) : null}
                          <Pressable
                            onPress={() => openConversation(listing.id, p.partnerId, `${displayText(listing.title)} ortaklığın hakkında konuşalım.`)}
                            style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 5, justifyContent: "center", opacity: pressed ? 0.85 : 1, paddingHorizontal: 12, paddingVertical: 9 })}
                          >
                            <MaterialCommunityIcons name="message-text-outline" size={15} color={colors.primaryDark} />
                            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Mesaj", language)}</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => confirmEndPartnership(p.id, partnerName)}
                            style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 5, justifyContent: "center", opacity: pressed ? 0.85 : 1, paddingHorizontal: 12, paddingVertical: 9 })}
                          >
                            <MaterialCommunityIcons name="account-off-outline" size={15} color={colors.muted} />
                            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900" }}>{translateCopy("Sonlandır", language)}</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </>
              );
            })()}

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
                  <Metric label="Teslim" value={sale.deliveryStatus === "delivered" ? translateCopy("Teslim", language) : sale.deliveryStatus === "cancelled" ? translateCopy("İptal", language) : translateCopy("Bekliyor", language)} />
                  <Metric label="İade sonu" value={sale.returnUntil ?? "-"} />
                </View>
                {sale.payoutNote ? (
                  <Text selectable style={{ color: sale.status === "disputed" ? colors.accent : colors.muted, fontSize: 13, fontWeight: sale.status === "disputed" ? "800" : "400", lineHeight: 19 }}>
                    {sale.payoutNote}
                  </Text>
                ) : null}
                {/* Faz 2: alıcı-taraflı satış doğrulaması. Alıcı hesabından ya da linkle onaylar. */}
                {sale.buyerConfirmedAt || sale.buyerConfirmStatus === "confirmed" ? (
                  <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 8, flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <MaterialCommunityIcons name="check-decagram" size={15} color={colors.success} />
                    <Text style={{ color: colors.success, fontSize: 12, fontWeight: "800" }}>{translateCopy("Alıcı satışı onayladı ✓", language)}</Text>
                  </View>
                ) : sale.buyerConfirmStatus === "disputed" ? (
                  <View style={{ alignItems: "center", backgroundColor: colors.warningSoft, borderRadius: 8, flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={15} color={colors.warning} />
                    <Text style={{ color: colors.warning, fontSize: 12, fontWeight: "800" }}>{translateCopy("Alıcı satışa itiraz etti", language)}</Text>
                  </View>
                ) : sale.buyerConfirmToken ? (
                  <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, gap: 7, padding: 11 }}>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                      <MaterialCommunityIcons name="account-check-outline" size={15} color={colors.primaryDark} />
                      <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "900" }}>{translateCopy("Alıcı onayı bekleniyor", language)}</Text>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 15 }}>{translateCopy("Bu linki alıcıyla paylaş; alıcı aldığını onaylayınca satış doğrulanır (iki taraflı güven).", language)}</Text>
                    <Pressable onPress={() => void shareOrCopy({ title: translateCopy("OrtakSat satış onayı", language), message: translateCopy("Aldığın ürünü/hizmeti onayla:", language), url: `https://www.ortaksat.com/onay/${sale.buyerConfirmToken}` })} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 9 }}>
                      <MaterialCommunityIcons name="share-variant-outline" size={14} color={colors.primaryDark} />
                      <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Alıcı onay linkini paylaş", language)}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {sale.status === "paid" ? (
                  <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 8, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 9 }}>
                    <MaterialCommunityIcons name="check-circle" size={15} color={colors.success} />
                    <Text style={{ color: colors.success, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Komisyon kapandı", language)}</Text>
                  </View>
                ) : sale.status === "cancelled" ? (
                  <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 8, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 9 }}>
                    <MaterialCommunityIcons name="close-circle-outline" size={15} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Satış iptal edildi", language)}</Text>
                  </View>
                ) : sale.status === "disputed" ? (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}><PrimaryButton tone="soft" onPress={() => confirmPaidSale(sale.id)}>Yeniden Ödedim</PrimaryButton></View>
                    <View style={{ flex: 1 }}><PrimaryButton tone="secondary" onPress={() => updateSaleStatus(sale.id, "cancelled")}>İptal Et</PrimaryButton></View>
                  </View>
                ) : sale.status === "seller_paid" ? (
                  <View style={{ gap: 8 }}>
                    <View style={{ alignItems: "center", backgroundColor: colors.infoSoft, borderRadius: 8, paddingVertical: 9 }}>
                      <Text style={{ color: colors.info, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Ortak onayı bekleniyor", language)}</Text>
                    </View>
                    {/* Ortak hiç onaylamazsa satıcı sonsuza dek takılmasın — anlaşmazlık açabilsin. */}
                    <Pressable onPress={() => updateSaleStatus(sale.id, "disputed", translateCopy("Ödeme yaptım ancak ortak onaylamadı.", language))} style={{ alignItems: "center", paddingVertical: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700", textDecorationLine: "underline" }}>{translateCopy("Ortak onaylamıyor mu? Anlaşmazlık aç", language)}</Text>
                    </Pressable>
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
      <ReasonModal
        visible={rejectTargetId !== null}
        title="Başvuruyu reddet"
        intro="Ortağa iletilecek net bir gerekçe seç; başvurusu neden uygun bulunmadığını bilsin."
        reasons={["Kitle/kanal ürüne uygun değil", "Yetersiz erişim veya takipçi", "Eksik veya belirsiz başvuru bilgisi", "Şu an yeni ortak almıyorum", "Diğer"]}
        submitLabel="Reddet"
        icon="account-cancel-outline"
        onClose={() => setRejectTargetId(null)}
        onSubmit={(reason) => { if (rejectTargetId) rejectPartnership(rejectTargetId, reason); setRejectTargetId(null); }}
      />
      <CommissionOverrideModal
        visible={commissionTarget !== null}
        partnerName={commissionTarget?.partnerName ?? ""}
        currency={commissionTarget?.currency}
        defaultLabel={commissionTarget?.defaultLabel ?? ""}
        currentType={commissionTarget?.currentType}
        currentValue={commissionTarget?.currentValue}
        onClose={() => setCommissionTarget(null)}
        onSubmit={(type, value) => { if (commissionTarget) setPartnershipCommission(commissionTarget.partnershipId, type, value); }}
        onClear={() => { if (commissionTarget) setPartnershipCommission(commissionTarget.partnershipId); }}
      />
      <RecordSaleModal
        visible={saleTarget !== null}
        partnerName={saleTarget?.partnerName ?? ""}
        listPrice={saleTarget?.price ?? 0}
        currency={saleTarget?.currency}
        commissionType={saleTarget?.commissionType ?? "rate"}
        commissionValue={saleTarget?.commissionValue ?? 0}
        // Önizleme = kaydedilecek EFEKTİF komisyon (per-ortak override/kademe + başlangıç bonusu).
        // Eskiden ilan-baz oranı gösteriliyordu → override'lı ortakta görünen ≠ kaydedilen (para tutarsızlığı).
        computeCommission={(amount, quantity) => {
          if (!saleTarget) return 0;
          const l = listings.find((x) => x.id === saleTarget.listingId);
          if (!l) return 0;
          const pship = partnerships.find((x) => x.id === saleTarget.partnershipId);
          const prior = sales.filter((s) => s.partnershipId === saleTarget.partnershipId && s.status !== "cancelled").length;
          const base = effectiveCommissionAmount(l, pship, prior, amount, quantity);
          const bonus = (l.bonusAmount ?? 0) > 0 && (l.bonusQuota ?? 0) > 0 && prior < (l.bonusQuota ?? 0) ? Math.round(l.bonusAmount ?? 0) : 0;
          return base + bonus;
        }}
        onClose={() => setSaleTarget(null)}
        onSubmit={(amount, quantity) => {
          if (!saleTarget) return;
          // Lead'den satış → miktar/tutar girilebilir (eskiden daima price×1 idi, yanlıştı).
          haptic.success();
          const sale = saleTarget.leadId
            ? createSaleFromLead(saleTarget.leadId, { amount, quantity })
            : recordSaleForPartner(saleTarget.partnershipId, { amount, quantity });
          const productTitle = listings.find((x) => x.id === saleTarget.listingId)?.title ?? "";
          setSaleTarget(null);
          // KRİTİK HANDOFF: satış kaydedildi → alıcı ONAY LİNKİNİ hemen gönder. Komisyon
          // doğrulaması alıcı onayına bağlı; link gönderilmezse akış "onay bekleniyor"da takılır
          // ("1. ödenen komisyon" = sistem çalışıyor kanıtı hiç gerçekleşmez). Kayıt anında yönlendir.
          if (sale?.buyerConfirmToken) {
            const token = sale.buyerConfirmToken;
            Alert.alert(
              translateCopy("Satış kaydedildi ✓", language),
              translateCopy("Şimdi alıcıya onay linkini gönder — aldığını onayladığında komisyon doğrulanır.", language),
              [
                { text: translateCopy("Sonra", language), style: "cancel" },
                { text: translateCopy("Onay linkini gönder", language), onPress: () => void shareOrCopy({ title: translateCopy("OrtakSat satış onayı", language), message: productTitle ? `"${productTitle}" siparişini onayla:` : translateCopy("Aldığın ürünü/hizmeti onayla:", language), url: `https://www.ortaksat.com/onay/${token}` }) }
              ]
            );
          }
        }}
      />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}




// KPI kartı (Trendyol Satıcı Merkezi dashboard başlığı). tone: warn=aksiyon, ok=olumlu.
function KpiCard({ icon, label, value, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; tone?: "warn" | "ok" }) {
  const color = tone === "warn" ? colors.accent : tone === "ok" ? colors.success : colors.primaryDark;
  const bg = tone === "warn" ? colors.accentSoft : tone === "ok" ? colors.successSoft : colors.primarySoft;
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexBasis: 150, flexGrow: 1, gap: 6, minWidth: 132, padding: 12 }}>
      <View style={{ alignItems: "center", backgroundColor: bg, borderRadius: 8, height: 30, justifyContent: "center", width: 30 }}>
        <MaterialCommunityIcons name={icon} size={17} color={color} />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ color: colors.ink, fontSize: 19, fontWeight: "900" }}>{value}</Text>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function SellerStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const { language } = useLanguage();
  return (
    <View style={{ gap: 1, minWidth: 66 }}>
      <Text numberOfLines={1} style={{ color: warn ? colors.accent : colors.ink, fontSize: 14, fontWeight: "900" }}>{value}</Text>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>{translateCopy(label, language)}</Text>
    </View>
  );
}

function BulkActionBtn({ icon, label, tone, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; tone?: "danger"; onPress: () => void }) {
  const danger = tone === "danger";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ alignItems: "center", backgroundColor: danger ? colors.accentSoft : colors.primarySoft, borderRadius: 8, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 7 }}
    >
      <MaterialCommunityIcons name={icon} size={15} color={danger ? colors.accent : colors.primary} />
      <Text style={{ color: danger ? colors.accent : colors.primary, fontSize: 12, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

// Satır-içi stok/fiyat hızlı düzenleme. ±: anında kaydeder; sayı girişi Kaydet ile.
// Prop değişince taslak senkronlanır (dış güncelleme/rollback yansısın).
function QuickInventoryEditor({ stock, price, currency, onSave }: { stock: number; price: number; currency?: string; onSave: (patch: { stockCount?: number; price?: number }) => void }) {
  const { language } = useLanguage();
  const [stockDraft, setStockDraft] = useState(String(stock));
  const [priceDraft, setPriceDraft] = useState(String(price));
  useEffect(() => { setStockDraft(String(stock)); }, [stock]);
  useEffect(() => { setPriceDraft(String(price)); }, [price]);
  const parsedStock = Math.max(0, Math.floor(Number(stockDraft.replace(/[^0-9]/g, "")) || 0));
  // TR biçimli fiyat ("1.500.000") — parseTrPrice binlik ayıracını doğru çözer.
  // Number("1.500.000") → NaN → 0 idi (fiyatı sessizce sıfırlıyordu).
  const parsedPrice = Math.max(0, Math.round(parseTrPrice(priceDraft)));
  const dirty = parsedStock !== stock || parsedPrice !== price;
  const cellInput = { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 14, fontWeight: "800" as const, minWidth: 46, paddingHorizontal: 8, paddingVertical: Platform.OS === "web" ? 6 : 4, textAlign: "center" as const };
  const stepBtn = { alignItems: "center" as const, backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, height: 32, justifyContent: "center" as const, width: 32 };
  const step = (delta: number) => {
    const next = Math.max(0, parsedStock + delta);
    setStockDraft(String(next));
    onSave({ stockCount: next });
  };
  const commit = () => {
    const patch: { stockCount?: number; price?: number } = {};
    if (parsedStock !== stock) patch.stockCount = parsedStock;
    if (parsedPrice !== price) patch.price = parsedPrice;
    if (patch.stockCount === undefined && patch.price === undefined) return;
    onSave(patch);
  };
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{translateCopy("Stok", language)}</Text>
        <Pressable onPress={() => step(-1)} hitSlop={4} accessibilityRole="button" accessibilityLabel={translateCopy("Stok azalt", language)} style={stepBtn}>
          <MaterialCommunityIcons name="minus" size={16} color={colors.ink} />
        </Pressable>
        <TextInput value={stockDraft} onChangeText={setStockDraft} keyboardType="number-pad" selectTextOnFocus style={cellInput} />
        <Pressable onPress={() => step(1)} hitSlop={4} accessibilityRole="button" accessibilityLabel={translateCopy("Stok artır", language)} style={stepBtn}>
          <MaterialCommunityIcons name="plus" size={16} color={colors.ink} />
        </Pressable>
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{translateCopy("Fiyat", language)}</Text>
        <TextInput value={priceDraft} onChangeText={setPriceDraft} keyboardType="numeric" selectTextOnFocus style={[cellInput, { minWidth: 84 }]} />
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{currency === "USD" ? "$" : currency === "EUR" ? "€" : "₺"}</Text>
      </View>
      {dirty ? (
        <Pressable onPress={commit} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, flexDirection: "row", gap: 4, marginLeft: "auto", paddingHorizontal: 12, paddingVertical: 8 }}>
          <MaterialCommunityIcons name="content-save" size={15} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>{translateCopy("Kaydet", language)}</Text>
        </Pressable>
      ) : null}
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
      <StarRatingInput value={rating} onChange={setRating} />
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
  const unpaidScore = listingSales.filter(saleIsOwed).length * 18;
  const stockScore = listing.status === "active" && listing.stockCount <= 3 ? 12 : 0;

  return newLeadScore + hotLeadScore + unpaidScore + pendingApplications * 10 + stockScore;
}

function sellerNextAction(listing: Listing, leads: Lead[], sales: Sale[], pendingPartners: number): { label: string; tone: "info" | "success" | "warning" } {
  if (leads.some((lead) => lead.status === "new" && lead.intent === "hot")) return { label: "Sıcak talebi ara", tone: "warning" };
  if (leads.some((lead) => lead.status === "new")) return { label: "Yeni talebi işle", tone: "warning" };
  if (pendingPartners > 0) return { label: "Başvuruyu değerlendir", tone: "warning" };
  if (sales.some(saleIsOwed)) return { label: "Komisyonu kapat", tone: "warning" };
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
    { icon: "account-clock-outline" as const, label: "Talep", value: leads, helper: "Ortağın getirdiği müşteriler", tone: leads > 0 ? "success" : "neutral" },
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
