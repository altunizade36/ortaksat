import { MaterialCommunityIcons } from "@/components/icons";
import { Link, useRouter } from "expo-router";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";

import { Alert } from "@/lib/alert";

import { AdminActivity, RootCategoryCard, ServerTrendCard, TopSellersCard, useAdminTimeseries, type AdminAnalytics, type AdminMsgStats, type AdminTsState } from "@/components/admin-activity";
import { ADMIN_CARD, ADMIN_INPUT, ActionButton, AdminWideCtx, NoData, Pager, usePager } from "@/components/admin-kit";
import { AuthRequired } from "@/components/auth-gate";
import { DonutChart, HBarChart, ResponsiveLineArea, money as fmtMoney } from "@/components/charts";
import { colors } from "@/components/colors";
import { EmptyState, PressLink } from "@/components/ui";
import { money } from "@/lib/format";
import { useIsWideWeb, useMounted } from "@/lib/layout";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { downloadCsv } from "@/lib/csv-export";
import { getDistrict, getProvince } from "@/lib/locations";
import { computeListingRisk } from "@/lib/risk";
import { fetchAdminAudit, type AuditEntry, type DbBlogPost, type DbContentPage, type DbSeoSetting, type ExtraCategory } from "@/lib/supabase-data";
import { purgeDeletedAccountFiles } from "@/lib/account-purge";
import { adminBroadcastLive, adminResolveAccountDeletionLive, fetchAdminAccountDeletionsLive, type AdminAccountDeletion, adminClosePartnerRequest, adminDeleteQuestion, adminModerateReview, adminSetPartnershipStatus, fetchAdminMessageStats, fetchAdminMessages, fetchAdminOverview, fetchAdminPartnerships, fetchAdminSiteRecords, type AdminMessageRow, type AdminOverview, type AdminPartnershipRow, type AdminSiteRecords } from "@/lib/live-service";
import { showToast } from "@/lib/toast";
import type { SaleStatus, SuggestionStatus, UserRole } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type Section =
  | "dashboard" | "users" | "listings" | "partnerships" | "complaints" | "categories" | "locations"
  | "messages" | "commissions" | "records" | "stats" | "notifications" | "content" | "blog" | "seo" | "settings" | "reports";

type NavItem = { key: Section; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string };
const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  { title: "Genel", items: [
    { key: "dashboard", icon: "view-dashboard-outline", label: "Dashboard" },
    { key: "stats", icon: "chart-line", label: "İstatistikler" },
    { key: "reports", icon: "chart-box-outline", label: "Raporlar" }
  ] },
  { title: "Yönetim", items: [
    { key: "users", icon: "account-group-outline", label: "Kullanıcılar" },
    { key: "listings", icon: "file-document-outline", label: "İlanlar" },
    { key: "partnerships", icon: "handshake-outline", label: "Ortak Satış Talepleri" },
    { key: "commissions", icon: "cash-multiple", label: "Komisyon Kayıtları" },
    { key: "records", icon: "database-outline", label: "Site Kayıtları" }
  ] },
  { title: "Güven & İletişim", items: [
    { key: "complaints", icon: "flag-outline", label: "Şikayetler" },
    { key: "messages", icon: "message-text-outline", label: "Mesajlar" },
    { key: "notifications", icon: "bell-outline", label: "Bildirimler" }
  ] },
  { title: "İçerik & Site", items: [
    { key: "categories", icon: "shape-outline", label: "Kategoriler" },
    { key: "locations", icon: "map-marker-outline", label: "Konum Önerileri" },
    { key: "content", icon: "file-edit-outline", label: "Site İçerikleri" },
    { key: "blog", icon: "post-outline", label: "Blog Yönetimi" },
    { key: "seo", icon: "magnify-scan", label: "SEO Yönetimi" }
  ] },
  { title: "Sistem", items: [
    { key: "settings", icon: "cog-outline", label: "Ayarlar" }
  ] }
];
const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
const SECTION_META: Record<Section, { title: string; description: string }> = {
  dashboard: { title: "Yönetim Merkezi", description: "Platform sağlığı, bekleyen işler ve son hareketler" },
  users: { title: "Kullanıcı Yönetimi", description: "Hesap, rol, doğrulama ve erişim durumları" },
  listings: { title: "İlan Moderasyonu", description: "Yayın, inceleme, risk ve öne çıkarma işlemleri" },
  partnerships: { title: "Ortaklık Talepleri", description: "Başvuru ve ortaklık durumlarının platform görünümü" },
  complaints: { title: "Şikayet Merkezi", description: "Açık kayıtlar, inceleme süreci ve karar geçmişi" },
  categories: { title: "Kategori Yönetimi", description: "Kategori ağacı ve kullanıcı önerileri" },
  locations: { title: "Konum Önerileri", description: "İl, ilçe ve mahalle önerilerinin kontrolü" },
  messages: { title: "Mesaj Güvenliği", description: "Platform mesaj hacmi ve riskli konuşma sinyalleri" },
  commissions: { title: "Komisyon Kayıtları", description: "Hak ediş, ödeme beyanı ve anlaşmazlık durumları" },
  records: { title: "Site Kayıtları", description: "Teklif, yorum, soru, talep ve ortak arama kayıtları" },
  stats: { title: "İstatistikler", description: "Kategori, şehir, kullanıcı ve gelir dağılımları" },
  notifications: { title: "Bildirim Merkezi", description: "Kullanıcı bildirimleri ve toplu duyurular" },
  content: { title: "Site İçerikleri", description: "Kurumsal ve yardım sayfalarının yönetimi" },
  blog: { title: "Blog Yönetimi", description: "Yayın, taslak ve içerik düzenleme işlemleri" },
  seo: { title: "SEO Yönetimi", description: "Sayfa başlığı, açıklama ve indeksleme ayarları" },
  settings: { title: "Platform Ayarları", description: "Yayın kuralları, duyuru ve yönetici ayarları" },
  reports: { title: "Raporlar ve Denetim", description: "Operasyon özeti, aktivite ve denetim kayıtları" }
};

// Güvenlik: mesajlarda geçince "riskli konuşma" işaretlenecek kelimeler.
const RISK_WORDS = ["iban", "havale", "eft", "kapora", "kaparo", "site dışı", "whatsapp", "telegram", "dolandırıcı", "dolandiri", "sahte", "acil gönder", "papara", "western union", "hesap numaras", "kart numaras", "kripto", "bitcoin"];
function conversationRisk(bodies: string[]): string | null {
  const hay = bodies.join(" ").toLocaleLowerCase("tr-TR");
  for (const w of RISK_WORDS) if (hay.includes(w)) return w;
  return null;
}

// Açık yeşil zemin üstünde okunur koyu yeşil (colors.success #22C55E metin olarak AA'yı geçmez).
const SUCCESS_INK = "#15803D";
const PAGE_SIZE = 20;

const PARTNERSHIP_TONE: Record<string, { tint: string; color: string; label: string }> = {
  pending: { tint: colors.goldSoft, color: colors.goldInk, label: "Bekliyor" },
  active: { tint: colors.successSoft, color: SUCCESS_INK, label: "Kabul edildi" },
  approved: { tint: colors.successSoft, color: SUCCESS_INK, label: "Kabul edildi" },
  rejected: { tint: colors.accentSoft, color: colors.accent, label: "Reddedildi" },
  cancelled: { tint: colors.surfaceAlt, color: colors.muted, label: "İptal" },
  blocked: { tint: colors.accentSoft, color: colors.accent, label: "Engellendi" },
  completed: { tint: colors.primarySoft, color: colors.primaryDark, label: "Tamamlandı" }
};

const STATUS_TONE: Record<SuggestionStatus, { tint: string; color: string; label: string }> = {
  pending: { tint: colors.goldSoft, color: colors.goldInk, label: "İncelemede" },
  approved: { tint: colors.successSoft, color: SUCCESS_INK, label: "Onaylandı" },
  rejected: { tint: colors.accentSoft, color: colors.accent, label: "Reddedildi" }
};

// Raporlar — denetim aksiyonlarının okunur Türkçe etiketleri + özet bar renkleri (dataviz-safe).
const ACTION_LABEL: Record<string, string> = {
  sign_in: "Giriş", sign_up: "Kayıt",
  listing_create: "İlan oluşturuldu", listing_created: "İlan oluşturuldu",
  listing_update: "İlan güncellendi", listing_updated: "İlan güncellendi",
  listing_remove: "İlan kaldırıldı", offer_answered: "Teklif yanıtlandı",
  partnership_pending: "Ortaklık başvurusu", partnership_active: "Ortaklık onaylandı",
  partnership_rejected: "Ortaklık reddedildi", partnership_cancelled: "Ortaklık sonlandırıldı",
  sale_recorded: "Satış kaydı", sale_confirmed: "Satış onaylandı",
  offer_created: "Teklif verildi", review_created: "Yorum yazıldı", lead_created: "Talep oluştu"
};
const SALE_TONE: Record<SaleStatus, { tint: string; color: string; label: string }> = {
  pending: { tint: colors.goldSoft, color: colors.goldInk, label: "Bekliyor" },
  return_pending: { tint: colors.goldSoft, color: colors.goldInk, label: "İade süresi" },
  approved: { tint: colors.primarySoft, color: colors.primary, label: "Onaylandı" },
  seller_paid: { tint: colors.goldSoft, color: colors.goldInk, label: "Onay bekliyor" },
  paid: { tint: colors.successSoft, color: SUCCESS_INK, label: "Tamamlandı" },
  cancelled: { tint: colors.surfaceAlt, color: colors.muted, label: "İptal" },
  disputed: { tint: colors.accentSoft, color: colors.accent, label: "İtiraz" }
};

// Büyük sayıları binlik ayraçla biçimle (tabular hizalama için).
function fmtN(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(Number.isFinite(n) ? n : 0));
}

// Son 12 ay — gerçek veri: yayınlanan ilanların aya göre dağılımı.
function monthlyListingChart(listings: Array<{ createdAt: string }>): { data: number[]; labels: string[] } {
  const MON = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const now = new Date();
  const data = new Array(12).fill(0) as number[];
  const labels = new Array(12).fill("") as string[];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    labels[i] = MON[d.getMonth()];
  }
  for (const l of listings) {
    const d = new Date(l.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsAgo >= 0 && monthsAgo < 12) data[11 - monthsAgo] += 1;
  }
  return { data, labels };
}

function AdminScreenInner() {
  const isWideWeb = useIsWideWeb();
  const { height: viewportHeight } = useWindowDimensions();
  const router = useRouter();
  const {
    listings, users, sales, partnerships, messages, notifications,
    categorySuggestions, locationSuggestions, setCategorySuggestionStatus, setLocationSuggestionStatus,
    updateListingStatus, setListingFeatured, deleteListing, findUser, signOut, currentUser, reports, updateReportStatus,
    updateSaleStatus,
    platformSettings, updatePlatformSetting, setAnnouncement, setUserRole, setUserStatus,
    setUserVerification, adminNotifyUser,
    blogPosts, contentPages, seoSettings, saveBlogPost, deleteBlogPost, saveContentPage, saveSeoSetting,
    categoryTree, extraCategories, saveCategory, deleteCategory, importCategories,
    hiddenCategories, toggleHiddenCategory, refreshMarketplace, refreshUserData
  } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [annText, setAnnText] = useState(platformSettings.announcement);
  const canManageUsers = currentUser.role === "admin" || currentUser.role === "super_admin";
  const [userQuery, setUserQuery] = useState("");
  const [listingQuery, setListingQuery] = useState("");
  const [bcTitle, setBcTitle] = useState("");
  const [bcBody, setBcBody] = useState("");
  const [bcSending, setBcSending] = useState(false);
  const [bcResult, setBcResult] = useState<string | null>(null);
  // Kullanıcıya bildirim modalı (window.prompt yerine — native'de prompt yok).
  const [notifyTarget, setNotifyTarget] = useState<{ id: string; name: string } | null>(null);
  const [notifyText, setNotifyText] = useState("");
  const [listingFilter, setListingFilter] = useState<"all" | "pending" | "active" | "rejected" | "paused" | "featured" | "risky">("all");
  const [userFilter, setUserFilter] = useState<"all" | "active" | "suspended" | "seller" | "staff">("all");
  const [msgFilter, setMsgFilter] = useState<"all" | "risky">("all");
  const [commFilter, setCommFilter] = useState<"all" | "pending" | "approved" | "seller_paid" | "paid" | "cancelled" | "disputed">("all");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<"open" | "all" | "resolved" | "rejected">("open");
  const [reportQuery, setReportQuery] = useState("");
  const [partFilter, setPartFilter] = useState<"all" | "pending" | "active" | "rejected" | "cancelled">("all");
  const [partQuery, setPartQuery] = useState("");
  const [msgQuery, setMsgQuery] = useState("");
  // Uçuştaki aksiyonlar (anahtar → meşgul). Aynı aksiyon bitmeden tekrar tetiklenemez.
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const busyRef = useRef<Record<string, boolean>>({});
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);
  /**
   * Tek aksiyon koşucusu: çift gönderimi engeller, sonucu DÜRÜSTÇE gösterir.
   *   true      → başarı toast'ı (ok metin ya da sonuca göre metin üreten fonksiyon)
   *   false / hata → başarısızlık uyarısı
   *   undefined → HİÇBİR ŞEY (sonucu bilinmeyen, iyimser store aksiyonu: başarı iddia edilmez;
   *               yazım hatasını store kendi hata bildirimiyle gösterir)
   */
  const run = async (key: string, fn: () => boolean | undefined | void | Promise<boolean | undefined | void>, ok: string | (() => string), fail = "İşlem tamamlanamadı. Lütfen tekrar dene.") => {
    if (busyRef.current[key]) return;
    busyRef.current[key] = true;
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const res = await fn();
      if (res === true) showToast(typeof ok === "function" ? ok() : ok);
      else if (res === false) Alert.alert("İşlem başarısız", fail);
    } catch {
      Alert.alert("İşlem başarısız", fail);
    } finally {
      delete busyRef.current[key];
      if (aliveRef.current) setBusy((b) => { const n = { ...b }; delete n[key]; return n; });
    }
  };
  // Doğrulama talebi: ÖNCE rozet yazılır; yazılamadıysa talep KAPATILMAZ (eskiden rozet sonucu
  // beklenmeden talep kapanıyordu → rozet yazılamasa da "doğrulandı" deniyordu).
  const verifyAndResolve = async (userId: string, field: "verifiedPhone" | "verifiedIdentity", reportId: string) => {
    if (!(await setUserVerification(userId, field, true))) return false;
    return updateReportStatus(reportId, "resolved");
  };
  const uq = userQuery.trim().toLocaleLowerCase("tr-TR");
  const lq = listingQuery.trim().toLocaleLowerCase("tr-TR");

  const liveUsers = users.filter((u) => u.status !== "deleted");
  const deletedUserCount = users.length - liveUsers.length;
  const userFiltered = liveUsers.filter((u) => {
    if (userFilter === "active") return u.status !== "suspended";
    if (userFilter === "suspended") return u.status === "suspended";
    if (userFilter === "seller") return (u.listingCount ?? 0) > 0;
    if (userFilter === "staff") return u.role === "admin" || u.role === "moderator" || u.role === "super_admin";
    return true;
  });
  const shownUsers = uq ? userFiltered.filter((u) => u.name.toLocaleLowerCase("tr-TR").includes(uq) || (u.role ?? "").includes(uq) || (u.status ?? "").includes(uq)) : userFiltered;

  const riskyListings = useMemo(() => listings.filter((l) => computeListingRisk(l, listings, findUser(l.ownerId)).level === "high"), [listings, findUser]);
  const listingFiltered = listingFilter === "all" ? listings : listingFilter === "risky" ? riskyListings : listingFilter === "featured" ? listings.filter((l) => l.featured) : listingFilter === "pending" ? listings.filter((l) => l.status === "pending_review") : listings.filter((l) => l.status === listingFilter);
  const shownListings = lq ? listingFiltered.filter((l) => l.title.toLocaleLowerCase("tr-TR").includes(lq) || l.category.toLocaleLowerCase("tr-TR").includes(lq) || (findUser(l.ownerId)?.name ?? "").toLocaleLowerCase("tr-TR").includes(lq) || l.status.includes(lq)) : listingFiltered;

  // DÜZELTİLDİ (hata): native dalda hiç GİRDİ ALINMADAN sabit "Yönetimden bilgilendirme."
  // gönderiliyordu — admin kendi yazdığını sanıyor, kullanıcıya genel metin gidiyordu.
  // Artık her iki platformda da gerçek bir metin kutusu (modal) açılır.
  function promptNotify(userId: string, name: string) {
    setNotifyTarget({ id: userId, name });
    setNotifyText("");
  }

  /**
   * DÜZELTİLDİ (P0): "Onayla" eskiden yalnızca öneri satırının DURUMUNU değiştiriyordu —
   * kategori ağaca EKLENMİYORDU. Yani kullanıcı "Diğer"e yazıp öneriyor, admin onaylıyor,
   * ama kategori hiçbir yerde oluşmuyordu (admin elle "Ekstra Kategoriler"e yeniden
   * yazmak zorundaydı). Artık onaylamak öneriyi GERÇEKTEN ağaca ekler:
   * yol "Kök → … → Yaprak" ise yaprak, kök kategorinin alt kategorisi olarak eklenir.
   */
  function adoptCategorySuggestion(id: string, suggestedPath: string): Promise<boolean> | undefined {
    const parts = suggestedPath.split(/[→>]/).map((p) => p.trim()).filter(Boolean);
    const leaf = parts[parts.length - 1];
    const root = parts[0] ?? leaf;
    if (!leaf) return;
    const norm = (s: string) => s.toLocaleLowerCase("tr-TR").trim();
    const existing = extraCategories.find((c) => norm(c.label) === norm(root));
    if (existing) {
      if (!existing.subcategories.some((sc) => norm(sc.label) === norm(leaf))) {
        saveCategory({ ...existing, subcategories: [...existing.subcategories, { label: leaf, slug: slugifyTr(leaf) }] });
      }
    } else {
      saveCategory({
        id: uuid(),
        key: `x-${slugifyTr(root)}`,
        label: root,
        slug: slugifyTr(root),
        image: "",
        subcategories: root === leaf ? [] : [{ label: leaf, slug: slugifyTr(leaf) }],
        sortOrder: 999,
        isActive: true
      });
    }
    return setCategorySuggestionStatus(id, "approved");
  }
  const [section, setSection] = useState<Section>("dashboard");
  // Sunucu zaman serisi (admin_timeseries): yalnız yetkili oturumda ve seriyi gösteren bölümlerde yoklanır.
  const ts = useAdminTimeseries(
    (currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin") && (section === "dashboard" || section === "stats")
  );
  const [adminNavOpen, setAdminNavOpen] = useState(false);
  // Mobil bölüm sekmeleri: aktif sekme yatay şeritte görünür alana kaydırılır.
  const tabsRef = useRef<ScrollView>(null);
  const tabX = useRef<Record<string, number>>({});
  useEffect(() => {
    tabsRef.current?.scrollTo({ x: Math.max(0, (tabX.current[section] ?? 0) - 48), animated: true });
  }, [section]);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [audit, setAudit] = useState<{ logs: AuditEntry[]; rateHits: number } | null>(null);
  // Sunucu-gerçek analitik (AdminActivity 15sn'de bir çeker + onData ile buraya verir) → Dashboard/stats
  // KPI'ları istemci-cap'li dizilerden DEĞİL bu tek kaynaktan besler (çelişen toplamlar giderilir).
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  // SUNUCU GERÇEĞİ: operasyonel sayılar (ilan/kullanıcı/ortaklık/komisyon/şikayet) artık
  // istemci bellek penceresinden (≤1000/≤500 — ölçekte YANLIŞ) değil, gerçek tablolardan.
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [siteRecords, setSiteRecords] = useState<AdminSiteRecords | null>(null);
  // Platform geneli ortaklıklar (admin-gated RPC) — bölüm eskiden admin'in KENDİ (client,
  // RLS-scoped) ortaklıklarını gösteriyordu → "N toplam" derken liste boştu. null=yükleniyor.
  const [adminPartnerships, setAdminPartnerships] = useState<AdminPartnershipRow[] | null>(null);
  // Platform geneli mesaj moderasyonu (eski bölüm ADMİNİN KENDİ kutusunu gösteriyordu).
  const [modMessages, setModMessages] = useState<AdminMessageRow[]>([]);
  const [msgStats, setMsgStats] = useState<AdminMsgStats | null>(null);

  useEffect(() => {
    fetchAdminAudit().then(setAudit).catch(() => setAudit(null));
    void fetchAdminOverview().then(setOverview).catch(() => setOverview(null));
  }, []);

  // Mesaj moderasyonu bölümü açılınca platform genelinden çek.
  useEffect(() => {
    if (section !== "messages") return;
    void fetchAdminMessages({ limit: 100 }).then(setModMessages).catch(() => setModMessages([]));
    void fetchAdminMessageStats().then(setMsgStats).catch(() => setMsgStats(null));
  }, [section]);

  // "Site Kayıtları" bölümü açılınca teklif/yorum/soru-cevap/talep/ortak-talep çek (admin-gated RPC).
  useEffect(() => {
    if (section !== "records") return;
    void fetchAdminSiteRecords().then(setSiteRecords).catch(() => setSiteRecords(null));
  }, [section]);
  // "Ortak Satış Talepleri" bölümü açılınca platform geneli ortaklıkları çek (admin-gated RPC).
  useEffect(() => {
    if (section !== "partnerships") return;
    void fetchAdminPartnerships().then(setAdminPartnerships).catch(() => setAdminPartnerships([]));
  }, [section]);
  const reloadAdminPartnerships = () => { void fetchAdminPartnerships().then(setAdminPartnerships).catch(() => {}); };
  // "Hesap silme talepleri" kuyruğu (staff RPC) — Kullanıcılar bölümü açılınca çekilir. null = yükleniyor.
  // 30 günü dolan talepleri gece işi (cron: process-account-deletions) işler; "Şimdi sil" erken silme içindir (yalnız admin/super_admin).
  const [accountDeletions, setAccountDeletions] = useState<AdminAccountDeletion[] | null>(null);
  const [accountDeletionsFailed, setAccountDeletionsFailed] = useState(false);
  const [deleteNowTarget, setDeleteNowTarget] = useState<AdminAccountDeletion | null>(null);
  const [deleteNowText, setDeleteNowText] = useState("");
  const reloadAccountDeletions = () => {
    void fetchAdminAccountDeletionsLive()
      .then((rows) => {
        setAccountDeletionsFailed(rows === null);
        setAccountDeletions(rows ?? []);
        // Kalıcı silinen (panelden ya da gece işiyle) hesapların depodaki dosyalarını arka planda temizle.
        // Sunucu fonksiyonu yetkiyi ve hesabın gerçekten silinmiş olduğunu kendisi doğrular; yinelemesi zararsız.
        for (const row of (rows ?? []).filter((r) => r.status === "completed").slice(0, 10)) void purgeDeletedAccountFiles(row.userId);
      })
      .catch(() => { setAccountDeletionsFailed(true); setAccountDeletions([]); });
  };
  useEffect(() => {
    if (section !== "users") return;
    reloadAccountDeletions();
  }, [section]);
  const resolveAccountDeletion = (row: AdminAccountDeletion, action: "reject" | "delete_now") => run(
    `adel:${row.id}`,
    async () => { const ok = await adminResolveAccountDeletionLive(row.id, action); if (ok) reloadAccountDeletions(); return ok; },
    action === "reject" ? "Talep reddedildi; hesap yeniden aktif" : "Hesap kalıcı olarak silindi",
    action === "reject" ? "Talep reddedilemedi. Talebin durumunu yenileyip tekrar dene." : "Hesap silinemedi. Yetkini ve talebin durumunu kontrol edip tekrar dene."
  );
  // Moderasyon aksiyonları — izleme değil KONTROL: aksiyon sonrası kayıtları tazele.
  const reloadRecords = () => { void fetchAdminSiteRecords().then(setSiteRecords).catch(() => {}); };
  const modReview = (id: string, del: boolean) => confirmAction(del ? "Bu yorumu gizle (herkese kapat)?" : "Yorumu geri al (yayına aç)?", () => void run(`rev:${id}`, async () => { const ok = await adminModerateReview(id, del); if (ok) reloadRecords(); return ok; }, del ? "Yorum gizlendi" : "Yorum yayına alındı"), del ? "Gizle" : "Geri Al");
  const delQuestion = (id: string) => confirmAction("Bu soruyu KALICI sil? (spam/uygunsuz)", () => void run(`q:${id}`, async () => { const ok = await adminDeleteQuestion(id); if (ok) reloadRecords(); return ok; }, "Soru silindi"), "Sil");
  const closePR = (id: string) => confirmAction("Bu 'ortak aranıyor' talebini kapat?", () => void run(`pr:${id}`, async () => { const ok = await adminClosePartnerRequest(id); if (ok) reloadRecords(); return ok; }, "Talep kapatıldı"), "Kapat");
  const setPartnership = (id: string, status: "active" | "rejected" | "cancelled", question: string, yes: string, okMsg: string) =>
    confirmAction(question, () => void run(`ps:${id}`, async () => { const ok = await adminSetPartnershipStatus(id, status); if (ok) reloadAdminPartnerships(); return ok; }, okMsg), yes);

  // Manuel yenile: sunucu-gerçek admin verisi (overview/audit/mesaj) + market/hesap store'u tazelenir.
  // (Eskiden analytics yalnız dashboard'da 15sn yenilenir, overview/audit mount'ta bir kez çekilirdi → bayat.)
  const doRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    ts.reload();
    try {
      await Promise.all([
        fetchAdminOverview().then(setOverview).catch(() => {}),
        fetchAdminAudit().then(setAudit).catch(() => {}),
        fetchAdminMessages({ limit: 100 }).then(setModMessages).catch(() => {}),
        fetchAdminMessageStats().then(setMsgStats).catch(() => {}),
        Promise.resolve(refreshMarketplace?.()).catch(() => {}),
        Promise.resolve(refreshUserData?.()).catch(() => {})
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const isAdmin = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
  const activeListings = listings.filter((l) => l.status === "active");
  const pendingReview = listings.filter((l) => l.status === "pending_review");
  const disputedSalesN = sales.filter((s) => s.status === "disputed").length;
  const buyerConfirmedN = sales.filter((s) => s.buyerConfirmedAt || s.buyerConfirmStatus === "confirmed").length;
  const buyerAwaitingN = sales.filter((s) => s.buyerConfirmToken && !s.buyerConfirmedAt && s.buyerConfirmStatus !== "confirmed" && s.buyerConfirmStatus !== "disputed").length;
  const unpaidCommission = sales.filter((s) => s.status !== "paid" && s.status !== "cancelled").reduce((a, s) => a + s.commissionAmount, 0);
  const pendingCat = categorySuggestions.filter((s) => s.status === "pending").length;
  const pendingLoc = locationSuggestions.filter((s) => s.status === "pending").length;
  // Sunucu-gerçek toplamlar (overview; istemci ≤1000/≤500 cap'inden DEĞİL) — başlıklarda gösterilir.
  const ovPartnershipsTotal = overview?.partnerships ? Object.values(overview.partnerships).reduce((a, b) => a + b, 0) : null;
  const pendingReports = reports.filter((r) => r.status === "open" || r.status === "reviewing").length;
  const pendingPartnerships = partnerships.filter((p) => p.status === "pending").length;

  // Son 12 ay — gerçek veri: aya göre yayınlanan ilan sayısı (kayıtlı veriden).
  const { data: chartData, labels: chartLabels } = useMemo(() => monthlyListingChart(listings), [listings]);

  // Analitik dağılımlar (İstatistikler): en çok komisyon kazanan ortaklar ve şehir dağılımı yüklü
  // kayıtlardan; en çok ilanı olan satıcılar + kök kategori dağılımı SUNUCUDAN (ts).
  const topPartners = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sales) { const p = partnerships.find((pp) => pp.id === s.partnershipId); if (p) m.set(p.partnerId, (m.get(p.partnerId) ?? 0) + s.commissionAmount); }
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = arr[0]?.[1] ?? 1;
    return arr.map(([id, v]) => ({ label: findUser(id)?.name ?? "—", value: money(v), count: v, max }));
  }, [sales, partnerships, findUser]);
  const cityDist = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of listings) if (l.status === "active") { const c = l.location || "—"; m.set(c, (m.get(c) ?? 0) + 1); }
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = arr[0]?.[1] ?? 1;
    return arr.map(([c, n]) => ({ label: c, value: `${n}`, count: n, max }));
  }, [listings]);

  // ---- Kayıt listeleri: arama + filtre + sayfalama (hook'lar erken-return'den ÖNCE) ----
  const usersPg = usePager(shownUsers, PAGE_SIZE, `${userFilter}|${uq}`);
  const listingsPg = usePager(shownListings, PAGE_SIZE, `${listingFilter}|${lq}`);
  const rq = reportQuery.trim().toLocaleLowerCase("tr-TR");
  const shownReports = reports
    .filter((r) => (reportFilter === "all" ? true : reportFilter === "open" ? isOpenReport(r) : r.status === reportFilter))
    .filter((r) => {
      if (!rq) return true;
      const t = r.listingId ? listings.find((l) => l.id === r.listingId)?.title ?? "" : "";
      const u = r.reportedUserId ? findUser(r.reportedUserId)?.name ?? "" : "";
      return `${r.reason} ${r.details} ${t} ${u} ${findUser(r.reporterId)?.name ?? ""}`.toLocaleLowerCase("tr-TR").includes(rq);
    })
    .sort((a, b) => (isOpenReport(a) ? -1 : 1) - (isOpenReport(b) ? -1 : 1) || b.createdAt.localeCompare(a.createdAt));
  const reportsPg = usePager(shownReports, PAGE_SIZE, `${reportFilter}|${rq}`);
  const pq = partQuery.trim().toLocaleLowerCase("tr-TR");
  const shownPartnerships = (adminPartnerships ?? [])
    .filter((p) => (partFilter === "all" ? true : partFilter === "active" ? p.status === "active" || p.status === "approved" : p.status === partFilter))
    .filter((p) => !pq || `${p.listingTitle ?? ""} ${p.ownerName ?? ""} ${p.partnerName ?? ""}`.toLocaleLowerCase("tr-TR").includes(pq));
  const partsPg = usePager(shownPartnerships, PAGE_SIZE, `${partFilter}|${pq}`);
  const shownSales = (commFilter === "all" ? sales : sales.filter((s) => s.status === commFilter)).slice().sort((a, b) => (a.status === "disputed" ? -1 : 0) - (b.status === "disputed" ? -1 : 0));
  const salesPg = usePager(shownSales, PAGE_SIZE, commFilter);
  const mq = msgQuery.trim().toLocaleLowerCase("tr-TR");
  const msgRows = modMessages.map((m) => ({ m, risk: conversationRisk([m.body]) }));
  const riskyMsgCount = msgRows.filter((x) => x.risk).length;
  const shownMsgs = (msgFilter === "risky" ? msgRows.filter((x) => x.risk) : msgRows)
    .filter(({ m }) => !mq || `${m.body} ${m.sender_name ?? ""} ${m.receiver_name ?? ""} ${m.listing_title ?? ""}`.toLocaleLowerCase("tr-TR").includes(mq));
  const msgsPg = usePager(shownMsgs, PAGE_SIZE, `${msgFilter}|${mq}`);
  const auditPg = usePager(audit?.logs ?? [], 25, "audit");

  const navBadge = (k: Section) => (k === "categories" ? pendingCat : k === "locations" ? pendingLoc : k === "listings" ? (analytics?.listings_pending ?? pendingReview.length) : k === "complaints" ? (analytics?.open_reports ?? pendingReports) : k === "partnerships" ? (analytics?.partnerships_pending ?? pendingPartnerships) : 0);
  const activeNav = NAV.find((item) => item.key === section) ?? NAV[0];
  const activeMeta = SECTION_META[section];

  const selectSection = (next: Section) => {
    setSection(next);
    setAdminNavOpen(false);
  };

  // Derinlemesine savunma: bu bileşen yalnız AdminScreen'in rol kapısından sonra render edilir;
  // yine de rol düşerse (oturum değişimi) HİÇBİR yönetim verisi çizilmez. (Tüm hook'lar yukarıda.)
  if (!isAdmin) return null;

  return (
    <AdminWideCtx.Provider value={isWideWeb}>
    <View style={{ backgroundColor: colors.background, flex: 1, flexDirection: isWideWeb ? "row" : "column", minHeight: "100%" }}>
      {/* Sidebar */}
      {isWideWeb ? (
        <View style={{ backgroundColor: colors.primaryDark, height: viewportHeight, width: 264 }}>
          <View style={{ borderBottomColor: "rgba(255,255,255,0.1)", borderBottomWidth: 1, gap: 12, paddingBottom: 14, paddingHorizontal: 18, paddingTop: 20 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
              <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 10, height: 34, justifyContent: "center", width: 34 }}>
                <MaterialCommunityIcons name="shield-crown" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 15.5, fontWeight: "900" }}>OrtakSat</Text>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 }}>YÖNETİM PANELİ</Text>
              </View>
            </View>
            {/* Admin kimliği */}
            <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, flexDirection: "row", gap: 9, paddingHorizontal: 10, paddingVertical: 8 }}>
              <View style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 999, height: 28, justifyContent: "center", width: 28 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{(currentUser.name || "A").slice(0, 1).toLocaleUpperCase("tr-TR")}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" }}>{currentUser.name || "Yönetici"}</Text>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.6)", fontSize: 10.5, fontWeight: "700", textTransform: "capitalize" }}>{currentUser.role === "super_admin" ? "Süper Admin" : currentUser.role === "moderator" ? "Moderatör" : "Admin"}</Text>
              </View>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 2, paddingBottom: 14, paddingHorizontal: 12, paddingTop: 10 }}>
            {NAV_GROUPS.map((group) => (
              <View key={group.title} style={{ gap: 2, marginBottom: 6 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: "900", letterSpacing: 0.8, paddingHorizontal: 12, paddingVertical: 6 }}>{group.title.toLocaleUpperCase("tr-TR")}</Text>
                {group.items.map((n) => {
                  const on = section === n.key;
                  const badge = navBadge(n.key);
                  return (
                    <Pressable key={n.key} onPress={() => setSection(n.key)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: on ? "rgba(255,255,255,0.18)" : pressed ? "rgba(255,255,255,0.08)" : "transparent", borderLeftColor: on ? "#FFFFFF" : "transparent", borderLeftWidth: 3, borderRadius: 9, flexDirection: "row", gap: 11, paddingHorizontal: 11, paddingVertical: 9.5 })}>
                      <MaterialCommunityIcons name={n.icon} size={18} color={on ? "#FFFFFF" : "rgba(255,255,255,0.66)"} />
                      <Text numberOfLines={1} style={{ color: on ? "#FFFFFF" : "rgba(255,255,255,0.8)", flex: 1, fontSize: 13, fontWeight: on ? "900" : "700" }}>{n.label}</Text>
                      {badge ? <View style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 999, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 5 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{badge}</Text></View> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <View style={{ borderTopColor: "rgba(255,255,255,0.12)", borderTopWidth: 1, gap: 4, paddingHorizontal: 12, paddingBottom: 14, paddingTop: 10 }}>
            <Pressable onPress={() => void doRefresh()} disabled={refreshing} style={{ alignItems: "center", borderRadius: 10, flexDirection: "row", gap: 11, opacity: refreshing ? 0.6 : 1, paddingHorizontal: 12, paddingVertical: 10 }}>
              <MaterialCommunityIcons name={refreshing ? "timer-sand" : "refresh"} size={18} color="rgba(255,255,255,0.72)" />
              <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 13.5, fontWeight: "700" }}>{refreshing ? "Yenileniyor…" : "Verileri Yenile"}</Text>
            </Pressable>
            <Link href="/" asChild>
              <Pressable style={{ alignItems: "center", borderRadius: 10, flexDirection: "row", gap: 11, paddingHorizontal: 12, paddingVertical: 10 }}>
                <MaterialCommunityIcons name="storefront-outline" size={18} color="rgba(255,255,255,0.72)" />
                <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 13.5, fontWeight: "700" }}>Siteye dön</Text>
              </Pressable>
            </Link>
            <Pressable onPress={() => { void signOut(); router.replace("/"); }} style={{ alignItems: "center", borderRadius: 10, flexDirection: "row", gap: 11, paddingHorizontal: 12, paddingVertical: 10 }}>
              <MaterialCommunityIcons name="logout" size={18} color="rgba(255,255,255,0.72)" />
              <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 13.5, fontWeight: "700" }}>Çıkış Yap</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ backgroundColor: colors.primaryDark, gap: 8, paddingBottom: 8, paddingTop: 10 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
            <Pressable
              accessibilityLabel="Yönetim menüsünü aç"
              accessibilityRole="button"
              onPress={() => setAdminNavOpen(true)}
              style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.12)", borderRadius: 11, height: 42, justifyContent: "center", width: 42 })}
            >
              <MaterialCommunityIcons name="menu" size={22} color="#FFFFFF" />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.68)", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.6 }}>ORTAKSAT YÖNETİM</Text>
              <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{activeMeta.title}</Text>
            </View>
            <Pressable onPress={() => void doRefresh()} disabled={refreshing} accessibilityRole="button" accessibilityLabel="Verileri yenile" style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 11, height: 42, justifyContent: "center", opacity: refreshing ? 0.6 : 1, width: 42 }}>
              <MaterialCommunityIcons name={refreshing ? "timer-sand" : "refresh"} size={20} color="#FFFFFF" />
            </Pressable>
            <Link href="/" asChild>
              <Pressable accessibilityLabel="Siteye dön" style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 11, height: 42, justifyContent: "center", width: 42 }}>
                <MaterialCommunityIcons name="storefront-outline" size={20} color="#FFFFFF" />
              </Pressable>
            </Link>
          </View>
          {/* Tüm bölümler tek yatay şeritte (kaydırılır) — menüyü açmadan bölüm değiştirilir. */}
          <ScrollView ref={tabsRef} horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
            {NAV.map((n) => {
              const on = section === n.key;
              const badge = navBadge(n.key);
              return (
                <Pressable key={n.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onLayout={(e) => { tabX.current[n.key] = e.nativeEvent.layout.x; }} onPress={() => selectSection(n.key)} style={{ alignItems: "center", backgroundColor: on ? "#FFFFFF" : "rgba(255,255,255,0.1)", borderRadius: 999, flexDirection: "row", gap: 6, minHeight: 40, paddingHorizontal: 13 }}>
                  <MaterialCommunityIcons name={n.icon} size={15} color={on ? colors.primaryDark : "#FFFFFF"} />
                  <Text style={{ color: on ? colors.primaryDark : "#FFFFFF", fontSize: 12.5, fontWeight: "800" }}>{n.label}</Text>
                  {badge ? <View style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 999, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 5 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{badge}</Text></View> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ alignSelf: "center", gap: 16, maxWidth: 1280, padding: isWideWeb ? 24 : 12, paddingBottom: 72, width: "100%" }}>
        {section !== "dashboard" ? (
          <View style={{ alignItems: isWideWeb ? "center" : "stretch", flexDirection: isWideWeb ? "row" : "column", gap: 10, justifyContent: "space-between" }}>
            <View style={{ flexGrow: isWideWeb ? 1 : 0, flexShrink: 1, gap: 3, minWidth: 0 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, height: 34, justifyContent: "center", width: 34 }}>
                  <MaterialCommunityIcons name={activeNav.icon} size={18} color={colors.primaryDark} />
                </View>
                <Text style={{ color: colors.ink, flex: 1, fontSize: isWideWeb ? 22 : 19, fontWeight: "900", letterSpacing: -0.35 }}>{activeMeta.title}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18, marginLeft: 42 }}>{activeMeta.description}</Text>
            </View>
            {isWideWeb ? (
              <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingVertical: 7 }}>
                <View style={{ backgroundColor: colors.success, borderRadius: 999, height: 7, width: 7 }} />
                <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "800" }}>Yetkili oturum</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {section === "dashboard" ? (
          <View style={{ gap: 18 }}>
            <DashHero analytics={analytics} disputedN={disputedSalesN} name={currentUser.name} />
            <AdminActivity onData={setAnalytics} onOverview={setOverview} onMsgStats={setMsgStats} onNavigate={setSection} ts={ts} />
            <Dashboard
              listings={listings} users={users} notifications={notifications}
              pendingN={pendingReview.length} reportsN={pendingReports} pendingCat={pendingCat} pendingLoc={pendingLoc} disputedN={disputedSalesN}
              setSection={setSection} analytics={analytics} overview={overview} ts={ts}
            />
          </View>
        ) : null}

        {section === "users" ? (
          <Panel title="Hesap silme talepleri" sub={accountDeletions === null ? "Yükleniyor…" : `${accountDeletions.filter((d) => d.status === "open").length} bekliyor · ${accountDeletions.length} kayıt — talep açılınca hesap askıya alınır, 30 gün sonunda kalıcı silinir.`}>
            {accountDeletions === null ? <EmptyState title="Yükleniyor…" body="Hesap silme talepleri çekiliyor." /> : accountDeletionsFailed ? (
              <View style={{ alignItems: "flex-start", gap: 8 }}>
                <EmptyState icon="alert-circle-outline" title="Talepler yüklenemedi" body="Kuyruk okunamadı. Bağlantını kontrol edip yenile." />
                <ActionButton tone="neutral" icon="refresh" label="Yenile" onPress={reloadAccountDeletions} />
              </View>
            ) : accountDeletions.length === 0 ? <EmptyState icon="account-remove-outline" title="Hesap silme talebi yok" body="Bir kullanıcı hesabını silmek istediğinde talebi burada görünür." /> : (
              <Table head={["KULLANICI", "NEDEN", "TALEP", "KALICI SİLME", "DURUM", "İŞLEM"]} cols={[1.5, 2, 0.9, 0.9, 0.9, 1.8]}>
                {accountDeletions.map((d) => {
                  const dk = `adel:${d.id}`;
                  const open = d.status === "open";
                  const own = d.userId === currentUser.id;
                  const label = open ? "Bekliyor" : d.status === "completed" ? "Silindi" : d.status === "rejected" ? "Reddedildi" : d.status === "cancelled" ? "İptal edildi" : d.status;
                  return (
                    <Row key={d.id} cols={[1.5, 2, 0.9, 0.9, 0.9, 1.8]} cells={[
                      <View style={{ gap: 2 }}>
                        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{d.name || "İsimsiz kullanıcı"}</Text>
                        <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{`${d.listingCount} ilan`}</Text>
                      </View>,
                      <Text numberOfLines={3} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{d.note ? `${d.reason || "—"} · Not: ${d.note}` : d.reason || "—"}</Text>,
                      <Text style={{ color: colors.muted, fontSize: 11.5, fontVariant: ["tabular-nums"], fontWeight: "600" }}>{(d.requestedAt ?? "").slice(0, 10) || "—"}</Text>,
                      <Text style={{ color: colors.ink, fontSize: 11.5, fontVariant: ["tabular-nums"], fontWeight: "800" }}>{(d.completedAt ?? d.scheduledFor ?? "").slice(0, 10) || "—"}</Text>,
                      <StatusBadge label={label} tone={open ? "warning" : d.status === "completed" ? "accent" : "neutral"} />,
                      open ? (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: isWideWeb ? "flex-end" : "flex-start" }}>
                          <ActionButton tone="neutral" icon="account-reactivate-outline" label="Talebi reddet" busy={busy[dk]} accessibilityLabel={`${d.name} silme talebini reddet`} onPress={() => confirmAction(`${d.name || "Bu kullanıcı"} için hesap silme talebi REDDEDİLSİN mi? Hesap yeniden aktif olur ve talebin duraklattığı ilanlar geri açılır.`, () => void resolveAccountDeletion(d, "reject"), "Talebi reddet")} />
                          {canManageUsers && !own ? <ActionButton tone="danger" icon="trash-can-outline" label="Şimdi sil" busy={busy[dk]} accessibilityLabel={`${d.name} hesabını şimdi kalıcı sil`} onPress={() => { setDeleteNowText(""); setDeleteNowTarget(d); }} /> : null}
                        </View>
                      ) : <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>—</Text>
                    ]} />
                  );
                })}
              </Table>
            )}
          </Panel>
        ) : null}
        {section === "users" ? (
          <Panel title="Kullanıcılar" sub={`${analytics ? `${fmtN(analytics.total_users)} toplam kayıtlı (sunucu) · ` : overview ? `${fmtN(overview.users_total)} toplam kayıtlı (sunucu) · ` : ""}${shownUsers.length} yüklü${deletedUserCount ? ` · ${deletedUserCount} silinmiş (gizli)` : ""}${canManageUsers ? " · rol, durum, doğrulama" : ""}`}>
            <AdminSearch value={userQuery} onChange={setUserQuery} placeholder="İsim, rol veya durum ara…" />
            <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
              <FilterChips value={userFilter} onChange={setUserFilter} options={[
                { key: "all", label: "Tümü", count: liveUsers.length },
                { key: "active", label: "Aktif" },
                { key: "suspended", label: "Askıda", count: liveUsers.filter((u) => u.status === "suspended").length },
                { key: "seller", label: "Satıcı" },
                { key: "staff", label: "Yönetici", count: liveUsers.filter((u) => u.role === "admin" || u.role === "moderator" || u.role === "super_admin").length }
              ]} />
              {canManageUsers ? (
                <ExportButton
                  filename={`kullanicilar-${userFilter}.csv`}
                  headers={["Ad", "Telefon", "Rol", "Durum", "Puan", "Başarılı Satış", "Doğrulanmış Tel", "Doğrulanmış Kimlik"]}
                  rows={shownUsers.map((u) => [u.name, u.phone ?? "", u.role ?? "user", u.status ?? "active", u.rating, u.successfulSales, u.verifiedPhone ? "Evet" : "Hayır", u.verifiedIdentity ? "Evet" : "Hayır"])}
                />
              ) : null}
            </View>
            {detailUserId ? (() => {
              const du = users.find((x) => x.id === detailUserId);
              if (!du) return null;
              const uListings = listings.filter((l) => l.ownerId === du.id);
              const uPartner = partnerships.filter((p) => p.partnerId === du.id);
              const uReports = reports.filter((r) => r.reportedUserId === du.id);
              const uMsgs = messages.filter((m) => m.senderId === du.id || m.receiverId === du.id).length;
              return (
                <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.primary, borderRadius: 12, borderWidth: 1, gap: 10, marginBottom: 12, padding: 14 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                    <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 40, justifyContent: "center", width: 40 }}><MaterialCommunityIcons name="account" size={22} color={colors.primaryDark} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{du.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{du.phone || "telefon yok"} · {du.role ?? "user"} · {du.status ?? "active"} · ⭐ {du.rating}</Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={() => setDetailUserId(null)} style={{ alignItems: "center", height: 40, justifyContent: "center", width: 40 }}><MaterialCommunityIcons name="close-circle" size={22} color={colors.muted} /></Pressable>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    <MiniStat label="İlan" value={`${uListings.length}`} />
                    <MiniStat label="Ortaklık" value={`${uPartner.length}`} />
                    <MiniStat label="Mesaj" value={`${uMsgs}`} />
                    <MiniStat label="Şikayet" value={`${uReports.length}`} tone={uReports.length ? "accent" : undefined} />
                    <MiniStat label="Satış" value={`${du.successfulSales}`} />
                  </View>
                  {uListings.length ? (
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>İlanları</Text>
                      {uListings.slice(0, 6).map((l) => (
                        <View key={l.id} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                          <MaterialCommunityIcons name="circle-small" size={16} color={colors.primary} />
                          <Link href={{ pathname: "/listing/[id]", params: { id: l.id } }} asChild><Pressable style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>{l.title}</Text></Pressable></Link>
                          <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>{l.status === "active" ? "Yayında" : l.status === "pending_review" ? "İncelemede" : l.status}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {uReports.length ? (
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>Hakkındaki şikayetler</Text>
                      {uReports.slice(0, 4).map((r) => <Text key={r.id} numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>• {r.reason}{r.details ? ` — ${r.details}` : ""}</Text>)}
                    </View>
                  ) : null}
                </View>
              );
            })() : null}
            {shownUsers.length === 0 ? <EmptyState icon="account-search-outline" title="Kullanıcı bulunamadı" body="Arama veya filtreye uyan kullanıcı yok." /> : null}
            <Table head={["KULLANICI", "ROL", "DURUM", "DOĞRULAMA", "İŞLEM"]} cols={[1.8, 1.5, 1, 1.1, 2]}>
              {usersPg.slice.map((u) => {
                const suspended = u.status === "suspended";
                const isSelf = u.id === currentUser.id;
                const roles: UserRole[] = ["user", "moderator", "admin"];
                const roleName = (r: UserRole) => (r === "user" ? "Üye" : r === "moderator" ? "Moderatör" : "Admin");
                return (
                  <Row key={u.id} cols={[1.8, 1.5, 1, 1, 1.8]} cells={[
                    <Pressable accessibilityRole="button" accessibilityLabel={`${u.name} detayını aç`} onPress={() => setDetailUserId(detailUserId === u.id ? null : u.id)} style={{ gap: 1, justifyContent: "center", minHeight: isWideWeb ? 0 : 40 }}>
                      <Text numberOfLines={1} style={{ color: colors.primary, fontSize: 13, fontWeight: "800" }}>{u.name}{isSelf ? " (sen)" : ""}</Text>
                      <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>Detay için dokun · ⭐ {u.rating}</Text>
                    </Pressable>,
                    canManageUsers && !isSelf ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                        {roles.map((r) => {
                          const on = (u.role ?? "user") === r || (r === "user" && !["moderator", "admin", "super_admin"].includes(u.role ?? "user"));
                          return (
                            <Pressable key={r} accessibilityRole="button" accessibilityState={{ selected: on }} disabled={on || !!busy[`role:${u.id}`]} onPress={() => confirmAction(`${u.name} kullanıcısının rolü "${roleName(r)}" yapılsın mı?${r !== "user" ? " Bu rol yönetim paneline erişim verir." : ""}`, () => void run(`role:${u.id}`, () => setUserRole(u.id, r), "Rol güncellendi"), "Rolü değiştir")} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 8, borderWidth: 1, justifyContent: "center", minHeight: isWideWeb ? 30 : 40, opacity: busy[`role:${u.id}`] ? 0.5 : 1, paddingHorizontal: 10 }}>
                              <Text style={{ color: on ? "#FFFFFF" : colors.muted, fontSize: 11.5, fontWeight: "800" }}>{r === "user" ? "Üye" : r === "moderator" ? "Mod" : "Admin"}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{u.role === "admin" || u.role === "super_admin" ? "Admin" : u.role === "moderator" ? "Moderatör" : "Üye"}</Text>
                    ),
                    <StatusBadge label={suspended ? "Askıda" : "Aktif"} tone={suspended ? "accent" : "success"} />,
                    canManageUsers && !isSelf ? (
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <Pressable accessibilityRole="button" accessibilityLabel={u.verifiedPhone ? "Telefon doğrulamasını kaldır" : "Telefonu doğrulanmış işaretle"} onPress={() => void run(`vp:${u.id}`, () => setUserVerification(u.id, "verifiedPhone", !u.verifiedPhone), u.verifiedPhone ? "Telefon doğrulaması kaldırıldı" : "Telefon doğrulandı")} style={{ alignItems: "center", backgroundColor: u.verifiedPhone ? colors.successSoft : colors.surfaceAlt, borderRadius: 10, height: isWideWeb ? 32 : 40, justifyContent: "center", width: isWideWeb ? 32 : 40 }}>
                          <MaterialCommunityIcons name="phone-check" size={18} color={u.verifiedPhone ? SUCCESS_INK : colors.subtle} />
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel={u.verifiedIdentity ? "Kimlik doğrulamasını kaldır" : "Kimliği doğrulanmış işaretle"} onPress={() => void run(`vi:${u.id}`, () => setUserVerification(u.id, "verifiedIdentity", !u.verifiedIdentity), u.verifiedIdentity ? "Kimlik doğrulaması kaldırıldı" : "Kimlik doğrulandı")} style={{ alignItems: "center", backgroundColor: u.verifiedIdentity ? colors.successSoft : colors.surfaceAlt, borderRadius: 10, height: isWideWeb ? 32 : 40, justifyContent: "center", width: isWideWeb ? 32 : 40 }}>
                          <MaterialCommunityIcons name="card-account-details-outline" size={18} color={u.verifiedIdentity ? SUCCESS_INK : colors.subtle} />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        {u.verifiedPhone ? <MaterialCommunityIcons name="phone-check" size={15} color={SUCCESS_INK} /> : null}
                        {u.verifiedIdentity ? <MaterialCommunityIcons name="card-account-details-outline" size={15} color={SUCCESS_INK} /> : null}
                        {u.verifiedInstagram ? <MaterialCommunityIcons name="instagram" size={15} color={colors.violet} /> : null}
                        {!u.verifiedPhone && !u.verifiedIdentity && !u.verifiedInstagram ? <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>—</Text> : null}
                      </View>
                    ),
                    canManageUsers && !isSelf ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: isWideWeb ? "flex-end" : "flex-start" }}>
                        <ActionButton tone={suspended ? "success" : "warning"} icon={suspended ? "account-check-outline" : "account-cancel-outline"} label={suspended ? "Aktifleştir" : "Askıya al"} busy={busy[`ust:${u.id}`]} onPress={() => confirmAction(`${u.name} ${suspended ? "yeniden aktifleştirilsin" : "askıya alınsın"} mı?${suspended ? "" : " Kullanıcı işlem yapamaz."}`, () => void run(`ust:${u.id}`, () => setUserStatus(u.id, suspended ? "active" : "suspended"), suspended ? "Kullanıcı aktifleştirildi" : "Kullanıcı askıya alındı"), suspended ? "Aktifleştir" : "Askıya al")} />
                        <ActionButton tone="soft" icon="bell-plus-outline" label="Bildirim" onPress={() => promptNotify(u.id, u.name)} />
                        <ActionButton tone="danger" icon="trash-can-outline" label="Sil" busy={busy[`ust:${u.id}`]} onPress={() => confirmAction(`${u.name} hesabı silinsin mi? Kullanıcı erişimi kapatılır.`, () => void run(`ust:${u.id}`, () => setUserStatus(u.id, "deleted"), "Hesap silindi"), "Hesabı sil")} />
                      </View>
                    ) : <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>—</Text>
                  ]} />
                );
              })}
            </Table>
            <Pager {...usersPg} />
            {!canManageUsers ? <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", marginTop: 8 }}>Rol/durum değiştirme yalnızca admin hesaplarına açıktır (sen moderatörsün).</Text> : null}
          </Panel>
        ) : null}

        {section === "listings" ? (
          <View style={{ gap: 16 }}>
          {pendingReview.length > 0 ? (
            <Panel title="Moderasyon Kuyruğu" sub={`${pendingReview.length} ilan onay bekliyor`}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <ActionButton tone="primary" icon="check-all" label={`Tümünü onayla (${pendingReview.length})`} busy={busy["bulk"]} onPress={() => confirmAction(`Onay bekleyen ${pendingReview.length} ilanın TÜMÜ yayınlansın mı?`, () => void run("bulk", async () => (await Promise.all(pendingReview.map((l) => updateListingStatus(l.id, "active")))).every(Boolean), "Bekleyen ilanlar yayınlandı", "Bazı ilanlar yayınlanamadı. Listeyi kontrol et."), "Tümünü onayla")} />
                <ActionButton tone="danger" icon="close-box-multiple-outline" label="Tümünü reddet" busy={busy["bulk"]} onPress={() => confirmAction(`Onay bekleyen ${pendingReview.length} ilanın TÜMÜ reddedilsin mi? Bu işlem geri alınamaz.`, () => void run("bulk", async () => (await Promise.all(pendingReview.map((l) => updateListingStatus(l.id, "rejected")))).every(Boolean), "Bekleyen ilanlar reddedildi", "Bazı ilanlar reddedilemedi. Listeyi kontrol et."), "Tümünü reddet")} />
              </View>
              <Table head={["İLAN", "KATEGORİ", "SAHİP", "İŞLEM"]} cols={[2.4, 1.3, 1.4, 1.6]}>
                {pendingReview.slice(0, 50).map((l) => (
                  <Row key={l.id} cols={[2.4, 1.3, 1.4, 1.6]} cells={[
                    <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{l.title}</Text>,
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{l.category}</Text>,
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{findUser(l.ownerId)?.name ?? "—"}</Text>,
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <ActionButton tone="primary" icon="check" label="Onayla" busy={busy[`ls:${l.id}`] || busy["bulk"]} onPress={() => void run(`ls:${l.id}`, () => updateListingStatus(l.id, "active"), "İlan yayınlandı", "İlan yayınlanamadı. Tekrar dene.")} />
                      <ActionButton tone="neutral" icon="close" label="Reddet" busy={busy[`ls:${l.id}`] || busy["bulk"]} onPress={() => confirmAction(`"${l.title}" ilanı reddedilsin mi?`, () => void run(`ls:${l.id}`, () => updateListingStatus(l.id, "rejected"), "İlan reddedildi", "İlan reddedilemedi. Tekrar dene."), "Reddet")} />
                    </View>
                  ]} />
                ))}
              </Table>
              {pendingReview.length > 50 ? <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700", paddingTop: 8 }}>İlk 50 gösteriliyor · kalan {pendingReview.length - 50} ilan aşağıda "Onay bekleyen" filtresinde.</Text> : null}
            </Panel>
          ) : null}
          <Panel title="İlanlar" sub={`${fmtN(analytics?.listings_active ?? activeListings.length)} aktif · ${fmtN(analytics?.listings_pending ?? pendingReview.length)} incelemede · ${fmtN(analytics?.listings_total ?? listings.length)} toplam${analytics && analytics.listings_total > listings.length ? ` (${listings.length} yüklü örnek)` : ""}${lq ? ` · ${shownListings.length} sonuç` : ""}`}>
            <AdminSearch value={listingQuery} onChange={setListingQuery} placeholder="Başlık, kategori, sahip veya durum ara…" />
            <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
              <FilterChips value={listingFilter} onChange={setListingFilter} options={[
                { key: "all", label: "Tümü", count: listings.length },
                { key: "pending", label: "Onay bekleyen", count: pendingReview.length },
                { key: "active", label: "Yayında", count: activeListings.length },
                { key: "paused", label: "Askıda", count: listings.filter((l) => l.status === "paused").length },
                { key: "rejected", label: "Reddedilen", count: listings.filter((l) => l.status === "rejected").length },
                { key: "featured", label: "Öne çıkan", count: listings.filter((l) => l.featured).length },
                { key: "risky", label: "⚠ Riskli", count: riskyListings.length }
              ]} />
              <ExportButton
                filename={`ilanlar-${listingFilter}.csv`}
                headers={["Başlık", "Kategori", "Fiyat", "Para Birimi", "Sahip", "Durum", "Komisyon Tipi", "Komisyon", "Stok", "Şehir", "Öne Çıkan", "Oluşturma"]}
                rows={shownListings.map((l) => [l.title, l.category, l.price, l.currency, findUser(l.ownerId)?.name ?? "", l.status, l.commissionType, l.commissionValue, l.stockCount, l.location, l.featured ? "Evet" : "Hayır", l.createdAt])}
              />
            </View>
            <Table head={["İLAN", "KATEGORİ", "FİYAT", "SAHİP", "DURUM", "İŞLEM"]} cols={[2.2, 1.2, 1, 1.4, 1, 1.4]}>
              {listingsPg.slice.map((l) => {
                const risk = computeListingRisk(l, listings, findUser(l.ownerId));
                const riskColor = risk.level === "high" ? colors.accent : risk.level === "medium" ? colors.goldInk : SUCCESS_INK;
                const riskBg = risk.level === "high" ? colors.accentSoft : risk.level === "medium" ? colors.warningSoft : colors.successSoft;
                const lk = `ls:${l.id}`;
                return (
                <Row key={l.id} cols={[2.2, 1.2, 1, 1.4, 1, 1.2]} cells={[
                  <View style={{ gap: 3, minWidth: 0, alignSelf: "stretch", overflow: "hidden" }}>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 6, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: "800" }}>{l.title}</Text>
                      <View style={{ alignItems: "center", backgroundColor: riskBg, borderRadius: 999, flexDirection: "row", flexShrink: 0, gap: 2, paddingHorizontal: 6, paddingVertical: 1 }}>
                        <MaterialCommunityIcons name={risk.level === "high" ? "alert-octagon" : risk.level === "medium" ? "alert" : "shield-check"} size={10} color={riskColor} />
                        <Text style={{ color: riskColor, fontSize: 9.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{risk.score}</Text>
                      </View>
                    </View>
                    {risk.flags.length && risk.level !== "low" ? (
                      <Text numberOfLines={2} style={{ color: riskColor, fontSize: 10, fontWeight: "700", lineHeight: 13 }}>⚠ {risk.flags.slice(0, 3).join(" · ")}</Text>
                    ) : null}
                  </View>,
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{l.category}</Text>,
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>{money(l.price)}</Text>,
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{findUser(l.ownerId)?.name ?? "—"}</Text>,
                  <StatusBadge label={listingStatusLabel(l.status)} tone={l.status === "active" ? "success" : l.status === "rejected" ? "accent" : l.status === "pending_review" ? "warning" : "neutral"} />,
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: isWideWeb ? "flex-end" : "flex-start" }}>
                    <PressLink href={{ pathname: "/listing/[id]", params: { id: l.id } }} accessibilityLabel="İlanı aç" style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, height: isWideWeb ? 34 : 40, justifyContent: "center", width: isWideWeb ? 34 : 40 }}>
                      <MaterialCommunityIcons name="open-in-new" size={16} color={colors.ink} />
                    </PressLink>
                    {l.status === "active"
                      ? <ActionButton tone="neutral" icon="eye-off-outline" label="Kaldır" busy={busy[lk]} onPress={() => confirmAction(`"${l.title}" yayından kaldırılsın mı? (duraklatılır, silinmez)`, () => void run(lk, () => updateListingStatus(l.id, "paused"), "İlan yayından kaldırıldı", "İlan kaldırılamadı. Tekrar dene."), "Kaldır")} />
                      : <ActionButton tone="primary" icon="eye-outline" label="Yayınla" busy={busy[lk]} onPress={() => void run(lk, () => updateListingStatus(l.id, "active"), "İlan yayınlandı", "İlan yayınlanamadı. Tekrar dene.")} />}
                    <ActionButton tone={l.featured ? "warning" : "neutral"} icon={l.featured ? "star" : "star-outline"} label={l.featured ? "Öne çıkan" : "Öne çıkar"} busy={busy[`lf:${l.id}`]} onPress={() => void run(`lf:${l.id}`, () => setListingFeatured(l.id, !l.featured), l.featured ? "Öne çıkarma kaldırıldı" : "İlan öne çıkarıldı")} />
                    {l.status !== "rejected" ? <ActionButton tone="warning" icon="close-circle-outline" label="Reddet" busy={busy[lk]} onPress={() => confirmAction(`"${l.title}" ilanı reddedilsin mi?`, () => void run(lk, () => updateListingStatus(l.id, "rejected"), "İlan reddedildi", "İlan reddedilemedi. Tekrar dene."), "Reddet")} /> : null}
                    <ActionButton tone="danger" icon="trash-can-outline" label="Kalıcı sil" busy={busy[lk]} onPress={() => confirmAction(`"${l.title}" ilanı kalıcı olarak silinsin mi? Bu işlem geri alınamaz. Satış, komisyon, ortaklık veya talep geçmişi olan ilan silinmez; arşivlenir (yayından kalkar, kayıtlar korunur).`, () => { let outcome: "deleted" | "archived" = "deleted"; void run(lk, () => deleteListing(l.id, (o) => { outcome = o; }), () => (outcome === "archived" ? "İlan arşivlendi (geçmişi olduğu için silinmedi)" : "İlan kalıcı olarak silindi"), "İlan kaldırılamadı; kayıt olduğu gibi duruyor. Tekrar dene ya da yayından kaldırmayı kullan."); }, "Kalıcı sil")} />
                  </View>
                ]} />
                );
              })}
            </Table>
            {shownListings.length === 0 ? <EmptyState icon="file-search-outline" title="İlan bulunamadı" body="Arama veya filtreye uyan ilan yok." /> : null}
            <Pager {...listingsPg} />
          </Panel>
          </View>
        ) : null}

        {section === "partnerships" ? (
          <Panel title="Ortak Satış Talepleri" sub={adminPartnerships === null ? "Yükleniyor…" : `${adminPartnerships.filter((p) => p.status === "pending").length} bekliyor · ${fmtN(adminPartnerships.length)} kayıt (sunucu)${ovPartnershipsTotal != null && ovPartnershipsTotal !== adminPartnerships.length ? ` · toplam ${fmtN(ovPartnershipsTotal)}` : ""}`}>
            <AdminSearch value={partQuery} onChange={setPartQuery} placeholder="İlan, ilan sahibi veya ortak ara…" />
            <FilterChips value={partFilter} onChange={setPartFilter} options={[
              { key: "all", label: "Tümü", count: (adminPartnerships ?? []).length },
              { key: "pending", label: "Bekleyen", count: (adminPartnerships ?? []).filter((p) => p.status === "pending").length },
              { key: "active", label: "Aktif", count: (adminPartnerships ?? []).filter((p) => p.status === "active" || p.status === "approved").length },
              { key: "rejected", label: "Reddedilen" },
              { key: "cancelled", label: "İptal" }
            ]} />
            {adminPartnerships === null ? <EmptyState title="Yükleniyor…" body="Platform geneli ortaklıklar çekiliyor." /> : adminPartnerships.length === 0 ? <EmptyState icon="handshake-outline" title="Ortak satış talebi yok" body="Bir kullanıcı bir ilana ortak satıcı olmak için başvurduğunda burada görünür." /> : shownPartnerships.length === 0 ? <EmptyState icon="handshake-outline" title="Sonuç yok" body="Arama veya filtreye uyan ortaklık yok." /> : null}
            {shownPartnerships.length ? (
            <Table head={["İLAN", "İLAN SAHİBİ", "ORTAK ADAYI", "KOMİSYON", "DURUM", "TARİH", "İŞLEM"]} cols={[1.9, 1.3, 1.3, 1, 1, 0.9, 1.6]}>
              {partsPg.slice.map((p) => {
                const tone = PARTNERSHIP_TONE[p.status] ?? { tint: colors.surfaceAlt, color: colors.muted, label: p.status };
                const comm = p.commissionType === "rate" ? `%${p.commissionValue}` : (p.commissionValue != null ? money(p.commissionValue) : "—");
                const pk = `ps:${p.id}`;
                return (
                  <Row key={p.id} cols={[1.9, 1.3, 1.3, 1, 1, 0.9, 1.6]} cells={[
                    <PressLink href={{ pathname: "/listing/[id]", params: { id: p.listingId } }} style={{ justifyContent: "center", minHeight: isWideWeb ? 0 : 40 }}>
                      <Text numberOfLines={2} style={{ color: colors.primary, fontSize: 12.5, fontWeight: "800" }}>{p.listingTitle ?? p.listingId.slice(0, 10)}</Text>
                    </PressLink>,
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{p.ownerName ?? "—"}</Text>,
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{p.partnerName ?? "—"}</Text>,
                    <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{comm}</Text>,
                    <View style={{ alignSelf: "flex-start", backgroundColor: tone.tint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: tone.color, fontSize: 10.5, fontWeight: "900" }}>{tone.label}</Text></View>,
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontVariant: ["tabular-nums"], fontWeight: "600" }}>{p.createdAt.slice(0, 10)}</Text>,
                    p.status === "pending" ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: isWideWeb ? "flex-end" : "flex-start" }}>
                        <ActionButton tone="primary" icon="check" label="Onayla" busy={busy[pk]} accessibilityLabel="Ortaklığı onayla" onPress={() => setPartnership(p.id, "active", "Bu ortaklık başvurusu ONAYLANSIN mı?", "Onayla", "Ortaklık onaylandı")} />
                        <ActionButton tone="neutral" icon="close" label="Reddet" busy={busy[pk]} accessibilityLabel="Ortaklığı reddet" onPress={() => setPartnership(p.id, "rejected", "Bu ortaklık başvurusu reddedilsin mi?", "Reddet", "Başvuru reddedildi")} />
                      </View>
                    ) : p.status === "active" ? (
                      <ActionButton tone="danger" icon="link-off" label="Sonlandır" busy={busy[pk]} onPress={() => setPartnership(p.id, "cancelled", "Bu aktif ortaklık sonlandırılsın mı? Paylaşım linki devre dışı kalır.", "Sonlandır", "Ortaklık sonlandırıldı")} />
                    ) : <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>—</Text>
                  ]} />
                );
              })}
            </Table>
            ) : null}
            <Pager {...partsPg} />
          </Panel>
        ) : null}

        {section === "complaints" ? (
          <Panel title="Şikayetler" sub={`${fmtN(overview?.reports_open ?? pendingReports)} açık · ${fmtN(overview?.reports_total ?? reports.length)} toplam${overview ? " (sunucu)" : ""}`}>
            <AdminSearch value={reportQuery} onChange={setReportQuery} placeholder="Sebep, ilan, kullanıcı veya şikayet eden ara…" />
            <FilterChips value={reportFilter} onChange={setReportFilter} options={[
              { key: "open", label: "Bekleyen", count: pendingReports },
              { key: "resolved", label: "Çözülen", count: reports.filter((r) => r.status === "resolved").length },
              { key: "rejected", label: "Reddedilen", count: reports.filter((r) => r.status === "rejected").length },
              { key: "all", label: "Tümü", count: reports.length }
            ]} />
            {reports.length === 0 ? <EmptyState icon="flag-outline" title="Şikayet yok" body="Kullanıcılar ilan veya satıcı şikayet ettiğinde burada görünür ve buradan işlem yapabilirsin." /> : shownReports.length === 0 ? <EmptyState icon="flag-outline" title={reportFilter === "open" ? "Bekleyen şikayet yok" : "Sonuç yok"} body={reportFilter === "open" ? "Tüm şikayetler işlenmiş. Geçmiş için filtreyi değiştir." : "Arama veya filtreye uyan şikayet yok."} /> : null}
            {reportsPg.slice.map((r) => {
              const target = r.listingId ? listings.find((l) => l.id === r.listingId) : undefined;
              const reportedUser = r.reportedUserId ? findUser(r.reportedUserId) : undefined;
              // Şikayet edilen kullanıcı: doğrudan kullanıcı şikayeti ya da ilan sahibi.
              const actUser = reportedUser ?? (target ? findUser(target.ownerId) : undefined);
              const rk = `rp:${r.id}`;
              return (
                <View key={r.id} style={{ borderBottomColor: colors.line, borderBottomWidth: 1, gap: 7, paddingVertical: 13 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                    <MaterialCommunityIcons name={r.listingId ? "file-alert-outline" : "account-alert-outline"} size={17} color={colors.accent} />
                    <Text numberOfLines={2} style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900", minWidth: 0 }}>
                      {target ? target.title : reportedUser ? reportedUser.name : r.listingId ?? r.reportedUserId ?? "Şikayet"}
                    </Text>
                    <StatusBadge label={isOpenReport(r) ? "Bekliyor" : r.status === "resolved" ? "Çözüldü" : "Reddedildi"} tone={isOpenReport(r) ? "warning" : r.status === "resolved" ? "success" : "neutral"} />
                  </View>
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>Sebep: {r.reason}</Text>
                  {r.details ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{r.details}</Text> : null}
                  <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>
                    Şikayet eden: {findUser(r.reporterId)?.name ?? r.reporterId.slice(0, 8)} · {r.createdAt}
                    {reportedUser && r.listingId ? ` · Satıcı: ${findUser(target?.ownerId ?? "")?.name ?? "—"}` : ""}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                    {target ? (
                      <PressLink href={{ pathname: "/listing/[id]", params: { id: target.id } }} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: isWideWeb ? 34 : 40, paddingHorizontal: 12 }}>
                        <MaterialCommunityIcons name="open-in-new" size={15} color={colors.ink} />
                        <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>İlana git</Text>
                      </PressLink>
                    ) : null}
                    {target ? (
                      target.status === "active"
                        ? <ActionButton tone="neutral" icon="eye-off-outline" label="İlanı kaldır" busy={busy[`ls:${target.id}`]} onPress={() => confirmAction(`"${target.title}" yayından kaldırılsın mı?`, () => void run(`ls:${target.id}`, () => updateListingStatus(target.id, "paused"), "İlan yayından kaldırıldı", "İlan kaldırılamadı. Tekrar dene."), "Kaldır")} />
                        : <ActionButton tone="neutral" icon="eye-outline" label="Yayınla" busy={busy[`ls:${target.id}`]} onPress={() => void run(`ls:${target.id}`, () => updateListingStatus(target.id, "active"), "İlan yayınlandı", "İlan yayınlanamadı. Tekrar dene.")} />
                    ) : null}
                    {actUser && canManageUsers && actUser.id !== currentUser.id ? (
                      <>
                        <ActionButton tone={actUser.status === "suspended" ? "success" : "danger"} icon={actUser.status === "suspended" ? "account-check-outline" : "account-cancel-outline"} label={actUser.status === "suspended" ? "Aktifleştir" : "Kullanıcıyı askıya al"} busy={busy[`ust:${actUser.id}`]} onPress={() => confirmAction(`${actUser.name} kullanıcısı ${actUser.status === "suspended" ? "aktifleştirilsin" : "askıya alınsın"} mı?`, () => void run(`ust:${actUser.id}`, () => setUserStatus(actUser.id, actUser.status === "suspended" ? "active" : "suspended"), actUser.status === "suspended" ? "Kullanıcı aktifleştirildi" : "Kullanıcı askıya alındı"), actUser.status === "suspended" ? "Aktifleştir" : "Askıya al")} />
                        <ActionButton tone="soft" icon="bell-outline" label="Kullanıcıyı uyar" onPress={() => promptNotify(actUser.id, actUser.name)} />
                      </>
                    ) : null}
                    {isOpenReport(r) && r.reason.startsWith("DOĞRULAMA TALEBİ") && actUser && canManageUsers ? (
                      <>
                        <ActionButton tone="success" icon="check-decagram" label="Kimlik doğrula" busy={busy[rk]} onPress={() => void run(rk, () => verifyAndResolve(actUser.id, "verifiedIdentity", r.id), "Kimlik doğrulandı, talep kapatıldı", "Kimlik doğrulanamadı ya da talep kapatılamadı. Kaydı kontrol edip tekrar dene.")} />
                        <ActionButton tone="success" icon="phone-check" label="Telefon doğrula" busy={busy[rk]} onPress={() => void run(rk, () => verifyAndResolve(actUser.id, "verifiedPhone", r.id), "Telefon doğrulandı, talep kapatıldı", "Telefon doğrulanamadı ya da talep kapatılamadı. Kaydı kontrol edip tekrar dene.")} />
                      </>
                    ) : null}
                    {isOpenReport(r) ? (
                      <>
                        <ActionButton tone="primary" icon="check" label="Çözüldü" busy={busy[rk]} onPress={() => void run(rk, () => updateReportStatus(r.id, "resolved"), "Şikayet çözüldü olarak işaretlendi", "Şikayet güncellenemedi. Tekrar dene.")} />
                        <ActionButton tone="neutral" icon="close" label="Reddet" busy={busy[rk]} onPress={() => confirmAction("Bu şikayet reddedilsin mi? (işlem yapılmadan kapatılır)", () => void run(rk, () => updateReportStatus(r.id, "rejected"), "Şikayet reddedildi", "Şikayet güncellenemedi. Tekrar dene."), "Reddet")} />
                      </>
                    ) : null}
                  </View>
                </View>
              );
            })}
            <Pager {...reportsPg} />
          </Panel>
        ) : null}

        {section === "categories" ? (
          <View style={{ gap: 16 }}>
            <CategoryManager extra={extraCategories} onSave={saveCategory} onDelete={deleteCategory} onImport={importCategories} confirmAction={confirmAction} />
            <Panel title="Kategori Önerileri" sub={`${pendingCat} bekliyor`}>
              {categorySuggestions.length === 0 ? <EmptyState icon="shape-outline" title="Öneri yok" body="Henüz kategori önerisi gelmedi." /> : null}
              {categorySuggestions.map((s) => (
                <SuggestionRow key={s.id} title={s.suggestedPath} note={s.note} meta={`${s.userName ?? "Kullanıcı"} · ${s.createdAt}`} status={s.status} onApprove={() => void run(`cs:${s.id}`, () => adoptCategorySuggestion(s.id, s.suggestedPath), "Öneri onaylandı, kategori eklendi")} onReject={() => confirmAction("Bu kategori önerisi reddedilsin mi?", () => void run(`cs:${s.id}`, () => setCategorySuggestionStatus(s.id, "rejected"), "Öneri reddedildi"), "Reddet")} />
              ))}
            </Panel>
            <Panel title="Kategori Yapısı" sub={`${categoryTree.length} ana kategori`}>
              {categoryTree.map((n) => {
                const open = expandedCat === n.key;
                const hidden = hiddenCategories.includes(n.key);
                return (
                  <View key={n.key} style={{ borderBottomColor: colors.line, borderBottomWidth: 1 }}>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingVertical: 12 }}>
                      <Pressable onPress={() => setExpandedCat(open ? null : n.key)} style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: 10, minHeight: 40, minWidth: 0 }}>
                        <MaterialCommunityIcons name="folder-outline" size={18} color={hidden ? colors.subtle : colors.primaryDark} />
                        <Text style={{ color: hidden ? colors.muted : colors.ink, flex: 1, fontSize: 13.5, fontWeight: "800", textDecorationLine: hidden ? "line-through" : "none" }}>{n.label}</Text>
                        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{n.children?.length ?? 0} alt</Text>
                      </Pressable>
                      {/* Gizle/Göster — gezinme yüzeylerinden (menü/keşfet/kategoriler) gizler; ilan verme etkilenmez. */}
                      <Pressable onPress={() => toggleHiddenCategory(n.key)} accessibilityLabel={hidden ? "Kategoriyi göster" : "Kategoriyi gizle"} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: hidden ? colors.goldSoft : colors.surfaceAlt, borderRadius: 999, flexDirection: "row", gap: 4, minHeight: isWideWeb ? 30 : 40, paddingHorizontal: 12 }}>
                        <MaterialCommunityIcons name={hidden ? "eye-off-outline" : "eye-outline"} size={14} color={hidden ? colors.goldInk : colors.muted} />
                        <Text style={{ color: hidden ? colors.goldInk : colors.muted, fontSize: 11.5, fontWeight: "800" }}>{hidden ? "Gizli" : "Görünür"}</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={open ? "Alt kategorileri gizle" : "Alt kategorileri göster"} onPress={() => setExpandedCat(open ? null : n.key)} style={{ alignItems: "center", height: 40, justifyContent: "center", width: 36 }}><MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} /></Pressable>
                    </View>
                    {open ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 12 }}>
                        {(n.children ?? []).map((c) => (
                          <View key={c.key} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 }}><Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{c.label}{c.children?.length ? ` · ${c.children.length}` : ""}</Text></View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </Panel>
          </View>
        ) : null}

        {section === "locations" ? (
          <Panel title="Konum Önerileri" sub={`${pendingLoc} bekliyor`}>
            {locationSuggestions.length === 0 ? <EmptyState icon="map-marker-outline" title="Öneri yok" body="Henüz konum/mahalle önerisi gelmedi." /> : null}
            {locationSuggestions.map((s) => (
              <SuggestionRow key={s.id} title={`${s.suggestedName} (${s.type})`} note={[getProvince(s.provinceId)?.name, getDistrict(s.districtId)?.name].filter(Boolean).join(" / ") + (s.note ? ` — ${s.note}` : "")} meta={`${s.userName ?? "Kullanıcı"} · ${s.createdAt}`} status={s.status} onApprove={() => void run(`lsg:${s.id}`, () => setLocationSuggestionStatus(s.id, "approved"), "Konum önerisi onaylandı")} onReject={() => confirmAction("Bu konum önerisi reddedilsin mi?", () => void run(`lsg:${s.id}`, () => setLocationSuggestionStatus(s.id, "rejected"), "Öneri reddedildi"), "Reddet")} />
            ))}
          </Panel>
        ) : null}

        {section === "messages" ? (
          // Platform GENELİ mesajlar (admin_recent_messages RPC) — adminin kendi kutusu DEĞİL.
          // Sayılar admin_message_stats'tan (gerçek). Arama, yüklenen son mesajlar içinde çalışır.
          <Panel
            title="Mesaj Moderasyonu"
            sub={msgStats
              ? `${fmtN(msgStats.conversations)} görüşme · ${fmtN(msgStats.messages)} mesaj (24s: ${fmtN(msgStats.messages_24h)}) · ${fmtN(msgStats.blocked_pairs)} engel · son ${modMessages.length} mesajda ${riskyMsgCount} riskli`
              : `Son ${modMessages.length} mesaj · ${riskyMsgCount} riskli`}
          >
            <AdminSearch value={msgQuery} onChange={setMsgQuery} placeholder="Mesaj, gönderen, alıcı veya ilan ara (son 100 mesaj)…" />
            <FilterChips value={msgFilter} onChange={setMsgFilter} options={[{ key: "all", label: "Tümü", count: msgRows.length }, { key: "risky", label: "Riskli", count: riskyMsgCount }]} />
            {shownMsgs.length === 0 ? <EmptyState icon="message-text-outline" title="Mesaj yok" body={mq ? "Aramaya uyan mesaj yok." : msgFilter === "risky" ? "Son mesajlarda riskli ifade bulunmuyor." : "Platformda henüz mesaj yok."} /> : null}
            <Table head={["GÖNDEREN → ALICI", "İLAN", "MESAJ", "DURUM"]} cols={[1.4, 1.5, 1.8, 1]}>
              {msgsPg.slice.map(({ m, risk }) => (
                <Row key={m.id} cols={[1.4, 1.5, 1.8, 1]} cells={[
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>{(m.sender_name ?? "—") + " → " + (m.receiver_name ?? "—")}</Text>,
                  m.listing_id ? <PressLink href={{ pathname: "/listing/[id]", params: { id: m.listing_id } }} style={{ justifyContent: "center", minHeight: isWideWeb ? 0 : 40 }}><Text numberOfLines={1} style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>{m.listing_title ?? "İlan"}</Text></PressLink> : <Text style={{ color: colors.muted, fontSize: 12 }}>—</Text>,
                  <Text numberOfLines={isWideWeb ? 1 : 4} style={{ color: risk ? colors.accent : colors.muted, fontSize: 12, fontWeight: risk ? "700" : "600", lineHeight: 17 }}>{m.body || "—"}</Text>,
                  risk ? <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.accentSoft, borderRadius: 999, flexDirection: "row", gap: 3, paddingHorizontal: 8, paddingVertical: 2 }}><MaterialCommunityIcons name="alert" size={11} color={colors.accent} /><Text style={{ color: colors.accent, fontSize: 10.5, fontWeight: "900" }}>{risk}</Text></View> : <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>Normal</Text>
                ]} />
              ))}
            </Table>
            <Pager {...msgsPg} />
          </Panel>
        ) : null}

        {section === "commissions" ? (() => {
          const totalShown = shownSales.reduce((a, s) => a + s.commissionAmount, 0);
          return (
          <Panel title="Komisyon Kayıtları" sub={`${shownSales.length} kayıt · toplam ${money(totalShown)} — OrtakSat para tutmaz; bu kayıtlar taraflar arası komisyon takibidir.`}>
            <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginBottom: 4 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {([["all", "Tümü"], ["pending", "Bekleyen"], ["approved", "Onaylı"], ["seller_paid", "Satıcı ödedi"], ["paid", "Ödendi"], ["disputed", "Anlaşmazlık"], ["cancelled", "İptal"]] as const).map(([k, lbl]) => {
                  const on = commFilter === k;
                  const c = k === "all" ? sales.length : sales.filter((s) => s.status === k).length;
                  return (
                    <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setCommFilter(k)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: isWideWeb ? 32 : 40, paddingHorizontal: 12 }}>
                      <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 11.5, fontWeight: "800" }}>{lbl} · {c}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <ExportButton
                filename={`komisyonlar-${commFilter}.csv`}
                headers={["İlan", "Komisyon", "Satış Tutarı", "Ortak", "Durum", "Adet", "İade Sonu", "Oluşturma"]}
                rows={shownSales.map((s) => {
                  const l = listings.find((x) => x.id === s.listingId);
                  const p = partnerships.find((x) => x.id === s.partnershipId);
                  return [l?.title ?? s.listingId, s.commissionAmount, s.amount, p ? findUser(p.partnerId)?.name ?? "" : "", SALE_TONE[s.status]?.label ?? s.status, s.quantity ?? 1, s.returnUntil ?? "", s.approvedAt ?? ""];
                })}
              />
            </View>
            {sales.filter((s) => s.status === "disputed").length > 0 ? (
              <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 10, flexDirection: "row", gap: 8, marginBottom: 10, padding: 11 }}>
                <MaterialCommunityIcons name="scale-balance" size={17} color={colors.accent} />
                <Text style={{ color: colors.accent, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{sales.filter((s) => s.status === "disputed").length} anlaşmazlık kaydı arabuluculuk bekliyor (en üstte).</Text>
              </View>
            ) : null}
            {shownSales.length === 0 ? <EmptyState icon="cash-multiple" title="Kayıt yok" body="Bu filtreye uygun komisyon kaydı bulunmuyor." /> : null}
            <Table head={["İLAN", "KOMİSYON", "ORTAKLIK", "ALICI ONAYI", "DURUM", "ARABULUCULUK"]} cols={[2, 1, 1.2, 1, 1, 1.4]}>
              {salesPg.slice.map((s) => {
                const listing = listings.find((l) => l.id === s.listingId);
                const p = partnerships.find((x) => x.id === s.partnershipId);
                const buyer = s.buyerConfirmedAt || s.buyerConfirmStatus === "confirmed"
                  ? { label: "Onaylı ✓", color: SUCCESS_INK }
                  : s.buyerConfirmStatus === "disputed"
                    ? { label: "İtiraz", color: colors.accent }
                    : s.buyerConfirmToken
                      ? { label: "Bekliyor", color: colors.muted }
                      : { label: "—", color: colors.subtle };
                return (
                  <Row key={s.id} cols={[2, 1, 1.2, 1, 1, 1.4]} cells={[
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{listing?.title ?? s.listingId}</Text>,
                    <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "900" }}>{money(s.commissionAmount)}</Text>,
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{p ? findUser(p.partnerId)?.name : "—"}</Text>,
                    <Text numberOfLines={1} style={{ color: buyer.color, fontSize: 11.5, fontWeight: "800" }}>{buyer.label}</Text>,
                    <View style={{ alignSelf: "flex-start", backgroundColor: SALE_TONE[s.status].tint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: SALE_TONE[s.status].color, fontSize: 10.5, fontWeight: "900" }}>{SALE_TONE[s.status].label}</Text></View>,
                    s.status === "disputed" ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: isWideWeb ? "flex-end" : "flex-start" }}>
                        <ActionButton tone="primary" icon="check" label="Çöz · Onayla" busy={busy[`sale:${s.id}`]} accessibilityLabel="Anlaşmazlığı çöz ve onayla" onPress={() => confirmAction("Anlaşmazlık çözülüp komisyon ONAYLANSIN mı?", () => void run(`sale:${s.id}`, () => updateSaleStatus(s.id, "approved"), "Anlaşmazlık çözüldü, komisyon onaylandı"), "Onayla")} />
                        <ActionButton tone="danger" icon="close" label="İptal" busy={busy[`sale:${s.id}`]} accessibilityLabel="Komisyonu iptal et" onPress={() => confirmAction("Bu komisyon kaydı İPTAL edilsin mi?", () => void run(`sale:${s.id}`, () => updateSaleStatus(s.id, "cancelled"), "Komisyon kaydı iptal edildi"), "İptal et")} />
                      </View>
                    ) : <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>—</Text>
                  ]} />
                );
              })}
            </Table>
            <Pager {...salesPg} />
          </Panel>
          );
        })() : null}

        {section === "records" ? (
          <View style={{ gap: 16 }}>
            <Panel title="Site Kayıtları" sub="Sitede olup ayrı bölümü olmayan varlıklar — operatör görsün/izlesin (son 30 kayıt, admin-gated RPC).">
              {!siteRecords ? <EmptyState title="Yükleniyor…" body="Site kayıtları çekiliyor." /> : (
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>
                  {`${fmtN(siteRecords.offers_count)} teklif · ${fmtN(siteRecords.reviews_count)} yorum · ${fmtN(siteRecords.questions_count)} soru · ${fmtN(siteRecords.leads_count)} talep · ${fmtN(siteRecords.partner_requests_count)} ortak-arayan`}
                </Text>
              )}
            </Panel>

            <Panel title="Teklifler" sub={siteRecords ? `${fmtN(siteRecords.offers_count)} toplam` : ""}>
              {(siteRecords?.offers ?? []).length === 0 ? <EmptyState icon="tag-outline" title="Teklif yok" body="Alıcı teklif verdikçe burada görünür." /> : (
                <Table head={["İLAN", "TUTAR", "DURUM", "TARİH"]} cols={[2, 1.4, 1, 1]}>
                  {(siteRecords?.offers ?? []).map((o) => (
                    <Row key={o.id} cols={[2, 1.4, 1, 1]} cells={[
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{String(o.listingId).slice(0, 8)}…</Text>,
                      <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{money(o.amount)}{o.counterAmount ? ` → ${money(o.counterAmount)}` : ""}</Text>,
                      <StatusBadge label={o.status} tone="neutral" />,
                      <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>{String(o.createdAt).slice(0, 10)}</Text>
                    ]} />
                  ))}
                </Table>
              )}
            </Panel>

            <Panel title="Yorumlar" sub={siteRecords ? `${fmtN(siteRecords.reviews_count)} aktif` : ""}>
              {(siteRecords?.reviews ?? []).length === 0 ? <EmptyState icon="star-outline" title="Yorum yok" body="Satış sonrası yorumlar burada görünür." /> : (
                <Table head={["İLAN", "PUAN", "YORUM", "DURUM"]} cols={[1.2, 0.9, 2.4, 1]}>
                  {(siteRecords?.reviews ?? []).map((r) => (
                    <Row key={r.id} cols={[1.2, 0.9, 2.4, 1]} cells={[
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{String(r.listingId).slice(0, 8)}…</Text>,
                      <Text style={{ color: colors.gold, fontSize: 12.5, fontWeight: "800" }}>{"★".repeat(Math.max(0, Math.min(5, Math.round(r.rating))))}</Text>,
                      <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}>{r.comment || "—"}</Text>,
                      <View style={{ alignSelf: "flex-start" }}><ActionButton tone={r.deleted ? "success" : "danger"} icon={r.deleted ? "eye-outline" : "eye-off-outline"} label={r.deleted ? "Geri al" : "Gizle"} busy={busy[`rev:${r.id}`]} onPress={() => modReview(r.id, !r.deleted)} /></View>
                    ]} />
                  ))}
                </Table>
              )}
            </Panel>

            <Panel title="İlan Soru-Cevap" sub={siteRecords ? `${fmtN(siteRecords.questions_count)} soru` : ""}>
              {(siteRecords?.questions ?? []).length === 0 ? <EmptyState icon="comment-question-outline" title="Soru yok" body="Alıcı ilanlara soru sordukça burada görünür." /> : (
                <Table head={["SORAN", "SORU", "CEVAP", "AKSİYON"]} cols={[1, 2, 1.6, 0.9]}>
                  {(siteRecords?.questions ?? []).map((q) => (
                    <Row key={q.id} cols={[1, 2, 1.6, 0.9]} cells={[
                      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{q.askerName || "—"}</Text>,
                      <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}>{q.question}</Text>,
                      <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{q.answer || "yanıtsız"}</Text>,
                      <View style={{ alignSelf: "flex-start" }}><ActionButton tone="danger" icon="trash-can-outline" label="Sil" busy={busy[`q:${q.id}`]} onPress={() => delQuestion(q.id)} /></View>
                    ]} />
                  ))}
                </Table>
              )}
            </Panel>

            <Panel title="Talepler (Lead)" sub={siteRecords ? `${fmtN(siteRecords.leads_count)} toplam` : ""}>
              {(siteRecords?.leads ?? []).length === 0 ? <EmptyState icon="account-search-outline" title="Talep yok" body="Alıcı talepleri (ürün ilgisi) burada görünür." /> : (
                <Table head={["İLAN", "ALICI", "KAYNAK", "DURUM"]} cols={[1.2, 1.2, 1, 1]}>
                  {(siteRecords?.leads ?? []).map((l) => (
                    <Row key={l.id} cols={[1.2, 1.2, 1, 1]} cells={[
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{String(l.listingId).slice(0, 8)}…</Text>,
                      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}>{l.buyerName || "—"}</Text>,
                      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{l.source || l.intent || "—"}</Text>,
                      <StatusBadge label={l.status} tone="neutral" />
                    ]} />
                  ))}
                </Table>
              )}
            </Panel>

            <Panel title="Ortak Aranıyor Talepleri" sub={siteRecords ? `${fmtN(siteRecords.partner_requests_count)} toplam` : ""}>
              {(siteRecords?.partner_requests ?? []).length === 0 ? <EmptyState icon="bullhorn-variant-outline" title="Talep yok" body="Satıcı 'ürünüme ortak arıyorum' talepleri burada görünür." /> : (
                <Table head={["BAŞLIK", "KATEGORİ", "KOMİSYON", "AKSİYON"]} cols={[2, 1.2, 1, 1]}>
                  {(siteRecords?.partner_requests ?? []).map((p) => (
                    <Row key={p.id} cols={[2, 1.2, 1, 1]} cells={[
                      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{p.title}</Text>,
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{p.category || "—"}</Text>,
                      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{p.commissionHint || "—"}</Text>,
                      p.status === "closed" ? <StatusBadge label="Kapalı" tone="neutral" /> : (
                        <View style={{ alignSelf: "flex-start" }}><ActionButton tone="warning" icon="close-circle-outline" label="Kapat" busy={busy[`pr:${p.id}`]} onPress={() => closePR(p.id)} /></View>
                      )
                    ]} />
                  ))}
                </Table>
              )}
            </Panel>
          </View>
        ) : null}

        {section === "stats" ? (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              <Stat icon="account-group" tint={colors.primarySoft} color={colors.primary} value={fmtN(analytics?.total_users ?? users.length)} title="Kullanıcı" />
              <Stat icon="file-document" tint={colors.primarySoft} color={colors.primary} value={fmtN(analytics?.listings_active ?? activeListings.length)} title="Aktif ilan" />
              <Stat icon="handshake" tint={colors.primarySoft} color={colors.primary} value={fmtN(analytics?.partnerships_total ?? partnerships.length)} title="Ortaklık" />
              <Stat icon="cart-check" tint={colors.primarySoft} color={colors.primary} value={fmtN(analytics?.commissions_total ?? sales.length)} title="Komisyon kaydı" />
              <Stat icon="account-clock" tint={colors.primarySoft} color={colors.primary} value={overview ? fmtN(overview.leads_total) : "—"} title="Talep (lead)" helper={overview ? "sunucu toplamı" : "veri yok"} />
              <Stat icon="cash-multiple" tint={colors.primarySoft} color={colors.primary} value={analytics ? money(analytics.gmv) : overview ? money(overview.gmv) : "—"} title="Toplam GMV" helper="sipariş tutarı (sunucu)" />
              <Stat icon="check-decagram" tint={colors.primarySoft} color={colors.primary} value={`${users.filter((u) => u.verifiedPhone || u.verifiedIdentity).length}`} title="Doğrulanmış (yüklü)" />
              <Stat icon="star" tint={colors.primarySoft} color={colors.primary} value={`${listings.filter((l) => l.featured).length}`} title="Öne çıkan (yüklü)" />
              <Stat icon="map-marker" tint={colors.primarySoft} color={colors.primary} value={`${new Set(activeListings.map((l) => l.location)).size}`} title="Şehir (yüklü)" />
              <Stat icon="cash-clock" tint={colors.goldSoft} color={colors.goldInk} value={money(analytics ? Math.max(0, analytics.commission_amount - analytics.commission_paid_amount) : unpaidCommission)} title="Bekleyen komisyon" />
              <Stat icon="account-check" tint={colors.successSoft} color={SUCCESS_INK} value={`${buyerConfirmedN}`} title="Alıcı onaylı satış" />
              <Stat icon="account-clock-outline" tint={colors.primarySoft} color={colors.primary} value={`${buyerAwaitingN}`} title="Alıcı onayı bekleyen" />
            </View>
            <ServerTrendCard ts={ts} />
            <Panel title="Aylık İlan Trendi" sub="Son 12 ay — yüklü kayıtlardan (sunucu toplamları için Canlı Panel)">
              <ResponsiveLineArea points={chartData.map((v, i) => ({ label: chartLabels[i] ?? `${i + 1}`, value: v }))} color={colors.primary} height={210} />
            </Panel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              <TopSellersCard ts={ts} />
              <View style={{ flexBasis: 300, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                <Panel title="En Çok Kazanan Ortaklar" sub="Kayıtlı komisyona göre ilk 6">
                  {topPartners.length === 0 ? <EmptyState title="Veri yok" body="Henüz komisyon kaydı yok." /> : <HBarChart rank data={topPartners.map((r) => ({ label: r.label, value: r.count }))} valueFmt={fmtMoney} />}
                </Panel>
              </View>
              <RootCategoryCard ts={ts} />
              <View style={{ flexBasis: 300, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                <Panel title="Şehir Dağılımı" sub="Aktif ilana göre ilk 8 şehir">
                  {cityDist.length === 0 ? <EmptyState title="Veri yok" body="Aktif ilan yok." /> : <HBarChart rank data={cityDist.map((r) => ({ label: r.label, value: r.count }))} valueFmt={(n) => `${Math.round(n)}`} />}
                </Panel>
              </View>
            </View>
          </View>
        ) : null}

        {section === "notifications" ? (
          <View style={{ gap: 16 }}>
          {/* DÜZELTİLDİ (P0): Duyuru eskiden bildirim satırlarını istemcideki `users`
              dizisinden (bellek penceresi, ≤1000) üretiyordu → "tüm kullanıcılara"
              aslında en fazla 1000 kişiye ulaşıyordu. Artık sunucu RPC'si TÜM
              profillere yazar ve ULAŞAN GERÇEK SAYIYI döndürür. */}
          {canManageUsers ? (
            <Panel title="Duyuru Gönder" sub={overview ? `${Math.max(0, overview.users_total - 1)} kullanıcıya (askıya alınanlar hariç) — sunucu taraflı, sınırsız` : "Tüm kayıtlı kullanıcılara bildirim gönder"}>
              <View style={{ gap: 10 }}>
                <TextInput value={bcTitle} onChangeText={setBcTitle} placeholder="Başlık (ör. Yeni özellik!)" placeholderTextColor={colors.muted} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 42, paddingHorizontal: 12 }} />
                <TextInput value={bcBody} onChangeText={setBcBody} placeholder="Mesaj metni" placeholderTextColor={colors.muted} multiline style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 64, paddingHorizontal: 12, paddingVertical: 10 }} />
                {bcResult ? <Text style={{ color: bcResult.startsWith("!") ? colors.accent : SUCCESS_INK, fontSize: 12.5, fontWeight: "800" }}>{bcResult.replace(/^!/, "")}</Text> : null}
                <Pressable
                  disabled={!bcTitle.trim() || !bcBody.trim() || bcSending}
                  onPress={() => confirmAction(
                    `Duyuru ${overview ? Math.max(0, overview.users_total - 1) : "tüm"} kullanıcıya gönderilsin mi? Bu işlem geri alınamaz.`,
                    () => {
                      setBcSending(true);
                      setBcResult(null);
                      void adminBroadcastLive(bcTitle.trim(), bcBody.trim())
                        .then((n) => {
                          setBcSending(false);
                          if (n == null) { setBcResult("!Duyuru gönderilemedi. Tekrar dene."); return; }
                          setBcResult(`Duyuru ${n} kullanıcıya gönderildi.`);
                          setBcTitle("");
                          setBcBody("");
                        })
                        .catch(() => { setBcSending(false); setBcResult("!Duyuru gönderilemedi. Tekrar dene."); });
                    }
                  )}
                  style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: bcTitle.trim() && bcBody.trim() && !bcSending ? colors.primary : colors.line, borderRadius: 10, flexDirection: "row", gap: 7, minHeight: 42, paddingHorizontal: 18, paddingVertical: 11 }}
                >
                  <MaterialCommunityIcons name="bullhorn-outline" size={16} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{bcSending ? "Gönderiliyor…" : "Tümüne gönder"}</Text>
                </Pressable>
              </View>
            </Panel>
          ) : null}
          <Panel title="Bildirimler" sub={`${notifications.length} kayıt`}>
            {notifications.slice(0, 30).map((n) => (
              <View key={n.id} style={{ borderBottomColor: colors.line, borderBottomWidth: 1, gap: 2, paddingVertical: 11 }}>
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{n.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{n.body}</Text>
                <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{n.createdAt}</Text>
              </View>
            ))}
            {notifications.length === 0 ? <EmptyState icon="bell-outline" title="Bildirim yok" body="Sistem bildirimi bulunmuyor." /> : null}
          </Panel>
          </View>
        ) : null}

        {section === "content" ? (
          <ContentManager pages={contentPages} onSave={saveContentPage} />
        ) : null}

        {section === "blog" ? (
          <BlogManager posts={blogPosts} onSave={saveBlogPost} onDelete={deleteBlogPost} confirmAction={confirmAction} />
        ) : null}

        {section === "seo" ? (
          <SeoManager settings={seoSettings} onSave={saveSeoSetting} />
        ) : null}

        {section === "settings" && !canManageUsers ? (
          <Panel title="Ayarlar" sub="Yalnızca admin">
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>Site duyurusu ve platform ayarları yalnızca admin hesaplarına açıktır (sen moderatörsün). Bu değişiklikler moderatör rolüyle uygulanmaz.</Text>
          </Panel>
        ) : null}
        {section === "settings" && canManageUsers ? (
          <View style={{ gap: 16 }}>
          <Panel title="Site Duyurusu" sub="Tüm sayfaların üstünde çıkan duyuru banner'ı">
            <View style={{ gap: 10 }}>
              <TextInput value={annText} onChangeText={setAnnText} placeholder="Duyuru metni (ör. Bayrama özel: ilan vermek ücretsiz!)" placeholderTextColor={colors.muted} multiline style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 56, paddingHorizontal: 12, paddingVertical: 10 }} />
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                <Pressable accessibilityRole="button" disabled={!annText.trim()} onPress={() => confirmAction("Duyuru tüm sayfaların üstünde YAYINLANSIN mı?", () => void run("ann", () => setAnnouncement(annText, true), "Duyuru yayınlandı"), "Yayınla")} style={{ opacity: annText.trim() ? 1 : 0.5, alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, minHeight: 42, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <MaterialCommunityIcons name="bullhorn-outline" size={15} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Yayınla</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void run("ann", () => setAnnouncement(annText, false), "Duyuru kapatıldı")} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, minHeight: 42, paddingHorizontal: 16, paddingVertical: 9 }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>Kapat</Text>
                </Pressable>
                <View style={{ alignItems: "center", backgroundColor: platformSettings.announcementActive ? colors.successSoft : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: platformSettings.announcementActive ? SUCCESS_INK : colors.muted, fontSize: 11, fontWeight: "900" }}>{platformSettings.announcementActive ? "YAYINDA" : "Kapalı"}</Text>
                </View>
              </View>
            </View>
          </Panel>
          <Panel title="Ayarlar" sub="Platform genel ayarları — anında kaydedilir ve tüm siteye uygulanır">
            {([
              { key: "allowSignups", label: "Yeni kayıtlara izin ver", desc: "Kapalıyken yeni hesap kaydı engellenir.",
                riskyAt: false, warn: "Yeni kayıtları KAPATIYORSUN. Siteye hiç kimse yeni hesap açamayacak. Devam edilsin mi?" },
              { key: "reviewBeforePublish", label: "İlanları yayından önce incele", desc: "Açıkken yeni ilanlar önce onaya (incelemeye) düşer.",
                riskyAt: true, warn: "Ön inceleme AÇILIYOR. Bundan sonra ilanlar anında yayınlanmaz, sen onaylayana kadar bekler. Devam edilsin mi?" },
              { key: "requireEmailVerification", label: "E-posta doğrulama zorunlu", desc: "Açıkken doğrulanmamış e-posta ile ilan verme sınırlanır.",
                riskyAt: true, warn: "E-posta doğrulama ZORUNLU olacak. Doğrulamamış kullanıcılar ilan veremez. Devam edilsin mi?" },
              { key: "maintenanceMode", label: "Bakım modu", desc: "Açıkken tüm sayfalarda üstte bakım uyarısı görünür.",
                riskyAt: true, warn: "BAKIM MODU açılıyor. Siteye giren HERKES üstte bakım uyarısı görecek. Devam edilsin mi?" }
            ] as Array<{ key: keyof typeof platformSettings; label: string; desc: string; riskyAt: boolean; warn: string }>).map((s) => {
              const on = platformSettings[s.key];
              // Ayarlar anında CANLI siteye uygulanıyor. Riskli yönde (bakım aç, kayıtları kapat…)
              // yanlışlıkla dokunma tüm ziyaretçileri etkilerdi — o yönde onay iste.
              const toggle = () => {
                const next = !on;
                if (next === s.riskyAt) confirmAction(s.warn, () => void run(`set:${s.key}`, () => updatePlatformSetting(s.key, next), "Ayar uygulandı"), "Evet, uygula");
                else void run(`set:${s.key}`, () => updatePlatformSetting(s.key, next), "Ayar uygulandı");
              };
              return (
                <View key={s.key} style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingVertical: 13 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{s.label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 15 }}>{s.desc}</Text>
                  </View>
                  <Pressable accessibilityRole="switch" accessibilityLabel={s.label} accessibilityState={{ checked: !!on }} testID={`setting-${s.key}`} hitSlop={8} disabled={!!busy[`set:${s.key}`]} onPress={toggle} style={{ alignItems: on ? "flex-end" : "flex-start", backgroundColor: on ? colors.primary : colors.line, borderRadius: 999, height: 32, justifyContent: "center", opacity: busy[`set:${s.key}`] ? 0.5 : 1, paddingHorizontal: 3, width: 56 }}>
                    <View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 26, width: 26 }} />
                  </Pressable>
                </View>
              );
            })}
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", marginTop: 8 }}>Değişiklikler Supabase'e kaydedilir ve tüm ziyaretçilere anında yansır.</Text>
          </Panel>
          </View>
        ) : null}

        {section === "reports" ? (
          <View style={{ gap: 16 }}>
            {/* AKTİVİTE ÖZETİ — ham logdan türetilen aksiyon-tipi dağılımı (ham döküm değil, RAPOR). */}
            <Panel title="Aktivite özeti" sub={audit ? `Son ${audit.logs.length} olay · son 1 saatte ${audit.rateHits} hız-limiti olayı` : "yükleniyor / erişim yok"}>
              {!audit || audit.logs.length === 0 ? (
                <EmptyState icon="chart-timeline-variant" title="Aktivite yok" body="Kullanıcılar giriş yapıp işlem yaptıkça aksiyon dağılımı burada canlanır." />
              ) : (() => {
                const counts: Record<string, number> = {};
                for (const a of audit.logs) counts[a.action] = (counts[a.action] ?? 0) + 1;
                const rows = Object.entries(counts).sort((x, y) => y[1] - x[1]);
                const max = rows[0]?.[1] ?? 1;
                return (
                  <View style={{ gap: 10 }}>
                    {rows.map(([action, n]) => (
                      <View key={action} style={{ gap: 5 }}>
                        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{ACTION_LABEL[action] ?? action}</Text>
                          <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{n}</Text>
                        </View>
                        <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 8, overflow: "hidden" }}>
                          <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: "100%", width: `${Math.max(4, Math.round((n / max) * 100))}%` }} />
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </Panel>
            <Panel title="Denetim Kaydı (activity_logs)" sub={audit ? `${audit.logs.length} son kayıt · son 1 saatte ${audit.rateHits} hız-limiti olayı` : "yükleniyor / erişim yok"}>
              {!audit ? (
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", paddingVertical: 8 }}>Denetim kaydı yüklenemedi (admin değilsen veya henüz kayıt yoksa boş görünür).</Text>
              ) : audit.logs.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", paddingVertical: 8 }}>Henüz denetim kaydı yok. Kullanıcılar giriş yapıp işlem yaptıkça burada görünür.</Text>
              ) : (
                <Table head={["ZAMAN", "AKSİYON", "TİP", "KAYIT"]} cols={[1.4, 1.6, 1, 1.6]}>
                  {auditPg.slice.map((a) => (
                    <Row key={a.id} cols={[1.4, 1.6, 1, 1.6]} cells={[
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{a.createdAt}</Text>,
                      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{ACTION_LABEL[a.action] ?? a.action}</Text>,
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{a.entityType ?? "—"}</Text>,
                      <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{a.entityId ? a.entityId.slice(0, 12) : "—"}</Text>
                    ]} />
                  ))}
                </Table>
              )}
              {audit && audit.logs.length ? <Pager {...auditPg} /> : null}
            </Panel>
          </View>
        ) : null}
      </ScrollView>

      {/* Mobil yönetim menüsü: tüm bölümleri tek yatay şeride sıkıştırmak yerine
          gruplu, okunabilir ve rozetli bir çekmece içinde gösterir. */}
      <Modal visible={!isWideWeb && adminNavOpen} transparent animationType="fade" onRequestClose={() => setAdminNavOpen(false)}>
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ backgroundColor: colors.surface, maxWidth: 340, width: "86%", shadowColor: colors.primaryDark, shadowOffset: { width: 8, height: 0 }, shadowOpacity: 0.18, shadowRadius: 22 }}>
            <View style={{ backgroundColor: colors.primaryDark, gap: 12, paddingBottom: 14, paddingHorizontal: 16, paddingTop: 18 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 11, height: 38, justifyContent: "center", width: 38 }}>
                  <MaterialCommunityIcons name="shield-crown" size={21} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "900" }}>OrtakSat Yönetim</Text>
                  <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.68)", fontSize: 11, fontWeight: "700" }}>{currentUser.name || "Yönetici"} · {currentUser.role === "super_admin" ? "Süper Admin" : currentUser.role === "moderator" ? "Moderatör" : "Admin"}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Yönetim menüsünü kapat" onPress={() => setAdminNavOpen(false)} style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}>
                  <MaterialCommunityIcons name="close" size={23} color="#FFFFFF" />
                </Pressable>
              </View>
              <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 10, paddingVertical: 8 }}>
                <View style={{ backgroundColor: colors.success, borderRadius: 999, height: 8, width: 8 }} />
                <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>Yetkili yönetim oturumu</Text>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 4, padding: 12, paddingBottom: 30 }}>
              {NAV_GROUPS.map((group) => (
                <View key={group.title} style={{ gap: 3, marginBottom: 8 }}>
                  <Text style={{ color: colors.subtle, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.7, paddingHorizontal: 10, paddingVertical: 7 }}>{group.title.toLocaleUpperCase("tr-TR")}</Text>
                  {group.items.map((item) => {
                    const on = item.key === section;
                    const badge = navBadge(item.key);
                    return (
                      <Pressable
                        key={item.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => selectSection(item.key)}
                        style={({ pressed }) => ({ alignItems: "center", backgroundColor: on ? colors.primarySoft : pressed ? colors.surfaceAlt : "transparent", borderColor: on ? colors.primary : "transparent", borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 11, minHeight: 46, paddingHorizontal: 11 })}
                      >
                        <MaterialCommunityIcons name={item.icon} size={19} color={on ? colors.primary : colors.muted} />
                        <Text style={{ color: on ? colors.primaryDark : colors.ink, flex: 1, fontSize: 13, fontWeight: on ? "900" : "700" }}>{item.label}</Text>
                        {badge ? <View style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 999, height: 19, justifyContent: "center", minWidth: 19, paddingHorizontal: 5 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{badge}</Text></View> : null}
                        <MaterialCommunityIcons name="chevron-right" size={17} color={on ? colors.primary : colors.subtle} />
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              <Pressable onPress={() => { setAdminNavOpen(false); void signOut(); router.replace("/"); }} style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 11, flexDirection: "row", gap: 10, marginTop: 4, minHeight: 46, paddingHorizontal: 12 }}>
                <MaterialCommunityIcons name="logout" size={19} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "900" }}>Çıkış Yap</Text>
              </Pressable>
            </ScrollView>
          </View>
          <Pressable accessibilityLabel="Yönetim menüsünü kapat" onPress={() => setAdminNavOpen(false)} style={{ backgroundColor: "rgba(9,39,94,0.42)", flex: 1 }} />
        </View>
      </Modal>

      {/* "Şimdi sil" GÜÇLÜ onay: geri alınamaz kalıcı anonimleştirme → yazılı onay ("SİL") olmadan çalışmaz. */}
      <Modal visible={deleteNowTarget !== null} transparent animationType="fade" onRequestClose={() => setDeleteNowTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Pressable accessibilityLabel="Kapat" onPress={() => setDeleteNowTarget(null)} style={{ alignItems: "center", backgroundColor: "rgba(9,39,94,0.5)", flex: 1, justifyContent: "center", padding: 16 }}>
            <Pressable onPress={() => undefined} style={{ backgroundColor: colors.surface, borderRadius: 16, gap: 12, maxHeight: "90%", maxWidth: 460, padding: 16, width: "100%" }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
                <MaterialCommunityIcons name="alert-octagon-outline" size={22} color={colors.accent} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>Hesabı şimdi kalıcı sil</Text>
              </View>
              <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700", lineHeight: 20 }}>{deleteNowTarget?.name || "Bu kullanıcı"}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>Ad, telefon, profil fotoğrafı, e-posta ve giriş bilgileri silinir; ilanlar arşivlenir ve bu hesapla bir daha giriş yapılamaz. Satış, komisyon ve mesaj geçmişi anonim profile bağlı kalır. Bu işlem GERİ ALINAMAZ; 30 günlük süre beklenmeden uygulanır.</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Onaylamak için SİL yaz</Text>
              <TextInput
                accessibilityLabel="Onaylamak için SİL yaz"
                value={deleteNowText}
                onChangeText={setDeleteNowText}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                maxLength={8}
                placeholder="SİL"
                placeholderTextColor={colors.subtle}
                style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 46, paddingHorizontal: 12 }}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
                <ActionButton tone="neutral" label="Vazgeç" onPress={() => setDeleteNowTarget(null)} />
                <ActionButton
                  tone="danger"
                  icon="trash-can-outline"
                  label="Kalıcı sil"
                  disabled={!["SİL", "SIL", "sil", "Sil"].includes(deleteNowText.trim())}
                  onPress={() => {
                    const target = deleteNowTarget;
                    if (!target || !["SİL", "SIL", "sil", "Sil"].includes(deleteNowText.trim())) return;
                    setDeleteNowTarget(null);
                    setDeleteNowText("");
                    void resolveAccountDeletion(target, "delete_now");
                  }}
                />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Kullanıcıya bildirim gönder — her iki platformda çalışan gerçek metin kutusu
          (eskiden web'de window.prompt, NATIVE'de hiç girdi alınmadan sabit metin). */}
      <Modal visible={notifyTarget !== null} transparent animationType="fade" onRequestClose={() => setNotifyTarget(null)}>
        {/* RN Modal ebeveynin KeyboardAvoidingView'ını miras almaz → kendi KAV'ı (gönder butonu klavye altında kalmasın). */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Pressable accessibilityLabel="Kapat" onPress={() => setNotifyTarget(null)} style={{ alignItems: "center", backgroundColor: "rgba(9,39,94,0.5)", flex: 1, justifyContent: "center", padding: 16 }}>
            <Pressable onPress={() => undefined} style={{ backgroundColor: colors.surface, borderRadius: 16, gap: 12, maxHeight: "90%", maxWidth: 460, padding: 16, width: "100%" }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{notifyTarget?.name} kullanıcısına bildirim</Text>
              <TextInput
                value={notifyText}
                onChangeText={setNotifyText}
                multiline
                autoFocus
                maxLength={500}
                placeholder="Mesajın…"
                placeholderTextColor={colors.subtle}
                style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 16, maxHeight: 180, minHeight: 96, padding: 12, textAlignVertical: "top" }}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
                <ActionButton tone="neutral" label="Vazgeç" onPress={() => setNotifyTarget(null)} />
                <ActionButton
                  tone="primary"
                  icon="send"
                  label="Gönder"
                  disabled={!notifyText.trim()}
                  onPress={() => {
                    const t = notifyTarget;
                    if (!t || !notifyText.trim()) return;
                    const body = notifyText.trim();
                    setNotifyTarget(null);
                    setNotifyText("");
                    void run(`ntf:${t.id}`, () => adminNotifyUser(t.id, "OrtakSat Yönetimi", body), "Bildirim gönderildi");
                  }}
                />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
    </AdminWideCtx.Provider>
  );
}

// Şikayet henüz işlem bekliyor mu (açık/incelemede).
function isOpenReport(r: { status: string }) {
  return r.status === "open" || r.status === "reviewing";
}

// Yıkıcı işlem onayı — markalı uygulama-içi diyalog (Alert web'de AlertHost'a gider).
function confirmAction(message: string, onYes: () => void, yesLabel = "Evet") {
  Alert.alert("Onay", message, [
    { text: "Vazgeç", style: "cancel" },
    { text: yesLabel, style: "destructive", onPress: onYes }
  ]);
}

// ---- pieces --------------------------------------------------------------
type StoreT = ReturnType<typeof useStore>;

// Üst başlık: bölüm adı + açık iş sayısı. Sayı yalnız SUNUCU analitiğinden; yoksa "—".
function DashHero({ analytics, disputedN, name }: { analytics: AdminAnalytics | null; disputedN: number; name?: string }) {
  const wide = useContext(AdminWideCtx);
  const openWork = analytics ? analytics.listings_pending + analytics.open_reports + analytics.partnerships_pending + analytics.cat_suggestions + analytics.loc_suggestions + disputedN : null;
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.primaryDark, borderRadius: 18, flexDirection: "row", flexWrap: "wrap", gap: 14, justifyContent: "space-between", padding: wide ? 22 : 16 }}>
      <View style={{ flexBasis: 220, flexGrow: 1, flexShrink: 1, gap: 4, minWidth: 0 }}>
        <Text style={{ color: "#FFFFFF", fontSize: wide ? 26 : 21, fontWeight: "900", letterSpacing: -0.5 }}>Yönetim Merkezi</Text>
        <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "600", lineHeight: 19 }}>
          {name ? `Hoş geldin ${name}. ` : ""}Canlı sayılar, bekleyen işler ve moderasyon tek ekranda.
        </Text>
      </View>
      <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.18)", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
        <MaterialCommunityIcons name={openWork ? "alert-circle-outline" : "check-decagram-outline"} size={20} color="#FFFFFF" />
        <View>
          <Text style={{ color: "#FFFFFF", fontSize: 19, fontVariant: ["tabular-nums"], fontWeight: "900", letterSpacing: -0.3 }}>{openWork == null ? "—" : fmtN(openWork)}</Text>
          <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 11.5, fontWeight: "700" }}>açık iş</Text>
        </View>
      </View>
    </View>
  );
}

type DashProps = {
  listings: StoreT["listings"]; users: StoreT["users"]; notifications: StoreT["notifications"];
  pendingN: number; reportsN: number; pendingCat: number; pendingLoc: number; disputedN: number;
  setSection: (s: Section) => void;
  analytics: AdminAnalytics | null;
  overview: AdminOverview | null;
  ts: AdminTsState;
};
function Dashboard({ listings, users, notifications, pendingN, reportsN, pendingCat, pendingLoc, disputedN, setSection, analytics, overview, ts }: DashProps) {
  // Oranlar SUNUCU toplamlarından (admin_live_analytics + admin_overview). Sunucu verisi yoksa "—".
  const totalListings = analytics?.listings_total ?? overview?.listings_total ?? null;
  const activeListings = analytics?.listings_active ?? overview?.listings?.active ?? null;
  const publishRate = totalListings && activeListings != null ? Math.round((activeListings / totalListings) * 100) : null;
  const leadsTotal = overview?.leads_total ?? null;
  const ordersTotal = analytics?.orders_total ?? overview?.orders_total ?? null;
  const conversion = leadsTotal && ordersTotal != null ? Math.round((ordersTotal / leadsTotal) * 100) : null;
  const reportsTotal = overview?.reports_total ?? null;
  const reportsOpen = analytics?.open_reports ?? overview?.reports_open ?? null;
  const resolution = reportsTotal && reportsOpen != null ? Math.round(((reportsTotal - reportsOpen) / reportsTotal) * 100) : null;
  const pendingComm = analytics ? (Number.isFinite(analytics.commission_pending_amount) ? analytics.commission_pending_amount : Math.max(0, analytics.commission_amount - analytics.commission_paid_amount)) : null;
  const recentUsers = sortByDate(users.filter((u) => u.status !== "deleted" && !!u.createdAt), "createdAt").slice(0, 5);
  const recentListings = sortByDate(listings, "createdAt").slice(0, 6);
  const listingStatusData = listingStatusStats(listings);
  const priorities = [
    { label: "Onay bekleyen ilan", value: pendingN, icon: "clock-alert-outline" as const, tone: colors.gold, go: "listings" as Section, helper: "Yayına alınmayı bekliyor" },
    { label: "Açık şikayet", value: reportsN, icon: "flag-outline" as const, tone: colors.accent, go: "complaints" as Section, helper: "Kullanıcı güveni için öncelikli" },
    { label: "Öneri kuyruğu", value: pendingCat + pendingLoc, icon: "shape-plus" as const, tone: colors.primary, go: pendingCat ? "categories" as Section : "locations" as Section, helper: "Kategori ve konum önerileri" }
  ];

  return (
    <View style={{ gap: 16 }}>
      {/* Sunucu analitiği gelmediyse (hata) bekleyen işler yüklü kayıtlardan gösterilir. */}
      {!analytics ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {priorities.map((p) => <PriorityCard key={p.label} {...p} onPress={() => setSection(p.go)} />)}
        </View>
      ) : null}

      <ServerTrendCard ts={ts} />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <RootCategoryCard ts={ts} />
        <TopSellersCard ts={ts} />
      </View>

      <Panel title="Operasyon Sağlığı" sub="Sunucu toplamlarından hesaplanan oranlar">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <HealthCard label="Yayın oranı" value={publishRate == null ? "—" : `%${publishRate}`} detail={totalListings != null && activeListings != null ? `${fmtN(activeListings)}/${fmtN(totalListings)} ilan yayında` : "veri yok"} tone={publishRate == null ? "neutral" : publishRate >= 70 ? "success" : publishRate >= 40 ? "warning" : "accent"} />
          <HealthCard label="Talep → sipariş" value={conversion == null ? "—" : `%${conversion}`} detail={leadsTotal != null && ordersTotal != null ? `${fmtN(ordersTotal)} sipariş / ${fmtN(leadsTotal)} talep` : "veri yok"} tone="neutral" />
          <HealthCard label="Şikayet çözümü" value={resolution == null ? "—" : `%${resolution}`} detail={reportsTotal != null && reportsOpen != null ? `${fmtN(reportsTotal - reportsOpen)}/${fmtN(reportsTotal)} kayıt kapanmış` : reportsTotal === 0 ? "şikayet yok" : "veri yok"} tone={resolution == null ? "neutral" : resolution >= 85 ? "success" : resolution >= 55 ? "warning" : "accent"} />
          <HealthCard label="Bekleyen komisyon" value={pendingComm == null ? "—" : money(pendingComm)} detail={`${disputedN} anlaşmazlık (yüklü kayıtlarda)`} tone={disputedN ? "accent" : pendingComm ? "warning" : pendingComm == null ? "neutral" : "success"} />
        </View>
      </Panel>

      <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <View style={{ flexBasis: 420, flexGrow: 2, flexShrink: 1, gap: 16, minWidth: 0 }}>
          <Panel title="Son Eklenen İlanlar" sub="En yeni kayıtlar ve yayın durumları">
            {recentListings.length === 0 ? <EmptyState title="İlan yok" body="Yeni ilanlar geldiğinde burada görünür." /> : (
              <Table head={["İLAN", "KATEGORİ", "FİYAT", "DURUM"]} cols={[2.2, 1.2, 1, 1]}>
                {recentListings.map((l) => (
                  <Row key={l.id} cols={[2.2, 1.2, 1, 1]} cells={[
                    <PressLink href={{ pathname: "/listing/[id]", params: { id: l.id } }} style={{ justifyContent: "center" }}><Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{l.title}</Text></PressLink>,
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{l.category}</Text>,
                    <Text style={{ color: colors.ink, fontSize: 12.5, fontVariant: ["tabular-nums"], fontWeight: "700" }}>{money(l.price)}</Text>,
                    <StatusBadge label={listingStatusLabel(l.status)} tone={l.status === "active" ? "success" : l.status === "rejected" ? "accent" : l.status === "pending_review" ? "warning" : "neutral"} />
                  ]} />
                ))}
              </Table>
            )}
            <View style={{ alignSelf: "flex-start", paddingTop: 10 }}><ActionButton tone="soft" icon="file-document-outline" label="Tüm ilanları yönet" onPress={() => setSection("listings")} /></View>
          </Panel>
          <Panel title="Yüklü İlanların Durumu" sub={`${fmtN(listings.length)} yüklü kayıt${totalListings != null ? ` / ${fmtN(totalListings)} sunucu` : ""}`}>
            {listingStatusData.every((d) => d.value === 0) ? <NoData text="Henüz ilan yok." /> : <DonutChart data={listingStatusData} size={150} centerTop={fmtN(listings.length)} centerBottom="yüklü ilan" />}
          </Panel>
        </View>
        <View style={{ flexBasis: 280, flexGrow: 1, flexShrink: 1, gap: 16, minWidth: 0 }}>
          <Panel title="Hızlı İşlemler" sub="Sık kullanılan yönetim ekranları">
            <View style={{ gap: 8 }}>
              {[
                { label: "İlan onay kuyruğu", body: `${pendingN} bekleyen`, icon: "playlist-check" as const, go: "listings" as Section },
                { label: "Şikayetleri incele", body: `${reportsN} açık kayıt`, icon: "shield-alert-outline" as const, go: "complaints" as Section },
                { label: "Ortaklık talepleri", body: analytics ? `${analytics.partnerships_pending} başvuru` : "Başvuruları aç", icon: "handshake-outline" as const, go: "partnerships" as Section },
                { label: "Komisyon kayıtları", body: `${disputedN} anlaşmazlık`, icon: "cash-multiple" as const, go: "commissions" as Section },
                { label: "Raporlar ve denetim", body: "Aktivite ve denetim kaydı", icon: "chart-box-outline" as const, go: "reports" as Section }
              ].map((k) => (
                <Pressable key={k.label} accessibilityRole="button" onPress={() => setSection(k.go)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.primarySoft : colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 52, padding: 12 })}>
                  <MaterialCommunityIcons name={k.icon} size={20} color={colors.primary} />
                  <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "900" }}>{k.label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{k.body}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={16} color={colors.subtle} />
                </Pressable>
              ))}
            </View>
          </Panel>
          <Panel title="Son Kayıt Olan Kullanıcılar" sub="Kayıt tarihine göre (yüklü kayıtlar)">
            {recentUsers.length === 0 ? <NoData text="Kayıt tarihi olan yüklü kullanıcı yok." /> : recentUsers.map((u, i) => (
              <View key={u.id} style={{ alignItems: "center", borderBottomColor: i === recentUsers.length - 1 ? "transparent" : colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 9 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 32, justifyContent: "center", width: 32 }}>
                  <MaterialCommunityIcons name="account" size={17} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{u.name}</Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{userRoleLabel(u.role)} · {u.listingCount ?? 0} ilan · {(u.createdAt ?? "").slice(0, 10)}</Text>
                </View>
                <StatusBadge label={u.status === "suspended" ? "Askıda" : "Aktif"} tone={u.status === "suspended" ? "accent" : "success"} />
              </View>
            ))}
          </Panel>
          <Panel title="Bildirimlerin" sub="Yönetici hesabına düşen son bildirimler">
            {notifications.length === 0 ? <NoData text="Bildirim yok." /> : notifications.slice(0, 5).map((n, i, arr) => (
              <View key={n.id} style={{ borderBottomColor: i === arr.length - 1 ? "transparent" : colors.line, borderBottomWidth: 1, gap: 2, paddingVertical: 9 }}>
                <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800", lineHeight: 17 }}>{n.title}</Text>
                <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{n.createdAt}</Text>
              </View>
            ))}
          </Panel>
        </View>
      </View>
    </View>
  );
}

function Stat({ icon, tint, color, value, title, helper, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; color: string; value: string; title: string; helper?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ backgroundColor: colors.surface, borderColor: pressed && onPress ? colors.primary : colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 140, flexGrow: 1, gap: 9, maxWidth: 320, minHeight: 106, minWidth: 0, padding: 14, shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, transform: [{ translateY: pressed && onPress ? -1 : 0 }] })}>
      <View style={{ alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <View style={{ alignItems: "center", backgroundColor: tint, borderRadius: 11, height: 40, justifyContent: "center", width: 40 }}>
          <MaterialCommunityIcons name={icon} size={20} color={color} />
        </View>
        {onPress ? <MaterialCommunityIcons name="arrow-top-right" size={16} color={colors.subtle} /> : null}
      </View>
      <Text style={{ color: colors.ink, fontSize: 23, fontVariant: ["tabular-nums"], fontWeight: "900", letterSpacing: -0.4 }}>{value}</Text>
      <View style={{ gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "900", letterSpacing: 0.1 }}>{title}</Text>
        {helper ? <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{helper}</Text> : null}
      </View>
    </Pressable>
  );
}

function PriorityCard({ label, value, helper, icon, tone, onPress }: { label: string; value: number; helper: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tone: string; onPress: () => void }) {
  const empty = value === 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: colors.surface, borderColor: pressed ? tone : colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 240, flexGrow: 1, flexShrink: 1, minWidth: 0, opacity: pressed ? 0.92 : 1, padding: 16, shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: empty ? 0.04 : 0.07, shadowRadius: 10, transform: [{ translateY: pressed ? -1 : 0 }] })}>
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12 }}>
        <View style={{ alignItems: "center", backgroundColor: empty ? colors.successSoft : colors.surfaceAlt, borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}>
          <MaterialCommunityIcons name={empty ? "check-circle-outline" : icon} size={21} color={empty ? SUCCESS_INK : tone} />
        </View>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text style={{ color: empty ? SUCCESS_INK : tone, fontSize: 22, fontVariant: ["tabular-nums"], fontWeight: "900", letterSpacing: -0.4 }}>{value}</Text>
            <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900" }}>{label}</Text>
          </View>
          <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{empty ? "Şu an işlem beklemiyor" : helper}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} />
      </View>
    </Pressable>
  );
}

function HealthCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "success" | "warning" | "accent" | "neutral" }) {
  const palette = tone === "success"
    ? { bg: colors.successSoft, fg: SUCCESS_INK, icon: "check-circle-outline" as const }
    : tone === "warning"
      ? { bg: colors.goldSoft, fg: colors.goldInk, icon: "alert-circle-outline" as const }
      : tone === "neutral"
        ? { bg: colors.primarySoft, fg: colors.primary, icon: "chart-donut" as const }
        : { bg: colors.accentSoft, fg: colors.accent, icon: "alert-octagon-outline" as const };
  return (
    <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 140, flexGrow: 1, flexShrink: 1, gap: 9, minWidth: 0, padding: 13 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <View style={{ alignItems: "center", backgroundColor: palette.bg, borderRadius: 999, height: 28, justifyContent: "center", width: 28 }}>
          <MaterialCommunityIcons name={palette.icon} size={15} color={palette.fg} />
        </View>
        <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "900" }}>{label}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: tone === "neutral" ? colors.ink : palette.fg, fontSize: 20, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{value}</Text>
      <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{detail}</Text>
    </View>
  );
}

type ChartDatum = { label: string; value: number; color: string };

function StatusBadge({ label, tone }: { label: string; tone: "success" | "warning" | "accent" | "neutral" }) {
  const bg = tone === "success" ? colors.successSoft : tone === "warning" ? colors.goldSoft : tone === "accent" ? colors.accentSoft : colors.surfaceAlt;
  const fg = tone === "success" ? SUCCESS_INK : tone === "warning" ? colors.goldInk : tone === "accent" ? colors.accent : colors.muted;
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: "900" }}>{label}</Text>
    </View>
  );
}

function sortByDate<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return items.slice().sort((a, b) => dateScore(b[key]) - dateScore(a[key]));
}

function dateScore(value: unknown) {
  if (typeof value !== "string") return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function listingStatusLabel(status: string) {
  if (status === "active") return "Yayında";
  if (status === "pending_review") return "İncelemede";
  if (status === "rejected") return "Reddedildi";
  if (status === "paused") return "Duraklatıldı";
  if (status === "sold") return "Satıldı";
  if (status === "expired") return "Süresi doldu";
  if (status === "archived") return "Arşivlendi";
  return status;
}

function userRoleLabel(role?: UserRole) {
  if (role === "super_admin") return "Süper Admin";
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Moderatör";
  if (role === "seller") return "Satıcı";
  if (role === "partner") return "Ortak";
  return "Üye";
}

function listingStatusStats(listings: ReturnType<typeof useStore>["listings"]): ChartDatum[] {
  const colorsByStatus: Record<string, string> = {
    active: colors.success,
    pending_review: colors.warning,
    rejected: colors.accent,
    paused: colors.muted,
    sold: colors.info,
    expired: colors.violet,
    draft: colors.subtle
  };
  return Object.entries(countBy(listings, (l) => l.status)).map(([status, value]) => ({
    label: listingStatusLabel(status),
    value,
    color: colorsByStatus[status] ?? colors.primaryDark
  }));
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

// CSV dışa-aktarım butonu (web). Verilen başlık + satırları indirir.
function ExportButton({ label = "CSV indir", filename, headers, rows }: { label?: string; filename: string; headers: string[]; rows: Array<Array<unknown>> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} (${rows.length} satır)`}
      onPress={() => downloadCsv(filename, headers, rows)}
      style={({ pressed }) => ({ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 40, opacity: pressed ? 0.8 : 1, paddingHorizontal: 13 })}
    >
      <MaterialCommunityIcons name="download-outline" size={15} color={colors.primaryDark} />
      <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{label} · {rows.length}</Text>
    </Pressable>
  );
}

// Sıralı dağılım listesi (satıcı/ortak/kategori/şehir) — etiket + değer + oran çubuğu.
function Panel({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const wide = useContext(AdminWideCtx);
  return (
    <View style={{ ...ADMIN_CARD, gap: 10, minWidth: 0, padding: wide ? 18 : 14 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900", letterSpacing: -0.2 }}>{title}</Text>
        {sub ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

// Responsive tablo: masaüstünde sütunlu tablo; mobilde her satır dikey KART olur
// (her hücre "ETİKET: değer" satırı) → 5 sütun 390px'e sıkışıp üst üste binmez.
const TableCtx = createContext<{ head: string[]; wide: boolean }>({ head: [], wide: true });

function Table({ head, cols, children }: { head: string[]; cols: number[]; children: ReactNode }) {
  const wide = useIsWideWeb();
  return (
    <TableCtx.Provider value={{ head, wide }}>
      <View>
        {wide ? (
          <View style={{ borderBottomColor: colors.line, borderBottomWidth: 1.5, flexDirection: "row", paddingBottom: 9 }}>
            {head.map((h, i) => <Text key={h} style={{ color: colors.subtle, flex: cols[i], fontSize: 10, fontWeight: "900", letterSpacing: 0.6, textAlign: i === head.length - 1 ? "right" : "left", textTransform: "uppercase" }}>{h}</Text>)}
          </View>
        ) : null}
        {children}
      </View>
    </TableCtx.Provider>
  );
}
function Row({ cols, cells }: { cols: number[]; cells: ReactNode[] }) {
  const { head, wide } = useContext(TableCtx);
  if (!wide) {
    // Mobil kart: her hücre kendi etiketiyle tam-genişlik → sıkışma/binme yok
    return (
      <View style={{ borderBottomColor: colors.line, borderBottomWidth: 1, gap: 9, paddingVertical: 13 }}>
        {cells.map((c, i) => (
          <View key={i} style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
            <Text style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "900", letterSpacing: 0.4, marginTop: 3, textTransform: "uppercase", width: 82 }}>{head[i] ?? ""}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>{c}</View>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", paddingVertical: 10 }}>
      {/* non-last hücreler: alignItems STRETCH → içerik hücre genişliğini doldurur (RN column'da
          aksi halde içerik-boyutlu kalıp uzun metin taşar). Son hücre (İŞLEM) sağa hizalı kalır.
          Kendi alignSelf'i olan çipler (status pill) etkilenmez. */}
      {cells.map((c, i) => <View key={i} style={{ alignItems: i === cells.length - 1 ? "flex-end" : "stretch", flex: cols[i], minWidth: 0, overflow: "hidden" }}>{c}</View>)}
    </View>
  );
}

function SuggestionRow({ title, note, meta, status, onApprove, onReject }: { title: string; note?: string; meta: string; status: SuggestionStatus; onApprove: () => void; onReject: () => void }) {
  return (
    <View style={{ borderBottomColor: colors.line, borderBottomWidth: 1, gap: 7, paddingVertical: 13 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{title}</Text>
        <View style={{ backgroundColor: STATUS_TONE[status].tint, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ color: STATUS_TONE[status].color, fontSize: 10.5, fontWeight: "900" }}>{STATUS_TONE[status].label}</Text></View>
      </View>
      {note ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{note}</Text> : null}
      <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>{meta}</Text>
      {status === "pending" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ActionButton tone="primary" icon="check" label="Onayla" onPress={onApprove} />
          <ActionButton tone="neutral" icon="close" label="Reddet" onPress={onReject} />
        </View>
      ) : null}
    </View>
  );
}

function FilterChips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ key: T; label: string; count?: number }> }) {
  const wide = useContext(AdminWideCtx);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Pressable key={o.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: wide ? 32 : 40, paddingHorizontal: 13 }}>
            <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{o.label}</Text>
            {typeof o.count === "number" ? <View style={{ alignItems: "center", backgroundColor: on ? "rgba(255,255,255,0.25)" : colors.line, borderRadius: 999, justifyContent: "center", minWidth: 16, paddingHorizontal: 4 }}><Text style={{ color: on ? "#FFFFFF" : colors.muted, fontSize: 10, fontWeight: "900" }}>{o.count}</Text></View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function slugifyTr(s: string) {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", İ: "i" };
  return s.trim().toLocaleLowerCase("tr-TR").replace(/[çğıöşüİ]/g, (m) => map[m] ?? m).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}
const inputStyle = ADMIN_INPUT;

function BlogManager({ posts, onSave, onDelete, confirmAction }: { posts: DbBlogPost[]; onSave: (p: DbBlogPost) => void; onDelete: (id: string) => void; confirmAction: (m: string, cb: () => void) => void }) {
  const [edit, setEdit] = useState<DbBlogPost | null>(null);
  const blank = (): DbBlogPost => ({ id: uuid(), slug: "", category: "Satış İpuçları", title: "", excerpt: "", author: "OrtakSat", authorRole: "Editör", readMin: 3, image: "", featured: false, body: [], status: "published", createdAt: new Date().toISOString().slice(0, 10) });
  if (edit) {
    return (
      <Panel title={posts.some((p) => p.id === edit.id) ? "Yazıyı Düzenle" : "Yeni Blog Yazısı"} sub="Alanları doldur ve kaydet">
        <View style={{ gap: 10 }}>
          <TextInput value={edit.title} onChangeText={(t) => setEdit({ ...edit, title: t, slug: edit.slug || slugifyTr(t) })} placeholder="Başlık" placeholderTextColor={colors.muted} style={inputStyle} />
          <TextInput value={edit.slug} onChangeText={(t) => setEdit({ ...edit, slug: slugifyTr(t) })} placeholder="URL (slug)" placeholderTextColor={colors.muted} style={inputStyle} />
          <TextInput value={edit.category} onChangeText={(t) => setEdit({ ...edit, category: t })} placeholder="Kategori" placeholderTextColor={colors.muted} style={inputStyle} />
          <TextInput value={edit.image} onChangeText={(t) => setEdit({ ...edit, image: t })} placeholder="Kapak görseli URL" placeholderTextColor={colors.muted} style={inputStyle} />
          <TextInput value={edit.excerpt} onChangeText={(t) => setEdit({ ...edit, excerpt: t })} placeholder="Özet" placeholderTextColor={colors.muted} multiline style={{ ...inputStyle, minHeight: 56, paddingVertical: 10 }} />
          <TextInput value={edit.body.join("\n\n")} onChangeText={(t) => setEdit({ ...edit, body: t.split(/\n\n+/) })} placeholder="İçerik (paragrafları boş satırla ayır)" placeholderTextColor={colors.muted} multiline style={{ ...inputStyle, minHeight: 160, paddingVertical: 10 }} />
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: edit.featured }} onPress={() => setEdit({ ...edit, featured: !edit.featured })} style={{ alignItems: "center", flexDirection: "row", gap: 6, minHeight: 40 }}><MaterialCommunityIcons name={edit.featured ? "checkbox-marked" : "checkbox-blank-outline"} size={20} color={colors.primary} /><Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>Öne çıkan</Text></Pressable>
            <Pressable onPress={() => setEdit({ ...edit, status: edit.status === "published" ? "draft" : "published" })} style={{ alignItems: "center", backgroundColor: edit.status === "published" ? colors.successSoft : colors.surfaceAlt, borderRadius: 999, justifyContent: "center", minHeight: 40, paddingHorizontal: 14 }}><Text style={{ color: edit.status === "published" ? SUCCESS_INK : colors.muted, fontSize: 12, fontWeight: "800" }}>{edit.status === "published" ? "Yayında" : "Taslak"}</Text></Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable disabled={!edit.title.trim() || !edit.slug.trim()} onPress={() => { onSave(edit); setEdit(null); showToast("Yazı kaydedildi"); }} style={{ alignItems: "center", backgroundColor: edit.title.trim() && edit.slug.trim() ? colors.primary : colors.line, borderRadius: 10, flexDirection: "row", gap: 6, minHeight: 42, paddingHorizontal: 18, paddingVertical: 11 }}><MaterialCommunityIcons name="content-save-outline" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Kaydet</Text></Pressable>
            <Pressable onPress={() => setEdit(null)} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, minHeight: 42, paddingHorizontal: 18, paddingVertical: 10 }}><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>Vazgeç</Text></Pressable>
          </View>
        </View>
      </Panel>
    );
  }
  return (
    <Panel title="Blog Yönetimi" sub={`${posts.length} yazı`}>
      <Pressable onPress={() => setEdit(blank())} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, marginBottom: 12, minHeight: 42, paddingHorizontal: 16, paddingVertical: 10 }}><MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Yeni Yazı</Text></Pressable>
      {posts.length === 0 ? <EmptyState icon="post-outline" title="Blog yazısı yok" body="İlk yazıyı oluştur; ortaksat.com/blog'da yayınlanır." /> : null}
      <Table head={["BAŞLIK", "KATEGORİ", "DURUM", "İŞLEM"]} cols={[2.4, 1.2, 1, 1.4]}>
        {posts.map((p) => (
          <Row key={p.id} cols={[2.4, 1.2, 1, 1.4]} cells={[
            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{p.title}</Text>,
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{p.category}</Text>,
            <StatusBadge label={p.status === "published" ? "Yayında" : "Taslak"} tone={p.status === "published" ? "success" : "neutral"} />,
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <ActionButton tone="soft" icon="pencil-outline" label="Düzenle" onPress={() => setEdit(p)} />
              <ActionButton tone="danger" icon="trash-can-outline" label="Sil" onPress={() => confirmAction(`"${p.title}" silinsin mi?`, () => { onDelete(p.id); showToast("Yazı silindi"); })} />
            </View>
          ]} />
        ))}
      </Table>
    </Panel>
  );
}

// JSON ice aktarim: esnek sema. Kabul edilen ogeler:
//  { name|label, image?, subcategories?: (string | {name|label})[] }
function parseCategoryImport(raw: string): ExtraCategory[] {
  const data = JSON.parse(raw);
  const arr = Array.isArray(data) ? data : Array.isArray(data?.categories) ? data.categories : [];
  const out: ExtraCategory[] = [];
  arr.forEach((c: Record<string, unknown>, i: number) => {
    const label = String((c.name ?? c.label ?? c.title ?? "") as string).trim();
    if (!label) return;
    const subsRaw = (c.subcategories ?? c.children ?? c.subs ?? []) as unknown[];
    const subcategories = (Array.isArray(subsRaw) ? subsRaw : []).map((s) => {
      const sl = typeof s === "string" ? s : String((s as Record<string, unknown>)?.name ?? (s as Record<string, unknown>)?.label ?? "");
      return { label: sl.trim(), slug: slugifyTr(sl) };
    }).filter((s) => s.label);
    out.push({ id: uuid(), key: `x-${slugifyTr(label)}-${i}`, label, slug: slugifyTr(label), image: String((c.image ?? c.icon ?? "") as string), subcategories, sortOrder: 1000 + i, isActive: true });
  });
  return out;
}

function CategoryManager({ extra, onSave, onDelete, onImport, confirmAction }: { extra: ExtraCategory[]; onSave: (c: ExtraCategory) => void; onDelete: (id: string) => void; onImport: (list: ExtraCategory[]) => number; confirmAction: (m: string, cb: () => void) => void }) {
  const [label, setLabel] = useState("");
  const [image, setImage] = useState("");
  const [subs, setSubs] = useState("");
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const doImport = () => {
    try {
      const list = parseCategoryImport(importText);
      if (!list.length) { setImportMsg("Geçerli kategori bulunamadı. JSON dizi formatını kontrol et."); return; }
      confirmAction(`${list.length} kategori içe aktarılsın mı?`, () => { const n = onImport(list); setImportMsg(`✓ ${n} kategori içe aktarıldı.`); setImportText(""); });
    } catch (e) {
      setImportMsg("JSON çözümlenemedi: " + (e as Error).message);
    }
  };
  const add = () => {
    const key = `x-${slugifyTr(label)}`;
    if (!label.trim() || !key) return;
    const subcategories = subs.split(",").map((s) => s.trim()).filter(Boolean).map((l) => ({ label: l, slug: slugifyTr(l) }));
    onSave({ id: uuid(), key, label: label.trim(), slug: slugifyTr(label), image: image.trim(), subcategories, sortOrder: 999, isActive: true });
    setLabel(""); setImage(""); setSubs("");
    showToast("Kategori eklendi");
  };
  return (
    <Panel title="Ekstra Kategoriler" sub="Kod ağacına ek ana kategoriler; kategori sayfası ve ilan verme akışında görünür">
      <View style={{ gap: 10, marginBottom: 12 }}>
        <TextInput value={label} onChangeText={setLabel} placeholder="Kategori adı (ör. Sanat & Koleksiyon)" placeholderTextColor={colors.muted} style={inputStyle} />
        <TextInput value={image} onChangeText={setImage} placeholder="Görsel URL (opsiyonel)" placeholderTextColor={colors.muted} style={inputStyle} />
        <TextInput value={subs} onChangeText={setSubs} placeholder="Alt kategoriler (virgülle: Tablo, Heykel, Antika)" placeholderTextColor={colors.muted} style={inputStyle} />
        <Pressable disabled={!label.trim()} onPress={add} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: label.trim() ? colors.primary : colors.line, borderRadius: 10, flexDirection: "row", gap: 6, minHeight: 42, paddingHorizontal: 16, paddingVertical: 10 }}>
          <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Kategori Ekle</Text>
        </Pressable>
      </View>
      <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 8, marginBottom: 12, padding: 12 }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>JSON ile Toplu İçe Aktar</Text>
        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>Bir JSON dizisi yapıştır (binlerce kategori). Örnek: {`[{"name":"Elektronik","subcategories":["Telefon","Bilgisayar"]},{"name":"Vasıta","subcategories":[{"name":"Otomobil"}]}]`}</Text>
        <TextInput value={importText} onChangeText={setImportText} placeholder='[{"name":"...","subcategories":["..."]}]' placeholderTextColor={colors.muted} multiline style={{ ...inputStyle, minHeight: 120, paddingVertical: 10 }} />
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
          <Pressable disabled={!importText.trim()} onPress={doImport} style={{ alignItems: "center", backgroundColor: importText.trim() ? colors.primary : colors.line, borderRadius: 10, flexDirection: "row", gap: 6, minHeight: 42, paddingHorizontal: 16, paddingVertical: 10 }}>
            <MaterialCommunityIcons name="upload-outline" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>İçe Aktar</Text>
          </Pressable>
          {importMsg ? <Text style={{ color: importMsg.startsWith("✓") ? SUCCESS_INK : colors.accent, fontSize: 12, fontWeight: "700" }}>{importMsg}</Text> : null}
        </View>
      </View>
      {extra.length === 0 ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>Henüz ekstra kategori yok. Yukarıdan ekleyebilirsin.</Text> : null}
      {extra.map((c) => (
        <View key={c.id} style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 11 }}>
          <MaterialCommunityIcons name="shape-outline" size={17} color={colors.primary} />
          <View style={{ flexBasis: 140, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{c.label}</Text>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{c.subcategories.map((s) => s.label).join(", ") || "alt kategori yok"}</Text>
          </View>
          <ActionButton tone={c.isActive ? "success" : "neutral"} icon={c.isActive ? "eye-outline" : "eye-off-outline"} label={c.isActive ? "Aktif" : "Gizli"} onPress={() => { onSave({ ...c, isActive: !c.isActive }); showToast(c.isActive ? "Kategori gizlendi" : "Kategori aktifleştirildi"); }} />
          <ActionButton tone="danger" icon="trash-can-outline" label="Sil" onPress={() => confirmAction(`"${c.label}" kategorisi silinsin mi?`, () => { onDelete(c.id); showToast("Kategori silindi"); })} />
        </View>
      ))}
    </Panel>
  );
}

const CONTENT_SLUGS = [
  { slug: "hakkimizda", label: "Hakkımızda" },
  { slug: "nasil-calisir", label: "Nasıl Çalışır?" },
  { slug: "sss", label: "Sık Sorulan Sorular" },
  { slug: "guvenli-alisveris", label: "Güvenli Alışveriş İpuçları" },
  { slug: "ortak-satis-kurallari", label: "Ortak Satış Kuralları" },
  { slug: "yasakli-urunler", label: "Yasaklı Ürünler" }
];
function ContentManager({ pages, onSave }: { pages: DbContentPage[]; onSave: (p: DbContentPage) => void }) {
  const [slug, setSlug] = useState(CONTENT_SLUGS[0].slug);
  const existing = pages.find((p) => p.slug === slug);
  const [draft, setDraft] = useState<DbContentPage>(existing ?? { slug, title: "", body: "", seoTitle: "", seoDescription: "" });
  const load = (s: string) => { setSlug(s); const e = pages.find((p) => p.slug === s); setDraft(e ?? { slug: s, title: "", body: "", seoTitle: "", seoDescription: "" }); };
  return (
    <Panel title="Site İçerikleri" sub="Bilgi sayfalarını düzenle (Supabase'e kaydedilir)">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
        {CONTENT_SLUGS.map((c) => (
          <Pressable key={c.slug} onPress={() => load(c.slug)} style={{ backgroundColor: slug === c.slug ? colors.primary : colors.surfaceAlt, borderRadius: 999, justifyContent: "center", minHeight: 40, paddingHorizontal: 14 }}><Text style={{ color: slug === c.slug ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{c.label}</Text></Pressable>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <TextInput value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} placeholder="Sayfa başlığı" placeholderTextColor={colors.muted} style={inputStyle} />
        <TextInput value={draft.body} onChangeText={(t) => setDraft({ ...draft, body: t })} placeholder="Sayfa içeriği" placeholderTextColor={colors.muted} multiline style={{ ...inputStyle, minHeight: 200, paddingVertical: 10 }} />
        <TextInput value={draft.seoTitle} onChangeText={(t) => setDraft({ ...draft, seoTitle: t })} placeholder="SEO başlığı (meta title)" placeholderTextColor={colors.muted} style={inputStyle} />
        <TextInput value={draft.seoDescription} onChangeText={(t) => setDraft({ ...draft, seoDescription: t })} placeholder="SEO açıklaması (meta description)" placeholderTextColor={colors.muted} multiline style={{ ...inputStyle, minHeight: 56, paddingVertical: 10 }} />
        <Pressable accessibilityRole="button" onPress={() => { onSave({ ...draft, slug }); showToast("Sayfa kaydedildi"); }} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, minHeight: 42, paddingHorizontal: 18, paddingVertical: 11 }}><MaterialCommunityIcons name="content-save-outline" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Kaydet</Text></Pressable>
      </View>
    </Panel>
  );
}

const SEO_PATHS = ["/", "/explore", "/kategoriler", "/blog", "/nasil-calisir", "/hakkimizda"];
function SeoManager({ settings, onSave }: { settings: DbSeoSetting[]; onSave: (s: DbSeoSetting) => void }) {
  const [path, setPath] = useState(SEO_PATHS[0]);
  const existing = settings.find((s) => s.path === path);
  const [draft, setDraft] = useState<DbSeoSetting>(existing ?? { path, metaTitle: "", metaDescription: "", ogImage: "", noindex: false });
  const load = (p: string) => { setPath(p); const e = settings.find((s) => s.path === p); setDraft(e ?? { path: p, metaTitle: "", metaDescription: "", ogImage: "", noindex: false }); };
  return (
    <Panel title="SEO Yönetimi" sub="Sayfa bazlı meta etiketleri (Supabase'e kaydedilir)">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
        {SEO_PATHS.map((p) => (
          <Pressable key={p} onPress={() => load(p)} style={{ backgroundColor: path === p ? colors.primary : colors.surfaceAlt, borderRadius: 999, justifyContent: "center", minHeight: 40, paddingHorizontal: 14 }}><Text style={{ color: path === p ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{p}</Text></Pressable>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <TextInput value={draft.metaTitle} onChangeText={(t) => setDraft({ ...draft, metaTitle: t })} placeholder="Meta title" placeholderTextColor={colors.muted} style={inputStyle} />
        <TextInput value={draft.metaDescription} onChangeText={(t) => setDraft({ ...draft, metaDescription: t })} placeholder="Meta description" placeholderTextColor={colors.muted} multiline style={{ ...inputStyle, minHeight: 56, paddingVertical: 10 }} />
        <TextInput value={draft.ogImage} onChangeText={(t) => setDraft({ ...draft, ogImage: t })} placeholder="OG image URL" placeholderTextColor={colors.muted} style={inputStyle} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: draft.noindex }} onPress={() => setDraft({ ...draft, noindex: !draft.noindex })} style={{ alignItems: "center", flexDirection: "row", gap: 6, minHeight: 40 }}><MaterialCommunityIcons name={draft.noindex ? "checkbox-marked" : "checkbox-blank-outline"} size={20} color={colors.primary} /><Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>noindex (arama motorlarına kapat)</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { onSave({ ...draft, path }); showToast("SEO ayarı kaydedildi"); }} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, minHeight: 42, paddingHorizontal: 18, paddingVertical: 11 }}><MaterialCommunityIcons name="content-save-outline" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Kaydet</Text></Pressable>
      </View>
    </Panel>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, minWidth: 74, paddingHorizontal: 12, paddingVertical: 8 }}>
      <Text style={{ color: tone === "accent" ? colors.accent : colors.ink, fontSize: 17, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function AdminSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, marginBottom: 12, paddingHorizontal: 12 }}>
      <MaterialCommunityIcons name="magnify" size={17} color={colors.muted} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} style={{ color: colors.ink, flex: 1, fontSize: 16, minHeight: 44, minWidth: 0, paddingVertical: 6 }} />
      {value ? <Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" onPress={() => onChange("")} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={16} color={colors.muted} /></Pressable> : null}
    </View>
  );
}

export default function AdminScreen() {
  const auth = useStore();
  const mounted = useMounted();
  if (!mounted) return <ScreenSkeleton />; // hidrasyon-gate (#418)
  if (!auth.authReady) return <ScreenSkeleton />; // oturum geri-yüklenene kadar bekle (auth-flash önle)
  if (!auth.isAuthenticated) return <AuthRequired title="Yönetim paneli için giriş yapın" />;
  const role = auth.currentUser.role;
  const isStaff = role === "admin" || role === "moderator" || role === "super_admin";
  if (!isStaff) {
    return (
      <AuthRequired
        icon="shield-lock-outline"
        title="Bu alana erişim yetkiniz yok"
        body="Yönetim paneli yalnızca yönetici ve moderatör hesaplarına açıktır. Yetki gerektiğini düşünüyorsanız bizimle iletişime geçin."
      />
    );
  }
  return <AdminScreenInner />;
}
