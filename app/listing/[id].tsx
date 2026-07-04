import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { Link, type Href, useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, Share, Text, TextInput, View, useWindowDimensions } from "react-native";

import { findCategorySlug } from "@/lib/category-tree";
import { useCompare } from "@/lib/compare";
import { Accordion } from "@/components/accordion";
import { AgreementCard } from "@/components/agreement-card";
import { colors } from "@/components/colors";
import { LegalNote } from "@/components/legal-disclaimer";
import { ListingCard } from "@/components/listing-card";
import { EarningsCalculator } from "@/components/earnings-calculator";
import { ListingQA } from "@/components/listing-qa";
import { ShareRow } from "@/components/share-row";
import { Skeleton } from "@/components/skeleton";
import { tokenize } from "@/lib/search";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { SafetyNote } from "@/components/safety-note";
import { Card, EmptyState, Metric, PrimaryButton, StatusPill } from "@/components/ui";
import { commissionAmount, commissionText, listingShareTemplates, money, moneyIn, productUrl, shareUrl, trPhoneIntl } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { WebContainer } from "@/components/web-container";
import { fetchListingById, fetchSellerPhone } from "@/lib/supabase-data";
import { insertReferralLead, logReferralClick, resolveReferralLink } from "@/lib/live-service";
import { getRefAttribution, saveRefAttribution } from "@/lib/referral";
import { isSupabaseConfigured } from "@/lib/supabase";
import { pushRecent } from "@/lib/recent";
import { calculateUserTrustScores } from "@/lib/trust-score";
import type { LeadSource, Listing, PartnershipStatus, PurchaseIntent, User } from "@/lib/types";
import { useStore } from "@/lib/use-store";

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

export default function ListingDetailScreen() {
  const params = useLocalSearchParams<{ id: string; ref?: string; p?: string }>();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";
  // Ortak referans kodu: ?ref= veya kısa ?p= (varsa). Landing dışı akışta da yakalanır.
  const refParam = (Array.isArray(params.ref) ? params.ref[0] : params.ref) || (Array.isArray(params.p) ? params.p[0] : params.p) || "";
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const isWideWeb = useIsWideWeb();
  const {
    createLead,
    createSaleReview,
    canReviewSale,
    authError,
    currentUser,
    findListing,
    findPartnership,
    findUser,
    isFavorite,
    joinListing,
    reportListing,
    reviews,
    sales,
    leads,
    listings,
    partnerships,
    reports,
    startConversation,
    toggleFavorite
  } = useStore();
  const { has: hasInCompare, toggle: toggleCompare } = useCompare();
  const storeListing = findListing(id);
  const [remote, setRemote] = useState<{ listing: Listing; owner?: User } | null>(null);
  const [fetching, setFetching] = useState(false);
  // Başvuru formu — gerçek kullanıcı girdisi (eski sabit/tohum metinler kaldırıldı).
  const [applicationNote, setApplicationNote] = useState("");
  const [applicationChannel, setApplicationChannel] = useState("WhatsApp");
  const [applicationAudience, setApplicationAudience] = useState("");
  const [applicationHandle, setApplicationHandle] = useState("");
  const [applicationReach, setApplicationReach] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [leadNote, setLeadNote] = useState("");
  const [leadSource, setLeadSource] = useState<LeadSource>("whatsapp");
  const [purchaseIntent, setPurchaseIntent] = useState<PurchaseIntent>("warm");
  const [message, setMessage] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [activeImage, setActiveImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const swipeStartX = useRef(0);
  // Ortak referans atfı: bu ilana hangi ortağın yönlendirdiği (varsa).
  const [attributedPartnershipId, setAttributedPartnershipId] = useState<string | null>(null);
  const refCapturedFor = useRef<string>(""); // aynı ref'i aynı ilan için tekrar çözme/loglama kilidi
  const contactLeadDone = useRef(false); // iletişimde tek bir atıf-lead üret
  const router = useRouter();

  // Lightbox açıkken web'de klavye: ← → gezinme, Esc kapatma.
  useEffect(() => {
    if (!lightbox || Platform.OS !== "web" || typeof window === "undefined") return;
    const l = storeListing ?? remote?.listing;
    const n = l ? [l.image, ...(l.adAssets ?? [])].filter(Boolean).length : 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowRight" && n > 1) { setActiveImage((i) => (i + 1) % n); setZoomed(false); }
      else if (e.key === "ArrowLeft" && n > 1) { setActiveImage((i) => (i - 1 + n) % n); setZoomed(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, storeListing, remote?.listing?.id]);

  // Paylaşılan link herkeste açılsın: ilan bellekte yoksa Supabase'den id ile çek.
  useEffect(() => {
    let active = true;
    if (storeListing || !id || !isSupabaseConfigured) return;
    setFetching(true);
    fetchListingById(id)
      .then((res) => {
        if (active) setRemote(res);
      })
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, [id, storeListing]);

  const listing = storeListing ?? remote?.listing;

  // Son gezilen ilanları kaydet — "Son Gezdiklerin" için.
  useEffect(() => {
    if (listing?.id) pushRecent(listing.id);
  }, [listing?.id]);

  // Ortak referans yakalama: URL'de ?ref= / ?p= varsa (ya da landing'de saklanmışsa)
  // çöz + kısa süreli sakla; tıklamayı logla. Geçersiz/expired/pasifse SESSİZCE yok say.
  useEffect(() => {
    const lst = storeListing ?? remote?.listing;
    if (!lst) return;
    // Önce depoda (landing'de veya önceki ziyarette) saklı geçerli atıf varsa kullan.
    const existing = getRefAttribution(lst.id);
    if (existing) setAttributedPartnershipId(existing.partnershipId);
    if (!refParam) return;
    const captureKey = `${lst.id}::${refParam}`;
    if (refCapturedFor.current === captureKey) return; // bu ref bu ilan için işlendi
    // 1) Yerel eşleşme (önizleme/demo veya bellekteki aktif ortaklık).
    const local = partnerships.find((p) => p.refCode === refParam && p.listingId === lst.id && p.status === "active");
    if (local) {
      refCapturedFor.current = captureKey;
      saveRefAttribution(lst.id, local.id, refParam);
      setAttributedPartnershipId(local.id);
      void logReferralClick(lst.id, local.id, refParam);
      return;
    }
    // 2) Canlı: referral_public_links üzerinden çöz (yalnız aktif ortaklıklar görünür).
    if (isSupabaseConfigured && lst.slug) {
      refCapturedFor.current = captureKey; // tekrar çözmeyi engelle
      void resolveReferralLink(lst.slug, refParam).then((res) => {
        if (!res?.partnershipId) return; // geçersiz/expired → sessizce yok say
        saveRefAttribution(res.listingId || lst.id, res.partnershipId, refParam);
        setAttributedPartnershipId(res.partnershipId);
        void logReferralClick(res.listingId || lst.id, res.partnershipId, refParam);
      });
    }
  }, [storeListing, remote?.listing?.id, refParam, partnerships]);

  if (!listing) {
    if (fetching) {
      return (
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 16 }}>
          <View style={{ alignSelf: "center", gap: 14, maxWidth: 1000, width: "100%" }}>
            <Skeleton style={{ borderRadius: 16, height: 300, width: "100%" }} />
            <Skeleton style={{ height: 14, width: "35%" }} />
            <Skeleton style={{ height: 26, width: "80%" }} />
            <Skeleton style={{ height: 30, width: "40%" }} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Skeleton style={{ borderRadius: 12, flex: 1, height: 70 }} />
              <Skeleton style={{ borderRadius: 12, flex: 1, height: 70 }} />
            </View>
            <Skeleton style={{ borderRadius: 12, height: 48, width: "100%" }} />
            <Skeleton style={{ height: 14, width: "90%" }} />
            <Skeleton style={{ height: 14, width: "75%" }} />
          </View>
        </ScrollView>
      );
    }
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ alignItems: "center", flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <EmptyState title="İlan bulunamadı" body="Bu ilan kaldırılmış, satılmış ya da bağlantı artık geçerli değil." />
      </ScrollView>
    );
  }

  const currentListing = listing;
  const gallery = [currentListing.image, ...(currentListing.adAssets ?? [])].filter(Boolean);
  const galleryIdx = Math.min(activeImage, Math.max(0, gallery.length - 1));
  const owner = findUser(currentListing.ownerId) ?? remote?.owner;
  const ownerTrust = owner ? calculateUserTrustScores({ leads, listings, partnerships, reports, reviews, sales, user: owner }).seller : undefined;
  const partnership = findPartnership(currentListing.id);
  const activeShareUrl = partnership?.status === "active" ? shareUrl(currentListing, partnership.refCode) : undefined;
  const isOwner = currentListing.ownerId === currentUser.id;
  const isDemo = Boolean(currentListing.demo);
  function demoBlocked() {
    Alert.alert("Örnek ilan", "Bu bir örnek (vitrin) ilandır; yalnızca platformun nasıl göründüğünü göstermek içindir. Mesajlaşma, iletişim ve ortaklık bu ilanda kapalıdır.");
  }
  const listingReviews = reviews.filter((item) => item.listingId === currentListing.id);
  const favorited = isFavorite(currentListing.id);
  const inCompare = hasInCompare(currentListing.id);
  const commission = commissionAmount(currentListing);
  const reviewableSale = sales.find((sale) => sale.listingId === currentListing.id && canReviewSale(sale.id));
  const activeTemplates = listingShareTemplates(currentListing, activeShareUrl);
  const relatedCardWidth = Math.max(148, Math.min(176, Math.floor((width - 34) / 2)));
  const sellerOtherListings = listings
    .filter((item) => item.ownerId === currentListing.ownerId && item.id !== currentListing.id && item.status === "active")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  // Benzerlik: aynı kategori (güçlü sinyal) + başlık/etiket terim örtüşmesi + popülerlik.
  const meTerms = new Set(tokenize(`${currentListing.title} ${currentListing.tags.join(" ")}`));
  const similarListings = listings
    .filter((item) => item.ownerId !== currentListing.ownerId && item.status === "active" && item.id !== currentListing.id)
    .map((item) => {
      const terms = tokenize(`${item.title} ${item.tags.join(" ")}`);
      let overlap = 0;
      for (const term of terms) if (meTerms.has(term)) overlap += 1;
      const sameCat = item.category === currentListing.category ? 2.5 : 0;
      const pop = (item.leadCount + item.partnerCount) * 0.002;
      return { item, s: overlap * 1.5 + sameCat + pop };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map((x) => x.item);

  function handleJoin() {
    if (isDemo) return demoBlocked();
    // Onaylı ilanlarda başvuru notu zorunlu — satıcı gerçek gerekçeyi görsün.
    if (currentListing.partnershipMode !== "open" && !applicationNote.trim()) {
      Alert.alert(translateCopy("Eksik başvuru", language), translateCopy("Lütfen neden bu ürünü satmak istediğini kısaca yaz.", language));
      return;
    }
    const result = joinListing(currentListing.id, {
      note: applicationNote.trim(),
      shareChannel: applicationChannel.trim(),
      audience: applicationAudience.trim(),
      platformHandle: applicationHandle.trim(),
      reachEstimate: Number((applicationReach || "").replace(/[^0-9]/g, "")) || 0
    });
    if (!result) {
      Alert.alert(translateCopy("İşlem yapılamadı", language), translateCopy(authError ?? "Kendi ilanına ortak olamazsın veya ilan aktif olmayabilir.", language));
      return;
    }
    Alert.alert(translateCopy(result.status === "active" ? "Ortaklık aktif" : "Başvuru gönderildi", language), translateCopy(result.status === "active" ? "Paylaşım bağlantın hazır." : "Satıcı kabul edince bağlantın aktif olacak.", language));
  }

  async function handleShare() {
    // Ortak aktif paylaşımıysa referans linki (komisyon takibi), değilse düz ürün linki.
    const url = activeShareUrl ?? productUrl(currentListing);
    await Share.share({ title: currentListing.title, message: `${currentListing.title}\n${moneyIn(currentListing.price, currentListing.currency)}\n${url}`, url });
  }

  async function copyText(label: string, text: string) {
    await Clipboard.setStringAsync(text);
    Alert.alert(translateCopy("Kopyalandı", language), translateCopy(`${label} panoya kopyalandı.`, language));
  }

  async function openShareTarget(target: "whatsapp" | "telegram") {
    if (!activeShareUrl) return;
    const text = encodeURIComponent(`${activeTemplates.whatsapp}\n${activeShareUrl}`);
    const url = target === "whatsapp" ? `https://wa.me/?text=${text}` : `https://t.me/share/url?url=${encodeURIComponent(activeShareUrl)}&text=${text}`;
    await Linking.openURL(url);
  }

  // Ortak bağlantısıyla gelen ziyaretçi satıcıyla iletişime geçince, lead'i o ortağa
  // bağla. Canlıda buyer'ın store'unda ortaklık bulunmaz → landing'deki gibi
  // insertReferralLead (doğrudan Supabase). Önizlemede bellekteki ortaklıkla createLead.
  function attributeReferralLead(sourceForLead: LeadSource) {
    if (contactLeadDone.current || isOwner) return;
    const pid = attributedPartnershipId ?? getRefAttribution(currentListing.id)?.partnershipId ?? null;
    if (!pid) return;
    const buyerName = currentUser.name || "İlan ziyaretçisi";
    const buyerPhone = currentUser.phone || "";
    const note = "Ortak bağlantısıyla gelen ziyaretçi satıcıyla iletişime geçti.";
    const local = partnerships.find((p) => p.id === pid && p.listingId === currentListing.id && p.status === "active");
    if (local) {
      if (local.partnerId === currentUser.id) return; // ortak kendi linkinden lead üretmesin
      const created = createLead({ listingId: currentListing.id, partnershipId: pid, buyerName, buyerPhone, source: sourceForLead, intent: "warm", note });
      if (created) contactLeadDone.current = true;
    } else if (isSupabaseConfigured) {
      contactLeadDone.current = true;
      void insertReferralLead({ listingId: currentListing.id, partnershipId: pid, buyerName, buyerPhone: buyerPhone || "-", note });
    }
  }

  async function handleContact() {
    if (isDemo) return demoBlocked();
    if (!owner) return;
    // İletişimden önce (varsa) ortağa atıf-lead'i düş — kanal kaynağı iletişim yöntemine göre.
    attributeReferralLead(currentListing.contactMethod === "whatsapp" ? "whatsapp" : currentListing.contactMethod === "phone" ? "phone" : "web");
    // Satıcı telefonu feed/detay yanıtında taşınmaz; iletişim anında (girişli
    // kullanıcı) ayrı çekilir. Anon ziyaretçi boş alır → uygulama-içi mesaja düşer.
    const sellerPhone = owner.phone || (await fetchSellerPhone(owner.id));
    const waPhone = trPhoneIntl(sellerPhone);
    if (currentListing.contactMethod === "whatsapp") {
      // Numara uluslararası formata çevrilebiliyorsa WhatsApp'a git; değilse mesaja düş.
      if (waPhone) { await Linking.openURL(`https://wa.me/${waPhone}?text=${encodeURIComponent(`${currentListing.title} ilanı hakkında bilgi almak istiyorum.`)}`); return; }
    } else if (currentListing.contactMethod === "phone") {
      const tel = sellerPhone.replace(/[^0-9+]/g, "");
      if (tel) { await Linking.openURL(`tel:${tel}`); return; }
    }
    const fallbackMessage = `${currentListing.title} ilanı için bilgi almak istiyorum. Fiyat, stok ve teslimat detayları güncel mi?`;
    const conversation = startConversation(currentListing.id, owner.id, message.trim() || fallbackMessage);
    setMessage("");
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
  }

  function handleCreateLead() {
    if (!partnership || partnership.status !== "active") return;
    if (!buyerName.trim() || !buyerPhone.trim()) {
      Alert.alert(translateCopy("Eksik bilgi", language), translateCopy("Alıcı adı ve telefonu gerekli.", language));
      return;
    }
    const created = createLead({
      listingId: currentListing.id,
      partnershipId: partnership.id,
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
      source: leadSource,
      intent: purchaseIntent,
      note: leadNote.trim() || "Ortak paylaşımından gelen talep."
    });
    if (!created) {
      Alert.alert(translateCopy("Talep açılamadı", language), translateCopy(authError ?? "İlan pasif olabilir veya ortaklık bağlantısı aktif değildir.", language));
      return;
    }
    setBuyerName("");
    setBuyerPhone("");
    setLeadNote("");
    Alert.alert(translateCopy("Talep kaydedildi", language), translateCopy("Satıcı paneline ve ortak paneline işlendi.", language));
  }

  function handleSaleReview() {
    if (!reviewableSale) return;
    const created = createSaleReview(reviewableSale.id, reviewRating, reviewComment);
    if (!created) {
      Alert.alert(translateCopy("Yorum eklenemedi", language), translateCopy("Yorum için tamamlanmış satış ve tekil yorum hakkı gerekli.", language));
      return;
    }
    setReviewComment("");
    Alert.alert(translateCopy("Yorum eklendi", language), translateCopy("Puan ve yorum güven alanında görünecek.", language));
  }

  async function handleReport() {
    const ok = await reportListing(currentListing.id, "İlan güvenliği", `${currentListing.title} ilanı kullanıcı tarafından incelemeye gönderildi.`);
    Alert.alert(translateCopy(ok ? "Bildirim alındı" : "Giriş gerekli", language), translateCopy(ok ? "Moderasyon ekibi bu ilanı inceleyecek." : "İlan bildirmek için e-posta ile giriş yapmalısın.", language));
  }

  const metaDesc = `${currentListing.title} — ${moneyIn(currentListing.price, currentListing.currency)}. ${currentListing.description}`.replace(/\s+/g, " ").slice(0, 160);
  const metaUrl = `https://ortaksat.com/listing/${currentListing.id}`;
  // Sosyal paylaşımda kazanç kancası — ortak linki paylaşınca önizlemede görünür.
  const ogTitle = `${currentListing.title} — ${moneyIn(currentListing.price, currentListing.currency)} · Ortak ol, ${commissionText(currentListing)} kazan | OrtakSat`;
  const ogDesc = `${moneyIn(currentListing.price, currentListing.currency)} · ${commissionText(currentListing)}. Bu ürünü paylaş, satışta komisyon kazan. OrtakSat aracıdır; ödeme ve teslimat taraflar arasındadır.`;
  // JSON-LD Product şeması — Google zengin sonuç (fiyat, stok, kategori) için.
  const productLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: currentListing.title,
    image: [currentListing.image, ...(currentListing.adAssets ?? [])].filter(Boolean).slice(0, 5),
    description: metaDesc,
    category: currentListing.category,
    offers: {
      "@type": "Offer",
      price: currentListing.price,
      priceCurrency: currentListing.currency ?? "TRY",
      availability: currentListing.stockCount > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: metaUrl
    }
  });

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, paddingBottom: 96 }}>
      <Head>
        <title>{`${currentListing.title} — OrtakSat`}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={metaUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:site_name" content="OrtakSat" />
        <meta property="og:locale" content="tr_TR" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:image" content={currentListing.image} />
        <meta property="og:image:alt" content={currentListing.imageAlt || currentListing.title} />
        <meta property="og:url" content={metaUrl} />
        <meta property="product:price:amount" content={String(currentListing.price)} />
        <meta property="product:price:currency" content={currentListing.currency ?? "TRY"} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image" content={currentListing.image} />
        <meta name="twitter:image:alt" content={currentListing.imageAlt || currentListing.title} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productLd }} />
      </Head>
      <WebContainer max={1200} padding={0} style={{ gap: 16 }}>
      {/* Breadcrumb: Ana Sayfa › Kategori › Ürün */}
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4, marginHorizontal: isWideWeb ? 0 : 12 }}>
        <Link href="/" asChild><Pressable accessibilityRole="link" accessibilityLabel="Ana sayfa"><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>Ana Sayfa</Text></Pressable></Link>
        <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
        {(() => {
          const catSlug = findCategorySlug(currentListing.category);
          const href = catSlug ? ({ pathname: "/kategori/[slug]", params: { slug: catSlug } } as unknown as Href) : ("/kategoriler" as Href);
          return (
            <Link href={href} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel={`${currentListing.category} kategorisi`}><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{currentListing.category}</Text></Pressable>
            </Link>
          );
        })()}
        <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
        <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800", minWidth: 0 }}>{currentListing.title}</Text>
      </View>
      {isDemo ? (
        <View style={{ alignItems: "center", backgroundColor: "#FEF7DC", borderColor: "#F5C518", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, marginHorizontal: isWideWeb ? 0 : 12, padding: 13 }}>
          <View style={{ alignItems: "center", backgroundColor: "#F5C518", borderRadius: 999, height: 34, justifyContent: "center", width: 34 }}>
            <MaterialCommunityIcons name="eye-outline" size={19} color="#1A1A00" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>Örnek (vitrin) ilan</Text>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>Bu ilan yalnızca platformun nasıl göründüğünü göstermek içindir. Mesajlaşma, iletişim ve ortaklık kapalıdır.</Text>
          </View>
        </View>
      ) : null}
      <View style={isWideWeb ? { flexDirection: "row", gap: 20, alignItems: "flex-start" } : { gap: 12 }}>
      <View style={isWideWeb ? { flex: 1.12, minWidth: 0 } : undefined}>
      {(() => {
        const mainImg = gallery[galleryIdx] ?? currentListing.image;
        return (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: isWideWeb ? 18 : 0, borderWidth: isWideWeb ? 1 : 0, marginTop: isWideWeb ? 16 : 0, overflow: "hidden" }}>
            <Pressable accessibilityRole="imagebutton" accessibilityLabel="Görseli büyüt" onPress={() => setLightbox(true)} style={{ position: "relative" }}>
              <SafeRemoteImage uri={mainImg} style={{ backgroundColor: colors.line, height: isWideWeb ? 520 : 330, width: "100%" }} contentFit="cover" />
              <View style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, bottom: 12, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 6, position: "absolute", right: 12 }}>
                <MaterialCommunityIcons name="magnify-plus-outline" size={14} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 11.5, fontWeight: "800" }}>Büyüt{gallery.length > 1 ? ` · ${galleryIdx + 1}/${gallery.length}` : ""}</Text>
              </View>
            </Pressable>
            {gallery.length > 1 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, paddingTop: 12 }}>
                {gallery.map((img, i) => (
                  <Pressable key={img + i} onPress={() => setActiveImage(i)} style={{ borderColor: i === galleryIdx ? colors.primary : colors.line, borderRadius: 10, borderWidth: i === galleryIdx ? 2 : 1, height: 64, overflow: "hidden", width: 64 }}>
                    <SafeRemoteImage uri={img} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, padding: 12 }}>
              <IconButton active={favorited} icon={favorited ? "heart" : "heart-outline"} label="Beğen" onPress={() => toggleFavorite(currentListing.id)} />
              {!isDemo ? <IconButton active={inCompare} icon={inCompare ? "compare-remove" : "compare-horizontal"} label="Karşılaştır" onPress={() => toggleCompare(currentListing.id)} /> : null}
              <IconButton icon="share-variant-outline" label="Paylaş" onPress={() => void handleShare()} />
              {!isOwner ? <IconButton icon="flag-outline" label="Bildir" onPress={() => void handleReport()} /> : null}
            </View>
          </View>
        );
      })()}
      </View>

      <View style={isWideWeb ? { flex: 1, gap: 12, minWidth: 0, marginTop: 16 } : { gap: 12, paddingHorizontal: 12 }}>
        {/* Satın alma / ortak kutusu — e-ticaret tarzı tek, net karar alanı */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label={currentListing.category} />
            <StatusPill label={currentListing.partnershipMode === "open" ? "Anında ortaklık" : "Satıcı onaylı"} tone={currentListing.partnershipMode === "open" ? "success" : "warning"} />
          </View>

          <Text selectable style={{ color: colors.ink, fontSize: 23, fontWeight: "900", lineHeight: 29 }}>{currentListing.title}</Text>

          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {owner?.rating ? (
              <>
                <MaterialCommunityIcons name="star" size={15} color={colors.gold} />
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{owner.rating.toFixed(1)}</Text>
              </>
            ) : (
              <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>Yeni satıcı</Text>
              </View>
            )}
            {owner?.verifiedPhone || owner?.verifiedIdentity ? (
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 3, paddingHorizontal: 8, paddingVertical: 2 }}>
                <MaterialCommunityIcons name="check-decagram" size={12} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "900" }}>Doğrulanmış</Text>
              </View>
            ) : null}
            <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{owner?.successfulSales ? ` · ${owner.successfulSales} satış` : ""} · {currentListing.location}</Text>
          </View>

          <Text selectable style={{ color: colors.ink, fontSize: 28, fontWeight: "900" }}>{moneyIn(currentListing.price, currentListing.currency)}</Text>

          {/* Ortak kazancı vurgusu — modelimizin çekirdeği */}
          <View style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 14, borderWidth: 1, gap: 4, padding: 13 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
              <MaterialCommunityIcons name="cash-multiple" size={17} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 12, fontWeight: "900", letterSpacing: 0.3 }}>ORTAK KAZANCI</Text>
              <Text style={{ color: colors.primaryDark, fontSize: 20, fontWeight: "900" }}>{moneyIn(commission, currentListing.currency)}</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>{commissionText(currentListing)} · Bu ürünü sat ya da alıcı getir; her satışta kazan. Komisyonu satıcı öder.</Text>
          </View>

          {/* Anahtar bilgiler */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Metric label="Stok" value={`${currentListing.stockCount} adet`} />
            <Metric label="Ortaklık" value={currentListing.partnershipMode === "open" ? "Anında" : "Onaylı"} />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Metric label="İade" value={`${currentListing.returnWindowDays} gün`} />
            <Metric label="Komisyon vadesi" value={`${currentListing.commissionDueDays} gün`} />
          </View>

          {/* Durum-duyarlı ana aksiyon */}
          {isOwner ? (
            <View style={{ gap: 8 }}>
              <PrimaryButton href={{ pathname: "/listing-edit/[id]", params: { id: currentListing.id } }} icon="pencil-outline">İlanı Düzenle</PrimaryButton>
              <PrimaryButton href="/(tabs)/seller" tone="secondary" icon="storefront-outline">Satıcı panelinde yönet</PrimaryButton>
            </View>
          ) : isDemo ? (
            <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 11, flexDirection: "row", gap: 8, padding: 12 }}>
              <MaterialCommunityIcons name="lock-outline" size={16} color={colors.muted} />
              <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "700" }}>Örnek ilan — ortaklık ve iletişim kapalıdır.</Text>
            </View>
          ) : partnership?.status === "active" ? (
            <View style={{ backgroundColor: colors.primarySoft, borderRadius: 12, gap: 9, padding: 12 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                <MaterialCommunityIcons name="check-decagram" size={17} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 13, fontWeight: "900" }}>Ortaksın · paylaşım bağlantın hazır</Text>
              </View>
              {activeShareUrl ? <ShareRow url={activeShareUrl} text={`${currentListing.title} — ${moneyIn(currentListing.price, currentListing.currency)}`} /> : null}
            </View>
          ) : partnership?.status === "pending" ? (
            <View style={{ alignItems: "center", backgroundColor: colors.warningSoft, borderRadius: 11, flexDirection: "row", gap: 8, padding: 12 }}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={colors.warning} />
              <Text style={{ color: colors.warning, flex: 1, fontSize: 12.5, fontWeight: "800" }}>Başvurun satıcı onayında.</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {/* Onaylı ilanlarda küçük başvuru formu (açık modda gösterilmez). */}
              {currentListing.partnershipMode !== "open" ? (
                <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 11, padding: 12 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                    <MaterialCommunityIcons name="account-edit-outline" size={16} color={colors.primaryDark} />
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900" }}>Başvuru bilgilerin</Text>
                    <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "800" }}>Satıcı görecek</Text>
                  </View>
                  {/* Neden satmak istiyor (zorunlu) */}
                  <View style={{ gap: 5 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Neden bu ürünü satmak istiyorsun? *</Text>
                    <TextInput
                      value={applicationNote}
                      onChangeText={setApplicationNote}
                      placeholder="Kısaca anlat: kime, nerede ve nasıl ulaştıracaksın?"
                      placeholderTextColor={colors.subtle}
                      multiline
                      style={{ backgroundColor: colors.surface, borderColor: applicationNote.trim() ? colors.line : colors.warning, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 64, padding: 10, textAlignVertical: "top" }}
                    />
                  </View>
                  {/* Kanal seçimi */}
                  <View style={{ gap: 5 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Hangi kanalda paylaşacaksın?</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {["WhatsApp", "Instagram", "TikTok", "Diğer"].map((ch) => {
                        const on = applicationChannel === ch;
                        return (
                          <Pressable key={ch} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Kanal: ${ch}`} onPress={() => setApplicationChannel(ch)} style={{ backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7 }}>
                            <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{ch}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  {/* Erişim + kullanıcı adı (yan yana) */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Tahmini erişim (kişi)</Text>
                      <TextInput
                        value={applicationReach}
                        onChangeText={(txt) => setApplicationReach(txt.replace(/[^0-9]/g, ""))}
                        keyboardType="number-pad"
                        placeholder="ör. 500"
                        placeholderTextColor={colors.subtle}
                        style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 42, paddingHorizontal: 10, paddingVertical: 8 }}
                      />
                    </View>
                    <View style={{ flex: 1.35, gap: 5 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Sosyal medya adın (ops.)</Text>
                      <TextInput
                        value={applicationHandle}
                        onChangeText={setApplicationHandle}
                        autoCapitalize="none"
                        placeholder="@kullaniciadi"
                        placeholderTextColor={colors.subtle}
                        style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 42, paddingHorizontal: 10, paddingVertical: 8 }}
                      />
                    </View>
                  </View>
                  {/* Kitle tanımı (opsiyonel) */}
                  <View style={{ gap: 5 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Tahmini kitle (opsiyonel)</Text>
                    <TextInput
                      value={applicationAudience}
                      onChangeText={setApplicationAudience}
                      placeholder="ör. genç anneler, üniversite çevresi…"
                      placeholderTextColor={colors.subtle}
                      style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 42, paddingHorizontal: 10, paddingVertical: 8 }}
                    />
                  </View>
                </View>
              ) : null}
              <PrimaryButton icon="handshake-outline" onPress={handleJoin}>{currentListing.partnershipMode === "open" ? "Hemen Ortak Ol ve Kazan" : "Ortaklık Başvurusu Gönder"}</PrimaryButton>
            </View>
          )}

          {/* İletişim */}
          {!isOwner && !isDemo ? (
            <View style={{ gap: 10 }}>
              <SafetyNote />
              <PrimaryButton tone="secondary" icon={currentListing.contactMethod === "whatsapp" ? "whatsapp" : currentListing.contactMethod === "phone" ? "phone" : "message-text-outline"} onPress={() => void handleContact()}>{contactLabel(currentListing.contactMethod)}</PrimaryButton>
            </View>
          ) : null}

          {/* Satıcı mini kartı */}
          <View style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 10, paddingTop: 12 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 40, justifyContent: "center", width: 40 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{(owner?.name ?? "S").slice(0, 1).toLocaleUpperCase("tr-TR")}</Text>
            </View>
            <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{owner?.name ?? "Satıcı"}</Text>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>%{ownerTrust?.score ?? 0} güven · %{owner?.responseRate ?? 0} yanıt</Text>
            </View>
            <Link href={{ pathname: "/store/[id]", params: { id: currentListing.ownerId } }} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel="Mağazayı aç" style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 8 }}>
                <MaterialCommunityIcons name="store-search-outline" size={14} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>Mağaza</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
      </View>

      <View style={{ gap: 12, paddingHorizontal: isWideWeb ? 0 : 12 }}>
        {/* Etkileşimli kazanç hesaplayıcı */}
        {!isOwner && !isDemo ? <EarningsCalculator listing={currentListing} isDemo={isDemo} onJoin={handleJoin} /> : null}

        {/* Ortak satış nasıl işler? — tek, konsolide süreç bölümü */}
        <Card>
          <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Ortak satış nasıl işler?</Text>
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 10, gap: 8, padding: 12 }}>
            <Bullet icon="handshake-outline" text={partnershipModeDescription(currentListing.partnershipMode)} tone="info" />
            <Bullet icon="link-variant" text="Onay sonrası sana özel paylaşım bağlantısı açılır; alıcı talebi doğru ortağa bağlanır." tone="info" />
            <Bullet icon="cash-check" text="Satıcı satışı onaylar, iade penceresi biter, komisyon uygulama dışında ödenir; iki taraf da takip eder." tone="info" />
          </View>
          {currentListing.partnerRules.slice(0, 4).map((rule) => <Bullet key={rule} icon="shield-check-outline" text={rule} tone="success" />)}
          <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
            Min. ortak puanı {currentListing.minPartnerRating}+ · Komisyon vadesi {currentListing.commissionDueDays} gün · İade {currentListing.returnWindowDays} gün
          </Text>
        </Card>

        <PartnerSaleTimeline listing={currentListing} partnershipStatus={partnership?.status} />

        <AgreementCard listing={currentListing} partnership={partnership} />

        {partnership?.status === "active" ? (
          <Card>
            <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Alıcı talebi", language)}</Text>
            <Field label="Alıcı adı" value={buyerName} onChangeText={setBuyerName} />
            <Field label="Telefon" value={buyerPhone} onChangeText={setBuyerPhone} />
            <ChoiceRow<LeadSource> value={leadSource} setValue={setLeadSource} options={["whatsapp", "instagram", "web", "phone"]} labels={sourceLabels} />
            <ChoiceRow<PurchaseIntent> value={purchaseIntent} setValue={setPurchaseIntent} options={["hot", "warm", "cold"]} labels={intentLabels} />
            <Field label="Not" value={leadNote} onChangeText={setLeadNote} multiline />
            <PrimaryButton icon="account-plus-outline" onPress={handleCreateLead}>Talebi kaydet</PrimaryButton>
          </Card>
        ) : null}

        <View style={{ gap: 10 }}>
          <Accordion title="Ürün açıklaması" icon="text-box-outline" defaultOpen>
            <Text selectable style={{ color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>{currentListing.description}</Text>
            {currentListing.salesPitch.slice(0, 4).map((line) => (
              <Bullet key={line} icon="check-circle-outline" text={line} tone="info" />
            ))}
          </Accordion>
          <Accordion title="Ürün özellikleri" icon="format-list-bulleted">
            <SpecRow label="Kategori" value={currentListing.category} />
            <SpecRow label="Konum" value={currentListing.location} />
            <SpecRow label="Stok" value={`${currentListing.stockCount} adet`} />
            <SpecRow label="Komisyon" value={currentListing.commissionType === "rate" ? `%${currentListing.commissionValue}` : moneyIn(commission, currentListing.currency)} />
            <SpecRow label="Ortaklık" value={currentListing.partnershipMode === "open" ? "Anında ortaklık" : "Satıcı onaylı"} />
            <SpecRow label="İletişim" value={contactLabel(currentListing.contactMethod)} />
          </Accordion>
          <Accordion title="Teslimat ve iade" icon="truck-outline">
            <Text selectable style={{ color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>
              Teslimat ve ödeme, satıcı ile alıcı arasında {contactLabel(currentListing.contactMethod).toLocaleLowerCase("tr-TR")} üzerinden kararlaştırılır. İade ve değişim koşullarını satışı kapatmadan önce satıcıyla netleştir.
            </Text>
            <LegalNote style={{ marginTop: 8 }} />
          </Accordion>
          <Accordion title="Sıkça sorulan sorular" icon="comment-question-outline">
            <SpecRow label="Komisyonu kim öder?" value="İlan sahibi, satış gerçekleştiğinde ortağa öder." />
            <SpecRow label="Ortak olmak ücretli mi?" value="Hayır, ortaklık ücretsizdir." />
            <SpecRow label="Süreç güvenli mi?" value="Komisyon şartı ve talepler sistemde kayıt altındadır." />
          </Accordion>
        </View>

        <ListingQA listingId={currentListing.id} isOwner={isOwner} isDemo={isDemo} />

        <RelatedListingsSection
          cardWidth={relatedCardWidth}
          listings={sellerOtherListings}
          ownersById={(ownerId) => findUser(ownerId)}
          title={translateCopy("Satıcının diğer ürünleri", language)}
          actionLabel={translateCopy("Mağazayı aç", language)}
          actionHref={{ pathname: "/store/[id]", params: { id: currentListing.ownerId } }}
          emptyText={translateCopy("Bu satıcının başka aktif ürünü yok.", language)}
        />

        <RelatedListingsSection
          cardWidth={relatedCardWidth}
          listings={similarListings}
          ownersById={(ownerId) => findUser(ownerId)}
          title={translateCopy("Benzer ürünler", language)}
          emptyText={translateCopy("Bu kategoride başka aktif ürün yok.", language)}
        />

        <Card>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900" }}>{translateCopy("Yorumlar", language)}</Text>
            <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "900" }}>{listingReviews.length}</Text>
          </View>
          {reviewableSale ? (
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, gap: 10, padding: 10 }}>
              <Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{translateCopy("Satış sonrası yorum hakkın var", language)}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>{[5, 4, 3].map((rating) => (<Pressable key={rating} onPress={() => setReviewRating(rating)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: reviewRating === rating ? colors.primarySoft : colors.surface, borderColor: reviewRating === rating ? colors.primary : colors.line, borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 38, justifyContent: "center", opacity: pressed ? 0.74 : 1 })}><Text selectable style={{ color: reviewRating === rating ? colors.primaryDark : colors.ink, fontSize: 12, fontWeight: "900" }}>{rating} {translateCopy("yıldız", language)}</Text></Pressable>))}</View>
              <Field label="Yorum" value={reviewComment} onChangeText={setReviewComment} multiline />
              <PrimaryButton tone="secondary" icon="star-outline" onPress={handleSaleReview}>Yorumu kaydet</PrimaryButton>
            </View>
          ) : null}
          {listingReviews.length === 0 ? (
            <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
              {translateCopy("Bu ürün için henüz yorum yok.", language)}
            </Text>
          ) : null}
          {listingReviews.map((item) => {
            const reviewer = findUser(item.reviewerId);
            return (
              <View key={item.id} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, gap: 5, padding: 10 }}>
                <Text selectable style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{reviewer?.name ?? "Kullanıcı"} · {item.rating}/5</Text>
                <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{item.comment}</Text>
              </View>
            );
          })}
        </Card>
      </View>
      </WebContainer>

      {/* Tam ekran görsel (lightbox) */}
      <Modal visible={lightbox} transparent animationType="fade" onRequestClose={() => { setLightbox(false); setZoomed(false); }}>
        <View style={{ backgroundColor: "rgba(0,0,0,0.92)", flex: 1, justifyContent: "center" }}>
          <Pressable accessibilityLabel="Kapat" onPress={() => { setLightbox(false); setZoomed(false); }} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, height: 42, justifyContent: "center", position: "absolute", right: 18, top: 18, width: 42, zIndex: 5 }}>
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => setZoomed((z) => !z)}
            accessibilityRole="imagebutton"
            accessibilityLabel={zoomed ? "Uzaklaştır" : "Yakınlaştır"}
            onTouchStart={(e) => { swipeStartX.current = e.nativeEvent.pageX; }}
            onTouchEnd={(e) => {
              const dx = e.nativeEvent.pageX - swipeStartX.current;
              if (!zoomed && Math.abs(dx) > 50 && gallery.length > 1) {
                setActiveImage((dx < 0 ? galleryIdx + 1 : galleryIdx - 1 + gallery.length) % gallery.length);
              }
            }}
            style={{ alignItems: "center", height: "78%", justifyContent: "center", overflow: "hidden", width: "100%" }}
          >
            <SafeRemoteImage
              uri={gallery[galleryIdx] ?? currentListing.image}
              style={{ height: "100%", transform: [{ scale: zoomed ? 2.2 : 1 }], width: "100%" }}
              contentFit="contain"
            />
          </Pressable>
          <View style={{ alignItems: "center", bottom: 74, left: 0, position: "absolute", right: 0 }}>
            <View style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700" }}>{zoomed ? "Uzaklaştırmak için dokun" : "Yakınlaştırmak için dokun · kaydırarak gez"}</Text>
            </View>
          </View>
          {gallery.length > 1 ? (
            <>
              <Pressable accessibilityLabel="Önceki görsel" onPress={() => { setActiveImage((galleryIdx - 1 + gallery.length) % gallery.length); setZoomed(false); }} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, height: 48, justifyContent: "center", left: 14, position: "absolute", top: "46%", width: 48 }}>
                <MaterialCommunityIcons name="chevron-left" size={30} color="#FFFFFF" />
              </Pressable>
              <Pressable accessibilityLabel="Sonraki görsel" onPress={() => { setActiveImage((galleryIdx + 1) % gallery.length); setZoomed(false); }} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, height: 48, justifyContent: "center", position: "absolute", right: 14, top: "46%", width: 48 }}>
                <MaterialCommunityIcons name="chevron-right" size={30} color="#FFFFFF" />
              </Pressable>
              <View style={{ alignItems: "center", bottom: 26, flexDirection: "row", gap: 8, justifyContent: "center", left: 0, position: "absolute", right: 0 }}>
                {gallery.map((_, i) => (
                  <Pressable key={i} onPress={() => setActiveImage(i)} style={{ backgroundColor: i === galleryIdx ? "#FFFFFF" : "rgba(255,255,255,0.4)", borderRadius: 999, height: 8, width: i === galleryIdx ? 22 : 8 }} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

function contactLabel(method: "whatsapp" | "phone" | "message") {
  if (method === "whatsapp") return "WhatsApp ile iletişim";
  if (method === "phone") return "Satıcıyı ara";
  return "Mesaj gönder";
}

function partnershipModeDescription(mode: Listing["partnershipMode"]) {
  if (mode === "open") return "Bu ürün anında ortaklığa açık; başvurunca bağlantın hemen hazır olur.";
  if (mode === "approval") return "Bu üründe satıcı onayı gerekir; satıcı başvurunu görür, uygun bulursa ortaklık açılır.";
  return "Bu ürün davetli ortaklığa açık; satıcı sadece seçtiği ortaklarla çalışır.";
}

function PartnerSaleTimeline({ listing, partnershipStatus }: { listing: Listing; partnershipStatus?: PartnershipStatus }) {
  const { language } = useLanguage();
  const steps = [
    {
      active: true,
      icon: "store-plus-outline" as const,
      title: "İlan yayında",
      body: `${listing.stockCount} ${translateCopy("stok", language)} · ${commissionText(listing)}`
    },
    {
      active: partnershipStatus === "pending" || partnershipStatus === "active",
      icon: "account-check-outline" as const,
      title: partnershipStatus === "active" ? "Ortaklık onaylandı" : partnershipStatus === "pending" ? "Onay bekliyor" : "Ortaklık başvurusu",
      body: listing.partnershipMode === "open" ? "Anında bağlantı açılır." : "Satıcı uygun ortağı onaylar."
    },
    {
      active: partnershipStatus === "active",
      icon: "share-variant-outline" as const,
      title: "Paylaşım ve talep",
      body: "Alıcı linkten gelirse talep doğru ortağa bağlanır."
    },
    {
      active: false,
      icon: "cash-check" as const,
      title: "Komisyon kapanışı",
      body: `${listing.returnWindowDays} gün iade · ${listing.commissionDueDays} gün ödeme vadesi`
    }
  ];

  return (
    <Card>
      <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Ortak satış akışı", language)}</Text>
      <View style={{ gap: 8 }}>
        {steps.map((step, index) => (
          <View key={step.title} style={{ alignItems: "flex-start", flexDirection: "row", gap: 9 }}>
            <View style={{ alignItems: "center", gap: 4 }}>
              <View style={{ alignItems: "center", backgroundColor: step.active ? colors.primary : colors.surfaceAlt, borderColor: step.active ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, height: 30, justifyContent: "center", width: 30 }}>
                <MaterialCommunityIcons name={step.icon} size={16} color={step.active ? "#FFFFFF" : colors.muted} />
              </View>
              {index < steps.length - 1 ? <View style={{ backgroundColor: colors.line, height: 20, width: 2 }} /> : null}
            </View>
            <View style={{ flex: 1, gap: 2, paddingTop: 3 }}>
              <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy(step.title, language)}</Text>
              <Text selectable numberOfLines={2} style={{ color: colors.muted, fontSize: 12, fontWeight: "800", lineHeight: 17 }}>{translateCopy(step.body, language)}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function RelatedListingsSection({
  actionHref,
  actionLabel,
  cardWidth,
  emptyText,
  listings,
  ownersById,
  title
}: {
  actionHref?: Href;
  actionLabel?: string;
  cardWidth: number;
  emptyText: string;
  listings: Listing[];
  ownersById: (ownerId: string) => User | undefined;
  title: string;
}) {
  const { language } = useLanguage();

  return (
    <Card>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text selectable numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900" }}>{translateCopy(title, language)}</Text>
        {actionHref && actionLabel ? <PrimaryButton href={actionHref} tone="secondary" icon="store-search-outline">{actionLabel}</PrimaryButton> : null}
      </View>
      {listings.length === 0 ? (
        <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "800", lineHeight: 18 }}>{translateCopy(emptyText, language)}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
          {listings.map((item) => (
            <ListingCard key={item.id} listing={item} owner={ownersById(item.ownerId)} width={cardWidth} />
          ))}
        </ScrollView>
      )}
    </Card>
  );
}


function IconButton({ active, icon, label, onPress }: { active?: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  const { language } = useLanguage();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ alignItems: "center", backgroundColor: active ? colors.primarySoft : colors.surfaceAlt, borderRadius: 8, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 42, opacity: pressed ? 0.72 : 1 })}>
      <MaterialCommunityIcons name={icon} size={18} color={active ? colors.primaryDark : colors.ink} />
      <Text ellipsizeMode="tail" numberOfLines={1} selectable style={{ color: active ? colors.primaryDark : colors.ink, flexShrink: 1, fontSize: 13, fontWeight: "900" }}>{translateCopy(label, language)}</Text>
    </Pressable>
  );
}

function Bullet({ icon, text, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string; tone: "success" | "info" }) {
  const { language } = useLanguage();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <MaterialCommunityIcons name={icon} size={18} color={tone === "success" ? colors.success : colors.info} />
      <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 14, lineHeight: 20 }}>{translateCopy(text, language)}</Text>
    </View>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12, paddingVertical: 4 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700", width: 130 }}>{translateCopy(label, language)}</Text>
      <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 }}>{translateCopy(value, language)}</Text>
    </View>
  );
}

function ChoiceRow<T extends string>({ labels, options, setValue, value }: { labels: Record<T, string>; options: T[]; setValue: (value: T) => void; value: T }) {
  const { language } = useLanguage();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map((item) => (
        <Pressable key={item} onPress={() => setValue(item)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: item === value ? colors.primarySoft : colors.surfaceAlt, borderColor: item === value ? colors.primary : colors.line, borderRadius: 8, borderWidth: 1, flexGrow: 1, flexBasis: options.length > 3 ? "23%" : "30%", minHeight: 38, justifyContent: "center", opacity: pressed ? 0.74 : 1, paddingHorizontal: 8 })}>
          <Text adjustsFontSizeToFit ellipsizeMode="tail" minimumFontScale={0.82} numberOfLines={1} selectable style={{ color: item === value ? colors.primaryDark : colors.ink, fontSize: 12, fontWeight: "900" }}>{translateCopy(labels[item], language)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Field({ label, value, onChangeText, multiline }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) {
  const { language } = useLanguage();
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy(label, language)}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={{
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.line,
          borderRadius: 8,
          borderWidth: 1,
          color: colors.ink,
          fontSize: 15,
          minHeight: multiline ? 82 : 46,
          padding: 12,
          textAlignVertical: multiline ? "top" : "center"
        }}
      />
    </View>
  );
}
