import { ListingTermsSummary } from "@/components/listing-terms-summary";
import { listingFlowPaths, listingJoinAction } from "@/lib/listing-actions";
import { listingMedia } from "@/lib/mobile-listing";
import { displayListingTitle } from "@/lib/listing-title";
import { isMobileApp } from "@/lib/mobile-app";
import { MobileListingDetail } from "@/components/mobile/listing-detail";
import { MaterialCommunityIcons } from "@/components/icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type ViewInstance } from "react-native";

import { Alert } from "@/lib/alert";
import { showToast } from "@/lib/toast";
import { openUrlSafe } from "@/lib/link";
import { shareOrCopy } from "@/lib/share";
import { parseTrPrice } from "@/lib/validation";

import { categoryChipLabel } from "@/lib/categories";
import { listingCategoryPath } from "@/lib/category-match";
import { useCompare } from "@/lib/compare";
import { Accordion } from "@/components/accordion";
import { AgreementCard } from "@/components/agreement-card";
import { colors } from "@/components/colors";
import { RatingSummary } from "@/components/reviews/rating-summary";
import { SaleReviewForm } from "@/components/reviews/sale-review-form";
import { ReviewLoadMore } from "@/components/reviews/review-filters";
import { summarizeReviews, usePagedReviews } from "@/lib/reviews";
import { ReviewCard } from "@/components/review-card";
import { JsonLd } from "@/components/json-ld";
import { LegalDisclaimerCollapsible } from "@/components/legal-disclaimer";
import { ListingCard } from "@/components/listing-card";
import { ListingQA } from "@/components/listing-qa";
import { ShareRow } from "@/components/share-row";
import { tokenize } from "@/lib/search";
import { ImageWatermark } from "@/components/image-watermark";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { EmptyState, PressLink, PrimaryButton } from "@/components/ui";
import { OptionSheet } from "@/components/option-sheet";
import { ClampedText, CommissionSummary, DefinitionGrid, DetailMetaLine, DetailNotice, DetailSection, DetailSkeleton, FeatureChips, GalleryCounter, GalleryNavButtons, GalleryOverlayButton, ListingVideo, LocationRow, SafetyTips, SellerSummary, VideoBadge, VideoThumb, buildSummaryRows, detail, detailPriceFontSize, galleryHeightFor, isVideoUri, partnershipModeLabel, splitListingMedia } from "@/components/listing-detail/shared";
import { ErrorScreen } from "@/components/error-boundary";
import { commissionAmount, commissionText, listingInviteCode, moneyIn, partnerInviteUrl, productUrl, shareUrl, trPhoneIntl } from "@/lib/format";
import { categoryConversion } from "@/lib/conversion";
import { haptic } from "@/lib/haptics";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useContentWidth, useIsWideWeb } from "@/lib/layout";
import { WebContainer } from "@/components/web-container";
import { fetchListingById, fetchSellerPhone } from "@/lib/supabase-data";
import { insertReferralLead, logReferralClick, recordListingView, resolveReferralLink } from "@/lib/live-service";
import { trackListingEvent } from "@/lib/funnel";
import { getRefAttribution, saveRefAttribution } from "@/lib/referral";
import { metaTrack } from "@/lib/meta-pixel";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getRecent, pushRecent, subscribeRecent } from "@/lib/recent";
import { calculateUserTrustScores } from "@/lib/trust-score";
import type { LeadSource, Listing, User } from "@/lib/types";
import { useStore } from "@/lib/use-store";

export default function ListingDetailScreen() {
  const params = useLocalSearchParams<{ id: string; ref?: string; p?: string; "ortak-davet"?: string; apply?: string }>();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";
  // Ortak panelinden "başvur" derin-linki (?apply=1): başvuru formunu göze getir/odakla.
  const wantsApply = (Array.isArray(params.apply) ? params.apply[0] : params.apply) === "1";
  const inviteParam = Array.isArray(params["ortak-davet"]) ? params["ortak-davet"][0] : params["ortak-davet"];
  // Ortak referans kodu: ?ref= veya kısa ?p= (varsa). Landing dışı akışta da yakalanır.
  const refParam = (Array.isArray(params.ref) ? params.ref[0] : params.ref) || (Array.isArray(params.p) ? params.p[0] : params.p) || "";
  const { language } = useLanguage();
  const { width, height } = useWindowDimensions();
  const isWideWeb = useIsWideWeb();
  const contentWidth = useContentWidth();
  const insets = useSafeAreaInsets();
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
    buyerOfferAction,
    isUserBlocked
  } = useStore();
  const { has: hasInCompare, toggle: toggleCompare } = useCompare();
  const storeListing = findListing(id);
  // Sabit alt çubuğun ölçülen yüksekliği → içerik alt boşluğu (çubuk son bölümü örtmesin).
  const [barHeight, setBarHeight] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [remote, setRemote] = useState<{ listing: Listing; owner?: User } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(false); // ağ hatası (bulunamadı DEĞİL) → retry
  const [retryTick, setRetryTick] = useState(0);
  // Başvuru formu — gerçek kullanıcı girdisi (eski sabit/tohum metinler kaldırıldı).
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => { setRecentIds(getRecent()); return subscribeRecent(setRecentIds); }, [id]);
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  // İLANIN yorumları (herkese açık) — eskiden yalnız store'daki (giriş yapanın KENDİ) yorumu
  // gösteriliyordu; başkalarınınki hiç çekilmiyordu. Artık DB'den çekilir (middleware SEO ile aynı kapsam).
  // SAYFALI: 20'şer gelir ("Daha fazla değerlendirme göster" ekler); başlıktaki sayı ve özet TÜM
  // yorumlardan hesaplanır (eskiden tek istekte en fazla 100 yorum çekiliyordu).
  const localReviewCount = reviews.reduce((n, r) => (r.listingId === id ? n + 1 : n), 0);
  const reviewPager = usePagedReviews({ listingId: id ? String(id) : undefined }, { refreshKey: localReviewCount });
  const fetchedReviews = reviewPager.rows;
  const reloadReviews = reviewPager.reload;
  useEffect(() => { if (retryTick > 0) reloadReviews(); }, [retryTick, reloadReviews]);
  const [revealingPhone, setRevealingPhone] = useState(false);
  const mobileContactLock = useRef(false);
  const [message, setMessage] = useState("");
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
  const joinAnchorRef = useRef<ViewInstance>(null);
  const router = useRouter();

  // KRİTİK GİZLİLİK: web'de aynı /listing/[id] bileşeni ilanlar arası YENİDEN KULLANILIR
  // (benzer/son-gezilen/diğer-ilan tıklamasıyla, aynı instance). İlana-özel durumlar id
  // değişince SIFIRLANMAZSA önceki ilanın AÇILAN TELEFON NUMARASI sonraki ilanda görünür
  // (yanlış satıcı/gizlilik) + atıf-lead bir daha üretilmez. Her id değişiminde temizle.
  useEffect(() => {
    setRevealedPhone(null);
    setRevealingPhone(false);
    setActiveImage(0);
    setMessage("");
    contactLeadDone.current = false;
  }, [id]);

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
    // Tam ekran yalnız FOTOĞRAFLARI gezer (video satır içi oynar).
    const n = l ? splitListingMedia(listingMedia(l)).photos.length : 0;
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
    setFetchError(false);
    fetchListingById(id)
      .then((res) => {
        if (!active) return;
        // Ağ hatası → "bulunamadı" gösterme, retry sun. Gerçekten yoksa (null) remote=null.
        if (res && "error" in res) { setFetchError(true); setRemote(null); }
        else setRemote(res);
      })
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, [id, storeListing, retryTick]);

  const listing = storeListing ?? remote?.listing;

  // Son gezilen ilanları kaydet — "Son Gezdiklerin" için.
  useEffect(() => {
    if (listing?.id) {
      pushRecent(listing.id);
      // Y6: görüntülenme kaydı — owner-hariç, sunucuda günlük-dedup (şişirme-dirençli).
      void recordListingView(listing.id);
      // Huni sayacı (kimliksiz toplam): görüntüleme → düğmeye basma → giriş duvarı. Bkz. lib/funnel.ts.
      trackListingEvent(listing.id, "view");
      // Meta Pixel: ürün görüntüleme (reklam retargeting + ilgi sinyali). fbq yoksa no-op.
      metaTrack("ViewContent", {
        content_ids: [listing.id],
        content_type: "product",
        content_name: displayListingTitle(listing.title),
        content_category: listing.category,
        value: listing.price || 0,
        currency: "TRY"
      });
    }
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

  // PERF: benzer ilanlar TÜM katalog üzerinde tokenize+skorlama yapar; eskiden HER render'da
  // (ör. mesaj/teklif kutusuna her harf) yeniden hesaplanıyordu. useMemo + erken-return ÖNCESİ
  // (hook kuralı) + !listing guard → yalnız listing/listings değişince hesaplanır.
  const similarFinal = useMemo(() => {
    if (!listing) return [];
    const meTerms = new Set(tokenize(`${displayListingTitle(listing.title)} ${listing.tags.join(" ")}`));
    const meAttr = listing.attributes ?? {};
    const meM2 = Number(meAttr.grossM2 ?? meAttr.m2 ?? meAttr.netM2 ?? meAttr.totalGrossM2 ?? 0) || 0;
    const scored = listings
      .filter((item) => item.ownerId !== listing.ownerId && item.status === "active" && item.id !== listing.id)
      .map((item) => {
        const terms = tokenize(`${item.title} ${item.tags.join(" ")}`);
        let overlap = 0;
        for (const term of terms) if (meTerms.has(term)) overlap += 1;
        const sameCat = item.category === listing.category ? 2.5 : 0;
        const a = item.attributes ?? {};
        let attrScore = 0;
        if (listing.price > 0 && Math.abs(item.price - listing.price) / listing.price <= 0.25) attrScore += 2;
        if (meAttr.listingType && a.listingType === meAttr.listingType) attrScore += 1.5;
        if (meAttr.rooms && a.rooms === meAttr.rooms) attrScore += 1.5;
        if (listing.provinceId && item.provinceId === listing.provinceId) attrScore += 1;
        const itemM2 = Number(a.grossM2 ?? a.m2 ?? a.netM2 ?? a.totalGrossM2 ?? 0) || 0;
        if (meM2 > 0 && itemM2 > 0 && Math.abs(itemM2 - meM2) / meM2 <= 0.3) attrScore += 1;
        const pop = (item.leadCount + item.partnerCount) * 0.002;
        return { item, s: overlap * 1.2 + sameCat + attrScore + pop };
      })
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 8)
      .map((x) => x.item);
    return scored.length ? scored : listings.filter((item) => item.id !== listing.id && item.status === "active" && item.category === listing.category).slice(0, 8);
  }, [listing, listings]);

  // DB'den çekilen (herkesin) + store'daki (kendi, oturumda yeni yazılan) yorumlar birleşir (id ile tekilleştir).
  // KRİTİK: bu useMemo, aşağıdaki `if (!listing) return` ERKEN-RETURN'ünden ÖNCE çağrılmalı.
  // Eskiden return SONRASINDAYDI → paylaşılan/doğrudan ilan linkinde (ilan bellekte yok) render-1
  // erken-return alıp bu hook'u ATLIYOR, render-2'de ilan gelince çağırıyordu → hook sayısı
  // değişiyor → React #310 → error-boundary reload → "/" ana sayfaya bounce. `id` (route param)
  // kullanır (currentListing henüz tanımlı değil) — [[hooks-order]] Rules of Hooks.
  const listingReviews = useMemo(() => {
    const byId = new Map<string, (typeof fetchedReviews)[number]>();
    for (const r of fetchedReviews) byId.set(r.id, r);
    // DB'den az önce çekilen satır ESASTIR (satıcı yanıtı, yanıt tarihi, faydalı sayısı, yazar adı/
    // avatarı sunucuya aittir; ReviewCard bunları doğrudan sunucuya + onPatch ile fetchedReviews'a
    // yazar, store'a DEĞİL). Store kopyası hesap yüklenirken alınır; eskiden çekilen satırı eziyordu →
    // satıcının yazdığı yanıt ilan yeniden açılınca kayboluyor, düğme yine "Yanıtla" oluyordu.
    // Store'dan yalnız KENDİ yorumumun puan/metni alınır (oturumdaki iyimser düzenleme). Çekilen
    // listede olmayan store kaydı (oturumda yeni yazılan / çekim başarısız) olduğu gibi eklenir.
    for (const r of reviews) {
      if (r.listingId !== id) continue;
      const fetched = byId.get(r.id);
      if (!fetched) byId.set(r.id, r);
      else if (r.reviewerId === currentUser.id) byId.set(r.id, { ...fetched, rating: r.rating, comment: r.comment });
    }
    return [...byId.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [fetchedReviews, reviews, id, currentUser.id]);
  // Başlıktaki sayı + özet: TÜM yorumlardan (yalnız yüklenen sayfadan değil). Bu da erken-return'den ÖNCE.
  const { stats: pagerStats, total: pagerTotal, hasMore: pagerHasMore } = reviewPager;
  const listingReviewSummary = useMemo(() => summarizeReviews({ stats: pagerStats, total: pagerTotal, hasMore: pagerHasMore }, listingReviews), [pagerStats, pagerTotal, pagerHasMore, listingReviews]);

  // Galeri yüksekliği: dar ekranda görünür alanın %40'ını aşmaz; geniş ekranda sütuna oranlı.
  const shellWidth = Math.min(contentWidth, 1280);
  const galleryH = isWideWeb ? Math.max(320, Math.min(480, Math.round(((shellWidth - 60) * 1.12) / 2.12 * 0.72))) : galleryHeightFor(contentWidth, height);

  if (!listing) {
    if (fetching) {
      // İskelet, nihai düzenle aynı bloklar (galeri → başlık → fiyat → meta → özet).
      return (
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 32 }}>
          <DetailSkeleton wide={isWideWeb} galleryHeight={galleryH} />
        </ScrollView>
      );
    }
    // AĞ HATASI: "bulunamadı" (silinmiş gibi) DEĞİL → retry sun. Paylaşılan linkte geçici
    // ağ kesintisi ürünü "kaldırılmış" gösterip alıcıyı kaçırıyordu.
    if (fetchError) {
      return (
        <ErrorScreen
          title="İlan yüklenemedi"
          body="Bağlantın kesilmiş olabilir; ilan kaldırılmış değil. Yeniden dene."
          onRetry={() => setRetryTick((t) => t + 1)}
        />
      );
    }
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ alignItems: "center", flexGrow: 1, justifyContent: "center", padding: 24 }}>
        {/* Kaldırılmış/satılmış ilan referans/SEO trafiğinde ÖLÜ-UÇ olmasın → keşfet/ana sayfa
            kurtarma CTA'ları (ortak-linki tıklayan alıcı benzer ürünlere yönlenir). */}
        <View style={{ alignItems: "center", gap: 18, maxWidth: 440, width: "100%" }}>
          <EmptyState icon="tag-off-outline" title={translateCopy("İlan bulunamadı", language)} body={translateCopy("Bu ilan kaldırılmış, satılmış ya da bağlantı artık geçerli değil. Benzer ürünler için ilanları keşfedebilirsin.", language)} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            <PrimaryButton href="/explore" icon="storefront-outline">{translateCopy("İlanları keşfet", language)}</PrimaryButton>
            <PrimaryButton href="/" tone="secondary" icon="home-outline">{translateCopy("Ana sayfa", language)}</PrimaryButton>
          </View>
        </View>
      </ScrollView>
    );
  }

  const currentListing = listing;
  const currentTitle = displayListingTitle(currentListing.title);
  // "Sadece davetle" ilan: ortaklık yalnızca satıcının paylaştığı geçerli davet
  // linkiyle açılır. Geçerli kod URL'de varsa ziyaretçi anında (ön-onaylı) katılır.
  const isInviteMode = currentListing.partnershipMode === "invite";
  // NORMAL İLAN (ortak satışa kapalı): ortak-UI'sı (komisyon/Ortak Ol/kazanç) gösterilmez;
  // yalnız normal alıcı akışı (mesaj/iletişim/satın al) kalır.
  const partnerable = currentListing.partnershipMode !== "none";
  // TALEP İLANI: alıcı/yatırımcı "şunu arıyorum, bulana komisyon" der. publish _formKey="arayan".
  // Komisyon = BULUŞ ödülü (satan değil, bulan kazanır). Çerçeve buna göre değişir.
  const isDemand = currentListing.attributes?._formKey === "arayan";
  const validInvite = isInviteMode && !!inviteParam && inviteParam === listingInviteCode(currentListing);
  const flowPaths = listingFlowPaths(currentListing.id, validInvite ? inviteParam : undefined);
  const listingReturnPath = flowPaths.listing;
  // Medya: fotoğraflar + (varsa) TEK video. Video kapak olmaz, galeride daima SON öğedir.
  const media = splitListingMedia(listingMedia(currentListing));
  const gallery = media.photos;
  const mediaCount = media.count;
  const galleryIdx = Math.min(activeImage, Math.max(0, mediaCount - 1));
  const onVideo = !!media.video && galleryIdx === gallery.length;
  const photoIdx = Math.min(galleryIdx, Math.max(0, gallery.length - 1));
  const owner = findUser(currentListing.ownerId) ?? remote?.owner;
  const ownerTrust = owner ? calculateUserTrustScores({ leads, listings, partnerships, reports, reviews, sales, user: owner }).seller : undefined;
  const partnership = findPartnership(currentListing.id);
  const activeShareUrl = partnership?.status === "active" ? shareUrl(currentListing, partnership.refCode) : undefined;
  const isOwner = currentListing.ownerId === currentUser.id;
  const isReviewAuthed = backendMode === "supabase" && !!currentUser?.id && currentUser.id.includes("-");
  const isDemo = Boolean(currentListing.demo);
  // Bu ilandaki KENDİ son teklifim. Geri çekilen VE reddedilen hariç → "Teklif Ver" butonu
  // geri gelir (eskiden reddedilen teklif kartı "yeni teklif verebilirsin" diyordu ama BUTON
  // YOKTU → alıcı ölü-uçta kalıyordu). Reddedilen teklif geçmişi /offers ekranında durur.
  const myOffer = offers
    .filter((o) => o.listingId === currentListing.id && o.buyerId === currentUser.id && o.status !== "withdrawn" && o.status !== "rejected")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  function demoBlocked() {
    Alert.alert(translateCopy("Örnek ilan", language), translateCopy("Bu bir örnek (vitrin) ilandır; yalnızca platformun nasıl göründüğünü göstermek içindir. Mesajlaşma, iletişim ve ortaklık bu ilanda kapalıdır.", language));
  }
  const favorited = isFavorite(currentListing.id);
  const inCompare = hasInCompare(currentListing.id);
  const commission = commissionAmount(currentListing);
  // "Ortak Ol" butonu kapısı: zaten aktif/pending/engelli ortak ya da davetsiz-invite
  // değilse gösterilir. partnerable + non-owner + non-demo şart. Aksi halde yalnız
  // "Satın Al" (tam genişlik) çıkar.
  const joinAction = listingJoinAction({ listing: currentListing, status: partnership?.status, isOwner, hasInvite: validInvite, sellerBlocked: isUserBlocked(currentListing.ownerId) });
  const canJoinNow = joinAction.kind === "apply";
  // İlan MÜSAİT DEĞİLSE (satıldı/duraklatıldı/arşiv/süresi doldu/tükendi) satın alma/ortaklık/teklif
  // AKSİYONLARI kapatılır + üstte durum bandı. Feed status='active' filtreler ama doğrudan/referans/
  // favori/SEO/son-gezdiklerin linki HER statüye ulaşabiliyordu → müsait olmayan ilanda çalışan CTA'lar
  // (denetim bulgusu #1: en yüksek-niyetli referans trafiğinde güven hatası).
  const outOfStock = !isDemand && currentListing.status === "active" && currentListing.stockCount <= 0;
  const listingUnavailable = !isOwner && !isDemo && (currentListing.status !== "active" || outOfStock);
  const unavailableLabel =
    currentListing.status === "sold" ? translateCopy("Bu ürün satıldı", language)
    : outOfStock ? translateCopy("Tükendi", language)
    : currentListing.status === "paused" ? translateCopy("İlan şu an yayında değil (duraklatıldı)", language)
    : currentListing.status === "expired" ? translateCopy("İlanın süresi doldu", language)
    : currentListing.status === "archived" ? translateCopy("İlan yayından kaldırıldı", language)
    : currentListing.status === "pending_review" ? translateCopy("İlan incelemede — henüz yayında değil", language)
    : translateCopy("İlan şu an yayında değil", language);
  const reviewableSale = sales.find((sale) => sale.listingId === currentListing.id && canReviewSale(sale.id));
  const relatedCardWidth = Math.max(148, Math.min(176, Math.floor((width - 34) / 2)));
  const sellerOtherListings = listings
    .filter((item) => item.ownerId === currentListing.ownerId && item.id !== currentListing.id && item.status === "active")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  // Satıcı güven sinyalleri (Sahibinden tarzı): aktif ilan sayısı + tamamlanan satış.
  const sellerActiveCount = owner ? listings.filter((item) => item.ownerId === owner.id && item.status === "active").length : 0;
  // (Benzer ilanlar `similarFinal` yukarıda useMemo'landı — erken-return öncesi, tokenize+skorlama
  // artık her render değil.)
  // Son gezdiklerin (bu ilan hariç, aktif) — client-only localStorage.
  const recentViewed = recentIds
    .map((rid) => listings.find((l) => l.id === rid))
    .filter((l): l is Listing => Boolean(l) && l!.status === "active" && l!.id !== currentListing.id)
    .slice(0, 10);

  async function handleJoin() {
    if (isDemo) return demoBlocked();
    if (listingUnavailable) { Alert.alert(unavailableLabel, translateCopy("Bu ilan artık ortaklığa/satışa açık değil. Benzer ürünlere göz atabilirsin.", language)); return; }
    trackListingEvent(currentListing.id, "partner_click");
    // Anonim kullanıcı: alert'te tıkanmak yerine girişe yönlendir (dönüşte bu ilana gelir).
    if (!isAuthenticated) { trackListingEvent(currentListing.id, "auth_wall"); router.push({ pathname: "/auth", params: { redirect: listingReturnPath } }); return; }
    // FORM YOK: ortak ol'a basınca doğrudan başvuru gider (davetli/açık → anında aktif,
    // onaylı → pending). Satıcı, satıcı panelinden kabul/ret eder. Ekstra bilgi istenmez.
    const result = await joinListing(currentListing.id, {
      inviteCode: validInvite ? (inviteParam ?? "") : ""
    });
    if (!result) {
      haptic.warning();
      Alert.alert(translateCopy("İşlem yapılamadı", language), translateCopy(authError ?? "Kendi ilanına ortak olamazsın veya ilan aktif olmayabilir.", language));
      return;
    }
    haptic.success();
    showToast(translateCopy(result.status === "active" ? "Ortaklık aktif! Ürünü tanıtmaya başlayabilirsin." : "Talep gönderildi — satıcı onaylayınca ortak olursun.", language));
  }

  async function handleShare() {
    trackListingEvent(currentListing.id, "share");
    // MODEL: referans/takip YOK → her zaman DÜZ ürün sayfası linki paylaşılır.
    const url = productUrl(currentListing);
    const r = await shareOrCopy({ title: currentTitle, message: `${currentTitle}\n${moneyIn(currentListing.price, currentListing.currency)}\n${url}`, url });
    if (r === "copied") showToast(translateCopy("Bağlantı kopyalandı", language));
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

  function contactAllowed() {
    if (isDemo) { demoBlocked(); return false; }
    if (isOwner || isUserBlocked(currentListing.ownerId)) { showToast("Bu satıcıyla iletişim başlatılamıyor."); return false; }
    if (listingUnavailable) { Alert.alert(unavailableLabel, translateCopy("Bu ilan artık satışa açık değil. Benzer ürünlere göz atabilirsin.", language)); return false; }
    trackListingEvent(currentListing.id, "contact_click");
    if (!isAuthenticated) { trackListingEvent(currentListing.id, "auth_wall"); router.push({ pathname: "/auth", params: { redirect: listingReturnPath } }); return false; }
    return true;
  }

  async function handleContact() {
    if (mobileContactLock.current || !contactAllowed()) return;
    mobileContactLock.current = true; setRevealingPhone(true);
    try {
      if (currentListing.contactMethod !== "message") {
        const sellerPhone = owner?.phone || await fetchSellerPhone(currentListing.ownerId, true);
        if (sellerPhone) {
          const whatsapp = currentListing.contactMethod === "whatsapp";
          const phone = whatsapp ? trPhoneIntl(sellerPhone) : sellerPhone.replace(/[^0-9+]/g, "");
          if (phone) {
            const url = whatsapp ? `https://wa.me/${phone}?text=${encodeURIComponent(`${currentTitle} ilanı hakkında bilgi almak istiyorum.`)}` : `tel:${phone}`;
            if (await openUrlSafe(url)) { attributeReferralLead(whatsapp ? "whatsapp" : "phone"); return; }
          }
        }
        showToast("Telefonla iletişim açılamadı. Uygulama içi mesajla devam ediliyor.");
      }
      const fallbackMessage = `${currentTitle} ilanı için bilgi almak istiyorum. Fiyat, stok ve teslimat detayları güncel mi?`;
      const conversation = startConversation(currentListing.id, currentListing.ownerId, message.trim() || fallbackMessage, currentListing);
      if (conversation) { attributeReferralLead("web"); setMessage(""); router.push({ pathname: "/chat/[id]", params: { id: conversation.id } }); }
      else Alert.alert(translateCopy("Mesaj başlatılamadı", language), translateCopy("Şu an mesaj gönderilemedi. Lütfen tekrar dene.", language));
    } catch { showToast("İletişim bilgisi alınamadı. Tekrar dene; yazdığın mesaj korunuyor."); }
    finally { mobileContactLock.current = false; setRevealingPhone(false); }
  }

  async function revealPhone() {
    if (mobileContactLock.current || currentListing.contactMethod === "message" || !contactAllowed()) return;
    mobileContactLock.current = true; setRevealingPhone(true);
    try {
      const phone = owner?.phone || await fetchSellerPhone(currentListing.ownerId, true);
      if (!phone) { showToast("Satıcının paylaşılmış telefon numarası yok. Mesaj gönderebilirsin."); return; }
      attributeReferralLead("phone"); setRevealedPhone(phone);
    } catch { showToast("Telefon bilgisi alınamadı. Tekrar deneyebilirsin."); }
    finally { mobileContactLock.current = false; setRevealingPhone(false); }
  }

  async function submitReport() {
    if (!reportReason) { Alert.alert(translateCopy("Sebep seç", language), translateCopy("Lütfen bir şikayet nedeni seç.", language)); return; }
    const details = `${currentTitle} — ${reportReason}${reportDetail.trim() ? ` · ${reportDetail.trim()}` : ""}`;
    const ok = await reportListing(currentListing.id, reportReason, details);
    setReportOpen(false); setReportReason(""); setReportDetail("");
    if (ok) showToast(translateCopy("Bildirim alındı — moderasyon inceleyecek", language));
    else Alert.alert(translateCopy("Giriş gerekli", language), translateCopy("İlan bildirmek için e-posta ile giriş yapmalısın.", language));
  }

  const metaDesc = `${currentTitle} — ${moneyIn(currentListing.price, currentListing.currency)}. ${currentListing.description}`.replace(/\s+/g, " ").slice(0, 160);
  const metaUrl = `https://www.ortaksat.com/listing/${currentListing.id}`;
  // Sosyal paylaşımda kazanç kancası — ortak linki paylaşınca önizlemede görünür.
  const ogTitle = partnerable
    ? `${currentTitle} — ${moneyIn(currentListing.price, currentListing.currency)} · Ortak ol, ${commissionText(currentListing)} kazan | OrtakSat`
    : `${currentTitle} — ${moneyIn(currentListing.price, currentListing.currency)} | OrtakSat`;
  const ogDesc = partnerable
    ? `${moneyIn(currentListing.price, currentListing.currency)} · ${commissionText(currentListing)}. Bu ürünü kendi yönteminle tanıt, satışta komisyon kazan. OrtakSat aracıdır; ödeme ve teslimat taraflar arasındadır.`
    : `${moneyIn(currentListing.price, currentListing.currency)} · ${currentListing.category}. Satıcıyla iletişime geç, güvenle satın al. OrtakSat aracıdır; ödeme ve teslimat taraflar arasındadır.`;
  // JSON-LD Product şeması — Google zengin sonuç (fiyat, stok, kategori) için.
  // aggregateRating YALNIZCA gerçek (demo değil) ve gerçekten yorumu olan ilanlara
  // eklenir — sahte yıldız Google politikasını ve "sahte veri yasağı"nı ihlal eder.
  const productLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: currentTitle,
    image: [currentListing.image, ...(currentListing.adAssets ?? [])].filter((u) => Boolean(u) && !isVideoUri(String(u))).slice(0, 5),
    description: metaDesc,
    category: currentListing.category,
    // aggregateRating + review: YALNIZCA gerçek (demo değil) ilan yorumları varsa. Sahte
    // yıldız Google politikasını ve sahte-veri yasağını ihlal eder. Gerçek yorum gelince
    // otomatik yıldızlı zengin sonuç çıkar. Puan, ilanın GERÇEK yorumlarından hesaplanır.
    ...(() => {
      if (isDemo) return {};
      const rated = listingReviews.filter((r) => r.rating >= 1 && r.rating <= 5);
      if (rated.length === 0) return {};
      // Yorumlar sayfalı yüklenir: sayı ve ortalama, yüklenen sayfadan değil TÜM yorumların özetinden gelir.
      const all = listingReviewSummary.stats;
      const avg = all && all.count >= rated.length ? all.average : rated.reduce((s, r) => s + r.rating, 0) / rated.length;
      const reviewCount = all && all.count >= rated.length ? all.count : rated.length;
      const withText = rated.filter((r) => r.comment && r.comment.trim()).slice(0, 3);
      return {
        aggregateRating: { "@type": "AggregateRating", ratingValue: Number(avg.toFixed(1)), reviewCount, bestRating: 5, worstRating: 1 },
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
      // Google "Satıcı girişleri" (merchant listing) uygunluğu: fiyat geçerlilik + iade politikası.
      priceValidUntil: new Date(Date.now() + 31536000000).toISOString().slice(0, 10),
      url: metaUrl,
      ...(owner ? { seller: { "@type": "Person", name: owner.name } } : {}),
      // hasMerchantReturnPolicy: ilanın GERÇEK iade süresinden (returnWindowDays, alıcıya "İade: N gün"
      // olarak zaten gösterilir). İade masrafı legal'e göre alıcı sorumluluğunda; platform kargo yapmaz.
      hasMerchantReturnPolicy:
        (currentListing.returnWindowDays ?? 0) > 0
          ? {
              "@type": "MerchantReturnPolicy",
              applicableCountry: "TR",
              returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
              merchantReturnDays: currentListing.returnWindowDays,
              returnMethod: "https://schema.org/ReturnByMail",
              returnFees: "https://schema.org/ReturnFeesCustomerResponsibility"
            }
          : {
              "@type": "MerchantReturnPolicy",
              applicableCountry: "TR",
              returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted"
            }
    }
  });

  // KATEGORİ İZİ: Ana Sayfa › kök › … › yaprak. İlanın KAYITLI yolundan (attributes._path) çözülür.
  // Eskiden yalnız yaprak etiketi vardı ("Ana Sayfa › Bosch") ve bağlantı etiketin ağaçtaki İLK
  // eşleşmesine gidiyordu (bulaşık makinesi ilanı → Buzdolabı › Bosch sayfası). Kod ağacından saf
  // hesap (hook değil) → statik çıktı ile ilk istemci render'ı aynıdır.
  const categoryCrumbs = listingCategoryPath(currentListing).map((n) => ({ slug: n.slug, name: n.label, label: categoryChipLabel(n.label) }));
  // BreadcrumbList — görünür iz ile AYNI öğeler (+ son öğe: ilanın kendisi), mutlak URL'lerle. Ad olarak
  // kategorinin TAM adı yazılır (görünür izde uzun kök adı kısalır); middleware.ts crawler çıktısıyla aynı.
  const breadcrumbLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: "Ana Sayfa", item: "https://www.ortaksat.com/" },
      ...categoryCrumbs.map((c) => ({ name: c.name, item: `https://www.ortaksat.com/kategori/${c.slug}` })),
      { name: currentTitle, item: metaUrl }
    ].map((entry, i) => ({ "@type": "ListItem", position: i + 1, ...entry }))
  });

  // Mobil sabit alt aksiyon çubuğu görünürse içerik onun arkasına gizlenmesin diye ekstra alt boşluk.
  if (isMobileApp) return <MobileListingDetail listing={currentListing} owner={owner} favorite={favorited} onFavorite={() => toggleFavorite(currentListing.id)} onShare={() => void handleShare()} isOwner={isOwner} unavailable={listingUnavailable ? unavailableLabel : undefined} partnershipStatus={partnership?.status} joinAction={joinAction} contactBusy={revealingPhone} sellerBlocked={isUserBlocked(currentListing.ownerId)}
    onMessage={() => {
      if (isDemo) { demoBlocked(); return; }
      trackListingEvent(currentListing.id, "contact_click");
      if (!isAuthenticated) { trackListingEvent(currentListing.id, "auth_wall"); router.push({ pathname: "/auth", params: { redirect: listingReturnPath } }); return; }
      if (listingUnavailable || isUserBlocked(currentListing.ownerId)) return;
      attributeReferralLead("web");
      const conversation = startConversation(currentListing.id, currentListing.ownerId, "", currentListing);
      if (conversation) router.push(`/chat/${conversation.id}` as never);
      else showToast("Mesaj başlatılamadı. Lütfen tekrar dene.");
    }}
    onCall={() => { void (async () => {
      if (mobileContactLock.current) return;
      if (isDemo) { demoBlocked(); return; }
      trackListingEvent(currentListing.id, "contact_click");
      if (!isAuthenticated) { trackListingEvent(currentListing.id, "auth_wall"); router.push({ pathname: "/auth", params: { redirect: listingReturnPath } }); return; }
      if (listingUnavailable || isUserBlocked(currentListing.ownerId) || currentListing.contactMethod === "message") return;
      mobileContactLock.current = true; setRevealingPhone(true);
      try {
        const phone = owner?.phone || await fetchSellerPhone(currentListing.ownerId, true);
        if (!phone) { showToast("Satıcının paylaşılmış telefon numarası yok. Mesaj gönderebilirsin."); return; }
        const whatsapp = currentListing.contactMethod === "whatsapp";
        const normalized = whatsapp ? trPhoneIntl(phone) : phone.replace(/[^0-9+]/g, "");
        if (!normalized) { showToast("Telefon numarası kullanılamıyor. Mesaj gönderebilirsin."); return; }
        attributeReferralLead(whatsapp ? "whatsapp" : "phone");
        const url = whatsapp ? `https://wa.me/${normalized}?text=${encodeURIComponent(`${currentTitle} ilanı hakkında bilgi almak istiyorum.`)}` : `tel:${normalized}`;
        if (!await openUrlSafe(url)) showToast("İletişim uygulaması açılamadı. Mesaj gönderebilirsin.");
      } catch { showToast("Telefon bilgisi alınamadı. Tekrar deneyebilir veya mesaj gönderebilirsin."); }
      finally { mobileContactLock.current = false; setRevealingPhone(false); }
    })(); }}
    onJoin={() => {
      if (isDemo) { demoBlocked(); return; }
      if (joinAction.kind === "view" && partnership) { router.push(`/partnership/${partnership.id}` as never); return; }
      if (listingUnavailable || !canJoinNow) { showToast("Bu ilana şu anda ortaklık talebi gönderilemiyor."); return; }
      if (!isAuthenticated) {
        router.push({ pathname: "/auth", params: { redirect: flowPaths.request } }); return;
      }
      router.push({ pathname: "/partnership-request/[id]", params: { id: currentListing.id, ...(validInvite ? { invite: inviteParam } : {}) } } as never);
    }}
    onReport={(reason) => { void reportListing(currentListing.id, reason, `${currentTitle} — ${reason}`).then((ok) => showToast(ok ? "Bildirimin alındı." : "İlan bildirmek için giriş yapmalısın.")); }} />;

  const showMobileActionBar = !isWideWeb && !isDemo && !listingUnavailable;
  // 360px altında çubuk tek satır kalsın: "Mesaj gönder" → "Mesaj".
  const barContactLabel = currentListing.contactMethod === "message" ? (contentWidth < 360 ? "Mesaj" : "Mesaj gönder") : currentListing.contactMethod === "phone" ? (contentWidth < 360 ? "Ara" : "Satıcıyı ara") : "WhatsApp";
  const moreCompareLabel = translateCopy(inCompare ? "Karşılaştırmadan çıkar" : "Karşılaştır", language);
  const moreReportLabel = translateCopy("İlanı bildir", language);
  const moreOptions = [...(!isDemo ? [moreCompareLabel] : []), ...(!isOwner ? [moreReportLabel] : [])];
  const contactDisabled = revealingPhone || isOwner || isUserBlocked(currentListing.ownerId);
  const priceLabel = moneyIn(currentListing.price, currentListing.currency);
  // Fiyat hiçbir genişlikte taşmaz: sütunun iç genişliğine göre punto küçülür (kart fiyatıyla aynı yaklaşım).
  const headInnerWidth = (isWideWeb ? Math.floor((shellWidth - 60) / 2.12) : contentWidth - detail.gutter * 2) - detail.pad * 2 - 2;
  const priceSize = detailPriceFontSize(priceLabel, headInnerWidth, isWideWeb ? 34 : 30);
  const summary = buildSummaryRows(currentListing, language);
  const imgAlt = `${currentTitle}${currentListing.category ? ` — ${currentListing.category}` : ""}${currentListing.location ? `, ${currentListing.location}` : ""} · OrtakSat ortak satış ilanı`;
  const urgentUntil = currentListing.attributes?._urgentUntil ? Date.parse(String(currentListing.attributes._urgentUntil)) : 0;
  const urgentDaysLeft = urgentUntil && urgentUntil > Date.now() ? Math.max(1, Math.ceil((urgentUntil - Date.now()) / 86400000)) : 0;
  // Görünür iz TEK SATIR: dar ekranda ORTA kategoriler "…" olur (… en yakın gizli üst kategoriye gider) ve
  // ürün başlığı yazılmaz (hemen altındaki başlık kartında var); geniş ekranda tam iz + başlık.
  // Ağaçta yeri bulunamayan ilanda (yönetici-eklentisi kategori) etiket "Kategoriler"e bağlanır.
  const crumbHref = (slug: string) => ({ pathname: "/kategori/[slug]", params: { slug } }) as unknown as Href;
  const fallbackCrumb = !categoryCrumbs.length && currentListing.category ? { key: "category", label: currentListing.category, href: "/kategoriler" as Href, collapsed: "" } : null;
  const collapsedCrumbs = !isWideWeb && categoryCrumbs.length > 2 ? categoryCrumbs.slice(1, -1) : [];
  const shownCrumbs = fallbackCrumb ? [fallbackCrumb] : categoryCrumbs.flatMap((c) => {
    const hidden = collapsedCrumbs.includes(c);
    if (hidden && c !== collapsedCrumbs[collapsedCrumbs.length - 1]) return [];
    return [{ key: c.slug, label: c.label, href: crumbHref(c.slug), collapsed: hidden ? collapsedCrumbs.map((x) => translateCopy(x.label, language)).join(" › ") : "" }];
  });
  const crumbShowsTitle = isWideWeb || shownCrumbs.length < 2;
  const goToMedia = (i: number) => setActiveImage(Math.max(0, Math.min(mediaCount - 1, i)));
  const swipeHandlers = {
    onTouchStart: (e: unknown) => { swipeStartX.current = touchPageX(e); inlineSwiped.current = false; },
    onTouchEnd: (e: unknown) => {
      const dx = touchPageX(e) - swipeStartX.current;
      if (Math.abs(dx) > 45 && mediaCount > 1) {
        inlineSwiped.current = true;
        setActiveImage((dx < 0 ? galleryIdx + 1 : galleryIdx - 1 + mediaCount) % mediaCount);
      }
    }
  };

  // ---- GALERİ (dar: tam genişlik + fotoğraf üstü küçük düğmeler; geniş: küçük resimler) ----
  const galleryBlock = (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: isWideWeb ? detail.radius : 0, borderWidth: isWideWeb ? 1 : 0, overflow: "hidden" }}>
      <View style={{ backgroundColor: colors.neutralSoft, height: galleryH, position: "relative" }}>
        {onVideo && media.video ? (
          /* Video öğesinde kaydırma DİNLENMEZ: zaman çubuğunu sürükleyen dokunuş (≥45px yatay)
             galeri kaydırması sayılıp videoyu ortasında kapatıyordu. Gezinme: önceki/sonraki düğmeleri. */
          <View style={{ height: galleryH, width: "100%" }}>
            <ListingVideo uri={media.video} active={!lightbox} style={{ height: galleryH, width: "100%" }} />
          </View>
        ) : (
          <Pressable
            testID="listing-web-gallery"
            disabled={!gallery.length}
            accessibilityState={{ disabled: !gallery.length }}
            accessibilityRole="imagebutton"
            accessibilityLabel={translateCopy(gallery.length ? "Görseli büyüt" : "İlan fotoğrafı bulunmuyor", language)}
            onPress={() => { if (inlineSwiped.current) { inlineSwiped.current = false; return; } setLightbox(true); }}
            {...swipeHandlers}
            style={{ height: galleryH, position: "relative" }}
          >
            {/* LCP: ilan detayının kahraman görseli → yüksek öncelik + fade/scrim yok
                (SafeRemoteImage priority="high" ile eager). */}
            {gallery.length ? <SafeRemoteImage full uri={gallery[photoIdx] ?? currentListing.image} alt={imgAlt} accessibilityLabel={imgAlt} priority="high" style={{ backgroundColor: colors.line, height: galleryH, width: "100%" }} contentFit="cover" /> : <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, gap: 10, height: galleryH, justifyContent: "center" }}><MaterialCommunityIcons name="image-off-outline" size={40} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 13 }}>{translateCopy("Bu ilanda fotoğraf yok", language)}</Text></View>}
            {/* Kaynak filigranı — dosyaya gömülmez, yalnız görüntüleme katmanı (ürün bozulmaz). */}
            {!!gallery.length && <ImageWatermark size={isWideWeb ? 20 : 15} />}
          </Pressable>
        )}
        {mediaCount > 0 ? (
          <View style={{ left: 10, position: "absolute", top: 10 }}>
            <GalleryCounter testID="listing-web-counter" index={galleryIdx} total={mediaCount} video={onVideo} />
          </View>
        ) : null}
        {/* Dar ekran: favori / paylaş / diğer — fotoğraf üstünde küçük düğmeler (40px dokunma). */}
        {!isWideWeb ? (
          <View testID="listing-gallery-tools" style={{ flexDirection: "row", gap: 2, position: "absolute", right: 6, top: 4 }}>
            <GalleryOverlayButton testID="listing-fav-button" icon={favorited ? "heart" : "heart-outline"} active={favorited} label={translateCopy("Beğen", language)} onPress={() => toggleFavorite(currentListing.id)} />
            <GalleryOverlayButton icon="share-variant-outline" label={translateCopy("Paylaş", language)} onPress={() => void handleShare()} />
            {moreOptions.length ? <GalleryOverlayButton testID="listing-more-button" icon="dots-horizontal" label={translateCopy("Diğer işlemler", language)} onPress={() => setMoreOpen(true)} /> : null}
          </View>
        ) : null}
        {/* Dar ekran: nokta göstergesi (kaydırma ipucu) — video öğesinde yerel kontrollerle çakışmasın. */}
        {!isWideWeb && mediaCount > 1 && mediaCount <= 8 && !onVideo ? (
          <View style={{ alignItems: "center", bottom: 4, flexDirection: "row", justifyContent: "center", left: 60, position: "absolute", right: 60 }}>
            {Array.from({ length: mediaCount }, (_, i) => (
              <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${i + 1}. ${translateCopy("görsele git", language)}`} onPress={() => goToMedia(i)} style={{ alignItems: "center", height: 32, justifyContent: "center", paddingHorizontal: 6 }}>
                <View style={{ backgroundColor: i === galleryIdx ? "#FFFFFF" : "rgba(255,255,255,0.55)", borderRadius: 999, height: 6, width: i === galleryIdx ? 16 : 6 }} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {/* Dar ekran: noktaların OLMADIĞI durumlarda (video öğesi / 8'den fazla medya) önceki-sonraki
            düğmeleri — fare ve klavyeyle de çıkış yolu (eskiden video öğesinden yalnız dokunmatik
            kaydırmayla dönülebiliyordu; <1024px masaüstü penceresinde kullanıcı videoda kalıyordu). */}
        {!isWideWeb && mediaCount > 1 && (onVideo || mediaCount > 8) ? (
          <GalleryNavButtons top={Math.round(galleryH / 2) - 20} onPrev={() => goToMedia((galleryIdx - 1 + mediaCount) % mediaCount)} onNext={() => goToMedia((galleryIdx + 1) % mediaCount)} />
        ) : null}
        {media.video && !onVideo ? (
          <View style={{ bottom: 2, position: "absolute", right: 8 }}>
            <VideoBadge onPress={() => goToMedia(mediaCount - 1)} />
          </View>
        ) : null}
      </View>
      {isWideWeb && mediaCount > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, paddingTop: 12 }}>
          {gallery.map((img, i) => (
            <Pressable key={img + i} testID="listing-gallery-thumb" accessibilityRole="button" accessibilityLabel={`${i + 1}. ${translateCopy("görsele git", language)}`} accessibilityState={{ selected: i === galleryIdx }} onPress={() => goToMedia(i)} style={{ borderColor: i === galleryIdx ? colors.primary : colors.line, borderRadius: 8, borderWidth: 2, height: 60, overflow: "hidden", width: 60 }}>
              <SafeRemoteImage uri={img} alt={`${imgAlt} — görsel ${i + 1}`} accessibilityLabel={`${imgAlt} — görsel ${i + 1}`} style={{ height: "100%", width: "100%" }} contentFit="cover" />
            </Pressable>
          ))}
          {media.video ? (
            <Pressable testID="listing-gallery-thumb" accessibilityRole="button" accessibilityLabel={translateCopy("Videoyu göster", language)} accessibilityState={{ selected: onVideo }} onPress={() => goToMedia(mediaCount - 1)} style={{ borderColor: onVideo ? colors.primary : colors.line, borderRadius: 8, borderWidth: 2, height: 60, overflow: "hidden", width: 60 }}>
              <VideoThumb size={56} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {/* Geniş ekran: sessiz ikincil satır (dört büyük düğme yerine metin bağlantıları). */}
      {isWideWeb ? (
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 8, paddingVertical: 6 }}>
          <QuietAction active={favorited} icon={favorited ? "heart" : "heart-outline"} label="Beğen" onPress={() => toggleFavorite(currentListing.id)} />
          {!isDemo ? <QuietAction active={inCompare} icon={inCompare ? "compare-remove" : "compare-horizontal"} label="Karşılaştır" onPress={() => toggleCompare(currentListing.id)} /> : null}
          <QuietAction icon="share-variant-outline" label="Paylaş" onPress={() => void handleShare()} />
          <View style={{ flex: 1 }} />
          {!isOwner ? <QuietAction icon="flag-outline" label="Bildir" onPress={() => setReportOpen(true)} /> : null}
        </View>
      ) : null}
    </View>
  );

  // ---- ORTAKLIK DURUMU (başvuru / davet / aktif) — talep ve normal ilanda aynı görünüm ----
  const partnerStatus = partnership?.status === "active" ? (
    <View style={{ backgroundColor: colors.primarySoft, borderRadius: 10, gap: 9, padding: 12 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
        <MaterialCommunityIcons name="check-decagram" size={17} color={colors.primary} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "800" }}>{translateCopy("Ortaksın · ürünü kendi yönteminle tanıt", language)}</Text>
      </View>
      {activeShareUrl ? <ShareRow url={activeShareUrl} text={`${currentTitle} — ${priceLabel}`} /> : null}
      {partnership?.agreedAt ? (
        <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
          <MaterialCommunityIcons name="lock-check" size={13} color={colors.muted} />
          <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{translateCopy("Komisyon şartların ortak olduğun anda kilitlendi — satıcı ilanı düzenlese de değişmez.", language)}</Text>
        </View>
      ) : null}
    </View>
  ) : partnership?.status === "pending" ? (
    <DetailNotice icon="clock-outline" tone="pending" title={translateCopy("Başvurun satıcı onayında.", language)} />
  ) : isInviteMode && !validInvite ? (
    isDemand ? (
      <View style={{ gap: 8 }}>
        <DetailNotice icon="email-lock-outline" tone="neutral" title={translateCopy("Ortaklık sadece davetle", language)} body={translateCopy("Bu ürünün ortaklığı herkese açık değil. Ortak olmak istiyorsan satıcıdan davet linki iste; linkle geldiğinde anında ortak olabilirsin.", language)} />
        <PrimaryButton tone="secondary" icon="message-text-outline" disabled={contactDisabled} onPress={() => void handleContact()}>{translateCopy("Satıcıdan davet iste", language)}</PrimaryButton>
      </View>
    ) : (
      <DetailNotice icon="email-lock-outline" tone="neutral" title={translateCopy("Ortaklık sadece davetle — satıcıdan davet linki iste.", language)} />
    )
  ) : validInvite ? (
    <DetailNotice icon="ticket-confirmation-outline" tone="info" title={translateCopy("Satıcı seni davet etti — anında ortak olabilirsin.", language)} />
  ) : partnerable && currentListing.partnershipMode !== "open" && canJoinNow ? (
    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "500", lineHeight: 17 }}>{translateCopy("Başvurunu gönder; satıcı kabul ederse anında ortak olursun. Ekstra bilgi doldurmana gerek yok.", language)}</Text>
  ) : null;

  // ---- AKSİYONLAR: tek birincil CTA. Dar ekranda birincil düğmeler sabit alt çubuktadır. ----
  const actionsBlock = (
    <View style={{ gap: 10 }}>
      {/* Durum-duyarlı ana aksiyon (apply=1 ile buraya kaydırılır) */}
      <View ref={joinAnchorRef} />
      {isOwner ? (
        /* SAHİP GÖRÜNÜMÜ: satın al/ortak ol yerine düzenle + yönetim kısayolları. */
        <View testID="listing-owner-actions" style={{ gap: 8 }}>
          {!showMobileActionBar ? <PrimaryButton href={{ pathname: "/listing-edit/[id]", params: { id: currentListing.id } }} icon="pencil-outline">{translateCopy("İlanı Düzenle", language)}</PrimaryButton> : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, minWidth: 0 }}><PrimaryButton href={{ pathname: "/listing-stats/[id]", params: { id: currentListing.id } }} tone="secondary" icon="chart-box-outline">{translateCopy("İstatistikler", language)}</PrimaryButton></View>
            <View style={{ flex: 1, minWidth: 0 }}><PrimaryButton href="/(tabs)/seller" tone="secondary" icon="storefront-outline">{translateCopy("Satıcı paneli", language)}</PrimaryButton></View>
          </View>
          {isInviteMode ? (
            <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 8, paddingTop: 10 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                <MaterialCommunityIcons name="ticket-account" size={16} color={colors.primary} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "800" }}>{translateCopy("Ortak davet linki", language)}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "500", lineHeight: 17 }}>{translateCopy("Bu ilan sadece davetle. Aşağıdaki linki güvendiğin ortaklarla paylaş; linkle gelen kişi anında (ön-onaylı) ortak olur.", language)}</Text>
              <ShareRow url={partnerInviteUrl(currentListing)} text={`${currentTitle} — ${translateCopy("ortak daveti", language)}`} />
            </View>
          ) : null}
        </View>
      ) : isDemo ? null : (
        <>
          {partnerStatus}
          {isDemand ? (
            /* TALEP (arayan): Satın Al yok; ortak-ol / başvuru akışı korunur. */
            partnership?.status === "active" || partnership?.status === "pending" || (isInviteMode && !validInvite) || (showMobileActionBar && canJoinNow) ? null : (
              <PrimaryButton icon="handshake-outline" onPress={handleJoin}>{translateCopy(currentListing.partnershipMode === "open" || validInvite ? "Hemen Ortak Ol ve Kazan" : "Ortaklık Başvurusu Gönder", language)}</PrimaryButton>
            )
          ) : !showMobileActionBar ? (
            /* Aksiyon: partnerable + katılabilir → [İletişim | Ortak Ol]; aksi halde tek iletişim düğmesi. */
            canJoinNow ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <PrimaryButton tone="secondary" icon="message-text-outline" disabled={contactDisabled} onPress={() => void handleContact()}>{translateCopy(contactLabel(currentListing.contactMethod), language)}</PrimaryButton>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <PrimaryButton icon="handshake" onPress={handleJoin}>{translateCopy("Ortak Ol", language)}</PrimaryButton>
                </View>
              </View>
            ) : (
              <PrimaryButton icon="message-text-outline" disabled={contactDisabled} onPress={() => void handleContact()}>{translateCopy(contactLabel(currentListing.contactMethod), language)}</PrimaryButton>
            )
          ) : null}

          {/* TEKLİF: talep (arayan) ilanında gösterilmez (satılık ürün yok). */}
          {isDemand ? null : myOffer ? (
            <View style={{ backgroundColor: myOffer.status === "accepted" ? colors.successSoft : colors.goldSoft, borderRadius: 10, gap: 4, padding: 12 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                <MaterialCommunityIcons name="handshake" size={16} color={myOffer.status === "accepted" ? colors.success : colors.goldInk} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontVariant: ["tabular-nums"], fontWeight: "800" }}>
                  {translateCopy("Teklifin", language)}: {moneyIn(myOffer.amount, currentListing.currency)}
                </Text>
              </View>
              <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "500", lineHeight: 17 }}>
                {myOffer.status === "pending" ? translateCopy("Satıcının yanıtı bekleniyor.", language)
                  : myOffer.status === "accepted" ? translateCopy("KABUL EDİLDİ — satıcıyla mesajlaşarak teslimatı ayarla.", language)
                  : myOffer.status === "rejected" ? translateCopy("Kabul edilmedi. Yeni bir teklif verebilirsin.", language)
                  : myOffer.status === "countered" ? `${translateCopy("Satıcı karşı teklif verdi", language)}: ${moneyIn(myOffer.counterAmount ?? 0, currentListing.currency)}`
                  : translateCopy("Geri çekildi.", language)}
              </Text>
              {myOffer.status === "pending" ? (
                <Pressable onPress={() => void buyerOfferAction(myOffer.id, "withdrawn")} accessibilityRole="button" style={{ alignSelf: "flex-start", justifyContent: "center", minHeight: 40 }}>
                  <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Teklifi geri çek", language)}</Text>
                </Pressable>
              ) : null}
              {/* Satıcı karşı teklif verdiyse alıcı yanıtlayabilmeli — yoksa akış burada tıkanıyordu. */}
              {myOffer.status === "countered" ? (
                <View style={{ flexDirection: "row", gap: 8, paddingTop: 4 }}>
                  <Pressable accessibilityRole="button" testID="offer-accept-counter" onPress={() => void buyerOfferAction(myOffer.id, "accept_counter")} style={{ alignItems: "center", backgroundColor: colors.primaryDark, borderRadius: 8, flexDirection: "row", gap: 6, minHeight: 40, paddingHorizontal: 14 }}>
                    <MaterialCommunityIcons name="check" size={15} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Kabul Et", language)}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" testID="offer-reject-counter" onPress={() => void buyerOfferAction(myOffer.id, "reject_counter")} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 40, paddingHorizontal: 14 }}>
                    <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>{translateCopy("Reddet", language)}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* İkincil işlemler tek satırda: Teklif Ver · Numarayı Göster (ya da talep ilanında iletişim). */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            {!isDemand && !myOffer ? (
              <View style={{ flex: 1, minWidth: 0 }}>
                <PrimaryButton tone="secondary" icon="handshake-outline" onPress={() => { if (listingUnavailable) { Alert.alert(unavailableLabel, translateCopy("Bu ilan artık satışa açık değil.", language)); return; } if (!isAuthenticated) { router.push({ pathname: "/auth", params: { redirect: listingReturnPath } }); return; } setOfferAmount(""); setOfferNote(""); setOfferErr(null); setOfferOpen(true); }}>{translateCopy("Teklif Ver", language)}</PrimaryButton>
              </View>
            ) : null}
            {/* Talep (arayan) ilanında ayrı iletişim düğmesi (Satın Al yok). */}
            {isDemand ? (
              <View style={{ flex: 1, minWidth: 0 }}>
                <PrimaryButton tone="secondary" icon={currentListing.contactMethod === "whatsapp" ? "whatsapp" : currentListing.contactMethod === "phone" ? "phone" : "message-text-outline"} disabled={contactDisabled} onPress={() => void handleContact()}>{translateCopy(contactLabel(currentListing.contactMethod), language)}</PrimaryButton>
              </View>
            ) : null}
            {/* Numarayı Göster (Sahibinden tarzı) — istek üzerine gerçek numara */}
            {currentListing.contactMethod !== "message" && !revealedPhone ? (
              <View style={{ flex: 1, minWidth: 0 }}>
                <PrimaryButton tone="secondary" icon="phone-outline" disabled={contactDisabled} onPress={() => void revealPhone()}>{revealingPhone ? translateCopy("Yükleniyor…", language) : translateCopy("Numarayı Göster", language)}</PrimaryButton>
              </View>
            ) : null}
          </View>
          {currentListing.contactMethod !== "message" && revealedPhone ? (
            <Pressable onPress={() => { const tel = revealedPhone.replace(/[^0-9+]/g, ""); if (tel) void openUrlSafe(`tel:${tel}`); }} accessibilityRole="button" accessibilityLabel={`${translateCopy("Ara", language)}: ${revealedPhone}`} style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 8, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 46 }}>
              <MaterialCommunityIcons name="phone" size={16} color={colors.ink} />
              <Text selectable style={{ color: colors.ink, fontSize: 15, fontVariant: ["tabular-nums"], fontWeight: "800" }}>{revealedPhone}</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );

  // ---- BAŞLIK KARTI: başlık → FİYAT → meta → ortaklık özeti → (geniş: CTA) ----
  const headCard = (
    <View testID="listing-detail-head" style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: detail.radius, borderWidth: 1, gap: 10, padding: detail.pad }}>
      <Text selectable numberOfLines={3} accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: isWideWeb ? 22 : 19, fontWeight: "700", lineHeight: isWideWeb ? 28 : 24 }}>{currentTitle}</Text>
      {/* Fiyat sayfanın en güçlü öğesi: en büyük punto, tabular rakam, taşmaz. */}
      <Text testID="listing-detail-price" selectable numberOfLines={1} style={{ color: colors.ink, fontSize: priceSize, fontVariant: ["tabular-nums"], fontWeight: "800", letterSpacing: -0.4, lineHeight: Math.round(priceSize * 1.18) }}>{priceLabel}</Text>
      <DetailMetaLine listing={currentListing} />
      {isDemo ? <DetailNotice icon="eye-outline" tone="neutral" title={translateCopy("Örnek (vitrin) ilan", language)} body={translateCopy("Bu ilan yalnızca platformun nasıl göründüğünü göstermek içindir. Mesajlaşma, iletişim ve ortaklık kapalıdır.", language)} /> : null}
      {/* Müsait değil durum bandı — satın alma/ortaklık/teklif kapalı (aksiyon handler'ları da guard'lı). */}
      {listingUnavailable ? <DetailNotice icon={currentListing.status === "sold" ? "check-decagram" : "close-circle-outline"} tone="danger" title={unavailableLabel} body={translateCopy("Bu ilanda satın alma, ortaklık ve teklif kapalı. Aşağıdaki benzer ürünlere göz atabilirsin.", language)} /> : null}
      {/* ACİL SATIŞ — attributes._urgentUntil GELECEKTEyse. */}
      {urgentDaysLeft ? <DetailNotice icon="fire" tone="danger" title={`${translateCopy("Acil satış", language)} — ${urgentDaysLeft} ${translateCopy("gün içinde satılmalı", language)}`} /> : null}
      <CommissionSummary listing={currentListing} demand={isDemand} />
      {/* Sosyal kanıt — görüntülenme + favori (yalnız >0). */}
      {(currentListing.viewCount > 0 || currentListing.favoriteCount > 0) ? (
        <Text style={{ color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "500", lineHeight: 16 }}>
          {[currentListing.viewCount > 0 ? `${currentListing.viewCount} ${translateCopy("kez görüntülendi", language)}` : "", currentListing.favoriteCount > 0 ? `${currentListing.favoriteCount} ${translateCopy("favori", language)}` : ""].filter(Boolean).join("  ·  ")}
        </Text>
      ) : null}
      {actionsBlock}
    </View>
  );

  // ---- GÖVDE BÖLÜMLERİ (sabit sıra): Özet → Açıklama → Ortaklık koşulları → Satıcı → Konum → Güvenli alışveriş ----
  const bodySections = (
    <>
      <DetailSection title="Özet" icon="format-list-bulleted" testID="listing-section-summary">
        <DefinitionGrid rows={summary.rows} />
        <FeatureChips groups={summary.chips} />
      </DetailSection>

      <DetailSection title="Açıklama" icon="text-box-outline" testID="listing-section-description">
        <ClampedText key={currentListing.id} text={currentListing.description} />
        {currentListing.salesPitch.slice(0, 4).map((line) => (
          <Bullet key={line} icon="check-circle-outline" text={line} />
        ))}
      </DetailSection>

      {partnerable ? (
        isDemand ? (
          /* TALEP (arayan): BULUŞ KOMİSYONU koşulları — bulan kazanır, komisyonu ilan sahibi öder. */
          <DetailSection title="Ortaklık koşulları" icon="handshake-outline" testID="listing-section-terms" right={<Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{translateCopy(partnershipModeLabel(currentListing.partnershipMode), language)}</Text>}>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "400", lineHeight: 19 }}>{translateCopy("Bu talebi karşılayan ürünü/satıcıyı bul ve getir; bulan komisyonu kazanır. Komisyonu ilan sahibi öder.", language)}</Text>
            {(() => {
              const conv = categoryConversion(currentListing.category);
              return (
                <>
                  <DefinitionGrid
                    initial={8}
                    rows={[
                      { label: "Buluş komisyonu", value: `${moneyIn(commission, currentListing.currency)}${currentListing.commissionType === "rate" ? ` · %${currentListing.commissionValue}` : ""}` },
                      { label: "Atıf penceresi", value: `${currentListing.attributionWindowDays} ${translateCopy("gün", language)}` },
                      { label: "Komisyon vadesi", value: `${currentListing.commissionDueDays} ${translateCopy("gün", language)}` },
                      { label: "Hak ediş koşulu", value: conv.event },
                      ...(currentListing.partnerCount > 0 ? [{ label: "Ortak", value: `${currentListing.partnerCount} ${translateCopy("ortak tanıtıyor", language)}` }] : []),
                      ...(currentListing.leadCount > 0 ? [{ label: "Talep", value: `${currentListing.leadCount} ${translateCopy("talep geldi", language)}` }] : [])
                    ]}
                  />
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "500", lineHeight: 17 }}>{translateCopy(conv.hint, language)}</Text>
                </>
              );
            })()}
            {currentListing.partnerRules.length > 0 ? (
              <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 6, paddingTop: 10 }}>
                <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{translateCopy("Satıcının ortaklardan beklentileri:", language)}</Text>
                {currentListing.partnerRules.map((rule, i) => (
                  <Bullet key={`${i}-${rule}`} icon="check-circle-outline" text={rule} />
                ))}
              </View>
            ) : null}
          </DetailSection>
        ) : (
          <View style={{ gap: 6 }}>
            <ListingTermsSummary key={currentListing.id} listing={currentListing} />
            {currentListing.minPartnerRating > 0 ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "500", paddingHorizontal: 2 }}>{translateCopy("Min. ortak puanı", language)}: {currentListing.minPartnerRating}+</Text> : null}
          </View>
        )
      ) : null}
      {partnership ? <Accordion title={translateCopy("Ortaklık kaydın", language)} icon="file-document-outline"><AgreementCard listing={currentListing} partnership={partnership} /></Accordion> : null}

      <DetailSection title="Satıcı" icon="account-outline" testID="listing-section-seller">
        <SellerSummary owner={owner} ownerId={currentListing.ownerId} demo={isDemo} activeCount={sellerActiveCount} />
      </DetailSection>

      <DetailSection title="Konum" icon="map-marker-outline" testID="listing-section-location">
        <LocationRow location={currentListing.location} />
      </DetailSection>

      <DetailSection title="Güvenli alışveriş" icon="shield-check-outline" testID="listing-section-safety">
        <SafetyTips />
      </DetailSection>
      <LegalDisclaimerCollapsible />
      <Accordion title={translateCopy("Sıkça sorulan sorular", language)} icon="comment-question-outline">
        <SpecRow label="Komisyonu kim öder?" value="İlan sahibi, satış gerçekleştiğinde ortağa öder." />
        <SpecRow label="Ortak olmak ücretli mi?" value="Hayır, ortaklık ücretsizdir." />
        <SpecRow label="Süreç güvenli mi?" value="Komisyon şartı ve talepler sistemde kayıt altındadır." />
      </Accordion>
    </>
  );

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: showMobileActionBar ? (barHeight || 69 + insets.bottom) + 24 : 96 + insets.bottom }}>
      <Head>
        <title>{`${currentTitle} — OrtakSat`}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={metaUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:site_name" content="OrtakSat" />
        <meta property="og:locale" content="tr_TR" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:image" content={currentListing.image} />
        <meta property="og:image:alt" content={currentListing.imageAlt || currentTitle} />
        <meta property="og:url" content={metaUrl} />
        <meta property="product:price:amount" content={String(currentListing.price)} />
        <meta property="product:price:currency" content={currentListing.currency ?? "TRY"} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image" content={currentListing.image} />
        <meta name="twitter:image:alt" content={currentListing.imageAlt || currentTitle} />
      </Head>
      <JsonLd id="product" json={productLd} />
      <JsonLd id="breadcrumb" json={breadcrumbLd} />
      <WebContainer max={1280} padding={isWideWeb ? 20 : 0} style={{ gap: isWideWeb ? 8 : 0 }}>
      {/* Breadcrumb: Ana Sayfa › kök › … › yaprak (› Ürün) — TEK satır; kategoriler kısalır, düzeni itmez. */}
      <View testID="listing-breadcrumb" role="navigation" style={{ alignItems: "center", flexDirection: "row", gap: 4, minHeight: 30, overflow: "hidden", paddingHorizontal: isWideWeb ? 0 : detail.gutter }}>
        <PressLink href="/" hitSlop={6} accessibilityLabel={translateCopy("Ana sayfa", language)} style={{ flexShrink: 0, justifyContent: "center", minHeight: 30 }}>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{translateCopy("Ana Sayfa", language)}</Text>
        </PressLink>
        {shownCrumbs.map((c, i) => {
          const current = !crumbShowsTitle && i === shownCrumbs.length - 1;
          return (
            <Fragment key={c.key}>
              <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
              <PressLink href={c.href} hitSlop={6} accessibilityLabel={`${c.collapsed || translateCopy(c.label, language)} ${translateCopy("kategorisi", language)}`} style={{ flexShrink: c.collapsed ? 0 : 1, justifyContent: "center", maxWidth: isWideWeb ? 240 : undefined, minHeight: 30, minWidth: c.collapsed ? 16 : 0 }}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: current ? colors.ink : colors.muted, fontSize: 12, fontWeight: current ? "700" : "600", textAlign: c.collapsed ? "center" : undefined }}>{c.collapsed ? "…" : translateCopy(c.label, language)}</Text>
              </PressLink>
            </Fragment>
          );
        })}
        {crumbShowsTitle ? (
          <>
            <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
            <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12, fontWeight: "700", minWidth: 0 }}>{currentTitle}</Text>
          </>
        ) : null}
      </View>

      {isWideWeb ? (
        /* GENİŞ: iki sütun — galeri solda STICKY, sağda başlık/fiyat/CTA kartı + bölümler. */
        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
          <View style={{ alignSelf: "flex-start", flex: 1.12, minWidth: 0, position: "sticky", top: 12 } as any}>
            {galleryBlock}
          </View>
          <View style={{ flex: 1, gap: detail.gap, minWidth: 0 }}>
            {headCard}
            {bodySections}
          </View>
        </View>
      ) : (
        /* DAR: tek sütun — galeri tam genişlik, ardından aynı sırayla kartlar. */
        <View style={{ gap: detail.gap }}>
          {galleryBlock}
          <View style={{ gap: detail.gap, paddingHorizontal: detail.gutter }}>
            {headCard}
            {bodySections}
          </View>
        </View>
      )}

      <View style={{ gap: detail.gap, marginTop: detail.gap, paddingHorizontal: isWideWeb ? 0 : detail.gutter }}>
        <ListingQA listingId={currentListing.id} isOwner={isOwner} isDemo={isDemo} />

        <RelatedListingsSection
          cardWidth={relatedCardWidth}
          listings={sellerOtherListings}
          ownersById={(ownerId) => findUser(ownerId)}
          title="Satıcının diğer ürünleri"
          actionLabel={translateCopy("Mağazayı aç", language)}
          actionHref={{ pathname: "/store/[id]", params: { id: currentListing.ownerId } }}
        />

        <RelatedListingsSection
          cardWidth={relatedCardWidth}
          listings={similarFinal}
          ownersById={(ownerId) => findUser(ownerId)}
          title="Benzer ürünler"
        />

        <RelatedListingsSection
          cardWidth={relatedCardWidth}
          listings={recentViewed}
          ownersById={(ownerId) => findUser(ownerId)}
          title="Son gezdiklerin"
        />

        <DetailSection title="Yorumlar" icon="star-outline" testID="listing-section-reviews" right={<Text style={{ color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "700" }}>{listingReviewSummary.count}</Text>}>
          {/* Satış sonrası yorum formu — paylaşılan bileşen (puan boş başlar, çift-gönderim kilidi, min. uzunluk). */}
          {reviewableSale ? (
            <View style={{ borderBottomColor: colors.line, borderBottomWidth: 1, paddingBottom: 12 }}>
              <SaleReviewForm saleId={reviewableSale.id} title={translateCopy("Satış sonrası yorum hakkın var", language)} createSaleReview={createSaleReview} />
            </View>
          ) : null}
          {listingReviewSummary.stats ? (
            <RatingSummary stats={listingReviewSummary.stats} language={language} />
          ) : listingReviews.length > 0 || reviewPager.loading || reviewPager.error ? null : (
            <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
              {translateCopy("Henüz değerlendirme yok", language)}
            </Text>
          )}
          {/* Paylaşılan ReviewCard (mağaza sayfasıyla AYNI): kendi yorumunu düzenle/sil,
              satıcı yanıtı, faydalı oyu, şikayet. */}
          {listingReviews.map((item) => (
            <ReviewCard
              key={item.id}
              review={item}
              reviewerName={item.reviewerName ?? findUser(item.reviewerId)?.name}
              isSeller={isOwner}
              authed={isReviewAuthed}
              isMine={item.reviewerId === currentUser.id}
              onEdit={editReview}
              onDelete={deleteReview}
              onReport={reportReview}
              onPatch={reviewPager.patch}
              onRemove={reviewPager.remove}
              language={language}
            />
          ))}
          <ReviewLoadMore hasMore={reviewPager.hasMore} loading={reviewPager.loading || reviewPager.loadingMore} error={reviewPager.error} onLoadMore={reviewPager.loadMore} onRetry={reviewPager.retry} language={language} />
        </DetailSection>
        <View testID="listing-detail-end" />
      </View>
      </WebContainer>

      {/* Dar ekran "diğer işlemler" menüsü: karşılaştır / bildir (fotoğraf üstündeki ⋯). */}
      <OptionSheet
        visible={moreOpen}
        title={translateCopy("Diğer işlemler", language)}
        allowClear={false}
        searchable={false}
        options={moreOptions}
        onClose={() => setMoreOpen(false)}
        onSelect={(v) => {
          setMoreOpen(false);
          if (v === moreCompareLabel) toggleCompare(currentListing.id);
          else if (v === moreReportLabel) setReportOpen(true);
        }}
      />

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
                style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: Platform.OS === "web" ? 16 : 13.5, minHeight: 70, padding: 10, textAlignVertical: "top" }}
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
                      showToast(translateCopy("Teklifin gönderildi — satıcı yanıtlayınca haber alacaksın", language));
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
        {/* KAV + ScrollView: açıklama alanına odaklanınca klavye "Bildir" butonunu örtüyordu
            (RN Modal ebeveynin KAV'ını miras almaz). Hemen üstteki teklif modalıyla aynı desen. */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ backgroundColor: "rgba(16,24,40,0.55)", flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}>
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
            <TextInput value={reportDetail} onChangeText={setReportDetail} placeholder={translateCopy("İstersen kısa bir açıklama ekle (opsiyonel)", language)} placeholderTextColor={colors.subtle} multiline style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: Platform.OS === "web" ? 16 : 13, minHeight: 64, padding: 12, textAlignVertical: "top" }} />
            <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
              <Pressable onPress={() => setReportOpen(false)} style={{ borderColor: colors.line, borderRadius: 10, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 11 }}><Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("Vazgeç", language)}</Text></Pressable>
              <Pressable onPress={() => void submitReport()} style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 }}><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Bildir", language)}</Text></Pressable>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={lightbox} transparent animationType="fade" onRequestClose={() => { setLightbox(false); setZoomed(false); }}>
        <View testID="listing-web-lightbox" style={{ backgroundColor: "rgba(0,0,0,0.92)", flex: 1, justifyContent: "center" }}>
          <Pressable accessibilityLabel={translateCopy("Kapat", language)} onPress={() => { setLightbox(false); setZoomed(false); }} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, height: 42, justifyContent: "center", position: "absolute", right: 18, top: 18, width: 42, zIndex: 5 }}>
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => setZoomed((z) => !z)}
            accessibilityRole="imagebutton"
            accessibilityLabel={zoomed ? translateCopy("Uzaklaştır", language) : translateCopy("Yakınlaştır", language)}
            onTouchStart={(e) => { swipeStartX.current = touchPageX(e); }}
            onTouchEnd={(e) => {
              const dx = touchPageX(e) - swipeStartX.current;
              if (!zoomed && Math.abs(dx) > 50 && gallery.length > 1) {
                setActiveImage((dx < 0 ? photoIdx + 1 : photoIdx - 1 + gallery.length) % gallery.length);
              }
            }}
            style={{ alignItems: "center", height: "78%", justifyContent: "center", overflow: "hidden", width: "100%" }}
          >
            <SafeRemoteImage
              full
              uri={gallery[photoIdx] ?? currentListing.image}
              alt={currentTitle}
              accessibilityLabel={currentTitle}
              style={{ height: "100%", transform: [{ scale: zoomed ? 2.2 : 1 }], width: "100%" }}
              contentFit="contain"
            />
            {/* Tam ekranda da filigran — kopyalama/ekran görüntüsü buradan alınır. */}
            <ImageWatermark size={22} />
          </Pressable>
          <View style={{ alignItems: "center", bottom: 74, left: 0, position: "absolute", right: 0 }}>
            <View style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700" }}>{zoomed ? translateCopy("Uzaklaştırmak için dokun", language) : translateCopy("Yakınlaştırmak için dokun · kaydırarak gez", language)}</Text>
            </View>
          </View>
          {gallery.length > 1 ? (
            <>
              <Pressable accessibilityLabel={translateCopy("Önceki görsel", language)} onPress={() => { setActiveImage((photoIdx - 1 + gallery.length) % gallery.length); setZoomed(false); }} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, height: 48, justifyContent: "center", left: 14, position: "absolute", top: "46%", width: 48 }}>
                <MaterialCommunityIcons name="chevron-left" size={30} color="#FFFFFF" />
              </Pressable>
              <Pressable accessibilityLabel={translateCopy("Sonraki görsel", language)} onPress={() => { setActiveImage((photoIdx + 1) % gallery.length); setZoomed(false); }} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, height: 48, justifyContent: "center", position: "absolute", right: 14, top: "46%", width: 48 }}>
                <MaterialCommunityIcons name="chevron-right" size={30} color="#FFFFFF" />
              </Pressable>
              <View style={{ alignItems: "center", bottom: 26, flexDirection: "row", gap: 8, justifyContent: "center", left: 0, position: "absolute", right: 0 }}>
                {gallery.map((_, i) => (
                  <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${i + 1}. görsele git`} hitSlop={10} onPress={() => setActiveImage(i)} style={{ backgroundColor: i === photoIdx ? "#FFFFFF" : "rgba(255,255,255,0.4)", borderRadius: 999, height: 8, width: i === photoIdx ? 22 : 8 }} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
    {/* MOBİL SABİT ALT AKSİYON ÇUBUĞU (e-ticaret standardı): kaydırınca fiyat + birincil CTA
        her zaman erişilebilir kalır (Trendyol/Sahibinden deseni). Masaüstünde sağ karar kutusu
        zaten hep görünür; native/dar-web'de yoktu → dönüşüm sızıntısı. Aynı handler'ları kullanır. */}
    {showMobileActionBar ? (
      <View testID="listing-detail-actions" onLayout={(e) => { const h = Math.round(e.nativeEvent.layout.height); setBarHeight((prev) => (prev === h ? prev : h)); }} style={{ alignItems: "center", backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, /* web: çerez bandı görünürken çubuk onun ÜSTÜNE kalkar (bkz. components/cookie-consent.tsx → --os-cookie-h) */ bottom: Platform.OS === "web" ? ("var(--os-cookie-h, 0px)" as never) : 0, elevation: 12, flexDirection: "row", gap: 10, left: 0, paddingBottom: 12 + insets.bottom, paddingHorizontal: 14, paddingTop: 10, position: "absolute", right: 0, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8 }}>
        {!isOwner && !canJoinNow && width >= 390 ? (
          <View style={{ minWidth: 0, flexShrink: 1, maxWidth: "35%" }}>
            <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>{translateCopy("Fiyat", language)}</Text>
            <Text numberOfLines={1} style={{ color: partnerable ? colors.primaryDark : colors.ink, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 }}>{moneyIn(currentListing.price, currentListing.currency)}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1, flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
          {isOwner ? (
            <View style={{ flex: 1 }}><PrimaryButton href={{ pathname: "/listing-edit/[id]", params: { id: currentListing.id } }} icon="pencil-outline">{translateCopy("İlanı Düzenle", language)}</PrimaryButton></View>
          ) : isDemand ? (
            canJoinNow ? (
              <View style={{ flex: 1 }}><PrimaryButton icon="handshake" onPress={handleJoin}>{translateCopy("Ortak Ol", language)}</PrimaryButton></View>
            ) : (
              <View style={{ flex: 1 }}><PrimaryButton icon="message-text-outline" disabled={revealingPhone || isOwner || isUserBlocked(currentListing.ownerId)} onPress={() => void handleContact()}>{translateCopy(contentWidth < 360 ? "Mesaj" : "Mesaj gönder", language)}</PrimaryButton></View>
            )
          ) : canJoinNow ? (
            <>
              <View style={{ flex: 1 }}><PrimaryButton tone="secondary" icon="message-text-outline" disabled={revealingPhone || isOwner || isUserBlocked(currentListing.ownerId)} onPress={() => void handleContact()}>{translateCopy(barContactLabel, language)}</PrimaryButton></View>
              <View style={{ flex: 1 }}><PrimaryButton icon="handshake" onPress={handleJoin}>{translateCopy("Ortak Ol", language)}</PrimaryButton></View>
            </>
          ) : (
            <View style={{ flex: 1 }}><PrimaryButton icon="message-text-outline" disabled={revealingPhone || isOwner || isUserBlocked(currentListing.ownerId)} onPress={() => void handleContact()}>{translateCopy(barContactLabel, language)}</PrimaryButton></View>
          )}
        </View>
      </View>
    ) : null}
    </View>
  );
}

/**
 * Dokunuşun sayfa-X'i. Web'de DOM TouchEvent'in `pageX`'i YOKTUR (touches/changedTouches
 * içindedir) → eski `nativeEvent.pageX` web'de undefined dönüyor, kaydırma hiç çalışmıyordu.
 * Native'de RN `nativeEvent.pageX` verir. İkisini de karşılar; bulunamazsa NaN (kaydırma sayılmaz).
 */
function touchPageX(e: unknown): number {
  const n = (e as { nativeEvent?: { pageX?: number; changedTouches?: ArrayLike<{ pageX: number }>; touches?: ArrayLike<{ pageX: number }> } } | null)?.nativeEvent;
  const x = n?.changedTouches?.[0]?.pageX ?? n?.touches?.[0]?.pageX ?? n?.pageX;
  return typeof x === "number" ? x : Number.NaN;
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
  listings,
  ownersById,
  title
}: {
  actionHref?: Href;
  actionLabel?: string;
  cardWidth: number;
  listings: Listing[];
  ownersById: (ownerId: string) => User | undefined;
  title: string;
}) {
  // Boş bölüm gösterilmez ("başka ürün yok" kartı görsel gürültüydü).
  if (listings.length === 0) return null;
  return (
    <DetailSection
      title={title}
      right={actionHref && actionLabel ? (
        <PressLink href={actionHref} hitSlop={8} style={{ alignItems: "center", flexDirection: "row", gap: 2, justifyContent: "center", minHeight: 32 }}>
          <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: "700" }}>{actionLabel}</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primary} />
        </PressLink>
      ) : undefined}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
        {listings.map((item) => (
          <ListingCard key={item.id} listing={item} owner={ownersById(item.ownerId)} width={cardWidth} />
        ))}
      </ScrollView>
    </DetailSection>
  );
}

/** Geniş ekran ikincil işlem: zeminsiz, sessiz metin düğmesi (40px dokunma). */
function QuietAction({ active, icon, label, onPress }: { active?: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  const { language } = useLanguage();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} accessibilityLabel={translateCopy(label, language)} onPress={onPress} style={{ alignItems: "center", borderRadius: 8, flexDirection: "row", gap: 6, minHeight: 40, paddingHorizontal: 10 }}>
      <MaterialCommunityIcons name={icon} size={17} color={active ? colors.primary : colors.muted} />
      <Text numberOfLines={1} style={{ color: active ? colors.primary : colors.muted, fontSize: 12.5, fontWeight: "600" }}>{translateCopy(label, language)}</Text>
    </Pressable>
  );
}

function Bullet({ icon, text }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.primary} style={{ marginTop: 2 }} />
      <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 13.5, lineHeight: 20, minWidth: 0 }}>{translateCopy(text, language)}</Text>
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
