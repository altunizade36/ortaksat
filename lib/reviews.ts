/**
 * Yorum / değerlendirme ortak mantığı — TEK kaynak.
 *
 * Kurallar (uzunluk sınırı, puan aralığı), göreli tarih, özet istatistiği, sıralama ve
 * "Faydalı" oyunun kullanıcı-başına durumu eskiden her ekranda ayrı ayrı (ve farklı)
 * yazılmıştı: mağaza kendi özetini, ilan detayı kendi formunu, mobil kendi listesini
 * taşıyordu. Buradaki yardımcılar hepsinin aynı sonucu göstermesini sağlar.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchReviewPage } from "@/lib/live-service";
import { supabase } from "@/lib/supabase";
import type { Review } from "@/lib/types";

export const REVIEW_MIN_LENGTH = 10;
export const REVIEW_MAX_LENGTH = 1000;
export const REVIEW_REPLY_MAX_LENGTH = 1000;

export type ReviewSort = "recent" | "helpful" | "high" | "low";
export type RatingStats = { count: number; average: number; dist: [number, number, number, number, number] };

/** Puanı 1–5 tam sayıya sabitler; geçersiz değer 0 (= "puan yok") döner. */
export function clampRating(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0;
}

/** Form doğrulaması: sorun varsa Türkçe mesaj, yoksa "" döner. */
export function validateReviewDraft(rating: number, comment: string): string {
  if (clampRating(rating) === 0) return "Lütfen 1 ile 5 arasında bir puan seç.";
  const length = comment.trim().length;
  if (length < REVIEW_MIN_LENGTH) return `Yorumun en az ${REVIEW_MIN_LENGTH} karakter olmalı.`;
  if (length > REVIEW_MAX_LENGTH) return `Yorumun en fazla ${REVIEW_MAX_LENGTH} karakter olabilir.`;
  return "";
}

/** Gösterilen yorumlardan özet: adet, ortalama (1 ondalık) ve 1★..5★ dağılımı. */
export function ratingStats(ratings: number[]): RatingStats {
  const dist: RatingStats["dist"] = [0, 0, 0, 0, 0];
  let sum = 0;
  let count = 0;
  for (const raw of ratings) {
    const rating = clampRating(raw);
    if (!rating) continue;
    dist[rating - 1] += 1;
    sum += rating;
    count += 1;
  }
  return { count, average: count ? Math.round((sum / count) * 10) / 10 : 0, dist };
}

export function sortReviews<T extends Pick<Review, "rating" | "createdAt" | "helpfulCount" | "id">>(list: T[], sort: ReviewSort): T[] {
  const byRecent = (a: T, b: T) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  const copy = [...list];
  if (sort === "high") return copy.sort((a, b) => b.rating - a.rating || byRecent(a, b));
  if (sort === "low") return copy.sort((a, b) => a.rating - b.rating || byRecent(a, b));
  if (sort === "helpful") return copy.sort((a, b) => (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0) || byRecent(a, b));
  return copy.sort(byRecent);
}

const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Yorum tarihi, göreli: "bugün", "dün", "3 gün önce", "2 hafta önce", "5 ay önce";
 * bir yıldan eskiyse "Mart 2025". Yorum tarihleri gün hassasiyetinde tutulur
 * (mapReviewRow created_at'i YYYY-MM-DD'ye keser), bu yüzden saat/dakika gösterilmez.
 */
export function reviewRelativeDate(value: string, language: "tr" | "en" = "tr", now: Date = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!match) return value || "";
  const then = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  // Yorum tarihi UTC takvim günüdür (created_at'in ilk 10 karakteri) → "bugün" de UTC günüyle
  // karşılaştırılır. Yerel günle karşılaştırınca TR'de 00:00–02:59 arası az önce yazılan yorum "dün" çıkıyordu.
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((today - then) / 86_400_000);
  const en = language === "en";
  if (days <= 0) return en ? "today" : "bugün";
  if (days === 1) return en ? "yesterday" : "dün";
  if (days < 7) return en ? `${days} days ago` : `${days} gün önce`;
  if (days < 30) { const w = Math.floor(days / 7); return en ? `${w} week${w > 1 ? "s" : ""} ago` : `${w} hafta önce`; }
  if (days < 365) { const m = Math.floor(days / 30); return en ? `${m} month${m > 1 ? "s" : ""} ago` : `${m} ay önce`; }
  const month = Number(match[2]) - 1;
  return `${(en ? MONTHS_EN : MONTHS_TR)[month]} ${match[1]}`;
}

/**
 * Bir ilanın / kullanıcının TÜM (silinmemiş) yorumlarının puan dağılımı. Sayfalanan
 * listelerde özet, yalnız yüklenen sayfadan hesaplanırsa yanlış çıkar; bu yüzden yalnız
 * `rating` kolonu ayrıca çekilir. Hata → null (özet gizlenir, yanlış sayı gösterilmez).
 */
export async function fetchRatingStats(filter: { listingId?: string; userId?: string; type?: "seller" | "partner" | "product" }): Promise<RatingStats | null> {
  if (!supabase || (!filter.listingId && !filter.userId)) return null;
  // PostgREST tek yanıtta en fazla 1000 satır döner → daha çok yorumu olan satıcıda özet eksik
  // kalmasın diye puanlar sayfa sayfa okunur (id sırasıyla; üst sınır RATING_MAX_PAGES sayfa).
  const ratings: number[] = [];
  for (let page = 0; page < RATING_MAX_PAGES; page++) {
    let request = supabase.from("reviews").select("rating").is("deleted_at", null);
    if (filter.listingId) request = request.eq("listing_id", filter.listingId);
    if (filter.userId) request = request.eq("reviewed_user_id", filter.userId);
    if (filter.type) request = request.eq("type", filter.type);
    const { data, error } = await request.order("id", { ascending: true }).range(page * RATING_PAGE, (page + 1) * RATING_PAGE - 1);
    if (error) return null;
    for (const row of data ?? []) ratings.push(Number((row as { rating: number }).rating));
    if ((data?.length ?? 0) < RATING_PAGE) break;
  }
  return ratingStats(ratings);
}
const RATING_PAGE = 1000;
const RATING_MAX_PAGES = 20;

/* ---------------------------------------------------------------------------
 * Sayfalı yorum listesi (web: mağaza, ilan detayı, ortak vitrini).
 *
 * Eskiden bu ekranlar tek istekte en fazla 100 yorum çekiyor, fazlası HİÇ görünmüyordu; başlıktaki
 * sayı ve özet de yalnız yüklenen satırlardan hesaplanıyordu. Artık liste sayfa sayfa gelir
 * ("Daha fazla değerlendirme göster" ekler), sayı ve özet ise TÜM yorumlardan (fetchRatingStats).
 * Sıralama / yıldız süzgeci değişince liste ilk sayfadan yeniden sorgulanır.
 * ------------------------------------------------------------------------- */
export const REVIEW_PAGE_SIZE = 20;

export type PagedReviews = {
  /** Sunucudan yüklenen satırlar (sunucu sırasıyla, kimliğe göre tekil). */
  rows: Review[];
  /** Süzgece uyan TÜM satırların sayısı; henüz bilinmiyorsa null. */
  total: number | null;
  /** TÜM yorumların özeti (yıldız süzgecinden bağımsız); alınamadıysa null. */
  stats: RatingStats | null;
  /** İlk sayfa yükleniyor (hedef / sıralama / süzgeç değişti ya da yeniden deneniyor). */
  loading: boolean;
  loadingMore: boolean;
  /** Son sayfa isteği başarısız oldu (liste olduğu gibi kalır; yeniden denenebilir). */
  error: boolean;
  hasMore: boolean;
  loadMore: () => void;
  /** İlk sayfadan yeniden yükle (özet dahil). */
  reload: () => void;
  /** Başarısız isteği yinele: ilk sayfa düşmüşse baştan, sıradaki sayfa düşmüşse kaldığı yerden. */
  retry: () => void;
  patch: (id: string, change: Partial<Review>) => void;
  remove: (id: string) => void;
};

/** Özeti yerelde düzeltir: `from` puanlı bir yorum çıkar, `to` puanlı bir yorum girer (0 = yok). */
function shiftStats(stats: RatingStats | null, from: number, to: number): RatingStats | null {
  if (!stats) return stats;
  const dist = [...stats.dist] as RatingStats["dist"];
  const out = clampRating(from);
  const into = clampRating(to);
  if (out) dist[out - 1] = Math.max(0, dist[out - 1] - 1);
  if (into) dist[into - 1] += 1;
  const count = dist.reduce((sum, n) => sum + n, 0);
  const points = dist.reduce((sum, n, index) => sum + n * (index + 1), 0);
  return { count, average: count ? Math.round((points / count) * 10) / 10 : 0, dist };
}

export function usePagedReviews(
  target: { listingId?: string; userId?: string; type?: "seller" | "partner" | "product" },
  options: {
    sort?: ReviewSort;
    star?: number;
    pageSize?: number;
    /** Değişince özet yeniden çekilir (ör. oturumda yeni yorum yazıldı). */
    refreshKey?: string | number;
  } = {}
): PagedReviews {
  const { listingId, userId, type } = target;
  const sort = options.sort ?? "recent";
  const star = options.star ?? 0;
  const pageSize = options.pageSize ?? REVIEW_PAGE_SIZE;
  const refreshKey = options.refreshKey;
  const [rows, setRows] = useState<Review[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  // Sunucudan tüketilen satır sayısı = sıradaki sayfanın başlangıcı (yerelde silinen satır düşülür).
  const [consumed, setConsumed] = useState(0);
  const [tick, setTick] = useState(0);
  const [statsTick, setStatsTick] = useState(0);
  const generation = useRef(0);
  const busy = useRef(false);
  // İlk sayfa isteği düştü: eldeki satırlar (varsa) ÖNCEKİ sıralamaya aittir → üstüne sayfa eklenmez.
  const firstFailed = useRef(false);
  const consumedRef = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Başka ilana / kullanıcıya geçildi: öncekinin satırları ve özeti bir an bile görünmesin.
  useEffect(() => {
    setRows((old) => (old.length ? [] : old));
    setTotal(null);
    setStats(null);
  }, [listingId, userId, type]);

  useEffect(() => {
    const n = ++generation.current;
    busy.current = true;
    firstFailed.current = false;
    setLoading(true);
    setLoadingMore(false);
    setError(false);
    const done = (page: Awaited<ReturnType<typeof fetchReviewPage>>) => {
      if (n !== generation.current) return;
      busy.current = false;
      setLoading(false);
      if (!page) { firstFailed.current = true; setError(true); return; }
      consumedRef.current = page.rows.length;
      setConsumed(page.rows.length);
      setRows(page.rows);
      setTotal(page.total);
    };
    void fetchReviewPage({ listingId, userId }, { offset: 0, limit: pageSize, sort, star, type }).then(done, () => done(null));
    return () => { generation.current++; busy.current = false; };
  }, [listingId, userId, type, sort, star, pageSize, tick]);

  useEffect(() => {
    let alive = true;
    // Başarısız yenileme eldeki (doğru) özeti silmesin; hedef değişince özet zaten sıfırlanır.
    void fetchRatingStats({ listingId, userId, type }).then((next) => { if (alive && next) setStats(next); }, () => {});
    return () => { alive = false; };
  }, [listingId, userId, type, tick, statsTick, refreshKey]);

  const loadMore = useCallback(() => {
    if (busy.current || firstFailed.current) return;
    const n = generation.current;
    busy.current = true;
    setLoadingMore(true);
    setError(false);
    const done = (page: Awaited<ReturnType<typeof fetchReviewPage>>) => {
      if (n !== generation.current) return;
      busy.current = false;
      setLoadingMore(false);
      if (!page) { setError(true); return; }
      consumedRef.current += page.rows.length;
      setConsumed(consumedRef.current);
      // Arada yeni yorum eklendiyse sayfa bir satır kayar → aynı satır iki kez gelebilir; kimliğe göre ele.
      setRows((old) => { const seen = new Set(old.map((r) => r.id)); return [...old, ...page.rows.filter((r) => !seen.has(r.id))]; });
      // Boş sayfa = liste bitti (toplam, tüketilenden büyük kalıp düğmeyi sonsuza dek göstermesin).
      setTotal(page.rows.length ? page.total : Math.min(page.total, consumedRef.current));
    };
    void fetchReviewPage({ listingId, userId }, { offset: consumedRef.current, limit: pageSize, sort, star, type }).then(done, () => done(null));
  }, [listingId, userId, type, sort, star, pageSize]);

  const reload = useCallback(() => setTick((v) => v + 1), []);
  const retry = useCallback(() => { if (firstFailed.current) setTick((v) => v + 1); else loadMore(); }, [loadMore]);

  const patch = useCallback((id: string, change: Partial<Review>) => {
    const current = rowsRef.current.find((r) => r.id === id);
    const nextRating = change.rating;
    if (current && nextRating !== undefined && nextRating !== current.rating) setStats((s) => shiftStats(s, current.rating, nextRating));
    setRows((old) => old.map((r) => (r.id === id ? { ...r, ...change } : r)));
    if (nextRating !== undefined) setStatsTick((v) => v + 1);
  }, []);

  const remove = useCallback((id: string) => {
    const current = rowsRef.current.find((r) => r.id === id);
    if (current) {
      consumedRef.current = Math.max(0, consumedRef.current - 1);
      setConsumed(consumedRef.current);
      setTotal((t) => (t === null ? t : Math.max(0, t - 1)));
      setStats((s) => shiftStats(s, current.rating, 0));
      setRows((old) => old.filter((r) => r.id !== id));
    }
    setStatsTick((v) => v + 1);
  }, []);

  return { rows, total, stats, loading, loadingMore, error, hasMore: total !== null && consumed < total, loadMore, reload, retry, patch, remove };
}

/**
 * Başlıktaki sayı + özet için doğru kaynak. `shown` = ekrandaki liste (yüklenen sayfalar + oturumda
 * yazılıp henüz sunucu listesinde olmayan kendi yorumun).
 *  • Daha sayfa varsa: sayı ve özet SUNUCUDAN (tüm yorumlar) — yalnız yüklenen sayfadan hesaplanmaz.
 *  • Hepsi yüklüyse: ekrandaki liste esastır (yeni yazılan yorum, özet yenilenmeden de sayılır).
 */
export function summarizeReviews(paged: Pick<PagedReviews, "stats" | "total" | "hasMore">, shown: Array<Pick<Review, "rating">>): { count: number; stats: RatingStats | null } {
  const local = ratingStats(shown.map((r) => r.rating));
  const stats = paged.hasMore ? paged.stats : paged.stats && paged.stats.count >= local.count ? paged.stats : local;
  return { count: Math.max(stats?.count ?? 0, paged.total ?? 0, shown.length), stats: stats && stats.count > 0 ? stats : null };
}

/* ---------------------------------------------------------------------------
 * "Faydalı" oyu — kullanıcının HANGİ yorumlara oy verdiği.
 *
 * Eskiden kart bunu hiç bilmiyordu: oy verilmiş yorum ile verilmemiş yorum aynı
 * görünüyor, ikinci dokunuş (oyu geri alma) kullanıcıya "sayı düştü, bozuldu" gibi
 * geliyordu. review_helpful_votes RLS'i yalnız kendi satırlarını okutur; ekrandaki
 * kartların kimlikleri tek sorguda toplanır (kart başına istek atılmaz).
 * ------------------------------------------------------------------------- */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let voteOwner = "";
const votedIds = new Set<string>();
const knownIds = new Set<string>();
const pendingIds = new Set<string>();
const voteListeners = new Set<() => void>();
let voteTimer: ReturnType<typeof setTimeout> | null = null;
// Art arda başarısız toplu sorgu sayısı (yeniden deneme aralığı + üst sınır için).
let voteLookupFailures = 0;
const VOTE_LOOKUP_MAX_RETRIES = 4;

function emitVotes() { voteListeners.forEach((fn) => fn()); }

// Hesap değiştiyse önceki kullanıcının oy durumu sıradaki kullanıcıya sızmasın.
function syncVoteOwner(userId: string) {
  if (voteOwner === userId) return;
  voteOwner = userId;
  votedIds.clear();
  knownIds.clear();
  pendingIds.clear();
  voteLookupFailures = 0;
}

// Sorgu başarısız: kimlikler "bilinmiyor" kalır. Kart ekrandayken yeniden istenmediği için
// burada (artan aralıkla, sınırlı sayıda) tekrar kuyruğa alınır; yoksa oy durumu hiç öğrenilmezdi.
function requeueVoteLookups(owner: string, ids: string[]) {
  if (owner !== voteOwner) return;
  voteLookupFailures += 1;
  if (voteLookupFailures > VOTE_LOOKUP_MAX_RETRIES) return; // vazgeç; dokunuşta ensureHelpfulVoteKnown yine sorar
  for (const id of ids) if (!knownIds.has(id)) pendingIds.add(id);
  if (pendingIds.size && !voteTimer) voteTimer = setTimeout(() => { void flushVoteLookups(); }, Math.min(30000, 1500 * 2 ** (voteLookupFailures - 1)));
}

async function flushVoteLookups() {
  voteTimer = null;
  const owner = voteOwner;
  const ids = [...pendingIds].slice(0, 100);
  ids.forEach((id) => pendingIds.delete(id));
  if (pendingIds.size) voteTimer = setTimeout(() => { void flushVoteLookups(); }, 40);
  if (!supabase || !ids.length) return;
  try {
    const { data, error } = await supabase.from("review_helpful_votes").select("review_id").eq("user_id", owner).in("review_id", ids);
    if (owner !== voteOwner) return;
    if (error) { requeueVoteLookups(owner, ids); return; }
    voteLookupFailures = 0;
    const voted = new Set((data ?? []).map((row) => (row as { review_id: string }).review_id));
    // Yalnız hâlâ BİLİNMEYEN kimliklere uygula: sorgu uçuştayken kullanıcı oy verdiyse (durum
    // artık yerelde biliniyor) bu bayat yanıt onu ezmesin.
    for (const id of ids) {
      if (knownIds.has(id)) continue;
      knownIds.add(id);
      if (voted.has(id)) votedIds.add(id);
    }
    emitVotes();
  } catch { requeueVoteLookups(owner, ids); }
}

function requestVoteState(reviewId: string, userId: string) {
  syncVoteOwner(userId);
  if (knownIds.has(reviewId) || pendingIds.has(reviewId)) return;
  pendingIds.add(reviewId);
  if (!voteTimer) voteTimer = setTimeout(() => { void flushVoteLookups(); }, 40);
}

/**
 * Oy vermeden ÖNCE çağrılır: kullanıcının bu yoruma mevcut oy durumunu KESİN olarak döndürür.
 *
 * Sunucudaki RPC bir AÇ/KAPAT'tır. Durum bilinmeden (toplu sorgu henüz dönmedi ya da başarısız
 * oldu) "oy verilmemiş" varsayıp basılırsa, daha önce oy vermiş kullanıcının oyu SİLİNİR ama kart
 * "oy verildi" gösterir; sonraki her dokunuşta da ters kalır. Bilinmiyorsa burada tek yorum için
 * sorulur; yine öğrenilemezse `known: false` döner ve çağıran oy GÖNDERMEZ.
 * Canlı olmayan mod / UUID olmayan kimlik: sorgulanacak bir şey yok → bilinen, oy yok.
 */
export async function ensureHelpfulVoteKnown(reviewId: string, userId: string | undefined): Promise<{ known: boolean; voted: boolean }> {
  if (!supabase || !userId || !UUID.test(userId) || !UUID.test(reviewId)) return { known: true, voted: false };
  syncVoteOwner(userId);
  if (knownIds.has(reviewId)) return { known: true, voted: votedIds.has(reviewId) };
  try {
    const { data, error } = await supabase.from("review_helpful_votes").select("review_id").eq("user_id", userId).eq("review_id", reviewId).limit(1);
    if (error || voteOwner !== userId) return { known: false, voted: false };
    if (!knownIds.has(reviewId)) {
      knownIds.add(reviewId);
      pendingIds.delete(reviewId);
      if ((data ?? []).length > 0) votedIds.add(reviewId);
      emitVotes();
    }
    return { known: true, voted: votedIds.has(reviewId) };
  } catch {
    return { known: false, voted: false };
  }
}

/** Oy durumunu yerelde günceller (iyimser güncelleme / geri alma için). */
export function setHelpfulVoted(reviewId: string, voted: boolean) {
  knownIds.add(reviewId);
  if (voted) votedIds.add(reviewId); else votedIds.delete(reviewId);
  emitVotes();
}

/** Girişli kullanıcı bu yoruma "Faydalı" oyu vermiş mi? (girişsiz / demo → false) */
export function useHelpfulVoted(reviewId: string, userId: string | undefined, enabled: boolean): boolean {
  const usable = enabled && !!userId && UUID.test(userId) && UUID.test(reviewId);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!usable || !userId) return;
    const listener = () => bump((n) => n + 1);
    voteListeners.add(listener);
    requestVoteState(reviewId, userId);
    return () => { voteListeners.delete(listener); };
  }, [usable, reviewId, userId]);
  return usable && voteOwner === userId && votedIds.has(reviewId);
}
