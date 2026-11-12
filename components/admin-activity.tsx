import { MaterialCommunityIcons } from "@/components/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";

import { ADMIN_CARD, ChartCard, KpiTile, LiveDot, NoData, RangeSwitch, SkeletonBlock, deltaOf } from "@/components/admin-kit";
import { DonutChart, FunnelChart, HBarChart, MultiLineChart } from "@/components/charts";
import { colors } from "@/components/colors";
import { money } from "@/lib/format";
import { fetchAdminMessageStats, fetchAdminOverview, type AdminOverview } from "@/lib/live-service";
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

/**
 * Admin Canlı Panel — GERÇEK sunucu verisi:
 *   • admin_live_analytics RPC (toplamlar + 14 günlük günlük seri)
 *   • admin_overview RPC (talep/lead toplamı, şikayet toplamı)
 *   • admin_message_stats RPC (mesaj toplamı + son 24 saat)
 * 30 sn'de bir tazelenir; sekme gizli / uygulama arka plandayken DURAKLAR. Dönem farkları
 * (son 7 gün ↔ önceki 7 gün, bugün ↔ dün) sunucunun döndürdüğü günlük seriden hesaplanır;
 * serisi olmayan metriklerde fark GÖSTERİLMEZ (uydurulmaz).
 * Tüm RPC'ler sunucuda is_admin korumalıdır — yetkisiz çağrı hata döner, veri dönmez.
 */
export function AdminActivity({ onData, onOverview, onMsgStats, onNavigate }: { onData?: (a: AdminAnalytics) => void; onOverview?: (o: AdminOverview) => void; onMsgStats?: (m: AdminMsgStats) => void; onNavigate?: (target: AdminNavTarget) => void }) {
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
        onPress={() => void load(true)}
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
  const funnel = [
    { label: "Aktif ilan", value: data.listings_active, color: colors.primaryDark },
    { label: "Ortaklık (toplam)", value: data.partnerships_total, color: colors.primary },
    ...(overview ? [{ label: "Talep (lead)", value: overview.leads_total, color: colors.info }] : []),
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
        <KpiTile label="Mesaj (24 saat)" value={msgStats ? fmt(msgStats.messages_24h) : null} icon="message-text-outline" sub={msgStats ? `${fmt(msgStats.messages)} toplam · ${fmt(msgStats.conversations)} görüşme` : undefined} onPress={go("messages")} />
        <KpiTile label="Ortaklık başvurusu" value={fmt(data.partnerships_pending)} icon="handshake-outline" tone={data.partnerships_pending > 0 ? "warning" : "brand"} sub={`${fmt(data.partnerships_active)} aktif · ${fmt(data.partnerships_total)} toplam`} onPress={go("partnerships")} />
        <KpiTile label="Talep (lead)" value={overview ? fmt(overview.leads_total) : null} icon="account-arrow-right-outline" sub="toplam kayıt" onPress={go("records")} />
      </View>
      {/* KPI — para akışı & güven. Platform para TUTMAZ; akan parayı izler. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <KpiTile label="Sipariş" value={fmt(data.orders_total)} icon="cart-check" sub="toplam sipariş kaydı" onPress={go("commissions")} />
        <KpiTile label="GMV (satış değeri)" value={money(data.gmv)} icon="cash-multiple" delta={cmp((d) => d.gmv)} deltaLabel={WEEK} sub={`son 7 gün ${money(data.gmv_7d)}`} onPress={go("commissions")} />
        <KpiTile label="Bekleyen komisyon" value={money(pendingComm)} icon="cash-clock" tone={pendingComm > 0 ? "warning" : "brand"} sub="satıcı → ortak, ödenmemiş" onPress={go("commissions")} />
        <KpiTile label="Ödenen komisyon" value={money(data.commission_paid_amount)} icon="cash-check" tone="success" sub={`${fmt(data.commissions_paid)} ödeme kaydı`} onPress={go("commissions")} />
        <KpiTile label="Komisyon (7 gün)" value={money(data.commission_7d)} icon="receipt-text-outline" delta={cmp((d) => d.commission)} deltaLabel={WEEK} sub={`${money(data.commission_amount)} toplam`} onPress={go("commissions")} />
        <KpiTile label="Açık şikayet" value={fmt(data.open_reports)} icon="flag-outline" tone={data.open_reports > 0 ? "danger" : "success"} sub={overview ? `${fmt(overview.reports_total)} toplam` : data.open_reports > 0 ? "işlem bekliyor" : "bekleyen yok"} onPress={go("complaints")} />
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
        <ChartCard title="Ortak satış hunisi" meta="İlan → ortaklık → talep → sipariş · sunucu toplamları" basis={320}>
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
