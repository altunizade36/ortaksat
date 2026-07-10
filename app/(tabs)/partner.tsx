import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Alert } from "@/lib/alert";
import { openUrlSafe } from "@/lib/link";
import { shareOrCopy } from "@/lib/share";

import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { DisputeModal } from "@/components/dispute-modal";
import { LegalNote } from "@/components/legal-disclaimer";
import { MiniBarChart } from "@/components/mini-bar-chart";
import { PartnerLeaderboard } from "@/components/partner-leaderboard";
import { PartnerTier } from "@/components/partner-tier";
import { QuickStart } from "@/components/quick-start";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { Card, EmptyState, Metric, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { commissionAmount, commissionText, effectiveCommissionAmount, listingShareTemplates, money, moneyIn, shareUrl } from "@/lib/format";
import { loadClickCounts } from "@/lib/live-service";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb, useMounted } from "@/lib/layout";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { searchKey } from "@/lib/locale";
import { displayText } from "@/lib/text";
import type { Lead, LeadSource, LeadStatus, Listing, Partnership, PurchaseIntent, Sale, SaleStatus, User } from "@/lib/types";
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
  // Hidrasyon-gate: SSG (verisiz) ↔ istemci (girişli, veri dolu) render'ı arasındaki
  // React #418 metin uyuşmazlığını gider; mount'a kadar iskelet.
  return useMounted() ? <PartnerScreenInner /> : <ScreenSkeleton />;
}

function PartnerScreenInner() {
  const { canReviewSale, createSaleReview, currentUser, findUser, isAuthenticated, joinListing, leads, listings, partnerships, sales, startConversation, updateLeadStatus, updateSaleStatus, users } = useStore();
  const { language, t } = useLanguage();
  const router = useRouter();
  const isWideWeb = useIsWideWeb();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PartnerFilter>("all");
  const [disputeSaleId, setDisputeSaleId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "pending" | "active" | "earning" | "links">("all");
  const [oppCategory, setOppCategory] = useState("");
  const [oppCommission, setOppCommission] = useState(0);
  const [oppCity, setOppCity] = useState("");
  const [oppStock, setOppStock] = useState("");
  const [oppGuven, setOppGuven] = useState("");
  const [oppSort, setOppSort] = useState<"recommended" | "commission" | "stock" | "rating" | "new">("recommended");
  const [oppVisible, setOppVisible] = useState(8);
  // Bildirim derin-linki (?focus=<listingId>): ilgili ortaklığı "Aktif" sekmesinde öne al.
  // Menü derin-linki (?tab=pending|active|earning|links): ilgili sekmeyi aç.
  const params = useLocalSearchParams<{ focus?: string; tab?: string }>();
  const focusId = Array.isArray(params.focus) ? params.focus[0] : params.focus;
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  useEffect(() => { if (focusId) setTab("active"); }, [focusId]);
  useEffect(() => {
    if (tabParam && ["all", "pending", "active", "earning", "links"].includes(tabParam)) setTab(tabParam as typeof tab);
  }, [tabParam]);
  const focusFirst = (a: { listingId: string }, b: { listingId: string }) => (focusId ? (a.listingId === focusId ? -1 : b.listingId === focusId ? 1 : 0) : 0);
  const myPartnerships = partnerships.filter((partnership) => partnership.partnerId === currentUser.id);
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});
  const myPartnershipKey = myPartnerships.map((p) => p.id).join(",");
  useEffect(() => {
    const ids = myPartnershipKey ? myPartnershipKey.split(",") : [];
    if (ids.length === 0) { setClickCounts({}); return; }
    let alive = true;
    void loadClickCounts(ids).then((c) => { if (alive) setClickCounts(c); });
    return () => { alive = false; };
  }, [myPartnershipKey]);
  const totalClicks = Object.values(clickCounts).reduce((a, b) => a + b, 0);
  const activePartnerships = myPartnerships.filter((item) => item.status === "active").slice().sort(focusFirst);
  const pendingPartnerships = myPartnerships.filter((item) => item.status === "pending");
  const mySales = sales.filter((sale) => myPartnerships.some((partnership) => partnership.id === sale.partnershipId));
  const waiting = mySales.filter((sale) => sale.status === "pending" || sale.status === "return_pending" || sale.status === "disputed").reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const approved = mySales.filter((sale) => sale.status === "approved" || sale.status === "seller_paid").reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const paid = mySales.filter((sale) => sale.status === "paid").reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const myPartnershipIdSet = new Set(myPartnerships.map((p) => p.id));
  const myBroughtLeads = leads.filter((l) => l.partnershipId && myPartnershipIdSet.has(l.partnershipId));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Son 14 gün · getirdiğin talep (gerçek createdAt; istemci-only render).
  const leadSeries = useMemo(() => {
    const now = new Date();
    const out: Array<{ label: string; value: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      out.push({ label: `${d.getDate()}.${d.getMonth() + 1}`, value: myBroughtLeads.filter((l) => (l.createdAt ?? "").slice(0, 10) === key).length });
    }
    return out;
  }, [myBroughtLeads]);
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
  }).sort(focusFirst);

  // Ortaklık fırsatları: başkalarının TÜM aktif ilanları (herkese açık, global).
  // Reddedilenler HARİÇ: reddedilen bir başvuru fırsat listesinde "Ortak" (pasif) gösterip
  // tekrar başvuruyu engelliyordu; joinListing yeniden-açmayı destekliyor.
  const joinedIds = new Set(myPartnerships.filter((p) => p.status !== "rejected").map((p) => p.listingId));
  // "Sadece davetle" ilanlar fırsat listesinde gösterilmez — bunlara yalnızca
  // satıcının paylaştığı davet linkiyle ortak olunabilir.
  const allOpportunities = listings.filter((l) => l.status === "active" && l.ownerId !== currentUser.id && l.partnershipMode !== "invite");
  // Mobil liste (filtre paneli yok): en iyi fırsatlar önce — doğrulanmış/öne çıkan, sonra komisyon.
  const rankedOpportunities = useMemo(() => allOpportunities.slice().sort((a, b) => {
    const av = (a.featured ? 2 : 0) + ((findUser(a.ownerId)?.verifiedIdentity || findUser(a.ownerId)?.verifiedPhone) ? 1 : 0);
    const bv = (b.featured ? 2 : 0) + ((findUser(b.ownerId)?.verifiedIdentity || findUser(b.ownerId)?.verifiedPhone) ? 1 : 0);
    return bv - av || commissionAmount(b) - commissionAmount(a);
  }), [allOpportunities, findUser]);

  // Mobil fırsat filtresi/sıralaması (önceden mobilde HİÇ filtre/sort yoktu; masaüstü
  // toolbar'daki oppCommission/oppSort state'i mobil çiplerle de kullanılır).
  const mobileOpportunities = useMemo(() => {
    const arr = rankedOpportunities.filter((l) => {
      if (oppCommission > 0) {
        const effRate = l.commissionType === "rate" ? l.commissionValue : (l.price > 0 ? (l.commissionValue / l.price) * 100 : 0);
        if (effRate < oppCommission) return false;
      }
      return true;
    });
    if (oppSort === "commission") return arr.slice().sort((a, b) => commissionAmount(b) - commissionAmount(a));
    if (oppSort === "new") return arr.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (oppSort === "stock") return arr.slice().sort((a, b) => b.stockCount - a.stockCount);
    return arr;
  }, [rankedOpportunities, oppCommission, oppSort]);

  function onJoin(listingId: string) {
    // Anonim: girişe yönlendir (dönüşte ilana gelir) — alert'te tıkanma yok.
    if (!isAuthenticated) { router.push({ pathname: "/auth", params: { redirect: `/listing/${listingId}` } }); return; }
    const listing = listings.find((l) => l.id === listingId);
    // Onay/davet modu: satıcı gerçek başvuru bilgisi görmeli — uydurma sabit metin
    // GÖNDERME. Kullanıcıyı ilan detayındaki gerçek başvuru formuna yönlendir
    // (kanal/erişim/kitle/handle alanları orada doldurulur).
    if (listing && listing.partnershipMode !== "open") {
      router.push({ pathname: "/listing/[id]", params: { id: listingId, apply: "1" } });
      return;
    }
    // Açık mod: başvuru gerekmez, anında ortak ol.
    const result = joinListing(listingId);
    const ok = Boolean(result);
    Alert.alert(
      translateCopy(ok ? (result?.status === "active" ? "Ortaklık aktif" : "Başvuru gönderildi") : "İşlem yapılamadı", language),
      translateCopy(ok ? (result?.status === "active" ? "Paylaşım bağlantın hazır." : "Satıcı onayından sonra bağlantın açılır.") : "Kendi ilanına ortak olamazsın, giriş yapman gerekir veya ilan aktif değil.", language)
    );
  }

  async function copyText(label: string, text: string) {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert(translateCopy("Kopyala", language), language === "en" ? `${translateCopy(label, language)} copied to clipboard.` : `${label} panoya kopyalandı.`);
    } catch {
      Alert.alert(translateCopy("Kopyalanamadı", language), text);
    }
  }

  async function sharePartnership(listingId: string, refCode: string) {
    const listing = listings.find((item) => item.id === listingId);
    if (!listing) return;
    const url = shareUrl(listing, refCode);
    const r = await shareOrCopy({ title: listing.title, message: `${listingShareTemplates(listing, url).whatsapp}\n${url}`, url });
    if (r === "copied") Alert.alert(translateCopy("Bağlantı kopyalandı", language), translateCopy("Paylaşmak için istediğin yere yapıştırabilirsin.", language));
  }

  async function openWhatsapp(listingId: string, refCode: string) {
    const listing = listings.find((item) => item.id === listingId);
    if (!listing) return;
    const url = shareUrl(listing, refCode);
    const text = encodeURIComponent(`${listingShareTemplates(listing, url).whatsapp}\n${url}`);
    await openUrlSafe(`https://wa.me/?text=${text}`);
  }

  function messageSeller(listingId: string, sellerId: string, title: string) {
    const seller = findUser(sellerId);
    const conversation = startConversation(listingId, sellerId, `${title} ortak satış süreci hakkında konuşmak istiyorum.${seller ? ` Satıcı: ${seller.name}.` : ""}`);
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
  }

  // Satışı ortak bildirir: satışları yalnız satıcı sisteme ekler; ortak, referansıyla
  // yaptığı satışı satıcıya bildirip komisyonun başlatılmasını ister (güven döngüsü).
  function claimSale(listingId: string, sellerId: string, title: string) {
    const seller = findUser(sellerId);
    const conversation = startConversation(listingId, sellerId, `Merhaba${seller ? ` ${seller.name}` : ""}, "${title}" ürününü referans linkimle sattım. Satışı sisteme ekleyip komisyonumu başlatır mısın? Alıcı ve tutar bilgisini paylaşabilirim.`);
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
  }

  // Ortaklık kartı aksiyonları (hem mobil hem masaüstü aynı kartı kullanır).
  const partnershipActions: PartnershipCardActions = {
    copy: copyText,
    whatsapp: openWhatsapp,
    share: sharePartnership,
    messageSeller,
    claimSale,
    updateLeadStatus,
    updateSaleStatus,
    dispute: (saleId: string) => setDisputeSaleId(saleId),
    reapply: onJoin
  };
  const renderPartnershipCard = (partnership: Partnership) => {
    const listing = listings.find((item) => item.id === partnership.listingId);
    if (!listing) return null;
    return (
      <PartnershipCard
        key={partnership.id}
        listing={listing}
        partnership={partnership}
        listingLeads={leads.filter((lead) => lead.partnershipId === partnership.id)}
        listingSales={mySales.filter((sale) => sale.partnershipId === partnership.id)}
        clickCount={clickCounts[partnership.id] ?? 0}
        canReviewSale={canReviewSale}
        createSaleReview={createSaleReview}
        actions={partnershipActions}
      />
    );
  };

  if (isWideWeb) {
    const oppCategoryOptions = Array.from(new Set(allOpportunities.map((l) => l.category))).sort((a, b) => a.localeCompare(b, "tr"));
    const oppCityOptions = Array.from(new Set(allOpportunities.map((l) => l.location))).sort((a, b) => a.localeCompare(b, "tr"));
    const opportunities = allOpportunities.filter((l) => {
      if (oppCategory && l.category !== oppCategory) return false;
      // Komisyon oranı filtresi: sabit-₺ ilanlar için efektif oran (komisyon/fiyat×100)
      // hesaplanır. Önceden yalnız commissionType==="rate" geçiyordu; tüm sabit-₺ komisyonlu
      // (çoğu en kazançlı) ilanlar filtre açılınca TAMAMEN gizleniyordu.
      if (oppCommission > 0) {
        const effRate = l.commissionType === "rate" ? l.commissionValue : (l.price > 0 ? (l.commissionValue / l.price) * 100 : 0);
        if (effRate < oppCommission) return false;
      }
      if (oppCity && l.location !== oppCity) return false;
      if (oppStock === "in" && l.stockCount <= 0) return false;
      if (oppStock === "low" && (l.stockCount > 5 || l.stockCount <= 0)) return false;
      if (oppGuven) {
        const r = findUser(l.ownerId)?.rating ?? 0;
        if (oppGuven === "high" && r < 4.7) return false;
        if (oppGuven === "mid" && (r < 4.3 || r >= 4.7)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (oppSort === "commission") return commissionAmount(b) - commissionAmount(a);
      if (oppSort === "stock") return b.stockCount - a.stockCount;
      if (oppSort === "rating") return (findUser(b.ownerId)?.rating ?? 0) - (findUser(a.ownerId)?.rating ?? 0);
      if (oppSort === "new") return b.createdAt.localeCompare(a.createdAt);
      // recommended: doğrulanmış/öne çıkan önce, sonra komisyon değeri
      const av = (a.featured ? 2 : 0) + ((findUser(a.ownerId)?.verifiedIdentity || findUser(a.ownerId)?.verifiedPhone) ? 1 : 0);
      const bv = (b.featured ? 2 : 0) + ((findUser(b.ownerId)?.verifiedIdentity || findUser(b.ownerId)?.verifiedPhone) ? 1 : 0);
      return bv - av || commissionAmount(b) - commissionAmount(a);
    });
    const totalEarn = waiting + approved + paid;
    const rateListings = opportunities.filter((l) => l.commissionType === "rate");
    const avgCommissionPct = rateListings.length ? Math.round((rateListings.reduce((s, l) => s + l.commissionValue, 0) / rateListings.length) * 10) / 10 : 0;
    const myLeadCount = leads.filter((lead) => myPartnerships.some((p) => p.id === lead.partnershipId)).length;
    // Gerçek tahsil oranı: kayıtlı toplam komisyonun ne kadarı ödendi (sahte hedef yok).
    const collectRate = totalEarn > 0 ? Math.min(100, Math.round((paid / totalEarn) * 100)) : 0;
    const activities = mySales.slice().sort((a, b) => (b.paidAt ?? b.approvedAt ?? b.id).localeCompare(a.paidAt ?? a.approvedAt ?? a.id)).slice(0, 4);

    const tabs: Array<{ key: typeof tab; label: string; count?: number }> = [
      { key: "all", label: translateCopy("Tüm fırsatlar", language) },
      { key: "pending", label: translateCopy("Başvurduğum ilanlar", language), count: pendingPartnerships.length },
      { key: "active", label: translateCopy("Aktif ortaklıklar", language), count: activePartnerships.length },
      { key: "earning", label: translateCopy("Kazançlarım", language) },
      { key: "links", label: translateCopy("Özel bağlantılar", language) }
    ];
    const stats = [
      { icon: "handshake" as const, value: `${activePartnerships.length}`, label: translateCopy("Aktif ortaklıklar", language), tint: [colors.primarySoft, colors.primaryDark] as [string, string] },
      { icon: "cash-multiple" as const, value: money(totalEarn), label: translateCopy("Kayıtlı komisyon", language), tint: [colors.goldSoft, colors.gold] as [string, string] },
      { icon: "percent" as const, value: `%${avgCommissionPct}`.replace(".", ","), label: translateCopy("Ortalama komisyon teklifi", language), tint: [colors.infoSoft, colors.info] as [string, string] },
      { icon: "account-clock-outline" as const, value: `${pendingPartnerships.length}`, label: translateCopy("Bekleyen başvurular", language), tint: [colors.violetSoft, colors.violet] as [string, string] }
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, gap: 16, paddingBottom: 40, paddingHorizontal: 20, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
        <Seo title={translateCopy("Ortak Satış — Ürün paylaş, satışta komisyon kazan | OrtakSat", language)} description={translateCopy("Beğendiğin ürünlere ortak ol, referans linkini paylaş; satış gerçekleşince komisyonu kazan. Sıfır sermaye, ücretsiz başvuru. OrtakSat ortak satış platformu.", language)} path="/partner" />
        {/* Hero */}
        <View style={{ backgroundColor: colors.primarySoft, borderRadius: 20, flexDirection: "row", gap: 24, overflow: "hidden", paddingHorizontal: 28, paddingVertical: 24 }}>
          <View style={{ flex: 1.5, gap: 12, justifyContent: "center", minWidth: 0 }}>
            <View style={{ alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Ortak Satış", language)}</Text>
            </View>
            <Text style={{ color: colors.ink, fontSize: 28, fontWeight: "900", lineHeight: 34 }}>{translateCopy("Ortak satış fırsatları", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600", lineHeight: 22, maxWidth: 520 }}>{translateCopy("Güvenilir satıcılarla eşleşin, ürünleri paylaşın; komisyonu satıcıyla belirleyin. Ödeme ve teslimat taraflar arasında yapılır.", language)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 2 }}>
              {[
                { icon: "shield-check" as const, label: translateCopy("Anlaşma şartları kayıt altında", language) },
                { icon: "lock-check-outline" as const, label: translateCopy("Şeffaf ve güvenli", language) },
                { icon: "account-check-outline" as const, label: translateCopy("Doğrulanmış satıcılar", language) },
                { icon: "gift-outline" as const, label: translateCopy("Ücretsiz üyelik", language) }
              ].map((item) => (
                <View key={item.label} style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                  <MaterialCommunityIcons name={item.icon} size={15} color={colors.primary} />
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "flex-end", maxWidth: 460 }}>
            {stats.map((stat) => (
              <View key={stat.label} style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 14, width: 222 }}>
                <View style={{ alignItems: "center", backgroundColor: stat.tint[0], borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}>
                  <MaterialCommunityIcons name={stat.icon} size={20} color={stat.tint[1]} />
                </View>
                <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{stat.value}</Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{stat.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <LegalNote />

        {/* Tabs */}
        <View style={{ borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 6 }}>
          {tabs.map((tabItem) => {
            const on = tab === tabItem.key;
            return (
              <Pressable key={tabItem.key} onPress={() => setTab(tabItem.key)} style={{ alignItems: "center", borderBottomColor: on ? colors.primary : "transparent", borderBottomWidth: 2, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 12 }}>
                <Text style={{ color: on ? colors.primaryDark : colors.muted, fontSize: 14, fontWeight: on ? "900" : "700" }}>{tabItem.label}</Text>
                {tabItem.count ? (
                  <View style={{ backgroundColor: on ? colors.primarySoft : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}>
                    <Text style={{ color: on ? colors.primaryDark : colors.muted, fontSize: 11, fontWeight: "900" }}>{tabItem.count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Main + sidebar */}
        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {tab === "all" ? (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, padding: 16 }}>
                <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10, justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Ortak satış fırsatları", language)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{opportunities.length} {translateCopy("ilan bulundu", language)}</Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14, position: "relative", zIndex: 50 }}>
                  <PanelDropdown label="Kategoriler" value={oppCategory} onSelect={(v) => setOppCategory(String(v))} options={[{ label: "Tümü", value: "" }, ...oppCategoryOptions.map((c) => ({ label: c, value: c }))]} />
                  <PanelDropdown label="Komisyon Oranı" value={oppCommission} onSelect={(v) => setOppCommission(Number(v))} options={[{ label: "Tümü", value: 0 }, { label: "%10+", value: 10 }, { label: "%12+", value: 12 }, { label: "%15+", value: 15 }]} />
                  <PanelDropdown label="Konum" value={oppCity} onSelect={(v) => setOppCity(String(v))} options={[{ label: "Tümü", value: "" }, ...oppCityOptions.map((c) => ({ label: c, value: c }))]} />
                  <PanelDropdown label="Stok Durumu" value={oppStock} onSelect={(v) => setOppStock(String(v))} options={[{ label: "Tümü", value: "" }, { label: "Stokta var", value: "in" }, { label: "Az stok", value: "low" }]} />
                  <PanelDropdown label="Güven Seviyesi" value={oppGuven} onSelect={(v) => setOppGuven(String(v))} options={[{ label: "Tümü", value: "" }, { label: "Yüksek", value: "high" }, { label: "Orta", value: "mid" }]} />
                  <PanelDropdown label="Sırala" value={oppSort} onSelect={(v) => setOppSort(String(v) as typeof oppSort)} options={[{ label: "Önerilen", value: "recommended" }, { label: "En yüksek komisyon", value: "commission" }, { label: "En çok stok", value: "stock" }, { label: "Satıcı puanı", value: "rating" }, { label: "Yeni eklenen", value: "new" }]} />
                  {(oppCategory || oppCommission || oppCity || oppStock || oppGuven || oppSort !== "recommended") ? (
                    <Pressable onPress={() => { setOppCategory(""); setOppCommission(0); setOppCity(""); setOppStock(""); setOppGuven(""); setOppSort("recommended"); }} style={{ alignItems: "center", flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 7 }}>
                      <MaterialCommunityIcons name="close" size={14} color={colors.accent} />
                      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "800" }}>{translateCopy("Temizle", language)}</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={{ borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", paddingBottom: 8 }}>
                  <Text style={{ color: colors.muted, flex: 2.4, fontSize: 12, fontWeight: "800" }}>{translateCopy("Ürün", language)}</Text>
                  <Text style={{ color: colors.muted, flex: 1.4, fontSize: 12, fontWeight: "800" }}>{translateCopy("Satıcı", language)}</Text>
                  <Text style={{ color: colors.muted, flex: 0.9, fontSize: 12, fontWeight: "800" }}>{translateCopy("Komisyon", language)}</Text>
                  <Text style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "800" }}>{translateCopy("Konum", language)}</Text>
                  <Text style={{ color: colors.muted, flex: 0.9, fontSize: 12, fontWeight: "800" }}>{translateCopy("Kalan Stok", language)}</Text>
                  <Text style={{ color: colors.muted, flex: 0.8, fontSize: 12, fontWeight: "800" }}>{translateCopy("Güven", language)}</Text>
                  <View style={{ width: 150 }} />
                </View>
                {opportunities.slice(0, oppVisible).map((listing) => (
                  <OppRow key={listing.id} listing={listing} owner={findUser(listing.ownerId)} joined={joinedIds.has(listing.id)} onJoin={() => onJoin(listing.id)} onDetail={() => router.push(`/listing/${listing.id}`)} />
                ))}
              </View>
            ) : (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{tabs.find((x) => x.key === tab)?.label}</Text>
                {tab === "links" ? (
                  <>
                    {/* Herkese açık ortak vitrini: tüm aktif promosyon ilanları tek paylaşılabilir sayfada. */}
                    <View style={{ backgroundColor: colors.primarySoft, borderRadius: 12, gap: 8, padding: 12 }}>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                        <MaterialCommunityIcons name="storefront-outline" size={17} color={colors.primaryDark} />
                        <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Herkese açık vitrinim", language)}</Text>
                      </View>
                      <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy("Önerdiğin tüm ilanlar tek sayfada. Bu bağlantıyı paylaş; buradan gelen talep/işlemler sana yazılır.", language)}</Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton href={{ pathname: "/ortak/[id]", params: { id: currentUser.id } }} icon="open-in-new">{translateCopy("Vitrini aç", language)}</PrimaryButton>
                        </View>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton tone="secondary" icon="link-variant" onPress={() => void copyText("Vitrin", `https://www.ortaksat.com/ortak/${currentUser.id}`)}>{translateCopy("Bağlantıyı kopyala", language)}</PrimaryButton>
                        </View>
                      </View>
                    </View>
                    {activePartnerships.length === 0 ? <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>{translateCopy("Aktif ortaklık bağlantın yok.", language)}</Text> :
                    activePartnerships.map((p) => {
                      const l = listings.find((x) => x.id === p.listingId);
                      return l ? <ShareRow key={p.id} title={l.title} url={shareUrl(l, p.refCode)} onCopy={() => void copyText("Bağlantı", shareUrl(l, p.refCode))} /> : null;
                    })}
                  </>
                ) : (tab === "earning" ? mySales : tab === "active" ? activePartnerships : pendingPartnerships).length === 0 ? (
                  <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>{translateCopy("Henüz kayıt yok.", language)}</Text>
                ) : (
                  (tab === "earning"
                    ? mySales.map((s) => {
                        const l = listings.find((x) => x.id === s.listingId);
                        const canConfirm = s.status === "seller_paid" || s.status === "disputed";
                        const canDispute = s.status !== "paid" && s.status !== "cancelled" && s.status !== "disputed";
                        return (
                          <View key={s.id} style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 8, paddingTop: 10 }}>
                            <OppMiniRow title={l?.title ?? translateCopy("Ürün", language)} image={l?.image} right={money(s.commissionAmount)} sub={saleLabels[s.status]} />
                            {s.status === "disputed" && s.payoutNote ? <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>{s.payoutNote}</Text> : null}
                            {canConfirm || canDispute ? (
                              <View style={{ flexDirection: "row", gap: 8 }}>
                                {canConfirm ? <View style={{ flex: 1 }}><PrimaryButton tone="soft" onPress={() => updateSaleStatus(s.id, "paid")}>{s.status === "disputed" ? "Çözüldü · Aldım" : "Ödemeyi Aldım"}</PrimaryButton></View> : null}
                                {canDispute ? <View style={{ flex: 1 }}><PrimaryButton tone="secondary" onPress={() => setDisputeSaleId(s.id)}>Anlaşmazlık</PrimaryButton></View> : null}
                              </View>
                            ) : null}
                          </View>
                        );
                      })
                    : (tab === "active" ? activePartnerships : pendingPartnerships).map(renderPartnershipCard))
                )}
              </View>
            )}
            {tab === "all" && opportunities.length > oppVisible ? (
              <Pressable onPress={() => setOppVisible((v) => v + 8)} style={{ alignItems: "center", alignSelf: "center", marginTop: 14 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 24, paddingVertical: 11 }}>
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("Daha fazla göster", language)}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={16} color={colors.muted} />
                </View>
              </Pressable>
            ) : null}
          </View>

          {/* Sidebar */}
          <View style={{ gap: 16, width: 320 }}>
            {mounted && myBroughtLeads.length > 0 ? (
              <MiniBarChart data={leadSeries} title={translateCopy("Son 14 gün · getirdiğin talep", language)} totalLabel={`${myBroughtLeads.length} ${translateCopy("talep", language)}`} />
            ) : null}
            <PartnerTier sales={mySales} />
            <PartnerLeaderboard users={users} partnerships={partnerships} sales={sales} highlightUserId={currentUser.id} />
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Paylaşım bağlantılarım", language)}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Tüm paylaşım bağlantılarını gör", language)} onPress={() => setTab("links")}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Tümünü gör", language)}</Text></Pressable>
              </View>
              {activePartnerships.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{translateCopy("Ortak olduğunda paylaşım bağlantıların burada görünür.", language)}</Text>
              ) : (
                activePartnerships.slice(0, 3).map((p) => {
                  const l = listings.find((x) => x.id === p.listingId);
                  return l ? <ShareRow key={p.id} title={l.title} url={shareUrl(l, p.refCode)} onCopy={() => void copyText("Bağlantı", shareUrl(l, p.refCode))} compact /> : null;
                })
              )}
              {/* Paylaşım linkleri ortak olunca otomatik üretilir; buradan yeni ürüne ortak olunur. */}
              <Link href="/explore" asChild>
                <Pressable accessibilityRole="link" accessibilityLabel={translateCopy("Ortak olacak ürün bul", language)} style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                  <MaterialCommunityIcons name="store-search-outline" size={18} color={colors.primary} />
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Ortak olacak ürün bul", language)}</Text>
                </Pressable>
              </Link>
            </View>

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Son aktivitelerim", language)}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Tüm kazanç hareketlerini gör", language)} onPress={() => setTab("earning")}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Tümünü gör", language)}</Text></Pressable>
              </View>
              {activities.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{translateCopy("Satış ve komisyon hareketlerin burada listelenir.", language)}</Text>
              ) : (
                activities.map((s) => {
                  const l = listings.find((x) => x.id === s.listingId);
                  return (
                    <View key={s.id} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                      <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 34, justifyContent: "center", width: 34 }}>
                        <MaterialCommunityIcons name="cash-check" size={17} color={colors.primaryDark} />
                      </View>
                      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy(saleLabels[s.status], language)}</Text>
                        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{l?.title ?? translateCopy("Ürün", language)}</Text>
                      </View>
                      <Text style={{ color: colors.success, fontSize: 13, fontWeight: "900" }}>+{money(s.commissionAmount)}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </View>

        {/* Performance bar */}
        <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 24, paddingHorizontal: 20, paddingVertical: 16 }}>
          <View style={{ gap: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy("Performans özeti", language)}</Text>
            <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{translateCopy("Tüm zamanlar", language)}</Text>
          </View>
          <PerfMetric icon="cursor-default-click-outline" label="Link tıklama" value={`${totalClicks}`} />
          <PerfMetric icon="account-clock-outline" label="Talep" value={`${myLeadCount}`} />
          <PerfMetric icon="star-outline" label="Satış" value={`${mySales.length}`} />
          <PerfMetric icon="cash" label="Kazanç" value={money(approved + paid)} />
          <View style={{ flex: 1, gap: 6, minWidth: 200 }}>
            {totalEarn > 0 ? (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{translateCopy("Tahsil edilen komisyon", language)}</Text>
                  <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>{money(paid)} / {money(totalEarn)}</Text>
                </View>
                <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 8, overflow: "hidden" }}>
                  <View style={{ backgroundColor: colors.primary, height: "100%", width: `${collectRate}%` }} />
                </View>
              </>
            ) : (
              <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "700" }}>{translateCopy("Henüz kazanç verisi yok — ilk satışında burada görünecek.", language)}</Text>
            )}
          </View>
          <Pressable onPress={() => setTab("earning")} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, opacity: pressed ? 0.8 : 1, paddingHorizontal: 16, paddingVertical: 10 })}>
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Kazanç Detayı", language)}</Text>
          </Pressable>
        </View>
        <DisputeModal
          visible={disputeSaleId !== null}
          onClose={() => setDisputeSaleId(null)}
          onSubmit={(reason) => { if (disputeSaleId) updateSaleStatus(disputeSaleId, "disputed", reason); setDisputeSaleId(null); }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 12, paddingBottom: Platform.OS === "web" ? 28 : 96 }}>
      <WebContainer max={1280} padding={0} style={{ gap: 14 }}>
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

      {mounted && myBroughtLeads.length > 0 ? (
        <MiniBarChart data={leadSeries} title={translateCopy("Son 14 gün · getirdiğin talep", language)} totalLabel={`${myBroughtLeads.length} ${translateCopy("talep", language)}`} />
      ) : null}

      <PartnerLeaderboard users={users} partnerships={partnerships} sales={sales} highlightUserId={currentUser.id} />

      {allOpportunities.length > 0 ? (
        <Card>
          <SectionTitle title="Ortak satış fırsatları" action={`${mobileOpportunities.length}`} />
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 17 }}>{translateCopy("Beğendiğin ürüne ortak ol, kendi kitlene sat, satış olunca komisyon kazan.", language)}</Text>
          {/* Mobil fırsat filtre/sıralama çipleri (masaüstü toolbar'ın karşılığı). */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
            {([[0, "Tümü komisyon"], [10, "%10+"], [15, "%15+"]] as const).map(([val, lbl]) => {
              const on = oppCommission === val;
              return (
                <Pressable key={`c${val}`} onPress={() => setOppCommission(val)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{translateCopy(lbl, language)}</Text>
                </Pressable>
              );
            })}
            <View style={{ backgroundColor: colors.line, marginHorizontal: 2, width: 1 }} />
            {([["recommended", "Önerilen"], ["commission", "Yüksek komisyon"], ["new", "Yeni"], ["stock", "Çok stok"]] as const).map(([val, lbl]) => {
              const on = oppSort === val;
              return (
                <Pressable key={`s${val}`} onPress={() => setOppSort(val)} style={{ backgroundColor: on ? colors.primaryDark : colors.surfaceAlt, borderColor: on ? colors.primaryDark : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{translateCopy(lbl, language)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {mobileOpportunities.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700", paddingVertical: 10 }}>{translateCopy("Bu filtreye uyan fırsat yok. Komisyon eşiğini düşür.", language)}</Text>
          ) : null}
          {mobileOpportunities.slice(0, oppVisible).map((listing) => {
            const owner = findUser(listing.ownerId);
            const joined = joinedIds.has(listing.id);
            return (
              <View key={listing.id} style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 10, paddingTop: 10 }}>
                <SafeRemoteImage uri={listing.image} style={{ backgroundColor: colors.line, borderRadius: 8, height: 52, width: 52 }} contentFit="cover" />
                <Pressable onPress={() => router.push(`/listing/${listing.id}`)} style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{displayText(listing.title)}</Text>
                  <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "800" }}>{commissionText(listing)} · kazanç {moneyIn(commissionAmount(listing), listing.currency)}</Text>
                  <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{displayText(listing.location)}{owner ? ` · ${displayText(owner.name)}` : ""}</Text>
                </Pressable>
                <Pressable onPress={() => onJoin(listing.id)} disabled={joined} style={({ pressed }) => ({ alignItems: "center", backgroundColor: joined ? colors.surfaceAlt : colors.primary, borderColor: joined ? colors.line : colors.primary, borderRadius: 8, borderWidth: 1, opacity: pressed ? 0.85 : 1, paddingHorizontal: 13, paddingVertical: 8 })}>
                  <Text style={{ color: joined ? colors.muted : "#FFFFFF", fontSize: 12, fontWeight: "900" }}>{joined ? translateCopy("Ortak", language) : translateCopy("Ortak ol", language)}</Text>
                </Pressable>
              </View>
            );
          })}
          {mobileOpportunities.length > oppVisible ? (
            <Pressable onPress={() => setOppVisible((v) => v + 8)} style={{ alignItems: "center", borderColor: colors.primary, borderRadius: 10, borderWidth: 1.5, marginTop: 4, paddingVertical: 11 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Daha fazla fırsat göster", language)}</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

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
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateCopy("Aramayı temizle", language)}>
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

      {myPartnerships.length === 0 ? <QuickStart role="partner" /> : null}
      {myPartnerships.length > 0 && visiblePartnerships.length === 0 ? <EmptyState title={t("noResults")} body={t("partnerNoResultBody")} /> : null}

      {visiblePartnerships.map(renderPartnershipCard)}
      </WebContainer>
      <DisputeModal
        visible={disputeSaleId !== null}
        onClose={() => setDisputeSaleId(null)}
        onSubmit={(reason) => { if (disputeSaleId) updateSaleStatus(disputeSaleId, "disputed", reason); setDisputeSaleId(null); }}
      />
    </ScrollView>
  );
}

type PartnershipCardActions = {
  copy: (label: string, text: string) => void;
  whatsapp: (listingId: string, refCode: string) => void;
  share: (listingId: string, refCode: string) => void;
  messageSeller: (listingId: string, sellerId: string, title: string) => void;
  claimSale: (listingId: string, sellerId: string, title: string) => void;
  updateLeadStatus: (leadId: string, status: LeadStatus) => void;
  updateSaleStatus: (saleId: string, status: SaleStatus, reason?: string) => void;
  dispute: (saleId: string) => void;
  reapply: (listingId: string) => void;
};

// Ortak ortaklık kartı — hem mobil liste hem masaüstü "Aktif/Bekleyen" sekmesinde
// AYNI zengin araç seti (paylaşım linki, WhatsApp/IG/TikTok şablonları, satıcıya mesaj,
// "sattım bildir", performans metrikleri, gelen talepler, komisyon defteri). Masaüstünde
// eskiden yalnız minik satır (OppMiniRow) vardı — parite sağlandı.
function PartnershipCard({ listing, partnership, listingLeads, listingSales, clickCount, canReviewSale, createSaleReview, actions }: {
  listing: Listing;
  partnership: Partnership;
  listingLeads: Lead[];
  listingSales: Sale[];
  clickCount: number;
  canReviewSale: (saleId: string) => boolean;
  createSaleReview: (saleId: string, rating: number, comment: string) => unknown;
  actions: PartnershipCardActions;
}) {
  const { language, t } = useLanguage();
  const url = shareUrl(listing, partnership.refCode);
  const templates = listingShareTemplates(listing, url);
  const earned = listingSales.reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const sellerPaidCount = listingSales.filter((sale) => sale.status === "seller_paid").length;
  // Bu ortağın KİŞİSEL efektif komisyonu (override / kademeli / varsayılan) — bir satış, liste fiyatı.
  const priorSales = listingSales.filter((sale) => sale.status !== "cancelled").length;
  const myCommission = effectiveCommissionAmount(listing, partnership, priorSales, listing.price, 1);
  const hasPersonalRate = Boolean(partnership.commissionOverrideType) || (listing.commissionType === "rate" && !!listing.commissionTiers?.length);
  return (
    <Card>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Image source={{ uri: listing.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 74, width: 74 }} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text selectable numberOfLines={2} style={{ color: colors.ink, fontSize: 18, fontWeight: "900", lineHeight: 22 }}>{listing.title}</Text>
          <Text selectable numberOfLines={2} style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
            {partnership.shareChannel || t("channelMissing")} · {partnership.reachEstimate ?? 0} {t("reach")}
          </Text>
        </View>
        <StatusPill
          label={partnership.status === "active" ? "Aktif" : partnership.status === "pending" ? "Bekliyor" : partnership.status === "rejected" ? "Reddedildi" : partnership.status === "blocked" ? "Kapatıldı" : partnership.status === "completed" ? "Tamamlandı" : "Sonlandırıldı"}
          tone={partnership.status === "active" ? "success" : partnership.status === "pending" ? "warning" : "neutral"}
        />
      </View>

      {partnership.status === "active" ? (
        <>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 9 }}>
            <MaterialCommunityIcons name="cash-multiple" size={17} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 12.5, fontWeight: "800" }}>
              {translateCopy(hasPersonalRate ? "Sana özel komisyon" : "Bu satıştan komisyonun", language)}
            </Text>
            <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{moneyIn(myCommission, listing.currency)}</Text>
          </View>
          <Text selectable style={{ color: colors.info, fontSize: 13, lineHeight: 19 }}>{url}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={{ flexBasis: "31%", flexGrow: 1 }}><PrimaryButton tone="secondary" onPress={() => actions.copy("Satış bağlantısı", url)}>Kopyala</PrimaryButton></View>
            <View style={{ flexBasis: "31%", flexGrow: 1 }}><PrimaryButton tone="soft" onPress={() => actions.whatsapp(listing.id, partnership.refCode)}>WhatsApp</PrimaryButton></View>
            <View style={{ flexBasis: "31%", flexGrow: 1 }}><PrimaryButton onPress={() => actions.share(listing.id, partnership.refCode)}>Paylaş</PrimaryButton></View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={{ flexBasis: "48%", flexGrow: 1 }}><PrimaryButton tone="secondary" onPress={() => actions.copy("Instagram açıklaması", templates.instagram)}>Instagram Metni</PrimaryButton></View>
            <View style={{ flexBasis: "48%", flexGrow: 1 }}><PrimaryButton tone="secondary" onPress={() => actions.copy("TikTok açıklaması", templates.tiktok)}>TikTok Metni</PrimaryButton></View>
          </View>
          <PrimaryButton tone="secondary" icon="message-text-outline" onPress={() => actions.messageSeller(listing.id, listing.ownerId, listing.title)}>Satıcıya mesaj yaz</PrimaryButton>
          <PrimaryButton tone="soft" icon="cash-check" onPress={() => actions.claimSale(listing.id, listing.ownerId, listing.title)}>Sattım — satıcıya bildir</PrimaryButton>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{translateCopy("Satışını satıcı sisteme ekleyince komisyonun başlar. Referans linkinle satış yaptıysan buradan satıcıya bildir.", language)}</Text>
        </>
      ) : partnership.status === "rejected" ? (
        <View style={{ gap: 8 }}>
          <View style={{ backgroundColor: colors.warningSoft, borderColor: colors.line, borderRadius: 10, borderWidth: 1, gap: 4, padding: 12 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
              <MaterialCommunityIcons name="account-cancel-outline" size={16} color={colors.warning} />
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{translateCopy("Başvuru reddedildi", language)}</Text>
            </View>
            <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{displayText(partnership.rejectionReason || "Satıcı bu başvuruyu uygun görmedi.")}</Text>
          </View>
          <PrimaryButton icon="refresh" onPress={() => actions.reapply(listing.id)}>{translateCopy("Tekrar başvur", language)}</PrimaryButton>
          <PrimaryButton tone="secondary" icon="message-text-outline" onPress={() => actions.messageSeller(listing.id, listing.ownerId, listing.title)}>Satıcıya mesaj yaz</PrimaryButton>
        </View>
      ) : partnership.status === "pending" ? (
        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>{t("partnerApprovalPendingNote")} {partnership.note}</Text>
          <PrimaryButton tone="secondary" icon="message-text-outline" onPress={() => actions.messageSeller(listing.id, listing.ownerId, listing.title)}>Satıcıya mesaj yaz</PrimaryButton>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, gap: 4, padding: 12 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
              <MaterialCommunityIcons name="account-off-outline" size={16} color={colors.muted} />
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{translateCopy(partnership.status === "blocked" ? "Ortaklık kapatıldı" : partnership.status === "completed" ? "Ortaklık tamamlandı" : "Ortaklık sonlandırıldı", language)}</Text>
            </View>
            <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{translateCopy(partnership.status === "blocked" ? "Bu ortaklık satıcı tarafından kapatıldı; paylaşım linkin artık aktif değil." : "Bu ortaklık sona erdi; paylaşım linkin artık lead getirmez.", language)}</Text>
          </View>
          <PrimaryButton tone="secondary" icon="message-text-outline" onPress={() => actions.messageSeller(listing.id, listing.ownerId, listing.title)}>Satıcıya mesaj yaz</PrimaryButton>
        </View>
      )}

      <PartnerActionBand
        active={partnership.status === "active"}
        leadCount={listingLeads.length}
        sellerPaidCount={sellerPaidCount}
        onCopy={() => actions.copy("Satış bağlantısı", url)}
        onShare={() => actions.share(listing.id, partnership.refCode)}
      />

      <SectionTitle title="Performans" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Metric label="Tıklama" value={`${clickCount}`} />
        <Metric label="Talep" value={`${listingLeads.length}`} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Metric label="Satış" value={`${listingSales.length}`} />
        <Metric label="Kazanç" value={money(earned)} />
      </View>
      {/* Dönüşüm hunisi: tıklama → talep → satış (oranlarla). */}
      {clickCount > 0 || listingLeads.length > 0 ? (
        <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 10, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{clickCount} {translateCopy("tıklama", language)}</Text>
          <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{listingLeads.length} {translateCopy("talep", language)}{clickCount > 0 ? ` (%${Math.round((listingLeads.length / clickCount) * 100)})` : ""}</Text>
          <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
          <Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "900" }}>{listingSales.length} {translateCopy("satış", language)}{listingLeads.length > 0 ? ` (%${Math.round((listingSales.length / listingLeads.length) * 100)})` : ""}</Text>
        </View>
      ) : null}

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
          {lead.status !== "converted" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {([["contacted", "İletişimde"], ["interested", "İlgileniyor"], ["lost", "Kayıp"]] as const).map(([st, lbl]) => {
                const on = lead.status === st;
                return (
                  <Pressable key={st} onPress={() => actions.updateLeadStatus(lead.id, st)} style={{ backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6 }}>
                    <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 11.5, fontWeight: "800" }}>{translateCopy(lbl, language)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ))}

      {listingSales.length > 0 ? <SectionTitle title="Komisyonlar" /> : null}
      {listingSales.map((sale) => (
        <View key={sale.id} style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 10, paddingTop: 12 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Metric label="Satış" value={money(sale.amount)} />
            <Metric label="Komisyon" value={money(sale.commissionAmount)} />
          </View>
          {sale.bonusApplied ? <StatusPill label={`${translateCopy("Bonus dahil", language)} +${money(sale.bonusApplied)}`} tone="success" /> : null}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Metric label="Adet" value={`${sale.quantity ?? 1}`} />
            <Metric label="İade sonu" value={sale.returnUntil ?? "-"} />
          </View>
          <StatusPill label={saleLabels[sale.status]} tone={sale.status === "paid" ? "success" : "warning"} />
          {sale.payoutNote ? <Text selectable style={{ color: sale.status === "disputed" ? colors.accent : colors.muted, fontSize: 13, lineHeight: 19 }}>{sale.payoutNote}</Text> : null}
          {sale.status === "seller_paid" || sale.status === "disputed" ? <PrimaryButton tone="soft" onPress={() => actions.updateSaleStatus(sale.id, "paid")}>{sale.status === "disputed" ? "Çözüldü · Ödemeyi Aldım" : "Ödemeyi Aldım"}</PrimaryButton> : null}
          {sale.status !== "paid" && sale.status !== "cancelled" && sale.status !== "disputed" ? <PrimaryButton tone="secondary" onPress={() => actions.dispute(sale.id)}>Anlaşmazlık Bildir</PrimaryButton> : null}
          <ReviewPrompt sale={sale} canReviewSale={canReviewSale} createSaleReview={createSaleReview} />
        </View>
      ))}
    </Card>
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

function GuvenBadge({ rating }: { rating: number }) {
  const { language } = useLanguage();
  // Puanı olmayan satıcı "Düşük güven" DEĞİL "Yeni"dir (yeni/demo satıcıya haksız damga vurmayı önler).
  const level = rating <= 0 ? { label: "Yeni", color: colors.primaryDark, bg: colors.primarySoft } : rating >= 4.7 ? { label: "Yüksek", color: colors.success, bg: colors.successSoft } : rating >= 4.3 ? { label: "Orta", color: colors.gold, bg: colors.goldSoft } : { label: "Düşük", color: colors.muted, bg: colors.surfaceAlt };
  const icon = rating <= 0 ? "sprout-outline" as const : "shield-check" as const;
  return (
    <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: level.bg, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
      <MaterialCommunityIcons name={icon} size={12} color={level.color} />
      <Text style={{ color: level.color, fontSize: 11, fontWeight: "900" }}>{translateCopy(level.label, language)}</Text>
    </View>
  );
}

function OppRow({ listing, owner, joined, onJoin, onDetail }: { listing: Listing; owner?: User; joined: boolean; onJoin: () => void; onDetail: () => void }) {
  const { language } = useLanguage();
  return (
    <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", paddingVertical: 12 }}>
      <View style={{ alignItems: "center", flex: 2.4, flexDirection: "row", gap: 10, minWidth: 0 }}>
        <View style={{ backgroundColor: colors.line, borderRadius: 10, height: 46, overflow: "hidden", width: 46 }}>
          <SafeRemoteImage uri={listing.image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={120} />
        </View>
        <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{displayText(listing.title)}</Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{displayText(listing.category)}</Text>
        </View>
      </View>
      <View style={{ flex: 1.4, gap: 1, minWidth: 0 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{owner?.name ?? translateCopy("Satıcı", language)}</Text>
          {owner?.verifiedPhone || owner?.verifiedIdentity ? <MaterialCommunityIcons name="check-decagram" size={12} color={colors.primary} /> : null}
        </View>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{(owner?.rating ?? 0) > 0 ? `★ ${owner?.rating}` : translateCopy("Yeni satıcı", language)}</Text>
      </View>
      <View style={{ flex: 0.9 }}>
        <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{listing.commissionType === "rate" ? `%${listing.commissionValue}` : money(commissionAmount(listing))}</Text>
        <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: "700" }}>{translateCopy("Kazanç", language)} {money(commissionAmount(listing))}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12, fontWeight: "700" }}>{displayText(listing.location)}</Text>
      <Text style={{ color: colors.ink, flex: 0.9, fontSize: 12, fontWeight: "700" }}>{listing.stockCount} {translateCopy("adet", language)}</Text>
      <View style={{ flex: 0.8 }}><GuvenBadge rating={owner?.rating ?? 0} /></View>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 6, width: 150 }}>
        <Pressable onPress={onJoin} style={({ pressed }) => ({ alignItems: "center", backgroundColor: joined ? colors.surfaceAlt : colors.primary, borderColor: joined ? colors.line : colors.primary, borderRadius: 8, borderWidth: 1, opacity: pressed ? 0.85 : 1, paddingHorizontal: 12, paddingVertical: 7 })}>
          <Text style={{ color: joined ? colors.muted : "#FFFFFF", fontSize: 12, fontWeight: "900" }}>{joined ? translateCopy("Ortak", language) : translateCopy("Ortak ol", language)}</Text>
        </Pressable>
        <Pressable onPress={onDetail} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, opacity: pressed ? 0.85 : 1, paddingHorizontal: 10, paddingVertical: 7 })}>
          <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{translateCopy("Detay", language)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function OppMiniRow({ title, image, right, sub }: { title: string; image?: string; right: string; sub: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 10 }}>
      <View style={{ backgroundColor: colors.line, borderRadius: 10, height: 44, overflow: "hidden", width: 44 }}>
        {image ? <SafeRemoteImage uri={image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={120} /> : null}
      </View>
      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{displayText(title)}</Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{translateCopy(sub, language)}</Text>
      </View>
      <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{right}</Text>
    </View>
  );
}

function ShareRow({ title, url, onCopy, compact }: { title: string; url: string; onCopy: () => void; compact?: boolean }) {
  const { language } = useLanguage();
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <MaterialCommunityIcons name="link-variant" size={18} color={colors.primary} />
      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{displayText(title)}</Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: compact ? 10 : 11, fontWeight: "600" }}>{url}</Text>
      </View>
      <Pressable onPress={onCopy} hitSlop={8} accessibilityRole="button" accessibilityLabel={translateCopy("Bağlantıyı kopyala", language)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, height: 32, justifyContent: "center", opacity: pressed ? 0.7 : 1, width: 32 })}>
        <MaterialCommunityIcons name="content-copy" size={15} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

function PerfMetric({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
      <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, height: 38, justifyContent: "center", width: 38 }}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primaryDark} />
      </View>
      <View style={{ gap: 1 }}>
        <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{value}</Text>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{translateCopy(label, language)}</Text>
      </View>
    </View>
  );
}

function PanelDropdown({ label, value, options, onSelect }: { label: string; value: string | number; options: Array<{ label: string; value: string | number }>; onSelect: (v: string | number) => void }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const active = value !== "" && value !== 0;
  return (
    <View style={{ position: "relative", zIndex: open ? 1000 : 1 }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ alignItems: "center", backgroundColor: active ? colors.primarySoft : colors.surfaceAlt, borderColor: active ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 }}>
        <Text style={{ color: active ? colors.primaryDark : colors.ink, fontSize: 12, fontWeight: active ? "900" : "700" }}>{translateCopy(active && selected ? selected.label : label, language)}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
      </Pressable>
      {open ? (
        <>
          <Pressable onPress={() => setOpen(false)} style={{ bottom: -2000, left: -2000, position: "absolute", right: -2000, top: -2000, zIndex: 900 }} />
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, left: 0, maxHeight: 300, minWidth: 190, paddingVertical: 6, position: "absolute", shadowColor: "#101828", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.16, shadowRadius: 24, top: 40, zIndex: 1000 }}>
            <ScrollView style={{ maxHeight: 288 }} keyboardShouldPersistTaps="handled">
              {options.map((opt) => {
                const isSel = opt.value === value;
                return (
                  <Pressable key={`${opt.value}`} onPress={() => { onSelect(opt.value); setOpen(false); }} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : "transparent", flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 9 })}>
                    <MaterialCommunityIcons name={isSel ? "check-circle" : "circle-outline"} size={15} color={isSel ? colors.primary : colors.subtle} />
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: isSel ? "900" : "600" }}>{translateCopy(opt.label, language)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </>
      ) : null}
    </View>
  );
}
