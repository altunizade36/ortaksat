import { MaterialCommunityIcons } from "@/components/icons";
import { Link, type Href, useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import { Alert } from "@/lib/alert";
import { openUrlSafe } from "@/lib/link";
import { shareOrCopy } from "@/lib/share";
import { parseTrPrice } from "@/lib/validation";

import { describeAttributes, findCategorySlug } from "@/lib/category-tree";
import { useCompare } from "@/lib/compare";
import { Accordion } from "@/components/accordion";
import { AgreementCard } from "@/components/agreement-card";
import { colors } from "@/components/colors";
import { StarRatingInput } from "@/components/star-rating-input";
import { ReviewCard } from "@/components/review-card";
import { JsonLd } from "@/components/json-ld";
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
import { commissionAmount, commissionText, listingInviteCode, moneyIn, partnerInviteUrl, productUrl, shareUrl, trPhoneIntl } from "@/lib/format";
import { categoryConversion } from "@/lib/conversion";
import { VerificationBadges } from "@/components/verification-badges";
import { haptic } from "@/lib/haptics";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { WebContainer } from "@/components/web-container";
import { fetchListingById, fetchSellerPhone } from "@/lib/supabase-data";
import { insertReferralLead, logReferralClick, resolveReferralLink } from "@/lib/live-service";
import { getRefAttribution, saveRefAttribution } from "@/lib/referral";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getRecent, pushRecent, subscribeRecent } from "@/lib/recent";
import { calculateUserTrustScores } from "@/lib/trust-score";
import type { LeadSource, Listing, PurchaseIntent, User } from "@/lib/types";
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
  const params = useLocalSearchParams<{ id: string; ref?: string; p?: string; "ortak-davet"?: string; apply?: string }>();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";
  // Ortak panelinden "başvur" derin-linki (?apply=1): başvuru formunu göze getir/odakla.
  const wantsApply = (Array.isArray(params.apply) ? params.apply[0] : params.apply) === "1";
  const inviteParam = Array.isArray(params["ortak-davet"]) ? params["ortak-davet"][0] : params["ortak-davet"];
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
    isAuthenticated,
    isFavorite,
    joinListing,
    reportListing,
    reviews,
    editReview,
    deleteReview,
    reportReview,
    backendMode,
    sales,
    leads,
    listings,
    partnerships,
    reports,
    startConversation,
    toggleFavorite,
    offers,
    createOffer,
    buyerOfferAction
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
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => { setRecentIds(getRecent()); return subscribeRecent(setRecentIds); }, [id]);
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  const [revealingPhone, setRevealingPhone] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [leadNote, setLeadNote] = useState("");
  const [leadSource, setLeadSource] = useState<LeadSource>("whatsapp");
  const [purchaseIntent, setPurchaseIntent] = useState<PurchaseIntent>("warm");
  const [message, setMessage] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  // TEKLİF: alıcının bu ilandaki AKTİF teklifi (geri çekilmiş/eski olanlar sayılmaz).
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [offerErr, setOfferErr] = useState<string | null>(null);
  const [offerBusy, setOfferBusy] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [zoomed, setZoomed] = useState(false);
  const swipeStartX = useRef(0);
  const inlineSwiped = useRef(false); // inline ana görselde kaydırma olduysa dokunuş "büyüt"ü açmasın
  // Ortak referans atfı: bu ilana hangi ortağın yönlendirdiği (varsa).
  const [attributedPartnershipId, setAttributedPartnershipId] = useState<string | null>(null);
  const refCapturedFor = useRef<string>(""); // aynı ref'i aynı ilan için tekrar çözme/loglama kilidi
  const contactLeadDone = useRef(false); // iletişimde tek bir atıf-lead üret
  // Ortak panelinden "Ortak ol" ile gelince (apply=1): ortaklık aksiyonunu ekrana kaydır.
  const joinAnchorRef = useRef<View>(null);
  const router = useRouter();

  // apply=1 ile gelindiyse ortaklık aksiyonunu göze getir (web'de yumuşak kaydır) — "ortak ol'a
  // bastım ama tuş yok" karışıklığını giderir. NOT: hook, erken-return'lerden ÖNCE olmalı (kural).
  useEffect(() => {
    if (!wantsApply || Platform.OS !== "web") return;
    const t = setTimeout(() => {
      const node = joinAnchorRef.current as unknown as { scrollIntoView?: (o: object) => void } | null;
      node?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 600);
    return () => clearTimeout(t);
  }, [wantsApply]);

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
      // ANLAŞILAN pencere (join'de kilitlenen snapshot) > canlı ilanınki. Satıcı pencereyi
      // sonradan kısaltıp ortağın hak ettiği atıf kredisini silemesin.
      saveRefAttribution(lst.id, local.id, refParam, local.agreedAttributionWindowDays ?? lst.attributionWindowDays);
      // First-touch: saklanan atıf orijinal ortakta kalmış olabilir → lead kredisini ONDAN al.
      setAttributedPartnershipId(getRefAttribution(lst.id)?.partnershipId ?? local.id);
      void logReferralClick(lst.id, local.id, refParam); // tıklama yine kaydedilir (yeni linkin ölçümü)
      return;
    }
    // 2) Canlı: referral_public_links üzerinden çöz (yalnız aktif ortaklıklar görünür).
    if (isSupabaseConfigured && lst.slug) {
      refCapturedFor.current = captureKey; // tekrar çözmeyi engelle
      void resolveReferralLink(lst.slug, refParam).then((res) => {
        if (!res?.partnershipId) return; // geçersiz/expired → sessizce yok say
        // ANLAŞILAN pencere ref-link kaydından gelir; yoksa canlı ilana düş.
        saveRefAttribution(res.listingId || lst.id, res.partnershipId, refParam, res.attributionWindowDays ?? lst.attributionWindowDays);
        setAttributedPartnershipId(getRefAttribution(lst.id)?.partnershipId ?? res.partnershipId);
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
        <EmptyState title={translateCopy("İlan bulunamadı", language)} body={translateCopy("Bu ilan kaldırılmış, satılmış ya da bağlantı artık geçerli değil.", language)} />
      </ScrollView>
    );
  }

  const currentListing = listing;
  // "Sadece davetle" ilan: ortaklık yalnızca satıcının paylaştığı geçerli davet
  // linkiyle açılır. Geçerli kod URL'de varsa ziyaretçi anında (ön-onaylı) katılır.
  const isInviteMode = currentListing.partnershipMode === "invite";
  const validInvite = isInviteMode && !!inviteParam && inviteParam === listingInviteCode(currentListing);
  const gallery = [currentListing.image, ...(currentListing.adAssets ?? [])].filter(Boolean);
  const galleryIdx = Math.min(activeImage, Math.max(0, gallery.length - 1));
  const owner = findUser(currentListing.ownerId) ?? remote?.owner;
  const ownerTrust = owner ? calculateUserTrustScores({ leads, listings, partnerships, reports, reviews, sales, user: owner }).seller : undefined;
  const partnership = findPartnership(currentListing.id);
  const activeShareUrl = partnership?.status === "active" ? shareUrl(currentListing, partnership.refCode) : undefined;
  const isOwner = currentListing.ownerId === currentUser.id;
  const isReviewAuthed = backendMode === "supabase" && !!currentUser?.id && currentUser.id.includes("-");
  const isDemo = Boolean(currentListing.demo);
  // Bu ilandaki KENDİ son teklifim (geri çekilenler hariç → yeniden teklif verebilsin).
  const myOffer = offers
    .filter((o) => o.listingId === currentListing.id && o.buyerId === currentUser.id && o.status !== "withdrawn")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  function demoBlocked() {
    Alert.alert(translateCopy("Örnek ilan", language), translateCopy("Bu bir örnek (vitrin) ilandır; yalnızca platformun nasıl göründüğünü göstermek içindir. Mesajlaşma, iletişim ve ortaklık bu ilanda kapalıdır.", language));
  }
  const listingReviews = reviews.filter((item) => item.listingId === currentListing.id);
  const favorited = isFavorite(currentListing.id);
  const inCompare = hasInCompare(currentListing.id);
  const commission = commissionAmount(currentListing);
  const reviewableSale = sales.find((sale) => sale.listingId === currentListing.id && canReviewSale(sale.id));
  const relatedCardWidth = Math.max(148, Math.min(176, Math.floor((width - 34) / 2)));
  const sellerOtherListings = listings
    .filter((item) => item.ownerId === currentListing.ownerId && item.id !== currentListing.id && item.status === "active")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  // Satıcı güven sinyalleri (Sahibinden tarzı): aktif ilan sayısı + tamamlanan satış.
  const sellerActiveCount = owner ? listings.filter((item) => item.ownerId === owner.id && item.status === "active").length : 0;
  const sellerSales = owner?.successfulSales ?? 0;
  // Benzerlik: aynı kategori + başlık/etiket örtüşmesi + YAPISAL ÖZELLİKLER
  // (fiyat yakınlığı, ilan tipi, oda, m², konum) + popülerlik. Emlakta güçlü eşleşme.
  const meTerms = new Set(tokenize(`${currentListing.title} ${currentListing.tags.join(" ")}`));
  const meAttr = currentListing.attributes ?? {};
  const meM2 = Number(meAttr.grossM2 ?? meAttr.m2 ?? meAttr.netM2 ?? meAttr.totalGrossM2 ?? 0) || 0;
  const similarListings = listings
    .filter((item) => item.ownerId !== currentListing.ownerId && item.status === "active" && item.id !== currentListing.id)
    .map((item) => {
      const terms = tokenize(`${item.title} ${item.tags.join(" ")}`);
      let overlap = 0;
      for (const term of terms) if (meTerms.has(term)) overlap += 1;
      const sameCat = item.category === currentListing.category ? 2.5 : 0;
      const a = item.attributes ?? {};
      let attrScore = 0;
      // Fiyat yakınlığı (±25%): güçlü sinyal.
      if (currentListing.price > 0 && Math.abs(item.price - currentListing.price) / currentListing.price <= 0.25) attrScore += 2;
      if (meAttr.listingType && a.listingType === meAttr.listingType) attrScore += 1.5;
      if (meAttr.rooms && a.rooms === meAttr.rooms) attrScore += 1.5;
      if (currentListing.provinceId && item.provinceId === currentListing.provinceId) attrScore += 1;
      const itemM2 = Number(a.grossM2 ?? a.m2 ?? a.netM2 ?? a.totalGrossM2 ?? 0) || 0;
      if (meM2 > 0 && itemM2 > 0 && Math.abs(itemM2 - meM2) / meM2 <= 0.3) attrScore += 1;
      const pop = (item.leadCount + item.partnerCount) * 0.002;
      return { item, s: overlap * 1.2 + sameCat + attrScore + pop };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map((x) => x.item);
  // Yedek: farklı satıcıda benzer bulunamazsa (ör. tüm ilanlar tek satıcıda),
  // aynı kategorideki diğer aktif ilanları göster (kendisi hariç).
  const similarFinal = similarListings.length
    ? similarListings
    : listings.filter((item) => item.id !== currentListing.id && item.status === "active" && item.category === currentListing.category).slice(0, 8);
  // Son gezdiklerin (bu ilan hariç, aktif) — client-only localStorage.
  const recentViewed = recentIds
    .map((rid) => listings.find((l) => l.id === rid))
    .filter((l): l is Listing => Boolean(l) && l!.status === "active" && l!.id !== currentListing.id)
    .slice(0, 10);

  function handleJoin() {
    if (isDemo) return demoBlocked();
    // Anonim kullanıcı: alert'te tıkanmak yerine girişe yönlendir (dönüşte bu ilana gelir).
    if (!isAuthenticated) { router.push({ pathname: "/auth", params: { redirect: `/listing/${currentListing.id}` } }); return; }
    // Davetli katılım ön-onaylıdır → başvuru notu istenmez. Onaylı (başvuru) ilanlarda
    // not zorunlu — satıcı gerçek gerekçeyi görsün.
    if (currentListing.partnershipMode !== "open" && !validInvite && !applicationNote.trim()) {
      Alert.alert(translateCopy("Eksik başvuru", language), translateCopy("Lütfen neden bu ürünü satmak istediğini kısaca yaz.", language));
      return;
    }
    const result = joinListing(currentListing.id, {
      note: applicationNote.trim(),
      shareChannel: applicationChannel.trim(),
      audience: applicationAudience.trim(),
      platformHandle: applicationHandle.trim(),
      reachEstimate: Number((applicationReach || "").replace(/[^0-9]/g, "")) || 0,
      inviteCode: validInvite ? (inviteParam ?? "") : ""
    });
    if (!result) {
      haptic.warning();
      Alert.alert(translateCopy("İşlem yapılamadı", language), translateCopy(authError ?? "Kendi ilanına ortak olamazsın veya ilan aktif olmayabilir.", language));
      return;
    }
    haptic.success();
    Alert.alert(translateCopy(result.status === "active" ? "Ortaklık aktif" : "Başvuru gönderildi", language), translateCopy(result.status === "active" ? "Paylaşım bağlantın hazır." : "Satıcı kabul edince bağlantın aktif olacak.", language));
  }

  async function handleShare() {
    // Ortak aktif paylaşımıysa referans linki (komisyon takibi), değilse düz ürün linki.
    const url = activeShareUrl ?? productUrl(currentListing);
    const r = await shareOrCopy({ title: currentListing.title, message: `${currentListing.title}\n${moneyIn(currentListing.price, currentListing.currency)}\n${url}`, url });
    if (r === "copied") Alert.alert(translateCopy("Bağlantı kopyalandı", language), translateCopy("Paylaşmak için istediğin yere yapıştırabilirsin.", language));
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
      // Self-purchase guard (canlı): kullanıcı bu atfın ORTAĞIYSA (herhangi statüde) kendi
      // linkinden lead/komisyon üretemesin. `local` yalnız aktif ortaklığı yakalıyordu.
      if (partnerships.some((p) => p.id === pid && p.partnerId === currentUser.id)) return;
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
    // Dış-link (WhatsApp/telefon) açılabilirse oraya git; açılamazsa (masaüstü
    // web'de şema desteklenmez/popup engellenir) uygulama-içi mesaja DÜŞ.
    if (currentListing.contactMethod === "whatsapp") {
      if (waPhone && await openUrlSafe(`https://wa.me/${waPhone}?text=${encodeURIComponent(`${currentListing.title} ilanı hakkında bilgi almak istiyorum.`)}`)) return;
    } else if (currentListing.contactMethod === "phone") {
      const tel = sellerPhone.replace(/[^0-9+]/g, "");
      if (tel && await openUrlSafe(`tel:${tel}`)) return;
    }
    // Uygulama-içi mesaja düşmeden önce anonim ise girişe yönlendir (hayalet konuşma yok).
    if (!isAuthenticated) { router.push({ pathname: "/auth", params: { redirect: `/listing/${currentListing.id}` } }); return; }
    const fallbackMessage = `${currentListing.title} ilanı için bilgi almak istiyorum. Fiyat, stok ve teslimat detayları güncel mi?`;
    const conversation = startConversation(currentListing.id, owner.id, message.trim() || fallbackMessage);
    setMessage("");
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
  }

  // Sahibinden tarzı "Numarayı Göster": tıklayınca gerçek numarayı çeker (girişli
  // kullanıcıya). Numara feed'de taşınmaz; yalnız burada, istek üzerine gelir.
  async function revealPhone() {
    if (isDemo || !owner || revealingPhone) return;
    setRevealingPhone(true);
    const p = owner.phone || (await fetchSellerPhone(owner.id));
    setRevealingPhone(false);
    if (!p) { Alert.alert(translateCopy("Numara görünmüyor", language), translateCopy("Numarayı görmek için giriş yap; ya da satıcıya mesaj gönder.", language)); return; }
    attributeReferralLead("phone");
    setRevealedPhone(p);
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

  async function submitReport() {
    if (!reportReason) { Alert.alert(translateCopy("Sebep seç", language), translateCopy("Lütfen bir şikayet nedeni seç.", language)); return; }
    const details = `${currentListing.title} — ${reportReason}${reportDetail.trim() ? ` · ${reportDetail.trim()}` : ""}`;
    const ok = await reportListing(currentListing.id, reportReason, details);
    setReportOpen(false); setReportReason(""); setReportDetail("");
    Alert.alert(translateCopy(ok ? "Bildirim alındı" : "Giriş gerekli", language), translateCopy(ok ? "Moderasyon ekibi bu ilanı inceleyecek. Teşekkürler." : "İlan bildirmek için e-posta ile giriş yapmalısın.", language));
  }

  const metaDesc = `${currentListing.title} — ${moneyIn(currentListing.price, currentListing.currency)}. ${currentListing.description}`.replace(/\s+/g, " ").slice(0, 160);
  const metaUrl = `https://www.ortaksat.com/listing/${currentListing.id}`;
  // Sosyal paylaşımda kazanç kancası — ortak linki paylaşınca önizlemede görünür.
  const ogTitle = `${currentListing.title} — ${moneyIn(currentListing.price, currentListing.currency)} · Ortak ol, ${commissionText(currentListing)} kazan | OrtakSat`;
  const ogDesc = `${moneyIn(currentListing.price, currentListing.currency)} · ${commissionText(currentListing)}. Bu ürünü paylaş, satışta komisyon kazan. OrtakSat aracıdır; ödeme ve teslimat taraflar arasındadır.`;
  // JSON-LD Product şeması — Google zengin sonuç (fiyat, stok, kategori) için.
  // aggregateRating YALNIZCA gerçek (demo değil) ve gerçekten yorumu olan ilanlara
  // eklenir — sahte yıldız Google politikasını ve "sahte veri yasağı"nı ihlal eder.
  const productLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: currentListing.title,
    image: [currentListing.image, ...(currentListing.adAssets ?? [])].filter(Boolean).slice(0, 5),
    description: metaDesc,
    category: currentListing.category,
    // aggregateRating + review: YALNIZCA gerçek (demo değil) ilan yorumları varsa. Sahte
    // yıldız Google politikasını ve sahte-veri yasağını ihlal eder. Gerçek yorum gelince
    // otomatik yıldızlı zengin sonuç çıkar. Puan, ilanın GERÇEK yorumlarından hesaplanır.
    ...(() => {
      if (isDemo) return {};
      const rated = listingReviews.filter((r) => r.rating >= 1 && r.rating <= 5);
      if (rated.length === 0) return {};
      const avg = rated.reduce((s, r) => s + r.rating, 0) / rated.length;
      const withText = rated.filter((r) => r.comment && r.comment.trim()).slice(0, 3);
      return {
        aggregateRating: { "@type": "AggregateRating", ratingValue: Number(avg.toFixed(1)), reviewCount: rated.length, bestRating: 5, worstRating: 1 },
        ...(withText.length > 0
          ? {
              review: withText.map((r) => ({
                "@type": "Review",
                reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
                author: { "@type": "Person", name: findUser(r.reviewerId)?.name || "OrtakSat kullanıcısı" },
                reviewBody: r.comment.replace(/\s+/g, " ").slice(0, 300)
              }))
            }
          : {})
      };
    })(),
    offers: {
      "@type": "Offer",
      price: currentListing.price,
      priceCurrency: currentListing.currency ?? "TRY",
      availability: currentListing.stockCount > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: metaUrl,
      ...(owner ? { seller: { "@type": "Person", name: owner.name } } : {})
    }
  });

  // BreadcrumbList — Google arama sonucunda breadcrumb zengin-sonucu (Ana Sayfa ›
  // Kategori › Ürün). Görünür breadcrumb ile aynı kategori slug'ını kullanır.
  const bcCatSlug = findCategorySlug(currentListing.category);
  const breadcrumbLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: "https://www.ortaksat.com/" },
      ...(bcCatSlug ? [{ "@type": "ListItem", position: 2, name: currentListing.category, item: `https://www.ortaksat.com/kategori/${bcCatSlug}` }] : []),
      { "@type": "ListItem", position: bcCatSlug ? 3 : 2, name: currentListing.title, item: metaUrl }
    ]
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
      </Head>
      <JsonLd id="product" json={productLd} />
      <JsonLd id="breadcrumb" json={breadcrumbLd} />
      <WebContainer max={1280} padding={0} style={{ gap: 16 }}>
      {/* Breadcrumb: Ana Sayfa › Kategori › Ürün */}
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4, marginHorizontal: isWideWeb ? 0 : 12 }}>
        <Link href="/" asChild><Pressable accessibilityRole="link" accessibilityLabel={translateCopy("Ana sayfa", language)}><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{translateCopy("Ana Sayfa", language)}</Text></Pressable></Link>
        <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
        {(() => {
          const catSlug = findCategorySlug(currentListing.category);
          const href = catSlug ? ({ pathname: "/kategori/[slug]", params: { slug: catSlug } } as unknown as Href) : ("/kategoriler" as Href);
          return (
            <Link href={href} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel={`${translateCopy(currentListing.category, language)} ${translateCopy("kategorisi", language)}`}><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{translateCopy(currentListing.category, language)}</Text></Pressable>
            </Link>
          );
        })()}
        <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
        <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800", minWidth: 0 }}>{currentListing.title}</Text>
      </View>
      {isDemo ? (
        <View style={{ alignItems: "center", backgroundColor: colors.goldSoft, borderColor: colors.gold, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, marginHorizontal: isWideWeb ? 0 : 12, padding: 13 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.gold, borderRadius: 999, height: 34, justifyContent: "center", width: 34 }}>
            <MaterialCommunityIcons name="eye-outline" size={19} color={colors.goldInk} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Örnek (vitrin) ilan", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>{translateCopy("Bu ilan yalnızca platformun nasıl göründüğünü göstermek içindir. Mesajlaşma, iletişim ve ortaklık kapalıdır.", language)}</Text>
          </View>
        </View>
      ) : null}
      <View style={isWideWeb ? { flexDirection: "row", gap: 20, alignItems: "flex-start" } : { gap: 12 }}>
      <View style={isWideWeb ? { flex: 1.12, minWidth: 0 } : undefined}>
      {(() => {
        const mainImg = gallery[galleryIdx] ?? currentListing.image;
        // SEO + a11y: ürün görseline açıklayıcı alt (Google Görseller + ekran okuyucu).
        const imgAlt = `${currentListing.title}${currentListing.category ? ` — ${currentListing.category}` : ""}${currentListing.location ? `, ${currentListing.location}` : ""} · OrtakSat ortak satış ilanı`;
        return (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: isWideWeb ? 18 : 0, borderWidth: isWideWeb ? 1 : 0, marginTop: isWideWeb ? 16 : 0, overflow: "hidden" }}>
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={translateCopy("Görseli büyüt", language)}
              onPress={() => { if (inlineSwiped.current) { inlineSwiped.current = false; return; } setLightbox(true); }}
              onTouchStart={(e) => { swipeStartX.current = e.nativeEvent.pageX; inlineSwiped.current = false; }}
              onTouchEnd={(e) => {
                const dx = e.nativeEvent.pageX - swipeStartX.current;
                if (Math.abs(dx) > 45 && gallery.length > 1) {
                  inlineSwiped.current = true;
                  setActiveImage((dx < 0 ? galleryIdx + 1 : galleryIdx - 1 + gallery.length) % gallery.length);
                }
              }}
              style={{ position: "relative" }}
            >
              <SafeRemoteImage full uri={mainImg} alt={imgAlt} accessibilityLabel={imgAlt} style={{ backgroundColor: colors.line, height: isWideWeb ? 520 : 330, width: "100%" }} contentFit="cover" />
              <View style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, bottom: 12, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 6, position: "absolute", right: 12 }}>
                <MaterialCommunityIcons name="magnify-plus-outline" size={14} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 11.5, fontWeight: "800" }}>{translateCopy("Büyüt", language)}{gallery.length > 1 ? ` · ${galleryIdx + 1}/${gallery.length}` : ""}</Text>
              </View>
              {/* Mobil: birden çok görselde kaydırma ipucu (nokta göstergesi) */}
              {!isWideWeb && gallery.length > 1 ? (
                <View style={{ alignItems: "center", bottom: 12, flexDirection: "row", gap: 5, justifyContent: "center", left: 0, position: "absolute", right: 0 }}>
                  {gallery.map((_, i) => (
                    <View key={i} style={{ backgroundColor: i === galleryIdx ? "#FFFFFF" : "rgba(255,255,255,0.5)", borderRadius: 999, height: 7, width: i === galleryIdx ? 18 : 7 }} />
                  ))}
                </View>
              ) : null}
            </Pressable>
            {gallery.length > 1 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, paddingTop: 12 }}>
                {gallery.map((img, i) => (
                  <Pressable key={img + i} onPress={() => setActiveImage(i)} style={{ borderColor: i === galleryIdx ? colors.primary : colors.line, borderRadius: 10, borderWidth: i === galleryIdx ? 2 : 1, height: 64, overflow: "hidden", width: 64 }}>
                    <SafeRemoteImage uri={img} alt={`${imgAlt} — görsel ${i + 1}`} accessibilityLabel={`${imgAlt} — görsel ${i + 1}`} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, padding: 12 }}>
              <IconButton active={favorited} icon={favorited ? "heart" : "heart-outline"} label={translateCopy("Beğen", language)} onPress={() => toggleFavorite(currentListing.id)} />
              {!isDemo ? <IconButton active={inCompare} icon={inCompare ? "compare-remove" : "compare-horizontal"} label={translateCopy("Karşılaştır", language)} onPress={() => toggleCompare(currentListing.id)} /> : null}
              <IconButton icon="share-variant-outline" label={translateCopy("Paylaş", language)} onPress={() => void handleShare()} />
              {!isOwner ? <IconButton icon="flag-outline" label={translateCopy("Bildir", language)} onPress={() => setReportOpen(true)} /> : null}
            </View>
          </View>
        );
      })()}
      </View>

      <View style={isWideWeb ? { flex: 1, gap: 12, minWidth: 0, marginTop: 16 } : { gap: 12, paddingHorizontal: 12 }}>
        {/* Satın alma / ortak kutusu — e-ticaret tarzı tek, net karar alanı */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label={translateCopy(currentListing.category, language)} />
            <StatusPill label={translateCopy(currentListing.partnershipMode === "open" ? "Anında ortaklık" : isInviteMode ? "Davetle ortaklık" : "Satıcı onaylı", language)} tone={currentListing.partnershipMode === "open" ? "success" : "warning"} />
          </View>

          <Text selectable accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: 23, fontWeight: "900", lineHeight: 29 }}>{currentListing.title}</Text>

          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {owner?.rating ? (
              <>
                <MaterialCommunityIcons name="star" size={15} color={colors.gold} />
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{owner.rating.toFixed(1)}</Text>
              </>
            ) : (
              <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{translateCopy("Yeni satıcı", language)}</Text>
              </View>
            )}
            {owner?.verifiedPhone || owner?.verifiedIdentity ? (
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 3, paddingHorizontal: 8, paddingVertical: 2 }}>
                <MaterialCommunityIcons name="check-decagram" size={12} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "900" }}>{translateCopy("Doğrulanmış", language)}</Text>
              </View>
            ) : null}
            <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{owner?.successfulSales ? ` · ${owner.successfulSales} ${translateCopy("satış", language)}` : ""} · {currentListing.location}</Text>
          </View>

          {/* İlan tarihi + no (Sahibinden tarzı referans/tazelik bilgisi) */}
          {(() => {
            const created = new Date(currentListing.createdAt);
            const valid = !Number.isNaN(created.getTime());
            const days = valid ? Math.floor((Date.now() - created.getTime()) / 86400000) : -1;
            const dateLabel = !valid ? "" : days <= 0 ? translateCopy("Bugün", language) : days === 1 ? translateCopy("Dün", language) : days < 30 ? `${days} ${translateCopy("gün önce", language)}` : created.toLocaleDateString(language === "en" ? "en-GB" : "tr-TR");
            const ilanNo = currentListing.id.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase();
            return (
              <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {dateLabel ? (
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <MaterialCommunityIcons name="calendar-blank-outline" size={13} color={colors.subtle} />
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{dateLabel}</Text>
                  </View>
                ) : null}
                <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                  <MaterialCommunityIcons name="pound" size={13} color={colors.subtle} />
                  <Text selectable style={{ color: colors.subtle, fontSize: 12, fontWeight: "700" }}>{translateCopy("İlan no", language)}: {ilanNo}</Text>
                </View>
              </View>
            );
          })()}

          {/* Fiyat sayfanın en güçlü öğesi olmalı (ürün sayfası) — komisyon kutusu daha hafif. */}
          <Text selectable style={{ color: colors.ink, fontSize: 33, fontWeight: "900", letterSpacing: -0.5 }}>{moneyIn(currentListing.price, currentListing.currency)}</Text>

          {/* Ortak kazancı — modelin çekirdeği ama fiyattan daha hafif görsel ağırlıkta (kenarlıksız). */}
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 12, gap: 4, padding: 12 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
              <MaterialCommunityIcons name="cash-multiple" size={16} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 11.5, fontWeight: "900", letterSpacing: 0.3 }}>{translateCopy("ORTAK KAZANCI", language)}</Text>
              <Text style={{ color: colors.primaryDark, fontSize: 17, fontWeight: "900" }}>{moneyIn(commission, currentListing.currency)}</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>{commissionText(currentListing)}{" · "}{translateCopy("Bu ürünü sat ya da alıcı getir; her satışta kazan. Komisyonu satıcı öder.", language)}</Text>
            {/* Faz 4: kategori-bazlı dönüşüm olayı — komisyon HANGİ olayda hak edilir. */}
            {(() => {
              const conv = categoryConversion(currentListing.category);
              return (
                <View style={{ alignItems: "flex-start", backgroundColor: colors.surface, borderRadius: 9, flexDirection: "row", gap: 7, marginTop: 4, padding: 9 }}>
                  <MaterialCommunityIcons name={conv.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={15} color={colors.primaryDark} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.ink, fontSize: 11.5, fontWeight: "900" }}>{translateCopy("Komisyon şu olayda hak edilir", language)}: {translateCopy(conv.event, language)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", lineHeight: 15 }}>{translateCopy(conv.hint, language)}</Text>
                  </View>
                </View>
              );
            })()}
          </View>

          {/* İlan Bilgileri (Sahibinden tarzı) — kategoriye özel skaler özellikler,
              fiyatın hemen altında öne çıkarılır. Donanım (çok-seçim) dizileri hariç. */}
          {(() => {
            const scalarSpecs = describeAttributes(currentListing.attributes).filter((r) => !r.items);
            if (scalarSpecs.length === 0) return null;
            return (
              <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, overflow: "hidden" }}>
                <View style={{ borderBottomColor: colors.line, borderBottomWidth: 1, paddingHorizontal: 13, paddingVertical: 9 }}>
                  <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("İlan Bilgileri", language)}</Text>
                </View>
                {scalarSpecs.map((row, i) => (
                  <View key={row.label} style={{ backgroundColor: i % 2 === 1 ? colors.surface : "transparent", flexDirection: "row", gap: 10, paddingHorizontal: 13, paddingVertical: 8 }}>
                    <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{translateCopy(row.label, language)}</Text>
                    <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800", textAlign: "right" }}>{translateCopy(row.value, language)}</Text>
                  </View>
                ))}
              </View>
            );
          })()}

          {/* Anahtar bilgiler */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Metric label={translateCopy("Stok", language)} value={`${currentListing.stockCount} ${translateCopy("adet", language)}`} />
            <Metric label={translateCopy("Ortaklık", language)} value={translateCopy(currentListing.partnershipMode === "open" ? "Anında" : isInviteMode ? "Davetle" : "Onaylı", language)} />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Metric label={translateCopy("İade", language)} value={`${currentListing.returnWindowDays} ${translateCopy("gün", language)}`} />
            <Metric label={translateCopy("Komisyon vadesi", language)} value={`${currentListing.commissionDueDays} ${translateCopy("gün", language)}`} />
          </View>

          {/* Durum-duyarlı ana aksiyon (apply=1 ile buraya kaydırılır) */}
          <View ref={joinAnchorRef} />
          {isOwner ? (
            <View style={{ gap: 8 }}>
              <PrimaryButton href={{ pathname: "/listing-edit/[id]", params: { id: currentListing.id } }} icon="pencil-outline">{translateCopy("İlanı Düzenle", language)}</PrimaryButton>
              <PrimaryButton href="/(tabs)/seller" tone="secondary" icon="storefront-outline">{translateCopy("Satıcı panelinde yönet", language)}</PrimaryButton>
              {isInviteMode ? (
                <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 8, padding: 12 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                    <MaterialCommunityIcons name="ticket-account" size={16} color={colors.primaryDark} />
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900" }}>{translateCopy("Ortak davet linki", language)}</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy("Bu ilan sadece davetle. Aşağıdaki linki güvendiğin ortaklarla paylaş; linkle gelen kişi anında (ön-onaylı) ortak olur.", language)}</Text>
                  <ShareRow url={partnerInviteUrl(currentListing)} text={`${currentListing.title} — ${translateCopy("ortak daveti", language)}`} />
                </View>
              ) : null}
            </View>
          ) : isDemo ? (
            <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 11, flexDirection: "row", gap: 8, padding: 12 }}>
              <MaterialCommunityIcons name="lock-outline" size={16} color={colors.muted} />
              <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{translateCopy("Örnek ilan — ortaklık ve iletişim kapalıdır.", language)}</Text>
            </View>
          ) : partnership?.status === "active" ? (
            <View style={{ backgroundColor: colors.primarySoft, borderRadius: 12, gap: 9, padding: 12 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                <MaterialCommunityIcons name="check-decagram" size={17} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 13, fontWeight: "900" }}>{translateCopy("Ortaksın · paylaşım bağlantın hazır", language)}</Text>
              </View>
              {activeShareUrl ? <ShareRow url={activeShareUrl} text={`${currentListing.title} — ${moneyIn(currentListing.price, currentListing.currency)}`} /> : null}
              {partnership?.agreedAt ? (
                <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                  <MaterialCommunityIcons name="lock-check" size={13} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 11.5, fontWeight: "700" }}>
                    {translateCopy("Komisyon şartların ortak olduğun anda kilitlendi — satıcı ilanı düzenlese de değişmez.", language)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : partnership?.status === "pending" ? (
            <View style={{ alignItems: "center", backgroundColor: colors.warningSoft, borderRadius: 11, flexDirection: "row", gap: 8, padding: 12 }}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={colors.warning} />
              <Text style={{ color: colors.warning, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Başvurun satıcı onayında.", language)}</Text>
            </View>
          ) : isInviteMode && !validInvite ? (
            <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 8, padding: 14 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <MaterialCommunityIcons name="email-lock-outline" size={17} color={colors.muted} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Ortaklık sadece davetle", language)}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Bu ürünün ortaklığı herkese açık değil. Ortak olmak istiyorsan satıcıdan davet linki iste; linkle geldiğinde anında ortak olabilirsin.", language)}</Text>
              <PrimaryButton tone="secondary" icon="message-text-outline" onPress={() => void handleContact()}>{translateCopy("Satıcıdan davet iste", language)}</PrimaryButton>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {validInvite ? (
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, flexDirection: "row", gap: 8, padding: 12 }}>
                  <MaterialCommunityIcons name="ticket-confirmation-outline" size={17} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Satıcı seni davet etti — anında ortak olabilirsin.", language)}</Text>
                </View>
              ) : null}
              {/* Onaylı ilanlarda küçük başvuru formu (açık modda ve davetli katılımda gösterilmez). */}
              {currentListing.partnershipMode !== "open" && !validInvite ? (
                <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 11, padding: 12 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                    <MaterialCommunityIcons name="account-edit-outline" size={16} color={colors.primaryDark} />
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900" }}>{translateCopy("Başvuru bilgilerin", language)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "800" }}>{translateCopy("Satıcı görecek", language)}</Text>
                  </View>
                  {/* Neden satmak istiyor (zorunlu) */}
                  <View style={{ gap: 5 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Neden bu ürünü satmak istiyorsun? *", language)}</Text>
                    <TextInput
                      value={applicationNote}
                      onChangeText={setApplicationNote}
                      placeholder={translateCopy("Kısaca anlat: kime, nerede ve nasıl ulaştıracaksın?", language)}
                      placeholderTextColor={colors.subtle}
                      multiline
                      autoFocus={wantsApply}
                      style={{ backgroundColor: colors.surface, borderColor: applicationNote.trim() ? colors.line : colors.warning, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 64, padding: 10, textAlignVertical: "top" }}
                    />
                  </View>
                  {/* Kanal seçimi */}
                  <View style={{ gap: 5 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Hangi kanalda paylaşacaksın?", language)}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {["WhatsApp", "Instagram", "TikTok", "Diğer"].map((ch) => {
                        const on = applicationChannel === ch;
                        return (
                          <Pressable key={ch} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${translateCopy("Kanal:", language)} ${ch}`} onPress={() => setApplicationChannel(ch)} style={{ backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7 }}>
                            <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{translateCopy(ch, language)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  {/* Erişim + kullanıcı adı (yan yana) */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Tahmini erişim (kişi)", language)}</Text>
                      <TextInput
                        value={applicationReach}
                        onChangeText={(txt) => setApplicationReach(txt.replace(/[^0-9]/g, ""))}
                        keyboardType="number-pad"
                        placeholder={translateCopy("ör. 500", language)}
                        placeholderTextColor={colors.subtle}
                        style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 42, paddingHorizontal: 10, paddingVertical: 8 }}
                      />
                    </View>
                    <View style={{ flex: 1.35, gap: 5 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Sosyal medya adın (ops.)", language)}</Text>
                      <TextInput
                        value={applicationHandle}
                        onChangeText={setApplicationHandle}
                        autoCapitalize="none"
                        placeholder={translateCopy("@kullaniciadi", language)}
                        placeholderTextColor={colors.subtle}
                        style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 42, paddingHorizontal: 10, paddingVertical: 8 }}
                      />
                    </View>
                  </View>
                  {/* Kitle tanımı (opsiyonel) */}
                  <View style={{ gap: 5 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Tahmini kitle (opsiyonel)", language)}</Text>
                    <TextInput
                      value={applicationAudience}
                      onChangeText={setApplicationAudience}
                      placeholder={translateCopy("ör. genç anneler, üniversite çevresi…", language)}
                      placeholderTextColor={colors.subtle}
                      style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 42, paddingHorizontal: 10, paddingVertical: 8 }}
                    />
                  </View>
                </View>
              ) : null}
              <PrimaryButton icon="handshake-outline" onPress={handleJoin}>{translateCopy(currentListing.partnershipMode === "open" || validInvite ? "Hemen Ortak Ol ve Kazan" : "Ortaklık Başvurusu Gönder", language)}</PrimaryButton>
            </View>
          )}

          {/* İletişim */}
          {!isOwner && !isDemo ? (
            <View style={{ gap: 10 }}>
              <SafetyNote />
              {/* TEKLİF VER — eskiden teklif yalnız sohbete serbest metin olarak
                  yazılabiliyordu; satıcı takip edemiyor, kabul/ret edemiyordu. */}
              {myOffer ? (
                <View style={{ backgroundColor: myOffer.status === "accepted" ? colors.successSoft : myOffer.status === "rejected" ? colors.accentSoft : colors.goldSoft, borderColor: myOffer.status === "accepted" ? colors.success : myOffer.status === "rejected" ? colors.accent : colors.gold, borderRadius: 10, borderWidth: 1, gap: 4, padding: 12 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                    <MaterialCommunityIcons name="handshake" size={16} color={myOffer.status === "accepted" ? colors.success : myOffer.status === "rejected" ? colors.accent : colors.goldInk} />
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>
                      {translateCopy("Teklifin", language)}: {moneyIn(myOffer.amount, currentListing.currency)}
                    </Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>
                    {myOffer.status === "pending" ? translateCopy("Satıcının yanıtı bekleniyor.", language)
                      : myOffer.status === "accepted" ? translateCopy("KABUL EDİLDİ — satıcıyla mesajlaşarak teslimatı ayarla.", language)
                      : myOffer.status === "rejected" ? translateCopy("Kabul edilmedi. Yeni bir teklif verebilirsin.", language)
                      : myOffer.status === "countered" ? `${translateCopy("Satıcı karşı teklif verdi", language)}: ${moneyIn(myOffer.counterAmount ?? 0, currentListing.currency)}`
                      : translateCopy("Geri çekildi.", language)}
                  </Text>
                  {myOffer.status === "pending" ? (
                    <Pressable onPress={() => void buyerOfferAction(myOffer.id, "withdrawn")} accessibilityRole="button" hitSlop={6} style={({ pressed }) => ({ alignSelf: "flex-start", opacity: pressed ? 0.7 : 1, paddingTop: 2 })}>
                      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "900" }}>{translateCopy("Teklifi geri çek", language)}</Text>
                    </Pressable>
                  ) : null}
                  {/* Satıcı karşı teklif verdiyse alıcı yanıtlayabilmeli — yoksa akış burada tıkanıyordu. */}
                  {myOffer.status === "countered" ? (
                    <View style={{ flexDirection: "row", gap: 8, paddingTop: 4 }}>
                      <Pressable
                        accessibilityRole="button"
                        testID="offer-accept-counter"
                        onPress={() => void buyerOfferAction(myOffer.id, "accept_counter")}
                        style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.success, borderRadius: 9, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}
                      >
                        <MaterialCommunityIcons name="check" size={15} color="#FFFFFF" />
                        <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>{translateCopy("Kabul Et", language)}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        testID="offer-reject-counter"
                        onPress={() => void buyerOfferAction(myOffer.id, "reject_counter")}
                        style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}
                      >
                        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Reddet", language)}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : (
                <PrimaryButton tone="secondary" icon="handshake-outline" onPress={() => { if (!isAuthenticated) { router.push({ pathname: "/auth", params: { redirect: `/listing/${currentListing.id}` } }); return; } setOfferAmount(""); setOfferNote(""); setOfferErr(null); setOfferOpen(true); }}>{translateCopy("Teklif Ver", language)}</PrimaryButton>
              )}
              <PrimaryButton tone="secondary" icon={currentListing.contactMethod === "whatsapp" ? "whatsapp" : currentListing.contactMethod === "phone" ? "phone" : "message-text-outline"} onPress={() => void handleContact()}>{translateCopy(contactLabel(currentListing.contactMethod), language)}</PrimaryButton>
              {/* Numarayı Göster (Sahibinden tarzı) — istek üzerine gerçek numara */}
              {revealedPhone ? (
                <Pressable onPress={() => { const tel = revealedPhone.replace(/[^0-9+]/g, ""); if (tel) void openUrlSafe(`tel:${tel}`); }} accessibilityRole="button" accessibilityLabel={`${translateCopy("Ara", language)}: ${revealedPhone}`} style={{ alignItems: "center", backgroundColor: colors.successSoft, borderColor: colors.success, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 12 }}>
                  <MaterialCommunityIcons name="phone" size={16} color={colors.success} />
                  <Text selectable style={{ color: colors.success, fontSize: 15, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{revealedPhone}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => void revealPhone()} disabled={revealingPhone} accessibilityRole="button" accessibilityLabel={translateCopy("Numarayı göster", language)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", opacity: revealingPhone ? 0.7 : 1, paddingVertical: 12 }}>
                  <MaterialCommunityIcons name="phone-outline" size={16} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>{revealingPhone ? translateCopy("Yükleniyor…", language) : translateCopy("Numarayı Göster", language)}</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {/* Satıcı mini kartı */}
          <View style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 10, paddingTop: 12 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 40, justifyContent: "center", width: 40 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{(owner?.name ?? "S").slice(0, 1).toLocaleUpperCase("tr-TR")}</Text>
            </View>
            <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
                <Text numberOfLines={1} style={{ color: colors.ink, flexShrink: 1, fontSize: 14, fontWeight: "900" }}>{owner?.name ?? translateCopy("Satıcı", language)}</Text>
                {!isDemo && (owner?.verifiedPhone || owner?.verifiedIdentity) ? <MaterialCommunityIcons name="check-decagram" size={14} color={colors.primary} /> : null}
                {!isDemo && owner?.rating ? <Text style={{ color: colors.gold, fontSize: 12, fontWeight: "800" }}>★ {owner.rating.toFixed(1)}</Text> : null}
              </View>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{isDemo ? translateCopy("Örnek vitrin satıcısı", language) : `%${ownerTrust?.score ?? 0} ${translateCopy("güven", language)} · %${owner?.responseRate ?? 0} ${translateCopy("yanıt", language)}`}</Text>
              {!isDemo ? (
                <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 1 }}>
                  <MaterialCommunityIcons name="storefront-outline" size={11} color={colors.subtle} />
                  <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>
                    {sellerActiveCount} {translateCopy("aktif ilan", language)}{sellerSales > 0 ? ` · ${sellerSales} ${translateCopy("tamamlanan satış", language)}` : ""}
                  </Text>
                </View>
              ) : null}
              {/* Gerçek doğrulama rozetleri (yalnız kazanılanlar; şirket/banka gibi uygulanmayan gösterilmez). */}
              {!isDemo ? <View style={{ marginTop: 5 }}><VerificationBadges user={owner} size="sm" /></View> : null}
            </View>
            <Link href={{ pathname: "/store/[id]", params: { id: currentListing.ownerId } }} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel={translateCopy("Mağazayı aç", language)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 8 }}>
                <MaterialCommunityIcons name="store-search-outline" size={14} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Mağaza", language)}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
      </View>

      <View style={{ gap: 12, paddingHorizontal: isWideWeb ? 0 : 12 }}>
        {/* Etkileşimli kazanç hesaplayıcı */}
        {!isOwner && !isDemo ? <EarningsCalculator listing={currentListing} isDemo={isDemo} onJoin={handleJoin} /> : null}

        <AgreementCard listing={currentListing} partnership={partnership} />

        {partnership?.status === "active" ? (
          <Card>
            <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Alıcı talebi", language)}</Text>
            <Field label="Alıcı adı" value={buyerName} onChangeText={setBuyerName} />
            <Field label="Telefon" value={buyerPhone} onChangeText={setBuyerPhone} />
            <ChoiceRow<LeadSource> value={leadSource} setValue={setLeadSource} options={["whatsapp", "instagram", "web", "phone"]} labels={sourceLabels} />
            <ChoiceRow<PurchaseIntent> value={purchaseIntent} setValue={setPurchaseIntent} options={["hot", "warm", "cold"]} labels={intentLabels} />
            <Field label="Not" value={leadNote} onChangeText={setLeadNote} multiline />
            <PrimaryButton icon="account-plus-outline" onPress={handleCreateLead}>{translateCopy("Talebi kaydet", language)}</PrimaryButton>
          </Card>
        ) : null}

        <View style={{ gap: 10 }}>
          <Accordion title={translateCopy("Ürün açıklaması", language)} icon="text-box-outline" defaultOpen>
            <Text selectable style={{ color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>{currentListing.description}</Text>
            {currentListing.salesPitch.slice(0, 4).map((line) => (
              <Bullet key={line} icon="check-circle-outline" text={line} tone="info" />
            ))}
          </Accordion>
          {/* Özellikler & Donanım (Sahibinden tarzı) — çok-seçimli donanım/güvenlik/
              konfor dizileri çip olarak. Skaler özellikler yukarıdaki İlan Bilgileri kutusunda. */}
          {(() => {
            const listSpecs = describeAttributes(currentListing.attributes).filter((r) => r.items && r.items.length);
            if (listSpecs.length === 0) return null;
            return (
              <Accordion title={translateCopy("Özellikler & Donanım", language)} icon="star-check-outline" defaultOpen>
                <View style={{ gap: 12 }}>
                  {listSpecs.map((row) => (
                    <View key={row.label} style={{ gap: 7 }}>
                      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy(row.label, language)}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {(row.items ?? []).map((it) => (
                          <View key={it} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 6 }}>
                            <MaterialCommunityIcons name="check" size={13} color={colors.primaryDark} />
                            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "700" }}>{translateCopy(it, language)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </Accordion>
            );
          })()}
          <Accordion title={translateCopy("İlan detayları", language)} icon="format-list-bulleted">
            <SpecRow label="Kategori" value={currentListing.category} />
            {currentListing.attributes?.listingType ? <SpecRow label="İlan tipi" value={String(currentListing.attributes.listingType)} /> : null}
            <SpecRow label="Konum" value={currentListing.location} />
            <SpecRow label="Stok" value={`${currentListing.stockCount} ${translateCopy("adet", language)}`} />
            <SpecRow label="Komisyon" value={currentListing.commissionType === "rate" ? `%${currentListing.commissionValue}` : moneyIn(commission, currentListing.currency)} />
            <SpecRow label="Ortak kazancı" value={moneyIn(commission, currentListing.currency)} />
            <SpecRow label="Ortaklık" value={currentListing.partnershipMode === "open" ? "Anında ortaklık" : isInviteMode ? "Davetle ortaklık" : "Satıcı onaylı"} />
            {currentListing.minPartnerRating > 0 ? <SpecRow label="Min. ortak puanı" value={`${currentListing.minPartnerRating}+`} /> : null}
            <SpecRow label="Komisyon vadesi" value={`${currentListing.commissionDueDays} ${translateCopy("gün", language)}`} />
            <SpecRow label="İade süresi" value={`${currentListing.returnWindowDays} ${translateCopy("gün", language)}`} />
            <SpecRow label="Atıf (referans) süresi" value={`${currentListing.attributionWindowDays} ${translateCopy("gün", language)}`} />
            <SpecRow label="İletişim" value={contactLabel(currentListing.contactMethod)} />
          </Accordion>
          <Accordion title={translateCopy("Teslimat ve iade", language)} icon="truck-outline">
            <Text selectable style={{ color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>
              {translateCopy("Teslimat ve ödeme, satıcı ile alıcı arasında", language)} {translateCopy(contactLabel(currentListing.contactMethod), language).toLocaleLowerCase("en-US")}{translateCopy(" üzerinden kararlaştırılır. İade ve değişim koşullarını satışı kapatmadan önce satıcıyla netleştir.", language)}
            </Text>
            <LegalNote style={{ marginTop: 8 }} />
          </Accordion>
          <Accordion title={translateCopy("Sıkça sorulan sorular", language)} icon="comment-question-outline">
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
          listings={similarFinal}
          ownersById={(ownerId) => findUser(ownerId)}
          title={translateCopy("Benzer ürünler", language)}
          emptyText={translateCopy("Bu kategoride başka aktif ürün yok.", language)}
        />

        {recentViewed.length > 0 ? (
          <RelatedListingsSection
            cardWidth={relatedCardWidth}
            listings={recentViewed}
            ownersById={(ownerId) => findUser(ownerId)}
            title={translateCopy("Son gezdiklerin", language)}
            emptyText=""
          />
        ) : null}

        <Card>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900" }}>{translateCopy("Yorumlar", language)}</Text>
            <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "900" }}>{listingReviews.length}</Text>
          </View>
          {reviewableSale ? (
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, gap: 10, padding: 10 }}>
              <Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{translateCopy("Satış sonrası yorum hakkın var", language)}</Text>
              <StarRatingInput value={reviewRating} onChange={setReviewRating} />
              <Field label="Yorum" value={reviewComment} onChangeText={setReviewComment} multiline />
              <PrimaryButton tone="secondary" icon="star-outline" onPress={handleSaleReview}>{translateCopy("Yorumu kaydet", language)}</PrimaryButton>
            </View>
          ) : null}
          {listingReviews.length === 0 ? (
            <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
              {translateCopy("Bu ürün için henüz yorum yok.", language)}
            </Text>
          ) : null}
          {/* Paylaşılan ReviewCard (mağaza sayfasıyla AYNI): kendi yorumunu düzenle/sil,
              satıcı yanıtı, faydalı oyu, şikayet. Burada eskiden salt-okunur bir kopya vardı. */}
          {listingReviews.map((item) => (
            <ReviewCard
              key={item.id}
              review={item}
              reviewerName={findUser(item.reviewerId)?.name}
              isSeller={isOwner}
              authed={isReviewAuthed}
              isMine={item.reviewerId === currentUser.id}
              onEdit={editReview}
              onDelete={deleteReview}
              onReport={reportReview}
              language={language}
            />
          ))}
        </Card>
      </View>
      </WebContainer>

      {/* Tam ekran görsel (lightbox) */}
      {/* Şikayet nedeni seçici (spec 80) */}
      {/* TEKLİF VER modalı — tutar + not. Platform para TUTMAZ: kabul edilse bile
          ödeme/teslimat taraflar arasındadır; burada tutulan anlaşma kaydıdır. */}
      <Modal visible={offerOpen} transparent animationType="fade" onRequestClose={() => setOfferOpen(false)}>
        {/* P0: tutar alani autoFocus + numeric -> klavye ANINDA acilir; iOS sayisal
            klavyede Done/return YOK. Kart yukari kalkmadigi icin "Teklifi Gonder"
            klavyenin ALTINDA kaliyor, tek kacis arka plana basmak = TEKLIFI SILER.
            RN Modal ebeveynin KAV'ini miras almaz -> modalin kendi KAV'i sart. */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Pressable onPress={() => setOfferOpen(false)} style={{ backgroundColor: "rgba(8,15,25,0.55)", flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", flexGrow: 1, justifyContent: "center", padding: 20 }}>
          <Pressable onPress={() => undefined} style={{ backgroundColor: colors.surface, borderRadius: 18, gap: 12, maxWidth: 420, padding: 20, width: "100%" }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
              <MaterialCommunityIcons name="handshake-outline" size={20} color={colors.primaryDark} />
              <Text style={{ color: colors.ink, flex: 1, fontSize: 16.5, fontWeight: "900" }}>{translateCopy("Teklif Ver", language)}</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>
              {translateCopy("İlan fiyatı", language)}: {moneyIn(currentListing.price, currentListing.currency)}
            </Text>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Teklifin (₺)", language)}</Text>
              <TextInput
                value={offerAmount}
                onChangeText={(t) => { setOfferAmount(t.replace(/[^0-9.,]/g, "")); setOfferErr(null); }}
                keyboardType="numeric"
                autoFocus
                placeholder={translateCopy("Örn. 45.000", language)}
                placeholderTextColor={colors.subtle}
                style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 16, fontWeight: "800", minHeight: 48, paddingHorizontal: 12 }}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Not (opsiyonel)", language)}</Text>
              <TextInput
                value={offerNote}
                onChangeText={setOfferNote}
                multiline
                placeholder={translateCopy("Ör. Nakit alırım, bugün gelebilirim.", language)}
                placeholderTextColor={colors.subtle}
                style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13.5, minHeight: 70, padding: 10, textAlignVertical: "top" }}
              />
            </View>
            {offerErr ? <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "800" }}>{offerErr}</Text> : null}
            <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>
              {translateCopy("OrtakSat ödeme almaz. Teklif kabul edilirse ödeme ve teslimatı satıcıyla doğrudan yaparsın.", language)}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
              <Pressable onPress={() => setOfferOpen(false)} style={({ pressed }) => ({ borderColor: colors.line, borderRadius: 10, borderWidth: 1, opacity: pressed ? 0.8 : 1, paddingHorizontal: 16, paddingVertical: 11 })}>
                <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "800" }}>{translateCopy("Vazgeç", language)}</Text>
              </Pressable>
              <Pressable
                disabled={offerBusy}
                onPress={() => {
                  const amt = parseTrPrice(offerAmount);
                  if (!(amt > 0)) { setOfferErr(translateCopy("Geçerli bir tutar gir.", language)); return; }
                  setOfferBusy(true);
                  void createOffer(currentListing.id, currentListing.ownerId, amt, offerNote.trim() || undefined)
                    .then((res) => {
                      setOfferBusy(false);
                      if (!res.ok) { setOfferErr(res.error ?? translateCopy("Teklif gönderilemedi.", language)); return; }
                      setOfferOpen(false);
                      Alert.alert(translateCopy("Teklifin gönderildi", language), translateCopy("Satıcı yanıtlayınca bildirim alacaksın.", language));
                    })
                    .catch(() => { setOfferBusy(false); setOfferErr(translateCopy("Teklif gönderilemedi.", language)); });
                }}
                style={({ pressed }) => ({ backgroundColor: offerBusy ? colors.line : colors.primary, borderRadius: 10, opacity: pressed ? 0.85 : 1, paddingHorizontal: 20, paddingVertical: 11 })}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{offerBusy ? translateCopy("Gönderiliyor…", language) : translateCopy("Teklifi Gönder", language)}</Text>
              </Pressable>
            </View>
          </Pressable>
          </ScrollView>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <View style={{ backgroundColor: "rgba(16,24,40,0.55)", flex: 1, justifyContent: "center", padding: 20 }}>
          <View style={{ alignSelf: "center", backgroundColor: colors.background, borderRadius: 18, gap: 14, maxWidth: 460, padding: 22, width: "100%" }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}>
                <MaterialCommunityIcons name="flag-outline" size={22} color={colors.accent} />
              </View>
              <Text style={{ color: colors.ink, flex: 1, fontSize: 17, fontWeight: "900" }}>{translateCopy("İlanı bildir", language)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Kapat", language)} onPress={() => setReportOpen(false)} hitSlop={8}><MaterialCommunityIcons name="close" size={22} color={colors.muted} /></Pressable>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Bu ilanda bir sorun mu var? Nedenini seç; moderasyon ekibi inceler.", language)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {["Sahte İlan", "Yanlış Fiyat", "Yanlış Konum", "Spam", "Kopya İlan", "Hakaret", "Dolandırıcılık", "Telif İhlali", "Yasaklı İçerik"].map((r) => {
                const on = reportReason === r;
                return (
                  <Pressable key={r} onPress={() => setReportReason(r)} style={{ backgroundColor: on ? colors.primarySoft : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Text style={{ color: on ? colors.primaryDark : colors.ink, fontSize: 12.5, fontWeight: on ? "900" : "700" }}>{translateCopy(r, language)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput value={reportDetail} onChangeText={setReportDetail} placeholder={translateCopy("İstersen kısa bir açıklama ekle (opsiyonel)", language)} placeholderTextColor={colors.subtle} multiline style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13, minHeight: 64, padding: 12, textAlignVertical: "top" }} />
            <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
              <Pressable onPress={() => setReportOpen(false)} style={{ borderColor: colors.line, borderRadius: 10, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 11 }}><Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("Vazgeç", language)}</Text></Pressable>
              <Pressable onPress={() => void submitReport()} style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 }}><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Bildir", language)}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={lightbox} transparent animationType="fade" onRequestClose={() => { setLightbox(false); setZoomed(false); }}>
        <View style={{ backgroundColor: "rgba(0,0,0,0.92)", flex: 1, justifyContent: "center" }}>
          <Pressable accessibilityLabel={translateCopy("Kapat", language)} onPress={() => { setLightbox(false); setZoomed(false); }} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, height: 42, justifyContent: "center", position: "absolute", right: 18, top: 18, width: 42, zIndex: 5 }}>
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => setZoomed((z) => !z)}
            accessibilityRole="imagebutton"
            accessibilityLabel={zoomed ? translateCopy("Uzaklaştır", language) : translateCopy("Yakınlaştır", language)}
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
              full
              uri={gallery[galleryIdx] ?? currentListing.image}
              alt={currentListing.title}
              accessibilityLabel={currentListing.title}
              style={{ height: "100%", transform: [{ scale: zoomed ? 2.2 : 1 }], width: "100%" }}
              contentFit="contain"
            />
          </Pressable>
          <View style={{ alignItems: "center", bottom: 74, left: 0, position: "absolute", right: 0 }}>
            <View style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700" }}>{zoomed ? translateCopy("Uzaklaştırmak için dokun", language) : translateCopy("Yakınlaştırmak için dokun · kaydırarak gez", language)}</Text>
            </View>
          </View>
          {gallery.length > 1 ? (
            <>
              <Pressable accessibilityLabel={translateCopy("Önceki görsel", language)} onPress={() => { setActiveImage((galleryIdx - 1 + gallery.length) % gallery.length); setZoomed(false); }} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, height: 48, justifyContent: "center", left: 14, position: "absolute", top: "46%", width: 48 }}>
                <MaterialCommunityIcons name="chevron-left" size={30} color="#FFFFFF" />
              </Pressable>
              <Pressable accessibilityLabel={translateCopy("Sonraki görsel", language)} onPress={() => { setActiveImage((galleryIdx + 1) % gallery.length); setZoomed(false); }} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, height: 48, justifyContent: "center", position: "absolute", right: 14, top: "46%", width: 48 }}>
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
