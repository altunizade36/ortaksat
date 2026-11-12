import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ReviewCard } from "@/components/review-card";
import { RatingSummary } from "@/components/reviews/rating-summary";
import { ReviewSortBar, ReviewStarFilter } from "@/components/reviews/review-filters";
import { supabase } from "@/lib/supabase";
import { mapReviewRow } from "@/lib/live-service";
import { fetchRatingStats, type RatingStats, type ReviewSort } from "@/lib/reviews";
import { useStore } from "@/lib/use-store";
import type { Listing, Review } from "@/lib/types";
import { MobileButton, MobileCard, ms } from "./ui";

const PAGE = 24;

/*
 * İlan yorumları (mobil / native).
 *  • Özet (ortalama + dağılım) TÜM yorumlardan gelir; liste sayfalanır. Başlıktaki sayı,
 *    özetteki sayı ve liste aynı kaynaktan (silinmemiş yorumlar) beslenir.
 *  • Sıralama ve yıldız süzgeci SUNUCUDA uygulanır (yalnız yüklenen sayfayı sıralamak yanıltır).
 *  • Düzenleme/silme sonrası özet yeniden hesaplanır.
 */
export function MobileListingReviews({ listing }: { listing: Listing }) {
  const store = useStore();
  const router = useRouter();
  const [rows, setRows] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [sort, setSort] = useState<ReviewSort>("recent");
  const [star, setStar] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const lock = useRef(false);

  const loadStats = useCallback(() => {
    let alive = true;
    void fetchRatingStats({ listingId: listing.id }).then((s) => { if (alive) setStats(s); });
    return () => { alive = false; };
  }, [listing.id]);
  useEffect(() => loadStats(), [loadStats, retry]);

  const load = useCallback(async (offset = 0) => {
    if (!supabase || (offset && lock.current)) return;
    const n = ++generation.current;
    lock.current = true;
    setLoading(true);
    setError("");
    try {
      let request = supabase.from("reviews").select("*,reviewer:profiles!reviews_reviewer_id_fkey(full_name,avatar_url)", { count: "exact" }).eq("listing_id", listing.id).is("deleted_at", null);
      if (star) request = request.eq("rating", star);
      if (sort === "helpful") request = request.order("helpful_count", { ascending: false });
      if (sort === "high" || sort === "low") request = request.order("rating", { ascending: sort === "low" });
      const { data, error: failure, count } = await request.order("created_at", { ascending: false }).order("id").range(offset, offset + PAGE - 1);
      if (failure) throw failure;
      if (n !== generation.current) return;
      const page = (data || []).map(mapReviewRow);
      setRows((old) => (offset ? [...new Map([...old, ...page].map((r) => [r.id, r])).values()] : page));
      setTotal(count || 0);
    } catch {
      if (n === generation.current) setError("Yorumlar yüklenemedi. Tekrar dene.");
    } finally {
      if (n === generation.current) { lock.current = false; setLoading(false); }
    }
  }, [listing.id, sort, star]);

  useEffect(() => {
    setRows([]);
    void load();
    return () => { generation.current++; lock.current = false; };
  }, [load, retry]);

  const reviewable = store.sales.find((s) => s.listingId === listing.id && store.canReviewSale(s.id));
  const allCount = stats?.count ?? (star ? undefined : total);
  const filtered = star > 0;

  return (
    <View style={{ gap: 12 }}>
      <Text style={ms.section}>İlan Yorumları ({allCount === undefined || (loading && !rows.length && !stats) ? "…" : allCount})</Text>
      {stats && stats.count > 0 ? <RatingSummary stats={stats} /> : null}
      {reviewable ? (
        <MobileButton secondary icon="pencil" onPress={() => router.push({ pathname: "/review", params: { userId: listing.ownerId, saleId: reviewable.id } } as never)}>Yorum Yap ve Değerlendir</MobileButton>
      ) : null}
      {stats && stats.count > 1 ? <ReviewSortBar value={sort} onChange={setSort} /> : null}
      {stats && stats.count > 1 ? <ReviewStarFilter value={star} onChange={setStar} stats={stats} /> : null}
      {rows.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          reviewerName={review.reviewerName}
          isSeller={listing.ownerId === store.currentUser.id}
          authed={store.isAuthenticated}
          isMine={review.reviewerId === store.currentUser.id}
          onEdit={store.editReview}
          onDelete={store.deleteReview}
          onReport={store.reportReview}
          onPatch={(id, patch) => { setRows((old) => old.map((r) => (r.id === id ? { ...r, ...patch } : r))); if (patch.rating !== undefined) loadStats(); }}
          onRemove={(id) => { setRows((old) => old.filter((r) => r.id !== id)); setTotal((n) => Math.max(0, n - 1)); loadStats(); }}
          language="tr"
        />
      ))}
      {error ? (
        <MobileCard>
          <Text accessibilityRole="alert" style={ms.error}>{error}</Text>
          <MobileButton secondary onPress={() => (rows.length ? void load(rows.length) : setRetry((v) => v + 1))}>Tekrar Dene</MobileButton>
        </MobileCard>
      ) : null}
      {loading ? <Text style={ms.muted}>Yorumlar yükleniyor…</Text> : null}
      {!loading && !error && !rows.length ? (
        <MobileCard>
          <Text style={ms.section}>{filtered ? "Bu puanda yorum yok" : "Henüz değerlendirme yok"}</Text>
          <Text style={ms.muted}>{filtered ? "Başka bir yıldız seç ya da tüm yorumları göster." : "Bu ilan için henüz kimse değerlendirme yazmadı. Değerlendirmeler yalnızca tamamlanmış bir satışın taraflarınca yazılabilir."}</Text>
          {filtered ? <MobileButton secondary onPress={() => setStar(0)}>Tüm Yorumları Göster</MobileButton> : null}
        </MobileCard>
      ) : null}
      {!loading && !error && rows.length < total ? <MobileButton secondary onPress={() => void load(rows.length)}>Diğer Yorumları Göster</MobileButton> : null}
    </View>
  );
}
