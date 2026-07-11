import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Polyline, Stop, Text as SvgText } from "react-native-svg";

import { colors } from "@/components/colors";

// Profesyonel grafik kiti (react-native-svg, web+native). dataviz ilkeleri: kategorik SABİT renk sırası,
// ince mark, recessive eksen/grid, legend ≥2 seri, tabular-nums metin ink-token'da (seri rengi değil).

// Kategorik palet — SABİT sıra (asla döngüsel değil). Marka-hizalı, birbirinden ayrık.
export const CAT = ["#0F9D66", "#7C5CFC", "#E0A81E", "#2C82F6", "#E4572E", "#17B3B3", "#D6409F", "#6B7280"];

export const money = (n: number) => (n >= 1_000_000 ? `₺${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `₺${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}B` : `₺${Math.round(n)}`);
const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${(n / 1000).toFixed(0)}B` : new Intl.NumberFormat("tr-TR").format(Math.round(n)));

// ---- Renkli KPI kutusu: değer + delta (+/-) + ikon (referans dashboard tarzı) ----
export function KpiDeltaTile({ label, value, delta, icon, tint, accent, money: isMoney, sub, live }: { label: string; value: number | string; delta?: number; icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; accent: string; money?: boolean; sub?: string; live?: boolean }) {
  const v = typeof value === "number" ? (isMoney ? money(value) : fmt(value)) : value;
  const up = (delta ?? 0) >= 0;
  return (
    <View style={{ backgroundColor: tint, borderRadius: 16, flexBasis: 158, flexGrow: 1, gap: 9, minWidth: 146, overflow: "hidden", padding: 15, shadowColor: "#0B3A44", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 10, height: 34, justifyContent: "center", width: 34 }}>
          <MaterialCommunityIcons name={icon} size={18} color="#FFFFFF" />
        </View>
        {live ? (
          <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 6, width: 6 }} />
            <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>CANLI</Text>
          </View>
        ) : delta !== undefined ? (
          <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 999, flexDirection: "row", gap: 2, paddingHorizontal: 7, paddingVertical: 2 }}>
            <MaterialCommunityIcons name={up ? "arrow-up" : "arrow-down"} size={12} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{up ? "+" : ""}{delta}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ color: "#FFFFFF", fontSize: 25, fontVariant: ["tabular-nums"], fontWeight: "900", letterSpacing: -0.6 }}>{v}</Text>
      <View style={{ gap: 1 }}>
        <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>{label}</Text>
        {sub ? <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.82)", fontSize: 11, fontWeight: "700" }}>{sub}</Text> : null}
      </View>
      <View style={{ backgroundColor: accent, borderRadius: 999, bottom: 0, height: 4, left: 0, position: "absolute", right: 0 }} />
    </View>
  );
}

// ---- Çok-segmentli DONUT (referans: satış tipi / ödeme modu) ----
function polar(cx: number, cy: number, r: number, a: number) { const rad = ((a - 90) * Math.PI) / 180; return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }; }
function arc(cx: number, cy: number, rO: number, rI: number, a0: number, a1: number) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const oS = polar(cx, cy, rO, a1), oE = polar(cx, cy, rO, a0), iS = polar(cx, cy, rI, a0), iE = polar(cx, cy, rI, a1);
  return `M ${oS.x} ${oS.y} A ${rO} ${rO} 0 ${large} 0 ${oE.x} ${oE.y} L ${iS.x} ${iS.y} A ${rI} ${rI} 0 ${large} 1 ${iE.x} ${iE.y} Z`;
}
export function DonutChart({ data, size = 168, centerTop, centerBottom }: { data: Array<{ label: string; value: number; color?: string }>; size?: number; centerTop?: string; centerBottom?: string }) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const rO = size / 2, rI = size * 0.31, cx = size / 2, cy = size / 2;
  let acc = 0;
  const segs = total > 0 ? data.map((d, i) => { const frac = Math.max(0, d.value) / total; const a0 = acc * 360; acc += frac; const a1 = acc * 360; return { d, i, a0, a1: Math.min(a1, 359.999), frac }; }) : [];
  return (
    <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
      <View style={{ height: size, width: size }}>
        <Svg width={size} height={size}>
          {total === 0 ? <Circle cx={cx} cy={cy} r={(rO + rI) / 2} stroke={colors.line} strokeWidth={rO - rI} fill="none" /> : null}
          {segs.map((s) => <Path key={s.i} d={arc(cx, cy, rO - 1, rI, s.a0, s.a1)} fill={s.d.color ?? CAT[s.i % CAT.length]} />)}
          <Circle cx={cx} cy={cy} r={rI} fill={colors.surface} />
        </Svg>
        <View style={{ alignItems: "center", bottom: 0, justifyContent: "center", left: 0, position: "absolute", right: 0, top: 0 }}>
          {centerTop ? <Text style={{ color: colors.ink, fontSize: 20, fontVariant: ["tabular-nums"], fontWeight: "900", letterSpacing: -0.5 }}>{centerTop}</Text> : null}
          {centerBottom ? <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{centerBottom}</Text> : null}
        </View>
      </View>
      <View style={{ gap: 7, minWidth: 120 }}>
        {data.map((d, i) => (
          <View key={d.label} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <View style={{ backgroundColor: d.color ?? CAT[i % CAT.length], borderRadius: 4, height: 11, width: 11 }} />
            <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{d.label}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{total > 0 ? Math.round((Math.max(0, d.value) / total) * 100) : 0}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---- Y-eksenli, gridli, çok-serili GRUPLU BAR (referans: CPA/CPC per campaign) ----
export function GroupedBarChart({ groups, series, height = 200, valueFmt }: { groups: Array<{ label: string; values: number[] }>; series: Array<{ label: string; color: string }>; height?: number; valueFmt?: (n: number) => string }) {
  const max = Math.max(1, ...groups.flatMap((g) => g.values));
  const nice = niceMax(max);
  const plotH = height - 34, plotTop = 6;
  const ticks = 4;
  return (
    <View style={{ gap: 10 }}>
      {series.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {series.map((s) => <Legend key={s.label} color={s.color} label={s.label} />)}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 6, height }}>
        {/* Y eksen etiketleri */}
        <View style={{ height: plotH + plotTop, justifyContent: "space-between", width: 34 }}>
          {Array.from({ length: ticks + 1 }).map((_, i) => (
            <Text key={i} style={{ color: colors.subtle, fontSize: 8.5, fontVariant: ["tabular-nums"], fontWeight: "700", textAlign: "right" }}>{(valueFmt ?? fmt)((nice * (ticks - i)) / ticks)}</Text>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {/* Grid çizgileri */}
          <View style={{ height: plotH, marginTop: plotTop, position: "relative" }}>
            {Array.from({ length: ticks + 1 }).map((_, i) => (
              <View key={i} style={{ backgroundColor: colors.line, height: 1, left: 0, opacity: i === ticks ? 1 : 0.5, position: "absolute", right: 0, top: (plotH * i) / ticks }} />
            ))}
            {/* Barlar */}
            <View style={{ alignItems: "flex-end", bottom: 0, flexDirection: "row", justifyContent: "space-around", left: 0, position: "absolute", right: 0, top: 0 }}>
              {groups.map((g, gi) => (
                <View key={gi} style={{ alignItems: "flex-end", flex: 1, flexDirection: "row", gap: 2, height: "100%", justifyContent: "center" }}>
                  {g.values.map((v, si) => (
                    <View key={si} style={{ alignItems: "center", justifyContent: "flex-end" }}>
                      <View style={{ backgroundColor: series[si]?.color ?? CAT[si % CAT.length], borderTopLeftRadius: 4, borderTopRightRadius: 4, height: Math.max(v > 0 ? 3 : 0, (v / nice) * plotH), width: series.length > 2 ? 9 : 14 }} />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
          {/* X etiketleri */}
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 6 }}>
            {groups.map((g, gi) => <Text key={gi} numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 9.5, fontWeight: "800", textAlign: "center" }}>{g.label}</Text>)}
          </View>
        </View>
      </View>
    </View>
  );
}

// ---- ÇİZGİ + ALAN grafiği (referans: lead generation / visits per month) ----
export function LineAreaChart({ points, color = CAT[0], height = 190, width = 560, valueFmt }: { points: Array<{ label: string; value: number }>; color?: string; height?: number; width?: number; valueFmt?: (n: number) => string }) {
  const max = niceMax(Math.max(1, ...points.map((p) => p.value)));
  const padL = 38, padB = 22, padT = 8, padR = 8;
  const plotW = width - padL - padR, plotH = height - padB - padT;
  const n = points.length;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const area = `${padL},${padT + plotH} ${line} ${x(n - 1)},${padT + plotH}`;
  const ticks = 4;
  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const gy = padT + (plotH * i) / ticks;
          return (
            <G key={i}>
              <Line x1={padL} y1={gy} x2={width - padR} y2={gy} stroke={colors.line} strokeWidth={1} opacity={i === ticks ? 1 : 0.5} />
              <SvgText x={padL - 6} y={gy + 3} fontSize={8.5} fontWeight="700" fill={colors.subtle} textAnchor="end">{(valueFmt ?? fmt)((max * (ticks - i)) / ticks)}</SvgText>
            </G>
          );
        })}
        {n > 1 ? <Polyline points={area} fill="url(#areaGrad)" stroke="none" /> : null}
        <Polyline points={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <Circle key={i} cx={x(i)} cy={y(p.value)} r={n > 20 ? 0 : 3} fill={colors.surface} stroke={color} strokeWidth={2} />)}
        {points.map((p, i) => (n <= 14 || i % Math.ceil(n / 10) === 0) ? <SvgText key={`l${i}`} x={x(i)} y={height - 6} fontSize={8.5} fontWeight="800" fill={colors.muted} textAnchor="middle">{p.label}</SvgText> : null)}
      </Svg>
    </View>
  );
}

// ---- TREEMAP (referans: kategori dağılımı — flex-tabanlı, renkli dikdörtgenler) ----
export function Treemap({ data, height = 180 }: { data: Array<{ label: string; value: number; color?: string }>; height?: number }) {
  // Basit satır-tabanlı squarify: değerlere göre ağırlıklı 2 satır.
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 6);
  const half = Math.ceil(sorted.length / 2);
  const rows = [sorted.slice(0, half), sorted.slice(half)];
  return (
    <View style={{ gap: 4, height }}>
      {rows.map((row, ri) => {
        const rowTotal = row.reduce((s, d) => s + Math.max(1, d.value), 0) || 1;
        return (
          <View key={ri} style={{ flex: 1, flexDirection: "row", gap: 4 }}>
            {row.map((d, i) => (
              <View key={d.label} style={{ backgroundColor: d.color ?? CAT[(ri * half + i) % CAT.length], borderRadius: 10, flex: Math.max(0.4, Math.max(1, d.value) / rowTotal), justifyContent: "space-between", overflow: "hidden", padding: 10 }}>
                <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900" }}>{d.label}</Text>
                <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{fmt(d.value)}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ---- Yatay bar (ranked). rank: sıra numarası göster; valueFmt: değer biçimi (ör. para) ----
export function HBarChart({ data, valueFmt, rank }: { data: Array<{ label: string; value: number; color?: string }>; valueFmt?: (n: number) => string; rank?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const vf = valueFmt ?? fmt;
  return (
    <View style={{ gap: 9 }}>
      {data.map((d, i) => (
        <View key={`${d.label}-${i}`} style={{ gap: 4 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
            {rank ? <Text style={{ color: colors.subtle, fontSize: 10.5, fontVariant: ["tabular-nums"], fontWeight: "900", width: 14 }}>{i + 1}</Text> : null}
            <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{d.label}</Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{vf(d.value)}</Text>
          </View>
          <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 9, marginLeft: rank ? 21 : 0, overflow: "hidden" }}>
            <View style={{ backgroundColor: d.color ?? CAT[i % CAT.length], borderRadius: 999, height: 9, width: `${Math.max(3, Math.round((d.value / max) * 100))}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---- Kendini ölçen (responsive) çizgi+alan sarmalayıcı — width'i onLayout'tan alır ----
export function ResponsiveLineArea(props: { points: Array<{ label: string; value: number }>; color?: string; height?: number; valueFmt?: (n: number) => string }) {
  const [w, setW] = useState(0);
  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ width: "100%" }}>
      {w > 0 ? <LineAreaChart {...props} width={w} /> : <View style={{ height: props.height ?? 190 }} />}
    </View>
  );
}

// ---- HUNİ (ortak-satış hunisi): daralan yatay barlar + adım-adım dönüşüm % ----
export function FunnelChart({ data }: { data: Array<{ label: string; value: number; color?: string }> }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ gap: 11 }}>
      {data.map((d, i) => {
        const w = Math.max(8, Math.round((d.value / max) * 100));
        const prev = i === 0 ? d.value : data[i - 1].value;
        const rate = prev ? Math.round((d.value / prev) * 100) : 100;
        const color = d.color ?? CAT[i % CAT.length];
        return (
          <View key={`${d.label}-${i}`} style={{ gap: 5 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 7, minWidth: 0 }}>
                <View style={{ backgroundColor: color, borderRadius: 3, height: 10, width: 10 }} />
                <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{d.label}</Text>
              </View>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                {i > 0 ? (
                  <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}>
                    <Text style={{ color: colors.muted, fontSize: 10.5, fontVariant: ["tabular-nums"], fontWeight: "800" }}>%{rate}</Text>
                  </View>
                ) : null}
                <Text style={{ color: colors.ink, fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{fmt(d.value)}</Text>
              </View>
            </View>
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 7, height: 14, overflow: "hidden" }}>
              <View style={{ backgroundColor: color, borderRadius: 7, height: "100%", width: `${w}%` }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
      <View style={{ backgroundColor: color, borderRadius: 3, height: 10, width: 10 }} />
      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}
