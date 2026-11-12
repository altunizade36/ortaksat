import { MaterialCommunityIcons } from "@/components/icons";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Platform, Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";

/**
 * Admin paneli ortak UI kiti — tek kart/kutu/tablo dili (mobil-öncelikli).
 * Dokunma hedefleri dar ekranda ≥40px; geniş masaüstünde daha sıkı (34px).
 * Sayılar HER ZAMAN çağıranın verdiği gerçek değerdir; bu dosya veri ÜRETMEZ.
 */

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Geniş masaüstü mü? (admin kökünde bir kez sağlanır; her butonda ayrı ölçüm yapılmaz) */
export const AdminWideCtx = createContext<boolean>(false);

export const ADMIN_CARD = {
  backgroundColor: colors.surface,
  borderColor: colors.line,
  borderRadius: 16,
  borderWidth: 1,
  shadowColor: colors.primaryDark,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 12
} as const;

/** Web'de iOS odak-yakınlaştırmasını önlemek için giriş alanı yazı boyutu 16. */
export const ADMIN_INPUT = {
  backgroundColor: colors.surfaceAlt,
  borderColor: colors.line,
  borderRadius: 10,
  borderWidth: 1,
  color: colors.ink,
  fontSize: 16,
  minHeight: 44,
  paddingHorizontal: 12
} as const;

export type ActionTone = "primary" | "neutral" | "danger" | "success" | "warning" | "soft";

const TONES: Record<ActionTone, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: "#FFFFFF", border: colors.primary },
  soft: { bg: colors.primarySoft, fg: colors.primaryDark, border: colors.primarySoft },
  neutral: { bg: colors.surface, fg: colors.ink, border: colors.line },
  danger: { bg: colors.accentSoft, fg: colors.accent, border: colors.accentSoft },
  success: { bg: colors.successSoft, fg: "#15803D", border: colors.successSoft },
  warning: { bg: colors.goldSoft, fg: colors.goldInk, border: colors.goldSoft }
};

/** Yönetim aksiyonu butonu: ≥40px (dar), meşgulken kilitli (çift gönderim yok). */
export function ActionButton({ label, icon, tone = "neutral", onPress, busy, disabled, accessibilityLabel }: { label: string; icon?: IconName; tone?: ActionTone; onPress: () => void; busy?: boolean; disabled?: boolean; accessibilityLabel?: string }) {
  const wide = useContext(AdminWideCtx);
  const t = TONES[tone];
  const off = !!busy || !!disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", backgroundColor: t.bg, borderColor: t.border, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: wide ? 34 : 40, opacity: off ? 0.5 : pressed ? 0.8 : 1, paddingHorizontal: wide ? 11 : 13 })}
    >
      {icon ? <MaterialCommunityIcons name={busy ? "timer-sand" : icon} size={15} color={t.fg} /> : null}
      <Text numberOfLines={1} style={{ color: t.fg, fontSize: 12.5, fontWeight: "800" }}>{busy ? "İşleniyor…" : label}</Text>
    </Pressable>
  );
}

/** İstemci sayfalama: liste + sayfa boyutu → o sayfanın dilimi. resetKey değişince 1. sayfaya döner. */
export function usePager<T>(items: T[], pageSize: number, resetKey: string) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [resetKey]);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const safe = Math.min(page, pages - 1);
  const slice = useMemo(() => items.slice(safe * pageSize, safe * pageSize + pageSize), [items, safe, pageSize]);
  return { page: safe, pages, slice, setPage, total: items.length, from: items.length ? safe * pageSize + 1 : 0, to: Math.min(items.length, (safe + 1) * pageSize) };
}

export function Pager({ page, pages, total, from, to, setPage }: { page: number; pages: number; total: number; from: number; to: number; setPage: (p: number) => void }) {
  if (total === 0 || pages <= 1) {
    return total > 0 ? <Text style={{ color: colors.subtle, fontSize: 11.5, fontVariant: ["tabular-nums"], fontWeight: "700", paddingTop: 10 }}>{total} kayıt</Text> : null;
  }
  const btn = (dir: -1 | 1) => {
    const off = dir === -1 ? page <= 0 : page >= pages - 1;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dir === -1 ? "Önceki sayfa" : "Sonraki sayfa"}
        disabled={off}
        onPress={() => setPage(page + dir)}
        style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 4, height: 40, justifyContent: "center", opacity: off ? 0.4 : 1, paddingHorizontal: 12 }}
      >
        {dir === -1 ? <MaterialCommunityIcons name="chevron-left" size={18} color={colors.ink} /> : null}
        <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{dir === -1 ? "Önceki" : "Sonraki"}</Text>
        {dir === 1 ? <MaterialCommunityIcons name="chevron-right" size={18} color={colors.ink} /> : null}
      </Pressable>
    );
  };
  return (
    <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between", paddingTop: 12 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "700" }}>{from}–{to} / {total} · sayfa {page + 1}/{pages}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>{btn(-1)}{btn(1)}</View>
    </View>
  );
}

/** Nabız atan canlı göstergesi. tone: ok=yeşil (canlı), stale=altın (son yenileme başarısız), off=gri (duraklatıldı). */
export function LiveDot({ tone = "ok", size = 9 }: { tone?: "ok" | "stale" | "off"; size?: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (tone !== "ok") { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.3, duration: 900, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== "web" })
    ]));
    loop.start();
    return () => loop.stop();
  }, [tone, pulse]);
  const bg = tone === "ok" ? colors.success : tone === "stale" ? colors.gold : colors.subtle;
  return <Animated.View style={{ backgroundColor: bg, borderRadius: 999, height: size, opacity: pulse, width: size }} />;
}

/** Yükleme iskeleti bloğu (nabız). Sayı uydurmaz — yalnız yer tutar. */
export function SkeletonBlock({ height, width, radius = 12, grow }: { height: number; width?: number | `${number}%`; radius?: number; grow?: boolean }) {
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: Platform.OS !== "web" })
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={{ backgroundColor: colors.line, borderRadius: radius, flexBasis: grow ? 140 : undefined, flexGrow: grow ? 1 : undefined, height, minWidth: grow ? 132 : undefined, opacity: pulse, width }} />;
}

export function RangeSwitch<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ key: T; label: string }> }) {
  return (
    <View accessibilityRole="tablist" style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", padding: 3 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={String(o.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : "transparent", borderRadius: 8, justifyContent: "center", minHeight: 34, minWidth: 48, paddingHorizontal: 10 }}>
            <Text style={{ color: on ? "#FFFFFF" : colors.muted, fontSize: 12, fontWeight: "800" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type Delta = { dir: "up" | "down" | "flat"; text: string };

/** Dönem karşılaştırması (gerçek iki değerden). Önceki dönem 0 ise yüzde UYDURULMAZ — mutlak fark gösterilir. */
export function deltaOf(current: number, previous: number): Delta {
  const c = Number.isFinite(current) ? current : 0;
  const p = Number.isFinite(previous) ? previous : 0;
  if (c === p) return { dir: "flat", text: "0" };
  if (p === 0) return { dir: "up", text: `+${new Intl.NumberFormat("tr-TR").format(Math.round(c))}` };
  const pct = Math.round(((c - p) / p) * 100);
  if (pct === 0) return { dir: "flat", text: "≈%0" };
  return { dir: pct > 0 ? "up" : "down", text: `${pct > 0 ? "+" : "−"}%${Math.abs(pct)}` };
}

/**
 * KPI kutusu — beyaz kart, marka mavisi ikon çipi, değer + etiket + (varsa) dönem farkı.
 * value null ise "—" + "veri yok" gösterir (sayı uydurulmaz).
 * goodWhenDown: şikayet/bekleyen iş gibi "azalması iyi" metriklerde renk ters çevrilir.
 */
export function KpiTile({ label, value, sub, icon, delta, deltaLabel, tone = "brand", onPress, live, goodWhenDown }: { label: string; value: string | null; sub?: string; icon: IconName; delta?: Delta; deltaLabel?: string; tone?: "brand" | "danger" | "warning" | "success"; onPress?: () => void; live?: boolean; goodWhenDown?: boolean }) {
  const chip = tone === "danger" ? { bg: colors.accentSoft, fg: colors.accent } : tone === "warning" ? { bg: colors.goldSoft, fg: colors.goldInk } : tone === "success" ? { bg: colors.successSoft, fg: "#15803D" } : { bg: colors.primarySoft, fg: colors.primary };
  const good = delta ? (delta.dir === "flat" ? null : (delta.dir === "up") !== !!goodWhenDown) : null;
  const dFg = good == null ? colors.muted : good ? "#15803D" : colors.accent;
  const dBg = good == null ? colors.surfaceAlt : good ? colors.successSoft : colors.accentSoft;
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label}: ${value ?? "veri yok"}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({ ...ADMIN_CARD, borderColor: pressed && onPress ? colors.primary : colors.line, flexBasis: 140, flexGrow: 1, flexShrink: 1, gap: 8, maxWidth: 360, minWidth: 132, padding: 14 })}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
        <View style={{ alignItems: "center", backgroundColor: chip.bg, borderRadius: 10, height: 34, justifyContent: "center", width: 34 }}>
          <MaterialCommunityIcons name={icon} size={18} color={chip.fg} />
        </View>
        {live ? (
          <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 8, paddingVertical: 3 }}>
            <LiveDot size={6} />
            <Text style={{ color: "#15803D", fontSize: 10, fontWeight: "900" }}>CANLI</Text>
          </View>
        ) : delta ? (
          <View style={{ alignItems: "center", backgroundColor: dBg, borderRadius: 999, flexDirection: "row", gap: 2, paddingHorizontal: 7, paddingVertical: 3 }}>
            <MaterialCommunityIcons name={delta.dir === "up" ? "arrow-up" : delta.dir === "down" ? "arrow-down" : "minus"} size={12} color={dFg} />
            <Text style={{ color: dFg, fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{delta.text}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={{ color: value == null ? colors.subtle : colors.ink, fontSize: 24, fontVariant: ["tabular-nums"], fontWeight: "900", letterSpacing: -0.5 }}>{value ?? "—"}</Text>
      <View style={{ gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{value == null ? "veri yok" : delta && deltaLabel ? deltaLabel : sub ?? " "}</Text>
        {value != null && delta && deltaLabel && sub ? <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * Grafik kartı: başlık + (opsiyonel) sağ kontrol + içerik.
 * basis verilirse kart bir SATIR-SARMA (row-wrap) kabında yan yana dizilir.
 * basis verilmezse blok karttır — sütun kabında flexBasis YÜKSEKLİK olacağı için hiç uygulanmaz.
 */
export function ChartCard({ title, meta, right, children, basis, grow = 1 }: { title: string; meta?: string; right?: ReactNode; children: ReactNode; basis?: number; grow?: number }) {
  return (
    <View style={{ ...ADMIN_CARD, ...(basis != null ? { flexBasis: basis, flexGrow: grow, flexShrink: 1 } : null), gap: 12, maxWidth: "100%", minWidth: 0, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
        <View style={{ flexShrink: 1, gap: 2, minWidth: 0 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{title}</Text>
          {meta ? <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{meta}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Grafik içi dürüst boş durum. */
export function NoData({ text = "Veri yok" }: { text?: string }) {
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 12, gap: 6, justifyContent: "center", minHeight: 96, padding: 14 }}>
      <MaterialCommunityIcons name="chart-box-outline" size={20} color={colors.subtle} />
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700", textAlign: "center" }}>{text}</Text>
    </View>
  );
}

/**
 * Tarih listesinden zaman serisi (istemcide YÜKLÜ kayıtlardan). days≤31 → günlük,
 * daha uzunu → haftalık kovalar. Geçersiz/eksik tarihler sayılmaz (uydurulmaz).
 */
export function bucketDates(dates: Array<string | undefined>, days: number): { labels: string[]; values: number[]; counted: number } {
  const DAY = 86_400_000;
  const step = days <= 31 ? 1 : 7;
  const n = Math.ceil(days / step);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const endMs = end.getTime();
  const values = new Array(n).fill(0) as number[];
  const labels: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(endMs - (n - 1 - i) * step * DAY);
    labels.push(`${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  let counted = 0;
  for (const s of dates) {
    if (!s) continue;
    const t = new Date(s).getTime();
    if (Number.isNaN(t) || t > endMs) continue;
    const back = Math.floor((endMs - t) / (step * DAY));
    if (back < 0 || back >= n) continue;
    values[n - 1 - back] += 1;
    counted += 1;
  }
  return { labels, values, counted };
}
