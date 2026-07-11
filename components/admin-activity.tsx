import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { CAT, DonutChart, HBarChart, KpiDeltaTile, LineAreaChart } from "@/components/charts";
import { colors } from "@/components/colors";
import { money } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type DayPoint = { day: string; active: number; signups: number; listings: number };
type CatPoint = { category: string; n: number };
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


/**
 * Admin Canlı Panel — GERÇEK sunucu verisiyle (admin_live_analytics RPC). İstemci-cap'li
 * dizilerden DEĞİL: toplam kullanıcı/ilan/GMV/komisyon/ortaklık sunucu-gerçek. "Şu an aktif"
 * (son 5 dk presence) + bugün/hafta + 14 günlük trend + top kategoriler + moderasyon kuyruğu.
 * 15 sn'de bir tazelenir (sekme gizliyken duraklar).
 */
export function AdminActivity({ onData }: { onData?: (a: AdminAnalytics) => void }) {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [lineW, setLineW] = useState(560); // çizgi grafiği responsive genişliği (onLayout ile ölçülür)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  async function load() {
    if (!supabase) { setError("Canlı bağlantı yok (önizleme modu)."); setLoading(false); return; }
    try {
      const { data: res, error: err } = await supabase.rpc("admin_live_analytics");
      if (err) throw err;
      const a = res as AdminAnalytics;
      setData(a);
      onDataRef.current?.(a);
      setError(null);
      const d = new Date();
      setUpdatedAt(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`);
    } catch (e) {
      setError((e as Error).message || "Analitik yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Sekme gizliyken poll etme (gereksiz RPC yükü). visibilitychange ile duraklat/sürdür.
    const start = () => { if (!timer.current) timer.current = setInterval(() => void load(), 30_000); };
    const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
    const onVis = () => { if (typeof document !== "undefined" && document.visibilityState === "hidden") stop(); else { void load(); start(); } };
    start();
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);
    return () => { stop(); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) {
    return <View style={{ padding: 24 }}><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Canlı panel yükleniyor…</Text></View>;
  }
  if (error && !data) {
    return (
      <View style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: 12, borderWidth: 1, gap: 8, padding: 16 }}>
        <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "900" }}>Analitik yüklenemedi</Text>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "600" }}>{error}</Text>
        <Pressable onPress={() => void load()} style={{ alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>Tekrar dene</Text>
        </Pressable>
      </View>
    );
  }
  if (!data) return null;

  // Moderasyon kuyruğu (durum renkleri — ikon+etiket).
  const queue = [
    { icon: "clipboard-clock-outline" as const, label: "İnceleme bekleyen", n: data.listings_pending, color: colors.warning, tint: colors.warningSoft },
    { icon: "flag-outline" as const, label: "Açık şikayet", n: data.open_reports, color: colors.accent, tint: colors.accentSoft },
    { icon: "shape-plus-outline" as const, label: "Kategori önerisi", n: data.cat_suggestions, color: colors.info, tint: colors.infoSoft },
    { icon: "map-marker-plus-outline" as const, label: "Konum önerisi", n: data.loc_suggestions, color: colors.info, tint: colors.infoSoft }
  ].filter((q) => q.n > 0);

  const allZero = data.days.every((d) => d.active === 0 && d.signups === 0 && d.listings === 0) && data.live_now === 0;

  // Grafik verileri (gerçek analitik)
  const statusDonut = [
    { label: "Yayında", value: data.listings_active, color: CAT[0] },
    { label: "İncelemede", value: data.listings_pending, color: CAT[2] },
    { label: "Duraklatılmış", value: data.listings_paused, color: CAT[7] },
    { label: "Satıldı", value: data.listings_sold, color: CAT[3] }
  ].filter((d) => d.value > 0);
  const activeTrend = data.days.map((d) => ({ label: d.day.slice(8, 10), value: d.active }));
  const catBars = (data.top_categories ?? []).slice(0, 6).map((c) => ({ label: c.category, value: c.n }));

  return (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <View style={{ backgroundColor: colors.success, borderRadius: 999, height: 9, width: 9 }} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900" }}>Canlı Panel</Text>
        <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 9, paddingVertical: 3 }}>
          <MaterialCommunityIcons name="sync" size={12} color={colors.subtle} />
          <Text style={{ color: colors.subtle, fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "800" }}>{updatedAt || "—"}</Text>
        </View>
      </View>

      {/* Renkli KPI kartları — canlı kullanıcı */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <KpiDeltaTile label="Şu an aktif" value={data.live_now} live icon="access-point" tint="#0EA5B7" accent="#0B7285" sub="Son 5 dakikada" />
        <KpiDeltaTile label="Bugün aktif" value={data.active_today} icon="account-clock-outline" tint="#17B3B3" accent="#128F8F" sub="Günlük aktif kullanıcı" />
        <KpiDeltaTile label="Toplam kayıtlı" value={data.total_users} icon="account-group" tint="#2C82F6" accent="#1E63C8" sub={`${fmt(data.confirmed_users)} doğrulanmış`} />
        <KpiDeltaTile label="Bu hafta yeni" value={data.new_7d} delta={data.new_today} icon="account-plus-outline" tint="#7C5CFC" accent="#5E3FE0" sub={`Bugün +${fmt(data.new_today)}`} />
      </View>
      {/* Renkli KPI kartları — site geneli (sunucu-gerçek) */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <KpiDeltaTile label="Aktif ilan" value={data.listings_active} icon="storefront-outline" tint="#0EA5B7" accent="#0B7285" sub={`${fmt(data.listings_total)} toplam · +${fmt(data.listings_new_7d)} bu hafta`} />
        <KpiDeltaTile label="Toplam GMV" value={data.gmv} money icon="cash-multiple" tint="#E0A81E" accent="#B7791F" sub={`${fmt(data.orders_total)} sipariş — satış değeri`} />
        <KpiDeltaTile label="Komisyon (₺)" value={data.commission_amount} money icon="receipt-text-outline" tint="#2C82F6" accent="#1E63C8" sub={`${money(data.commission_paid_amount)} ödendi`} />
        <KpiDeltaTile label="Aktif ortaklık" value={data.partnerships_active} icon="handshake-outline" tint="#7C5CFC" accent="#5E3FE0" sub={`${fmt(data.partnerships_total)} toplam · ${fmt(data.partnerships_pending)} bekliyor`} />
      </View>

      {/* Moderasyon kuyruğu (yalnız iş varsa) */}
      {queue.length > 0 ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 14 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", width: "100%" }}>Bekleyen işler</Text>
          {queue.map((q) => (
            <View key={q.label} style={{ alignItems: "center", backgroundColor: q.tint, borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 6 }}>
              <MaterialCommunityIcons name={q.icon} size={14} color={q.color} />
              <Text style={{ color: q.color, fontSize: 12.5, fontWeight: "900" }}>{q.label}</Text>
              <View style={{ backgroundColor: q.color, borderRadius: 999, minWidth: 18, paddingHorizontal: 5 }}><Text style={{ color: "#FFFFFF", fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900", textAlign: "center" }}>{q.n}</Text></View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Grafikler: 14-gün aktif trendi (çizgi+alan) + ilan durumu (donut) */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <View onLayout={(e) => setLineW(Math.max(240, Math.round(e.nativeEvent.layout.width) - 36))} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 420, flexGrow: 2, gap: 12, minWidth: 300, padding: 18, shadowColor: "#0B3A44", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 12 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>Son 14 gün — aktif kullanıcı</Text>
          <LineAreaChart points={activeTrend} width={lineW} color={CAT[0]} />
        </View>
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 300, flexGrow: 1, gap: 12, minWidth: 260, padding: 18, shadowColor: "#0B3A44", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 12 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>İlan durumu</Text>
          {statusDonut.length ? <DonutChart data={statusDonut} size={150} centerTop={fmt(data.listings_total)} centerBottom="toplam ilan" /> : <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>Henüz ilan yok.</Text>}
        </View>
      </View>

      {/* Top kategoriler (aktif ilan sayısına göre) */}
      {catBars.length > 0 ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18, shadowColor: "#0B3A44", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 12 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>En çok ilan olan kategoriler</Text>
          <HBarChart data={catBars} />
        </View>
      ) : null}

      {allZero ? (
        <View style={{ backgroundColor: colors.infoSoft, borderRadius: 12, gap: 4, padding: 14 }}>
          <Text style={{ color: colors.info, fontSize: 13, fontWeight: "900" }}>Henüz canlı aktivite yok</Text>
          <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>
            Bu alan GERÇEK sunucu verisiyle çalışır (sahte sayaç yok). Kullanıcılar siteye girip gezdikçe, ilan/satış oldukça değerler burada canlanır. Panel 30 saniyede bir kendini tazeler.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// >=1000 sayıları kısalt (1.2B gibi), tabular hizalama için.
function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(".0", "")}B`;
  return new Intl.NumberFormat("tr-TR").format(n);
}

