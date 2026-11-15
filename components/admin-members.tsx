import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { ADMIN_CARD, ActionButton, ChartCard, KpiTile, LiveDot, NoData, SkeletonBlock } from "@/components/admin-kit";
import { DonutChart, MultiLineChart } from "@/components/charts";
import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { supabase } from "@/lib/supabase";

/**
 * YÖNETİM — ÜYELER: CANLI DURUM (2026-11-15).
 *
 * İstek: "üyeleri en sondan ilke üyelik tarihiyle görelim; anlık kim çevrim içi, kim içeride bilelim; grafikler güncel
 * olsun". Veri tek sunucu sorgusundan gelir: `admin_member_overview` (yönetici korumalı; bkz.
 * supabase/migrations/20261115120000_admin_member_overview.sql). 30 saniyede bir yenilenir, sekme gizliyken durur.
 *
 * Dürüstlük notları (arayüzde de yazılı):
 * - "Çevrim içi" = son 5 dakikada sinyal gönderen GİRİŞ YAPMIŞ üye. Giriş yapmamış ziyaretçi sayılamaz (kimlik tutmuyoruz).
 * - Ortam (web / iOS / Android) bu özellikten SONRAKİ sinyallerde kaydedilir; eski üyelerde boş görünür.
 * - Sayılar uydurulmaz: veri gelmediyse iskelet ya da "yüklenemedi" gösterilir.
 */
export type MemberInfo = {
  id: string; no: number; email: string | null; provider: string;
  created_at: string | null; last_seen_at: string | null; last_sign_in_at: string | null; platform: string | null;
  listing_count: number; active_listing_count: number; partnership_count: number;
};
export type MemberOverview = {
  now: string; total: number; online_now: number; active_1h: number; active_today: number;
  joined_today: number; joined_7d: number; joined_30d: number;
  online: Array<{ id: string; name: string | null; last_seen_at: string; platform: string | null }>;
  days: Array<{ day: string; signups: number; active: number }>;
  providers: Array<{ provider: string; count: number }>;
  members: MemberInfo[];
};
export type MemberOverviewState = {
  data: MemberOverview | null; byId: Map<string, MemberInfo>; loading: boolean; failed: boolean;
  /** Son başarılı yanıtın istemci saati (ms). Göreli zamanlar buna göre hesaplanır. */
  fetchedAt: number; reload: () => void;
};

export const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const REFRESH_MS = 30_000;
const TR_OFFSET_MS = 3 * 60 * 60 * 1000; // Türkiye yıl boyu UTC+3 (yaz saati yok)
const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

/** "15.11.2026 18:35" — Türkiye saatiyle. Yerel-ayar işlevleri kullanılmaz (uygulamada yavaş, tarayıcıya göre değişir). */
export function memberDateTime(iso?: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "—";
  const d = new Date(t + TR_OFFSET_MS);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "şimdi", "4 dk önce", "3 sa önce", "dün", "6 gün önce", "2 ay önce". */
export function memberRelative(iso: string | null | undefined, nowMs: number): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "hiç";
  const diff = Math.max(0, nowMs - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "şimdi";
  if (min < 60) return `${min} dk önce`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "dün";
  if (days < 30) return `${days} gün önce`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ay önce`;
  return `${Math.floor(months / 12)} yıl önce`;
}

export function isMemberOnline(iso: string | null | undefined, nowMs: number): boolean {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) && nowMs - t <= ONLINE_WINDOW_MS;
}

export function providerLabel(provider?: string | null): string {
  return provider === "google" ? "Google" : provider === "apple" ? "Apple" : provider === "email" || !provider ? "E-posta" : provider;
}
export function platformLabel(platform?: string | null): string {
  return platform === "ios" ? "iPhone uygulaması" : platform === "android" ? "Android uygulaması" : platform === "web" ? "Web sitesi" : "bilinmiyor";
}
const platformIcon = (platform?: string | null) => (platform === "ios" ? "apple" : platform === "android" ? "android" : platform === "web" ? "web" : "help-circle-outline") as keyof typeof MaterialCommunityIcons.glyphMap;

/** Sunucudan üye özetini çeker; `enabled` iken 30 sn'de bir yeniler (sekme gizliyken beklemez, görününce hemen yeniler). */
export function useMemberOverview(enabled: boolean): MemberOverviewState {
  const [data, setData] = useState<MemberOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(0);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (!supabase || busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const { data: raw, error } = await supabase.rpc("admin_member_overview");
      if (error || !raw) { setFailed(true); return; }
      setData(raw as MemberOverview);
      setFetchedAt(Date.now());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const hidden = () => Platform.OS === "web" && typeof document !== "undefined" && document.visibilityState !== "visible";
    const timer = setInterval(() => { if (!hidden()) void load(); }, REFRESH_MS);
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const onVisible = () => { if (!hidden()) void load(); };
      document.addEventListener("visibilitychange", onVisible);
      return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
    }
    return () => clearInterval(timer);
  }, [enabled, load]);

  const byId = useMemo(() => new Map((data?.members ?? []).map((m) => [m.id, m])), [data]);
  return { data, byId, loading, failed, fetchedAt, reload: () => void load() };
}

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const SERIES_JOIN = "#0645C9";
const SERIES_ACTIVE = "#7C5CFC";
const PROVIDER_COLOR: Record<string, string> = { email: "#0645C9", google: "#E4572E", apple: "#09275E" };

export function MemberOverviewPanel({ state, nameOf, onOpenUser }: { state: MemberOverviewState; nameOf?: (id: string) => string | undefined; onOpenUser?: (id: string) => void }) {
  const { data, failed, loading, fetchedAt } = state;
  const [chartW, setChartW] = useState(0);
  // Sunucu saati ile istemci saati farklı olabilir: göreli zamanlar SUNUCU "now" değerine göre hesaplanır.
  const serverNow = data ? Date.parse(data.now) : 0;
  const stamp = fetchedAt ? memberDateTime(new Date(fetchedAt).toISOString()).slice(11) : "";
  const labels = useMemo(() => (data?.days ?? []).map((d) => `${d.day.slice(8, 10)}.${d.day.slice(5, 7)}`), [data]);
  const series = useMemo(() => [
    { label: "Yeni üye", color: SERIES_JOIN, values: (data?.days ?? []).map((d) => d.signups) },
    { label: "Günlük aktif üye", color: SERIES_ACTIVE, values: (data?.days ?? []).map((d) => d.active) }
  ], [data]);
  const yesterday = data && data.days.length > 1 ? data.days[data.days.length - 2] : null;
  const onlineNow = (data?.online ?? []).filter((o) => isMemberOnline(o.last_seen_at, serverNow));
  const recent = (data?.online ?? []).filter((o) => !isMemberOnline(o.last_seen_at, serverNow));

  return (
    <View style={{ gap: 12 }}>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
        <View style={{ alignItems: "center", flexDirection: "row", flexShrink: 1, gap: 8, minWidth: 0 }}>
          <LiveDot tone={failed ? "stale" : data ? "ok" : "off"} />
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Üyeler: canlı durum</Text>
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>
              {failed ? "Son yenileme başarısız — eldeki son veri gösteriliyor." : stamp ? `Son güncelleme ${stamp} · 30 saniyede bir yenilenir` : "Yükleniyor…"}
            </Text>
          </View>
        </View>
        <ActionButton tone="neutral" icon="refresh" label="Yenile" busy={loading} onPress={state.reload} />
      </View>

      {!data ? (
        failed ? <NoData text="Üye özeti yüklenemedi. Bağlantını kontrol edip Yenile'ye bas." /> : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} height={92} width={170} grow />)}
          </View>
        )
      ) : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <KpiTile label="Şu an çevrim içi" value={fmt(data.online_now)} live icon="access-point" sub="son 5 dakikada sinyal veren üye" />
            <KpiTile label="Son 1 saat" value={fmt(data.active_1h)} icon="clock-outline" sub="siteye ya da uygulamaya giren" />
            <KpiTile label="Bugün aktif" value={fmt(data.active_today)} icon="account-clock-outline" sub={yesterday ? `dün ${fmt(yesterday.active)}` : undefined} />
            <KpiTile label="Bugün katılan" value={fmt(data.joined_today)} icon="account-plus-outline" sub={yesterday ? `dün ${fmt(yesterday.signups)}` : undefined} />
            <KpiTile label="Son 7 gün katılan" value={fmt(data.joined_7d)} icon="calendar-week" sub={`son 30 gün ${fmt(data.joined_30d)}`} />
            <KpiTile label="Toplam üye" value={fmt(data.total)} icon="account-group" sub="silinmiş hesaplar hariç" />
          </View>

          <View style={{ alignItems: "stretch", flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <ChartCard title="Şu an içeride" meta={`${onlineNow.length} üye çevrim içi${recent.length ? ` · ${recent.length} üye son 15 dakikada çıktı` : ""} · yalnız giriş yapmış üyeler`} basis={320}>
              {onlineNow.length === 0 && recent.length === 0 ? <NoData text="Şu an içeride giriş yapmış üye yok." /> : (
                <View style={{ gap: 6 }}>
                  {[...onlineNow, ...recent].slice(0, 12).map((o) => {
                    const online = isMemberOnline(o.last_seen_at, serverNow);
                    const name = o.name || nameOf?.(o.id) || "İsimsiz üye";
                    return (
                      <Pressable key={o.id} accessibilityRole={onOpenUser ? "button" : undefined} accessibilityLabel={`${name} — ${online ? "çevrim içi" : memberRelative(o.last_seen_at, serverNow)}`} disabled={!onOpenUser} onPress={() => onOpenUser?.(o.id)}
                        style={{ alignItems: "center", backgroundColor: online ? colors.primarySoft : colors.surfaceAlt, borderRadius: 10, flexDirection: "row", gap: 9, minHeight: 40, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <View style={{ backgroundColor: online ? colors.success : colors.subtle, borderRadius: 999, height: 9, width: 9 }} />
                        <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "800", minWidth: 0 }}>{name}</Text>
                        <MaterialCommunityIcons name={platformIcon(o.platform)} size={15} color={colors.muted} />
                        <Text style={{ color: online ? colors.primaryDark : colors.muted, fontSize: 11.5, fontVariant: ["tabular-nums"], fontWeight: "800" }}>{online ? "çevrim içi" : memberRelative(o.last_seen_at, serverNow)}</Text>
                      </Pressable>
                    );
                  })}
                  {onlineNow.length + recent.length > 12 ? <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>+{onlineNow.length + recent.length - 12} üye daha — aşağıdaki listede "Çevrim içi" süzgecini kullan.</Text> : null}
                </View>
              )}
            </ChartCard>

            <ChartCard title="Son 30 gün: yeni üye ve günlük aktif" meta="Günlük · sunucu verisi · son nokta bugünü içerir (gün bitmedi)" basis={460} grow={2}>
              <View onLayout={(e) => setChartW(Math.round(e.nativeEvent.layout.width))} style={{ width: "100%" }}>
                {series.every((s) => s.values.every((v) => v === 0)) ? <NoData text="Son 30 günde kayıt yok." />
                  : chartW > 0 ? <MultiLineChart labels={labels} series={series} width={chartW} /> : <View style={{ height: 200 }} />}
              </View>
            </ChartCard>

            <ChartCard title="Giriş yöntemi" meta="Üyelerin hesabı nasıl açtığı" basis={260}>
              {data.providers.length === 0 ? <NoData /> : (
                <DonutChart centerTop={fmt(data.providers.reduce((sum, p) => sum + p.count, 0))} centerBottom="üye"
                  data={data.providers.map((p, i) => ({ label: providerLabel(p.provider), value: p.count, color: PROVIDER_COLOR[p.provider] ?? ["#7C5CFC", "#E0A81E", "#6B7280"][i % 3] }))} />
              )}
            </ChartCard>
          </View>
          <View style={{ ...ADMIN_CARD, alignItems: "flex-start", flexDirection: "row", gap: 8, padding: 12 }}>
            <MaterialCommunityIcons name="information-outline" size={17} color={colors.muted} />
            <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 17 }}>
              Çevrim içi sayısı yalnız giriş yapmış üyeleri kapsar; giriş yapmadan gezen ziyaretçiler kimlik tutulmadığı için sayılamaz. Ortam (web / iPhone / Android) bugünden itibaren kaydedilir; daha önce giriş yapmış üyelerde bir sonraki ziyaretlerine kadar boş görünür.
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

/** Tablo hücresi: çevrim içi noktası + göreli son görülme + ortam simgesi. */
export function MemberSeenCell({ info, nowMs }: { info?: MemberInfo; nowMs: number }) {
  if (!info) return <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>—</Text>;
  const online = isMemberOnline(info.last_seen_at, nowMs);
  return (
    <View style={{ gap: 2 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
        <View style={{ backgroundColor: online ? colors.success : colors.line, borderRadius: 999, height: 8, width: 8 }} />
        <Text numberOfLines={1} style={{ color: online ? colors.primaryDark : colors.ink, fontSize: 12, fontWeight: "800" }}>{online ? "Çevrim içi" : memberRelative(info.last_seen_at, nowMs)}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "600" }}>{info.platform ? platformLabel(info.platform) : info.last_seen_at ? memberDateTime(info.last_seen_at) : "hiç giriş yapmadı"}</Text>
    </View>
  );
}

/** Tablo hücresi: üyelik tarihi + saat, altında "kaç gün önce". */
export function MemberJoinedCell({ iso, nowMs }: { iso?: string | null; nowMs: number }) {
  if (!iso) return <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>—</Text>;
  return (
    <View style={{ gap: 2 }}>
      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "800" }}>{memberDateTime(iso)}</Text>
      <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "600" }}>{memberRelative(iso, nowMs)}</Text>
    </View>
  );
}
