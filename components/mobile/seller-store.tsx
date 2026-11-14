import { LISTING_GRID_PHOTO_RATIO, cardPriceFontSize } from "@/lib/card-layout";
import { responsiveGrid } from "@/lib/layout";
import { TrustEntry } from "@/components/trust/entry";
import { HorizontalScroll } from "@/components/horizontal-scroll";
import { displayListingTitle } from "@/lib/listing-title";
import { BlockUserSheet } from "./block-user-sheet";
import { openUrlSafe } from "@/lib/link";
import { getDistrict } from "@/lib/locations";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { UserAvatar } from "@/components/user-avatar";
import { ProfileCoverImage } from "@/components/profile-cover-image";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { ReviewCard } from "@/components/review-card";
import { RatingSummary } from "@/components/reviews/rating-summary";
import { fetchRatingStats, type RatingStats } from "@/lib/reviews";
import { OptionSheet } from "@/components/option-sheet";
import { useStore } from "@/lib/use-store";
import { supabase } from "@/lib/supabase";
import { STORE_RANK_COLUMN } from "@/lib/store-order";
import { useProfileActivity } from "@/lib/activity";
import { VerificationBadges } from "@/components/verification-badges";
import { tierFromCount } from "@/components/partner-tier";
import {
  fetchPublicSeller,
  mapListing,
  type PublicListingCardRow,
} from "@/lib/supabase-data";
import { mapReviewRow } from "@/lib/live-service";
import { useFavoriteFlag } from "@/lib/favorites-cache";
import { shareOrCopy } from "@/lib/share";
import { showToast } from "@/lib/toast";
import { moneyIn } from "@/lib/format";
import type { Listing, Review, User } from "@/lib/types";
import {
  MobileBottomNav,
  MobileButton,
  MobileCard,
  MobileChip,
  MobileScreen,
  MobileSelect,
  IconButton,
  mobile,
  mobileContent,
  ms,
  useMobileLayout,
} from "./ui";

// Varsayılan sıralama = SATICININ BELİRLEDİĞİ MAĞAZA SIRASI (İlanlarım › Mağaza Sırası; bkz. lib/store-order.ts).
// Sırası olmayan (yeni eklenen) ilan en başta, sonra satıcının sırası; hiç sıralama yapılmamışsa en yeni önce.
const STORE_ORDER_SORT = "Mağaza sırası";

export function MobileSellerStore({ id }: { id: string }) {
  const store = useStore(),
    router = useRouter(),
    { maxWidth, tablet, wide } = useMobileLayout(),
    [seller, setSeller] = useState<User | null>(store.findUser(id) || null),
    [tab, setTab] = useState("İlanlar"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState(STORE_ORDER_SORT),
    [openOnly, setOpenOnly] = useState(false),
    [menu, setMenu] = useState(false),
    [reviewType, setReviewType] = useState("Tümü");
  const [listings, setListings] = useState<Listing[]>([]),
    [total, setTotal] = useState(0),
    [allTotal, setAllTotal] = useState<number | null>(null),
    [reviews, setReviews] = useState<Review[]>([]),
    [reviewTotal, setReviewTotal] = useState(0),
    [reviewLoaded, setReviewLoaded] = useState(false),
    [reviewStats, setReviewStats] = useState<RatingStats | null>(null),
    [statsTick, setStatsTick] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [moreBusy, setMoreBusy] = useState(false),
    [profileLoaded, setProfileLoaded] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false),
    [category, setCategory] = useState(""),
    [categories, setCategories] = useState<{ label: string; value: number }[]>(
      [],
    ),
    [categoryError, setCategoryError] = useState(false),
    [messageBusy, setMessageBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setCategory("");
    setCategories([]);
    setCategoryError(false);
    if (supabase)
      void supabase
        .rpc("mobile_seller_categories", { seller_id: id })
        .then(({ data, error }) => {
          if (!alive) return;
          if (error) setCategoryError(true);
          else setCategories(data || []);
        });
    return () => {
      alive = false;
    };
  }, [id, retry]);
  const reviewRevision = useRef(0),
    reviewLock = useRef(false),
    reviewQuery = useRef("");
  reviewQuery.current = id + "|" + reviewType;
  const revision = useRef(0),
    moreLock = useRef(false),
    own = id === store.currentUser.id;
  const activityLabel = useProfileActivity(id);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let active = true;
    setProfileLoaded(false);
    void fetchPublicSeller(id)
      .then((user) => {
        if (active) setSeller(user);
      })
      .catch(() => {
        if (active) setError("Satıcı bilgileri yüklenemedi.");
      })
      .finally(() => {
        if (active) setProfileLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  useEffect(() => {
    if (!supabase) return;
    const n = ++revision.current;
    setLoading(true);
    setError("");
    setListings([]);
    let request = supabase
      .from("listing_public_cards")
      .select("*", { count: "exact" })
      .eq("owner_id", id)
      .eq("status", "active");
    if (category) request = request.eq("category", category);
    if (search)
      request = request.ilike(
        "title",
        `%${search.replace(/[\\%_]/g, "\\$&")}%`,
      );
    if (openOnly)
      request = request.in("partnership_mode", ["open", "approval"]);
    request = (
      sort === STORE_ORDER_SORT
        ? request
            .order(STORE_RANK_COLUMN, { ascending: true, nullsFirst: true })
            .order("created_at", { ascending: false })
        : request.order(sort === "En yeni" ? "created_at" : "price", {
            ascending: sort === "Fiyat: düşükten yükseğe",
          })
    )
      .order("id")
      .range(0, 23);
    void Promise.resolve(request)
      .then((result) => {
        if (n !== revision.current) return;
        if (result.error) {
          setError("Mağaza ilanları yüklenemedi. Tekrar dene.");
          return;
        }
        setListings((result.data as PublicListingCardRow[]).map(mapListing));
        setTotal(result.count || 0);
        if (!category && !search && !openOnly) setAllTotal(result.count || 0);
      })
      .finally(() => {
        if (n === revision.current) setLoading(false);
      });
    return () => {
      revision.current++;
    };
  }, [id, search, sort, openOnly, category, retry]);
  async function more() {
    if (moreLock.current || !supabase) return;
    moreLock.current = true;
    setMoreBusy(true);
    const n = revision.current;
    try {
      let request = supabase
        .from("listing_public_cards")
        .select("*", { count: "exact" })
        .eq("owner_id", id)
        .eq("status", "active");
      if (category) request = request.eq("category", category);
      if (search)
        request = request.ilike(
          "title",
          `%${search.replace(/[\\%_]/g, "\\$&")}%`,
        );
      if (openOnly)
        request = request.in("partnership_mode", ["open", "approval"]);
      const { data, error } = await (
        sort === STORE_ORDER_SORT
          ? request
              .order(STORE_RANK_COLUMN, { ascending: true, nullsFirst: true })
              .order("created_at", { ascending: false })
          : request.order(sort === "En yeni" ? "created_at" : "price", {
              ascending: sort === "Fiyat: düşükten yükseğe",
            })
      )
        .order("id")
        .range(listings.length, listings.length + 23);
      if (error) throw error;
      if (n === revision.current)
        setListings((old) => [
          ...new Map(
            [...old, ...(data as PublicListingCardRow[]).map(mapListing)].map(
              (l) => [l.id, l],
            ),
          ).values(),
        ]);
    } catch {
      if (n === revision.current) setError("Diğer ilanlar yüklenemedi.");
    } finally {
      moreLock.current = false;
      setMoreBusy(false);
    }
  }
  const loadReviews = async (offset = 0) => {
    if (!supabase || (offset && reviewLock.current)) return;
    reviewLock.current = true;
    const n = ++reviewRevision.current,
      key = reviewQuery.current;
    try {
      let request = supabase
        .from("reviews")
        .select(
          "*,reviewer:profiles!reviews_reviewer_id_fkey(full_name,avatar_url)",
          { count: "exact" },
        )
        .eq("reviewed_user_id", id)
        .is("deleted_at", null);
      if (reviewType !== "Tümü")
        request = request.eq(
          "type",
          reviewType === "Ortak Yorumları" ? "partner" : "seller",
        );
      const { data, error, count } = await request
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 23);
      if (error) throw error;
      if (n !== reviewRevision.current || key !== reviewQuery.current) return;
      setReviews((old) =>
        offset
          ? [
              ...new Map(
                [...old, ...(data || []).map(mapReviewRow)].map((r) => [
                  r.id,
                  r,
                ]),
              ).values(),
            ]
          : (data || []).map(mapReviewRow),
      );
      setReviewTotal(count || 0);
      setReviewLoaded(true);
    } catch {
      if (n === reviewRevision.current && key === reviewQuery.current)
        setError("Değerlendirmeler yüklenemedi. Tekrar dene.");
    } finally {
      if (n === reviewRevision.current) reviewLock.current = false;
    }
  };
  useEffect(() => {
    if (tab === "Değerlendirmeler") {
      setReviewLoaded(false);
      setReviews([]);
      void loadReviews();
    }
    return () => {
      reviewRevision.current++;
      reviewLock.current = false;
    };
    // Each tab/filter transition loads its own first review page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, reviewType, id, retry]);
  useEffect(() => {
    if (tab !== "Değerlendirmeler") return;
    let alive = true;
    setReviewStats(null);
    void fetchRatingStats({
      userId: id,
      type:
        reviewType === "Tümü"
          ? undefined
          : reviewType === "Ortak Yorumları"
            ? "partner"
            : "seller",
    }).then((stats) => {
      if (alive) setReviewStats(stats);
    });
    return () => {
      alive = false;
    };
  }, [tab, reviewType, id, retry, statsTick]);
  function follow() {
    if (!store.isAuthenticated) {
      router.push("/auth");
      return;
    }
    store.toggleFollow(id);
  }
  async function message() {
    if (!store.isAuthenticated) {
      router.push("/auth");
      return;
    }
    if (messageBusy || !supabase) return;
    setMessageBusy(true);
    try {
      let listing = listings[0];
      if (!listing) {
        const { data, error } = await supabase
          .from("listing_public_cards")
          .select("*")
          .eq("owner_id", id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        if (data?.[0]) listing = mapListing(data[0] as PublicListingCardRow);
      }
      if (!listing) {
        showToast("Bu satıcının mesaj başlatılabilecek yayında ilanı yok.");
        return;
      }
      const conversation = store.startConversation(listing.id, id, "", listing);
      if (conversation) router.push(`/chat/${conversation.id}` as never);
      else showToast("Mesaj başlatılamadı.");
    } catch {
      showToast("Satıcının ilanı yüklenemedi. Tekrar dene.");
    } finally {
      setMessageBusy(false);
    }
  }
  const canReviewSeller = store.sales.some(
    (s) =>
      store.canReviewSale(s.id) &&
      (store.listings.find((l) => l.id === s.listingId)?.ownerId === id ||
        store.partnerships.find((p) => p.id === s.partnershipId)?.partnerId ===
          id),
  );
  // IZGARA: telefon 2 sütun (değişmedi). 600 dp+ ekranda sütun sayısı genişlikten türetilir — kart en az 160 dp:
  // 600-699 dp → 3 sütun (182-215 dp), 768 → 4, 960-1180 → 5. Eskiden 700 dp'de sabit 4 sütundu (≈147 dp) ve eşik
  // 600'e inseydi ≈128 dp'lik kartlar çıkardı. Sayfa ≤1040 dp: geniş tablette kenardan kenara yayılmaz.
  const pageWidth = wide ? Math.min(maxWidth, mobileContent.page) : maxWidth;
  const cardWidth = wide
    ? responsiveGrid({
        available: pageWidth - 32,
        minCardWidth: 160,
        gap: 10,
        minColumns: 3,
        maxColumns: 6,
      }).cardWidth
    : Math.floor((maxWidth - 32 - 10) / 2);
  // Form/okuma blokları (düğmeler, arama, yorumlar, hakkında) geniş ekranda okunabilir genişlikte kalır;
  // içerik zaten ≈560-620 dp ise (600 dp ekran) ızgarayla hizalı tam genişlikte bırakılır.
  const narrowBlock =
      wide && pageWidth - 32 > 620
        ? { maxWidth: 560, width: "100%" as const }
        : undefined,
    readBlock = wide
      ? { maxWidth: mobileContent.pane, width: "100%" as const }
      : undefined;
  if (!seller && !profileLoaded)
    return (
      <MobileScreen title="Satıcı Mağazası">
        <Text style={ms.muted}>Mağaza yükleniyor…</Text>
      </MobileScreen>
    );
  if (!seller)
    return (
      <MobileScreen title="Satıcı Mağazası">
        <MobileCard>
          <Text style={ms.section}>{error || "Satıcı bulunamadı"}</Text>
          <MobileButton secondary onPress={() => setRetry((v) => v + 1)}>
            Tekrar Dene
          </MobileButton>
        </MobileCard>
      </MobileScreen>
    );
  return (
    <MobileScreen
      title={own ? "Mağazam" : "Satıcı Mağazası"}
      contentStyle={[{ paddingHorizontal: 0 }, wide && { maxWidth: pageWidth }]}
      right={
        <View style={ms.row}>
          <IconButton
            name="share-variant"
            label="Mağazayı paylaş"
            onPress={() => {
              void shareOrCopy({
                title: `${seller.name} — OrtakSat`,
                url: `https://www.ortaksat.com/store/${id}`,
              }).then((result) => {
                if (result === "copied") showToast("Bağlantı kopyalandı.");
                if (result === "failed")
                  showToast("Paylaşılamadı. Lütfen tekrar dene.");
              });
            }}
          />
          <IconButton
            name="dots-horizontal"
            label="Satıcı seçenekleri"
            onPress={() => setMenu(true)}
          />
        </View>
      }
      bottom={<MobileBottomNav />}
    >
      <ProfileCoverImage
        uri={seller.cover}
        priority="high"
        style={{
          width: "100%",
          height: wide ? 150 : 120,
          borderRadius: tablet ? 14 : 0,
        }}
      />
      <View style={{ padding: 16 }}>
        <View style={[ms.row, { marginTop: -40, alignItems: "flex-end" }]}>
          <View
            style={{ borderWidth: 3, borderColor: "white", borderRadius: 50 }}
          >
            <UserAvatar uri={seller.avatar} name={seller.name} size={83} />
          </View>
          <View style={{ flex: 1, paddingTop: 38, gap: 5 }}>
            <Text
              style={{ fontSize: 23, fontWeight: "800", color: mobile.ink }}
            >
              {seller.name} {seller.verifiedIdentity ? "✓" : ""}
            </Text>
            {!!seller.username && (
              <Text style={ms.muted}>@{seller.username}</Text>
            )}
            {!!seller.city && (
              <Text style={ms.muted}>
                ⌖ {seller.city}
                {seller.districtId
                  ? ` / ${getDistrict(seller.districtId)?.name || ""}`
                  : ""}
              </Text>
            )}
            {!!activityLabel && (
              <Text style={{ color: mobile.teal, fontSize: 12, fontWeight: "700" }}>{activityLabel}</Text>
            )}
          </View>
        </View>
        {/* Mağaza özeti: puan · takipçi · ilan · satış. Tek satır, eşit sütun; puana dokununca değerlendirmeler açılır. */}
        <View
          style={[
            {
              flexDirection: "row",
              backgroundColor: "white",
              borderWidth: 1,
              borderColor: mobile.line,
              borderRadius: 13,
              paddingVertical: 10,
              marginVertical: 13,
            },
            narrowBlock,
          ]}
        >
          {(
            [
              [seller.rating > 0 ? `★ ${seller.rating.toFixed(1)}` : "Yeni", "Puan", () => setTab("Değerlendirmeler")],
              [String(store.findUser(id)?.followerCount ?? seller.followerCount ?? 0), "Takipçi", undefined],
              [allTotal === null ? "…" : String(allTotal), "İlan", () => setTab("İlanlar")],
              [String(seller.successfulSales || 0), "Satış", undefined],
            ] as [string, string, (() => void) | undefined][]
          ).map(([value, label, onPress], index) => (
            <Pressable
              key={label}
              accessibilityRole={onPress ? "button" : undefined}
              accessibilityLabel={`${label}: ${value}`}
              disabled={!onPress}
              onPress={onPress}
              style={{
                flex: 1,
                alignItems: "center",
                gap: 2,
                borderLeftWidth: index ? 1 : 0,
                borderColor: mobile.line,
              }}
            >
              <Text style={{ color: mobile.ink, fontSize: 16, fontWeight: "800" }}>
                {value}
              </Text>
              <Text style={{ color: mobile.muted, fontSize: 11 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {/* Güven rozetleri (telefon / kimlik / Instagram doğrulaması, çok satan) + satışa göre profil seviyesi —
            web mağaza sayfasındakiyle aynı kaynak (lib/verification.ts, components/partner-tier.tsx). */}
        <View style={[{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 12 }, narrowBlock]}>
          {(() => { const level = tierFromCount(seller.successfulSales || 0); return (
            <View accessibilityLabel={`Profil seviyesi: ${level.label}`} style={{ alignItems: "center", backgroundColor: level.tint, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Icon name={level.icon} size={12} color={level.color} />
              <Text style={{ color: level.color, fontSize: 10.5, fontWeight: "800" }}>{level.label}</Text>
            </View>
          ); })()}
          <VerificationBadges user={seller} size="sm" />
        </View>
        {own && (
          <View style={[ms.row, { marginBottom: 14 }, narrowBlock]}>
            <MobileButton
              icon="format-list-bulleted"
              style={{ flex: 1 }}
              onPress={() => router.push("/seller" as never)}
            >
              İlanları Yönet
            </MobileButton>
            <MobileButton
              secondary
              icon="pencil"
              style={{ flex: 1 }}
              onPress={() => router.push("/profile-edit" as never)}
            >
              Mağazayı Düzenle
            </MobileButton>
          </View>
        )}
        {!own && (
          <View style={[ms.row, { marginBottom: 14 }, narrowBlock]}>
            <MobileButton
              secondary
              icon="account-plus"
              style={{ flex: 1 }}
              onPress={follow}
            >
              {store.isFollowing(id) ? "Takibi Bırak" : "Takip Et"}
            </MobileButton>
            <MobileButton
              icon="chat-outline"
              style={{ flex: 1 }}
              disabled={messageBusy}
              onPress={() => void message()}
            >
              {messageBusy ? "İlan yükleniyor…" : "Mesaj Gönder"}
            </MobileButton>
          </View>
        )}
        <View style={[ms.row, { marginVertical: 6 }]}>
          {["İlanlar", "Değerlendirmeler", "Hakkında"].map((label) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === label }}
              accessibilityLabel={label}
              key={label}
              onPress={() => setTab(label)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderBottomWidth: 3,
                borderColor: tab === label ? mobile.teal : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  textAlign: "center",
                  fontWeight: "700",
                  color: tab === label ? mobile.teal : mobile.muted,
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {/* !!: boş metin ("") görünümün içine çocuk olarak düşmesin */}
        {!!error && (
          <MobileCard>
            <Text style={ms.error}>{error}</Text>
            <MobileButton secondary onPress={() => setRetry((v) => v + 1)}>
              Tekrar Dene
            </MobileButton>
          </MobileCard>
        )}
        <TrustEntry userId={id} />
        {tab === "İlanlar" && (
          <>
            <HorizontalScroll
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 7, paddingVertical: 10 }}
            >
              <MobileChip
                label={`Tümü (${categories.reduce((n, c) => n + c.value, 0)})`}
                selected={!category}
                onPress={() => setCategory("")}
              />
              {categories.map((c) => (
                <MobileChip
                  key={c.label}
                  label={`${c.label} (${c.value})`}
                  selected={category === c.label}
                  onPress={() => setCategory(c.label)}
                />
              ))}
            </HorizontalScroll>
            {categoryError && (
              <MobileChip
                label="Kategorileri Yenile"
                icon="refresh"
                onPress={() => setRetry((v) => v + 1)}
              />
            )}
            <View
              style={[
                ms.row,
                {
                  borderWidth: 1,
                  borderColor: mobile.line,
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  marginVertical: 12,
                },
                narrowBlock,
              ]}
            >
              <Icon name="magnify" size={21} color={mobile.muted} />
              <TextInput
                accessibilityLabel="Mağaza içinde ara"
                value={query}
                onChangeText={setQuery}
                placeholder="Mağaza içinde ara…"
                style={{ minHeight: 44, flex: 1, color: mobile.ink }}
              />
            </View>
            <View style={[ms.row, { marginBottom: 12 }, narrowBlock]}>
              <MobileChip
                label="Ortaklığa Açık"
                selected={openOnly}
                onPress={() => setOpenOnly((v) => !v)}
              />
              <MobileSelect
                value={sort}
                options={[
                  STORE_ORDER_SORT,
                  "En yeni",
                  "Fiyat: düşükten yükseğe",
                  "Fiyat: yüksekten düşüğe",
                ]}
                onChange={setSort}
              />
            </View>
            <Text style={[ms.section, { marginBottom: 12 }]}>
              {loading ? "İlanlar yükleniyor…" : `Tüm İlanlar (${total})`}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {listings.map((l) => (
                <StoreCard key={l.id} listing={l} width={cardWidth} />
              ))}
            </View>
            {!listings.length && !loading && !error && (
              <MobileCard>
                <Text style={ms.muted}>
                  Bu kriterlerde yayında ilan bulunmuyor.
                </Text>
              </MobileCard>
            )}
            {listings.length < total && !loading && (
              <MobileButton
                secondary
                disabled={moreBusy}
                style={
                  wide
                    ? {
                        alignSelf: "center",
                        marginTop: 12,
                        maxWidth: 560,
                        width: "100%",
                      }
                    : undefined
                }
                onPress={() => void more()}
              >
                {moreBusy ? "Yükleniyor…" : "Diğer İlanları Göster"}
              </MobileButton>
            )}
          </>
        )}
        {tab === "Hakkında" && (
          <MobileCard style={readBlock}>
            <Text style={ms.section}>Hakkında</Text>
            <Text style={{ color: mobile.muted, lineHeight: 21 }}>
              {seller.bio || "Satıcı henüz hakkında bilgisi eklememiş."}
            </Text>
            {!!seller.website && (
              <MobileButton
                secondary
                onPress={() => {
                  void openUrlSafe(seller.website!);
                }}
              >
                Web Sitesi
              </MobileButton>
            )}
            {!!seller.instagram && (
              <MobileButton
                secondary
                onPress={() => {
                  void openUrlSafe(
                    `https://www.instagram.com/${encodeURIComponent(seller.instagram!)}/`,
                  );
                }}
              >
                Instagram
              </MobileButton>
            )}
            {!!seller.createdAt && (
              <Text style={ms.muted}>
                Üyelik:{" "}
                {new Date(seller.createdAt).toLocaleDateString("tr-TR", {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            )}
            {seller.expertiseCategories?.length ? (
              <Text style={ms.muted}>
                Uzmanlık: {seller.expertiseCategories.join(", ")}
              </Text>
            ) : null}
            <MobileButton
              secondary
              onPress={() =>
                router.push({
                  pathname: "/store/[id]",
                  params: { id, view: "advanced" },
                } as never)
              }
            >
              Diğer Mağaza Bilgileri
            </MobileButton>
          </MobileCard>
        )}
        {tab === "Değerlendirmeler" && (
          <View style={readBlock}>
            <Text style={[ms.section, { marginVertical: 12 }]}>
              Kullanıcı Yorumları ({reviewLoaded ? reviewTotal : "…"})
            </Text>
            <View style={[ms.wrap, { marginBottom: 13 }]}>
              {["Tümü", "Satıcı Yorumları", "Ortak Yorumları"].map((label) => (
                <MobileChip
                  key={label}
                  label={label}
                  selected={label === reviewType}
                  onPress={() => setReviewType(label)}
                />
              ))}
            </View>
            {reviewStats && reviewStats.count > 0 && (
              <View style={{ marginBottom: 12 }}>
                <RatingSummary stats={reviewStats} />
              </View>
            )}
            {!own && canReviewSeller && (
              <MobileButton
                secondary
                icon="pencil"
                onPress={() =>
                  router.push({
                    pathname: "/review",
                    params: { userId: id },
                  } as never)
                }
              >
                Yorum Yap ve Değerlendir
              </MobileButton>
            )}
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                reviewerName={review.reviewerName}
                isSeller={own}
                authed={store.isAuthenticated}
                isMine={review.reviewerId === store.currentUser.id}
                onPatch={(rid, patch) => {
                  setReviews((old) =>
                    old.map((r) => (r.id === rid ? { ...r, ...patch } : r)),
                  );
                  if (patch.rating !== undefined) setStatsTick((v) => v + 1);
                }}
                onRemove={(rid) => {
                  setReviews((old) => old.filter((r) => r.id !== rid));
                  setReviewTotal((n) => Math.max(0, n - 1));
                  setStatsTick((v) => v + 1);
                }}
                onEdit={store.editReview}
                onDelete={store.deleteReview}
                onReport={store.reportReview}
                language="tr"
              />
            ))}
            {reviewLoaded && !reviews.length && !error && (
              <Text style={ms.muted}>
                {reviewType === "Tümü"
                  ? "Henüz değerlendirme yok. Değerlendirmeler yalnızca tamamlanmış bir satışın taraflarınca yazılabilir."
                  : "Bu grupta henüz değerlendirme yok."}
              </Text>
            )}
            {reviews.length < reviewTotal && (
              <MobileButton
                secondary
                onPress={() => void loadReviews(reviews.length)}
              >
                Diğer Yorumları Göster
              </MobileButton>
            )}
          </View>
        )}
      </View>
      <BlockUserSheet
        target={blockOpen ? seller : null}
        onClose={() => setBlockOpen(false)}
      />
      <OptionSheet
        visible={menu}
        title="Satıcı seçenekleri"
        options={
          own
            ? ["Profilimi Düzenle"]
            : [
                "Kullanıcıyı Şikâyet Et",
                "Kullanıcıyı Engelle",
                "Diğer Mağaza Bilgileri",
              ]
        }
        onClose={() => setMenu(false)}
        onSelect={(value) => {
          setMenu(false);
          if (value === "Kullanıcıyı Engelle") {
            if (!store.isAuthenticated) router.push("/auth");
            else setBlockOpen(true);
            return;
          }
          router.push(
            (value === "Profilimi Düzenle"
              ? "/profile-edit"
              : value === "Kullanıcıyı Şikâyet Et"
                ? `/report?userId=${id}`
                : `/store/${id}?view=advanced`) as never,
          );
        }}
      />
    </MobileScreen>
  );
}
function StoreCard({ listing: l, width }: { listing: Listing; width: number }) {
  const router = useRouter(),
    { isFav, toggle } = useFavoriteFlag(l.id);
  const valid =
    l.commissionValue > 0 &&
    (l.commissionType !== "rate" || l.commissionValue <= 90);
  return (
    <View
      style={{
        width,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: mobile.line,
        backgroundColor: "white",
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={displayListingTitle(l.title)}
        onPress={() => router.push(`/listing/${l.id}` as never)}
      >
        <SafeRemoteImage
          uri={l.imageUrl || l.image}
          style={{
            width: "100%",
            height: (width - 2) / LISTING_GRID_PHOTO_RATIO,
          }}
        />
        <View style={{ padding: 4, gap: 1, height: 96 }}>
          <Text
            numberOfLines={2}
            style={{
              fontSize: 12,
              lineHeight: 14,
              height: 28,
              fontWeight: "700",
              color: mobile.ink,
            }}
          >
            {displayListingTitle(l.title)}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              height: 20,
              lineHeight: 20,
              fontSize: cardPriceFontSize(
                moneyIn(l.price, l.currency),
                width - 8,
                18,
              ),
              fontWeight: "800",
              color: mobile.teal,
            }}
          >
            {moneyIn(l.price, l.currency)}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 9.5,
              color: mobile.muted,
              height: 12,
              lineHeight: 12,
            }}
          >
            ⌖ {l.location}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 9.5,
              color: mobile.teal,
              height: 18,
              lineHeight: 18,
              fontWeight: "700",
            }}
          >
            {l.partnershipMode === "none"
              ? "Satış ilanı"
              : valid
                ? `Komisyon ${l.commissionType === "rate" ? `%${l.commissionValue}` : moneyIn(l.commissionValue, l.currency)}`
                : "Komisyonu satıcıya sor"}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${displayListingTitle(l.title)} favori`}
        onPress={toggle}
        style={{
          position: "absolute",
          top: 5,
          right: 5,
          backgroundColor: "#14203066",
          borderRadius: 18,
          padding: 4,
        }}
      >
        <Icon
          name={isFav ? "heart" : "heart-outline"}
          size={22}
          color={isFav ? "#FF728B" : "white"}
        />
      </Pressable>
    </View>
  );
}
