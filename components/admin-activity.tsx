import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

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
  gmv: number;
  paid_gmv: number;
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

// Grafik seri renkleri — kategorik SABİT sıra (dataviz): aktif=yeşil, kayıt=mor, ilan=altın.
const SERIES = { active: colors.primary, signups: colors.violet, listings: colors.gold };

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
    const start = () => { if (!timer.current) timer.current = setInterval(() => void load(), 15_000); };
    const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
    const onVis = () => { if (typeof document !== "undefined" && document.visibilityState === "hidden") stop(); else { void load(); start(); } };
    start();
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);
    return () => { stop(); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxBar = useMemo(() => Math.max(1, ...(data?.days ?? []).flatMap((d) => [d.active, d.signups, d.listings])), [data]);
  const maxCat = useMemo(() => Math.max(1, ...((data?.top_categories ?? []).map((c) => c.n))), [data]);

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

  // Canlı kullanıcı kartları (server-true presence).
  const liveCards: StatTileProps[] = [
    { icon: "access-point", label: "Şu an aktif", value: String(data.live_now), sub: "Son 5 dakikada", tint: colors.successSoft, color: colors.success, live: true },
    { icon: "account-clock-outline", label: "Bugün aktif", value: String(data.active_today), sub: "Günlük aktif kullanıcı", tint: colors.primarySoft, color: colors.primaryDark },
    { icon: "account-group", label: "Toplam kayıtlı", value: fmt(data.total_users), sub: `${fmt(data.confirmed_users)} doğrulanmış`, tint: colors.infoSoft, color: colors.info },
    { icon: "account-plus-outline", label: "Bu hafta yeni", value: fmt(data.new_7d), sub: `Bugün +${fmt(data.new_today)}`, tint: colors.violetSoft, color: colors.violet }
  ];
  // Site-geneli sunucu-gerçek toplamlar (istemci-cap'i yok).
  const siteCards: StatTileProps[] = [
    { icon: "storefront-outline", label: "Aktif ilan", value: fmt(data.listings_active), sub: `${fmt(data.listings_total)} toplam · +${fmt(data.listings_new_7d)} bu hafta`, tint: colors.primarySoft, color: colors.primaryDark },
    { icon: "cash-multiple", label: "Toplam GMV", value: money(data.gmv), sub: `${money(data.paid_gmv)} ödenen`, tint: colors.goldSoft, color: "#B7791F" },
    { icon: "receipt-text-outline", label: "Komisyon kaydı", value: fmt(data.commissions_total), sub: `${fmt(data.commissions_paid)} ödendi`, tint: colors.infoSoft, color: colors.info },
    { icon: "handshake-outline", label: "Aktif ortaklık", value: fmt(data.partnerships_active), sub: `${fmt(data.partnerships_total)} toplam · ${fmt(data.partnerships_pending)} bekliyor`, tint: colors.violetSoft, color: colors.violet }
  ];
  // Moderasyon kuyruğu (durum renkleri — ikon+etiket).
  const queue = [
    { icon: "clipboard-clock-outline" as const, label: "İnceleme bekleyen", n: data.listings_pending, color: colors.warning, tint: colors.warningSoft ?? colors.goldSoft },
    { icon: "flag-outline" as const, label: "Açık şikayet", n: data.open_reports, color: colors.accent, tint: colors.accentSoft },
    { icon: "shape-plus-outline" as const, label: "Kategori önerisi", n: data.cat_suggestions, color: colors.info, tint: colors.infoSoft },
    { icon: "map-marker-plus-outline" as const, label: "Konum önerisi", n: data.loc_suggestions, color: colors.info, tint: colors.infoSoft }
  ].filter((q) => q.n > 0);

  const allZero = data.days.every((d) => d.active === 0 && d.signups === 0 && d.listings === 0) && data.live_now === 0;

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

      {/* Canlı kullanıcı + site toplamları */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{liveCards.map((c) => <StatTile key={c.label} {...c} />)}</View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{siteCards.map((c) => <StatTile key={c.label} {...c} />)}</View>

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

      {/* 14 günlük trend (aktif / kayıt / ilan) */}
      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 18 }}>
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          <Text style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" }}>Son 14 gün</Text>
          <LegendDot color={SERIES.active} label="Aktif" />
          <LegendDot color={SERIES.signups} label="Yeni kayıt" />
          <LegendDot color={SERIES.listings} label="Yeni ilan" />
        </View>
        <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 6, height: 148 }}>
          {data.days.map((d) => (
            <View key={d.day} style={{ alignItems: "center", flex: 1, gap: 6, justifyContent: "flex-end" }}>
              <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 2, height: 108, justifyContent: "center" }}>
                <Bar value={d.active} max={maxBar} color={SERIES.active} />
                <Bar value={d.signups} max={maxBar} color={SERIES.signups} />
                <Bar value={d.listings} max={maxBar} color={SERIES.listings} />
              </View>
              <Text style={{ color: colors.subtle, fontSize: 9.5, fontWeight: "800" }}>{dayNum(d.day)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Top kategoriler (aktif ilan sayısına göre) */}
      {data.top_categories && data.top_categories.length > 0 ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 11, padding: 18 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>En çok ilan olan kategoriler</Text>
          {data.top_categories.map((c) => (
            <View key={c.category} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row" }}>
                <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{c.category}</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{fmt(c.n)}</Text>
              </View>
              <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 8, overflow: "hidden" }}>
                <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: 8, width: `${Math.max(3, Math.round((c.n / maxCat) * 100))}%` }} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {allZero ? (
        <View style={{ backgroundColor: colors.infoSoft, borderRadius: 12, gap: 4, padding: 14 }}>
          <Text style={{ color: colors.info, fontSize: 13, fontWeight: "900" }}>Henüz canlı aktivite yok</Text>
          <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>
            Bu alan GERÇEK sunucu verisiyle çalışır (sahte sayaç yok). Kullanıcılar siteye girip gezdikçe, ilan/satış oldukça değerler burada canlanır. Panel 15 saniyede bir kendini tazeler.
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
function dayNum(iso: string): string {
  return iso.slice(8, 10); // gün numarası (14 gün için kısa)
}

type StatTileProps = { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; sub: string; tint: string; color: string; live?: boolean };
function StatTile({ icon, label, value, sub, tint, color, live }: StatTileProps) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: live ? colors.success : colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 180, flexGrow: 1, gap: 8, minWidth: 148, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <View style={{ alignItems: "center", backgroundColor: tint, borderRadius: 10, height: 34, justifyContent: "center", width: 34 }}>
          <MaterialCommunityIcons name={icon} size={18} color={color} />
        </View>
        {live ? (
          <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
            <View style={{ backgroundColor: colors.success, borderRadius: 999, height: 7, width: 7 }} />
            <Text style={{ color: colors.success, fontSize: 10, fontWeight: "900" }}>CANLI</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ color: colors.ink, fontSize: 26, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{value}</Text>
      <View style={{ gap: 1 }}>
        <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{sub}</Text>
      </View>
    </View>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const h = Math.max(value > 0 ? 5 : 2, Math.round((value / max) * 108));
  return (
    <View style={{ alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
      {value > 0 ? <Text style={{ color: colors.subtle, fontSize: 8.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{value}</Text> : null}
      <View style={{ backgroundColor: value > 0 ? color : colors.line, borderTopLeftRadius: 4, borderTopRightRadius: 4, height: h, width: 9 }} />
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
      <View style={{ backgroundColor: color, borderRadius: 3, height: 10, width: 10 }} />
      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
