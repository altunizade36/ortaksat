import { MaterialCommunityIcons } from "@/components/icons";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Pressable, Text, View } from "react-native";

import { ADMIN_CARD, ChartCard, KpiTile, LiveDot, NoData, RangeSwitch, SkeletonBlock, deltaOf } from "@/components/admin-kit";
import { DonutChart, FunnelChart, HBarChart, MultiLineChart } from "@/components/charts";
import { colors } from "@/components/colors";
import { money } from "@/lib/format";
import { fetchAdminMessageStats, fetchAdminOverview, fetchAdminTimeseries, type AdminOverview, type AdminTimeseries, type AdminTimeseriesDay } from "@/lib/live-service";
import { supabase } from "@/lib/supabase";

type DayPoint = { day: string; active: number; signups: number; listings: number; gmv: number; commission: number };
type CatPoint = { category: string; n: number };
type StatusAmount = { status: string; n: number; amount: number };
type EarnerPoint = { name: string; amount: number; n: number };
export type AdminAnalytics = {
  total_users: number;
  confirmed_users: number;
  live_now: number;
  active_today: number;
  new_today: number;
  new_7d: number;
  listings_total: number;
  listings_active: number;
  listings_pending: number;
  listings_paused: number;
  listings_sold: number;
  listings_new_7d: number;
  commissions_total: number;
  commissions_paid: number;
  gmv: number; // GERÇEK GMV = sum(orders.amount) (satış/ürün değeri), komisyon DEĞİL
  commission_amount: number; // sum(commissions.amount) — kaydedilen toplam komisyon
  commission_paid_amount: number; // ödenen komisyon
  commission_pending_amount: number; // ödenmemiş (paid/cancelled dışı)
  gmv_7d: number; // son 7 gün GMV
  commission_7d: number; // son 7 gün komisyon
  commission_status: StatusAmount[] | null; // komisyon durum dağılımı (adet+tutar)
  top_earners: EarnerPoint[] | null; // en çok komisyon kazanan ortaklar
  partnerships_total: number;
  partnerships_active: number;
  partnerships_pending: number;
  orders_total: number;
  open_reports: number;
  cat_suggestions: number;
  loc_suggestions: number;
  days: DayPoint[];
  top_categories: CatPoint[] | null;
};

export type AdminMsgStats = { conversations: number; messages: number; messages_24h: number; blocked_pairs: number };
/** Canlı Panel kutularından gidilebilen bölümler (admin.tsx Section'ın alt kümesi). */
export type AdminNavTarget = "users" | "listings" | "partnerships" | "complaints" | "messages" | "commissions" | "records" | "categories" | "locations";

const REFRESH_MS = 30_000;
// Grafik serileri — marka mavisi öncelikli, birbirinden ayrık sabit sıra.
const SERIES = { a: colors.primary, b: colors.violet, c: colors.gold } as const;

function clock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

// ---------------------------------------------------------------------------
// Sunucu zaman serisi (admin_timeseries RPC) — uzun dönem trend + dönem farkları + kök kategori /
// satıcı dağılımı. Tek kaynak: admin kökünde BİR kez çağrılır, kartlara `ts` olarak verilir.
// ---------------------------------------------------------------------------
export type AdminTsRange = 30 | 90 | 365;
export type AdminTsState = {
  /** Son BAŞARILI yanıt (başka bir aralığa ait olabilir: data.range ile karşılaştır). Hiç gelmediyse null. */
  data: AdminTimeseries | null;
  range: AdminTsRange;
  setRange: (r: AdminTsRange) => void;
  loading: boolean;
  /** Son deneme başarısız (data doluysa bayat). */
  error: boolean;
  /** 5 dk kuralını aşarak şimdi yenile (elle "Yenile"). */
  reload: () => void;
};

// Uzun seri pahalı (365 gün × 8 tablo): aralık değişmedikçe en sık 5 dakikada bir yeniden çekilir.
const TS_MIN_REFETCH_MS = 5 * 60_000;

/**
 * 30 sn'lik panel ritmiyle yoklar ama seriyi yalnız (a) ilk açılışta, (b) aralık değişince,
 * (c) son BAŞARILI çekimden 5 dk geçince, (d) reload() ile yeniden ister. Başarısız deneme
 * sonraki 30 sn'lik turda tekrar denenir. Sekme gizli / uygulama arka plandayken istek atılmaz.
 * RPC hata verirse data'ya dokunulmaz, error=true olur — sayı UYDURULMAZ.
 */
export function useAdminTimeseries(enabled: boolean): AdminTsState {
  const [range, setRange] = useState<AdminTsRange>(30);
  const [data, setData] = useState<AdminTimeseries | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);
  const lastOk = useRef<{ range: number; at: number } | null>(null);
  const pending = useRef<number | null>(null);
  const alive = useRef(true);
  const rangeRef = useRef<AdminTsRange>(range);
  rangeRef.current = range;

  const fetchNow = useCallback(async (force: boolean) => {
    const r = rangeRef.current;
    if (pending.current === r) return; // aynı aralık zaten yolda
    const l = lastOk.current;
    if (!force && l && l.range === r && Date.now() - l.at < TS_MIN_REFETCH_MS) return;
    const id = ++seq.current;
    pending.current = r;
    setLoading(true);
    const res = await fetchAdminTimeseries(r).catch(() => null);
    if (!alive.current || id !== seq.current) return; // kapandı ya da daha yeni bir istek (aralık değişti) var
    pending.current = null;
    setLoading(false);
    if (res) { setData(res); setError(false); lastOk.current = { range: r, at: Date.now() }; }
    else setError(true);
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const hasDoc = typeof document !== "undefined";
    const visible = () => (hasDoc ? document.visibilityState !== "hidden" : AppState.currentState === "active");
    const tick = () => { if (visible()) void fetchNow(false); };
    tick();
    const timer = setInterval(tick, REFRESH_MS);
    if (hasDoc) document.addEventListener("visibilitychange", tick);
    const sub = hasDoc ? null : AppState.addEventListener("change", tick);
    return () => {
      clearInterval(timer);
      if (hasDoc) document.removeEventListener("visibilitychange", tick);
      sub?.remove();
    };
  }, [enabled, range, fetchNow]);

  const reload = useCallback(() => { void fetchNow(true); }, [fetchNow]);
  return { data, range, setRange, loading, error, reload };
}

const dayLabel = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;

/** ≤31 gün → günlük; daha uzunu → 7 günlük toplam kovalar (baştaki eksik hafta atılır, son kova bugünü içerir). */
function bucketDays(days: AdminTimeseriesDay[], range: number): { step: 1 | 7; labels: string[]; pick: (f: (d: AdminTimeseriesDay) => number) => number[] } {
  const step: 1 | 7 = range <= 31 ? 1 : 7;
  const usable = step === 1 ? days : days.slice(days.length % step);
  const buckets: AdminTimeseriesDay[][] = [];
  for (let i = 0; i < usable.length; i += step) buckets.push(usable.slice(i, i + step));
  return { step, labels: buckets.map((b) => dayLabel(b[0].day)), pick: (f) => buckets.map((b) => sum(b.map(f))) };
}

/** Sunucu serisi kartlarının ortak yükleniyor / hata gövdesi. Veri yokken sayı gösterilmez. */
function TsFallback({ ts, height }: { ts: AdminTsState; height: number }) {
  if (ts.error && !ts.loading) {
    return (
      <View style={{ alignItems: "flex-start", backgroundColor: colors.accentSoft, borderRadius: 12, gap: 8, minHeight: 96, padding: 14 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={17} color={colors.accent} />
          <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700", lineHeight: 18 }}>Sunucu verisi alınamadı. Sayı gösterilmiyor — tahmini/örnek veri kullanılmaz.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={ts.reload} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 9, borderWidth: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: 14 }}>
          <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "900" }}>Tekrar dene</Text>
        </Pressable>
      </View>
    );
  }
  return <SkeletonBlock height={height} width="100%" radius={12} />;
}

const STALE = " · son yenileme başarısız (önceki veri)";

/** Uzun dönem trend — SUNUCU serisi (30 / 90 / 365 gün). Yüklü istemci kayıtlarından hesap YOK. */
export function ServerTrendCard({ ts }: { ts: AdminTsState }) {
  const [w, setW] = useState(0);
  const [group, setGroup] = useState<"growth" | "engage">("growth");
  // Yalnız SEÇİLİ aralığa ait yanıt çizilir (aralık değişirken eski aralığın serisi yeni etiketle gösterilmez).
  const match = ts.data && ts.data.range === ts.range ? ts.data : null;
  const b = useMemo(() => (match ? bucketDays(match.days, match.range) : null), [match]);
  const series = !b ? [] : group === "growth"
    ? [
      { label: "Yeni kayıt", color: SERIES.b, values: b.pick((d) => d.signups) },
      { label: "Yeni ilan", color: SERIES.c, values: b.pick((d) => d.listings) }
    ]
    : [
      { label: "Mesaj", color: SERIES.a, values: b.pick((d) => d.messages) },
      { label: "Talep (lead)", color: SERIES.b, values: b.pick((d) => d.leads) },
      { label: "Sipariş (adet)", color: SERIES.c, values: b.pick((d) => d.orders) }
    ];
  const empty = series.every((s) => s.values.every((v) => v === 0));
  const meta = b
    ? `${b.step === 1 ? "Günlük" : "Haftalık toplam"} · son ${ts.range} gün · sunucu verisi · son nokta bugünü içerir (gün bitmedi)${ts.error ? STALE : ""}`
    : `Son ${ts.range} gün · sunucu verisi`;
  return (
    <ChartCard
      title="Uzun dönem trend"
      meta={meta}
      right={
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <RangeSwitch value={group} onChange={setGroup} options={[{ key: "growth", label: "Kayıt · ilan" }, { key: "engage", label: "Mesaj · talep · sipariş" }]} />
          <RangeSwitch value={ts.range} onChange={ts.setRange} options={[{ key: 30, label: "30 gün" }, { key: 90, label: "90 gün" }, { key: 365, label: "12 ay" }]} />
        </View>
      }
    >
      <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ width: "100%" }}>
        {!b ? <TsFallback ts={ts} height={200} />
          : empty ? <NoData text={`Son ${ts.range} günde bu seride kayıt yok.`} />
          : w > 0 ? <MultiLineChart labels={b.labels} series={series} width={w} /> : <View style={{ height: 200 }} />}
      </View>
    </ChartCard>
  );
}

/** Sunucu serisinin aralıktan BAĞIMSIZ alanlarını (dağılımlar) gösteren kart iskeleti. */
function TsCard({ ts, title, meta, basis, children }: { ts: AdminTsState; title: string; meta: string; basis?: number; children: (d: AdminTimeseries) => ReactNode }) {
  return (
    <ChartCard title={title} meta={`${meta}${ts.data && ts.error ? STALE : ""}`} basis={basis}>
      {ts.data ? children(ts.data) : <TsFallback ts={ts} height={140} />}
    </ChartCard>
  );
}

/** Aktif ilanların KÖK kategoriye göre dağılımı — sunucu sayımı (tüm aktif ilanlar). */
export function RootCategoryCard({ ts, basis = 300 }: { ts: AdminTsState; basis?: number }) {
  return (
    <TsCard ts={ts} title="Kök kategori dağılımı" meta="Tüm aktif ilanlar · sunucu verisi · kökü kayıtlı olmayanlar “Diğer”" basis={basis}>
      {(d) => {
        const n = sum(d.root_categories.map((r) => r.n));
        return d.root_categories.length === 0 ? <NoData text="Aktif ilan yok." /> : (
          <HBarChart rank data={d.root_categories.map((r) => ({ label: r.root || "Diğer", value: r.n, color: colors.primary }))} valueFmt={(v) => `${fmt(v)} · %${n ? Math.round((v / n) * 100) : 0}`} />
        );
      }}
    </TsCard>
  );
}

/** En çok aktif ilanı olan satıcılar — sunucu sayımı (ilk 8). */
export function TopSellersCard({ ts, basis = 300 }: { ts: AdminTsState; basis?: number }) {
  return (
    <TsCard ts={ts} title="En çok ilanı olan satıcılar" meta="Aktif ilan sayısına göre ilk 8 · sunucu verisi" basis={basis}>
      {(d) => (d.top_sellers.length === 0 ? <NoData text="Henüz aktif ilanı olan satıcı yok." /> : (
        <HBarChart rank data={d.top_sellers.map((r) => ({ label: r.name || "Satıcı", value: r.n, color: colors.primary }))} valueFmt={(v) => `${fmt(v)} ilan`} />
      ))}
    </TsCard>
  );
}

/**
 * Admin Canlı Panel — GERÇEK sunucu verisi:
 *   • admin_live_analytics RPC (toplamlar + 14 günlük günlük seri)
 *   • admin_overview RPC (talep/lead toplamı, şikayet toplamı)
 *   • admin_message_stats RPC (mesaj toplamı + son 24 saat)
 *   • admin_timeseries RPC (`ts` — admin kökündeki useAdminTimeseries): mesaj/talep/sipariş/şikayet
 *     için GERÇEK önceki-dönem sayıları + huninin görüntülenme adımı. Yoksa/hata ise fark gösterilmez.
 * 30 sn'de bir tazelenir; sekme gizli / uygulama arka plandayken DURAKLAR. Dönem farkları
 * (son 6 TAM gün ↔ önceki 6, bugün ↔ dün) sunucunun döndürdüğü günlük seriden hesaplanır;
 * serisi olmayan metriklerde fark GÖSTERİLMEZ (uydurulmaz).
 * Tüm RPC'ler sunucuda is_admin korumalıdır — yetkisiz çağrı hata döner, veri dönmez.
 */
export function AdminActivity({ onData, onOverview, onMsgStats, onNavigate, ts }: { onData?: (a: AdminAnalytics) => void; onOverview?: (o: AdminOverview) => void; onMsgStats?: (m: AdminMsgStats) => void; onNavigate?: (target: AdminNavTarget) => void; ts?: AdminTsState }) {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [msgStats, setMsgStats] = useState<AdminMsgStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [range, setRange] = useState<7 | 14>(14);
  const [lineW, setLineW] = useState(0);
  const [moneyW, setMoneyW] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const cbs = useRef({ onData, onOverview, onMsgStats });
  cbs.current = { onData, onOverview, onMsgStats };

  const load = useCallback(async (manual?: boolean) => {
    if (inFlight.current) return; // üst üste istek yok (çift tık / interval çakışması)
    if (!supabase) { setError("Canlı bağlantı yok (önizleme modu)."); setLoading(false); return; }
    inFlight.current = true;
    if (manual) setRefreshing(true);
    try {
      const [main, ov, ms] = await Promise.all([
        supabase.rpc("admin_live_analytics"),
        fetchAdminOverview().catch(() => null),
        fetchAdminMessageStats().catch(() => null)
      ]);
      if (!alive.current) return;
      if (main.error) throw main.error;
      const a = main.data as AdminAnalytics | null;
      if (!a || !Array.isArray(a.days)) throw new Error("Analitik yanıtı boş döndü.");
      setData(a);
      cbs.current.onData?.(a);
      if (ov) { setOverview(ov); cbs.current.onOverview?.(ov); }
      if (ms) { setMsgStats(ms); cbs.current.onMsgStats?.(ms); }
      setError(null);
      setUpdatedAt(clock(new Date()));
    } catch (e) {
      if (alive.current) setError((e as { message?: string })?.message || "Analitik yüklenemedi.");
    } finally {
      inFlight.current = false;
      if (alive.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    const start = () => { if (!timer.current) timer.current = setInterval(() => void load(), REFRESH_MS); setPaused(false); };
    const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } setPaused(true); };
    const hasDoc = typeof document !== "undefined";
    const onVis = () => { if (document.visibilityState === "hidden") stop(); else { void load(); start(); } };
    start();
    if (hasDoc) document.addEventListener("visibilitychange", onVis);
    // Native: uygulama arka plana geçince durakla (web'de visibilitychange zaten kapsar).
    const sub = hasDoc ? null : AppState.addEventListener("change", (s) => { if (s === "active") { void load(); start(); } else stop(); });
    return () => {
      alive.current = false;
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      if (hasDoc) document.removeEventListener("visibilitychange", onVis);
      sub?.remove();
    };
  }, [load]);

  const header = (
    <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
        <LiveDot tone={error ? "stale" : paused || loading ? "off" : "ok"} />
        <View style={{ gap: 1 }}>
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 }}>Canlı Panel</Text>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontVariant: ["tabular-nums"], fontWeight: "700" }}>
            {updatedAt ? `Son güncelleme ${updatedAt}` : loading ? "Yükleniyor…" : "Henüz güncellenemedi"}{paused ? " · duraklatıldı" : " · 30 sn'de bir yenilenir"}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Canlı paneli şimdi yenile"
        disabled={refreshing || loading}
        onPress={() => { void load(true); ts?.reload(); }}
        style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 6, minHeight: 40, opacity: refreshing || loading ? 0.55 : pressed ? 0.8 : 1, paddingHorizontal: 13 })}
      >
        <MaterialCommunityIcons name={refreshing ? "timer-sand" : "refresh"} size={16} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: "900" }}>{refreshing ? "Yenileniyor…" : "Yenile"}</Text>
      </Pressable>
    </View>
  );

  if (!data) {
    if (loading) {
      return (
        <View style={{ gap: 14 }} accessibilityLabel="Canlı panel yükleniyor">
          {header}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonBlock key={i} height={128} grow radius={16} />)}
          </View>
          <SkeletonBlock height={240} width="100%" radius={16} />
        </View>
      );
    }
    return (
      <View style={{ gap: 14 }}>
        {header}
        <View style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: 14, borderWidth: 1, gap: 8, padding: 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.accent} />
            <Text style={{ color: colors.accent, flex: 1, fontSize: 14, fontWeight: "900" }}>Canlı veri yüklenemedi</Text>
          </View>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>{error ?? "Bilinmeyen hata."} Sayı gösterilmiyor — tahmini/örnek veri kullanılmaz.</Text>
          <Pressable accessibilityRole="button" disabled={refreshing} onPress={() => void load(true)} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, justifyContent: "center", minHeight: 42, opacity: refreshing ? 0.6 : 1, paddingHorizontal: 18 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{refreshing ? "Deneniyor…" : "Tekrar dene"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- Dönem farkları: sunucunun 14 günlük günlük serisinden (uydurma yok) ----
  const days = data.days;
  // Bugün henüz bitmedi: yarım günü tam günlerle kıyaslamak sahte düşüş gösterir → yalnız TAMAMLANMIŞ günler.
  const last7 = days.slice(-7, -1);
  const prev7 = days.slice(-13, -7);
  const canCompare = prev7.length === 6 && last7.length === 6;
  const today = days[days.length - 1];
  const yesterday = days[days.length - 2];
  const cmp = (pick: (d: DayPoint) => number) => (canCompare ? deltaOf(sum(last7.map(pick)), sum(prev7.map(pick))) : undefined);
  const WEEK = "son 6 tam gün ↔ önceki 6";
  // Kayan pencereler (son 24 saat / son 7×24 saat ↔ hemen öncesi): iki taraf da TAM dönem, sunucuda sayılır.
  const t = ts?.data ?? null;
  const ROLL7 = "son 7 gün ↔ önceki 7 gün";

  const go = (t: AdminNavTarget) => (onNavigate ? () => onNavigate(t) : undefined);
  const pendingComm = Number.isFinite(data.commission_pending_amount) ? data.commission_pending_amount : Math.max(0, data.commission_amount - data.commission_paid_amount);

  const queue = [
    { icon: "clipboard-clock-outline" as const, label: "İnceleme bekleyen ilan", n: data.listings_pending, to: "listings" as AdminNavTarget },
    { icon: "flag-outline" as const, label: "Açık şikayet", n: data.open_reports, to: "complaints" as AdminNavTarget },
    { icon: "handshake-outline" as const, label: "Ortaklık başvurusu", n: data.partnerships_pending, to: "partnerships" as AdminNavTarget },
    { icon: "shape-plus-outline" as const, label: "Kategori önerisi", n: data.cat_suggestions, to: "categories" as AdminNavTarget },
    { icon: "map-marker-plus-outline" as const, label: "Konum önerisi", n: data.loc_suggestions, to: "locations" as AdminNavTarget }
  ].filter((q) => q.n > 0);

  const shown = days.slice(-range);
  const trendLabels = shown.map((d) => `${d.day.slice(8, 10)}.${d.day.slice(5, 7)}`);
  const trendSeries = [
    { label: "Aktif kullanıcı", color: SERIES.a, values: shown.map((d) => d.active) },
    { label: "Yeni kayıt", color: SERIES.b, values: shown.map((d) => d.signups) },
    { label: "Yeni ilan", color: SERIES.c, values: shown.map((d) => d.listings) }
  ];
  const trendEmpty = shown.every((d) => d.active === 0 && d.signups === 0 && d.listings === 0);
  const moneySeries = [
    { label: "GMV (satış değeri)", color: SERIES.a, values: shown.map((d) => d.gmv) },
    { label: "Komisyon", color: SERIES.c, values: shown.map((d) => d.commission) }
  ];
  const moneyEmpty = shown.every((d) => d.gmv === 0 && d.commission === 0);
  const statusDonut = [
    { label: "Yayında", value: data.listings_active, color: colors.primary },
    { label: "İncelemede", value: data.listings_pending, color: colors.gold },
    { label: "Duraklatılmış", value: data.listings_paused, color: colors.subtle },
    { label: "Satıldı", value: data.listings_sold, color: colors.violet }
  ].filter((d) => d.value > 0);
  const catBars = (data.top_categories ?? []).slice(0, 8).map((c) => ({ label: c.category || "Kategori yok", value: c.n, color: colors.primary }));
  const commStatusData = (data.commission_status ?? []).filter((s) => s.amount > 0).map((s) => ({ label: commLabel(s.status), value: s.amount, color: commColor(s.status) }));
  const topEarners = (data.top_earners ?? []).filter((e) => e.amount > 0).map((e) => ({ label: e.name, value: e.amount, color: colors.primary }));
  // Huni — tamamı sunucu toplamı. Talep toplamı admin_overview'dan; yoksa o adım gösterilmez.
  const leadsTotal = overview ? overview.leads_total : t ? t.leads_total : null;
  const funnel = [
    ...(t ? [{ label: "İlan görüntülenme (toplam)", value: t.views_total, color: colors.subtle }] : []),
    { label: "Aktif ilan", value: data.listings_active, color: colors.primaryDark },
    { label: "Ortaklık (toplam)", value: data.partnerships_total, color: colors.primary },
    ...(leadsTotal != null ? [{ label: "Talep (lead)", value: leadsTotal, color: colors.info }] : []),
    { label: "Sipariş", value: data.orders_total, color: colors.violet },
    { label: "Ödenen komisyon kaydı", value: data.commissions_paid, color: colors.gold }
  ];
  const funnelEmpty = funnel.every((f) => f.value === 0);

  return (
    <View style={{ gap: 16 }}>
      {header}

      {error ? (
        <View style={{ alignItems: "center", backgroundColor: colors.goldSoft, borderRadius: 12, flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 12 }}>
          <MaterialCommunityIcons name="alert-outline" size={17} color={colors.goldInk} />
          <Text style={{ color: colors.goldInk, flex: 1, fontSize: 12.5, fontWeight: "700", minWidth: 180 }}>Son yenileme başarısız — aşağıdaki değerler {updatedAt || "önceki"} anına ait.</Text>
          <Pressable accessibilityRole="button" disabled={refreshing} onPress={() => void load(true)} style={{ alignItems: "center", backgroundColor: colors.surface, borderRadius: 9, justifyContent: "center", minHeight: 40, paddingHorizontal: 14 }}>
            <Text style={{ color: colors.goldInk, fontSize: 12.5, fontWeight: "900" }}>Tekrar dene</Text>
          </Pressable>
        </View>
      ) : null}

      {/* KPI — kullanıcı & içerik */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <KpiTile label="Şu an aktif" value={fmt(data.live_now)} live icon="access-point" sub="son 5 dakika" />
        <KpiTile label="Bugün aktif" value={fmt(data.active_today)} icon="account-clock-outline" sub={yesterday ? `dün ${fmt(yesterday.active)}` : undefined} />
        <KpiTile label="Toplam kullanıcı" value={fmt(data.total_users)} icon="account-group" delta={cmp((d) => d.signups)} deltaLabel={`yeni kayıt · ${WEEK}`} sub={`+${fmt(data.new_7d)} son 7 gün · bugün +${fmt(data.new_today)}`} onPress={go("users")} />
        <KpiTile label="Aktif ilan" value={fmt(data.listings_active)} icon="storefront-outline" sub={`${fmt(data.listings_total)} toplam`} onPress={go("listings")} />
        <KpiTile label="Yeni ilan (7 gün)" value={fmt(data.listings_new_7d)} icon="file-plus-outline" delta={cmp((d) => d.listings)} deltaLabel={WEEK} sub={`bugün +${fmt(today?.listings ?? 0)}`} onPress={go("listings")} />
        <KpiTile label="Mesaj (24 saat)" value={msgStats ? fmt(msgStats.messages_24h) : t ? fmt(t.messages_24h) : null} icon="message-text-outline" delta={t ? deltaOf(t.messages_24h, t.messages_prev_24h) : undefined} deltaLabel="son 24 saat ↔ önceki 24 saat" sub={msgStats ? `${fmt(msgStats.messages)} toplam · ${fmt(msgStats.conversations)} görüşme` : undefined} onPress={go("messages")} />
        <KpiTile label="Ortaklık başvurusu" value={fmt(data.partnerships_pending)} icon="handshake-outline" tone={data.partnerships_pending > 0 ? "warning" : "brand"} sub={`${fmt(data.partnerships_active)} aktif · ${fmt(data.partnerships_total)} toplam`} onPress={go("partnerships")} />
        <KpiTile label="Talep (lead)" value={leadsTotal != null ? fmt(leadsTotal) : null} icon="account-arrow-right-outline" delta={t ? deltaOf(t.leads_7d, t.leads_prev_7d) : undefined} deltaLabel={ROLL7} sub={t ? `+${fmt(t.leads_7d)} son 7 gün · toplam kayıt` : "toplam kayıt"} onPress={go("records")} />
      </View>
      {/* KPI — para akışı & güven. Platform para TUTMAZ; akan parayı izler. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <KpiTile label="Sipariş" value={fmt(data.orders_total)} icon="cart-check" delta={t ? deltaOf(t.orders_7d, t.orders_prev_7d) : undefined} deltaLabel={ROLL7} sub={t ? `+${fmt(t.orders_7d)} son 7 gün · toplam sipariş kaydı` : "toplam sipariş kaydı"} onPress={go("commissions")} />
        <KpiTile label="GMV (satış değeri)" value={money(data.gmv)} icon="cash-multiple" delta={cmp((d) => d.gmv)} deltaLabel={WEEK} sub={`son 7 gün ${money(data.gmv_7d)}`} onPress={go("commissions")} />
        <KpiTile label="Bekleyen komisyon" value={money(pendingComm)} icon="cash-clock" tone={pendingComm > 0 ? "warning" : "brand"} sub="satıcı → ortak, ödenmemiş" onPress={go("commissions")} />
        <KpiTile label="Ödenen komisyon" value={money(data.commission_paid_amount)} icon="cash-check" tone="success" sub={`${fmt(data.commissions_paid)} ödeme kaydı`} onPress={go("commissions")} />
        <KpiTile label="Komisyon (7 gün)" value={money(data.commission_7d)} icon="receipt-text-outline" delta={cmp((d) => d.commission)} deltaLabel={WEEK} sub={`${money(data.commission_amount)} toplam`} onPress={go("commissions")} />
        <KpiTile label="Açık şikayet" value={fmt(data.open_reports)} icon="flag-outline" tone={data.open_reports > 0 ? "danger" : "success"} goodWhenDown delta={t ? deltaOf(t.reports_7d, t.reports_prev_7d) : undefined} deltaLabel={`yeni şikayet · ${ROLL7}`} sub={overview ? `${fmt(overview.reports_total)} toplam` : data.open_reports > 0 ? "işlem bekliyor" : "bekleyen yok"} onPress={go("complaints")} />
      </View>

      {/* Bekleyen işler — dokununca ilgili bölüme gider */}
      <View style={{ ...ADMIN_CARD, gap: 10, padding: 14 }}>
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>Bekleyen işler</Text>
        {queue.length === 0 ? (
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name="check-circle-outline" size={17} color="#15803D" />
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>Şu an işlem bekleyen kayıt yok.</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {queue.map((q) => (
              <Pressable key={q.label} accessibilityRole="button" accessibilityLabel={`${q.label}: ${q.n}`} disabled={!onNavigate} onPress={() => onNavigate?.(q.to)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.primarySoft : colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, minHeight: 40, paddingHorizontal: 11 })}>
                <MaterialCommunityIcons name={q.icon} size={15} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{q.label}</Text>
                <View style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 999, justifyContent: "center", minWidth: 20, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{q.n}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Aktivite trendi + ilan durumu */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <ChartCard title="Aktivite trendi" meta={`Son ${range} gün · günlük · sunucu verisi`} basis={420} grow={2} right={<RangeSwitch value={range} onChange={setRange} options={[{ key: 7, label: "7 gün" }, { key: 14, label: "14 gün" }]} />}>
          <View onLayout={(e) => setLineW(Math.round(e.nativeEvent.layout.width))} style={{ width: "100%" }}>
            {trendEmpty ? <NoData text={`Son ${range} günde kayıtlı aktivite yok.`} /> : lineW > 0 ? <MultiLineChart labels={trendLabels} series={trendSeries} width={lineW} /> : <View style={{ height: 200 }} />}
          </View>
        </ChartCard>
        <ChartCard title="İlan durumu" meta="Tüm ilanlar · sunucu verisi" basis={280}>
          {statusDonut.length ? <DonutChart data={statusDonut} size={150} centerTop={fmt(data.listings_total)} centerBottom="toplam ilan" /> : <NoData text="Henüz ilan yok." />}
        </ChartCard>
      </View>

      {/* Huni + en çok ilan olan kategoriler */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <ChartCard title="Ortak satış hunisi" meta={`${t ? "Görüntülenme → ilan" : "İlan"} → ortaklık → talep → sipariş · sunucu toplamları`} basis={320}>
          {funnelEmpty ? <NoData text="Henüz huni verisi yok." /> : <FunnelChart data={funnel} showRate={false} />}
        </ChartCard>
        <ChartCard title="En çok ilan olan kategoriler" meta="Aktif ilan sayısına göre ilk 8 · sunucu verisi" basis={320}>
          {catBars.length ? <HBarChart data={catBars} rank /> : <NoData text="Aktif ilan yok." />}
        </ChartCard>
      </View>

      {/* Para akışı — GMV + komisyon. Ödeme satıcı ↔ ortak arasında platform DIŞI yapılır. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <ChartCard title="Para akışı (₺)" meta={`Son ${range} gün · GMV = sipariş tutarı · platform para tutmaz`} basis={420} grow={2}>
          <View onLayout={(e) => setMoneyW(Math.round(e.nativeEvent.layout.width))} style={{ width: "100%" }}>
            {moneyEmpty ? <NoData text={`Son ${range} günde sipariş veya komisyon kaydı yok.`} /> : moneyW > 0 ? <MultiLineChart labels={trendLabels} series={moneySeries} width={moneyW} valueFmt={money} /> : <View style={{ height: 200 }} />}
          </View>
        </ChartCard>
        <ChartCard title="Komisyon durumu (₺)" meta="Tutar dağılımı · sunucu verisi" basis={280}>
          {commStatusData.length ? <DonutChart data={commStatusData} size={140} centerTop={money(data.commission_amount)} centerBottom="komisyon" /> : <NoData text="Henüz komisyon kaydı yok." />}
        </ChartCard>
      </View>
      <ChartCard title="En çok kazanan ortaklar" meta="Kayıtlı komisyon tutarına göre ilk 6 · sunucu verisi">
        {topEarners.length ? <HBarChart data={topEarners} valueFmt={money} rank /> : <NoData text="Henüz komisyon kazanan ortak yok." />}
      </ChartCard>
    </View>
  );
}

// Komisyon durum kodlarını TR etikete çevir (donut/liste için).
function commLabel(s: string): string {
  const m: Record<string, string> = {
    recorded: "Kaydedildi", pending: "Bekliyor", approved: "Onaylandı", seller_paid: "Satıcı ödedi", paid: "Ödendi",
    disputed: "Anlaşmazlık", cancelled: "İptal", refunded: "İade", released: "Serbest", return_pending: "İade süresi"
  };
  return m[s] ?? s;
}
// Durum → anlam rengi (yeşil yalnız gerçek başarı, kırmızı anlaşmazlık, altın bekleyen).
function commColor(s: string): string {
  if (s === "paid" || s === "released") return colors.success;
  if (s === "disputed") return colors.accent;
  if (s === "cancelled" || s === "refunded") return colors.subtle;
  if (s === "approved") return colors.primary;
  if (s === "seller_paid") return colors.violet;
  return colors.gold;
}

// >=10.000 sayıları kısalt (12,5B gibi), tabular hizalama için.
function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(".0", "")}B`;
  return new Intl.NumberFormat("tr-TR").format(n);
}
