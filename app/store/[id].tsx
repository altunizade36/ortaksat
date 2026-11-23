import { TrustEntry } from "@/components/trust/entry";
import { useProfileActivity } from "@/lib/activity";
import { sortByStoreOrder } from "@/lib/store-order";
import { displayListingTitle } from "@/lib/listing-title";
import { UserAvatar } from "@/components/user-avatar";
import { ProfileCoverImage } from "@/components/profile-cover-image";
import { MaterialCommunityIcons } from "@/components/icons";
import { Image } from "expo-image";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions, type ScrollViewInstance } from "react-native";

import { Alert } from "@/lib/alert";
import { showToast } from "@/lib/toast";

import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { JsonLd } from "@/components/json-ld";
import { ListingCard } from "@/components/listing-card";
import { ReviewCard } from "@/components/review-card";
import { RatingSummary } from "@/components/reviews/rating-summary";
import { ReviewLoadMore, ReviewSortBar } from "@/components/reviews/review-filters";
import { sortReviews, summarizeReviews, usePagedReviews, type RatingStats, type ReviewSort } from "@/lib/reviews";
import { EmptyState, Metric, PrimaryButton, StatusPill } from "@/components/ui";
import { ErrorScreen } from "@/components/error-boundary";
import { WebFooter } from "@/components/web-landing";
import { money, trPhoneIntl } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { fetchSellerPhone, fetchListingsBySellers } from "@/lib/supabase-data";
import { openUrlSafe } from "@/lib/link";
import { shareOrCopy } from "@/lib/share";
import { responsiveGrid, useIsWideWeb } from "@/lib/layout";
import { displayText } from "@/lib/text";
import { foldKey } from "@/lib/fast-text";
import { calculateUserTrustScores } from "@/lib/trust-score";
import type { Listing, Review, User } from "@/lib/types";
import { useStore } from "@/lib/use-store";
import { isMobileApp } from "@/lib/mobile-app";
import { MobileSellerStore } from "@/components/mobile/seller-store";

type StoreFilter = "active" | "all" | "partner";
type StoreSort = "store" | "new" | "priceAsc" | "priceDesc";
type MobileTab = "listings" | "about" | "reviews" | "policies";
const STORE_PAGE = 24;
const SORT_OPTIONS: Array<{ key: StoreSort; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: "store", label: "Mağaza sırası", icon: "storefront-outline" },
  { key: "new", label: "En yeni", icon: "clock-outline" },
  { key: "priceAsc", label: "En düşük fiyat", icon: "sort-ascending" },
  { key: "priceDesc", label: "En yüksek fiyat", icon: "sort-descending" }
];
type ProfileTab = "about" | "listings" | "partnerships" | "policies" | "reviews" | "badges";
const NO_REVIEW_STATS: RatingStats = { count: 0, average: 0, dist: [0, 0, 0, 0, 0] };

/** "Üye olma tarihi" güven sinyali — createdAt "YYYY-MM-DD" → dilbilgisel olarak güvenli
 * "{yıl} yılından beri üye" / "Member since {yıl}". TR ek-uyumu tuzağını "yılından beri"
 * ile aşar (2025'ten / 2026'dan farkına takılmaz). */
function memberSinceLabel(createdAt: string | undefined, language: string): string | null {
  if (!createdAt) return null;
  const year = String(createdAt).slice(0, 4);
  if (!/^\d{4}$/.test(year)) return null;
  return language === "en" ? `Member since ${year}` : `${year} yılından beri üye`;
}

export default function StoreScreen() {
  const {id,view}=useLocalSearchParams<{id:string;view?:string}>();
  return isMobileApp&&view!=="advanced"?<MobileSellerStore key={id} id={id}/>:<StoreScreenLegacy/>;
}
function StoreScreenLegacy() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language, t } = useLanguage();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const isWideWeb = useIsWideWeb();
  const { currentUser, findUser, listings, partnerships, leads, reports, reviews, sales, startConversation, reportUser, editReview, deleteReview, reportReview, isFollowing, toggleFollow, isUserBlocked, blockUser, unblockUser, backendMode, refreshMarketplace } = useStore();
  // Girişli mi? (helpful oyu için: anon → /auth; girişli + geçici hata → yönlendirme YOK)
  const isAuthed = backendMode === "supabase" && !!currentUser?.id && currentUser.id.includes("-");

  async function handleReportSeller() {
    if (!seller || isOwnStore) return;
    const ok = await reportUser(seller.id, translateCopy("Satıcı bildirimi", language), translateCopy("Mağaza/satıcı profilinden bildirildi.", language));
    Alert.alert(
      ok ? translateCopy("Bildirim alındı", language) : translateCopy("Gönderilemedi", language),
      ok
        ? translateCopy("Bildiriminiz kayıt altına alındı ve incelenecek. Teşekkürler.", language)
        : translateCopy("Bildirim için e-posta ile giriş yapmalısın.", language)
    );
  }

  function handleToggleBlock() {
    if (!seller || isOwnStore) return;
    if (isUserBlocked(seller.id)) { void unblockUser(seller.id); return; }
    Alert.alert(
      translateCopy("Kullanıcıyı engelle", language),
      `${seller.name} — ${translateCopy("engellensin mi? Engellediğin kullanıcı sana mesaj gönderemez, sen de ona gönderemezsin.", language)}`,
      [
        { text: translateCopy("Vazgeç", language), style: "cancel" },
        { text: translateCopy("Engelle", language), style: "destructive", onPress: () => void blockUser(seller.id) }
      ]
    );
  }
  const [filter, setFilter] = useState<StoreFilter>("active");
  const [catFilter, setCatFilter] = useState<string>("all"); // mağaza-içi kategori filtresi (Trendyol)
  // Varsayılan: satıcının belirlediği mağaza sırası (yeni eklenen ilan en başta) — bkz. lib/store-order.ts.
  const [storeSort, setStoreSort] = useState<StoreSort>("store");
  // Dar ekran (mobil web) sekmesi — ürünler varsayılan; yapışkan sekme çubuğuyla değişir.
  const [mobileTab, setMobileTab] = useState<MobileTab>("listings");
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollYRef = useRef(0);
  const heroHeightRef = useRef(0);
  // Sekme: kullanıcı seçene kadar otomatik — ilanı olan satıcının mağazası İLANLARLA açılır (mağazaya gelen önce
  // ürünleri görür), ilanı olmayan profil "Hakkında" ile. Bkz. aşağıda `tab`.
  const [pickedTab, setTab] = useState<ProfileTab | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  const [revealingPhone, setRevealingPhone] = useState(false);
  // REMOTE FALLBACK: satıcı yüklü katalog penceresinde olmayabilir (paylaşılan üründen
  // "Mağaza" → /store/<ownerId>). Eskiden findUser boş dönünce "Mağaza bulunamadı" YALANI
  // görünüyordu. listing/[id] fetchListingById ile çözüyor; mağaza da sunucudan çeker.
  const [fetchedSeller, setFetchedSeller] = useState<User | undefined>(undefined);
  const [fetchedSellerListings, setFetchedSellerListings] = useState<Listing[]>([]);
  // Sunucudan çekim sürüyor mu — yükleme bitmeden "Mağaza bulunamadı" YALANINI flaşlamamak için.
  const [fetchingSeller, setFetchingSeller] = useState(false);
  const [sellerFetchError, setSellerFetchError] = useState(false); // ağ hatası (bulunamadı DEĞİL)
  const [sellerRetryTick, setSellerRetryTick] = useState(0);
  useEffect(() => {
    let alive = true;
    if (!id || backendMode !== "supabase") return;
    if (findUser(id) && listings.some((l) => l.ownerId === id)) return; // zaten bellekte
    setFetchingSeller(true);
    setSellerFetchError(false);
    void fetchListingsBySellers([id]).then((res) => {
      if (!alive) return;
      // null = AĞ HATASI (bulunamadı değil) → retry. {listings,users} = başarı (boş=gerçekten yok).
      if (res === null) { setSellerFetchError(true); return; }
      setFetchedSellerListings(res.listings);
      setFetchedSeller(res.users.find((u) => u.id === id));
    }).finally(() => { if (alive) setFetchingSeller(false); });
    return () => { alive = false; };
  }, [id, backendMode, sellerRetryTick]);
  const seller = (id ? findUser(id) : undefined) ?? fetchedSeller;
  // Satıcının ilanları: bellek + sunucudan çekilen (tekilleştir).
  const scopedListings = useMemo(() => {
    const m = new Map<string, Listing>();
    for (const l of listings) if (l.ownerId === id) m.set(l.id, l);
    for (const l of fetchedSellerListings) m.set(l.id, l);
    return Array.from(m.values());
  }, [id, listings, fetchedSellerListings]);
  const isOwnStore = seller?.id === currentUser.id;
  const trust = seller ? calculateUserTrustScores({ leads, listings, partnerships, reports, reviews, sales, user: seller }) : undefined;
  // Ortak (partner) karnesi — kişinin başkalarının ürünlerini satarak/getirerek yaptığı iş.
  const partnerAllPartnerships = seller ? partnerships.filter((p) => p.partnerId === seller.id) : [];
  const partnerActiveCount = partnerAllPartnerships.filter((p) => p.status === "active").length;
  const partnerPartnershipIds = new Set(partnerAllPartnerships.map((p) => p.id));
  const partnerSalesList = sales.filter((s) => partnerPartnershipIds.has(s.partnershipId));
  const partnerBroughtSales = partnerSalesList.length;
  const partnerEarned = partnerSalesList.reduce((sum, s) => sum + s.commissionAmount, 0);
  const hasPartnerActivity = partnerAllPartnerships.length > 0 || partnerBroughtSales > 0;
  // Durum filtresi (aktif/ortak/tümü) uygulanmış ama KATEGORİ filtresi uygulanmamış liste —
  // kategori çipleri ve sayıları bundan türer (böylece sayılar seçili duruma göre tutarlı).
  const filteredByStatus = useMemo(() => scopedListings
    .filter((listing) => listing.status !== "rejected")
    .filter((listing) => {
      if (filter === "active") return listing.status === "active";
      if (filter === "partner") return listing.status === "active" && listing.partnershipMode !== "invite";
      return true;
    }), [filter, scopedListings]);
  // Mağazadaki kategoriler [ad, adet] — çoktan aza. Trendyol mağaza-içi kategori filtresi.
  const storeCategories = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of filteredByStatus) { const c = displayText(l.category); if (c) m.set(c, (m.get(c) ?? 0) + 1); }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredByStatus]);
  // Seçili kategori artık listede yoksa (durum filtresi değişti) "tümü"ne düş.
  useEffect(() => { if (catFilter !== "all" && !storeCategories.some(([c]) => c === catFilter)) setCatFilter("all"); }, [storeCategories, catFilter]);
  // Mağaza-içi arama (uygulamadaki mağaza ekranıyla parite): başlık + kategori + konum, Türkçe harf duyarsız.
  const [storeQuery, setStoreQuery] = useState("");
  const queryKey = foldKey(storeQuery).trim();
  // Büyük mağazada (toplu ilan → yüzlerce ürün) hepsini birden çizmemek için kademeli gösterim.
  const [visibleCount, setVisibleCount] = useState(STORE_PAGE);
  useEffect(() => { setVisibleCount(STORE_PAGE); }, [filter, catFilter, storeSort, queryKey]);
  const [sortOpen, setSortOpen] = useState(false);
  const sellerListings = useMemo(() => {
    const arr = filteredByStatus.filter((listing) => catFilter === "all" || displayText(listing.category) === catFilter)
      .filter((listing) => !queryKey || queryKey.split(" ").every((w) => foldKey(`${displayListingTitle(listing.title)} ${listing.category ?? ""} ${listing.location ?? ""}`).includes(w)));
    if (storeSort === "priceAsc") arr.sort((a, b) => a.price - b.price);
    else if (storeSort === "priceDesc") arr.sort((a, b) => b.price - a.price);
    else if (storeSort === "new") arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else return sortByStoreOrder(arr);
    return arr;
  }, [filteredByStatus, catFilter, storeSort, queryKey]);
  const shownListings = sellerListings.slice(0, visibleCount);
  const hiddenCount = sellerListings.length - shownListings.length;
  const activeListings = scopedListings.filter((listing) => listing.status === "active");
  const tab: ProfileTab = pickedTab ?? (activeListings.length > 0 ? "listings" : "about");
  const activityLabel = useProfileActivity(id); // "Bugün aktif" / "Bu hafta aktif" (kaba aralık; bkz. lib/activity.ts)
  const totalCommission = activeListings.reduce((sum, listing) => {
    return sum + (listing.commissionType === "rate" ? Math.round((listing.price * listing.commissionValue) / 100) : listing.commissionValue);
  }, 0);
  const gridGap = 10;
  const cardWidth = responsiveGrid({ available: width - 24, gap: gridGap, minCardWidth: 176 }).cardWidth;

  // Bu kullanıcı HAKKINDA yazılmış yorumları canlıdan getir (global store yalnız
  // giriş yapan kullanıcının YAZDIĞI yorumları tutuyor). Böylece ziyaretçi de
  // satıcının aldığı gerçek değerlendirmeleri görür.
  // SAYFALI: liste 20'şer gelir ("Daha fazla değerlendirme göster" ekler); sıralama SUNUCUDA uygulanır
  // ve değişince ilk sayfadan yeniden sorgulanır. Eskiden tek istekte en fazla 100 yorum çekiliyordu.
  const [reviewSort, setReviewSort] = useState<ReviewSort>("recent");
  // Store'daki (oturumda yazılan) bu satıcıya ait yorumlar — sunucu listesine henüz düşmemiş olabilir.
  const localSellerReviews = useMemo(() => reviews.filter((r) => r.reviewedUserId === id), [reviews, id]);
  const reviewPager = usePagedReviews({ userId: id }, { sort: reviewSort, refreshKey: localSellerReviews.length });
  const reviewsLoaded = !reviewPager.loading;
  // ReviewCard yanıt/oy sonrası kaynağı günceller → tab değişip geri gelince (remount) stale
  // prop yerine güncel değer seed'lenir (eskiden yanıt/oy görünüşte kayboluyordu).
  const patchReview = reviewPager.patch;
  const removeFetched = reviewPager.remove;
  const reviewsAboutSeller = useMemo(() => {
    const map = new Map<string, Review>();
    for (const r of localSellerReviews) map.set(r.id, r);
    for (const r of reviewPager.rows) map.set(r.id, r);
    return sortReviews(Array.from(map.values()), reviewSort);
  }, [localSellerReviews, reviewPager.rows, reviewSort]);
  // Özet (ortalama + adet + dağılım) ve başlıktaki sayı TÜM yorumlardan gelir (yalnız yüklenen
  // sayfadan değil) → başlıktaki puan, özet ve sayı birbirini tutar. Eskiden başlık profildeki saklı
  // `rating`'i basıyordu: yorumu olmayan satıcıda "0.0 puan", son yorum silindikten sonra da eski puan görünüyordu.
  const { stats: pagerStats, total: pagerTotal, hasMore: pagerHasMore } = reviewPager;
  const reviewSummary = useMemo(() => summarizeReviews({ stats: pagerStats, total: pagerTotal, hasMore: pagerHasMore }, reviewsAboutSeller), [pagerStats, pagerTotal, pagerHasMore, reviewsAboutSeller]);
  const reviewStats = reviewSummary.stats ?? NO_REVIEW_STATS;
  const reviewCount = reviewSummary.count;
  // Yorumlar yüklenene kadar profildeki puan gösterilir (titreme olmasın); yüklendikten sonra yorum yoksa puan YOK ("—").
  const ratingValue = reviewStats.count ? reviewStats.average : !reviewsLoaded && (seller?.rating ?? 0) > 0 ? Number(seller?.rating) : null;
  const ratingText = ratingValue == null ? "—" : ratingValue.toFixed(1);

  async function refresh() {
    setRefreshing(true);
    try {
      reviewPager.reload(); // yorumlar + özet ilk sayfadan yeniden
      await refreshMarketplace();
    } catch {
      // sessiz
    } finally {
      setRefreshing(false);
    }
  }

  function messageSeller() {
    if (!seller || isOwnStore) return;
    if (currentUser.id === "anon") {
      Alert.alert(translateCopy("Giriş gerekli", language), translateCopy("Satıcıya mesaj göndermek için giriş yapmalısın.", language), [
        { text: translateCopy("Vazgeç", language), style: "cancel" },
        { text: translateCopy("Giriş yap", language), onPress: () => router.push("/auth") }
      ]);
      return;
    }
    const firstListing = activeListings[0] ?? sellerListings[0];
    if (!firstListing) {
      Alert.alert(translateCopy("İletişim kurulamadı", language), translateCopy("Bu satıcının şu an aktif ilanı yok. İlan yayınlandığında mesaj gönderebilirsin.", language));
      return;
    }
    // Otomatik mesaj gönderilmez: sohbet boş açılır, mesajı kullanıcı yazar (bkz. lib/chat-starters.ts).
    const conversation = startConversation(firstListing.id, seller.id, "", firstListing);
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
    else Alert.alert(translateCopy("İletişim kurulamadı", language), translateCopy("Şu an konuşma başlatılamadı, lütfen tekrar dene.", language));
  }

  // Sahibinden tarzı "Numarayı Göster": istek üzerine gerçek numara (girişli kullanıcıya).
  async function revealPhone() {
    if (!seller || isOwnStore || revealingPhone) return;
    if (currentUser.id === "anon") {
      Alert.alert(translateCopy("Giriş gerekli", language), translateCopy("Numarayı görmek için giriş yapmalısın.", language), [
        { text: translateCopy("Vazgeç", language), style: "cancel" },
        { text: translateCopy("Giriş yap", language), onPress: () => router.push("/auth") }
      ]);
      return;
    }
    haptic.light();
    setRevealingPhone(true);
    const p = await fetchSellerPhone(seller.id);
    setRevealingPhone(false);
    if (!p) { Alert.alert(translateCopy("Numara görünmüyor", language), translateCopy("Satıcı numara paylaşmamış; mesaj gönderebilirsin.", language)); return; }
    setRevealedPhone(p);
  }

  const following = seller ? isFollowing(seller.id) : false;
  function handleFollow() {
    if (!seller || isOwnStore) return;
    if (currentUser.id === "anon") {
      Alert.alert(translateCopy("Giriş gerekli", language), translateCopy("Mağazayı takip etmek için giriş yapmalısın.", language), [
        { text: translateCopy("Vazgeç", language), style: "cancel" },
        { text: translateCopy("Giriş yap", language), onPress: () => router.push("/auth") }
      ]);
      return;
    }
    haptic.selection();
    toggleFollow(seller.id);
  }

  if (!seller) {
    // Sunucudan çekim sürerken "bulunamadı" gösterme — yalnız çekim bitip yine boşsa.
    if (fetchingSeller) {
      return (
        <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 12 }}>{translateCopy("Mağaza yükleniyor…", language)}</Text>
        </View>
      );
    }
    // AĞ HATASI: "bulunamadı" (silinmiş gibi) DEĞİL → retry (ilan detayla tutarlı).
    if (sellerFetchError) {
      return (
        <ErrorScreen
          title={translateCopy("Mağaza yüklenemedi", language)}
          body={translateCopy("Bağlantın kesilmiş olabilir; mağaza kaldırılmış değil. Yeniden dene.", language)}
          onRetry={() => setSellerRetryTick((t) => t + 1)}
        />
      );
    }
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 12 }}>
        <EmptyState title={translateCopy("Mağaza bulunamadı", language)} body={translateCopy("Bu satıcı profili kaldırılmış veya bağlantı geçersiz olabilir.", language)} />
      </ScrollView>
    );
  }

  // Paylaşılabilir profil: native'de OS paylaşım tabakası, web'de navigator.share → panoya.
  async function shareStore() {
    if (!seller) return;
    haptic.selection();
    const res = await shareOrCopy({
      title: `${seller.name} — OrtakSat`,
      message: `${seller.name} — OrtakSat mağazasına göz at:`,
      url: `https://www.ortaksat.com/magaza/${seller.id}`
    });
    if (res === "copied") showToast(translateCopy("Mağaza bağlantısı kopyalandı", language));
  }

  const memberLabel = memberSinceLabel(seller.createdAt, language);

  // Doğrulama/başarı rozetleri — hem masaüstü hem mobil dal kullanır.
  // (mobileBadges aşağıda: telefonda ziyaretçiye yalnız kazanılmış olanlar.)
  const badges: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; sub: string; on: boolean; tint: string; color: string }> = [
    { icon: "check-decagram", label: translateCopy("Kimlik Doğrulandı", language), sub: translateCopy("Resmi kimlik onaylı", language), on: seller.verifiedIdentity, tint: colors.successSoft, color: colors.success },
    { icon: "phone-check", label: translateCopy("Telefon Doğrulandı", language), sub: translateCopy("Numara onaylı", language), on: seller.verifiedPhone, tint: colors.infoSoft, color: colors.info },
    { icon: "instagram", label: translateCopy("Instagram Bağlı", language), sub: translateCopy("Sosyal hesap onaylı", language), on: !!seller.verifiedInstagram, tint: colors.violetSoft, color: colors.violet },
    { icon: "star-circle", label: translateCopy("Yüksek Puan", language), sub: translateCopy("4.5+ değerlendirme", language), on: (ratingValue ?? 0) >= 4.5, tint: colors.goldSoft, color: colors.gold },
    { icon: "trophy", label: translateCopy("Çok Satan", language), sub: translateCopy("50+ başarılı satış", language), on: seller.successfulSales >= 50, tint: colors.primarySoft, color: colors.primaryDark },
    { icon: "lightning-bolt", label: translateCopy("Hızlı Yanıt", language), sub: translateCopy("%90+ yanıt oranı", language), on: seller.responseRate >= 90, tint: colors.accentSoft, color: colors.accent }
  ];
  const mobileBadges = isOwnStore ? badges : badges.filter((b) => b.on);

  if (isWideWeb) {
    const sellerPartnerships = partnerships.filter((p) => activeListings.some((l) => l.id === p.listingId));
    const featured = activeListings.slice(0, 3);
    // Vitrin/hakkında (sidebar'lı, dar sütun): kompakt 3-4'lü. Eskiden maxColumns:3 +
    // 1480 kapağı (konteyner 1280) → kartlar ~360px DEVdi. 1280 uyumu + minCardWidth düşürüldü.
    const deskCardWidth = responsiveGrid({ available: Math.min(width, 1280) - 40 - 300 - 20, gap: 14, minCardWidth: 195, maxColumns: 4 }).cardWidth;
    // Ürünler sekmesi TAM GENİŞLİK (sidebar gizli) → Trendyol yoğunluğu 4-5 sütun, kart ~215px.
    const deskGridCardWidth = responsiveGrid({ available: Math.min(width, 1280) - 40, gap: 14, minCardWidth: 208, maxColumns: 5 }).cardWidth;
    const tabs: Array<{ key: ProfileTab; label: string; count?: number }> = [
      { key: "about", label: translateCopy("Hakkında", language) },
      { key: "listings", label: translateCopy("İlanları", language), count: activeListings.length },
      { key: "partnerships", label: translateCopy("Ortaklıkları", language), count: sellerPartnerships.length },
      { key: "policies", label: translateCopy("Politikalar", language) },
      { key: "reviews", label: translateCopy("Yorumlar", language), count: reviewCount },
      { key: "badges", label: translateCopy("Rozetler", language), count: badges.filter((b) => b.on).length }
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        {seller && <TrustEntry userId={seller.id} />}
        <Seo title={`${seller?.name ?? "Satıcı"} — Mağaza ve ilanları | OrtakSat`} description={`${seller?.name ?? "Bu satıcının"} OrtakSat mağazası: ${activeListings.length} aktif ilan. Ürünleri incele, ortak ol veya doğrudan satıcıyla iletişime geç.`} path={id ? `/store/${id}` : undefined} image={seller?.avatar?.startsWith("http") ? seller.avatar : undefined} />
        {seller ? (
          <JsonLd id="store" json={JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Store",
            name: seller.name,
            url: `https://www.ortaksat.com/magaza/${seller.id}`,
            ...(seller.avatar?.startsWith("http") ? { image: seller.avatar } : {}),
            ...(reviewStats.count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviewStats.average, reviewCount: reviewStats.count, bestRating: 5, worstRating: 1 } } : {})
          })} />
        ) : null}
        {/* Cover — mağazaya özgü katmanlı banner (harici görsel yok; CSP-güvenli) */}
        <StoreCover cover={seller.cover} height={150} />
        <View style={{ alignSelf: "center", marginTop: -64, maxWidth: 1280, paddingHorizontal: 20, width: "100%" }}>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, padding: 20 }}>
            <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 18 }}>
              <View style={{ borderColor: colors.surface, borderRadius: 20, borderWidth: 4, marginTop: -54 }}>
                <UserAvatar uri={seller.avatar} size={96} />
              </View>
              <View style={{ flex: 1, gap: 6, minWidth: 0, paddingTop: 6 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>{seller.name}</Text>
                  {seller.verifiedIdentity ? <MaterialCommunityIcons name="check-decagram" size={22} color={colors.info} /> : null}
                </View>
                <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 19, maxWidth: 560 }}>{seller.bio || translateCopy("OrtakSat'ta güvenilir satıcı.", language)}</Text>
                <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 2 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <MaterialCommunityIcons name="star" size={15} color={colors.gold} />
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{ratingText}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>({reviewCount} {translateCopy("yorum", language)})</Text>
                  </View>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <MaterialCommunityIcons name="cart-check" size={15} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{seller.successfulSales} {translateCopy("satış", language)}</Text>
                  </View>
                  {seller.responseRate > 0 ? (
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                      <MaterialCommunityIcons name="lightning-bolt" size={15} color={colors.muted} />
                      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>%{seller.responseRate} {translateCopy("yanıt", language)}</Text>
                    </View>
                  ) : null}
                  {activityLabel ? (
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                      <MaterialCommunityIcons name="clock-check-outline" size={15} color={colors.primaryDark} />
                      <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "700" }}>{translateCopy(activityLabel, language)}</Text>
                    </View>
                  ) : null}
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <MaterialCommunityIcons name="account-heart-outline" size={15} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{seller.followerCount} {translateCopy("takipçi", language)}</Text>
                  </View>
                  {seller.city ? (
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                      <MaterialCommunityIcons name="map-marker-outline" size={15} color={colors.muted} />
                      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{seller.city}</Text>
                    </View>
                  ) : null}
                  {memberLabel ? (
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                      <MaterialCommunityIcons name="calendar-check-outline" size={15} color={colors.muted} />
                      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{memberLabel}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, paddingTop: 6 }}>
                {!isOwnStore ? (
                  <Pressable onPress={handleFollow} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: following ? colors.surfaceAlt : colors.primary, borderColor: following ? colors.primary : colors.primary, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 11 }}>
                    <MaterialCommunityIcons name={following ? "account-heart" : "account-heart-outline"} size={17} color={following ? colors.primary : "#FFFFFF"} />
                    <Text style={{ color: following ? colors.primary : "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy(following ? "Takiptesin" : "Takip Et", language)}</Text>
                  </Pressable>
                ) : null}
                {isOwnStore ? (
                  <Link href="/create" asChild><Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Yeni ilan", language)} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 11 }}><MaterialCommunityIcons name="plus" size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Yeni ilan", language)}</Text></Pressable></Link>
                ) : null}
                {isOwnStore ? (
                  <Link href="/magaza-sirasi" asChild><Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Mağaza sırası", language)} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 16, paddingVertical: 11 }}><MaterialCommunityIcons name="swap-vertical" size={17} color={colors.primaryDark} /><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Mağaza sırası", language)}</Text></Pressable></Link>
                ) : (
                  <Pressable onPress={messageSeller} accessibilityRole="button" accessibilityLabel={translateCopy("Mesaj gönder", language)} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 11 }}><MaterialCommunityIcons name="message-text-outline" size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Mesaj gönder", language)}</Text></Pressable>
                )}
                <Pressable onPress={() => void shareStore()} accessibilityRole="button" accessibilityLabel={translateCopy("Profili paylaş", language)} style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", opacity: pressed ? 0.7 : 1, paddingHorizontal: 14, paddingVertical: 11 })}><MaterialCommunityIcons name="share-variant-outline" size={17} color={colors.muted} /></Pressable>
              </View>
            </View>

            {/* Stats strip */}
            <View style={{ borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", marginTop: 18, paddingTop: 16 }}>
              <DeskProfileStat value={ratingText} label={translateCopy("Puan", language)} />
              <DeskProfileStat value={`${seller.successfulSales}`} label={translateCopy("Satış", language)} />
              <DeskProfileStat value={`${activeListings.length}`} label={translateCopy("Aktif ilan", language)} />
              <DeskProfileStat value={`${sellerPartnerships.length}`} label={translateCopy("Ortaklık", language)} />
              <DeskProfileStat value={trust?.seller.score == null ? "Henüz yok" : `%${trust.seller.score}`} label={translateCopy("Satıcı güveni", language)} last />
            </View>
          </View>

          {/* Tabs */}
          <View style={{ flexDirection: "row", gap: 4, marginTop: 16 }}>
            {tabs.map((tb) => {
              const on = tab === tb.key;
              return (
                <Pressable key={tb.key} onPress={() => setTab(tb.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tb.label} style={{ borderBottomColor: on ? colors.primary : "transparent", borderBottomWidth: 2.5, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 11 }}>
                  <Text style={{ color: on ? colors.primaryDark : colors.muted, fontSize: 14, fontWeight: "800" }}>{tb.label}</Text>
                  {tb.count != null ? <View style={{ backgroundColor: on ? colors.primarySoft : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}><Text style={{ color: on ? colors.primaryDark : colors.muted, fontSize: 11, fontWeight: "800" }}>{tb.count}</Text></View> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={{ backgroundColor: colors.line, height: 1, marginBottom: 16 }} />

          {/* Body: content + sidebar */}
          <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
            <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
              {tab === "about" ? (
                <>
                  <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
                    <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Hakkında", language)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>{seller.bio || translateCopy("Bu satıcı henüz bir açıklama eklememiş. OrtakSat üzerinde doğrulanmış bir satıcıdır ve güvenli alışveriş sunar.", language)}</Text>
                    <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 10, marginTop: 4, paddingTop: 14 }}>
                      <DeskAboutRow icon="cart-check" label={translateCopy("Toplam satış", language)} value={`${seller.successfulSales}`} />
                      {seller.responseRate > 0 ? <DeskAboutRow icon="lightning-bolt" label={translateCopy("Yanıt oranı", language)} value={`%${seller.responseRate}`} /> : null}
                      <DeskAboutRow icon="tag-multiple-outline" label={translateCopy("Toplam komisyon havuzu", language)} value={money(totalCommission)} />
                      <DeskAboutRow icon="shield-check" label={translateCopy("Satıcı güven puanı", language)} value={trust?.seller.score == null ? "Henüz yok" : `%${trust.seller.score}`} />
                      {memberLabel ? <DeskAboutRow icon="calendar-check-outline" label={translateCopy("Üyelik", language)} value={memberLabel} /> : null}
                      {seller.city ? <DeskAboutRow icon="map-marker-outline" label={translateCopy("Konum", language)} value={seller.city} /> : null}
                    </View>
                    {seller.expertiseCategories && seller.expertiseCategories.length > 0 ? (
                      <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 8, marginTop: 4, paddingTop: 14 }}>
                        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Uzmanlık alanları", language)}</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                          {seller.expertiseCategories.map((cat) => (
                            <View key={cat} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 6 }}>
                              <MaterialCommunityIcons name="star-four-points-outline" size={12} color={colors.primaryDark} />
                              <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy(cat, language)}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                  {hasPartnerActivity ? (
                    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18 }}>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                        <MaterialCommunityIcons name="handshake-outline" size={19} color={colors.primaryDark} />
                        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Ortak karnesi", language)}</Text>
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500", lineHeight: 19 }}>{translateCopy("Bu kişinin başka satıcıların ürünlerini ortak olarak satarak / alıcı getirerek oluşturduğu performans.", language)}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                        <PartnerScoreCell value={`${partnerBroughtSales}`} label={translateCopy("Getirdiği satış", language)} />
                        <PartnerScoreCell value={`${partnerActiveCount}`} label={translateCopy("Aktif ortaklık", language)} />
                        <PartnerScoreCell value={money(partnerEarned)} label={translateCopy("Kazandırdığı komisyon", language)} />
                        <PartnerScoreCell value={trust?.partner.score == null ? "Henüz yok" : `%${trust.partner.score}`} label={translateCopy("Ortak güven puanı", language)} />
                      </View>
                    </View>
                  ) : null}
                  {featured.length > 0 ? (
                    <View style={{ gap: 12 }}>
                      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Vitrin", language)}</Text>
                        <Pressable onPress={() => setTab("listings")}><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Tüm ilanları gör →", language)}</Text></Pressable>
                      </View>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                        {featured.map((listing, index) => <ListingCard key={listing.id} listing={listing} owner={seller} width={deskCardWidth} eager={index < 4} />)}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}

              {tab === "listings" ? (
                <>
                  {/* Trendyol-tarzı araç çubuğu: solda filtre çipleri, sağda sonuç sayısı + sıralama. */}
                  <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <StoreFilterChip active={filter === "active"} icon="check-circle-outline" label="Aktif" onPress={() => setFilter("active")} />
                      <StoreFilterChip active={filter === "partner"} icon="handshake-outline" label="Ortaklığa açık" onPress={() => setFilter("partner")} />
                      <StoreFilterChip active={filter === "all"} icon="view-grid-outline" label="Tümü" onPress={() => setFilter("all")} />
                    </View>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                      <StoreSearchBox value={storeQuery} onChange={setStoreQuery} language={language} width={280} />
                      <StoreSortButton value={storeSort} open={sortOpen} onToggle={() => setSortOpen((o) => !o)} language={language} />
                    </View>
                  </View>
                  {sortOpen ? <StoreSortPanel value={storeSort} onPick={(s) => { setStoreSort(s); setSortOpen(false); }} language={language} narrow /> : null}
                  <StoreCategoryBar categories={storeCategories} value={catFilter} onChange={setCatFilter} total={filteredByStatus.length} language={language} />
                  <StoreResultLine count={sellerListings.length} query={storeQuery} onClear={() => setStoreQuery("")} isOwnStore={isOwnStore} language={language} />
                  {sellerListings.length === 0 ? (
                    queryKey ? (
                      <EmptyState title={translateCopy("Sonuç yok", language)} body={translateCopy("Bu mağazada aramana uyan ürün bulunamadı. Farklı bir kelime dene.", language)} />
                    ) : (
                      <EmptyState title={translateCopy("Ürün yok", language)} body={isOwnStore ? translateCopy("İlk ilanını açınca burada görünür.", language) : translateCopy("Bu mağazada şu an görünür ürün yok.", language)} />
                    )
                  ) : (
                    <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
                      {shownListings.map((listing, index) => <ListingCard key={listing.id} listing={listing} owner={seller} width={deskGridCardWidth} eager={index < 4} />)}
                    </View>
                  )}
                  <StoreLoadMore hidden={hiddenCount} onPress={() => setVisibleCount((n) => n + STORE_PAGE)} language={language} />
                </>
              ) : null}

              {tab === "partnerships" ? (
                <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 4, padding: 18 }}>
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 6 }}>{translateCopy("Ortaklığa açık ilanlar", language)}</Text>
                  {sellerPartnerships.length === 0 ? (
                    <EmptyState title={translateCopy("Ortaklık yok", language)} body={translateCopy("Bu satıcının ortaklığa açık ilanı bulunmuyor.", language)} />
                  ) : activeListings.filter((l) => l.partnershipMode !== "invite").map((l, idx) => (
                    <Link key={l.id} href={{ pathname: "/listing/[id]", params: { id: l.id } }} asChild>
                      <Pressable style={{ alignItems: "center", backgroundColor: "transparent", borderTopColor: colors.line, borderTopWidth: idx === 0 ? 0 : 1, flexDirection: "row", gap: 12, paddingVertical: 12 }}>
                        <Image source={{ uri: l.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 10, height: 48, width: 48 }} />
                        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>{displayListingTitle(l.title)}</Text>
                          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{l.category} · {l.location}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 2 }}>
                          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{money(l.price)}</Text>
                          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "800" }}>{l.commissionType === "rate" ? `%${l.commissionValue}` : money(l.commissionValue)} {translateCopy("komisyon", language)}</Text>
                          </View>
                        </View>
                      </Pressable>
                    </Link>
                  ))}
                </View>
              ) : null}

              {tab === "policies" ? (
                <StorePolicies listings={activeListings} language={language} />
              ) : null}

              {tab === "reviews" ? (
                <View style={{ gap: 12 }}>
                  {reviewStats.count > 0 ? <RatingSummary stats={reviewStats} language={language} /> : null}
                  {reviewCount > 1 ? <ReviewSortBar value={reviewSort} onChange={setReviewSort} language={language} /> : null}
                  {reviewsAboutSeller.length === 0 ? (
                    reviewPager.loading || reviewPager.error ? null : <EmptyState title={translateCopy("Henüz değerlendirme yok", language)} body={translateCopy("Değerlendirmeler yalnızca tamamlanmış bir satışın taraflarınca yazılabilir.", language)} />
                  ) : reviewsAboutSeller.map((r) => (
                    <ReviewCard key={r.id} review={r} reviewerName={r.reviewerName ?? findUser(r.reviewerId)?.name} isSeller={isOwnStore} authed={isAuthed} onPatch={patchReview} onRemove={removeFetched} isMine={r.reviewerId === currentUser.id} onEdit={editReview} onDelete={deleteReview} onReport={reportReview} language={language} />
                  ))}
                  <ReviewLoadMore hasMore={reviewPager.hasMore} loading={reviewPager.loading || reviewPager.loadingMore} error={reviewPager.error} onLoadMore={reviewPager.loadMore} onRetry={reviewPager.retry} language={language} />
                </View>
              ) : null}

              {tab === "badges" ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
                  {badges.map((b) => (
                    <View key={b.label} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 200, flexGrow: 1, gap: 8, opacity: b.on ? 1 : 0.5, padding: 18 }}>
                      <View style={{ alignItems: "center", backgroundColor: b.on ? b.tint : colors.surfaceAlt, borderRadius: 14, height: 52, justifyContent: "center", width: 52 }}>
                        <MaterialCommunityIcons name={b.icon} size={28} color={b.on ? b.color : colors.subtle} />
                      </View>
                      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900", textAlign: "center" }}>{b.label}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", textAlign: "center" }}>{b.sub}</Text>
                      {b.on ? <View style={{ backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ color: colors.success, fontSize: 11, fontWeight: "800" }}>{translateCopy("Kazanıldı", language)}</Text></View> : <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>{translateCopy("Henüz yok", language)}</Text>}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Sidebar — ÜRÜNLER sekmesinde GİZLİ: grid tam genişlik olsun (Trendyol ürün
                listesi gibi kompakt 4-5 sütun; sidebar yalnız hakkında/diğer sekmelerde). */}
            {tab !== "listings" ? (
            <View style={{ gap: 16, width: 300 }}>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Doğrulama durumu", language)}</Text>
                {[
                  { label: translateCopy("Kimlik", language), on: seller.verifiedIdentity },
                  { label: translateCopy("Telefon", language), on: seller.verifiedPhone },
                  { label: "Instagram", on: !!seller.verifiedInstagram }
                ].map((v) => (
                  <View key={v.label} style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
                    <MaterialCommunityIcons name={v.on ? "check-circle" : "close-circle-outline"} size={18} color={v.on ? colors.success : colors.subtle} />
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{v.label}</Text>
                    <Text style={{ color: v.on ? colors.success : colors.muted, fontSize: 12, fontWeight: "800" }}>{v.on ? translateCopy("Onaylı", language) : translateCopy("Bekliyor", language)}</Text>
                  </View>
                ))}
              </View>

              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Güven puanı", language)}</Text>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
                  <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 56, justifyContent: "center", width: 56 }}>
                    <Text style={{ color: colors.primaryDark, fontSize: 18, fontWeight: "900" }}>{trust?.overall == null ? "Henüz karne yok" : `%${trust.overall}`}</Text>
                  </View>
                  <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Doğrulama, satış geçmişi ve yorumlara göre hesaplanır.", language)}</Text>
                </View>
              </View>

              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("İletişim", language)}</Text>
                {isOwnStore ? (
                  <Link href="/profile-edit" asChild><Pressable style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name="account-edit-outline" size={17} color={colors.primaryDark} /><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Profili düzenle", language)}</Text></Pressable></Link>
                ) : (
                  <Pressable onPress={messageSeller} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name="message-text-outline" size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{translateCopy("Mesaj gönder", language)}</Text></Pressable>
                )}
                {!isOwnStore ? (
                  revealedPhone ? (
                    <Pressable onPress={() => void openUrlSafe(`tel:${trPhoneIntl(revealedPhone)}`)} style={{ alignItems: "center", backgroundColor: colors.successSoft, borderColor: colors.success, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name="phone" size={17} color={colors.success} /><Text selectable style={{ color: colors.success, fontSize: 14, fontWeight: "900" }}>{revealedPhone}</Text></Pressable>
                  ) : (
                    <Pressable onPress={() => void revealPhone()} style={{ alignItems: "center", borderColor: colors.primary, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name="phone-outline" size={17} color={colors.primaryDark} /><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{revealingPhone ? "…" : translateCopy("Numarayı Göster", language)}</Text></Pressable>
                  )
                ) : null}
                {!isOwnStore ? (
                  <Pressable onPress={() => void handleReportSeller()} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name="flag-outline" size={17} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Satıcıyı şikayet et", language)}</Text></Pressable>
                ) : null}
                {!isOwnStore && seller ? (
                  <Pressable onPress={() => handleToggleBlock()} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name={isUserBlocked(seller.id) ? "account-check-outline" : "account-cancel-outline"} size={17} color={isUserBlocked(seller.id) ? colors.primaryDark : colors.muted} /><Text style={{ color: isUserBlocked(seller.id) ? colors.primaryDark : colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy(isUserBlocked(seller.id) ? "Engeli kaldır" : "Kullanıcıyı engelle", language)}</Text></Pressable>
                ) : null}
              </View>
            </View>
            ) : null}
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <WebFooter />
        </View>
      </ScrollView>
    );
  }

  // ── DAR EKRAN (mobil web) ── 2026-11-23 yeniden tasarım: kompakt başlık kartı + YAPIŞKAN sekme çubuğu
  // (Ürünler / Hakkında / Yorumlar / Politikalar) + mağaza-içi arama ve açılır sıralama. Eskiden her bölüm alt
  // alta diziliyordu: ürünlere ulaşmak için ~2 ekran kaydırmak ve üç sıra çip geçmek gerekiyordu.
  const mobileTabs: Array<{ key: MobileTab; label: string; count?: number }> = [
    { key: "listings", label: translateCopy("Ürünler", language), count: activeListings.length },
    { key: "about", label: translateCopy("Hakkında", language) },
    { key: "reviews", label: translateCopy("Yorumlar", language), count: reviewCount },
    { key: "policies", label: translateCopy("Politikalar", language) }
  ];
  const blocked = isUserBlocked(seller.id);
  const metaBits = [seller.city, memberLabel, activityLabel ? translateCopy(activityLabel, language) : null].filter(Boolean) as string[];
  function pickMobileTab(next: MobileTab) {
    haptic.selection();
    setMobileTab(next);
    // Başlık kartının altına inilmişse sekme çubuğu yerinde kalsın: yeni içerik en baştan görünsün.
    if (scrollYRef.current > heroHeightRef.current) scrollRef.current?.scrollTo({ y: heroHeightRef.current, animated: false });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
    <ScrollView
      ref={scrollRef}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={[1]}
      scrollEventThrottle={64}
      onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 104 }}
    >
      {/* 0 — BAŞLIK (SEO/JsonLd de burada: yapışkan indeks sabit kalsın diye koşullu çocuk üst düzeyde yok). */}
      <View onLayout={(e) => { heroHeightRef.current = e.nativeEvent.layout.height; }} style={{ gap: 12, paddingHorizontal: 12, paddingTop: 12 }}>
        {seller ? <TrustEntry userId={seller.id} /> : null}
        <Seo title={`${seller.name} — Mağaza ve ilanları | OrtakSat`} description={`${seller.name} OrtakSat mağazası: ${activeListings.length} aktif ilan. Ürünleri incele, ortak ol veya doğrudan satıcıyla iletişime geç.`} path={id ? `/store/${id}` : undefined} image={seller.avatar?.startsWith("http") ? seller.avatar : undefined} />
        <JsonLd id="store" json={JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Store",
          name: seller.name,
          url: `https://www.ortaksat.com/magaza/${seller.id}`,
          ...(seller.avatar?.startsWith("http") ? { image: seller.avatar } : {}),
          ...(reviewStats.count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviewStats.average, reviewCount: reviewStats.count, bestRating: 5, worstRating: 1 } } : {})
        })} />
        <StoreCover cover={seller.cover} height={112} radius={14} />
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, marginHorizontal: 4, marginTop: -54, padding: 14 }}>
          <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 12 }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.surface, borderRadius: 999, borderWidth: 3, marginTop: -44 }}>
              <UserAvatar uri={seller.avatar} name={seller.name} size={76} />
            </View>
            <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "flex-end", minWidth: 0 }}>
              {ratingValue != null ? <StatusPill label={`★ ${ratingText}`} tone="info" /> : <StatusPill label={translateCopy("Yeni mağaza", language)} tone="info" />}
              {seller.verifiedIdentity ? <StatusPill label={t("identityVerified")} tone="success" /> : null}
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
              <Text selectable numberOfLines={2} style={{ color: colors.ink, flexShrink: 1, fontSize: 20, fontWeight: "900", lineHeight: 25 }}>{seller.name}</Text>
              {seller.verifiedIdentity ? <MaterialCommunityIcons name="check-decagram" size={19} color={colors.info} /> : null}
            </View>
            <Text selectable numberOfLines={3} style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>
              {seller.bio || translateCopy("Satıcı mağazası", language)}
            </Text>
            {metaBits.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2 }}>
                {seller.city ? <MetaBit icon="map-marker-outline" text={seller.city} /> : null}
                {memberLabel ? <MetaBit icon="calendar-check-outline" text={memberLabel} /> : null}
                {activityLabel ? <MetaBit icon="clock-check-outline" text={translateCopy(activityLabel, language)} strong /> : null}
              </View>
            ) : null}
          </View>

          {/* Tek satır ölçüm şeridi — eski 2×3 kutu ızgarası başlığı ekranın tamamına yayıyordu. */}
          <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, flexDirection: "row", paddingVertical: 10 }}>
            <MobileStat value={ratingText} label={translateCopy("Puan", language)} />
            <MobileStat value={`${seller.successfulSales}`} label={translateCopy("Satış", language)} />
            <MobileStat value={`${activeListings.length}`} label={translateCopy("İlan", language)} />
            <MobileStat value={`${seller.followerCount}`} label={translateCopy("Takipçi", language)} last />
          </View>

          {isOwnStore ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><PrimaryButton href="/create" icon="plus">{translateCopy("Yeni ilan", language)}</PrimaryButton></View>
                <View style={{ flex: 1 }}><PrimaryButton href="/(tabs)/seller" tone="secondary" icon="storefront-outline">{translateCopy("Satıcı paneli", language)}</PrimaryButton></View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <IconAction href="/magaza-sirasi" icon="swap-vertical" label={translateCopy("Mağaza sırası", language)} />
                <IconAction href="/profile-edit" icon="image-edit-outline" label={translateCopy("Profil & kapak", language)} />
                <IconAction onPress={() => void shareStore()} icon="share-variant-outline" label={translateCopy("Paylaş", language)} />
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={handleFollow} accessibilityRole="button" accessibilityLabel={translateCopy(following ? "Takiptesin" : "Takip Et", language)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: following ? colors.surface : colors.primarySoft, borderColor: following ? colors.line : colors.primarySoft, borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 46, opacity: pressed ? 0.75 : 1 })}>
                  <MaterialCommunityIcons name={following ? "account-check" : "account-plus-outline"} size={18} color={colors.primaryDark} />
                  <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>{translateCopy(following ? "Takiptesin" : "Takip Et", language)}</Text>
                </Pressable>
                <Pressable onPress={messageSeller} accessibilityRole="button" accessibilityLabel={translateCopy("Mesaj gönder", language)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 46, opacity: pressed ? 0.85 : 1 })}>
                  <MaterialCommunityIcons name="message-text-outline" size={18} color="#FFFFFF" />
                  <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{translateCopy("Mesaj gönder", language)}</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {revealedPhone ? (
                  <Pressable onPress={() => void openUrlSafe(`tel:${trPhoneIntl(revealedPhone)}`)} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: colors.successSoft, borderColor: colors.success, borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 44 }}>
                    <MaterialCommunityIcons name="phone" size={17} color={colors.success} />
                    <Text selectable numberOfLines={1} style={{ color: colors.success, fontSize: 14, fontWeight: "900" }}>{revealedPhone}</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => void revealPhone()} accessibilityRole="button" accessibilityLabel={translateCopy("Numarayı Göster", language)} style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 44, opacity: pressed ? 0.75 : 1 })}>
                    <MaterialCommunityIcons name="phone-outline" size={17} color={colors.primaryDark} />
                    <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{revealingPhone ? "…" : translateCopy("Numarayı Göster", language)}</Text>
                  </Pressable>
                )}
                <SquareAction icon="share-variant-outline" label={translateCopy("Profili paylaş", language)} onPress={() => void shareStore()} />
                <SquareAction icon="flag-outline" label={translateCopy("Satıcıyı şikayet et", language)} onPress={() => void handleReportSeller()} />
                <SquareAction icon={blocked ? "account-check-outline" : "account-cancel-outline"} label={translateCopy(blocked ? "Engeli kaldır" : "Kullanıcıyı engelle", language)} onPress={() => handleToggleBlock()} active={blocked} />
              </View>
            </View>
          )}
        </View>
      </View>

      {/* 1 — YAPIŞKAN SEKME ÇUBUĞU */}
      <View style={{ backgroundColor: colors.background, borderBottomColor: colors.line, borderBottomWidth: 1, marginTop: 6 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 8 }}>
          {mobileTabs.map((tb) => {
            const on = mobileTab === tb.key;
            return (
              <Pressable key={tb.key} onPress={() => pickMobileTab(tb.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tb.label} style={{ alignItems: "center", borderBottomColor: on ? colors.primary : "transparent", borderBottomWidth: 2.5, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ color: on ? colors.primaryDark : colors.muted, fontSize: 14, fontWeight: "900" }}>{tb.label}</Text>
                {tb.count ? (
                  <View style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderRadius: 999, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ color: on ? "#FFFFFF" : colors.muted, fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900", textAlign: "center" }}>{tb.count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 2 — SEKME İÇERİĞİ */}
      <View style={{ gap: 12, paddingHorizontal: 12, paddingTop: 12 }}>
        {mobileTab === "listings" ? (
          <>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1, minWidth: 0 }}><StoreSearchBox value={storeQuery} onChange={setStoreQuery} language={language} /></View>
              <StoreSortButton value={storeSort} open={sortOpen} onToggle={() => setSortOpen((o) => !o)} language={language} compact />
            </View>
            {sortOpen ? <StoreSortPanel value={storeSort} onPick={(s) => { setStoreSort(s); setSortOpen(false); }} language={language} /> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
              <StoreFilterChip active={filter === "active"} icon="check-circle-outline" label="Aktif" onPress={() => setFilter("active")} />
              <StoreFilterChip active={filter === "partner"} icon="handshake-outline" label="Ortaklığa açık" onPress={() => setFilter("partner")} />
              <StoreFilterChip active={filter === "all"} icon="view-grid-outline" label="Tümü" onPress={() => setFilter("all")} />
            </ScrollView>
            <StoreCategoryBar categories={storeCategories} value={catFilter} onChange={setCatFilter} total={filteredByStatus.length} language={language} />
            <StoreResultLine count={sellerListings.length} query={storeQuery} onClear={() => setStoreQuery("")} isOwnStore={isOwnStore} language={language} />
            {sellerListings.length === 0 ? (
              queryKey ? (
                <EmptyState title={translateCopy("Sonuç yok", language)} body={translateCopy("Bu mağazada aramana uyan ürün bulunamadı. Farklı bir kelime dene.", language)} />
              ) : (
                <EmptyState title={translateCopy("Ürün yok", language)} body={isOwnStore ? translateCopy("İlk ilanını açınca mağazana ve ana pazara otomatik düşer.", language) : translateCopy("Bu mağazada şu an görünür ürün yok.", language)} />
              )
            ) : (
              <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: gridGap }}>
                {shownListings.map((listing, index) => (
                  <ListingCard key={listing.id} listing={listing} owner={seller} width={cardWidth} eager={index < 4} />
                ))}
              </View>
            )}
            <StoreLoadMore hidden={hiddenCount} onPress={() => setVisibleCount((n) => n + STORE_PAGE)} language={language} />
          </>
        ) : null}

        {mobileTab === "about" ? (
          <>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 16 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Hakkında", language)}</Text>
              <Text selectable style={{ color: colors.muted, fontSize: 14, fontWeight: "500", lineHeight: 21 }}>{seller.bio || translateCopy("Bu satıcı henüz bir açıklama eklememiş.", language)}</Text>
              <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 11, marginTop: 2, paddingTop: 12 }}>
                <DeskAboutRow icon="cart-check" label={translateCopy("Toplam satış", language)} value={`${seller.successfulSales}`} />
                {seller.responseRate > 0 ? <DeskAboutRow icon="lightning-bolt" label={translateCopy("Yanıt oranı", language)} value={`%${seller.responseRate}`} /> : null}
                {totalCommission > 0 ? <DeskAboutRow icon="tag-multiple-outline" label={translateCopy("Toplam komisyon havuzu", language)} value={money(totalCommission)} /> : null}
                <DeskAboutRow icon="shield-check" label={translateCopy("Satıcı güven puanı", language)} value={trust?.seller.score == null ? translateCopy("Henüz yok", language) : `%${trust.seller.score}`} />
                {memberLabel ? <DeskAboutRow icon="calendar-check-outline" label={translateCopy("Üyelik", language)} value={memberLabel} /> : null}
                {seller.city ? <DeskAboutRow icon="map-marker-outline" label={translateCopy("Konum", language)} value={seller.city} /> : null}
              </View>
            </View>

            {/* Ziyaretçi yalnız KAZANILMIŞ rozetleri görür; mağaza sahibi neleri kazanabileceğini de görür. */}
            {mobileBadges.length > 0 || (seller.expertiseCategories?.length ?? 0) > 0 ? (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 16 }}>
                {mobileBadges.length > 0 ? <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Doğrulama & rozetler", language)}</Text> : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                  {mobileBadges.map((b) => (
                    <View key={b.label} style={{ alignItems: "center", backgroundColor: b.on ? b.tint : colors.surfaceAlt, borderRadius: 999, flexDirection: "row", gap: 5, opacity: b.on ? 1 : 0.55, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <MaterialCommunityIcons name={b.on ? b.icon : "lock-outline"} size={13} color={b.on ? b.color : colors.subtle} />
                      <Text style={{ color: b.on ? b.color : colors.subtle, fontSize: 11.5, fontWeight: "800" }}>{b.label}</Text>
                    </View>
                  ))}
                </View>
                {seller.expertiseCategories && seller.expertiseCategories.length > 0 ? (
                  <View style={mobileBadges.length > 0 ? { borderTopColor: colors.line, borderTopWidth: 1, gap: 7, marginTop: 2, paddingTop: 10 } : { gap: 7 }}>
                    <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Uzmanlık alanları", language)}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                      {seller.expertiseCategories.map((cat) => (
                        <View key={cat} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <MaterialCommunityIcons name="star-four-points-outline" size={12} color={colors.primaryDark} />
                          <Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "800" }}>{translateCopy(cat, language)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {hasPartnerActivity ? (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 16 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                  <MaterialCommunityIcons name="handshake-outline" size={17} color={colors.primaryDark} />
                  <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Ortak karnesi", language)}</Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <PartnerScoreCell value={`${partnerBroughtSales}`} label={translateCopy("Getirdiği satış", language)} />
                  <PartnerScoreCell value={`${partnerActiveCount}`} label={translateCopy("Aktif ortaklık", language)} />
                  <PartnerScoreCell value={money(partnerEarned)} label={translateCopy("Kazandırdığı komisyon", language)} />
                  <PartnerScoreCell value={trust?.partner.score == null ? translateCopy("Henüz yok", language) : `%${trust.partner.score}`} label={translateCopy("Ortak güveni", language)} />
                </View>
              </View>
            ) : null}

            {activeListings.some((l) => l.partnershipMode !== "invite") && !isOwnStore ? (
              <Pressable onPress={() => { setFilter("partner"); pickMobileTab("listings"); }} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 16, flexDirection: "row", gap: 12, opacity: pressed ? 0.8 : 1, padding: 16 })}>
                <MaterialCommunityIcons name="handshake-outline" size={24} color={colors.primaryDark} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>{translateCopy("Bu mağazanın ürünlerini sat, komisyon kazan", language)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{translateCopy("Ortaklığa açık ürünleri gör", language)}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.primaryDark} />
              </Pressable>
            ) : null}
          </>
        ) : null}

        {mobileTab === "reviews" ? (
          <View style={{ gap: 10 }}>
            {reviewStats.count > 0 ? <RatingSummary stats={reviewStats} language={language} /> : null}
            {reviewCount > 1 ? <ReviewSortBar value={reviewSort} onChange={setReviewSort} language={language} /> : null}
            {reviewsAboutSeller.length === 0 ? (
              reviewPager.loading || reviewPager.error ? null : <EmptyState title={translateCopy("Henüz değerlendirme yok", language)} body={translateCopy("Değerlendirmeler yalnızca tamamlanmış bir satışın taraflarınca yazılabilir.", language)} />
            ) : (
              reviewsAboutSeller.map((r) => (
                <ReviewCard key={r.id} review={r} reviewerName={r.reviewerName ?? findUser(r.reviewerId)?.name} isSeller={isOwnStore} authed={isAuthed} onPatch={patchReview} onRemove={removeFetched} isMine={r.reviewerId === currentUser.id} onEdit={editReview} onDelete={deleteReview} onReport={reportReview} language={language} />
              ))
            )}
            <ReviewLoadMore hasMore={reviewPager.hasMore} loading={reviewPager.loading || reviewPager.loadingMore} error={reviewPager.error} onLoadMore={reviewPager.loadMore} onRetry={reviewPager.retry} language={language} />
          </View>
        ) : null}

        {mobileTab === "policies" ? <StorePolicies listings={activeListings} language={language} /> : null}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MetaBit({ icon, text, strong }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string; strong?: boolean }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
      <MaterialCommunityIcons name={icon} size={13} color={strong ? colors.primaryDark : colors.muted} />
      <Text style={{ color: strong ? colors.primaryDark : colors.muted, fontSize: 12, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

function MobileStat({ value, label, last }: { value: string; label: string; last?: boolean }) {
  return (
    <View style={{ alignItems: "center", borderRightColor: colors.line, borderRightWidth: last ? 0 : 1, flex: 1, gap: 2, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 17, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{value}</Text>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function SquareAction({ icon, label, onPress, active }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ alignItems: "center", backgroundColor: active ? colors.accentSoft : colors.surface, borderColor: active ? colors.accent : colors.line, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 44, opacity: pressed ? 0.7 : 1, width: 44 })}>
      <MaterialCommunityIcons name={icon} size={19} color={active ? colors.accent : colors.muted} />
    </Pressable>
  );
}

/** Mağaza sahibinin kısa yolları (ikon + kısa etiket). Bağlantı varsa router ile gider. */
function IconAction({ icon, label, href, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; href?: string; onPress?: () => void }) {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { if (onPress) onPress(); else if (href) router.push(href as never); }} style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 12, borderWidth: 1, flex: 1, gap: 4, justifyContent: "center", minHeight: 58, minWidth: 0, opacity: pressed ? 0.7 : 1, paddingHorizontal: 4 })}>
      <MaterialCommunityIcons name={icon} size={19} color={colors.primaryDark} />
      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 11.5, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function StoreSearchBox({ value, onChange, language, width }: { value: string; onChange: (v: string) => void; language: "tr" | "en"; width?: number }) {
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 42, paddingLeft: 13, paddingRight: 6, width }}>
      <MaterialCommunityIcons name="magnify" size={18} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={translateCopy("Mağazada ara", language)}
        placeholderTextColor={colors.subtle}
        returnKeyType="search"
        accessibilityLabel={translateCopy("Mağazada ara", language)}
        // 16px: iOS Safari odaklanınca sayfayı yakınlaştırmasın (bkz. mobil-web tuzakları).
        style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "600", minWidth: 0, paddingVertical: 8, outlineStyle: "none" } as never}
      />
      {value ? (
        <Pressable onPress={() => onChange("")} accessibilityRole="button" accessibilityLabel={translateCopy("Aramayı temizle", language)} hitSlop={8} style={{ padding: 4 }}>
          <MaterialCommunityIcons name="close-circle" size={17} color={colors.subtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

function StoreSortButton({ value, open, onToggle, language, compact }: { value: StoreSort; open: boolean; onToggle: () => void; language: "tr" | "en"; compact?: boolean }) {
  const current = SORT_OPTIONS.find((o) => o.key === value) ?? SORT_OPTIONS[0];
  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${translateCopy("Sırala", language)}: ${translateCopy(current.label, language)}`} style={({ pressed }) => ({ alignItems: "center", backgroundColor: open ? colors.primarySoft : colors.surface, borderColor: open ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 42, opacity: pressed ? 0.75 : 1, paddingHorizontal: 13 })}>
      <MaterialCommunityIcons name="sort" size={17} color={colors.primaryDark} />
      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{compact ? translateCopy("Sırala", language) : translateCopy(current.label, language)}</Text>
      <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
    </Pressable>
  );
}

function StoreSortPanel({ value, onPick, language, narrow }: { value: StoreSort; onPick: (s: StoreSort) => void; language: "tr" | "en"; narrow?: boolean }) {
  return (
    <View style={{ ...(narrow ? { alignSelf: "flex-end" as const, width: 260 } : null), backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, overflow: "hidden" }}>
      {SORT_OPTIONS.map((o, i) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onPick(o.key)} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => ({ alignItems: "center", backgroundColor: on ? colors.primarySoft : pressed ? colors.surfaceAlt : colors.surface, borderTopColor: colors.line, borderTopWidth: i === 0 ? 0 : 1, flexDirection: "row", gap: 10, minHeight: 46, paddingHorizontal: 14 })}>
            <MaterialCommunityIcons name={o.icon} size={17} color={on ? colors.primaryDark : colors.muted} />
            <Text style={{ color: on ? colors.primaryDark : colors.ink, flex: 1, fontSize: 14, fontWeight: on ? "900" : "700" }}>{translateCopy(o.label, language)}</Text>
            {on ? <MaterialCommunityIcons name="check" size={18} color={colors.primaryDark} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function StoreResultLine({ count, query, onClear, isOwnStore, language }: { count: number; query: string; onClear: () => void; isOwnStore: boolean; language: "tr" | "en" }) {
  const router = useRouter();
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
      <Text style={{ color: colors.muted, flex: 1, fontSize: 13, fontWeight: "800" }}>
        {query.trim() ? `"${query.trim()}" — ${count} ${translateCopy("ürün", language)}` : `${count} ${translateCopy("ürün", language)}`}
      </Text>
      {query.trim() ? (
        <Pressable onPress={onClear} accessibilityRole="button"><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Temizle", language)}</Text></Pressable>
      ) : isOwnStore ? (
        <Pressable onPress={() => router.push("/magaza-sirasi")} accessibilityRole="button" style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
          <MaterialCommunityIcons name="swap-vertical" size={15} color={colors.primaryDark} />
          <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Sırayı düzenle", language)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StoreLoadMore({ hidden, onPress, language }: { hidden: number; onPress: () => void; language: "tr" | "en" }) {
  if (hidden <= 0) return null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", alignSelf: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, marginTop: 4, minHeight: 44, opacity: pressed ? 0.75 : 1, paddingHorizontal: 22 })}>
      <MaterialCommunityIcons name="chevron-down" size={18} color={colors.primaryDark} />
      <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Daha fazla göster", language)} ({hidden})</Text>
    </Pressable>
  );
}

// Mağaza kapağı: satıcı kendi kapağını yüklediyse o, yoksa herkes için aynı olan standart kapak.
function StoreCover({ cover, height = 150, radius = 0 }: { cover?: string; height?: number; radius?: number }) {
  return (
    <View style={{ backgroundColor: colors.primaryDark, borderRadius: radius, height, overflow: "hidden" }}>
      <ProfileCoverImage uri={cover} priority="high" style={{ height: "100%", width: "100%" }} />
      <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.primaryDark, opacity: 0.38 }} />
    </View>
  );
}

// Mağaza politikaları: satıcının AKTİF ilanlarındaki gerçek alanlardan derlenir
// (sahte veri yok). Aracı-platform/para-tutmaz uyarısı her zaman görünür.
function StorePolicies({ listings, language }: { listings: Listing[]; language: "tr" | "en" }) {
  const tr = (s: string) => translateCopy(s, language);
  const returnDays = listings.map((l) => l.returnWindowDays).filter((d) => d > 0);
  const minReturn = returnDays.length ? Math.min(...returnDays) : 0;
  const maxReturn = returnDays.length ? Math.max(...returnDays) : 0;
  const dueDays = listings.map((l) => l.commissionDueDays).filter((d) => d > 0);
  const minDue = dueDays.length ? Math.min(...dueDays) : 0;
  const maxDue = dueDays.length ? Math.max(...dueDays) : 0;
  const deliveryNotes = Array.from(new Set(listings.map((l) => (l.deliveryNote || "").trim()).filter(Boolean))).slice(0, 4);
  const contactLabels: Record<string, string> = { whatsapp: "WhatsApp", phone: tr("Telefon"), message: tr("Uygulama içi mesaj") };
  const contacts = Array.from(new Set(listings.map((l) => l.contactMethod))).map((c) => contactLabels[c] ?? c);
  const partnerRules = Array.from(new Set(listings.flatMap((l) => l.partnerRules || []).map((r) => r.trim()).filter(Boolean))).slice(0, 6);

  const returnText = returnDays.length === 0 ? tr("İlana göre değişir") : minReturn === maxReturn ? `${minReturn} ${tr("gün")}` : `${minReturn}–${maxReturn} ${tr("gün")}`;
  const dueText = dueDays.length === 0 ? tr("Satışta belirlenir") : minDue === maxDue ? `${minDue} ${tr("gün")}` : `${minDue}–${maxDue} ${tr("gün")}`;

  return (
    <View style={{ gap: 12 }}>
      <PolicyCard icon="cash-remove" title={tr("Ödeme modeli")} tone="warn" body={tr("OrtakSat bir aracı platformdur — para tutmaz, ödeme almaz. Ödeme, teslimat ve iade tamamen alıcı ile satıcı arasında yapılır. Görüşmeyi uygulama içi mesajdan yürütmen önerilir.")} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <PolicyStat icon="backup-restore" title={tr("İade süresi")} value={returnText} />
        <PolicyStat icon="cash-clock" title={tr("Komisyon vadesi")} value={dueText} />
        <PolicyStat icon="phone-outline" title={tr("İletişim")} value={contacts.length ? contacts.join(" · ") : tr("Uygulama içi mesaj")} />
      </View>
      {deliveryNotes.length > 0 ? (
        <PolicyCard icon="truck-outline" title={tr("Teslimat / kargo")} list={deliveryNotes} />
      ) : (
        <PolicyCard icon="truck-outline" title={tr("Teslimat / kargo")} body={tr("Teslimat koşulları ilana göre değişir; ilan sayfasındaki teslimat notuna bak veya satıcıya sor.")} />
      )}
      {partnerRules.length > 0 ? <PolicyCard icon="handshake-outline" title={tr("Ortaklık kuralları")} list={partnerRules} /> : null}
      <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600", lineHeight: 17 }}>{tr("Bu politikalar satıcının aktif ilanlarından derlenmiştir. Kesin koşullar için ilgili ilanı incele.")}</Text>
    </View>
  );
}

function PolicyCard({ icon, title, body, list, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body?: string; list?: string[]; tone?: "warn" }) {
  const warn = tone === "warn";
  return (
    <View style={{ backgroundColor: warn ? colors.warningSoft : colors.surface, borderColor: warn ? colors.warning : colors.line, borderRadius: 16, borderWidth: 1, gap: 8, padding: 18 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name={icon} size={19} color={warn ? colors.warning : colors.primaryDark} />
        <Text style={{ color: colors.ink, fontSize: 15.5, fontWeight: "900" }}>{title}</Text>
      </View>
      {body ? <Text style={{ color: warn ? colors.warning : colors.muted, fontSize: 13.5, fontWeight: "500", lineHeight: 20 }}>{body}</Text> : null}
      {list ? list.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
          <MaterialCommunityIcons name="check-circle" size={15} color={colors.success} style={{ marginTop: 3 }} />
          <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "500", lineHeight: 20 }}>{item}</Text>
        </View>
      )) : null}
    </View>
  );
}

function PolicyStat({ icon, title, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; value: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 150, flexGrow: 1, gap: 6, padding: 14 }}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{title}</Text>
      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function StoreFilterChip({ active, icon, label, onPress }: { active?: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  const { language } = useLanguage();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={translateCopy(label, language)}
      style={({ pressed }) => ({
        alignItems: "center",
        // İÇERİK-BOYUTU (Trendyol filtre pill'i): eskiden flex:1 → tam-genişlik grid'de
        // her çip 1/3 genişliğe gerilip devleşiyordu. Artık içerik kadar, sola hizalı, sarar.
        backgroundColor: active ? colors.primary : colors.surface,
        borderColor: active ? colors.primary : colors.line,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: "row",
        gap: 6,
        justifyContent: "center",
        minHeight: 40,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 14
      })}
    >
      <MaterialCommunityIcons name={icon} size={15} color={active ? "#FFFFFF" : colors.primary} />
      <Text numberOfLines={1} style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "900" }}>
        {translateCopy(label, language)}
      </Text>
    </Pressable>
  );
}

/** Mağaza-içi kategori filtresi (Trendyol): satıcının ürünleri ≥2 kategorideyse yatay çip barı.
 *  Her çip kategori adı + adet rozeti; "Tümü" varsayılan. Tek kategoride HİÇ render olmaz (kalabalık yok). */
function StoreCategoryBar({ categories, value, onChange, total, language }: { categories: Array<[string, number]>; value: string; onChange: (v: string) => void; total: number; language: "tr" | "en" }) {
  if (categories.length < 2) return null;
  const Chip = ({ label, count, on, onPress }: { label: string; count: number; on: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label} style={({ pressed }) => ({ alignItems: "center", backgroundColor: on ? colors.primarySoft : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.72 : 1, paddingHorizontal: 13, paddingVertical: 8 })}>
      <Text numberOfLines={1} style={{ color: on ? colors.primaryDark : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
      <View style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderRadius: 999, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1 }}>
        <Text style={{ color: on ? "#FFFFFF" : colors.muted, fontSize: 10.5, fontVariant: ["tabular-nums"], fontWeight: "900", textAlign: "center" }}>{count}</Text>
      </View>
    </Pressable>
  );
  return (
    <ScrollView style={{ flexGrow: 0 }} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingVertical: 1 }}>
      <Chip label={translateCopy("Tümü", language)} count={total} on={value === "all"} onPress={() => onChange("all")} />
      {categories.map(([c, n]) => <Chip key={c} label={translateCopy(c, language)} count={n} on={value === c} onPress={() => onChange(c)} />)}
    </ScrollView>
  );
}

function DeskProfileStat({ value, label, last }: { value: string; label: string; last?: boolean }) {
  return (
    <View style={{ alignItems: "center", borderRightColor: colors.line, borderRightWidth: last ? 0 : 1, flex: 1, gap: 3 }}>
      <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function PartnerScoreCell({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ backgroundColor: colors.primarySoft, borderRadius: 12, flexBasis: 130, flexGrow: 1, gap: 3, padding: 13 }}>
      <Text style={{ color: colors.primaryDark, fontSize: 19, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function DeskAboutRow({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
      <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

