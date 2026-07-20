import { supabase } from "@/lib/supabase";
import { getDemoProductImageMeta } from "@/lib/demo-product-images";
import { msgStamp } from "@/lib/format";
import { displayText, repairTurkishText } from "@/lib/text";
import type { CategorySuggestion, Conversation, Favorite, Lead, Listing, LocationSuggestion, Message, Notification, NotificationMeta, Order, Partnership, Report, Review, Sale, SuggestionStatus, User } from "@/lib/types";

type PublicListingCardRow = {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  description: string;
  sales_pitch: string[] | null;
  share_templates?: Listing["shareTemplates"] | null;
  ad_assets?: string[] | null;
  tags: string[] | null;
  attributes?: Record<string, string | number | boolean | string[]> | null;
  price: number | string;
  currency?: string | null;
  demo?: boolean | null;
  commission_type: Listing["commissionType"];
  commission_value: number | string;
  commission_tiers?: Array<{ min?: number | string; minSales?: number | string; rate?: number | string }> | null;
  bonus_amount?: number | string | null;
  bonus_quota?: number | string | null;
  category: string;
  location: string;
  province_id?: number | null;
  district_id?: number | null;
  neighborhood_id?: number | null;
  status: Listing["status"];
  partnership_mode: Listing["partnershipMode"];
  stock_count: number | null;
  min_partner_rating: number | string | null;
  commission_due_days: number | null;
  return_window_days: number | null;
  attribution_window_days: number | null;
  partner_rules: string[] | null;
  delivery_note: string | null;
  contact_method: Listing["contactMethod"];
  created_at: string;
  image_url: string | null;
  partner_count: number | string | null;
  lead_count: number | string | null;
  favorite_count: number | string | null;
  review_count: number | string | null;
  featured?: boolean | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  verified_phone: boolean;
  verified_identity: boolean;
  verified_instagram?: boolean | null;
  rating: number | string | null;
  response_rate: number | null;
  role?: User["role"] | null;
  status?: string | null;
  successful_sales?: number | null;
  follower_count?: number | null;
};

// Herkese açık (anon dahil) profil okumalarında yalnızca gösterime uygun kolonlar
// çekilir. `phone` ve `preferences` KASITEN dışarıda: anon role'de bu kolonlar
// DB'de geri alınmıştır (bkz. migration 20260704120000_profiles_phone_privacy),
// telefon yalnızca iletişim anında girişli kullanıcıya `fetchSellerPhone` ile verilir.
const PUBLIC_PROFILE_COLUMNS =
  "id, full_name, avatar_url, bio, verified_phone, verified_identity, verified_instagram, rating, response_rate, role, status, successful_sales, follower_count" as const;

export type MarketplaceSnapshot = {
  listings: Listing[];
  users: User[];
};

export type AccountSnapshot = {
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
};

/** Bildirim metadata'sını (jsonb → nesne) güvenli çözer; boşsa undefined. */
export function parseNotifMeta(raw: unknown): NotificationMeta | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const m = raw as Record<string, unknown>;
  const pick = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const meta: NotificationMeta = { listingId: pick(m.listingId), leadId: pick(m.leadId), partnershipId: pick(m.partnershipId), conversationId: pick(m.conversationId) };
  return meta.listingId || meta.leadId || meta.partnershipId || meta.conversationId ? meta : undefined;
}

function toNumber(value: number | string | null | undefined, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR"))
    .join("");
}

function mapProfile(row: ProfileRow): User {
  const name = displayText(row.full_name, "Ortaksat kullanıcısı");

  return {
    id: row.id,
    name,
    phone: row.phone ?? "",
    avatar: row.avatar_url || initials(name) || "OS",
    bio: repairTurkishText(row.bio ?? ""),
    verifiedPhone: row.verified_phone,
    verifiedIdentity: row.verified_identity,
    verifiedInstagram: Boolean(row.verified_instagram),
    rating: toNumber(row.rating),
    listingCount: 0,
    successfulSales: toNumber(row.successful_sales),
    followerCount: toNumber(row.follower_count),
    responseRate: row.response_rate ?? 0,
    role: row.role ?? "user",
    status: (row.status as User["status"]) ?? "active"
  };
}

function mapListing(row: PublicListingCardRow): Listing {
  const baseImage = row.image_url ?? "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200";
  const title = displayText(row.title);
  const category = displayText(row.category);
  const demoImage = Boolean(row.demo) ? getDemoProductImageMeta({ title, category, image: baseImage }) : undefined;

  return {
    id: row.id,
    ownerId: row.owner_id,
    title,
    slug: row.slug,
    description: repairTurkishText(row.description),
    salesPitch: (row.sales_pitch ?? []).map(repairTurkishText),
    shareTemplates: row.share_templates ?? undefined,
    adAssets: row.ad_assets ?? [],
    tags: (row.tags ?? []).map(repairTurkishText),
    attributes: row.attributes ?? undefined,
    price: toNumber(row.price),
    currency: (row.currency as Listing["currency"]) ?? "TRY",
    demo: Boolean(row.demo),
    commissionType: row.commission_type,
    commissionValue: toNumber(row.commission_value),
    commissionTiers: Array.isArray(row.commission_tiers)
      ? row.commission_tiers.map((t) => ({ minSales: toNumber(t.minSales ?? t.min ?? 0), rate: toNumber(t.rate ?? 0) })).filter((t) => t.rate > 0).sort((a, b) => a.minSales - b.minSales)
      : undefined,
    bonusAmount: row.bonus_amount != null ? toNumber(row.bonus_amount) : undefined,
    bonusQuota: row.bonus_quota != null ? toNumber(row.bonus_quota) : undefined,
    category,
    location: displayText(row.location),
    provinceId: row.province_id ?? undefined,
    districtId: row.district_id ?? undefined,
    neighborhoodId: row.neighborhood_id ?? undefined,
    image: demoImage?.imageUrl ?? baseImage,
    imageUrl: demoImage?.imageUrl ?? baseImage,
    imageAlt: demoImage?.imageAlt ?? `${title} ilan görseli`,
    fallbackCategoryImage: demoImage?.fallbackCategoryImage,
    status: row.status,
    partnershipMode: row.partnership_mode,
    stockCount: row.stock_count ?? 0,
    minPartnerRating: toNumber(row.min_partner_rating),
    commissionDueDays: row.commission_due_days ?? 0,
    returnWindowDays: row.return_window_days ?? 0,
    attributionWindowDays: row.attribution_window_days ?? 30,
    partnerRules: (row.partner_rules ?? []).map(repairTurkishText),
    partnerCount: toNumber(row.partner_count),
    leadCount: toNumber(row.lead_count),
    favoriteCount: toNumber(row.favorite_count),
    reviewCount: toNumber(row.review_count),
    deliveryNote: repairTurkishText(row.delivery_note ?? ""),
    contactMethod: row.contact_method,
    createdAt: row.created_at.slice(0, 10),
    featured: Boolean(row.featured)
  };
}
// Tek bir ilanı id ile çeker (paylaşılan link herkeste açılsın diye). Aktif ilanlar
// listing_public_cards (RLS-güvenli, public) üzerinden gelir; sahibi de getirilir.
export async function fetchListingById(id: string): Promise<{ listing: Listing; owner?: User } | { error: true } | null> {
  if (!supabase || !id) return null;
  const { data, error } = await supabase.from("listing_public_cards").select("*").eq("id", id).maybeSingle();
  // Ağ/RLS hatası "bulunamadı" DEĞİL → çağıran retry gösterebilsin (paylaşılan linkte geçici
  // ağ hatası ilanı "silinmiş" gibi gösterip affiliate dönüşümünü öldürüyordu).
  if (error) return { error: true };
  if (!data) return null;
  const listing = mapListing(data as PublicListingCardRow);
  let owner: User | undefined;
  const prof = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("id", listing.ownerId).maybeSingle();
  if (prof.data) owner = mapProfile(prof.data as ProfileRow);
  return { listing, owner };
}

// Satıcı telefonunu YALNIZCA iletişim anında, ayrı ve dar bir sorguyla çeker.
// `phone` kolonu anon role'de DB'de geri alındığı için giriş yapmamış ziyaretçi
// boş ("") alır → uygulama uygulama-içi mesaja/girişe düşer. Girişli kullanıcı
// gerçek numarayı alıp WhatsApp/tel bağlantısını kurar. Telefon hiçbir zaman
// listeleme/feed yanıtında taşınmaz (kazıma yüzeyi kapalı).
export async function fetchSellerPhone(ownerId: string): Promise<string> {
  if (!supabase || !ownerId) return "";
  const { data, error } = await supabase.from("profiles").select("phone").eq("id", ownerId).maybeSingle();
  if (error || !data) return "";
  return (data as { phone: string | null }).phone ?? "";
}

export type AuditEntry = { id: number; userId: string | null; action: string; entityType: string | null; entityId: string | null; createdAt: string };

// Admin denetim kayıtları (activity_logs). RLS yalnızca admin'e okuma verir;
// admin değilse boş döner. Son 50 kayıt + son 1 saatteki hız-limiti olay sayısı.
export async function fetchAdminAudit(): Promise<{ logs: AuditEntry[]; rateHits: number } | null> {
  if (!supabase) return null;
  const [logsRes, rateRes] = await Promise.all([
    supabase.from("activity_logs").select("id,user_id,action,entity_type,entity_id,created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("rate_limits").select("id", { count: "exact", head: true }).gte("occurred_at", new Date(Date.now() - 3600_000).toISOString())
  ]);
  if (logsRes.error) return null; // admin değil / erişim yok
  const logs: AuditEntry[] = (logsRes.data ?? []).map((r: { id: number; user_id: string | null; action: string; entity_type: string | null; entity_id: string | null; created_at: string }) => ({
    id: r.id, userId: r.user_id, action: r.action, entityType: r.entity_type, entityId: r.entity_id, createdAt: (r.created_at || "").slice(0, 16).replace("T", " ")
  }));
  return { logs, rateHits: rateRes.count ?? 0 };
}

/**
 * Admin tam veri: TUM ilanlar (her statu) + TUM kullanicilar. RLS "admins read
 * all listings" ile admin/moderator icin calisir; normal kullanicida bos/az doner.
 */
export async function loadAdminSnapshot(limit = 1000): Promise<{ listings: Listing[]; users: User[] } | null> {
  if (!supabase) return null;
  const [listingsResult, profilesResult] = await Promise.all([
    supabase.from("listing_public_cards").select("*").order("created_at", { ascending: false }).limit(limit),
    supabase.from("profiles").select("*").order("updated_at", { ascending: false }).limit(limit)
  ]);
  if (listingsResult.error && profilesResult.error) return null;
  const listings = ((listingsResult.data ?? []) as PublicListingCardRow[]).map(mapListing);
  const users = ((profilesResult.data ?? []) as ProfileRow[]).map(mapProfile);
  const counts = listings.reduce<Record<string, number>>((acc, l) => { acc[l.ownerId] = (acc[l.ownerId] ?? 0) + 1; return acc; }, {});
  return { listings, users: users.map((u) => ({ ...u, listingCount: counts[u.id] ?? u.listingCount })) };
}

/** Kategori + konum önerilerini çeker. RLS: kullanıcı kendi önerilerini, admin
 *  hepsini görür (user_id=auth.uid() OR is_admin()). Giriş yoksa/hata boş döner. */
export async function loadSuggestions(): Promise<{ categorySuggestions: CategorySuggestion[]; locationSuggestions: LocationSuggestion[] }> {
  if (!supabase) return { categorySuggestions: [], locationSuggestions: [] };
  const [catRes, locRes] = await Promise.all([
    supabase.from("category_suggestions").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("location_suggestions").select("*").order("created_at", { ascending: false }).limit(500)
  ]);
  const categorySuggestions = ((catRes.data ?? []) as Array<Record<string, any>>).map((r) => ({
    id: String(r.id),
    userId: String(r.user_id ?? ""),
    listingId: r.listing_id ?? undefined,
    suggestedPath: String(r.suggested_path ?? ""),
    note: r.note ?? undefined,
    status: (r.status ?? "pending") as SuggestionStatus,
    createdAt: String(r.created_at ?? "").slice(0, 10)
  }));
  const locationSuggestions = ((locRes.data ?? []) as Array<Record<string, any>>).map((r) => ({
    id: String(r.id),
    userId: String(r.user_id ?? ""),
    provinceId: r.province_id ?? undefined,
    districtId: r.district_id ?? undefined,
    suggestedName: String(r.suggested_name ?? ""),
    type: String(r.type ?? "neighborhood"),
    note: r.note ?? undefined,
    status: (r.status ?? "pending") as SuggestionStatus,
    createdAt: String(r.created_at ?? "").slice(0, 10)
  }));
  return { categorySuggestions, locationSuggestions };
}

export type DbBlogPost = { id: string; slug: string; category: string; title: string; excerpt: string; author: string; authorRole: string; readMin: number; image: string; featured: boolean; body: string[]; status: string; createdAt: string };
export type DbContentPage = { slug: string; title: string; body: string; seoTitle: string; seoDescription: string };
export type DbSeoSetting = { path: string; metaTitle: string; metaDescription: string; ogImage: string; noindex: boolean };

export type ListingQuestion = { id: string; listingId: string; askerId: string | null; askerName: string; question: string; answer: string | null; answeredAt: string | null; createdAt: string };
export async function loadListingQuestions(listingId: string): Promise<ListingQuestion[]> {
  if (!supabase || !listingId) return [];
  const { data, error } = await supabase.from("listing_questions").select("*").eq("listing_id", listingId).order("created_at", { ascending: false }).limit(50);
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id), listingId: String(r.listing_id), askerId: (r.asker_id as string) ?? null,
    askerName: displayText((r.asker_name as string) ?? "Kullanıcı"), question: repairTurkishText(String(r.question ?? "")),
    answer: r.answer ? repairTurkishText(String(r.answer)) : null, answeredAt: (r.answered_at as string) ?? null, createdAt: String(r.created_at ?? "")
  }));
}

export type ExtraCategory = { id: string; key: string; label: string; slug: string; image: string; subcategories: Array<{ label: string; slug: string }>; sortOrder: number; isActive: boolean };
export async function loadCategories(): Promise<ExtraCategory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("categories").select("*").order("sort_order", { ascending: true }).limit(200);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id, key: r.key, label: r.label, slug: r.slug ?? "", image: r.image ?? "",
    subcategories: Array.isArray(r.subcategories) ? r.subcategories : [], sortOrder: r.sort_order ?? 0, isActive: Boolean(r.is_active)
  }));
}

export async function loadBlogPosts(): Promise<DbBlogPost[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false }).limit(500);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id, slug: r.slug, category: r.category, title: r.title, excerpt: r.excerpt ?? "", author: r.author ?? "OrtakSat",
    authorRole: r.author_role ?? "Editör", readMin: r.read_min ?? 3, image: r.image ?? "", featured: Boolean(r.featured),
    body: Array.isArray(r.body) ? r.body : [], status: r.status ?? "published", createdAt: (r.created_at ?? "").slice(0, 10)
  }));
}

export async function loadContentPages(): Promise<DbContentPage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("content_pages").select("*").limit(100);
  if (error || !data) return [];
  return data.map((r) => ({ slug: r.slug, title: r.title ?? "", body: r.body ?? "", seoTitle: r.seo_title ?? "", seoDescription: r.seo_description ?? "" }));
}

export async function loadSeoSettings(): Promise<DbSeoSetting[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("seo_settings").select("*").limit(200);
  if (error || !data) return [];
  return data.map((r) => ({ path: r.path, metaTitle: r.meta_title ?? "", metaDescription: r.meta_description ?? "", ogImage: r.og_image ?? "", noindex: Boolean(r.noindex) }));
}

export async function loadPlatformSettings(): Promise<import("@/lib/types").PlatformSettings | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return null;
  return {
    allowSignups: data.allow_signups ?? true,
    reviewBeforePublish: data.review_before_publish ?? false,
    requireEmailVerification: data.require_email_verification ?? false,
    maintenanceMode: data.maintenance_mode ?? false,
    announcement: data.announcement ?? "",
    announcementActive: data.announcement_active ?? false
  };
}

type PrefetchBag = { listings: Promise<unknown>; profiles: Promise<unknown> };

/**
 * İlk açılışta besleme isteği, JS bundle inip çalışana kadar (~1,07sn) HİÇ başlamıyordu.
 * app/+html.tsx belge ayrıştırılırken (~50ms) aynı iki isteği başlatıp promise'leri
 * window.__osPrefetch'e koyar. Burada onları TÜKETİRİZ — böylece istek iki kez gitmez.
 * Ön-çekim yoksa/başarısızsa sessizce normal yola düşülür (yanlış veri riski yok).
 */
async function takePrefetched(): Promise<MarketplaceSnapshot | null> {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __osPrefetch?: PrefetchBag | null };
  const bag = w.__osPrefetch;
  if (!bag) return null;
  w.__osPrefetch = null; // yalnız ilk açılış; sonraki yenilemeler canlı veri çeker
  try {
    const [rawListings, rawProfiles] = await Promise.all([bag.listings, bag.profiles]);
    if (!Array.isArray(rawListings) || !Array.isArray(rawProfiles)) return null;
    const listings = (rawListings as PublicListingCardRow[]).map(mapListing);
    const users = (rawProfiles as ProfileRow[]).map(mapProfile);
    const counts = listings.reduce<Record<string, number>>((acc, l) => { acc[l.ownerId] = (acc[l.ownerId] ?? 0) + 1; return acc; }, {});
    return { listings, users: users.map((u) => ({ ...u, listingCount: counts[u.id] ?? u.listingCount })) };
  } catch {
    return null;
  }
}

export async function loadMarketplaceSnapshot(): Promise<MarketplaceSnapshot | null> {
  if (!supabase) return null;

  const prefetched = await takePrefetched();
  if (prefetched) return prefetched;

  const [listingsResult, profilesResult] = await Promise.all([
    supabase
      .from("listing_public_cards")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(90),
    supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).limit(200)
  ]);

  if (listingsResult.error || profilesResult.error) {
    return null;
  }

  const listings = ((listingsResult.data ?? []) as PublicListingCardRow[]).map(mapListing);
  const users = ((profilesResult.data ?? []) as ProfileRow[]).map(mapProfile);

  // NOT: sıfır satır HATA DEĞİLDİR — yeni/boş katalog geçerli bir durumdur. Yalnız gerçek
  // `.error` (yukarıda) null döner → "bağlantı hatası" ekranı yalnız gerçekten kopukken çıkar;
  // boş katalogda gerçek "ilk ilanı sen ver" empty-state'i gösterilir.

  const listingCounts = listings.reduce<Record<string, number>>((acc, listing) => {
    acc[listing.ownerId] = (acc[listing.ownerId] ?? 0) + 1;
    return acc;
  }, {});

  return {
    listings,
    users: users.map((user) => ({ ...user, listingCount: listingCounts[user.id] ?? user.listingCount }))
  };
}

/**
 * Kullanıcının KENDİ ilanlarını (her statü: active/pending_review/paused/sold)
 * getirir. Katalog snapshot'ı yalnız active çektiğinden, satıcı reload'da kendi
 * onay-bekleyen/duraklatılmış ilanlarını göremiyordu (özellikle toplu yükleme
 * sonrası). RLS `owner_id = auth.uid()` sahibin tüm statüleri görmesine izin verir.
 */
export async function loadOwnListings(userId: string): Promise<Listing[]> {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("listing_public_cards")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return (data as PublicListingCardRow[]).map(mapListing);
}

/**
 * Katalog sayfalama: sunucudan sonraki ilan sayfasini ve o ilanlarin sahiplerini
 * getirir. Sonsuz kaydirma icin `offset` kadar atlar, `limit` kadar okur.
 * Donen liste `limit`'ten azsa katalog bitti demektir (hasMore=false).
 */
export async function loadMarketplacePage(offset: number, limit: number): Promise<{ listings: Listing[]; users: User[] } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("listing_public_cards")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return null;

  const listings = ((data ?? []) as PublicListingCardRow[]).map(mapListing);
  if (listings.length === 0) return { listings: [], users: [] };

  const ownerIds = Array.from(new Set(listings.map((l) => l.ownerId)));
  const { data: profileData } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", ownerIds);
  const users = ((profileData ?? []) as ProfileRow[]).map(mapProfile);
  return { listings, users };
}

/**
 * Sunucu-tarafli arama/filtre. Tum aktif katalogda calisir (yuklu 90 ile sinirli
 * degil). q basligi/aciklama/kategori/konumda arar; fiyat araligi, "aninda ortak"
 * ve siralama sunucuda uygulanir; sayfalama offset/limit ile.
 */
export async function searchListings(params: {
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  openOnly?: boolean;
  sort?: "new" | "priceAsc" | "priceDesc" | "recommended" | "commission";
  offset?: number;
  limit?: number;
}): Promise<{ listings: Listing[]; users: User[] } | null> {
  if (!supabase) return null;
  const q = params.q?.trim();
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 40;
  // Sorguyu temizle (RPC/PostgREST için güvenli).
  const safe = (q ?? "").replace(/[,*%()]/g, " ").replace(/\s+/g, " ").trim();

  // Sunucu-tarafı Türkçe-DUYARSIZ + trigram-sıralı arama RPC'si: lower(unaccent(...)) ile
  // "sarj"→"şarj", "guclu"→"güçlü" eşleşir; ilgi (similarity) sırasına dizilir. Fiyat/açık/
  // sıralama/konum gibi diğer filtreleri istemci (activeListings) serverResults üzerinde
  // zaten yeniden uygular; bu yüzden RPC sade tutulur.
  if (safe) {
    const { data, error } = await supabase.rpc("search_listings", { q: safe, lim: limit, off: offset });
    if (error) return null;
    const listings = ((data ?? []) as PublicListingCardRow[]).map(mapListing);
    if (listings.length === 0) return { listings: [], users: [] };
    const ownerIds = Array.from(new Set(listings.map((l) => l.ownerId)));
    const { data: profileData } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", ownerIds);
    const users = ((profileData ?? []) as ProfileRow[]).map(mapProfile);
    return { listings, users };
  }

  // q yoksa (nadiren çağrılır): en yeni aktif ilanlar.
  const { data, error } = await supabase.from("listing_public_cards").select("*").eq("status", "active").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) return null;
  const listings = ((data ?? []) as PublicListingCardRow[]).map(mapListing);
  if (listings.length === 0) return { listings: [], users: [] };
  const ownerIds = Array.from(new Set(listings.map((l) => l.ownerId)));
  const { data: profileData } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", ownerIds);
  const users = ((profileData ?? []) as ProfileRow[]).map(mapProfile);
  return { listings, users };
}

// Belirli ID'lerdeki herkese-açık ilan kartlarını sunucudan getirir (favoriler gibi
// bellek-penceresi [MP_MAX] dışında kalabilecek ilanlar için). listing_public_cards
// yalnız AKTİF ilanları içerir (feed ile parite; satılan/duraklatılan favori görünmez).
export async function fetchListingsByIds(ids: string[]): Promise<{ listings: Listing[]; users: User[] } | null> {
  if (!supabase) return null;
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (uniq.length === 0) return { listings: [], users: [] };
  // .in() sorgu-string'i şişmesin: en fazla 300 id (favori penceresi için fazlasıyla yeterli).
  const capped = uniq.slice(0, 300);
  const { data, error } = await supabase.from("listing_public_cards").select("*").in("id", capped);
  if (error) return null;
  const listings = ((data ?? []) as PublicListingCardRow[]).map(mapListing);
  if (listings.length === 0) return { listings: [], users: [] };
  const ownerIds = Array.from(new Set(listings.map((l) => l.ownerId)));
  const { data: profileData } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", ownerIds);
  const users = ((profileData ?? []) as ProfileRow[]).map(mapProfile);
  return { listings, users };
}

// Takip edilen satıcıların aktif ilanları — takip beslemesi (feed) için.
export async function fetchListingsBySellers(sellerIds: string[]): Promise<{ listings: Listing[]; users: User[] } | null> {
  if (!supabase) return null;
  const uniq = Array.from(new Set(sellerIds.filter(Boolean))).slice(0, 100);
  if (uniq.length === 0) return { listings: [], users: [] };
  const { data, error } = await supabase
    .from("listing_public_cards").select("*").in("owner_id", uniq).order("created_at", { ascending: false }).limit(120);
  if (error) return null;
  const feedListings = ((data ?? []) as PublicListingCardRow[]).map(mapListing).filter((l) => l.status === "active");
  const feedOwnerIds = Array.from(new Set(feedListings.map((l) => l.ownerId)));
  if (feedOwnerIds.length === 0) return { listings: [], users: [] };
  const { data: feedProfiles } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", feedOwnerIds);
  const feedUsers = ((feedProfiles ?? []) as ProfileRow[]).map(mapProfile);
  return { listings: feedListings, users: feedUsers };
}

export async function loadAccountSnapshot(userId: string): Promise<AccountSnapshot | null> {
  if (!supabase) return null;

  // LİMİT ŞART: aksi halde 100k ilanlı satıcı 100k id'yi `.in(...)` sorgu-string'ine gömer →
  // URL/statement sınırı aşılır, giriş takılır. Hesap-özeti join'leri için en yeni 1000 yeterli.
  const { data: ownedListings } = await supabase.from("listings").select("id").eq("owner_id", userId).order("created_at", { ascending: false }).limit(1000);
  const ownedListingIds = (ownedListings ?? []).map((item) => item.id as string);

  const [
    partnershipsResult,
    leadsResult,
    commissionsResult,
    ordersResult,
    reviewsResult,
    favoritesResult,
    conversationsResult,
    messagesResult,
    notificationsResult,
    reportsResult
  ] = await Promise.all([
    supabase
      .from("partnerships")
      .select("*")
      .or(`partner_id.eq.${userId}${ownedListingIds.length ? `,listing_id.in.(${ownedListingIds.join(",")})` : ""}`)
      .limit(500),
    // Lead'ler RLS ile scope'lanır ("lead owners and partners read leads"): satıcı
    // kendi ilanlarının, ortak ise getirdiği (partnership_id) lead'lerini görür.
    // Filtresiz select union'ı döndürür — saf ortak da huni/talep geçmişini görür.
    supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("commissions").select("*").order("created_at", { ascending: false }).limit(500),
    ownedListingIds.length
      ? supabase.from("orders").select("*").in("listing_id", ownedListingIds).order("created_at", { ascending: false }).limit(500)
      : supabase.from("orders").select("*").eq("seller_id", userId).order("created_at", { ascending: false }).limit(500),
    supabase.from("reviews").select("*").eq("reviewer_id", userId).order("created_at", { ascending: false }).limit(300),
    supabase.from("favorites").select("*").eq("user_id", userId).limit(500),
    supabase.from("conversations").select("*").contains("participant_ids", [userId]).order("last_message_at", { ascending: false }).limit(200),
    supabase.from("messages").select("*").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order("created_at", { ascending: false }).limit(1000),
    supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(300)
  ]);

  const firstError =
    partnershipsResult.error ??
    leadsResult.error ??
    commissionsResult.error ??
    ordersResult.error ??
    reviewsResult.error ??
    favoritesResult.error ??
    conversationsResult.error ??
    messagesResult.error ??
    notificationsResult.error ??
    reportsResult.error;

  // DİRENÇLİ: tek bir tablo (ör. reports RLS, migration sonrası eksik kolon) hata verse bile
  // DİĞER hesap verisi (mesaj/favori/satış…) yüklensin. Eskiden ilk hata her şeyi null'lıyordu
  // → kullanıcı "her şey boş" görüyordu. Artık her sonuç kendi `.data ?? []` ile map'lenir.
  if (firstError) console.warn("Supabase account load partial failure", firstError);

  return {
    partnerships: (partnershipsResult.data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      partnerId: row.partner_id,
      refCode: row.ref_code,
      status: row.status,
      note: row.note,
      shareChannel: row.share_channel ?? undefined,
      audience: row.audience ?? undefined,
      platformHandle: row.platform_handle ?? undefined,
      reachEstimate: toNumber(row.reach_estimate),
      rejectionReason: row.rejection_reason ?? undefined,
      approvedAt: row.approved_at?.slice(0, 10),
      createdAt: row.created_at.slice(0, 10),
      commissionOverrideType: row.commission_override_type ?? undefined,
      commissionOverrideValue: row.commission_override_value != null ? toNumber(row.commission_override_value) : undefined,
      agreedCommissionType: row.agreed_commission_type ?? undefined,
      agreedCommissionValue: row.agreed_commission_value != null ? toNumber(row.agreed_commission_value) : undefined,
      agreedCommissionTiers: row.agreed_commission_tiers ?? undefined,
      agreedAttributionWindowDays: row.agreed_attribution_window_days ?? undefined,
      agreedReturnWindowDays: row.agreed_return_window_days ?? undefined,
      agreedCommissionDueDays: row.agreed_commission_due_days ?? undefined,
      agreedAt: row.agreed_at?.slice(0, 10)
    })),
    leads: (leadsResult.data ?? []).map((row) => ({
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
    })),
    sales: (commissionsResult.data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      partnershipId: row.partnership_id,
      leadId: row.lead_id ?? "",
      amount: toNumber(row.sale_amount, toNumber(row.amount)),
      quantity: toNumber(row.quantity, 1),
      commissionAmount: toNumber(row.amount),
      status: row.status,
      buyerName: row.buyer_name ?? undefined,
      deliveryStatus: row.delivery_status ?? undefined,
      returnUntil: row.return_until?.slice(0, 10),
      approvedAt: row.approved_at?.slice(0, 10),
      paidAt: row.paid_at?.slice(0, 10),
      sellerMarkedPaidAt: row.seller_marked_paid_at?.slice(0, 10),
      partnerConfirmedPaidAt: row.partner_confirmed_paid_at?.slice(0, 10),
      payoutNote: row.payout_note ?? undefined,
      buyerConfirmToken: row.buyer_confirm_token ?? undefined,
      buyerConfirmedAt: row.buyer_confirmed_at?.slice(0, 10),
      buyerConfirmStatus: row.buyer_confirm_status ?? undefined,
      buyerId: row.buyer_id ?? undefined
    })),
    orders: (ordersResult.data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      buyerId: row.buyer_id ?? "",
      sellerId: row.seller_id,
      partnershipId: row.partnership_id ?? undefined,
      amount: toNumber(row.amount),
      status: row.status,
      createdAt: row.created_at.slice(0, 10)
    })),
    reviews: (reviewsResult.data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      saleId: row.sale_id ?? undefined,
      reviewerId: row.reviewer_id,
      reviewedUserId: row.reviewed_user_id ?? undefined,
      rating: row.rating,
      comment: row.comment,
      type: row.type ?? "product",
      createdAt: row.created_at.slice(0, 10),
      sellerReply: row.seller_reply ?? undefined,
      sellerReplyAt: row.seller_reply_at ?? undefined,
      helpfulCount: Number(row.helpful_count ?? 0)
    })),
    favorites: (favoritesResult.data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      userId: row.user_id,
      savedPrice: row.saved_price != null ? toNumber(row.saved_price) : undefined
    })),
    conversations: (conversationsResult.data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      sellerId: row.seller_id,
      buyerId: row.buyer_id ?? undefined,
      partnerId: row.partner_id ?? undefined,
      participantIds: row.participant_ids ?? [],
      status: row.status,
      lastMessageAt: row.last_message_at ? msgStamp(row.last_message_at) : msgStamp(row.created_at),
      createdAt: msgStamp(row.created_at)
    })),
    messages: (messagesResult.data ?? []).map((row) => ({
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
    })),
    notifications: (notificationsResult.data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body,
      read: row.read,
      createdAt: row.created_at.slice(0, 10),
      metadata: parseNotifMeta(row.metadata)
    })),
    reports: (reportsResult.data ?? []).map((row) => ({
      id: row.id,
      reporterId: row.reporter_id,
      listingId: row.listing_id ?? undefined,
      reportedUserId: row.reported_user_id ?? undefined,
      reason: row.reason,
      details: row.details,
      status: row.status,
      resolvedBy: row.resolved_by ?? undefined,
      resolvedAt: row.resolved_at?.slice(0, 10),
      createdAt: row.created_at.slice(0, 10)
    }))
  };
}

// Herkese açık ortak vitrini: bir ortağın aktif promosyon ilanları + her biri için ref_code.
// partner_public_shop/profile SECURITY DEFINER fonksiyonları RLS'i güvenle aşar (yalnız public alan).
export type PartnerShopProfile = { partnerId: string; fullName: string; verifiedIdentity: boolean; verifiedPhone: boolean; confirmedSales: number; activePartnerships: number };
export type PartnerShopItem = { listing: Listing; refCode: string; partnershipId: string; attributionWindowDays?: number };
export async function loadPartnerShopLive(partnerId: string): Promise<{ profile: PartnerShopProfile | null; items: PartnerShopItem[] }> {
  if (!supabase || !partnerId) return { profile: null, items: [] };
  const [shopRes, profRes] = await Promise.all([
    supabase.rpc("partner_public_shop", { p_id: partnerId }),
    supabase.rpc("partner_public_profile", { p_id: partnerId })
  ]);
  const rows = (shopRes.data ?? []) as Array<{ listing_id: string; ref_code: string; partnership_id: string; agreed_attribution_window_days?: number }>;
  const ids = rows.map((r) => r.listing_id);
  let cards: Listing[] = [];
  if (ids.length) {
    const { data } = await supabase.from("listing_public_cards").select("*").in("id", ids);
    cards = ((data ?? []) as PublicListingCardRow[]).map(mapListing);
  }
  const byId = new Map(cards.map((c) => [c.id, c]));
  const items: PartnerShopItem[] = rows
    .map((r): PartnerShopItem | null => {
      const listing = byId.get(r.listing_id);
      if (!listing) return null;
      return { listing, refCode: String(r.ref_code ?? ""), partnershipId: String(r.partnership_id ?? ""), attributionWindowDays: r.agreed_attribution_window_days ?? undefined };
    })
    .filter((x): x is PartnerShopItem => x !== null);
  const p = (profRes.data ?? [])[0] as Record<string, unknown> | undefined;
  const profile: PartnerShopProfile | null = p
    ? {
        partnerId: String(p.partner_id),
        fullName: String(p.full_name ?? ""),
        verifiedIdentity: Boolean(p.verified_identity),
        verifiedPhone: Boolean(p.verified_phone),
        confirmedSales: Number(p.confirmed_sales ?? 0),
        activePartnerships: Number(p.active_partnerships ?? 0)
      }
    : null;
  return { profile, items };
}

