/**
 * Yorum / değerlendirme ortak mantığı — TEK kaynak.
 *
 * Kurallar (uzunluk sınırı, puan aralığı), göreli tarih, özet istatistiği, sıralama ve
 * "Faydalı" oyunun kullanıcı-başına durumu eskiden her ekranda ayrı ayrı (ve farklı)
 * yazılmıştı: mağaza kendi özetini, ilan detayı kendi formunu, mobil kendi listesini
 * taşıyordu. Buradaki yardımcılar hepsinin aynı sonucu göstermesini sağlar.
 */
import { useEffect, useState } from "react";

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
  let request = supabase.from("reviews").select("rating").is("deleted_at", null);
  if (filter.listingId) request = request.eq("listing_id", filter.listingId);
  if (filter.userId) request = request.eq("reviewed_user_id", filter.userId);
  if (filter.type) request = request.eq("type", filter.type);
  const { data, error } = await request.limit(2000);
  if (error) return null;
  return ratingStats((data ?? []).map((row) => Number((row as { rating: number }).rating)));
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
