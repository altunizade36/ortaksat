import { marketplaceCardGrid } from "@/lib/card-layout";
import { TrustEntry } from "@/components/trust/entry";
import { PartnershipWebLayout } from "@/components/partnership-web-layout";
import { PAGE_MAX_WIDTH } from "@/components/web-container";
import { colors } from "@/components/colors";
import { displayListingTitle } from "@/lib/listing-title";
import { HorizontalScroll } from "@/components/horizontal-scroll";
import { isMobileApp } from "@/lib/mobile-app";
import { WebFooter } from "@/components/web-landing";
import { MobileEarnings } from "./earnings";
import { potentialCommission } from "@/lib/mobile-listing";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { openUrlSafe } from "@/lib/link";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { useStore } from "@/lib/use-store";
import { fetchMobileCatalogue } from "@/lib/mobile-catalogue-service";
import { fetchListingsByIds } from "@/lib/supabase-data";
import { emptyMobileFilters } from "@/lib/mobile-filters";
import { categoryByPrefix, categoryTrail } from "@/lib/mobile-catalog";
import { adDisclosureLine, moneyIn } from "@/lib/format";
import { partnershipStatusLabels } from "@/lib/status-labels";
import { showToast } from "@/lib/toast";
import { shareOrCopy } from "@/lib/share";
import { Alert } from "@/lib/alert";
import type { Listing, Partnership } from "@/lib/types";
import { MobileFilter } from "./catalogue";
import { PartnershipListingCard } from "./partnership-listing-card";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { MobileBrand } from "@/components/mobile-brand";
import type { CategoryNode } from "@/lib/category-tree";
import { mobileCategories } from "@/lib/mobile-catalog";
import { CategoryArtwork } from "./categories";
import {
  MobileButton,
  MobileCard,
  MobileChip,
  MobileField,
  MobileScreen,
  MobileSelect,
  mobile,
  ms,
  useMobileLayout,
} from "./ui";
// Durum rengi: eskiden HER durum (reddedildi/sonlandırıldı dahil) marka mavisiyle yazılıyordu.
const statusColor: Record<string, string> = {
  active: mobile.teal,
  pending: colors.goldInk,
  rejected: colors.accent,
  blocked: colors.accent,
  cancelled: mobile.muted,
  completed: mobile.muted,
};
// Kısa durum etiketi — tek kaynak lib/status-labels.ts (profil ve detay ekranlarıyla aynı).
const status: Record<string, string> = partnershipStatusLabels;
export function MobilePartnershipHub() {
  const store = useStore(),
    router = useRouter(),
    params = useLocalSearchParams<{
      tab?: string;
      listingId?: string;
      focus?: string;
    }>(),
    { maxWidth, tablet, width } = useMobileLayout();
  const desktop = !isMobileApp && width >= 1000;
  // PartnershipWebLayout ile AYNI ölçü (1280 ortalı, 20px kenar). Izgara genişliği onLayout ile
  // ÖLÇÜLÜR: window.innerWidth kaydırma çubuğunu da sayar → hesaplanan kart genişliği gerçek
  // kaptan ~9-17px geniş çıkıp her satırın son kartı alta düşüyor, sağda boşluk kalıyordu.
  const pageWidth = Math.min(width, PAGE_MAX_WIDTH) - 40;
  const [gridWidth, setGridWidth] = useState(0);
  const listingGrid = marketplaceCardGrid({
    available: gridWidth || (desktop ? pageWidth : maxWidth - 32),
    gap: desktop ? 14 : 10,
    minCardWidth: desktop ? 170 : 142,
    maxCardWidth: 210,
    minColumns: 2,
    maxColumns: desktop ? 7 : tablet ? 4 : 2,
  });
  const Screen = desktop ? PartnershipWebLayout : MobileScreen;
  const [tab, setTab] = useState(
      ["requests", "pending"].includes(params.tab || "")
        ? "Talepler"
        : ["active", "links"].includes(params.tab || "") // "links" = Paylaşım bağlantılarım: bağlantılar ortaklık kartlarındadır
          ? "Ortaklıklarım"
          : params.tab === "earnings"
            ? "Kazançlar"
            : "Keşfet",
    ),
    // ?tab=pending = "Ortaklık taleplerim" (GÖNDERDİĞİM başvurular); ?tab=requests = gelen talepler.
    // Eskiden ikisi de "Gelen"e düşüyordu → başvuran ortak boş liste görüyordu.
    [requestTab, setRequestTab] = useState(
      params.tab === "pending" ? "Gönderdiğim" : "Gelen",
    ),
    [filter, setFilter] = useState("Tümü"),
    [category, setCategory] = useState("Tümü"),
    [sort, setSort] = useState("Önerilen"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [rows, setRows] = useState<Listing[]>([]),
    [extra, setExtra] = useState<Listing[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState<string | null>(null),
    // "Ortaklıklarım"da hangi taraf: ortak olduğum ilanlar / ilanlarımdaki ortaklar (null = otomatik).
    [side, setSide] = useState<"partner" | "owner" | null>(null),
    [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    setTab(
      ["requests", "pending"].includes(params.tab || "")
        ? "Talepler"
        : ["active", "links"].includes(params.tab || "") // "links" = Paylaşım bağlantılarım: bağlantılar ortaklık kartlarındadır
          ? "Ortaklıklarım"
          : params.tab === "earnings"
            ? "Kazançlar"
            : "Keşfet",
    );
    setFilter("Tümü");
    if (params.tab === "pending") setRequestTab("Gönderdiğim");
    else if (params.tab === "requests") setRequestTab("Gelen");
  }, [params.tab, params.listingId]);
  const [filters, setFilters] = useState(emptyMobileFilters),
    [filterOpen, setFilterOpen] = useState(false),
    [selectedTrail, setSelectedTrail] = useState<CategoryNode[] | null>(null);
  const revision = useRef(0),
    loadingMore = useRef(false);
  const [moreBusy, setMoreBusy] = useState(false),
    [moreError, setMoreError] = useState("");
  const my = store.partnerships.filter(
      (p) => p.partnerId === store.currentUser.id,
    ),
    ownIds = new Set(
      store.listings
        .filter((l) => l.ownerId === store.currentUser.id)
        .map((l) => l.id),
    ),
    ownerMode = !!params.listingId && ownIds.has(params.listingId);
  const incoming = store.partnerships.filter(
      (p) =>
        ownIds.has(p.listingId) &&
        (!params.listingId || p.listingId === params.listingId),
    ),
    missing = [...new Set(my.map((p) => p.listingId))]
      .filter((id) => !store.listings.some((l) => l.id === id))
      .sort()
      .join(",");
  useEffect(() => {
    let active = true;
    if (missing)
      void fetchListingsByIds(missing.split(","))
        .then((data) => {
          if (active) {
            if (data) setExtra(data.listings);
            else setError("Bazı ortaklık ilanları yüklenemedi.");
          }
        })
        .catch(() => {
          if (active) setError("Bazı ortaklık ilanları yüklenemedi.");
        });
    return () => {
      active = false;
    };
  }, [missing, retry]);
  const listings = new Map([...extra, ...store.listings].map((l) => [l.id, l]));
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  function criteria() {
    const node =
      category === "Tümü"
        ? undefined
        : categoryByPrefix(store.categoryTree, category);
    return {
      trail:
        selectedTrail ??
        (node ? categoryTrail(store.categoryTree, node.slug) : []),
      filters: { ...filters, open: true },
      query: search,
      sort:
        sort === "En Yeni"
          ? "newest"
          : sort === "Yüksek Komisyon"
            ? "commission"
            : sort === "Popüler"
              ? "popular"
              : "recommended",
    };
  }
  const criteriaKey = JSON.stringify({
    category,
    sort,
    search,
    filters,
    selectedTrail,
  });
  useEffect(() => {
    if (tab !== "Keşfet") return;
    const n = ++revision.current;
    setLoading(true);
    setError("");
    setMoreError("");
    setMoreBusy(false);
    setRows([]);
    setTotal(0);
    void fetchMobileCatalogue(criteria())
      .then((data) => {
        if (n === revision.current) {
          setRows(data.listings);
          setTotal(data.total);
        }
      })
      .catch(() => {
        if (n === revision.current) setError("Ortaklık ilanları yüklenemedi.");
      })
      .finally(() => {
        if (n === revision.current) setLoading(false);
      });
    return () => {
      revision.current++;
    };
    // Query criteria are explicitly listed to prevent a stale result overwriting a new search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, criteriaKey, retry, store.categoryTree.length]);
  async function more() {
    if (loadingMore.current || loading) return;
    loadingMore.current = true;
    setMoreBusy(true);
    setMoreError("");
    const n = revision.current;
    try {
      const data = await fetchMobileCatalogue({
        ...criteria(),
        offset: rows.length,
      });
      if (n === revision.current) {
        setRows((old) => [
          ...new Map([...old, ...data.listings].map((l) => [l.id, l])).values(),
        ]);
        setTotal(data.total);
      }
    } catch {
      if (n === revision.current)
        setMoreError(
          "Diğer ilanlar yüklenemedi. Açık olan ilanların korunuyor.",
        );
    } finally {
      loadingMore.current = false;
      if (n === revision.current) setMoreBusy(false);
    }
  }

  async function decide(p: Partnership, approve: boolean) {
    if (busy) return;
    setBusy(p.id);
    setError("");
    try {
      const ok = approve
        ? await store.approvePartnership(p.id)
        : await store.rejectPartnership(p.id);
      if (!ok)
        setError(
          "Talep güncellenemedi. Kontenjanı ve bağlantını kontrol et; talep korunuyor.",
        );
    } catch {
      setError("Talep güncellenemedi. Tekrar dene.");
    } finally {
      setBusy(null);
    }
  }
  // Karşı tarafla sohbet (ortak → satıcı, satıcı → ortak). Ortaklık detayındaki düğmeyle aynı davranış.
  function message(l: Listing | undefined, receiverId: string) {
    if (!l || !receiverId) return;
    const conversation = store.startConversation(l.id, receiverId, "", l);
    if (conversation) router.push(`/chat/${conversation.id}` as never);
    else showToast("Mesaj başlatılamadı. Lütfen tekrar dene.");
  }
  // Ortağın paylaşım metni: reklam bildirimi (zorunlu) + ilan adı + fiyat. Bağlantı düz ilan sayfasıdır.
  function shareText(l: Listing) {
    const lead =
      l.ownerId === store.currentUser.id
        ? ""
        : `${adDisclosureLine(store.findUser(l.ownerId)?.name)}\n`;
    return `${lead}${displayListingTitle(l.title)}${l.price > 0 ? ` — ${moneyIn(l.price, l.currency)}` : ""}`;
  }
  function share(l: Listing) {
    void shareOrCopy({
      title: displayListingTitle(l.title),
      message: shareText(l),
      url: `https://www.ortaksat.com/listing/${l.id}`,
    }).then((result) => {
      if (result === "copied") showToast("Bağlantı kopyalandı.");
      if (result === "failed") showToast("Paylaşılamadı. Lütfen tekrar dene.");
    });
  }
  function shareWhatsapp(l: Listing) {
    const text = `${shareText(l)}\nhttps://www.ortaksat.com/listing/${l.id}`;
    void openUrlSafe(`https://wa.me/?text=${encodeURIComponent(text)}`).then(
      (ok) => {
        if (!ok) showToast("WhatsApp açılamadı. Paylaş düğmesini kullan.");
      },
    );
  }
  function pCard(p: Partnership) {
    const l = listings.get(p.listingId),
      other = store.findUser(asOwner ? p.partnerId : l?.ownerId || ""),
      commission = l ? potentialCommission(l, p) : null,
      active = p.status === "active";
    return (
      <MobileCard key={p.id}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ortaklık detayı: ${l ? displayListingTitle(l.title) : "ilan"}`}
          onPress={() => router.push(`/partnership/${p.id}` as never)}
          style={ms.row}
        >
          <SafeRemoteImage
            uri={l?.imageUrl || l?.image}
            style={{ width: 68, height: 68, borderRadius: 9 }}
          />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text numberOfLines={2} style={ms.section}>
              {l ? displayListingTitle(l.title) : "Ortaklık ilanı"}
            </Text>
            {l && l.price > 0 && (
              <Text style={{ color: mobile.teal, fontWeight: "800" }}>
                {moneyIn(l.price, l.currency)}
              </Text>
            )}
            <Text numberOfLines={1} style={ms.muted}>
              {asOwner ? "Ortak" : "Satıcı"}: {other?.name || "Kullanıcı"}
            </Text>
          </View>
          <Text
            style={{
              color: statusColor[p.status] || mobile.muted,
              fontSize: 11,
              fontWeight: "700",
              alignSelf: "flex-start",
            }}
          >
            {status[p.status]}
          </Text>
        </Pressable>
        {l && active && (
          <View
            style={[
              ms.row,
              {
                justifyContent: "space-between",
                backgroundColor: mobile.tealSoft,
                borderRadius: 9,
                paddingHorizontal: 10,
                paddingVertical: 8,
              },
            ]}
          >
            <Text style={[ms.muted, { flex: 1 }]}>
              {asOwner ? "Satışta ödeyeceğin komisyon" : "Satışta kazancın"}
            </Text>
            <Text style={{ color: mobile.darkTeal, fontWeight: "800" }}>
              {commission === null
                ? "Satıcıyla netleştir"
                : moneyIn(commission, l.currency)}
            </Text>
          </View>
        )}
        {l && active && !asOwner && (
          <View style={ms.row}>
            <MobileButton
              icon="share-variant"
              style={{ flex: 1 }}
              onPress={() => share(l)}
            >
              Paylaş
            </MobileButton>
            <MobileButton
              secondary
              icon="whatsapp"
              style={{ flex: 1 }}
              onPress={() => shareWhatsapp(l)}
            >
              WhatsApp
            </MobileButton>
          </View>
        )}
        <View style={ms.row}>
          {l && active && (
            <MobileButton
              secondary
              icon="chat-outline"
              style={{ flex: 1 }}
              onPress={() => message(l, asOwner ? p.partnerId : l.ownerId)}
            >
              {asOwner ? "Ortağa Yaz" : "Satıcıya Yaz"}
            </MobileButton>
          )}
          <MobileButton
            secondary
            style={{ flex: 1 }}
            onPress={() => router.push(`/partnership/${p.id}` as never)}
          >
            {asOwner ? "Ortaklığı Yönet" : "Detay"}
          </MobileButton>
        </View>
        {asOwner && (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(`/store/${p.partnerId}` as never)}
            hitSlop={6}
          >
            <Text style={{ color: mobile.teal, fontSize: 12, fontWeight: "700" }}>
              Ortağın profilini gör
            </Text>
          </Pressable>
        )}
      </MobileCard>
    );
  }
  // TALEP ile ORTAKLIK AYRI: "Talepler" yalnız karar bekleyen/reddedilen başvurulardır; onaylanan başvuru
  // "Ortaklıklarım"a geçer. Eskiden aktif ortaklıklar da "Talepler"de "talep" diye listeleniyor, sayaçlar
  // (Gelen 2) bekleyen iş varmış gibi görünüyordu.
  const isRequest = (p: Partnership) => p.status === "pending" || p.status === "rejected";
  const byRecency = (a: Partnership, b: Partnership) =>
    (b.createdAt || "").localeCompare(a.createdAt || "");
  const pendingIncoming = incoming.filter((p) => p.status === "pending").length,
    pendingSent = my.filter((p) => p.status === "pending").length;
  const requestRows = (requestTab === "Gelen" ? incoming : my)
    .filter(isRequest)
    .sort(
      (a, b) =>
        Number(b.status === "pending") - Number(a.status === "pending") ||
        byRecency(a, b),
    );
  // "Ortaklıklarım": ortak olduğum ilanlar + (ilan sahibiysem) ilanlarımdaki ortaklar. Eskiden ilan sahibi
  // kendi ortaklarını yalnız tek tek ilanın yönetim ekranından görebiliyordu.
  const partnerSideAll = my.filter((p) => !isRequest(p)),
    ownerSideAll = incoming.filter((p) => !isRequest(p));
  const asOwner =
    ownerMode ||
    (ownerSideAll.length > 0 &&
      (side === "owner" || (side === null && partnerSideAll.length === 0)));
  const sideRows = asOwner ? ownerSideAll : partnerSideAll;
  const presentStatuses = Object.keys(status).filter((key) =>
    sideRows.some((p) => p.status === key),
  );
  const partnershipRows = sideRows
    .filter((p) => filter === "Tümü" || status[p.status] === filter)
    .sort(
      (a, b) =>
        Number(b.status === "active") - Number(a.status === "active") ||
        byRecency(a, b),
    );
  function goTab(label: string) {
    setTab(label);
    setFilter("Tümü");
    router.setParams({
      tab:
        label === "Talepler"
          ? "requests"
          : label === "Ortaklıklarım"
            ? "active"
            : label === "Kazançlar"
              ? "earnings"
              : "discover",
    });
  }
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await store.refreshUserData();
    } catch {
      /* liste eldeki haliyle kalır; hata kartı gerekirse aşağıda gösterilir */
    } finally {
      setRetry((v) => v + 1);
      setRefreshing(false);
    }
  }
  // Uygulamada bu ekranın ayrı bir başlık satırı YOK: logo satırı başlıktır, "Nasıl çalışır?" simgesi de
  // o satırın sağındadır (eskiden üstte "Ortak Satış" yazılı ikinci bir satır daha vardı — fazlalık).
  const brandHeader = isMobileApp && !ownerMode;
  const helpButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Nasıl Çalışır?"
      hitSlop={6}
      onPress={() => router.push("/nasil-calisir")}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name="help-circle-outline" size={26} color={mobile.teal} />
    </Pressable>
  );
  return (
    <Screen
      headerShown={!isMobileApp}
      footer={isMobileApp ? undefined : <WebFooter />}
      refreshControl={
        desktop ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={mobile.teal}
            colors={[mobile.teal]}
          />
        )
      }
      title={
        brandHeader
          ? ""
          : ownerMode
            ? "Ortaklık Yönetimi"
            : desktop
              ? tab === "Keşfet"
                ? "Ortaklık fırsatları"
                : tab === "Talepler"
                  ? "Ortaklık talepleri"
                  : tab === "Kazançlar"
                    ? "Kazançlarım"
                    : "Ortaklıklarım"
              : "Ortaklık fırsatları"
      }
      back={ownerMode}
      right={helpButton}
    >
      <TrustEntry />
      {brandHeader && (
        <View
          style={{ flexDirection: "row", alignItems: "center", paddingTop: 6 }}
        >
          <View style={{ width: 44 }} />
          <View style={{ flex: 1, alignItems: "center" }}>
            <MobileBrand size={30} />
          </View>
          {helpButton}
        </View>
      )}
      {desktop ? (
        <View
          accessibilityRole="tablist"
          style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}
        >
          {["Keşfet", "Talepler", "Ortaklıklarım", "Kazançlar"].map((label) => (
            <Pressable
              key={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === label }}
              onPress={() => goTab(label)}
              style={{
                minHeight: 38,
                justifyContent: "center",
                paddingHorizontal: 15,
                borderRadius: 9,
                borderWidth: 1,
                borderColor: tab === label ? mobile.teal : mobile.line,
                    backgroundColor: tab === label ? mobile.tealSoft : "white",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: tab === label ? "800" : "600",
                  color: tab === label ? mobile.darkTeal : mobile.muted,
                }}
              >
                {label === "Keşfet"
                  ? "Fırsatları keşfet"
                  : label === "Kazançlar"
                    ? "Kazançlarım"
                    : ownerMode && label === "Ortaklıklarım"
                      ? "Ortaklarım"
                      : label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <HorizontalScroll
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
          >
            {["Keşfet", "Talepler", "Ortaklıklarım", "Kazançlar"].map(
              (label) => (
                <MobileChip
                  key={label}
                  label={
                    ownerMode && label === "Ortaklıklarım"
                      ? "Ortaklarım"
                      : label === "Talepler" && pendingIncoming
                        ? `Talepler (${pendingIncoming})` // karar bekleyen gelen başvuru sayısı
                        : label
                  }
                  selected={tab === label}
                  onPress={() => goTab(label)}
                />
              ),
            )}
          </HorizontalScroll>
        </>
      )}
      {error && (
        <MobileCard>
          <Text accessibilityRole="alert" style={ms.error}>
            {error}
          </Text>
          <MobileButton secondary onPress={() => setRetry((v) => v + 1)}>
            Yenile
          </MobileButton>
        </MobileCard>
      )}
      {tab === "Keşfet" && (
        <>
          {isMobileApp && (
            <Text
              accessibilityRole="header"
              style={{
                color: mobile.ink,
                fontSize: 25,
                fontWeight: "800",
                marginBottom: 8,
              }}
            >
              Ortak Satış Fırsatları
            </Text>
          )}
          {!desktop && (
            <Text style={[ms.muted, { marginBottom: 14 }]}>
              Ortaklığa açık ilanları keşfet, satıcılara yardımcı ol, satış
              gerçekleşince anlaşmana göre komisyon kazan.
            </Text>
          )}
          <View style={[ms.row, desktop && { gap: 10 }]}>
            {desktop ? (
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  borderWidth: 1,
                  borderColor: mobile.line,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  backgroundColor: "white",
                }}
              >
                <Icon name="magnify" size={20} color={mobile.muted} />
                <TextInput
                  accessibilityLabel="Ortaklık ilanlarında ara"
                  placeholder="Ürün, kategori veya şehir ara"
                  value={query}
                  onChangeText={setQuery}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 44,
                    fontSize: 14,
                    color: mobile.ink,
                  }}
                />
              </View>
            ) : (
              <MobileField
                placeholder="Ortaklığa açık ilanlarda ara…"
                value={query}
                onChange={setQuery}
              />
            )}
            <MobileButton
              secondary
              icon="filter-variant"
              onPress={() => setFilterOpen(true)}
            >
              Filtrele
            </MobileButton>
          </View>
          {desktop ? (
            <View
              testID="partnership-web-categories"
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 7,
                paddingVertical: 12,
              }}
            >
              {[
                { label: "Tümü", match: "" },
                ...mobileCategories.filter((c) => c.match !== "all"),
              ].map((c) => (
                <Pressable
                  key={c.match || "all"}
                  accessibilityRole="button"
                  accessibilityLabel={`Ortaklık kategorisi: ${c.label}`}
                  accessibilityState={{
                    selected: category === (c.match || "Tümü"),
                  }}
                  onPress={() => {
                    setCategory(c.match || "Tümü");
                    setSelectedTrail(null);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    minHeight: 36,
                    justifyContent: "center",
                    borderRadius: 9,
                    borderWidth: 1,
                    borderColor:
                      category === (c.match || "Tümü")
                        ? mobile.teal
                        : mobile.line,
                    backgroundColor:
                      category === (c.match || "Tümü") ? mobile.tealSoft : "white",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight:
                        category === (c.match || "Tümü") ? "800" : "600",
                      color:
                        category === (c.match || "Tümü")
                          ? mobile.darkTeal
                          : mobile.ink,
                    }}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <>
              <HorizontalScroll
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 15 }}
              >
                {[
                  { label: "Tümü", match: "", tile: 15 },
                  ...mobileCategories.filter((c) => c.match !== "all"),
                ].map((c) => (
                  <Pressable
                    key={c.match || "all"}
                    accessibilityRole="button"
                    accessibilityLabel={`Ortaklık kategorisi: ${c.label}`}
                    accessibilityState={{
                      selected: category === (c.match || "Tümü"),
                    }}
                    onPress={() => {
                      setCategory(c.match || "Tümü");
                      setSelectedTrail(null);
                    }}
                    style={{ alignItems: "center", gap: 6, width: 72 }}
                  >
                    <View
                      style={{
                        backgroundColor:
                          category === (c.match || "Tümü")
                        ? mobile.tealSoft
                            : "#F0F4F8",
                        borderWidth: 1,
                        borderColor:
                          category === (c.match || "Tümü")
                            ? mobile.teal
                            : mobile.line,
                        borderRadius: 15,
                        width: 60,
                        height: 50,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CategoryArtwork tile={c.tile} size={36} />
                    </View>
                    <Text
                      numberOfLines={2}
                      style={{
                        fontSize: 10,
                        color: mobile.ink,
                        textAlign: "center",
                      }}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </HorizontalScroll>
            </>
          )}
          <HorizontalScroll
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7, paddingBottom: 14 }}
          >
            {["Önerilen", "Yüksek Komisyon", "En Yeni", "Popüler"].map(
              (label) => (
                <MobileChip
                  key={label}
                  label={label}
                  selected={sort === label}
                  onPress={() => setSort(label)}
                />
              ),
            )}
          </HorizontalScroll>
          {/* Tanıtım kartı yalnız HENÜZ ortaklığı olmayana: ortak olan kullanıcıda her açılışta ilanları aşağı itiyordu. */}
          {isMobileApp && my.length === 0 && (
            <MobileCard
              style={{
          backgroundColor: mobile.tealSoft,
          borderColor: mobile.line,
                ...(desktop
                  ? {
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 20,
                    }
                  : {}),
              }}
            >
              <View style={[ms.row, desktop && { flex: 1 }]}>
                <Icon name="bullhorn-outline" size={45} color={mobile.teal} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={ms.section}>Ortak Ol, Kazan!</Text>
                  <Text style={ms.muted}>
                    Beğendiğin ilanlara ortak ol, alıcı yönlendir; satış
                    gerçekleşince komisyon kazan.
                  </Text>
                </View>
              </View>
              <MobileButton
                secondary
                onPress={() => router.push("/nasil-calisir")}
              >
                Nasıl Çalışır?
              </MobileButton>
            </MobileCard>
          )}
          <View
            style={[
              ms.row,
              { justifyContent: "space-between", marginVertical: 14 },
            ]}
          >
            <Text
              accessibilityRole={!isMobileApp ? undefined : "header"}
              style={ms.section}
            >
              {!isMobileApp ? "İlanlar" : "Ortaklık Fırsatları"}
            </Text>
            <Text accessibilityLiveRegion="polite" style={ms.muted}>
              {loading ? "Yükleniyor…" : `${rows.length} / ${total} ilan`}
            </Text>
          </View>
          {loading && (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Ortaklık fırsatları yükleniyor"
              style={{
                flexDirection: "row",
                gap: desktop ? 14 : 10,
                marginBottom: 12,
              }}
            >
              {/* Kart ızgarasıyla aynı ölçü: masaüstünde 2 dev gri blok (her biri ~600px) çıkıyordu. */}
              {Array.from({ length: listingGrid.columns }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: listingGrid.cardWidth,
                    height: 220,
                    borderRadius: 12,
                    backgroundColor: colors.neutralSoft,
                  }}
                />
              ))}
            </View>
          )}
          <View
            testID="partnership-results-grid"
            onLayout={(e) =>
              setGridWidth(Math.floor(e.nativeEvent.layout.width))
            }
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: desktop ? 14 : 10,
              alignItems: "flex-start",
            }}
          >
            {rows.map((l) => (
              <PartnershipListingCard
                key={l.id}
                listing={l}
                desktop={desktop}
                width={listingGrid.cardWidth}
              />
            ))}
          </View>
          {!loading && !error && !rows.length && (
            <MobileCard>
              <Text style={ms.section}>Bu filtrelerde ilan bulunamadı</Text>
              <Text style={ms.muted}>
                Fiyat, kategori veya konum seçimini değiştirerek yeniden ara.
              </Text>
              <MobileButton
                secondary
                onPress={() => {
                  setQuery("");
                  setFilters(emptyMobileFilters());
                  setCategory("Tümü");
                  setSelectedTrail(null);
                }}
              >
                Filtreleri Temizle
              </MobileButton>
            </MobileCard>
          )}
          {moreError && (
            <MobileCard>
              <Text accessibilityRole="alert" style={ms.error}>
                {moreError}
              </Text>
            </MobileCard>
          )}
          {rows.length < total && !loading && (
            <MobileButton
              secondary
              disabled={moreBusy}
              onPress={() => void more()}
            >
              {moreBusy
                ? "İlanlar yükleniyor…"
                : moreError
                  ? "Diğer İlanları Yeniden Yükle"
                  : "Diğer İlanları Göster"}
            </MobileButton>
          )}
          <Modal
            statusBarTranslucent
            navigationBarTranslucent
            visible={filterOpen}
            animationType="slide"
            onRequestClose={() => setFilterOpen(false)}
          >
            <MobileFilter
              lockOpen
              initial={{ ...filters, open: true }}
              trail={criteria().trail}
              source={rows}
              query={search}
              onClose={() => setFilterOpen(false)}
              onApply={(f, path) => {
                setFilters({ ...f, open: true });
                setSelectedTrail(path);
                setCategory(path[0]?.label || "Tümü");
                setFilterOpen(false);
              }}
            />
          </Modal>
        </>
      )}
      {tab === "Talepler" && (
        <>
          <View style={ms.row}>
            {["Gelen", "Gönderdiğim"].map((label) => {
              // Sayaç = karar bekleyen başvuru (eskiden aktif ortaklıklar da sayılıyordu).
              const waiting = label === "Gelen" ? pendingIncoming : pendingSent;
              return (
                <MobileChip
                  key={label}
                  label={waiting ? `${label} (${waiting})` : label}
                  selected={requestTab === label}
                  onPress={() => setRequestTab(label)}
                />
              );
            })}
          </View>
          <Text style={[ms.muted, { marginVertical: 10 }]}>
            {requestTab === "Gelen"
              ? "İlanlarına gelen ortaklık başvuruları. Onayladığın başvuru Ortaklıklarım sekmesine geçer."
              : "Gönderdiğin ortaklık başvuruları. Satıcı onaylayınca Ortaklıklarım sekmesinde görünür."}
          </Text>
          {requestRows.map((p) => {
            const l = listings.get(p.listingId),
              incomingRow = requestTab === "Gelen",
              person = store.findUser(
                incomingRow ? p.partnerId : l?.ownerId || "",
              ),
              commission = l ? potentialCommission(l, p) : null;
            return (
              <MobileCard key={p.id}>
                <View style={ms.row}>
                  <SafeRemoteImage
                    uri={l?.imageUrl || l?.image}
                    style={{ width: 56, height: 56, borderRadius: 9 }}
                  />
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text numberOfLines={2} style={ms.section}>
                      {l ? displayListingTitle(l.title) : "İlan"}
                    </Text>
                    <Text numberOfLines={1} style={ms.muted}>
                      {incomingRow ? "Başvuran" : "Satıcı"}:{" "}
                      {person?.name || "Kullanıcı"} ·{" "}
                      {new Date(p.createdAt).toLocaleDateString("tr-TR")}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: statusColor[p.status] || mobile.muted,
                      fontSize: 12,
                      fontWeight: "700",
                      alignSelf: "flex-start",
                    }}
                  >
                    {status[p.status]}
                  </Text>
                </View>
                {l && commission !== null && (
                  <Text style={ms.muted}>
                    {incomingRow
                      ? "Satışta ödeyeceğin komisyon"
                      : "Onaylanırsa satışta kazancın"}
                    :{" "}
                    <Text style={{ color: mobile.darkTeal, fontWeight: "800" }}>
                      {moneyIn(commission, l.currency)}
                    </Text>
                  </Text>
                )}
                {!!p.note && (
                  <Text numberOfLines={6} style={ms.muted}>
                    “{p.note}”
                  </Text>
                )}
                {incomingRow && p.status === "pending" && (
                  <View style={ms.row}>
                    <MobileButton
                      secondary
                      icon="account-outline"
                      style={{ flex: 1 }}
                      onPress={() =>
                        router.push(`/store/${p.partnerId}` as never)
                      }
                    >
                      Profili Gör
                    </MobileButton>
                    <MobileButton
                      secondary
                      icon="chat-outline"
                      style={{ flex: 1 }}
                      onPress={() => message(l, p.partnerId)}
                    >
                      Başvurana Yaz
                    </MobileButton>
                  </View>
                )}
                {incomingRow && p.status === "pending" ? (
                  <View style={ms.row}>
                    <MobileButton
                      secondary
                      disabled={!!busy}
                      style={{ flex: 1 }}
                      onPress={() =>
                        Alert.alert(
                          "Talebi Reddet",
                          "Ortaklık talebi reddedilsin mi?",
                          [
                            { text: "Vazgeç", style: "cancel" },
                            {
                              text: "Reddet",
                              style: "destructive",
                              onPress: () => void decide(p, false),
                            },
                          ],
                        )
                      }
                    >
                      Reddet
                    </MobileButton>
                    <MobileButton
                      disabled={!!busy}
                      style={{ flex: 1 }}
                      onPress={() => void decide(p, true)}
                    >
                      {busy === p.id ? "Kaydediliyor…" : "Onayla"}
                    </MobileButton>
                  </View>
                ) : (
                  <View style={ms.row}>
                    {!incomingRow && p.status === "pending" && l && (
                      <MobileButton
                        secondary
                        icon="chat-outline"
                        style={{ flex: 1 }}
                        onPress={() => message(l, l.ownerId)}
                      >
                        Satıcıya Yaz
                      </MobileButton>
                    )}
                    <MobileButton
                      secondary
                      style={{ flex: 1 }}
                      onPress={() =>
                        router.push(`/partnership/${p.id}` as never)
                      }
                    >
                      Detayı Gör
                    </MobileButton>
                  </View>
                )}
              </MobileCard>
            );
          })}
          {!requestRows.length &&
            (requestTab === "Gelen" ? (
              <MobileCard>
                <Text style={ms.section}>Bekleyen başvuru yok</Text>
                <Text style={ms.muted}>
                  {ownIds.size
                    ? "İlanlarına ortak olmak isteyenlerin başvuruları burada görünür; yeni başvuruda bildirim alırsın."
                    : "Ortaklığa açık bir ilan verdiğinde, ortak olmak isteyenlerin başvuruları burada görünür."}
                </Text>
                {!ownIds.size && (
                  <MobileButton
                    secondary
                    icon="plus"
                    onPress={() => router.push("/create" as never)}
                  >
                    İlan Ver
                  </MobileButton>
                )}
              </MobileCard>
            ) : (
              <MobileCard>
                <Text style={ms.section}>Bekleyen başvurun yok</Text>
                <Text style={ms.muted}>
                  Ortaklığa açık bir ilan seçip başvur. Onaylanan başvuruların
                  Ortaklıklarım sekmesinde görünür.
                </Text>
                <MobileButton secondary onPress={() => goTab("Keşfet")}>
                  Fırsatları Keşfet
                </MobileButton>
              </MobileCard>
            ))}
        </>
      )}
      {tab === "Ortaklıklarım" && (
        <>
          {!ownerMode && ownerSideAll.length > 0 && (
            <View style={[ms.row, { marginBottom: 10 }]}>
              <MobileChip
                label={`Ortak Olduklarım (${partnerSideAll.length})`}
                selected={!asOwner}
                onPress={() => {
                  setSide("partner");
                  setFilter("Tümü");
                }}
              />
              <MobileChip
                label={`İlanlarımın Ortakları (${ownerSideAll.length})`}
                selected={asOwner}
                onPress={() => {
                  setSide("owner");
                  setFilter("Tümü");
                }}
              />
            </View>
          )}
          {/* Durum çipleri yalnız listede GERÇEKTEN bulunan durumlar için ve sayılarıyla; eskiden yedi çip iki
              satır kaplıyor, çoğu boş listeye götürüyordu. Tek durum varsa çip satırı hiç çizilmez. */}
          {presentStatuses.length > 1 && (
            <HorizontalScroll
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 7, paddingBottom: 12 }}
            >
              {["Tümü", ...presentStatuses.map((key) => status[key])].map(
                (label) => (
                  <MobileChip
                    key={label}
                    label={
                      label === "Tümü"
                        ? `Tümü (${sideRows.length})`
                        : `${label} (${sideRows.filter((p) => status[p.status] === label).length})`
                    }
                    selected={filter === label}
                    onPress={() => setFilter(label)}
                  />
                ),
              )}
            </HorizontalScroll>
          )}
          {partnershipRows.map(pCard)}
          {!partnershipRows.length &&
            (asOwner ? (
              <MobileCard>
                <Text style={ms.section}>Henüz ortağın yok</Text>
                <Text style={ms.muted}>
                  İlanına ortak olan kişiler burada görünür. Bekleyen
                  başvuruları Talepler sekmesinden onaylayabilirsin.
                </Text>
                {pendingIncoming > 0 && (
                  <MobileButton secondary onPress={() => goTab("Talepler")}>
                    {`Bekleyen ${pendingIncoming} Başvuruyu Gör`}
                  </MobileButton>
                )}
              </MobileCard>
            ) : (
              <MobileCard>
                <Text style={ms.section}>Henüz ortaklığın yok</Text>
                <Text style={ms.muted}>
                  Ortaklığa açık bir ilan seç ve başvur. Onaylanınca ilan
                  burada görünür; ilanı kendi çevrende tanıtırsın, satış
                  gerçekleşince satıcıyla anlaştığın komisyonu kazanırsın.
                </Text>
                {pendingSent > 0 && (
                  <Text style={[ms.muted, { color: colors.goldInk }]}>
                    {pendingSent} başvurun satıcı onayı bekliyor.
                  </Text>
                )}
                <MobileButton onPress={() => goTab("Keşfet")}>
                  Fırsatları Keşfet
                </MobileButton>
                {pendingSent > 0 && (
                  <MobileButton
                    secondary
                    onPress={() => {
                      // ?tab=pending → "Talepler › Gönderdiğim" (bkz. yukarıdaki params.tab etkisi)
                      setFilter("Tümü");
                      router.setParams({ tab: "pending" });
                    }}
                  >
                    Başvurularımı Gör
                  </MobileButton>
                )}
              </MobileCard>
            ))}
          {ownerMode && (
            <MobileButton
              secondary
              onPress={() =>
                router.push(
                  `/listing-edit/${params.listingId}?section=partnership` as never,
                )
              }
            >
              Komisyon ve Ortaklık Ayarları
            </MobileButton>
          )}
        </>
      )}
      {tab === "Kazançlar" && <MobileEarnings />}
      {tab !== "Keşfet" && (
        <View style={{ marginTop: 18 }}>
          <MobileButton
            secondary
            onPress={() =>
              router.push({
                pathname: ownerMode ? "/seller" : "/partner",
                params: {
                  view: "advanced",
                  ...(params.focus ? { focus: params.focus } : {}),
                },
              } as never)
            }
          >
            Davet, Satış ve Ayrıntılı Yönetim
          </MobileButton>
        </View>
      )}
    </Screen>
  );
}
