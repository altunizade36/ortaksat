import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { supabase } from "@/lib/supabase";

type DayPoint = { day: string; active: number; signups: number };
type Analytics = {
  total_users: number;
  confirmed_users: number;
  live_now: number;
  active_today: number;
  new_today: number;
  new_7d: number;
  days: DayPoint[];
};

/**
 * Admin: Canlı Kullanıcı Aktivitesi. GERÇEK veriyle (admin_live_analytics RPC).
 * "Şu an aktif" (son 5 dk presence), "bugün aktif", "toplam kayıtlı" + 7 günlük
 * günlük-aktif / yeni-kayıt grafiği. Canlı sayaç 15 sn'de bir tazelenir.
 */
export function AdminActivity() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!supabase) { setError("Canlı bağlantı yok (önizleme modu)."); setLoading(false); return; }
    try {
      const { data: res, error: err } = await supabase.rpc("admin_live_analytics");
      if (err) throw err;
      setData(res as Analytics);
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
    timer.current = setInterval(() => void load(), 15_000);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxBar = useMemo(() => Math.max(1, ...(data?.days ?? []).flatMap((d) => [d.active, d.signups])), [data]);

  if (loading && !data) {
    return <View style={{ padding: 24 }}><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Canlı aktivite yükleniyor…</Text></View>;
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

  const cards: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; sub: string; tint: string; color: string; live?: boolean }> = [
    { icon: "access-point", label: "Şu an aktif", value: String(data.live_now), sub: "Son 5 dakikada", tint: colors.successSoft, color: colors.success, live: true },
    { icon: "account-clock-outline", label: "Bugün aktif", value: String(data.active_today), sub: "Günlük aktif kullanıcı", tint: colors.primarySoft, color: colors.primaryDark },
    { icon: "account-group", label: "Toplam kayıtlı", value: String(data.total_users), sub: `${data.confirmed_users} doğrulanmış`, tint: colors.infoSoft, color: colors.info },
    { icon: "account-plus-outline", label: "Bu hafta yeni", value: String(data.new_7d), sub: `Bugün +${data.new_today}`, tint: colors.violetSoft, color: colors.violet }
  ];

  const dayLabel = (iso: string) => {
    const dd = new Date(iso + "T00:00:00");
    const names = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
    return names[dd.getDay()];
  };

  const allZero = data.days.every((d) => d.active === 0 && d.signups === 0) && data.live_now === 0;

  return (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <View style={{ backgroundColor: colors.success, borderRadius: 999, height: 9, width: 9 }} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900" }}>Canlı Kullanıcı Aktivitesi</Text>
        <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>{updatedAt ? `Güncellendi ${updatedAt}` : ""}</Text>
      </View>

      {/* Stat kartları */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {cards.map((c) => (
          <View key={c.label} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 180, flexGrow: 1, gap: 8, minWidth: 150, padding: 16 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <View style={{ alignItems: "center", backgroundColor: c.tint, borderRadius: 10, height: 34, justifyContent: "center", width: 34 }}>
                <MaterialCommunityIcons name={c.icon} size={18} color={c.color} />
              </View>
              {c.live ? (
                <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <View style={{ backgroundColor: colors.success, borderRadius: 999, height: 7, width: 7 }} />
                  <Text style={{ color: colors.success, fontSize: 10, fontWeight: "900" }}>CANLI</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: colors.ink, fontSize: 28, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{c.value}</Text>
            <View style={{ gap: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{c.label}</Text>
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{c.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 7 günlük grafik */}
      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 18 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
          <Text style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" }}>Son 7 gün</Text>
          <LegendDot color={colors.primary} label="Aktif kullanıcı" />
          <LegendDot color={colors.violet} label="Yeni kayıt" />
        </View>
        <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10, height: 150 }}>
          {data.days.map((d) => (
            <View key={d.day} style={{ alignItems: "center", flex: 1, gap: 6, justifyContent: "flex-end" }}>
              <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 3, height: 110, justifyContent: "center" }}>
                <Bar value={d.active} max={maxBar} color={colors.primary} />
                <Bar value={d.signups} max={maxBar} color={colors.violet} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "800" }}>{dayLabel(d.day)}</Text>
            </View>
          ))}
        </View>
      </View>

      {allZero ? (
        <View style={{ backgroundColor: colors.infoSoft, borderRadius: 12, gap: 4, padding: 14 }}>
          <Text style={{ color: colors.info, fontSize: 13, fontWeight: "900" }}>Henüz canlı aktivite yok</Text>
          <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>
            Bu alan GERÇEK verilerle çalışır (sahte sayaç yok). Kullanıcılar siteye girip gezdikçe "şu an aktif", "günlük" ve "haftalık" değerler burada canlanır. Sayfa 15 saniyede bir kendini tazeler.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const h = Math.max(value > 0 ? 6 : 2, Math.round((value / max) * 110));
  return (
    <View style={{ alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
      {value > 0 ? <Text style={{ color: colors.muted, fontSize: 9.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{value}</Text> : null}
      <View style={{ backgroundColor: value > 0 ? color : colors.line, borderTopLeftRadius: 4, borderTopRightRadius: 4, height: h, width: 13 }} />
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
