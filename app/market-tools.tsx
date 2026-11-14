import { displayListingTitle } from "@/lib/listing-title";
import { listingRenewalProblem } from "@/lib/listing-renewal";
import { Alert } from "@/lib/alert";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { AuthRequired } from "@/components/auth-gate";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { LineAreaChart } from "@/components/charts";
import { MobileRowListing } from "@/components/mobile/catalogue";
import {
  MobileBottomNav,
  MobileButton,
  MobileCard,
  MobileChip,
  MobileScreen,
  MobileSelect,
  mobile,
  ms,
  useMobileLayout,
} from "@/components/mobile/ui";
import { useStore } from "@/lib/use-store";
import { supabase } from "@/lib/supabase";
import { fetchMobileCatalogue } from "@/lib/mobile-catalogue-service";
import { emptyMobileFilters } from "@/lib/mobile-filters";
import { listingCategoryTrail } from "@/lib/mobile-catalog";
import { moneyIn } from "@/lib/format";
import type { Listing } from "@/lib/types";

const titles: Record<string, string> = {
  analysis: "Piyasa Fiyat Analizi",
  performance: "Ortak Performans Karnesi",
  achievements: "OrtakSat Başarımlarım",
  interests: "İlgi Alanlarım",
  renewal: "İlan Yenileme Merkezi",
  safety: "Güvenli Alışveriş Rehberi",
};
type Performance = {
  clicks: number;
  previousClicks: number;
  leads: number;
  sales: number;
  active: number;
  partnerCount: number;
  listingCount: number;
  distinctCategories: number;
  completedSales: number;
  clickSeries: { label: string; value: number }[];
  categories: { label: string; value: number }[];
};
export default function MarketToolsScreen() {
  const { mode = "analysis", listingId } = useLocalSearchParams<{
      mode?: string;
      listingId?: string;
    }>(),
    store = useStore();
  if (!store.authReady || (store.isAuthenticated && !store.accountLoaded))
    return <ScreenSkeleton />;
  if (mode !== "safety" && !store.isAuthenticated)
    return <AuthRequired title="Bu araç için giriş yap" />;
  return (
    <MobileScreen
      title={titles[mode] || "OrtakSat Araçları"}
      bottom={<MobileBottomNav />}
    >
      {mode === "analysis" ? (
        <PriceAnalysis initialId={listingId} />
      ) : mode === "performance" || mode === "achievements" ? (
        <PartnerMetrics achievements={mode === "achievements"} />
      ) : mode === "interests" ? (
        <Interests />
      ) : mode === "renewal" ? (
        <Renewal />
      ) : mode === "safety" ? (
        <SafetyGuide />
      ) : (
        <Text style={ms.muted}>Bu araç bulunamadı.</Text>
      )}
    </MobileScreen>
  );
}

function PriceAnalysis({ initialId }: { initialId?: string }) {
  const store = useStore(),
    router = useRouter(),
    [id, setId] = useState(initialId || ""),
    [rows, setRows] = useState<Listing[]>([]),
    [total, setTotal] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [retry, setRetry] = useState(0);
  const options = store.listings.filter(
      (l) => l.ownerId === store.currentUser.id,
    ),
    listing = options.find((l) => l.id === id) || options[0];
  useEffect(() => {
    let alive = true;
    setError("");
    setRows([]);
    if (!listing) return;
    const trail = listingCategoryTrail(store.categoryTree, listing);
    if (!trail.length) {
      setError(
        "İlanın kategori yolu çözümlenemedi. Önce kategori bilgisini düzenle.",
      );
      return;
    }
    setLoading(true);
    const filters = {
      ...emptyMobileFilters(),
      currency: listing.currency || ("TRY" as const),
      excludeOwner: store.currentUser.id,
    };
    for (const key of ["brand", "model"])
      if (listing.attributes?.[key])
        filters.attrs[key] = String(listing.attributes[key]);
    void fetchMobileCatalogue({ trail, filters, limit: 100, sort: "newest" })
      .then((data) => {
        if (alive) {
          setRows(
            data.listings.filter(
              (l) => Number.isFinite(l.price) && l.price > 0,
            ),
          );
          setTotal(data.total);
        }
      })
      .catch(() => {
        if (alive) setError("Karşılaştırılabilir ilanlar yüklenemedi.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [listing, store.categoryTree, store.currentUser.id, retry]);
  const prices = rows.map((l) => l.price).sort((a, b) => a - b),
    median = prices.length
      ? prices.length % 2
        ? prices[Math.floor(prices.length / 2)]
        : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
      : 0;
  return (
    <>
      <Text style={[ms.muted, { marginVertical: 12 }]}>
        Aynı kategori, marka/model ve para birimindeki yayındaki ilanların
        istenen fiyatlarını karşılaştır. Bunlar gerçekleşmiş satış fiyatları
        değildir.
      </Text>
      {options.length ? (
        <MobileSelect
          label="Analiz Edilecek İlan"
          value={listing?.title}
          options={options.map(
            (l) => `${displayListingTitle(l.title)} · ${l.id}`,
          )}
          onChange={(v) => setId(v.split(" · ").at(-1) || "")}
        />
      ) : (
        <MobileCard>
          <Text style={ms.muted}>Analiz için önce bir ilan oluştur.</Text>
          <MobileButton onPress={() => router.push("/create")}>
            İlan Ver
          </MobileButton>
        </MobileCard>
      )}
      {listing && (
        <View style={{ marginTop: 15 }}>
          <MobileRowListing listing={listing} />
        </View>
      )}
      {loading && <Text style={ms.muted}>Benzer ilanlar hesaplanıyor…</Text>}
      {!!error && (
        <MobileCard>
          <Text accessibilityRole="alert" style={ms.error}>
            {error}
          </Text>
          <MobileButton secondary onPress={() => setRetry((v) => v + 1)}>
            Tekrar Dene
          </MobileButton>
        </MobileCard>
      )}
      {!loading && !error && listing && (
        <MobileCard style={{ backgroundColor: "#EDF1FC" }}>
          <Text style={ms.section}>
            {prices.length
              ? "Benzer İlan Fiyatları"
              : "Yeterli karşılaştırma verisi yok"}
          </Text>
          {prices.length > 0 && (
            <>
              <Text
                style={{ fontSize: 27, fontWeight: "800", color: mobile.teal }}
              >
                {moneyIn(median, listing.currency)}
              </Text>
              <Text style={ms.muted}>
                Ortanca fiyat · Alt: {moneyIn(prices[0], listing.currency)} ·
                Üst: {moneyIn(prices.at(-1)!, listing.currency)}
              </Text>
            </>
          )}
          <Text style={ms.muted}>
            {total} uygun ilan arasından en yeni {rows.length} pozitif fiyatlı
            kayıt incelendi. Kendi ilanların örnekleme dahil edilmedi.
          </Text>
          <Text style={ms.muted}>
            {rows.length < 3
              ? "Örneklem küçük; bu sonuç fiyat önerisi vermek için yeterli değildir."
              : "Kondisyon, donanım ve ilandaki diğer özellikler fiyatı değiştirebilir."}
          </Text>
        </MobileCard>
      )}
      {rows.slice(0, 10).map((l) => (
        <MobileRowListing key={l.id} listing={l} />
      ))}
    </>
  );
}

function PartnerMetrics({ achievements }: { achievements: boolean }) {
  const [period, setPeriod] = useState("30 gün"),
    [data, setData] = useState<Performance | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    { maxWidth } = useMobileLayout();
  useEffect(() => {
    let alive = true;
    setData(null);
    setError(false);
    void Promise.resolve(
      supabase!.rpc("mobile_partner_performance", {
        period_days: parseInt(period),
      }),
    )
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data || !Array.isArray(data.clickSeries)) setError(true);
        else setData(data as Performance);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [period, retry]);
  if (error)
    return (
      <MobileCard>
        <Text accessibilityRole="alert" style={ms.error}>
          Performans kayıtları yüklenemedi.
        </Text>
        <MobileButton secondary onPress={() => setRetry((v) => v + 1)}>
          Tekrar Dene
        </MobileButton>
      </MobileCard>
    );
  if (!data)
    return <Text style={ms.muted}>Hesabının kayıtları hesaplanıyor…</Text>;
  if (achievements) {
    const badges = [
      {
        title: "İlk İlan",
        count: data.listingCount,
        target: 1,
        detail: "1 ilan yayınla",
      },
      {
        title: "Aktif Satıcı",
        count: data.listingCount,
        target: 5,
        detail: "5 ilan yayınla",
      },
      {
        title: "Ortak Başlangıç",
        count: data.partnerCount,
        target: 1,
        detail: "İlk ortaklık kaydını oluştur",
      },
      {
        title: "Satış Ustası",
        count: data.completedSales,
        target: 3,
        detail: "3 onaylanan satış kaydına ulaş",
      },
      {
        title: "Süper Ortak",
        count: data.completedSales,
        target: 10,
        detail: "10 onaylanan satış kaydına ulaş",
      },
      {
        title: "Keşifçi",
        count: data.distinctCategories,
        target: 5,
        detail: "5 kategoride ilan yayınla",
      },
    ];
    return (
      <>
          <MobileCard style={{ backgroundColor: mobile.tealSoft }}>
          <Text style={ms.section}>Kayıtlarınla Kazandığın Başarımlar</Text>
          <Text style={ms.muted}>
            Başarımlar hesap kayıtlarından hesaplanır. Para ödülü veya resmi
            satıcı doğrulaması değildir.
          </Text>
        </MobileCard>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {badges.map((b) => (
            <MobileCard
              key={b.title}
              style={{
                width: (maxWidth - 42) / 2,
                alignItems: "center",
                gap: 10,
              }}
            >
              <Icon
                name={b.count >= b.target ? "medal" : "lock-outline"}
                size={45}
                color={b.count >= b.target ? "#F0AA24" : "#A9B2BD"}
              />
              <Text style={ms.section}>{b.title}</Text>
              <Text style={[ms.muted, { textAlign: "center" }]}>
                {b.detail}
              </Text>
              <Text style={{ color: mobile.teal, fontWeight: "700" }}>
                {Math.min(b.count, b.target)}/{b.target} ·{" "}
                {b.count >= b.target ? "Kazanıldı" : "Devam ediyor"}
              </Text>
            </MobileCard>
          ))}
        </View>
      </>
    );
  }
  const step = Math.ceil(data.clickSeries.length / 7),
    points = data.clickSeries
      .filter((_, i) => i % step === 0)
      .map((p, i) => ({
        label: p.label.slice(5),
        value: data.clickSeries
          .slice(i * step, (i + 1) * step)
          .reduce((n, p) => n + p.value, 0),
      }));
  return (
    <>
      <MobileSelect
        label="Dönem"
        value={period}
        options={["7 gün", "30 gün", "90 gün"]}
        onChange={setPeriod}
      />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        {[
          ["Bağlantı Tıklaması", data.clicks],
          ["Müşteri Kaydı", data.leads],
          ["Onaylı Satış Kaydı", data.sales],
        ].map(([label, value]) => (
          <MobileCard key={label} style={{ flex: 1, padding: 9 }}>
            <Text
              style={{ fontSize: 24, fontWeight: "800", color: mobile.teal }}
            >
              {value}
            </Text>
            <Text style={[ms.muted, { fontSize: 10 }]}>{label}</Text>
          </MobileCard>
        ))}
      </View>
      <MobileCard>
        <Text style={ms.section}>Yönlendirme Performansı</Text>
        <Text style={ms.muted}>
          {data.previousClicks > 0
            ? `Önceki eşit döneme göre tıklama değişimi: %${Math.round(((data.clicks - data.previousClicks) / data.previousClicks) * 100)}`
            : "Önceki dönemde tıklama kaydı yok; değişim oranı hesaplanmadı."}
        </Text>
        <LineAreaChart
          points={points}
          width={maxWidth - 58}
          height={175}
          color={mobile.teal}
        />
        <Text style={ms.muted}>
          {step === 1 ? "Günlük" : "Birkaç günlük toplam"} bağlantı tıklamaları
          · Türkiye saati. Bu ölçümler farklı dönemlerde başlayan kayıtları
          içerebilir; doğrudan dönüşüm oranı değildir.
        </Text>
      </MobileCard>
      <MobileCard>
        <Text style={ms.section}>Müşteri Getirdiğin Kategoriler</Text>
        {data.categories.map((c) => (
          <View
            key={c.label}
            style={[ms.row, { justifyContent: "space-between" }]}
          >
            <Text style={[ms.muted, { flex: 1 }]}>{c.label}</Text>
            <Text style={ms.label}>{c.value}</Text>
          </View>
        ))}
        {!data.categories.length && (
          <Text style={ms.muted}>
            Seçilen dönemde müşteri kaydı bulunmuyor.
          </Text>
        )}
      </MobileCard>
      <Text style={ms.muted}>
        {data.active} aktif ortaklık. Özet doğrudan hesabının sunucudaki
        kayıtlarından hesaplanır; ekrandaki liste sınırı toplamları kırpmaz.
      </Text>
    </>
  );
}

function Interests() {
  const store = useStore(),
    [selected, setSelected] = useState<string[]>(() =>
      store.categoryTree
        .filter(
          (n) => store.currentUser.preferences?.[`interest:${n.slug}`] === true,
        )
        .map((n) => n.slug),
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    lock = useRef(false);
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const patch = Object.fromEntries(
        store.categoryTree.map((n) => [
          `interest:${n.slug}`,
          selected.includes(n.slug),
        ]),
      );
      if (!(await store.savePreferences(patch))) throw Error();
      setMessage(
        "İlgi alanların kaydedildi. Keşfet ekranından seçtiğin kategorilere ulaşabilirsin.",
      );
    } catch {
      setMessage(
        "İlgi alanların kaydedilemedi. Seçimlerin korunuyor; tekrar dene.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Text style={[ms.muted, { marginVertical: 12 }]}>
        Takip etmek istediğin kategorileri seç. Bu seçim kendiliğinden konum,
        marka veya fiyat bildirimi açmaz.
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 18,
        }}
      >
        {store.categoryTree.map((n) => (
          <MobileChip
            key={n.slug}
            label={n.label}
            selected={selected.includes(n.slug)}
            onPress={() =>
              setSelected((old) =>
                old.includes(n.slug)
                  ? old.filter((v) => v !== n.slug)
                  : [...old, n.slug],
              )
            }
          />
        ))}
      </View>
      {!!message && (
        <Text accessibilityRole="alert" style={ms.muted}>
          {message}
        </Text>
      )}
      <MobileButton disabled={busy} onPress={() => void save()}>
        {busy ? "Kaydediliyor…" : "İlgi Alanlarını Kaydet"}
      </MobileButton>
    </>
  );
}

function Renewal() {
  const store = useStore(),
    router = useRouter(),
    [filter, setFilter] = useState("Süresi Dolan"),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    lock = useRef(false),
    mine = store.listings.filter((l) => l.ownerId === store.currentUser.id),
    rows = mine.filter((l) =>
      filter === "Süresi Dolan"
        ? l.status === "expired"
        : filter === "Pasif"
          ? l.status === "paused"
          : l.status === "active",
    );
  async function renew() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFeedback("");
    const targets = mine.filter(
      (l) =>
        selected.includes(l.id) &&
        ["expired", "paused"].includes(l.status) &&
        !listingRenewalProblem(l, store.categoryTree),
    );
    const failed: string[] = [];
    let saved = 0;
    try {
      for (const l of targets) {
        try {
          if (await store.updateListingStatus(l.id, "active")) saved++;
          else failed.push(l.id);
        } catch {
          failed.push(l.id);
        }
      }
      setSelected(failed);
      setFeedback(
        `${saved} ilan yeniden yayın için kaydedildi.${failed.length ? ` ${failed.length} ilan kaydedilemedi; seçimi korunuyor.` : ""} İnceleme gereken ilanlar onay sonrası görünür.`,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Text style={[ms.muted, { marginVertical: 12 }]}>
        Yeniden yayınlamadan önce güncel fiyat, stok, fotoğraf ve ortaklık
        koşullarını kontrol et. Eksik bilgisi olan ilanlar önce düzenlenmelidir.
      </Text>
      <ScrollView
        horizontal
        contentContainerStyle={{ gap: 7, marginBottom: 16 }}
      >
        {["Aktif", "Süresi Dolan", "Pasif"].map((t) => (
          <MobileChip
            key={t}
            label={t}
            selected={filter === t}
            onPress={() => {
              if (!busy) {
                setFilter(t);
                setSelected([]);
              }
            }}
          />
        ))}
      </ScrollView>
      {rows.map((l) => {
        const problem = listingRenewalProblem(l, store.categoryTree);
        return (
          <MobileCard key={l.id}>
            <Text style={ms.section}>{displayListingTitle(l.title)}</Text>
            <Text style={ms.muted}>{moneyIn(l.price, l.currency)}</Text>
            {problem && <Text style={ms.error}>{problem}</Text>}
            {l.status !== "active" && !problem && (
              <View style={ms.row}>
                <Text style={[ms.muted, { flex: 1 }]}>
                  Yeniden yayınlamak için seç
                </Text>
                <Switch {...({ activeThumbColor: "#FFFFFF" } as object)}
                  accessibilityLabel={`${displayListingTitle(l.title)} yenilemek için seç`}
                  disabled={busy}
                  value={selected.includes(l.id)}
                  onValueChange={(value) =>
                    setSelected((old) =>
                      value ? [...old, l.id] : old.filter((id) => id !== l.id),
                    )
                  }
                  trackColor={{ false: mobile.line, true: mobile.teal }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={mobile.line}
                />
              </View>
            )}
            <MobileButton
              secondary
              disabled={busy}
              onPress={() =>
                router.push(`/listing-edit/${l.id}?section=preview` as never)
              }
            >
              {l.status === "active"
                ? "İlanı Güncelle"
                : "Kontrol Et ve Düzenle"}
            </MobileButton>
          </MobileCard>
        );
      })}
      {!rows.length && (
        <Text style={ms.muted}>Bu durumda ilanın bulunmuyor.</Text>
      )}
      {feedback && (
        <Text accessibilityRole="alert" style={ms.muted}>
          {feedback}
        </Text>
      )}
      {selected.length > 0 && (
        <MobileButton
          disabled={busy}
          onPress={() =>
            Alert.alert(
              "Seçilen İlanları Yenile",
              `${selected.length} ilan yeniden yayın için kontrol edilip kaydedilsin mi?`,
              [
                { text: "Vazgeç", style: "cancel" },
                { text: "Yenile", onPress: () => void renew() },
              ],
            )
          }
        >
          {busy ? "Yenileniyor…" : `Seçilenleri Yenile (${selected.length})`}
        </MobileButton>
      )}
    </>
  );
}

function SafetyGuide() {
  const [tab, setTab] = useState("Öneriler"),
    [open, setOpen] = useState<string | null>(null);
  const rows =
    tab === "Öneriler"
      ? [
          [
            "Yüz yüze güvenli görüşme",
            "Mümkünse kalabalık ve güvenli bir yerde buluş. Ürünü teslim almadan önce kontrol et.",
          ],
          [
            "Ödemeyi kontrol et",
            "Dekont görselini ödeme kanıtı sayma; kendi banka hesabındaki hareketi kontrol et. Görmediğin ürün için kapora gönderme.",
          ],
          [
            "Ürünü ve belgeleri incele",
            "Seri numarası, fatura, ruhsat ve ürünün durumunu kontrol et. Gerekirse bağımsız uzmandan destek al.",
          ],
          [
            "İletişimi kayıtlı tut",
            "Mesajları uygulama içinde sürdür; ödeme, kimlik ve giriş kodlarını paylaşma.",
          ],
        ]
      : tab === "Dolandırıcılık Türleri"
        ? [
            [
              "Platform dışına yönlendirme",
              "Sahte ödeme veya kargo bağlantılarıyla giriş ve kart bilgilerin istenebilir. Gönderilen bağlantılarda oturum açma.",
            ],
            [
              "Sahte dekont",
              "Ekran görüntüsündeki tutara güvenerek ürünü teslim etme; ödeme hesabına ulaşmış olmalı.",
            ],
            [
              "Gerçek dışı fiyat ve kapora",
              "Piyasanın çok altındaki fiyat, acele ödeme baskısı veya ürünü görmeden kapora talebini dikkatle değerlendir.",
            ],
          ]
        : [
            [
              "OrtakSat ödeme tutuyor mu?",
              "Ödeme ve teslimat taraflar arasında gerçekleşir. OrtakSat bakiyesi veya platform güvenceli ödeme varmış gibi gönderilen mesajlara güvenme.",
            ],
            [
              "Komisyon ne zaman kazanılır?",
              "Komisyon satıcının kabul ettiği koşullara ve tamamlanan satışa bağlıdır. Koşulları baştan netleştir.",
            ],
            [
              "Şüpheli hesabı nasıl bildiririm?",
              "İlanın veya kullanıcının seçeneklerinden şikâyet oluştur; ilgili mesajları ve görselleri ekle. Şikâyetlerim ekranından durumunu izle.",
            ],
          ];
  return (
    <>
      <ScrollView
        horizontal
        contentContainerStyle={{ gap: 7, paddingVertical: 15 }}
      >
        {["Öneriler", "Dolandırıcılık Türleri", "Sık Sorulanlar"].map((t) => (
          <MobileChip
            key={t}
            label={t}
            selected={tab === t}
            onPress={() => {
              setTab(t);
              setOpen(null);
            }}
          />
        ))}
      </ScrollView>
      {rows.map(([title, body]) => (
        <MobileCard key={title}>
          <MobileButton
            secondary
            onPress={() => setOpen(open === title ? null : title)}
          >
            {title}
          </MobileButton>
          {open === title && <Text style={ms.muted}>{body}</Text>}
        </MobileCard>
      ))}
    </>
  );
}
