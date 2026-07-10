import { createContext, PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";

import {
  conversations as initialConversations,
  currentUserId,
  favorites as initialFavorites,
  leads as initialLeads,
  listings as initialListings,
  messages as initialMessages,
  notifications as initialNotifications,
  orders as initialOrders,
  partnerships as initialPartnerships,
  reviews as initialReviews,
  sales as initialSales,
  users as initialUsers
} from "@/data/mock-data";
import { logActivity } from "@/lib/audit";
import { getInitialAuthUrl, handleSupabaseAuthUrl, subscribeToAuthUrls } from "@/lib/auth-links";
import { registerFavoriteToggle, syncFavorites } from "@/lib/favorites-cache";
import { syncSavedForUser } from "@/lib/saved-searches";
import { commissionAmount, effectiveCommissionAmount, listingInviteCode, moneyIn, msgStamp } from "@/lib/format";
import {
  deleteFavorite,
  ensureProfile,
  createSupportTicketLive,
  followSellerLive,
  unfollowSellerLive,
  loadMyFollowsLive,
  insertFavorite,
  insertLead,
  insertListing,
  insertConversation,
  insertMessage,
  insertNotification,
  partnerJoinLive,
  insertReport,
  insertReview,
  insertSaleFromLead,
  isLiveUser,
  makeUuid,
  markMessageReadLive,
  markNotificationReadLive,
  updateLeadStatusLive,
  updateListingLive,
  updateListingStatusLive,
  updateListingStockPriceLive,
  updateListingInventoryLive,
  updatePartnershipStatus,
  setPartnershipCommissionLive,
  updateReportStatusLive,
  updateProfileLive,
  savePreferencesLive,
  saveEmailNotificationsLive,
  recordLegalConsentLive,
  requestAccountDeletionLive,
  deleteListingLive,
  updateListingFeaturedLive,
  insertBulkNotifications,
  updateAnnouncementLive,
  saveBlogPostLive,
  deleteBlogPostLive,
  saveContentPageLive,
  saveSeoSettingLive,
  saveCategoryLive,
  deleteCategoryLive,
  fetchHiddenCategories,
  setHiddenCategoryLive,
  bulkInsertCategoriesLive,
  updatePlatformSettingLive,
  updateUserRoleLive,
  updateUserStatusLive,
  updateUserVerificationLive,
  updateSaleStatusLive,
  recordPayoutLive,
  insertCategorySuggestion,
  insertLocationSuggestion,
  updateCategorySuggestionStatusLive,
  updateLocationSuggestionStatusLive
} from "@/lib/live-service";
import { rateLimit } from "@/lib/rate-limit";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { loadAccountSnapshot, loadAdminSnapshot, loadBlogPosts, loadCategories, loadContentPages, loadMarketplacePage, loadMarketplaceSnapshot, loadOwnListings, loadPlatformSettings, loadSeoSettings, loadSuggestions, parseNotifMeta, type DbBlogPost, type DbContentPage, type DbSeoSetting, type ExtraCategory } from "@/lib/supabase-data";
import { categoryTree as baseCategoryTree, setHiddenCategories as setHiddenCategoriesModule, type CategoryNode } from "@/lib/category-tree";
import { displayText, repairTurkishText } from "@/lib/text";
import { firstError, isValidEmail, validateSignIn, validateSignUp } from "@/lib/validation";
import type {
  Conversation,
  Favorite,
  Lead,
  CategorySuggestion,
  LeadStatus,
  Listing,
  LocationSuggestion,
  Message,
  Notification,
  NotificationMeta,
  Order,
  Partnership,
  PlatformSettings,
  Report,
  Review,
  ReviewType,
  Sale,
  SaleStatus,
  SuggestionStatus,
  User,
  UserRole
} from "@/lib/types";

type NewListingInput = Pick<
  Listing,
  | "title"
  | "description"
  | "salesPitch"
  | "shareTemplates"
  | "adAssets"
  | "tags"
  | "price"
  | "currency"
  | "commissionType"
  | "commissionValue"
  | "commissionTiers"
  | "bonusAmount"
  | "bonusQuota"
  | "category"
  | "location"
  | "provinceId"
  | "districtId"
  | "neighborhoodId"
  | "addressVisibility"
  | "locationNote"
  | "image"
  | "stockCount"
  | "minPartnerRating"
  | "commissionDueDays"
  | "returnWindowDays"
  | "partnerRules"
  | "deliveryNote"
  | "contactMethod"
  | "partnershipMode"
  | "attributes"
>;

type PartnershipApplicationInput = {
  shareChannel: string;
  audience: string;
  platformHandle: string;
  reachEstimate: number;
  note: string;
  inviteCode: string;
};

type SaleFromLeadInput = {
  amount: number;
  quantity: number;
  deliveryStatus: Order["status"];
};

const LEGAL_CONSENT_VERSION = "2026-06-11";
const LEGAL_DOCUMENT_TYPES = ["privacy", "terms", "kvkk", "seller_rules"] as const;

// Supabase/GoTrue İngilizce hata mesajlarını Türkçeye çevirir (site Türkçe).
function translateAuthError(msg?: string | null): string | undefined {
  if (!msg) return undefined;
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-posta veya şifre hatalı.";
  if (m.includes("email not confirmed")) return "E-posta adresin henüz doğrulanmadı. Gelen kutundaki 6 haneli kodu gir.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Bu e-posta ile zaten bir hesap var. Giriş yapabilirsin.";
  if (m.includes("password should be at least") || m.includes("password is too short")) return "Şifre çok kısa — en az 8 karakter olmalı.";
  if (m.includes("weak password") || m.includes("password should contain")) return "Şifre yeterince güçlü değil (büyük/küçük harf, rakam, özel karakter).";
  if (m.includes("unable to validate email") || m.includes("invalid format") || m.includes("email address") && m.includes("invalid")) return "Geçerli bir e-posta adresi gir.";
  if (m.includes("for security purposes") || m.includes("rate limit") || m.includes("too many requests")) return "Çok sık denendi. Lütfen biraz sonra tekrar dene.";
  if (m.includes("token has expired") || m.includes("otp_expired") || m.includes("invalid token") || m.includes("expired or is invalid")) return "Kod hatalı veya süresi dolmuş. Yeniden kod iste.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Yeni kayıtlar şu anda geçici olarak kapalı.";
  if (m.includes("user not found")) return "Bu e-posta ile kayıt bulunamadı.";
  if (m.includes("email link is invalid") || m.includes("otp") && m.includes("invalid")) return "Doğrulama bağlantısı/kodu geçersiz. Yeniden dene.";
  if (m.includes("network") || m.includes("failed to fetch")) return "Bağlantı sorunu. İnternetini kontrol edip tekrar dene.";
  if (m.includes("provider") && m.includes("not enabled")) return "Bu giriş yöntemi henüz etkin değil.";
  return msg; // bilinmeyen mesaj — olduğu gibi (nadiren İngilizce görünebilir)
}

// Google ile (ilk kez) girişte zımni yasal onayı kaydeder: buton altındaki
// "Google ile devam ederek ... kabul etmiş olursun" bilgilendirmesiyle verilir.
// localStorage kilidiyle kullanıcı başına yalnız bir kez çalışır (upsert zaten idempotent).
async function recordGoogleConsentOnce(userId: string) {
  try {
    if (typeof window !== "undefined") {
      const key = `ortaksat.legal.${userId}`;
      if (window.localStorage.getItem(key) === "1") return;
      window.localStorage.setItem(key, "1");
    }
    await Promise.all(LEGAL_DOCUMENT_TYPES.map((documentType) => recordLegalConsentLive(userId, documentType)));
  } catch {
    /* yasal kayıt kritik akışı bozmamalı */
  }
}

type AppStore = {
  backendMode: "mock" | "supabase";
  authReady: boolean;
  authError?: string;
  currentUser: User;
  isAuthenticated: boolean;
  pendingVerifyEmail: string | null;
  clearPendingVerify: () => void;
  users: User[];
  listings: Listing[];
  marketplaceHasMore: boolean;
  marketplaceLoadingMore: boolean;
  marketplaceInitialLoading: boolean;
  // İlk yükleme başarısız oldu (ağ/sunucu) → boş sayfa yerine "yeniden dene" göster.
  marketplaceLoadFailed: boolean;
  loadMoreMarketplace: () => void;
  refreshMarketplace: () => Promise<void>;
  retryMarketplace: () => Promise<void>;
  // Kritik akış yazımı canlıda başarısız olduğunda dolan görünür hata (UI Alert gösterir).
  syncError: string | null;
  clearSyncError: () => void;
  partnerships: Partnership[];
  leads: Lead[];
  sales: Sale[];
  orders: Order[];
  reviews: Review[];
  favorites: Favorite[];
  conversations: Conversation[];
  messages: Message[];
  notifications: Notification[];
  reports: Report[];
  platformSettings: PlatformSettings;
  updatePlatformSetting: (key: keyof PlatformSettings, value: boolean) => void;
  setAnnouncement: (text: string, active: boolean) => void;
  blogPosts: DbBlogPost[];
  contentPages: DbContentPage[];
  seoSettings: DbSeoSetting[];
  saveBlogPost: (post: DbBlogPost) => void;
  deleteBlogPost: (id: string) => void;
  saveContentPage: (page: DbContentPage) => void;
  saveSeoSetting: (setting: DbSeoSetting) => void;
  categoryTree: CategoryNode[];
  extraCategories: ExtraCategory[];
  saveCategory: (c: ExtraCategory) => void;
  deleteCategory: (id: string) => void;
  importCategories: (items: ExtraCategory[]) => number;
  hiddenCategories: string[];
  toggleHiddenCategory: (key: string) => void;
  emailVerified: boolean;
  isSuspended: boolean;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (input: { email: string; password: string; name: string }) => Promise<boolean>;
  resetPasswordWithEmail: (email: string) => Promise<boolean>;
  updatePasswordWithEmail: (password: string) => Promise<boolean>;
  resetPasswordWithCode: (email: string, code: string, newPassword: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  resendEmailCode: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  signOutAllDevices: () => Promise<boolean>;
  updateProfile: (input: Pick<User, "name" | "phone" | "avatar" | "bio">) => Promise<boolean>;
  savePreferences: (preferences: Record<string, boolean | string | number>) => Promise<boolean>;
  setEmailNotifications: (enabled: boolean) => Promise<boolean>;
  reportListing: (listingId: string, reason: string, details?: string) => Promise<boolean>;
  reportUser: (reportedUserId: string, reason: string, details?: string) => Promise<boolean>;
  // Self-service doğrulama talebi: kullanıcı kendi hesabı için doğrulama ister →
  // admin moderasyon kuyruğunda "DOĞRULAMA TALEBİ" olarak görünür, admin onaylar.
  requestVerification: (note?: string) => Promise<boolean>;
  updateReportStatus: (reportId: string, status: Report["status"]) => Promise<boolean>;
  recordLegalConsent: (documentType: "privacy" | "terms" | "kvkk" | "seller_rules") => Promise<boolean>;
  createSupportTicket: (subject: string, message: string) => Promise<boolean>;
  requestAccountDeletion: (reason: string) => Promise<boolean>;
  createListing: (input: NewListingInput, statusOverride?: Listing["status"]) => Listing;
  updateListing: (listingId: string, input: NewListingInput) => Promise<boolean>;
  createLead: (input: Omit<Lead, "id" | "createdAt" | "status">) => Lead | undefined;
  createReview: (listingId: string, rating: number, comment: string) => Review | undefined;
  createSaleReview: (saleId: string, rating: number, comment: string) => Review | undefined;
  canReviewSale: (saleId: string) => boolean;
  createSaleFromLead: (leadId: string, input?: Partial<SaleFromLeadInput>) => Sale | undefined;
  recordSaleForPartner: (partnershipId: string, input?: Partial<SaleFromLeadInput> & { buyerName?: string }) => Sale | undefined;
  joinListing: (listingId: string, input?: Partial<PartnershipApplicationInput>) => Partnership | undefined;
  approvePartnership: (partnershipId: string) => void;
  rejectPartnership: (partnershipId: string, reason?: string) => void;
  endPartnership: (partnershipId: string, mode?: "blocked" | "cancelled") => void;
  setPartnershipCommission: (partnershipId: string, type?: "rate" | "fixed", value?: number) => void;
  toggleFavorite: (listingId: string) => void;
  followedSellerIds: string[];
  isFollowing: (sellerId: string) => boolean;
  toggleFollow: (sellerId: string) => void;
  startConversation: (listingId: string, receiverId: string, body?: string) => Conversation | undefined;
  sendMessage: (listingId: string, receiverId: string, body: string) => void;
  sendConversationMessage: (conversationId: string, body: string, attachment?: { url: string; type: "image" | "file"; name?: string }) => void;
  markConversationRead: (conversationId: string) => void;
  markNotificationRead: (notificationId: string) => void;
  categorySuggestions: CategorySuggestion[];
  locationSuggestions: LocationSuggestion[];
  addCategorySuggestion: (input: { suggestedPath: string; note?: string; listingId?: string }) => void;
  addLocationSuggestion: (input: { provinceId?: number; districtId?: number; suggestedName: string; note?: string }) => void;
  setCategorySuggestionStatus: (id: string, status: SuggestionStatus) => void;
  setLocationSuggestionStatus: (id: string, status: SuggestionStatus) => void;
  updateLeadStatus: (leadId: string, status: LeadStatus) => void;
  updateListingStatus: (listingId: string, status: Listing["status"]) => void;
  updateListingInventory: (listingId: string, patch: { stockCount?: number; price?: number }) => void;
  setListingFeatured: (listingId: string, featured: boolean) => void;
  deleteListing: (listingId: string) => void;
  setUserRole: (userId: string, role: UserRole) => void;
  setUserStatus: (userId: string, status: NonNullable<User["status"]>) => void;
  setUserVerification: (userId: string, field: "verifiedPhone" | "verifiedIdentity", value: boolean) => void;
  adminNotifyUser: (userId: string, title: string, body: string) => void;
  adminBroadcast: (title: string, body: string) => void;
  updateSaleStatus: (saleId: string, status: SaleStatus, reason?: string) => void;
  recordBatchPayout: (partnerId: string, listingId?: string) => void;
  findConversation: (id: string) => Conversation | undefined;
  findListing: (id: string) => Listing | undefined;
  findUser: (id: string) => User | undefined;
  findPartnership: (listingId: string, partnerId?: string) => Partnership | undefined;
  isFavorite: (listingId: string) => boolean;
};

export const StoreContext = createContext<AppStore | null>(null);

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeRefCode(userId: string, listingId: string) {
  const seed = Math.floor(1000 + Math.random() * 9000);
  return `${userId.slice(0, 5).toUpperCase()}-${listingId.slice(0, 5).toUpperCase()}-${seed}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string, live: boolean) {
  return live ? makeUuid() : `${prefix}-${Date.now()}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR"))
    .join("");
}

function userFromAuth(id: string, phone?: string | null, name?: string | null): User {
  const displayName = name || phone || "Ortaksat kullanıcısı";

  return {
    id,
    name: displayName,
    phone: phone ?? "",
    avatar: initials(displayName) || "OS",
    bio: "Ortaksat canlı kullanıcı profili.",
    verifiedPhone: Boolean(phone),
    verifiedIdentity: false,
    verifiedInstagram: false,
    rating: 0,
    listingCount: 0,
    successfulSales: 0,
    followerCount: 0,
    responseRate: 0,
    role: "user"
  };
}

// incoming id'leri prev'i EZER (admin tam verisi mevcut kısmi veriyi gunceller).
function mergeById<T extends { id: string }>(prev: T[], incoming: T[]): T[] {
  const map = new Map(prev.map((x) => [x.id, x]));
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values());
}

// Canlı modda oturum açılmadan gezerken kullanılan misafir kullanıcı.
const ANON_USER: User = {
  id: "anon",
  name: "Misafir",
  phone: "",
  avatar: "MS",
  bio: "",
  verifiedPhone: false,
  verifiedIdentity: false,
  rating: 0,
  listingCount: 0,
  successfulSales: 0,
  followerCount: 0,
  responseRate: 0
};

export function StoreProvider({ children }: PropsWithChildren) {
  const [backendMode, setBackendMode] = useState<"mock" | "supabase">("mock");
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authError, setAuthError] = useState<string | undefined>();
  // CANLI mod (Supabase ayarlı): hiçbir demo/mock veri yüklenmez — her şey gerçek
  // veriyle Supabase'den gelir. Yalnızca yerel önizlemede (Supabase yokken) demo veri.
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  // Kayıt olup henüz e-posta kodunu girmemiş kullanıcının e-postası (kod ekranı için).
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>(isSupabaseConfigured ? [] : initialUsers);
  const [listings, setListings] = useState<Listing[]>(isSupabaseConfigured ? [] : initialListings);
  const [partnerships, setPartnerships] = useState(isSupabaseConfigured ? [] : initialPartnerships);
  const [leads, setLeads] = useState(isSupabaseConfigured ? [] : initialLeads);
  const [sales, setSales] = useState(isSupabaseConfigured ? [] : initialSales);
  const [orders, setOrders] = useState(isSupabaseConfigured ? [] : initialOrders);
  const [reviews, setReviews] = useState(isSupabaseConfigured ? [] : initialReviews);
  const [favorites, setFavorites] = useState(isSupabaseConfigured ? [] : initialFavorites);
  const [followedSellerIds, setFollowedSellerIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState(isSupabaseConfigured ? [] : initialConversations);
  const [messages, setMessages] = useState(isSupabaseConfigured ? [] : initialMessages);
  const [notifications, setNotifications] = useState(isSupabaseConfigured ? [] : initialNotifications);
  const [reports, setReports] = useState<Report[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    allowSignups: true,
    reviewBeforePublish: false,
    requireEmailVerification: false,
    maintenanceMode: false,
    announcement: "",
    announcementActive: false
  });
  // Katalog sayfalama (sunucu tarafli). mpOffsetRef = simdiye kadar cekilen
  // katalog ilan sayisi; hasMore = daha var mi; loadingMore = yukleme kilidi.
  const mpOffsetRef = useRef(0);
  // refreshMarketplace ile loadMore yarışını engelleyen kuşak sayacı: refresh sayacı artırır,
  // uçuştaki loadMore sonucu kuşak değiştiyse yok sayılır (offset kayması/boşluk önlenir).
  const mpGenRef = useRef(0);
  // Hesap-özeti hangi kullanıcı için yüklendi: aynı kullanıcı için (TOKEN_REFRESHED, çift
  // INITIAL_SESSION) 10 tabloyu YENİDEN yükleyip iyi veriyi ezmeyi önler.
  const loadedAccountUserRef = useRef<string | null>(null);
  const [marketplaceHasMore, setMarketplaceHasMore] = useState(isSupabaseConfigured);
  const [marketplaceLoadingMore, setMarketplaceLoadingMore] = useState(false);
  // İlk ilan yüklemesi sürerken skeleton göstermek için (yalnız canlı modda).
  const [marketplaceInitialLoading, setMarketplaceInitialLoading] = useState(isSupabaseConfigured);
  // İlk yükleme başarısız (snapshot null / ağ hatası) → "yeniden dene" durumu.
  const [marketplaceLoadFailed, setMarketplaceLoadFailed] = useState(false);
  // Kritik akışlarda arka plan Supabase yazımı başarısız olursa kullanıcıya gösterilecek hata.
  const [syncError, setSyncError] = useState<string | null>(null);
  const [blogPosts, setBlogPosts] = useState<DbBlogPost[]>([]);
  const [contentPages, setContentPages] = useState<DbContentPage[]>([]);
  const [seoSettings, setSeoSettings] = useState<DbSeoSetting[]>([]);
  const [extraCategories, setExtraCategories] = useState<ExtraCategory[]>([]);
  const [hiddenCategories, setHiddenCategoriesState] = useState<string[]>([]);
  // Preview (no-Supabase) auth registry so register/login/logout work end-to-end in demo mode.
  const [mockAccounts, setMockAccounts] = useState<Record<string, { password: string; user: User }>>({});

  // Çıkışta kullanıcıya ÖZEL (private) durumları temizle → aynı tarayıcıda sıradaki
  // kullanıcı/oturum önceki kullanıcının konuşma/mesaj/favori/ortaklık/talep/satış/
  // bildirim verisini GÖRMESİN. Herkese açık listings/reviews korunur (public feed).
  const resetPrivateState = () => {
    setConversations([]);
    setMessages([]);
    setFavorites([]);
    setFollowedSellerIds([]);
    setPartnerships([]);
    setLeads([]);
    setSales([]);
    setNotifications([]);
  };
  // Öneriler: canlıda boş başlar (gerçek kullanıcı önerileriyle dolar), önizlemede örnek.
  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>(
    isSupabaseConfigured ? [] : [
      { id: "cs-1", userId: "u-owner-2", userName: "Örnek Kullanıcı", suggestedPath: "El Sanatları > Seramik Atölye Ürünleri", note: "Örnek öneri.", status: "pending", createdAt: "2026-06-20" }
    ]
  );
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>(
    isSupabaseConfigured ? [] : [
      { id: "ls-1", userId: "u-owner-1", userName: "Örnek Kullanıcı", provinceId: 34, districtId: 34001, suggestedName: "Örnek Mahalle", type: "neighborhood", note: "Örnek öneri.", status: "pending", createdAt: "2026-06-21" }
    ]
  );

  useEffect(() => {
    let mounted = true;

    async function hydrateFromSupabase() {
      if (!isSupabaseConfigured) return;
      try {
        const snapshot = await loadMarketplaceSnapshot();
        if (!mounted) return;
        if (!snapshot) {
          // Ağ/sunucu hatası veya boş yanıt → boş sayfa yerine "yeniden dene".
          setMarketplaceLoadFailed(true);
          return;
        }
        // Canlı: yalnızca gerçek Supabase verisi (demo/mock birleştirme yok).
        setMarketplaceLoadFailed(false);
        setUsers(snapshot.users);
        setListings(snapshot.listings);
        mpOffsetRef.current = snapshot.listings.length;
        setMarketplaceHasMore(snapshot.listings.length >= 90);
        setBackendMode("supabase");
        // İkincil veriler (ayar/blog/kategori): biri hata verse bile ilanlar yüklendi;
        // her birini ayrı sararak birinin hatası diğerlerini engellemesin.
        const settings = await loadPlatformSettings().catch(() => null);
        if (mounted && settings) setPlatformSettings(settings);
        const [posts, pages, seo, cats, hidden] = await Promise.all([
          loadBlogPosts().catch(() => []),
          loadContentPages().catch(() => []),
          loadSeoSettings().catch(() => null),
          loadCategories().catch(() => []),
          fetchHiddenCategories().catch(() => [])
        ]);
        if (!mounted) return;
        setBlogPosts(posts);
        setContentPages(pages);
        if (seo) setSeoSettings(seo);
        setExtraCategories(cats);
        setHiddenCategoriesModule(hidden);
        setHiddenCategoriesState(hidden);
      } catch {
        if (mounted) setMarketplaceLoadFailed(true);
      } finally {
        // Ne olursa olsun skeleton'ı kapat — sonsuz yükleme yaşanmasın.
        if (mounted) setMarketplaceInitialLoading(false);
      }
    }

    hydrateFromSupabase();

    return () => {
      mounted = false;
    };
  }, []);

  // Admin/moderator girişinde TUM ilanlar (her statu) + kullanicilar yuklenir
  // (moderasyon, arama, yonetim icin). RLS admin disindakine sinirli veri verir.
  useEffect(() => {
    const role = authUser?.role;
    if (!supabase || (role !== "admin" && role !== "moderator" && role !== "super_admin")) return;
    let alive = true;
    void loadAdminSnapshot().then((snap) => {
      if (!alive || !snap) return;
      if (snap.listings.length) setListings((prev) => mergeById(prev, snap.listings));
      if (snap.users.length) setUsers((prev) => mergeById(prev, snap.users));
    });
    return () => { alive = false; };
  }, [authUser?.role, authUser?.id]);

  // Her girişli kullanıcı KENDİ ilanlarını (her statü) yükler → satıcı reload'da
  // onay-bekleyen/duraklatılmış/toplu-yüklenen ilanlarını satıcı panosunda görür
  // (katalog snapshot'ı yalnız active çeker). RLS owner=self ile sınırlar.
  // ÖNEMLİ: hydrate (loadMarketplaceSnapshot) listings'i REPLACE ediyor; bu yüzden
  // kendi ilanları hydrate BİTTİKTEN sonra merge edilir, yoksa üzerine yazılır.
  useEffect(() => {
    const uid = authUser?.id;
    if (!supabase || !uid || marketplaceInitialLoading) return;
    let alive = true;
    void loadOwnListings(uid).then((own) => {
      if (!alive || !own.length) return;
      setListings((prev) => mergeById(prev, own));
    });
    return () => { alive = false; };
  }, [authUser?.id, marketplaceInitialLoading]);

  useEffect(() => {
    if (!supabase) return;

    void getInitialAuthUrl().then((url) => {
      if (url) void handleSupabaseAuthUrl(url);
    });

    return subscribeToAuthUrls((url) => {
      void handleSupabaseAuthUrl(url);
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    async function loadProfile(userId: string, fallbackPhone?: string | null, fallbackName?: string | null) {
      const fallback = userFromAuth(userId, fallbackPhone, fallbackName);
      const { data, error } = await supabase!
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      const profile: User =
        data && !error
          ? {
              id: data.id,
              name: data.full_name,
              phone: data.phone ?? fallback.phone,
              avatar: data.avatar_url || fallback.avatar,
              bio: data.bio ?? fallback.bio,
              verifiedPhone: data.verified_phone,
              verifiedIdentity: data.verified_identity,
              verifiedInstagram: Boolean(data.verified_instagram),
              rating: Number(data.rating ?? 0),
              listingCount: 0,
              successfulSales: Number(data.successful_sales ?? 0),
              followerCount: Number(data.follower_count ?? 0),
              responseRate: data.response_rate ?? 0,
              role: data.role ?? "user",
              status: (data.status as User["status"]) ?? "active",
              emailNotifications: data.email_notifications ?? true,
              preferences: (data.preferences ?? {}) as Record<string, boolean>
            }
          : fallback;

      await ensureProfile(profile).catch(() => {});
      if (!mounted) return;
      // AUTH'U ÖNCE ATA: hesap-özeti (10 tablo) yavaş yüklenirken ya da bir tablosu hata
      // verirken kullanıcı "misafir" görünmesin / oturumu kaybolmuş sanılmasın. Eskiden
      // setAuthUser 4 zincirli await SONRASINDA çağrılıyordu; biri patlarsa auth hiç kurulmuyordu.
      setAuthUser(profile);
      setBackendMode("supabase");
      setUsers((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
      // OLAY-KAPISI: hesap-özetini (10 tablo) yalnız kullanıcı DEĞİŞTİĞİNDE / ilk yüklemede çek.
      // Aynı kullanıcı için tekrar (TOKEN_REFRESHED ~saatlik, mount'ta çift INITIAL_SESSION)
      // yeniden yükleme, bir dilim timeout/hata ile [] dönünce açık sohbet/satış gibi İYİ veriyi
      // EZİYORDU. Realtime + optimistic yazımlar veriyi zaten güncel tutar. Senkron claim →
      // mount'taki eşzamanlı iki çağrı da dedup edilir.
      const alreadyLoaded = loadedAccountUserRef.current === profile.id;
      if (alreadyLoaded) return;
      loadedAccountUserRef.current = profile.id;
      void syncSavedForUser(profile.id); // kayıtlı aramaları sunucuyla senkronla (cihazlar arası)
      // Hesap verisi + öneriler + takipler: her biri BAĞIMSIZ dirençli — biri patlasa diğerleri yüklenir.
      const [account, suggestions, myFollows] = await Promise.all([
        loadAccountSnapshot(profile.id).catch(() => null),
        loadSuggestions().catch(() => ({ categorySuggestions: [], locationSuggestions: [] })),
        loadMyFollowsLive(profile.id).catch(() => [] as string[])
      ]);
      if (!mounted) return;
      setFollowedSellerIds(myFollows);
      // Kategori/konum önerileri (RLS: kendi + admin hepsi) — kalıcı yüklensin.
      setCategorySuggestions(suggestions.categorySuggestions);
      setLocationSuggestions(suggestions.locationSuggestions);
      if (account) {
        setPartnerships(account.partnerships);
        setLeads(account.leads);
        setSales(account.sales);
        setOrders(account.orders);
        setReviews((items) => [...account.reviews, ...items.filter((item) => item.reviewerId !== profile.id)]);
        setFavorites(account.favorites);
        setConversations(account.conversations);
        setMessages(account.messages);
        setNotifications(account.notifications);
        setReports(account.reports);
      } else {
        // Toplam hata (ağ) → hiç veri yüklenmedi; ref'i sıfırla ki sonraki auth olayı yeniden denesin
        // (ezme riski yok: ortada ezilecek yüklenmiş veri yok).
        loadedAccountUserRef.current = null;
      }
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError(translateAuthError(error.message));
      const user = data.session?.user;
      if (user) {
        setEmailVerified(Boolean(user.email_confirmed_at));
        if (user.app_metadata?.provider === "google") void recordGoogleConsentOnce(user.id);
        void loadProfile(user.id, user.phone, user.user_metadata?.full_name).catch((e) => console.warn("loadProfile failed", e));
      } else if (mounted) {
        setAuthUser(null);
        setEmailVerified(false);
      }
      if (mounted) setAuthReady(true);
    }).catch((e) => {
      // Ağ reddinde (getSession fetch timeout/kopuk) authReady askıda kalmasın → UI kilitlenmesin.
      console.warn("getSession failed", e);
      if (mounted) setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user) {
        setEmailVerified(Boolean(user.email_confirmed_at));
        if (user.app_metadata?.provider === "google") void recordGoogleConsentOnce(user.id);
        void loadProfile(user.id, user.phone, user.user_metadata?.full_name).catch((e) => console.warn("loadProfile failed", e));
      } else {
        setAuthUser(null);
        setEmailVerified(false);
        loadedAccountUserRef.current = null; // çıkış → sonraki giriş hesap-özetini yeniden yüklesin
        void syncSavedForUser(null); // kayıtlı aramaları temizle (paylaşılan tarayıcı gizliliği)
        // Oturum başka bir yolla kapandıysa (token süresi, başka sekmede çıkış) da
        // özel veriyi temizle → sonraki kullanıcıya sızmasın.
        resetPrivateState();
      }
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);


  useEffect(() => {
    if (!supabase || !authUser) return;
    const client = supabase;

    const channel = client
      .channel(`account-realtime-${authUser.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row || !Array.isArray(row.participant_ids) || !row.participant_ids.includes(authUser.id)) return;
          const conversation: Conversation = {
            id: row.id,
            listingId: row.listing_id,
            sellerId: row.seller_id,
            buyerId: row.buyer_id ?? undefined,
            partnerId: row.partner_id ?? undefined,
            participantIds: row.participant_ids,
            status: row.status,
            lastMessageAt: row.last_message_at ? msgStamp(row.last_message_at) : msgStamp(row.created_at),
            createdAt: msgStamp(row.created_at)
          };
          setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
        }
      )
      .on(
        "postgres_changes",
        // INSERT + UPDATE: yeni mesajı ekler, `read=true` güncellemesini yansıtır
        // (böylece gönderenin "✓✓ okundu" göstergesi canlı güncellenir).
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row || (row.sender_id !== authUser.id && row.receiver_id !== authUser.id)) return;
          const message: Message = {
            id: row.id,
            conversationId: row.conversation_id ?? `${row.listing_id}-${row.sender_id}-${row.receiver_id}`,
            listingId: row.listing_id,
            senderId: row.sender_id,
            receiverId: row.receiver_id,
            body: row.body,
            createdAt: msgStamp(row.created_at),
            read: row.read,
            attachmentUrl: row.attachment_url ?? undefined,
            attachmentType: row.attachment_type ?? undefined,
            attachmentName: row.attachment_name ?? undefined
          };
          setMessages((items) => {
            const idx = items.findIndex((item) => item.id === message.id);
            if (idx >= 0) {
              // UPDATE (ör. okundu bilgisi) — mevcut mesajı yerinde güncelle.
              const next = items.slice();
              next[idx] = message;
              return next;
            }
            return [message, ...items];
          });
          // Gerçek-zamanlı gelen mesaj, konuşmanın son-mesaj zamanını da güncellesin
          // (yoksa gelen kutusu sıralaması ve gösterilen saat bayat kalır).
          setConversations((items) => items.map((item) => (item.id === message.conversationId ? { ...item, lastMessageAt: message.createdAt } : item)));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${authUser.id}` },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row) return;
          const notification: Notification = {
            id: row.id,
            userId: row.user_id,
            type: row.type,
            title: row.title,
            body: row.body,
            read: row.read,
            createdAt: row.created_at.slice(0, 16).replace("T", " "),
            metadata: parseNotifMeta(row.metadata)
          };
          setNotifications((items) => [notification, ...items.filter((item) => item.id !== notification.id)]);
        }
      )
      // partnerships/leads/commissions: filtre YOK — RLS aboneye yalnizca gorme
      // yetkisi olan satirlari teslim eder (hem ortak hem satici tarafi).
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partnerships" },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row) return;
          const partnership: Partnership = {
            id: row.id,
            listingId: row.listing_id,
            partnerId: row.partner_id,
            refCode: row.ref_code,
            status: row.status,
            note: row.note,
            shareChannel: row.share_channel ?? undefined,
            audience: row.audience ?? undefined,
            platformHandle: row.platform_handle ?? undefined,
            reachEstimate: row.reach_estimate ?? undefined,
            rejectionReason: row.rejection_reason ?? undefined,
            approvedAt: row.approved_at?.slice(0, 10),
            createdAt: row.created_at.slice(0, 10)
          };
          setPartnerships((items) => [partnership, ...items.filter((item) => item.id !== partnership.id)]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row) return;
          const lead: Lead = {
            id: row.id,
            listingId: row.listing_id,
            partnershipId: row.partnership_id,
            buyerName: row.buyer_name,
            buyerPhone: row.buyer_phone,
            note: row.note,
            source: row.source,
            intent: row.intent,
            status: row.status,
            createdAt: row.created_at.slice(0, 10)
          };
          setLeads((items) => [lead, ...items.filter((item) => item.id !== lead.id)]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commissions" },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row) return;
          const sale: Sale = {
            id: row.id,
            listingId: row.listing_id,
            partnershipId: row.partnership_id,
            leadId: row.lead_id ?? "",
            amount: Number(row.sale_amount ?? row.amount ?? 0),
            quantity: Number(row.quantity ?? 1),
            commissionAmount: Number(row.amount ?? 0),
            status: row.status,
            buyerName: row.buyer_name ?? undefined,
            deliveryStatus: row.delivery_status ?? undefined,
            returnUntil: row.return_until?.slice(0, 10),
            approvedAt: row.approved_at?.slice(0, 10),
            paidAt: row.paid_at?.slice(0, 10),
            sellerMarkedPaidAt: row.seller_marked_paid_at?.slice(0, 10),
            partnerConfirmedPaidAt: row.partner_confirmed_paid_at?.slice(0, 10),
            payoutNote: row.payout_note ?? undefined
          };
          setSales((items) => [sale, ...items.filter((item) => item.id !== sale.id)]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings" },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row) return;
          setPlatformSettings({
            allowSignups: row.allow_signups ?? true,
            reviewBeforePublish: row.review_before_publish ?? false,
            requireEmailVerification: row.require_email_verification ?? false,
            maintenanceMode: row.maintenance_mode ?? false,
            announcement: row.announcement ?? "",
            announcementActive: row.announcement_active ?? false
          });
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [authUser]);
  const value = useMemo<AppStore>(() => {
    // Canlı (Supabase) modda oturum yoksa misafir kullanıcı: kullanıcı giriş
    // yapmadan gezebilir; aksiyonlar (ilan ver, favori, mesaj) /auth'a yönlenir.
    const currentUser = authUser ?? (isSupabaseConfigured ? ANON_USER : (users.find((user) => user.id === currentUserId) ?? users[0] ?? ANON_USER));
    const liveUser = isLiveUser(currentUser);
    // Personel (admin/moderatör): ortaklık onayı/reddi ve komisyon anlaşmazlığı
    // gibi normalde satıcı/ortağa özel aksiyonları panelden yönetebilir (override).
    const staff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
    const isAuthenticated = isSupabaseConfigured ? authUser != null : true;
    // Askiya alinmis kullanici hicbir islem (ilan/mesaj/ortaklik/talep/favori)
    // yapamaz; RLS'e ek istemci koruması.
    const isSuspended = currentUser.status === "suspended" || currentUser.status === "deleted";

    // O(1) arama için id->kayit haritalari. find* bunlari kullanir; boylece
    // liste render'larinda (binlerce kart) O(n) lineer arama -> O(1) olur.
    const userById = new Map(users.map((u) => [u.id, u]));
    const listingById = new Map(listings.map((l) => [l.id, l]));
    const conversationById = new Map(conversations.map((c) => [c.id, c]));

    function createOrReuseConversation(listingId: string, receiverId: string, body?: string) {
      if (isSuspended) return undefined;
      const listing = listings.find((item) => item.id === listingId);
      if (!listing || listing.demo || receiverId === currentUser.id) return undefined;
      const existing = conversations.find(
        (item) => item.listingId === listingId && item.participantIds.includes(currentUser.id) && item.participantIds.includes(receiverId)
      );
      const now = msgStamp();
      const conversation: Conversation = existing ?? {
        id: newId("c", liveUser),
        listingId,
        sellerId: listing.ownerId,
        buyerId: listing.ownerId === currentUser.id ? receiverId : currentUser.id,
        partnerId: partnerships.find((item) => item.listingId === listingId && [currentUser.id, receiverId].includes(item.partnerId))?.partnerId,
        participantIds: [currentUser.id, receiverId],
        status: "open",
        lastMessageAt: now,
        createdAt: now
      };
      if (!existing) {
        setConversations((items) => [conversation, ...items]);
        if (liveUser) void insertConversation(conversation);
      }
      if (body?.trim()) {
        const message: Message = {
          id: newId("m", liveUser),
          conversationId: conversation.id,
          listingId,
          senderId: currentUser.id,
          receiverId,
          body: body.trim(),
          createdAt: now,
          read: false
        };
        setMessages((items) => [message, ...items]);
        setConversations((items) => items.map((item) => (item.id === conversation.id ? { ...item, lastMessageAt: message.createdAt } : item)));
        notify(receiverId, "message", "Yeni mesaj", `${currentUser.name}: ${message.body}`);
        if (liveUser) persistCritical(insertMessage(message), () => {
          setMessages((items) => items.filter((m) => m.id !== message.id));
        }, "Mesaj gönderilemedi. Bağlantını kontrol edip tekrar dene.");
      }
      return conversation;
    }
    function notify(userId: string, type: Notification["type"], title: string, body: string, metadata?: NotificationMeta) {
      const notification: Notification = {
        id: newId("n", liveUser),
        userId,
        type,
        title,
        body,
        read: false,
        createdAt: today(),
        // Derin-link için metadata (ilan/ortaklık) — bildirim merkezi tıklanınca yönlendirir.
        ...(metadata ? { metadata } : {})
      };
      setNotifications((items) => [notification, ...items]);
      if (liveUser) void insertNotification(notification);
    }
    // Kritik yazımlar için güvenlik: canlı Supabase yazımı başarısız (false/exception)
    // olursa optimistik yerel değişikliği GERİ AL (rollback) ve görünür hata göster.
    // Yalnız canlı modda çağrılır; demo/mock modda mevcut local-only davranış korunur.
    function persistCritical(write: Promise<boolean>, rollback: () => void, message: string) {
      write
        .then((ok) => { if (!ok) { rollback(); setSyncError(message); } })
        .catch(() => { rollback(); setSyncError(message); });
    }
    // Rollback'i karmaşık/gereksiz olan (ör. admin moderasyonu — sahip reload'da
    // gerçeği görür) yazımlar için: hata olursa yalnız görünür uyarı göster.
    function persistOrWarn(write: Promise<boolean>, message: string) {
      write
        .then((ok) => { if (!ok) setSyncError(message); })
        .catch(() => setSyncError(message));
    }

    return {
      backendMode,
      authReady,
      authError,
      syncError,
      clearSyncError() { setSyncError(null); },
      currentUser,
      isAuthenticated,
      pendingVerifyEmail,
      clearPendingVerify() { setPendingVerifyEmail(null); },
      users,
      listings,
      partnerships,
      leads,
      sales,
      orders,
      reviews,
      favorites,
      conversations,
      messages,
      notifications,
      reports,
      async signInWithEmail(email, password) {
        const sv = validateSignIn({ email, password });
        if (!sv.ok) {
          setAuthError(firstError(sv) ?? "Bilgileri kontrol edin.");
          return false;
        }
        const rl = await rateLimit("signin");
        if (!rl.allowed) {
          setAuthError(rl.reason);
          return false;
        }
        if (!supabase) {
          const cleanEmail = email.trim().toLowerCase();
          const acct = mockAccounts[cleanEmail];
          if (!acct || acct.password !== password) {
            setAuthError("E-posta veya şifre hatalı. (Önizleme modunda önce kayıt olun.)");
            return false;
          }
          setAuthError(undefined);
          setAuthUser(acct.user);
          setUsers((items) => [acct.user, ...items.filter((item) => item.id !== acct.user.id)]);
          return true;
        }
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        setAuthError(translateAuthError(error?.message));
        if (data.user) {
          const profile = userFromAuth(data.user.id, data.user.phone, data.user.user_metadata?.full_name ?? data.user.email);
          await ensureProfile(profile);
          setAuthUser(profile);
          setUsers((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
          void logActivity("sign_in", { userId: profile.id });
        }
        return !error;
      },
      async signUpWithEmail(input) {
        if (!platformSettings.allowSignups) {
          setAuthError("Yeni kayıtlar şu anda geçici olarak kapalıdır. Lütfen daha sonra tekrar deneyin.");
          return false;
        }
        const sv = validateSignUp({ name: input.name, email: input.email, password: input.password });
        if (!sv.ok) {
          setAuthError(firstError(sv) ?? "Bilgileri kontrol edin.");
          return false;
        }
        const rl = await rateLimit("signup");
        if (!rl.allowed) {
          setAuthError(rl.reason);
          return false;
        }
        if (!supabase) {
          const cleanEmail = input.email.trim().toLowerCase();
          const displayName = input.name.trim() || cleanEmail;
          if (mockAccounts[cleanEmail]) {
            setAuthError("Bu e-posta ile zaten kayıt var. Giriş yapabilirsin.");
            return false;
          }
          const mockUser: User = {
            id: `mock-${cleanEmail}`,
            name: displayName,
            phone: "",
            avatar: displayName.slice(0, 2).toLocaleUpperCase("tr-TR"),
            bio: "",
            verifiedPhone: false,
            verifiedIdentity: false,
            rating: 5,
            listingCount: 0,
            successfulSales: 0,
            followerCount: 0,
            responseRate: 100
          };
          setMockAccounts((m) => ({ ...m, [cleanEmail]: { password: input.password, user: mockUser } }));
          setAuthError(undefined);
          return true;
        }
        const cleanEmail = input.email.trim().toLowerCase();
        const displayName = input.name.trim() || cleanEmail;
        const legalAcceptedAt = new Date().toISOString();
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: input.password,
          options: {
            data: {
              full_name: displayName,
              legal_terms_accepted: true,
              legal_accepted_at: legalAcceptedAt,
              legal_version: LEGAL_CONSENT_VERSION
            },
            // Web'de doğrulama linki tarayıcıya (siteye) dönmeli; native şemaya
            // (ortaksat://) sabitlenirse mobil-web kullanıcısı e-postadaki linki
            // tarayıcıda açamaz ve hesabını onaylayamaz.
            emailRedirectTo:
              typeof window !== "undefined" ? `${window.location.origin}/auth` : "ortaksat://auth"
          }
        });
        setAuthError(translateAuthError(error?.message));
        if (data.session?.user) {
          const profile = userFromAuth(data.session.user.id, data.session.user.phone, displayName);
          await ensureProfile(profile);
          await Promise.all(LEGAL_DOCUMENT_TYPES.map((documentType) => recordLegalConsentLive(profile.id, documentType)));
          setAuthUser(profile);
          setUsers((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
          void logActivity("sign_up", { userId: profile.id });
        } else if (!error) {
          // Oturum dönmedi = Supabase "Confirm signup" açık. Kullanıcıya e-posta
          // KODU gitti; kod ekranına geçilir (link beklemek/uygulama değiştirmek yok).
          setPendingVerifyEmail(cleanEmail);
        }
        return !error;
      },
      async resetPasswordWithEmail(email) {
        if (!isValidEmail(email)) {
          setAuthError("Geçerli bir e-posta girin.");
          return false;
        }
        const rl = await rateLimit("password_reset");
        if (!rl.allowed) {
          setAuthError(rl.reason);
          return false;
        }
        if (!supabase) {
          // Preview mode: simulate sending a reset link (no real email backend).
          setAuthError(undefined);
          return true;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          // Web'de şifre sıfırlama linki siteye dönmeli (native şema tarayıcıda açılmaz).
          redirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/auth` : "ortaksat://auth"
        });
        setAuthError(translateAuthError(error?.message));
        return !error;
      },
      async updatePasswordWithEmail(password) {
        if (!supabase) {
          // Preview mode: update the password of the currently signed-in mock account.
          const entry = Object.entries(mockAccounts).find(([, v]) => v.user.id === authUser?.id);
          if (entry) setMockAccounts((m) => ({ ...m, [entry[0]]: { ...m[entry[0]], password } }));
          setAuthError(undefined);
          return true;
        }
        const { error } = await supabase.auth.updateUser({ password });
        setAuthError(translateAuthError(error?.message));
        return !error;
      },
      // Şifremi unuttum — KOD ile (link/uygulama-değiştirme yok): e-postaya gelen
      // kurtarma kodu + yeni şifre aynı ekranda girilir. (Supabase "Reset password"
      // şablonunda {{ .Token }} bulunmalı ki link değil KOD gitsin.)
      async resetPasswordWithCode(email, code, newPassword) {
        if (!supabase) { setAuthError("Kod ile sıfırlama yalnızca canlı modda çalışır."); return false; }
        if (newPassword.length < 6) { setAuthError("Yeni şifre en az 6 karakter olmalı."); return false; }
        const cleanEmail = email.trim().toLowerCase();
        const token = code.replace(/\D/g, "");
        if (token.length < 6) { setAuthError("6 haneli kodu eksiksiz gir."); return false; }
        const { error: vErr } = await supabase.auth.verifyOtp({ email: cleanEmail, token, type: "recovery" });
        if (vErr) { setAuthError(vErr.message); return false; }
        const { error: uErr } = await supabase.auth.updateUser({ password: newPassword });
        setAuthError(uErr?.message);
        return !uErr;
      },
      async signInWithGoogle() {
        if (!supabase) {
          setAuthError("Google ile giriş yalnızca canlı (Supabase) modda çalışır.");
          return false;
        }
        // Web'de tarayıcı Google'a yönlenir, dönüşte onAuthStateChange oturumu yakalar.
        const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth` : "ortaksat://auth";
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo }
        });
        if (error) {
          // Sağlayıcı Supabase'de etkin değilse anlaşılır mesaj göster.
          setAuthError(
            /provider.*not enabled|not enabled|unsupported/i.test(error.message)
              ? "Google ile giriş henüz etkin değil. Yönetici panelinden Google sağlayıcısını açın."
              : error.message
          );
          return false;
        }
        setAuthError(undefined);
        return true;
      },
      // E-posta doğrulama KODU ile: kayıt sonrası kullanıcı e-postasına gelen 6 haneli
      // kodu aynı ekranda girer; link/uygulama-değiştirme yok. Supabase native (harici
      // SMS/e-posta şirketi gerekmez). Not: Supabase panelinde "Confirm signup" e-posta
      // şablonunda {{ .Token }} bulunmalı ki kullanıcıya link değil KOD gitsin.
      async verifyEmailCode(email, code) {
        if (!supabase) { setAuthError("Kod doğrulama yalnızca canlı modda çalışır."); return false; }
        const cleanEmail = email.trim().toLowerCase();
        const token = code.replace(/\D/g, "");
        if (token.length < 6) { setAuthError("6 haneli kodu eksiksiz gir."); return false; }
        const { data, error } = await supabase.auth.verifyOtp({ email: cleanEmail, token, type: "signup" });
        setAuthError(translateAuthError(error?.message));
        if (error || !data.session?.user) return false;
        const displayName = (data.session.user.user_metadata?.full_name as string) || cleanEmail;
        const profile = userFromAuth(data.session.user.id, data.session.user.phone, displayName);
        await ensureProfile(profile);
        setAuthUser(profile);
        setUsers((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
        setPendingVerifyEmail(null);
        void logActivity("sign_up", { userId: profile.id });
        return true;
      },
      async resendEmailCode(email) {
        if (!supabase) return false;
        const rl = await rateLimit("signup");
        if (!rl.allowed) { setAuthError(rl.reason); return false; }
        const cleanEmail = email.trim().toLowerCase();
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: cleanEmail,
          options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth` : "ortaksat://auth" }
        });
        setAuthError(translateAuthError(error?.message));
        return !error;
      },
      async signOut() {
        if (supabase) await supabase.auth.signOut();
        setAuthUser(null);
        resetPrivateState();
      },
      // Tüm cihazlardan çıkış: sunucudaki tüm refresh token'ları geçersiz kılar
      // (scope: "global"). Bu cihazdaki oturum da kapanır.
      async signOutAllDevices() {
        if (!supabase) { setAuthUser(null); resetPrivateState(); return true; }
        void logActivity("sign_out", { userId: authUser?.id, metadata: { scope: "global" } });
        const { error } = await supabase.auth.signOut({ scope: "global" });
        setAuthUser(null);
        resetPrivateState();
        if (error) { setAuthError(translateAuthError(error.message)); return false; }
        return true;
      },
      async savePreferences(preferences) {
        const merged = { ...(currentUser.preferences ?? {}), ...preferences };
        const updatedUser: User = { ...currentUser, preferences: merged };
        const ok = liveUser ? await savePreferencesLive(currentUser.id, merged) : true;
        if (!ok) { setAuthError("Tercihler kaydedilemedi."); return false; }
        setUsers((items) => [updatedUser, ...items.filter((item) => item.id !== updatedUser.id)]);
        if (authUser?.id === updatedUser.id) setAuthUser(updatedUser);
        return true;
      },
      async setEmailNotifications(enabled) {
        const updatedUser: User = { ...currentUser, emailNotifications: enabled };
        const ok = liveUser ? await saveEmailNotificationsLive(currentUser.id, enabled) : true;
        if (!ok) { setAuthError("E-posta bildirim tercihi kaydedilemedi."); return false; }
        setUsers((items) => [updatedUser, ...items.filter((item) => item.id !== updatedUser.id)]);
        if (authUser?.id === updatedUser.id) setAuthUser(updatedUser);
        return true;
      },
      async updateProfile(input) {
        const nextPhone = input.phone.trim();
        const phoneChanged = nextPhone !== currentUser.phone;
        const updatedUser: User = {
          ...currentUser,
          name: input.name.trim() || currentUser.name,
          phone: nextPhone,
          avatar: input.avatar.trim() || currentUser.avatar,
          bio: input.bio.trim(),
          verifiedPhone: phoneChanged ? false : currentUser.verifiedPhone
        };
        const ok = liveUser ? await updateProfileLive(updatedUser) : true;
        if (!ok) {
          setAuthError("Profil güncellenemedi. Lütfen tekrar dene.");
          return false;
        }
        setAuthError(undefined);
        setUsers((items) => [updatedUser, ...items.filter((item) => item.id !== updatedUser.id)]);
        if (authUser?.id === updatedUser.id) setAuthUser(updatedUser);
        return true;
      },
      async reportListing(listingId, reason, details) {
        if (!liveUser) {
          setAuthError("Bildirim göndermek için e-posta ile giriş yapmalısın.");
          return false;
        }
        const reportId = await insertReport({
          reporterId: currentUser.id,
          listingId,
          reason,
          details
        });
        if (reportId) {
          setReports((items) => [
            {
              id: reportId,
              reporterId: currentUser.id,
              listingId,
              reason,
              details: details ?? "",
              status: "open",
              createdAt: today()
            },
            ...items
          ]);
        }
        return Boolean(reportId);
      },
      async reportUser(reportedUserId, reason, details) {
        if (!liveUser) {
          setAuthError("Bildirim göndermek için e-posta ile giriş yapmalısın.");
          return false;
        }
        if (reportedUserId === currentUser.id) return false;
        const reportId = await insertReport({ reporterId: currentUser.id, reportedUserId, reason, details });
        if (reportId) {
          setReports((items) => [
            { id: reportId, reporterId: currentUser.id, reportedUserId, reason, details: details ?? "", status: "open", createdAt: today() },
            ...items
          ]);
        }
        return Boolean(reportId);
      },
      async requestVerification(note) {
        if (!liveUser) { setAuthError("Doğrulama talebi için e-posta ile giriş yapmalısın."); return false; }
        // Zaten açık bir talebi varsa tekrar oluşturma (spam engeli).
        const existing = reports.find((r) => r.reporterId === currentUser.id && r.reportedUserId === currentUser.id && r.reason.startsWith("DOĞRULAMA TALEBİ") && r.status === "open");
        if (existing) return true;
        const reason = "DOĞRULAMA TALEBİ";
        const details = note?.trim() || "Kullanıcı hesap doğrulaması (kimlik/telefon) talep ediyor.";
        // reports RLS: reporter_id=auth.uid() → self-talep DB'de geçerli.
        const reportId = await insertReport({ reporterId: currentUser.id, reportedUserId: currentUser.id, reason, details });
        if (reportId) {
          setReports((items) => [
            { id: reportId, reporterId: currentUser.id, reportedUserId: currentUser.id, reason, details, status: "open", createdAt: today() },
            ...items
          ]);
        }
        return Boolean(reportId);
      },
      async updateReportStatus(reportId, status) {
        const report = reports.find((item) => item.id === reportId);
        if (!report) return false;
        if (!liveUser || !["admin", "moderator", "super_admin"].includes(currentUser.role ?? "")) return false;
        const ok = await updateReportStatusLive(report, status, currentUser.id);
        if (ok) {
          setReports((items) =>
            items.map((item) =>
              item.id === reportId
                ? {
                    ...item,
                    status,
                    resolvedBy: status === "resolved" || status === "rejected" ? currentUser.id : item.resolvedBy,
                    resolvedAt: status === "resolved" || status === "rejected" ? today() : item.resolvedAt
                  }
                : item
            )
          );
        }
        return ok;
      },
      async recordLegalConsent(documentType) {
        if (!liveUser) {
          setAuthError("Rıza kaydı için e-posta ile giriş yapmalısın.");
          return false;
        }
        return recordLegalConsentLive(currentUser.id, documentType);
      },
      async createSupportTicket(subject, message) {
        if (!liveUser) {
          setAuthError("Destek talebi için e-posta ile giriş yapmalısın.");
          return false;
        }
        if (!subject.trim() || !message.trim()) return false;
        return createSupportTicketLive({ userId: currentUser.id, subject: subject.trim(), message: message.trim() });
      },
      async requestAccountDeletion(reason) {
        if (!liveUser) {
          setAuthError("Hesap silme talebi için e-posta ile giriş yapmalısın.");
          return false;
        }
        return requestAccountDeletionLive({ userId: currentUser.id, reason: reason.trim() || "Kullanıcı hesap silme talebi oluşturdu." });
      },
      createListing(input, statusOverride) {
        const id = newId("l", liveUser);
        // Admin "yayindan once incele" acikken (moderasyon zaten pending/rejected
        // demediyse) tum yeni ilanlar pending_review'a duser.
        const resolvedStatus: Listing["status"] =
          statusOverride === "pending_review" || statusOverride === "rejected"
            ? statusOverride
            : platformSettings.reviewBeforePublish
              ? "pending_review"
              : statusOverride ?? "active";
        const listing: Listing = {
          ...input,
          id,
          ownerId: currentUser.id,
          title: displayText(input.title),
          description: repairTurkishText(input.description),
          salesPitch: input.salesPitch.map(repairTurkishText),
          tags: input.tags.map(repairTurkishText),
          category: displayText(input.category),
          location: displayText(input.location),
          partnerRules: input.partnerRules.map(repairTurkishText),
          deliveryNote: repairTurkishText(input.deliveryNote),
          slug: `${slugify(input.title)}-${id.slice(0, 8)}`,
          status: resolvedStatus,
          partnerCount: 0,
          leadCount: 0,
          favoriteCount: 0,
          reviewCount: 0,
          createdAt: today()
        };
        setListings((items) => [listing, ...items]);
        if (liveUser) {
          persistCritical(insertListing(listing), () => {
            setListings((items) => items.filter((l) => l.id !== listing.id));
          }, "İlan kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
          void logActivity("listing_create", { userId: currentUser.id, entityType: "listing", entityId: listing.id, metadata: { status: listing.status, category: listing.category } });
        }
        return listing;
      },
      async updateListing(listingId, input) {
        const listing = listings.find((item) => item.id === listingId);
        if (!listing || listing.ownerId !== currentUser.id) return false;
        const updatedListing: Listing = {
          ...listing,
          ...input,
          // Düzenleme formu kademeli komisyonu sağlamıyorsa mevcut kademeleri KORU (silme).
          commissionTiers: input.commissionTiers ?? listing.commissionTiers,
          title: displayText(input.title),
          description: repairTurkishText(input.description),
          salesPitch: input.salesPitch.map(repairTurkishText),
          tags: input.tags.map(repairTurkishText),
          category: displayText(input.category),
          location: displayText(input.location),
          partnerRules: input.partnerRules.map(repairTurkishText),
          deliveryNote: repairTurkishText(input.deliveryNote),
          slug: listing.slug
        };
        const ok = liveUser ? await updateListingLive(updatedListing) : true;
        if (!ok) {
          setAuthError("İlan güncellenemedi. Lütfen tekrar dene.");
          return false;
        }
        setAuthError(undefined);
        setListings((items) => items.map((item) => (item.id === listingId ? updatedListing : item)));
        return true;
      },
      createLead(input) {
        if (isSuspended) { setAuthError("Hesabın askıya alındığı için işlem yapamazsın."); return undefined; }
        const listing = listings.find((item) => item.id === input.listingId);
        const partnership = partnerships.find((item) => item.id === input.partnershipId && item.listingId === input.listingId);
        if (!listing || listing.status !== "active" || !partnership || partnership.status !== "active") {
          setAuthError("Talep açılamadı. İlan pasif olabilir veya ortaklık bağlantısı aktif değildir.");
          return undefined;
        }
        if (listing.ownerId === partnership.partnerId) {
          setAuthError("Satıcı kendi ilanına ortak talep açamaz.");
          return undefined;
        }
        const normalizedPhone = input.buyerPhone.replace(/\D/g, "");
        const duplicateLead = leads.some(
          (lead) =>
            lead.listingId === input.listingId &&
            lead.partnershipId === input.partnershipId &&
            lead.buyerPhone.replace(/\D/g, "") === normalizedPhone &&
            lead.status !== "lost"
        );
        if (duplicateLead) {
          setAuthError("Bu müşteri için açık talep zaten var.");
          return undefined;
        }
        const lead: Lead = { ...input, id: newId("lead", liveUser), status: "new", createdAt: today() };
        setAuthError(undefined);
        setLeads((items) => [lead, ...items]);
        setListings((items) =>
          items.map((listing) =>
            listing.id === input.listingId ? { ...listing, leadCount: listing.leadCount + 1 } : listing
          )
        );
        // Canlı modda talep bildirimleri DB tetikleyicisiyle (notify_on_lead) üretilir
        // — hem uygulama içi hem referans linki talepleri tek kaynaktan. Çift olmasın diye
        // client-side bildirimi yalnız local/demo modda gönderiyoruz.
        if (!liveUser) {
          if (listing) notify(listing.ownerId, "lead", "Yeni alıcı talebi", `${listing.title} için yeni talep geldi.`);
          notify(partnership.partnerId, "lead", "Talebin satıcıya iletildi", `${listing.title} için getirdiğin müşteri kaydedildi.`);
        }
        if (liveUser) persistCritical(insertLead(lead), () => {
          setLeads((items) => items.filter((l) => l.id !== lead.id));
          setListings((items) => items.map((l) => (l.id === input.listingId ? { ...l, leadCount: Math.max(0, l.leadCount - 1) } : l)));
        }, "Talep kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
        return lead;
      },
      createReview(listingId, rating, comment) {
        const listing = listings.find((item) => item.id === listingId);
        // Kendi ilanına yorum yasak + kullanıcı başına ilan başına tek yorum:
        // sahte 5-yıldızla reviewCount/güven/rich-result puanı şişirilmesin.
        if (!listing || listing.ownerId === currentUser.id) { setAuthError("Kendi ilanını değerlendiremezsin."); return undefined; }
        if (reviews.some((item) => item.listingId === listingId && item.reviewerId === currentUser.id && item.type === "product")) {
          setAuthError("Bu ilanı zaten değerlendirdin.");
          return undefined;
        }
        const review: Review = {
          id: newId("r", liveUser),
          listingId,
          reviewerId: currentUser.id,
          rating,
          comment,
          type: "product",
          createdAt: today()
        };
        setReviews((items) => [review, ...items]);
        setListings((items) =>
          items.map((listing) =>
            listing.id === listingId ? { ...listing, reviewCount: listing.reviewCount + 1 } : listing
          )
        );
        if (liveUser) persistCritical(insertReview(review), () => {
          setReviews((items) => items.filter((r) => r.id !== review.id));
          setListings((items) => items.map((l) => (l.id === listingId ? { ...l, reviewCount: Math.max(0, l.reviewCount - 1) } : l)));
        }, "Değerlendirme kaydedilemedi. Lütfen tekrar dene.");
        return review;
      },
      canReviewSale(saleId) {
        const sale = sales.find((item) => item.id === saleId);
        // Yalnızca olumlu/kapanmış satışlar yorumlanabilir; iptal/anlaşmazlık/
        // bekleyen/iade-penceresi durumları puan/güven şişirmesin.
        if (!sale || !(sale.status === "approved" || sale.status === "seller_paid" || sale.status === "paid")) return false;
        const listing = listings.find((item) => item.id === sale.listingId);
        const partnership = partnerships.find((item) => item.id === sale.partnershipId);
        const allowed = listing?.ownerId === currentUser.id || partnership?.partnerId === currentUser.id;
        const alreadyReviewed = reviews.some((item) => item.saleId === saleId && item.reviewerId === currentUser.id);
        return Boolean(allowed && !alreadyReviewed);
      },
      createSaleReview(saleId, rating, comment) {
        const sale = sales.find((item) => item.id === saleId);
        if (!sale || !comment.trim()) return undefined;
        const listing = listings.find((item) => item.id === sale.listingId);
        const partnership = partnerships.find((item) => item.id === sale.partnershipId);
        if (!listing || !partnership) return undefined;
        const allowed = listing.ownerId === currentUser.id || partnership.partnerId === currentUser.id;
        const alreadyReviewed = reviews.some((item) => item.saleId === saleId && item.reviewerId === currentUser.id);
        if (!allowed || alreadyReviewed || sale.status === "pending") return undefined;
        const reviewerIsSeller = listing.ownerId === currentUser.id;
        const review: Review = {
          id: newId("r", liveUser),
          listingId: listing.id,
          saleId,
          reviewerId: currentUser.id,
          reviewedUserId: reviewerIsSeller ? partnership.partnerId : listing.ownerId,
          rating,
          comment: comment.trim(),
          type: reviewerIsSeller ? "partner" : "seller",
          createdAt: today()
        };
        setReviews((items) => [review, ...items]);
        setListings((items) => items.map((item) => (item.id === listing.id ? { ...item, reviewCount: item.reviewCount + 1 } : item)));
        if (liveUser) persistCritical(insertReview(review), () => {
          setReviews((items) => items.filter((r) => r.id !== review.id));
          setListings((items) => items.map((l) => (l.id === listing.id ? { ...l, reviewCount: Math.max(0, l.reviewCount - 1) } : l)));
        }, "Değerlendirme kaydedilemedi. Lütfen tekrar dene.");
        return review;
      },
      createSaleFromLead(leadId, input) {
        if (isSuspended) { setAuthError("Hesabın askıya alındığı için işlem yapamazsın."); return undefined; }
        const lead = leads.find((item) => item.id === leadId);
        if (!lead || lead.status === "lost" || lead.status === "converted" || sales.some((sale) => sale.leadId === leadId)) return undefined;

        const listing = listings.find((item) => item.id === lead.listingId);
        const partnership = partnerships.find((item) => item.id === lead.partnershipId);
        if (!listing || listing.ownerId !== currentUser.id || listing.status !== "active" || listing.stockCount <= 0 || !partnership || partnership.status !== "active") return undefined;

        const quantity = Math.max(1, Math.floor(input?.quantity ?? 1));
        const amount = Number.isFinite(input?.amount) && Number(input?.amount) > 0 ? Number(input?.amount) : listing.price * quantity;
        const returnUntil = new Date(Date.now() + listing.returnWindowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        // Başlangıç bonusu: HER ORTAĞIN ilk `bonusQuota` satışına ek `bonusAmount` (satıcı
        // taahhüdü — reklamı yapılıyordu ama komisyona hiç eklenmiyordu, sahte vaattı). Bu
        // ortağın iptal-olmayan önceki satış sayısı kotanın altındaysa bu satışa bonus eklenir.
        const priorPartnerSales = sales.filter((s) => s.partnershipId === lead.partnershipId && s.status !== "cancelled").length;
        const bonusApplied = (listing.bonusAmount ?? 0) > 0 && (listing.bonusQuota ?? 0) > 0 && priorPartnerSales < (listing.bonusQuota ?? 0) ? Math.round(listing.bonusAmount ?? 0) : 0;
        // Efektif komisyon: per-ortak override > kademeli oran > ilan varsayılanı.
        const baseCommission = effectiveCommissionAmount(listing, partnership, priorPartnerSales, amount, quantity);
        const sale: Sale = {
          id: newId("s", liveUser),
          listingId: listing.id,
          partnershipId: lead.partnershipId,
          leadId: lead.id,
          amount,
          quantity,
          commissionAmount: baseCommission + bonusApplied,
          bonusApplied: bonusApplied || undefined,
          status: listing.returnWindowDays > 0 ? "return_pending" : "approved",
          buyerName: lead.buyerName,
          deliveryStatus: input?.deliveryStatus ?? "confirmed",
          returnUntil,
          approvedAt: listing.returnWindowDays > 0 ? undefined : today(),
          payoutNote: `${listing.returnWindowDays} gün iade penceresi sonrası ${listing.commissionDueDays} gün içinde dış ödeme.`
        };
        const order: Order = {
          id: newId("o", liveUser),
          listingId: listing.id,
          buyerId: currentUser.id,
          sellerId: listing.ownerId,
          partnershipId: lead.partnershipId,
          amount,
          status: "confirmed",
          createdAt: today()
        };
        setSales((items) => [sale, ...items]);
        setOrders((items) => [order, ...items]);
        setLeads((items) => items.map((item) => (item.id === leadId ? { ...item, status: "converted" } : item)));
        const nextStockCount = Math.max(0, listing.stockCount - quantity);
        const nextListingStatus = nextStockCount === 0 ? "sold" : listing.status;
        const updatedListing: Listing = { ...listing, stockCount: nextStockCount, status: nextListingStatus };
        setListings((items) => items.map((item) => (item.id === listing.id ? updatedListing : item)));
        if (partnership) notify(partnership.partnerId, "sale", "Satış kaydı oluştu", `${listing.title} için komisyon kaydı iade penceresine alındı.${bonusApplied ? ` Başlangıç bonusu ${moneyIn(bonusApplied, listing.currency)} dahil.` : ""}`, { listingId: listing.id, partnershipId: partnership.id });
        if (liveUser) persistCritical(insertSaleFromLead(sale, listing), () => {
          setSales((items) => items.filter((s) => s.id !== sale.id));
          setOrders((items) => items.filter((o) => o.id !== order.id));
          setLeads((items) => items.map((l) => (l.id === leadId ? lead : l)));
          setListings((items) => items.map((l) => (l.id === listing.id ? listing : l)));
        }, "Satış kaydı oluşturulamadı. Bağlantını kontrol edip tekrar dene.");
        // Stok düşümü artık record_sale RPC'sinde (atomik) — ayrı yazım YOK (çift düşüm olmasın).
        return sale;
      },
      // Doğrudan satış: ortak referans linkiyle gelen alıcı WhatsApp/elden satın
      // aldıysa (lead kaydı yoksa), satıcı satışı bu ortağa atayıp komisyonu
      // başlatır. createSaleFromLead ile aynı boru hattı; farkı lead yok.
      recordSaleForPartner(partnershipId, input) {
        if (isSuspended) { setAuthError("Hesabın askıya alındığı için işlem yapamazsın."); return undefined; }
        const partnership = partnerships.find((item) => item.id === partnershipId);
        if (!partnership || partnership.status !== "active") { setAuthError("Ortaklık aktif değil."); return undefined; }
        const listing = listings.find((item) => item.id === partnership.listingId);
        if (!listing || listing.ownerId !== currentUser.id || listing.status !== "active" || listing.stockCount <= 0) {
          setAuthError("Satış eklenemez. İlan sana ait ve aktif olmalı, stok bulunmalı.");
          return undefined;
        }

        const quantity = Math.max(1, Math.floor(input?.quantity ?? 1));
        const amount = Number.isFinite(input?.amount) && Number(input?.amount) > 0 ? Number(input?.amount) : listing.price * quantity;
        const returnUntil = new Date(Date.now() + listing.returnWindowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        // Başlangıç bonusu (ilk bonusQuota satış) — createSaleFromLead ile aynı mantık.
        const priorPartnerSales = sales.filter((s) => s.partnershipId === partnership.id && s.status !== "cancelled").length;
        const bonusApplied = (listing.bonusAmount ?? 0) > 0 && (listing.bonusQuota ?? 0) > 0 && priorPartnerSales < (listing.bonusQuota ?? 0) ? Math.round(listing.bonusAmount ?? 0) : 0;
        // Efektif komisyon: per-ortak override > kademeli oran > ilan varsayılanı.
        const baseCommission = effectiveCommissionAmount(listing, partnership, priorPartnerSales, amount, quantity);
        const sale: Sale = {
          id: newId("s", liveUser),
          listingId: listing.id,
          partnershipId: partnership.id,
          amount,
          quantity,
          commissionAmount: baseCommission + bonusApplied,
          bonusApplied: bonusApplied || undefined,
          status: listing.returnWindowDays > 0 ? "return_pending" : "approved",
          buyerName: input?.buyerName?.trim() || "Doğrudan satış",
          deliveryStatus: input?.deliveryStatus ?? "confirmed",
          returnUntil,
          approvedAt: listing.returnWindowDays > 0 ? undefined : today(),
          payoutNote: `Satıcı tarafından eklendi (doğrudan satış). ${listing.returnWindowDays} gün iade penceresi sonrası ${listing.commissionDueDays} gün içinde dış ödeme.`
        };
        const order: Order = {
          id: newId("o", liveUser),
          listingId: listing.id,
          buyerId: currentUser.id,
          sellerId: listing.ownerId,
          partnershipId: partnership.id,
          amount,
          status: "confirmed",
          createdAt: today()
        };
        setSales((items) => [sale, ...items]);
        setOrders((items) => [order, ...items]);
        const nextStockCount = Math.max(0, listing.stockCount - quantity);
        const nextListingStatus = nextStockCount === 0 ? "sold" : listing.status;
        const updatedListing: Listing = { ...listing, stockCount: nextStockCount, status: nextListingStatus };
        setListings((items) => items.map((item) => (item.id === listing.id ? updatedListing : item)));
        setAuthError(undefined);
        notify(partnership.partnerId, "sale", "Satış kaydı oluştu", `${listing.title} için satıcı doğrudan satış ekledi; komisyonun süreçte.${bonusApplied ? ` Başlangıç bonusu ${moneyIn(bonusApplied, listing.currency)} dahil.` : ""}`, { listingId: listing.id, partnershipId: partnership.id });
        if (liveUser) persistCritical(insertSaleFromLead(sale, listing), () => {
          setSales((items) => items.filter((s) => s.id !== sale.id));
          setOrders((items) => items.filter((o) => o.id !== order.id));
          setListings((items) => items.map((l) => (l.id === listing.id ? listing : l)));
        }, "Satış kaydı oluşturulamadı. Bağlantını kontrol edip tekrar dene.");
        // Stok düşümü artık record_sale RPC'sinde (atomik) — ayrı yazım YOK (çift düşüm olmasın).
        return sale;
      },
      joinListing(listingId, input) {
        // Giriş kapısı (favori/takip ile aynı): anonim kullanıcıda ortaklık yalnız yerel
        // state'te kalıyor, refCode sunucuda çözülmüyordu → hayalet ortaklık + sahte başarı.
        if (!isAuthenticated) { setAuthError("Ortak olmak için giriş yapmalısın."); return undefined; }
        if (isSuspended) { setAuthError("Hesabın askıya alındığı için işlem yapamazsın."); return undefined; }
        const listing = listings.find((item) => item.id === listingId);
        if (listing?.demo) { setAuthError("Bu bir örnek (vitrin) ilandır; ortaklık kapalıdır."); return undefined; }
        if (!listing || listing.ownerId === currentUser.id || listing.status !== "active") {
          setAuthError("Bu ilana ortak olunamaz. İlan pasif olabilir veya kendi ilanın olabilir.");
          return undefined;
        }
        const invited = listing.partnershipMode === "invite" && input?.inviteCode === listingInviteCode(listing);
        if (listing.partnershipMode === "invite" && !invited) {
          setAuthError("Bu ilan sadece davetle ortaklığa açıktır. Ortak olmak için satıcıdan davet linki iste.");
          return undefined;
        }
        // Yeni kullanıcının puanı 0'dır (henüz yorum yok). 0'ı "yetersiz puan" sayıp
        // herkesi engellemek yerine yalnızca gerçekten puanlanmış (rating>0) ve eşiğin
        // altındaki ortakları eleriz — aksi halde hiçbir yeni kullanıcı ortak olamıyordu.
        if (currentUser.rating > 0 && currentUser.rating < listing.minPartnerRating) {
          setAuthError(`Bu ilan için en az ${listing.minPartnerRating} ortak puanı gerekiyor.`);
          return undefined;
        }

        const existing = partnerships.find(
          (item) => item.listingId === listingId && item.partnerId === currentUser.id
        );
        // Reddedilmemiş mevcut ortaklık aynen döner. Reddedilmiş başvuru ise tekrar
        // açılabilmeli: DB'de (listing_id, partner_id) benzersiz olduğundan yeni satır
        // insert edilemez → mevcut satır güncellenir.
        if (existing && existing.status !== "rejected") {
          setAuthError(undefined);
          return existing;
        }
        if (existing && existing.status === "rejected") {
          const reopenStatus = listing.partnershipMode === "open" || invited ? "active" : "pending";
          const reopened: Partnership = {
            ...existing,
            status: reopenStatus,
            rejectionReason: undefined,
            note: input?.note?.trim() || existing.note,
            shareChannel: input?.shareChannel?.trim() || existing.shareChannel,
            audience: input?.audience?.trim() || existing.audience,
            platformHandle: input?.platformHandle?.trim() || existing.platformHandle,
            reachEstimate: Number.isFinite(input?.reachEstimate) ? Math.max(0, Number(input?.reachEstimate)) : existing.reachEstimate,
            approvedAt: reopenStatus === "active" ? today() : existing.approvedAt
          };
          setPartnerships((items) => items.map((p) => (p.id === existing.id ? reopened : p)));
          setAuthError(undefined);
          if (reopenStatus === "active") {
            setListings((items) => items.map((item) => (item.id === listingId ? { ...item, partnerCount: item.partnerCount + 1 } : item)));
          } else {
            notify(listing.ownerId, "application", "Yeni ortak başvurusu", `${currentUser.name}, ${listing.title} ilanına yeniden başvurdu.`, { listingId: listing.id, partnershipId: reopened.id });
          }
          // Reopen ORTAK tarafından yapılır; partnerships UPDATE RLS'i yalnız sahibe izin
          // verir → SUNUCU RPC'si (partner_join) reddedileni yeniden açar + invite doğrular.
          if (liveUser) persistCritical(partnerJoinLive(reopened, input?.inviteCode), () => {
            setPartnerships((items) => items.map((p) => (p.id === existing.id ? existing : p)));
            if (reopenStatus === "active") setListings((items) => items.map((l) => (l.id === listingId ? { ...l, partnerCount: Math.max(0, l.partnerCount - 1) } : l)));
          }, "Başvuru güncellenemedi. Bağlantını kontrol edip tekrar dene.");
          return reopened;
        }

        const status = listing.partnershipMode === "open" || invited ? "active" : "pending";
        const partnership: Partnership = {
          id: newId("p", liveUser),
          listingId,
          partnerId: currentUser.id,
          refCode: makeRefCode(currentUser.id, listingId),
          status,
          // Uydurma varsayılan metin YOK (sahte veri yasağı). Anında (open) ortaklıkta
          // satıcı onayı olmadığından bu alanlar boş kalabilir; başvuru formu doldurunca dolar.
          note: input?.note?.trim() || "",
          shareChannel: input?.shareChannel?.trim() || "",
          audience: input?.audience?.trim() || "",
          platformHandle: input?.platformHandle?.trim() || "",
          reachEstimate: Number.isFinite(input?.reachEstimate) ? Math.max(0, Number(input?.reachEstimate)) : 0,
          approvedAt: status === "active" ? today() : undefined,
          createdAt: today()
        };
        setPartnerships((items) => [partnership, ...items]);
        setAuthError(undefined);
        if (status === "active") {
          setListings((items) =>
            items.map((item) => (item.id === listingId ? { ...item, partnerCount: item.partnerCount + 1 } : item))
          );
        } else {
          notify(listing.ownerId, "application", "Yeni ortak başvurusu", `${currentUser.name}, ${listing.title} ilanına başvurdu.`, { listingId: listing.id, partnershipId: partnership.id });
        }
        // Katılım SUNUCU RPC'siyle: invite kodu SQL'de doğrulanır, onay modu 'pending'e
        // düşer (istemci hilesi geçmez), açık mod anında aktif. Trigger doğrudan-POST bypass'ı kapatır.
        if (liveUser) persistCritical(partnerJoinLive(partnership, input?.inviteCode), () => {
          setPartnerships((items) => items.filter((p) => p.id !== partnership.id));
          if (status === "active") setListings((items) => items.map((l) => (l.id === listingId ? { ...l, partnerCount: Math.max(0, l.partnerCount - 1) } : l)));
        }, "Ortaklık kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
        return partnership;
      },
      approvePartnership(partnershipId) {
        const partnership = partnerships.find((item) => item.id === partnershipId);
        const listing = partnership ? listings.find((item) => item.id === partnership.listingId) : undefined;
        if (!partnership || !listing || (listing.ownerId !== currentUser.id && !staff) || partnership.status !== "pending") return;
        const updatedPartnership: Partnership = { ...partnership, status: "active", approvedAt: today() };
        setPartnerships((items) => items.map((item) => (item.id === partnershipId ? updatedPartnership : item)));
        setListings((items) =>
          items.map((listing) =>
            listing.id === partnership.listingId ? { ...listing, partnerCount: listing.partnerCount + 1 } : listing
          )
        );
        notify(partnership.partnerId, "application", "Ortaklık kabul edildi", `${listing.title} — paylaşım linkin aktif edildi. Paylaş, sat, kazan.`, { listingId: listing.id, partnershipId: partnership.id });
        if (liveUser) persistCritical(updatePartnershipStatus(updatedPartnership), () => {
          setPartnerships((items) => items.map((item) => (item.id === partnershipId ? partnership : item)));
          setListings((items) => items.map((item) => (item.id === partnership.listingId ? { ...item, partnerCount: Math.max(0, item.partnerCount - 1) } : item)));
        }, "Başvuru onayı kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
      },
      rejectPartnership(partnershipId, reason) {
        const partnership = partnerships.find((item) => item.id === partnershipId);
        const listing = partnership ? listings.find((item) => item.id === partnership.listingId) : undefined;
        if (!partnership || !listing || (listing.ownerId !== currentUser.id && !staff) || partnership.status !== "pending") return;
        const cleanReason = reason?.trim() || "Satıcı bu başvuruyu uygun görmedi.";
        const updatedPartnership = partnership
          ? { ...partnership, status: "rejected" as const, rejectionReason: cleanReason }
          : undefined;
        setPartnerships((items) =>
          items.map((item) => (item.id === partnershipId && updatedPartnership ? updatedPartnership : item))
        );
        if (partnership) notify(partnership.partnerId, "application", "Ortaklık reddedildi", cleanReason, { listingId: listing.id, partnershipId: partnership.id });
        if (liveUser && updatedPartnership && partnership) persistCritical(updatePartnershipStatus(updatedPartnership), () => {
          setPartnerships((items) => items.map((item) => (item.id === partnershipId ? partnership : item)));
        }, "Başvuru reddi kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
      },
      // Aktif ortaklığı satıcı sonlandırır/kapatır (eski hâlde bir kez onaylanan ortak
      // — sızan davet linkiyle gelen dahil — kalıcıydı). "cancelled": normal sonlandırma,
      // "blocked": kötüye kullanım engeli. Paylaşım linki artık lead getirmez.
      endPartnership(partnershipId, mode = "cancelled") {
        const partnership = partnerships.find((item) => item.id === partnershipId);
        const listing = partnership ? listings.find((item) => item.id === partnership.listingId) : undefined;
        if (!partnership || !listing || (listing.ownerId !== currentUser.id && !staff) || partnership.status !== "active") return;
        const updated: Partnership = { ...partnership, status: mode };
        setPartnerships((items) => items.map((p) => (p.id === partnershipId ? updated : p)));
        setListings((items) => items.map((l) => (l.id === partnership.listingId ? { ...l, partnerCount: Math.max(0, l.partnerCount - 1) } : l)));
        notify(partnership.partnerId, "application", mode === "blocked" ? "Ortaklık kapatıldı" : "Ortaklık sonlandırıldı", `${listing.title} için ortaklığın satıcı tarafından ${mode === "blocked" ? "kapatıldı" : "sonlandırıldı"}. Paylaşım linkin artık aktif değil.`, { listingId: listing.id, partnershipId: partnership.id });
        if (liveUser) persistCritical(updatePartnershipStatus(updated), () => {
          setPartnerships((items) => items.map((p) => (p.id === partnershipId ? partnership : p)));
          setListings((items) => items.map((l) => (l.id === partnership.listingId ? { ...l, partnerCount: l.partnerCount + 1 } : l)));
        }, "Ortaklık güncellenemedi. Bağlantını kontrol edip tekrar dene.");
      },
      // Satıcı bu ortağa ÖZEL komisyon belirler (ilan varsayılanını ezer). type yoksa temizler.
      setPartnershipCommission(partnershipId, type, value) {
        const partnership = partnerships.find((item) => item.id === partnershipId);
        const listing = partnership ? listings.find((item) => item.id === partnership.listingId) : undefined;
        if (!partnership || !listing || (listing.ownerId !== currentUser.id && !staff)) return;
        const set = type && typeof value === "number" && value > 0;
        const nextType = set ? type : undefined;
        const nextValue = set ? Math.round(value as number) : undefined;
        const prev = { commissionOverrideType: partnership.commissionOverrideType, commissionOverrideValue: partnership.commissionOverrideValue };
        setPartnerships((items) => items.map((p) => (p.id === partnershipId ? { ...p, commissionOverrideType: nextType, commissionOverrideValue: nextValue } : p)));
        if (liveUser) persistCritical(setPartnershipCommissionLive(partnershipId, nextType ?? null, nextValue ?? null), () => {
          setPartnerships((items) => items.map((p) => (p.id === partnershipId ? { ...p, ...prev } : p)));
        }, "Komisyon güncellenemedi. Bağlantını kontrol edip tekrar dene.");
      },
      toggleFavorite(listingId) {
        if (!isAuthenticated) { setAuthError("Favorilere eklemek için giriş yapmalısın."); return; }
        const existing = favorites.find((item) => item.listingId === listingId && item.userId === currentUser.id);
        if (existing) {
          setFavorites((items) => items.filter((item) => item.id !== existing.id));
          setListings((items) =>
            items.map((listing) =>
              listing.id === listingId ? { ...listing, favoriteCount: Math.max(0, listing.favoriteCount - 1) } : listing
            )
          );
          if (liveUser) void deleteFavorite(listingId, currentUser.id);
          return;
        }
        const favoriteId = newId("f", liveUser);
        const savedPrice = listings.find((l) => l.id === listingId)?.price;
        setFavorites((items) => [{ id: favoriteId, listingId, userId: currentUser.id, savedPrice }, ...items]);
        setListings((items) =>
          items.map((listing) =>
            listing.id === listingId ? { ...listing, favoriteCount: listing.favoriteCount + 1 } : listing
          )
        );
        if (liveUser) void insertFavorite(listingId, currentUser.id, favoriteId, savedPrice);
      },
      followedSellerIds,
      isFollowing(sellerId) {
        return followedSellerIds.includes(sellerId);
      },
      toggleFollow(sellerId) {
        if (!isAuthenticated) { setAuthError("Mağaza takibi için giriş yapmalısın."); return; }
        if (sellerId === currentUser.id) return;
        const following = followedSellerIds.includes(sellerId);
        // İyimser güncelleme: takip listesi + satıcının followerCount'u (kart/başlık) anında.
        const bumpFollower = (delta: number) => setUsers((items) => items.map((u) => (u.id === sellerId ? { ...u, followerCount: Math.max(0, u.followerCount + delta) } : u)));
        if (following) {
          setFollowedSellerIds((ids) => ids.filter((id) => id !== sellerId));
          bumpFollower(-1);
          if (liveUser) persistCritical(unfollowSellerLive(sellerId), () => { setFollowedSellerIds((ids) => (ids.includes(sellerId) ? ids : [...ids, sellerId])); bumpFollower(1); }, "Takip bırakılamadı. Bağlantını kontrol edip tekrar dene.");
        } else {
          setFollowedSellerIds((ids) => (ids.includes(sellerId) ? ids : [...ids, sellerId]));
          bumpFollower(1);
          if (liveUser) persistCritical(followSellerLive(sellerId), () => { setFollowedSellerIds((ids) => ids.filter((id) => id !== sellerId)); bumpFollower(-1); }, "Takip edilemedi. Bağlantını kontrol edip tekrar dene.");
        }
      },
      startConversation(listingId, receiverId, body) {
        return createOrReuseConversation(listingId, receiverId, body);
      },
      sendMessage(listingId, receiverId, body) {
        createOrReuseConversation(listingId, receiverId, body);
      },
      sendConversationMessage(conversationId, body, attachment) {
        if (isSuspended) return;
        const trimmed = body.trim();
        if (!trimmed && !attachment) return;
        const conversation = conversations.find((item) => item.id === conversationId);
        if (!conversation || conversation.status !== "open") return;
        const receiverId = conversation.participantIds.find((id) => id !== currentUser.id);
        if (!receiverId) return;
        const message: Message = {
          id: newId("m", liveUser),
          conversationId,
          listingId: conversation.listingId,
          senderId: currentUser.id,
          receiverId,
          body: trimmed,
          // Yerel saat + saniye hassasiyeti — aynı dakikadaki mesajların sırası korunur.
          createdAt: msgStamp(),
          read: false,
          attachmentUrl: attachment?.url,
          attachmentType: attachment?.type,
          attachmentName: attachment?.name
        };
        setMessages((items) => [message, ...items]);
        setConversations((items) => items.map((item) => (item.id === conversationId ? { ...item, lastMessageAt: message.createdAt } : item)));
        const preview = trimmed || (attachment?.type === "file" ? `📎 ${attachment.name ?? "Dosya"}` : "📷 Görsel");
        notify(receiverId, "message", "Yeni mesaj", `${currentUser.name}: ${preview}`);
        // Mesaj DB'ye yazılamazsa (bağlantı/RLS) optimistik baloncuğu geri al ve
        // görünür hata göster — mesaj sessizce kaybolup alıcıya ulaşmamazlık yaşanmasın.
        if (liveUser) persistCritical(insertMessage(message), () => {
          setMessages((items) => items.filter((m) => m.id !== message.id));
        }, "Mesaj gönderilemedi. Bağlantını kontrol edip tekrar dene.");
      },
      markConversationRead(conversationId) {
        const unread = messages.filter((item) => item.conversationId === conversationId && item.receiverId === currentUser.id && !item.read);
        setMessages((items) => items.map((item) => (item.conversationId === conversationId && item.receiverId === currentUser.id ? { ...item, read: true } : item)));
        if (liveUser) unread.forEach((message) => void markMessageReadLive({ ...message, read: true }));
      },
      markNotificationRead(notificationId) {
        const notification = notifications.find((item) => item.id === notificationId);
        setNotifications((items) => items.map((item) => (item.id === notificationId ? { ...item, read: true } : item)));
        if (liveUser && notification) void markNotificationReadLive({ ...notification, read: true });
      },
      categorySuggestions,
      locationSuggestions,
      addCategorySuggestion(input) {
        const suggestion: CategorySuggestion = { id: newId("cs", liveUser), userId: currentUser.id, userName: currentUser.name, suggestedPath: input.suggestedPath, note: input.note, listingId: input.listingId, status: "pending", createdAt: today() };
        setCategorySuggestions((items) => [suggestion, ...items]);
        // Öneri DB'ye yazılamazsa geri al + hata göster (kullanıcı "gönderildi" sanıp
        // önerisini kaybetmesin).
        if (liveUser) persistCritical(insertCategorySuggestion(suggestion), () => {
          setCategorySuggestions((items) => items.filter((s) => s.id !== suggestion.id));
        }, "Öneri gönderilemedi. Lütfen tekrar dene.");
      },
      addLocationSuggestion(input) {
        const suggestion: LocationSuggestion = { id: newId("ls", liveUser), userId: currentUser.id, userName: currentUser.name, provinceId: input.provinceId, districtId: input.districtId, suggestedName: input.suggestedName, type: "neighborhood", note: input.note, status: "pending", createdAt: today() };
        setLocationSuggestions((items) => [suggestion, ...items]);
        if (liveUser) persistCritical(insertLocationSuggestion(suggestion), () => {
          setLocationSuggestions((items) => items.filter((s) => s.id !== suggestion.id));
        }, "Öneri gönderilemedi. Lütfen tekrar dene.");
      },
      setCategorySuggestionStatus(id, status) {
        setCategorySuggestions((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
        if (liveUser) void updateCategorySuggestionStatusLive(id, status, currentUser.id);
      },
      setLocationSuggestionStatus(id, status) {
        setLocationSuggestions((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
        if (liveUser) void updateLocationSuggestionStatusLive(id, status, currentUser.id);
      },
      updateLeadStatus(leadId, status) {
        const lead = leads.find((item) => item.id === leadId);
        const listing = lead ? listings.find((item) => item.id === lead.listingId) : undefined;
        // Satıcı (ilan sahibi) VEYA lead'i getiren ortak durumu güncelleyebilir.
        // (Ortak yalnızca status değiştirebilir — DB trigger'ı kolon-korumalı.)
        const leadPartnership = lead?.partnershipId ? partnerships.find((p) => p.id === lead.partnershipId) : undefined;
        const canManage = !!listing && (listing.ownerId === currentUser.id || leadPartnership?.partnerId === currentUser.id);
        if (!lead || !listing || !canManage) return;
        setLeads((items) => items.map((item) => (item.id === leadId ? { ...item, status } : item)));
        if (liveUser && lead) void updateLeadStatusLive({ ...lead, status });
      },
      updateListingStatus(listingId, status) {
        const listing = listings.find((item) => item.id === listingId);
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        // İlan sahibi veya admin/moderatör (moderasyon) değiştirebilir.
        if (!listing || (listing.ownerId !== currentUser.id && !isStaff)) return;
        // Moderasyon kaçağını önle: sahip, incelemedeki/reddedilen ilanı kendisi
        // "active" yapamaz — yalnızca admin/moderatör yayınlayabilir.
        if (!isStaff && (listing.status === "pending_review" || listing.status === "rejected") && status === "active") {
          setAuthError("Bu ilan incelemede. Yayına alınması için admin onayı gerekir.");
          return;
        }
        setListings((items) => items.map((item) => (item.id === listingId ? { ...item, status } : item)));
        if (liveUser) persistOrWarn(updateListingStatusLive({ ...listing, status }), "İlan durumu güncellenemedi. Lütfen tekrar dene.");
      },
      updateListingInventory(listingId, patch) {
        const listing = listings.find((item) => item.id === listingId);
        // Yalnız ilan sahibi satır-içi stok/fiyat düzenleyebilir.
        if (!listing || listing.ownerId !== currentUser.id) return;
        const nextStock = typeof patch.stockCount === "number" ? Math.max(0, Math.floor(patch.stockCount)) : undefined;
        const nextPrice = typeof patch.price === "number" ? Math.max(0, Math.round(patch.price)) : undefined;
        if (nextStock === undefined && nextPrice === undefined) return;
        const prev = { stockCount: listing.stockCount, price: listing.price };
        setListings((items) =>
          items.map((item) =>
            item.id === listingId
              ? {
                  ...item,
                  ...(nextStock !== undefined ? { stockCount: nextStock } : {}),
                  ...(nextPrice !== undefined ? { price: nextPrice } : {})
                }
              : item
          )
        );
        if (liveUser) {
          persistCritical(
            updateListingStockPriceLive(listingId, { stockCount: nextStock, price: nextPrice }),
            () => {
              setListings((items) =>
                items.map((item) => (item.id === listingId ? { ...item, ...prev } : item))
              );
            },
            "Güncelleme kaydedilemedi. Bağlantını kontrol edip tekrar dene."
          );
        }
      },
      setListingFeatured(listingId, featured) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setListings((items) => items.map((item) => (item.id === listingId ? { ...item, featured } : item)));
        if (liveUser) persistOrWarn(updateListingFeaturedLive(listingId, featured), "İlan öne çıkarma güncellenemedi.");
      },
      deleteListing(listingId) {
        const listing = listings.find((item) => item.id === listingId);
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!listing || (listing.ownerId !== currentUser.id && !isStaff)) return;
        setListings((items) => items.filter((item) => item.id !== listingId));
        if (liveUser) persistOrWarn(deleteListingLive(listingId), "İlan silinemedi. Lütfen tekrar dene.");
      },
      setUserRole(userId, role) {
        const isAdmin = currentUser.role === "admin" || currentUser.role === "super_admin";
        if (!isAdmin || userId === currentUser.id) return; // kendi rolunu degistirme
        setUsers((items) => items.map((item) => (item.id === userId ? { ...item, role } : item)));
        if (liveUser) persistOrWarn(updateUserRoleLive(userId, role), "Kullanıcı rolü güncellenemedi.");
      },
      setUserStatus(userId, status) {
        const isAdmin = currentUser.role === "admin" || currentUser.role === "super_admin";
        if (!isAdmin || userId === currentUser.id) return;
        setUsers((items) => items.map((item) => (item.id === userId ? { ...item, status } : item)));
        if (liveUser) persistOrWarn(updateUserStatusLive(userId, status), "Kullanıcı durumu güncellenemedi.");
      },
      setUserVerification(userId, field, value) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setUsers((items) => items.map((item) => (item.id === userId ? { ...item, [field]: value } : item)));
        if (liveUser) persistOrWarn(updateUserVerificationLive(userId, field, value), "Doğrulama güncellenemedi.");
      },
      adminNotifyUser(userId, title, body) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff || !title.trim() || userId === currentUser.id) return;
        notify(userId, "system", title.trim(), body.trim());
      },
      adminBroadcast(title, body) {
        const isAdmin = currentUser.role === "admin" || currentUser.role === "super_admin";
        if (!isAdmin || !title.trim()) return;
        const targets = users.filter((u) => u.id !== currentUser.id && u.status !== "deleted" && isLiveUser(u));
        const now = new Date().toISOString().slice(0, 16).replace("T", " ");
        const rows = targets.map((u) => ({ id: newId("n", liveUser), userId: u.id, type: "system" as const, title: title.trim(), body: body.trim() }));
        setNotifications((items) => [
          ...rows.map((r) => ({ id: r.id, userId: r.userId, type: "system" as Notification["type"], title: r.title, body: r.body, read: false, createdAt: now })),
          ...items
        ]);
        if (liveUser) void insertBulkNotifications(rows);
      },
      updateSaleStatus(saleId, status, reason) {
        const sale = sales.find((item) => item.id === saleId);
        const saleListing = sale ? listings.find((item) => item.id === sale.listingId) : undefined;
        const salePartnership = sale ? partnerships.find((item) => item.id === sale.partnershipId) : undefined;
        const isSeller = saleListing?.ownerId === currentUser.id;
        const isPartner = salePartnership?.partnerId === currentUser.id;
        const sellerAction = status === "approved" || status === "seller_paid" || status === "cancelled";
        const partnerAction = status === "paid";
        // İtiraz (disputed) ve çözüm iki taraftan da açılabilir; diğer aksiyonlar role bağlı.
        // Personel (admin/moderatör) panelden her aksiyonu yürütebilir (anlaşmazlık çözümü/iptal).
        if (
          !sale ||
          (sellerAction && !isSeller && !staff) ||
          (partnerAction && !isPartner && !staff) ||
          (status === "disputed" && !isSeller && !isPartner && !staff)
        ) {
          return;
        }
        // TERMİNAL DURUM: cancelled/paid personel dışında geri alınamaz — iptal edilen
        // ya da kapanan komisyon yeniden "ödenecek/onaylı" duruma sokulup metrikleri
        // ve panel sinyalini bozmasın.
        if (!staff && (sale.status === "cancelled" || sale.status === "paid") && status !== sale.status) {
          return;
        }
        // Geçiş ön-koşulu: ortak "paid"i yalnızca satıcı ödeme bildirdikten (seller_paid)
        // veya anlaşmazlık (disputed) durumundan kapatabilir — açık/iade-penceresi
        // komisyonu erkenden kapatılamaz.
        if (!staff && partnerAction && sale.status !== "seller_paid" && sale.status !== "disputed") {
          return;
        }
        const disputeText = reason?.trim() ? `Anlaşmazlık: ${reason.trim()}` : "Komisyon için anlaşmazlık kaydı açıldı.";
        const updatedSale = sale
          ? {
              ...sale,
              status,
              approvedAt: status === "approved" ? today() : sale.approvedAt,
              sellerMarkedPaidAt: status === "seller_paid" ? today() : sale.sellerMarkedPaidAt,
              partnerConfirmedPaidAt: status === "paid" ? today() : sale.partnerConfirmedPaidAt,
              paidAt: status === "paid" ? today() : sale.paidAt,
              payoutNote:
                status === "approved"
                  ? "İade penceresi kapandı, komisyon ödemeye hazır."
                  : status === "seller_paid"
                    ? "Satıcı komisyonu uygulama dışında ödediğini bildirdi. Ortak onayı bekleniyor."
                    : status === "paid"
                      ? "Satıcı ödedi, ortak ödemeyi aldığını onayladı."
                      : status === "cancelled"
                        ? "Satış veya komisyon iptal edildi."
                        : status === "disputed"
                          ? disputeText
                          : sale.payoutNote
            }
          : undefined;
        setSales((items) => items.map((item) => (item.id === saleId && updatedSale ? updatedSale : item)));
        // İptalde stoğu ve (satış yüzünden otomatik "sold" olduysa) ilan durumunu geri
        // al — aksi halde iptal edilen satış ilanı kalıcı "tükendi"de bırakıyordu.
        // Yalnızca cancelled'a İLK geçişte çalışır (çift-iade önlenir: terminal-guard
        // non-staff'i cancelled'dan çıkaramaz; staff re-cancel'de sale.status zaten cancelled).
        if (sale && status === "cancelled" && sale.status !== "cancelled" && saleListing) {
          const restoredStock = saleListing.stockCount + Math.max(1, Math.floor(sale.quantity ?? 1));
          const restoredStatus = saleListing.status === "sold" ? "active" : saleListing.status;
          const restoredListing: Listing = { ...saleListing, stockCount: restoredStock, status: restoredStatus };
          setListings((items) => items.map((item) => (item.id === saleListing.id ? restoredListing : item)));
          if (liveUser) void updateListingInventoryLive(restoredListing);
        }
        if (sale && status === "seller_paid") {
          const partnership = partnerships.find((item) => item.id === sale.partnershipId);
          if (partnership) notify(partnership.partnerId, "payout", "Komisyon ödendi bildirildi", `${sale.commissionAmount} TL için ödemeyi aldığını onayla.`);
        }
        if (sale && status === "paid") {
          const listing = listings.find((item) => item.id === sale.listingId);
          if (listing) notify(listing.ownerId, "payout", "Ortak ödemeyi onayladı", `${sale.commissionAmount} TL komisyon kapandı.`);
        }
        if (sale && status === "cancelled" && salePartnership) {
          notify(salePartnership.partnerId, "payout", "Satış/komisyon iptal edildi", `${saleListing?.title ?? "İlan"} için komisyon kaydı iptal edildi.`);
        }
        if (sale && status === "disputed") {
          // İtirazı karşı tarafa bildir (kim açtıysa diğerine gider).
          const other = isSeller ? salePartnership?.partnerId : saleListing?.ownerId;
          if (other) notify(other, "payout", "Komisyon anlaşmazlığı açıldı", `${saleListing?.title ?? "İlan"} komisyonu için anlaşmazlık bildirildi. Panelden inceleyip çözebilirsin.`);
        }
        if (liveUser && updatedSale && sale) persistCritical(updateSaleStatusLive(updatedSale), () => {
          setSales((items) => items.map((item) => (item.id === saleId ? sale : item)));
        }, "Durum güncellemesi kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
      },
      recordBatchPayout(partnerId, listingId) {
        // Satıcı, bir ortağın (ops. tek ilan) BORÇLU komisyonlarını TEK toplu ödeme kaydıyla
        // seller_paid yapar (uygulama-dışı ödeme kaydı). Ortak yine "Ödemeyi Aldım" ile kapatır.
        const owed = sales.filter((s) => {
          const part = partnerships.find((p) => p.id === s.partnershipId);
          const l = listings.find((item) => item.id === s.listingId);
          return part?.partnerId === partnerId && l?.ownerId === currentUser.id
            && (!listingId || s.listingId === listingId)
            && (s.status === "return_pending" || s.status === "approved");
        });
        if (owed.length === 0) { setAuthError("Bu ortağa ödenecek (borçlu) komisyon yok."); return; }
        const prev = owed.map((s) => ({ id: s.id, status: s.status }));
        const owedIds = new Set(owed.map((s) => s.id));
        setSales((items) => items.map((s) => owedIds.has(s.id) ? { ...s, status: "seller_paid" as const, sellerMarkedPaidAt: today(), payoutNote: "Satıcı toplu ödeme kaydetti (uygulama dışı). Ortak onayı bekleniyor." } : s));
        setAuthError(undefined);
        notify(partnerId, "payout", "Komisyon ödemesi bildirildi", `${owed.length} satış için satıcı ödeme yaptığını bildirdi. Ödemeyi aldıysan onayla.`, listingId ? { listingId } : undefined);
        if (liveUser) persistCritical(recordPayoutLive(partnerId, listingId ?? null), () => {
          setSales((items) => items.map((s) => { const p = prev.find((x) => x.id === s.id); return p ? { ...s, status: p.status } : s; }));
        }, "Toplu ödeme kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
      },
      platformSettings,
      emailVerified,
      isSuspended,
      updatePlatformSetting(key, value) {
        if (currentUser.role !== "admin" && currentUser.role !== "super_admin") return;
        setPlatformSettings((prev) => ({ ...prev, [key]: value }));
        void updatePlatformSettingLive(key, value);
      },
      setAnnouncement(text, active) {
        if (currentUser.role !== "admin" && currentUser.role !== "super_admin") return;
        setPlatformSettings((prev) => ({ ...prev, announcement: text, announcementActive: active }));
        void updateAnnouncementLive(text, active);
      },
      blogPosts,
      contentPages,
      seoSettings,
      saveBlogPost(post) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setBlogPosts((items) => [post, ...items.filter((x) => x.id !== post.id && x.slug !== post.slug)]);
        if (liveUser) void saveBlogPostLive(post);
      },
      deleteBlogPost(id) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setBlogPosts((items) => items.filter((x) => x.id !== id));
        if (liveUser) void deleteBlogPostLive(id);
      },
      saveContentPage(page) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setContentPages((items) => [page, ...items.filter((x) => x.slug !== page.slug)]);
        if (liveUser) void saveContentPageLive(page);
      },
      saveSeoSetting(setting) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setSeoSettings((items) => [setting, ...items.filter((x) => x.path !== setting.path)]);
        if (liveUser) void saveSeoSettingLive(setting);
      },
      // Temel (kod) ağaç + admin'in eklediği aktif ekstra kategoriler.
      categoryTree: [
        ...baseCategoryTree,
        ...extraCategories.filter((c) => c.isActive).map<CategoryNode>((c) => ({
          key: c.key,
          label: c.label,
          slug: c.slug || c.key,
          image: c.image || undefined,
          children: c.subcategories.length ? c.subcategories.map((s) => ({ key: `${c.key}-${s.slug || s.label}`, label: s.label, slug: s.slug || s.label })) : undefined
        }))
      ],
      extraCategories,
      saveCategory(c) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setExtraCategories((items) => [...items.filter((x) => x.id !== c.id && x.key !== c.key), c].sort((a, b) => a.sortOrder - b.sortOrder));
        if (liveUser) void saveCategoryLive(c);
      },
      deleteCategory(id) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setExtraCategories((items) => items.filter((x) => x.id !== id));
        if (liveUser) void deleteCategoryLive(id);
      },
      hiddenCategories,
      toggleHiddenCategory(key) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        const willHide = !hiddenCategories.includes(key);
        const next = willHide ? [...hiddenCategories, key] : hiddenCategories.filter((k) => k !== key);
        setHiddenCategoriesModule(next); // önce modül (topCategories anında doğru filtreler)
        setHiddenCategoriesState(next);  // sonra state (yeniden render tetikler)
        if (liveUser) void setHiddenCategoryLive(key, willHide);
      },
      importCategories(list) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff || list.length === 0) return 0;
        setExtraCategories((items) => {
          const byKey = new Map(items.map((x) => [x.key, x]));
          for (const c of list) byKey.set(c.key, c);
          return Array.from(byKey.values()).sort((a, b) => a.sortOrder - b.sortOrder);
        });
        if (liveUser) void bulkInsertCategoriesLive(list);
        return list.length;
      },
      marketplaceHasMore,
      marketplaceLoadingMore,
      marketplaceInitialLoading,
      marketplaceLoadFailed,
      loadMoreMarketplace() {
        // BELLEK/DOM KORUMASI: sanallaştırma olmadan sonsuz kaydırma diziyi+düğümleri sınırsız
        // büyütüp sekmeyi dondurur/çökertir (milyonlarca ilanda). Bellekte tutulan katalog
        // ~MP_MAX ile sınırlı; sınıra gelince kullanıcı filtre/arama ile daraltır (Sahibinden'de
        // de sonsuz değil sayfalı gezinti vardır). Arama/filtre sunucu-taraflı olduğundan derinliğe
        // erişim kaybolmaz — yalnız tek seferde bellekte tutulan pencere sınırlıdır.
        const MP_MAX = 600;
        if (!isSupabaseConfigured || !marketplaceHasMore || marketplaceLoadingMore) return;
        if (mpOffsetRef.current >= MP_MAX) { setMarketplaceHasMore(false); return; }
        setMarketplaceLoadingMore(true);
        const PAGE = 60;
        const gen = mpGenRef.current; // refresh/retry bu sayacı artırırsa uçuştaki sonucu yok say
        void loadMarketplacePage(mpOffsetRef.current, PAGE)
          .then((page) => {
            if (!page || mpGenRef.current !== gen) return; // araya refresh girdi → offset kaymasını önle
            mpOffsetRef.current += page.listings.length;
            if (page.listings.length < PAGE || mpOffsetRef.current >= MP_MAX) setMarketplaceHasMore(false);
            if (page.listings.length) {
              setListings((items) => {
                const seen = new Set(items.map((l) => l.id));
                const fresh = page.listings.filter((l) => !seen.has(l.id));
                return fresh.length ? [...items, ...fresh] : items;
              });
              setUsers((items) => {
                const seen = new Set(items.map((u) => u.id));
                const fresh = page.users.filter((u) => !seen.has(u.id));
                return fresh.length ? [...items, ...fresh] : items;
              });
            }
          })
          .catch(() => { /* ağ hatası: mevcut liste korunur, spinner finally'de kapanır */ })
          .finally(() => setMarketplaceLoadingMore(false));
      },
      // Pull-to-refresh: ilk katalog snapshot'ını yeniden çeker (gerçek yeniden
      // yükleme — sahte gecikme/karıştırma yok). Önizleme modunda no-op.
      async refreshMarketplace() {
        if (!isSupabaseConfigured) return;
        mpGenRef.current += 1; // uçuştaki loadMore'u geçersiz kıl (yarış/offset kayması önlenir)
        const snapshot = await loadMarketplaceSnapshot();
        if (!snapshot) return;
        setMarketplaceLoadFailed(false);
        setUsers(snapshot.users);
        setListings(snapshot.listings);
        mpOffsetRef.current = snapshot.listings.length;
        setMarketplaceHasMore(snapshot.listings.length >= 90);
      },
      // İlk yükleme başarısızsa "Yeniden dene" düğmesinin çağırdığı retry: skeleton'ı
      // tekrar aç, snapshot'ı yeniden çek; yine başarısızsa fail durumunu koru.
      async retryMarketplace() {
        if (!isSupabaseConfigured) return;
        mpGenRef.current += 1; // uçuştaki loadMore'u geçersiz kıl
        setMarketplaceInitialLoading(true);
        setMarketplaceLoadFailed(false);
        try {
          const snapshot = await loadMarketplaceSnapshot();
          if (!snapshot) { setMarketplaceLoadFailed(true); return; }
          setUsers(snapshot.users);
          setListings(snapshot.listings);
          mpOffsetRef.current = snapshot.listings.length;
          setMarketplaceHasMore(snapshot.listings.length >= 90);
          setBackendMode("supabase");
        } catch {
          setMarketplaceLoadFailed(true);
        } finally {
          setMarketplaceInitialLoading(false);
        }
      },
      findConversation(id) {
        return conversationById.get(id);
      },
      findListing(id) {
        return listingById.get(id);
      },
      findUser(id) {
        return userById.get(id);
      },
      findPartnership(listingId, partnerId = currentUser.id) {
        return partnerships.find((item) => item.listingId === listingId && item.partnerId === partnerId);
      },
      isFavorite(listingId) {
        return favorites.some((item) => item.listingId === listingId && item.userId === currentUser.id);
      }
    };
  }, [authError, authReady, authUser, backendMode, blogPosts, contentPages, conversations, emailVerified, extraCategories, hiddenCategories, favorites, leads, listings, marketplaceHasMore, marketplaceLoadingMore, marketplaceInitialLoading, marketplaceLoadFailed, messages, notifications, orders, partnerships, pendingVerifyEmail, platformSettings, reports, reviews, sales, seoSettings, syncError, users]);

  // Hafif favori-önbelleğini app-store ile senkronla (kart favori kalbi için).
  const favToggleRef = useRef<(id: string) => void>(() => {});
  favToggleRef.current = value.toggleFavorite;
  useEffect(() => { registerFavoriteToggle((id) => favToggleRef.current(id)); }, []);
  useEffect(() => {
    syncFavorites(favorites.filter((f) => f.userId === currentUserId).map((f) => f.listingId));
  }, [favorites, currentUserId]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
















