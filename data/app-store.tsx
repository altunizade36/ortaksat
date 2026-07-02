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
import { commissionAmount } from "@/lib/format";
import {
  deleteFavorite,
  ensureProfile,
  createSupportTicketLive,
  insertFavorite,
  insertLead,
  insertListing,
  insertConversation,
  insertMessage,
  insertNotification,
  insertPartnership,
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
  updateListingInventoryLive,
  updatePartnershipStatus,
  updateReportStatusLive,
  updateProfileLive,
  savePreferencesLive,
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
  bulkInsertCategoriesLive,
  updatePlatformSettingLive,
  updateUserRoleLive,
  updateUserStatusLive,
  updateUserVerificationLive,
  updateSaleStatusLive
} from "@/lib/live-service";
import { rateLimit } from "@/lib/rate-limit";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { loadAccountSnapshot, loadAdminSnapshot, loadBlogPosts, loadCategories, loadContentPages, loadMarketplacePage, loadMarketplaceSnapshot, loadPlatformSettings, loadSeoSettings, type DbBlogPost, type DbContentPage, type DbSeoSetting, type ExtraCategory } from "@/lib/supabase-data";
import { categoryTree as baseCategoryTree, type CategoryNode } from "@/lib/category-tree";
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
>;

type PartnershipApplicationInput = {
  shareChannel: string;
  audience: string;
  platformHandle: string;
  reachEstimate: number;
  note: string;
};

type SaleFromLeadInput = {
  amount: number;
  quantity: number;
  deliveryStatus: Order["status"];
};

const LEGAL_CONSENT_VERSION = "2026-06-11";
const LEGAL_DOCUMENT_TYPES = ["privacy", "terms", "kvkk", "seller_rules"] as const;

type AppStore = {
  backendMode: "mock" | "supabase";
  authReady: boolean;
  authError?: string;
  currentUser: User;
  isAuthenticated: boolean;
  users: User[];
  listings: Listing[];
  marketplaceHasMore: boolean;
  marketplaceLoadingMore: boolean;
  loadMoreMarketplace: () => void;
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
  emailVerified: boolean;
  isSuspended: boolean;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (input: { email: string; password: string; name: string }) => Promise<boolean>;
  resetPasswordWithEmail: (email: string) => Promise<boolean>;
  updatePasswordWithEmail: (password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  updateProfile: (input: Pick<User, "name" | "phone" | "avatar" | "bio">) => Promise<boolean>;
  savePreferences: (preferences: Record<string, boolean>) => Promise<boolean>;
  reportListing: (listingId: string, reason: string, details?: string) => Promise<boolean>;
  reportUser: (reportedUserId: string, reason: string, details?: string) => Promise<boolean>;
  updateReportStatus: (reportId: string, status: Report["status"]) => Promise<boolean>;
  recordLegalConsent: (documentType: "privacy" | "terms" | "kvkk" | "seller_rules") => Promise<boolean>;
  createSupportTicket: (subject: string, message: string) => Promise<boolean>;
  requestAccountDeletion: (reason: string) => Promise<boolean>;
  createListing: (input: NewListingInput, statusOverride?: Listing["status"]) => Listing;
  updateListing: (listingId: string, input: NewListingInput) => Promise<boolean>;
  createLead: (input: Omit<Lead, "id" | "createdAt" | "status">) => Lead | undefined;
  createReview: (listingId: string, rating: number, comment: string) => Review;
  createSaleReview: (saleId: string, rating: number, comment: string) => Review | undefined;
  canReviewSale: (saleId: string) => boolean;
  createSaleFromLead: (leadId: string, input?: Partial<SaleFromLeadInput>) => Sale | undefined;
  joinListing: (listingId: string, input?: Partial<PartnershipApplicationInput>) => Partnership | undefined;
  approvePartnership: (partnershipId: string) => void;
  rejectPartnership: (partnershipId: string) => void;
  toggleFavorite: (listingId: string) => void;
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
  setListingFeatured: (listingId: string, featured: boolean) => void;
  deleteListing: (listingId: string) => void;
  setUserRole: (userId: string, role: UserRole) => void;
  setUserStatus: (userId: string, status: NonNullable<User["status"]>) => void;
  setUserVerification: (userId: string, field: "verifiedPhone" | "verifiedIdentity", value: boolean) => void;
  adminNotifyUser: (userId: string, title: string, body: string) => void;
  adminBroadcast: (title: string, body: string) => void;
  updateSaleStatus: (saleId: string, status: SaleStatus, reason?: string) => void;
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
    responseRate: 0,
    role: "user"
  };
}

function mergeUsers(localUsers: User[], remoteUsers: User[]) {
  const seen = new Set<string>();
  return [...remoteUsers, ...localUsers].filter((user) => {
    if (seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
}

// incoming id'leri prev'i EZER (admin tam verisi mevcut kısmi veriyi gunceller).
function mergeById<T extends { id: string }>(prev: T[], incoming: T[]): T[] {
  const map = new Map(prev.map((x) => [x.id, x]));
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values());
}

function mergeMarketplaceListings(remoteListings: Listing[]) {
  if (remoteListings.length >= 12) return remoteListings;

  const seenIds = new Set(remoteListings.map((listing) => listing.id));
  const seenSlugs = new Set(remoteListings.map((listing) => listing.slug));
  const previewListings = initialListings.filter((listing) => !seenIds.has(listing.id) && !seenSlugs.has(listing.slug));
  return [...remoteListings, ...previewListings];
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
  const [users, setUsers] = useState<User[]>(isSupabaseConfigured ? [] : initialUsers);
  const [listings, setListings] = useState<Listing[]>(isSupabaseConfigured ? [] : initialListings);
  const [partnerships, setPartnerships] = useState(isSupabaseConfigured ? [] : initialPartnerships);
  const [leads, setLeads] = useState(isSupabaseConfigured ? [] : initialLeads);
  const [sales, setSales] = useState(isSupabaseConfigured ? [] : initialSales);
  const [orders, setOrders] = useState(isSupabaseConfigured ? [] : initialOrders);
  const [reviews, setReviews] = useState(isSupabaseConfigured ? [] : initialReviews);
  const [favorites, setFavorites] = useState(isSupabaseConfigured ? [] : initialFavorites);
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
  const [marketplaceHasMore, setMarketplaceHasMore] = useState(isSupabaseConfigured);
  const [marketplaceLoadingMore, setMarketplaceLoadingMore] = useState(false);
  const [blogPosts, setBlogPosts] = useState<DbBlogPost[]>([]);
  const [contentPages, setContentPages] = useState<DbContentPage[]>([]);
  const [seoSettings, setSeoSettings] = useState<DbSeoSetting[]>([]);
  const [extraCategories, setExtraCategories] = useState<ExtraCategory[]>([]);
  // Preview (no-Supabase) auth registry so register/login/logout work end-to-end in demo mode.
  const [mockAccounts, setMockAccounts] = useState<Record<string, { password: string; user: User }>>({});
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
      const snapshot = await loadMarketplaceSnapshot();
      if (!mounted || !snapshot) return;
      // Canlı: yalnızca gerçek Supabase verisi (demo/mock birleştirme yok).
      setUsers(snapshot.users);
      setListings(snapshot.listings);
      mpOffsetRef.current = snapshot.listings.length;
      setMarketplaceHasMore(snapshot.listings.length >= 90);
      setBackendMode("supabase");
      const settings = await loadPlatformSettings();
      if (mounted && settings) setPlatformSettings(settings);
      const [posts, pages, seo, cats] = await Promise.all([loadBlogPosts(), loadContentPages(), loadSeoSettings(), loadCategories()]);
      if (!mounted) return;
      setBlogPosts(posts);
      setContentPages(pages);
      setSeoSettings(seo);
      setExtraCategories(cats);
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
              successfulSales: 0,
              responseRate: data.response_rate ?? 0,
              role: data.role ?? "user",
              status: (data.status as User["status"]) ?? "active",
              preferences: (data.preferences ?? {}) as Record<string, boolean>
            }
          : fallback;

      await ensureProfile(profile);
      const account = await loadAccountSnapshot(profile.id);
      if (!mounted) return;
      setAuthUser(profile);
      setUsers((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
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
      }
      setBackendMode("supabase");
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError(error.message);
      const user = data.session?.user;
      if (user) {
        setEmailVerified(Boolean(user.email_confirmed_at));
        void loadProfile(user.id, user.phone, user.user_metadata?.full_name);
      } else if (mounted) {
        setAuthUser(null);
        setEmailVerified(false);
      }
      if (mounted) setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user) {
        setEmailVerified(Boolean(user.email_confirmed_at));
        void loadProfile(user.id, user.phone, user.user_metadata?.full_name);
      } else {
        setAuthUser(null);
        setEmailVerified(false);
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
            lastMessageAt: row.last_message_at?.slice(0, 16).replace("T", " ") ?? row.created_at.slice(0, 16).replace("T", " "),
            createdAt: row.created_at.slice(0, 16).replace("T", " ")
          };
          setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
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
            createdAt: row.created_at.slice(0, 16).replace("T", " "),
            read: row.read,
            attachmentUrl: row.attachment_url ?? undefined,
            attachmentType: row.attachment_type ?? undefined,
            attachmentName: row.attachment_name ?? undefined
          };
          setMessages((items) => (items.some((item) => item.id === message.id) ? items : [message, ...items]));
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
            createdAt: row.created_at.slice(0, 16).replace("T", " ")
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
      const now = new Date().toISOString().slice(0, 16).replace("T", " ");
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
        if (liveUser) void insertMessage(message);
      }
      return conversation;
    }
    function notify(userId: string, type: Notification["type"], title: string, body: string) {
      const notification: Notification = {
        id: newId("n", liveUser),
        userId,
        type,
        title,
        body,
        read: false,
        createdAt: today()
      };
      setNotifications((items) => [notification, ...items]);
      if (liveUser) void insertNotification(notification);
    }

    return {
      backendMode,
      authReady,
      authError,
      currentUser,
      isAuthenticated,
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
          const cleanEmail = email.trim().toLocaleLowerCase("tr-TR");
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
        setAuthError(error?.message);
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
          const cleanEmail = input.email.trim().toLocaleLowerCase("tr-TR");
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
            responseRate: 100
          };
          setMockAccounts((m) => ({ ...m, [cleanEmail]: { password: input.password, user: mockUser } }));
          setAuthError(undefined);
          return true;
        }
        const cleanEmail = input.email.trim().toLocaleLowerCase("tr-TR");
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
            emailRedirectTo: "ortaksat://auth"
          }
        });
        setAuthError(error?.message);
        if (data.session?.user) {
          const profile = userFromAuth(data.session.user.id, data.session.user.phone, displayName);
          await ensureProfile(profile);
          await Promise.all(LEGAL_DOCUMENT_TYPES.map((documentType) => recordLegalConsentLive(profile.id, documentType)));
          setAuthUser(profile);
          setUsers((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
          void logActivity("sign_up", { userId: profile.id });
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
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLocaleLowerCase("tr-TR"), {
          redirectTo: "ortaksat://auth"
        });
        setAuthError(error?.message);
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
        setAuthError(error?.message);
        return !error;
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
      async signOut() {
        if (supabase) await supabase.auth.signOut();
        setAuthUser(null);
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
      async updateReportStatus(reportId, status) {
        const report = reports.find((item) => item.id === reportId);
        if (!report) return false;
        if (!liveUser || (currentUser.role !== "admin" && currentUser.role !== "moderator")) return false;
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
          void insertListing(listing);
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
        if (liveUser) void insertLead(lead);
        return lead;
      },
      createReview(listingId, rating, comment) {
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
        if (liveUser) void insertReview(review);
        return review;
      },
      canReviewSale(saleId) {
        const sale = sales.find((item) => item.id === saleId);
        if (!sale || sale.status === "pending") return false;
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
        if (liveUser) void insertReview(review);
        return review;
      },
      createSaleFromLead(leadId, input) {
        const lead = leads.find((item) => item.id === leadId);
        if (!lead || lead.status === "lost" || lead.status === "converted" || sales.some((sale) => sale.leadId === leadId)) return undefined;

        const listing = listings.find((item) => item.id === lead.listingId);
        const partnership = partnerships.find((item) => item.id === lead.partnershipId);
        if (!listing || listing.ownerId !== currentUser.id || listing.status !== "active" || listing.stockCount <= 0 || !partnership || partnership.status !== "active") return undefined;

        const quantity = Math.max(1, Math.floor(input?.quantity ?? 1));
        const amount = Number.isFinite(input?.amount) && Number(input?.amount) > 0 ? Number(input?.amount) : listing.price * quantity;
        const returnUntil = new Date(Date.now() + listing.returnWindowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const sale: Sale = {
          id: newId("s", liveUser),
          listingId: listing.id,
          partnershipId: lead.partnershipId,
          leadId: lead.id,
          amount,
          quantity,
          commissionAmount: listing.commissionType === "rate" ? Math.round((amount * listing.commissionValue) / 100) : commissionAmount(listing) * quantity,
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
        if (partnership) notify(partnership.partnerId, "sale", "Satış kaydı oluştu", `${listing.title} için komisyon kaydı iade penceresine alındı.`);
        if (liveUser) void insertSaleFromLead(sale, listing);
        if (liveUser) void updateListingInventoryLive(updatedListing);
        return sale;
      },
      joinListing(listingId, input) {
        if (isSuspended) { setAuthError("Hesabın askıya alındığı için işlem yapamazsın."); return undefined; }
        const listing = listings.find((item) => item.id === listingId);
        if (listing?.demo) { setAuthError("Bu bir örnek (vitrin) ilandır; ortaklık kapalıdır."); return undefined; }
        if (!listing || listing.ownerId === currentUser.id || listing.status !== "active") {
          setAuthError("Bu ilana ortak olunamaz. İlan pasif olabilir veya kendi ilanın olabilir.");
          return undefined;
        }
        if (listing.partnershipMode === "invite") {
          setAuthError("Bu ilan sadece davetli ortaklara açıktır.");
          return undefined;
        }
        if (currentUser.rating < listing.minPartnerRating) {
          setAuthError(`Bu ilan için en az ${listing.minPartnerRating} ortak puanı gerekiyor.`);
          return undefined;
        }

        const existing = partnerships.find(
          (item) => item.listingId === listingId && item.partnerId === currentUser.id
        );
        if (existing) {
          setAuthError(undefined);
          return existing;
        }

        const status = listing.partnershipMode === "open" ? "active" : "pending";
        const partnership: Partnership = {
          id: newId("p", liveUser),
          listingId,
          partnerId: currentUser.id,
          refCode: makeRefCode(currentUser.id, listingId),
          status,
          note: input?.note?.trim() || "Bu ürünü kendi çevremde paylaşmak istiyorum.",
          shareChannel: input?.shareChannel?.trim() || "WhatsApp ve sosyal medya",
          audience: input?.audience?.trim() || "Yakın çevrem ve takipçilerim",
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
          notify(listing.ownerId, "application", "Yeni ortak başvurusu", `${currentUser.name}, ${listing.title} ilanına başvurdu.`);
        }
        if (liveUser) void insertPartnership(partnership);
        return partnership;
      },
      approvePartnership(partnershipId) {
        const partnership = partnerships.find((item) => item.id === partnershipId);
        const listing = partnership ? listings.find((item) => item.id === partnership.listingId) : undefined;
        if (!partnership || !listing || listing.ownerId !== currentUser.id || partnership.status !== "pending") return;
        const updatedPartnership: Partnership = { ...partnership, status: "active", approvedAt: today() };
        setPartnerships((items) => items.map((item) => (item.id === partnershipId ? updatedPartnership : item)));
        setListings((items) =>
          items.map((listing) =>
            listing.id === partnership.listingId ? { ...listing, partnerCount: listing.partnerCount + 1 } : listing
          )
        );
        notify(partnership.partnerId, "application", "Ortaklık kabul edildi", "Paylaşım linkin aktif edildi.");
        if (liveUser) void updatePartnershipStatus(updatedPartnership);
      },
      rejectPartnership(partnershipId) {
        const partnership = partnerships.find((item) => item.id === partnershipId);
        const listing = partnership ? listings.find((item) => item.id === partnership.listingId) : undefined;
        if (!partnership || !listing || listing.ownerId !== currentUser.id || partnership.status !== "pending") return;
        const updatedPartnership = partnership
          ? { ...partnership, status: "rejected" as const, rejectionReason: "Satıcı bu başvuruyu uygun görmedi." }
          : undefined;
        setPartnerships((items) =>
          items.map((item) => (item.id === partnershipId && updatedPartnership ? updatedPartnership : item))
        );
        if (partnership) notify(partnership.partnerId, "application", "Ortaklık reddedildi", "Satıcı bu başvuruyu uygun görmedi.");
        if (liveUser && updatedPartnership) void updatePartnershipStatus(updatedPartnership);
      },
      toggleFavorite(listingId) {
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
        setFavorites((items) => [{ id: favoriteId, listingId, userId: currentUser.id }, ...items]);
        setListings((items) =>
          items.map((listing) =>
            listing.id === listingId ? { ...listing, favoriteCount: listing.favoriteCount + 1 } : listing
          )
        );
        if (liveUser) void insertFavorite(listingId, currentUser.id, favoriteId);
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
          createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
          read: false,
          attachmentUrl: attachment?.url,
          attachmentType: attachment?.type,
          attachmentName: attachment?.name
        };
        setMessages((items) => [message, ...items]);
        setConversations((items) => items.map((item) => (item.id === conversationId ? { ...item, lastMessageAt: message.createdAt } : item)));
        const preview = trimmed || (attachment?.type === "file" ? `📎 ${attachment.name ?? "Dosya"}` : "📷 Görsel");
        notify(receiverId, "message", "Yeni mesaj", `${currentUser.name}: ${preview}`);
        if (liveUser) void insertMessage(message);
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
        setCategorySuggestions((items) => [
          { id: newId("cs", liveUser), userId: currentUser.id, userName: currentUser.name, suggestedPath: input.suggestedPath, note: input.note, listingId: input.listingId, status: "pending", createdAt: today() },
          ...items
        ]);
      },
      addLocationSuggestion(input) {
        setLocationSuggestions((items) => [
          { id: newId("ls", liveUser), userId: currentUser.id, userName: currentUser.name, provinceId: input.provinceId, districtId: input.districtId, suggestedName: input.suggestedName, type: "neighborhood", note: input.note, status: "pending", createdAt: today() },
          ...items
        ]);
      },
      setCategorySuggestionStatus(id, status) {
        setCategorySuggestions((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
      },
      setLocationSuggestionStatus(id, status) {
        setLocationSuggestions((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
      },
      updateLeadStatus(leadId, status) {
        const lead = leads.find((item) => item.id === leadId);
        const listing = lead ? listings.find((item) => item.id === lead.listingId) : undefined;
        if (!lead || !listing || listing.ownerId !== currentUser.id) return;
        setLeads((items) => items.map((item) => (item.id === leadId ? { ...item, status } : item)));
        if (liveUser && lead) void updateLeadStatusLive({ ...lead, status });
      },
      updateListingStatus(listingId, status) {
        const listing = listings.find((item) => item.id === listingId);
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        // İlan sahibi veya admin/moderatör (moderasyon) değiştirebilir.
        if (!listing || (listing.ownerId !== currentUser.id && !isStaff)) return;
        setListings((items) => items.map((item) => (item.id === listingId ? { ...item, status } : item)));
        if (liveUser) void updateListingStatusLive({ ...listing, status });
      },
      setListingFeatured(listingId, featured) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setListings((items) => items.map((item) => (item.id === listingId ? { ...item, featured } : item)));
        if (liveUser) void updateListingFeaturedLive(listingId, featured);
      },
      deleteListing(listingId) {
        const listing = listings.find((item) => item.id === listingId);
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!listing || (listing.ownerId !== currentUser.id && !isStaff)) return;
        setListings((items) => items.filter((item) => item.id !== listingId));
        if (liveUser) void deleteListingLive(listingId);
      },
      setUserRole(userId, role) {
        const isAdmin = currentUser.role === "admin" || currentUser.role === "super_admin";
        if (!isAdmin || userId === currentUser.id) return; // kendi rolunu degistirme
        setUsers((items) => items.map((item) => (item.id === userId ? { ...item, role } : item)));
        if (liveUser) void updateUserRoleLive(userId, role);
      },
      setUserStatus(userId, status) {
        const isAdmin = currentUser.role === "admin" || currentUser.role === "super_admin";
        if (!isAdmin || userId === currentUser.id) return;
        setUsers((items) => items.map((item) => (item.id === userId ? { ...item, status } : item)));
        if (liveUser) void updateUserStatusLive(userId, status);
      },
      setUserVerification(userId, field, value) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setUsers((items) => items.map((item) => (item.id === userId ? { ...item, [field]: value } : item)));
        if (liveUser) void updateUserVerificationLive(userId, field, value);
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
        if (
          !sale ||
          (sellerAction && !isSeller) ||
          (partnerAction && !isPartner) ||
          (status === "disputed" && !isSeller && !isPartner)
        ) {
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
        if (liveUser && updatedSale) void updateSaleStatusLive(updatedSale);
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
      loadMoreMarketplace() {
        if (!isSupabaseConfigured || !marketplaceHasMore || marketplaceLoadingMore) return;
        setMarketplaceLoadingMore(true);
        const PAGE = 60;
        void loadMarketplacePage(mpOffsetRef.current, PAGE)
          .then((page) => {
            if (!page) return;
            mpOffsetRef.current += page.listings.length;
            if (page.listings.length < PAGE) setMarketplaceHasMore(false);
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
          .finally(() => setMarketplaceLoadingMore(false));
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
  }, [authError, authReady, authUser, backendMode, blogPosts, contentPages, conversations, emailVerified, extraCategories, favorites, leads, listings, marketplaceHasMore, marketplaceLoadingMore, messages, notifications, orders, partnerships, platformSettings, reports, reviews, sales, seoSettings, users]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
















