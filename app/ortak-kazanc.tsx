import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { WebContainer } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { useIsWideWeb } from "@/lib/layout";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const trMoney = (n: number) => `${new Intl.NumberFormat("tr-TR").format(Math.max(0, Math.round(n)))} ₺`;
const trNum = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: n < 10 ? 1 : 0 }).format(Math.max(0, n));

// Şeffaf huni senaryoları — erişim / tıklama / satış oranları.
const SCENARIOS = {
  temkinli: { label: "Temkinli", reach: 0.2, ctr: 0.02, conv: 0.03 },
  dengeli: { label: "Dengeli", reach: 0.3, ctr: 0.03, conv: 0.04 },
  iyi: { label: "İyi", reach: 0.45, ctr: 0.05, conv: 0.06 }
} as const;
type ScenarioKey = keyof typeof SCENARIOS;

function Stepper({ label, value, setValue, step, min, max, format }: { label: string; value: number; setValue: (n: number) => void; step: number; min: number; max: number; format: (n: number) => string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 8, padding: 14 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} azalt`} onPress={() => setValue(Math.max(min, value - step))} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 38, justifyContent: "center", width: 38 }}>
          <MaterialCommunityIcons name="minus" size={20} color={colors.ink} />
        </Pressable>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{format(value)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} artır`} onPress={() => setValue(Math.min(max, value + step))} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, height: 38, justifyContent: "center", width: 38 }}>
          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

function FunnelRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 30, justifyContent: "center", width: 30 }}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.primaryDark} />
      </View>
      <Text style={{ color: colors.muted, flex: 1, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

export default function EarningsCalculatorPage() {
  const isWideWeb = useIsWideWeb();
  const [followers, setFollowers] = useState(2000);
  const [posts, setPosts] = useState(8);
  const [avgCommission, setAvgCommission] = useState(150);
  const [scenario, setScenario] = useState<ScenarioKey>("dengeli");

  const calc = useMemo(() => {
    const s = SCENARIOS[scenario];
    const reach = followers * posts * s.reach;
    const clicks = reach * s.ctr;
    const sales = clicks * s.conv;
    const monthly = sales * avgCommission;
    return { reach, clicks, sales, monthly, yearly: monthly * 12 };
  }, [followers, posts, avgCommission, scenario]);

  const title = "Ortak Kazanç Hesaplayıcı — Sosyal medyadan ne kadar kazanırsın? | OrtakSat";
  const desc = "OrtakSat ortak kazanç hesaplayıcı: takipçi sayını, aylık paylaşımını ve komisyonu gir, sıfır sermaye ile aylık tahmini kazancını gör. Stok yok, para yatırma yok — link paylaş, satışta komisyon kazan.";
  const url = "https://ortaksat.com/ortak-kazanc";

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 24 }} style={{ backgroundColor: colors.background }}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={url} />
      </Head>

      <WebContainer max={1080} padding={16} style={{ gap: 18, paddingTop: 18 }}>
        {/* Hero */}
        <View style={{ gap: 8 }}>
          <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}>
            <MaterialCommunityIcons name="cash-multiple" size={15} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>Sıfır sermaye · stok yok · para yatırma yok</Text>
          </View>
          <Text style={{ color: colors.ink, fontSize: isWideWeb ? 30 : 25, fontWeight: "900", lineHeight: isWideWeb ? 36 : 30 }}>Sosyal medyadan ayda ne kadar kazanabilirsin?</Text>
          <Text style={{ color: colors.muted, fontSize: 14.5, fontWeight: "600", lineHeight: 22, maxWidth: 640 }}>
            OrtakSat'ta ürün seçip referans linkini paylaşırsın; o linkten satış olursa komisyon senin. Aşağıdan tahmini kazancını hesapla.
          </Text>
        </View>

        <View style={{ flexDirection: isWideWeb ? "row" : "column", gap: 16 }}>
          {/* Girdiler */}
          <View style={{ flex: 1, gap: 12, minWidth: 0 }}>
            <Stepper label="Takipçi / kitle sayın" value={followers} setValue={setFollowers} step={500} min={100} max={1000000} format={(n) => new Intl.NumberFormat("tr-TR").format(n)} />
            <Stepper label="Aylık paylaşım (kaç ürün/link)" value={posts} setValue={setPosts} step={1} min={1} max={120} format={(n) => `${n}`} />
            <Stepper label="Ortalama komisyon (satış başına)" value={avgCommission} setValue={setAvgCommission} step={50} min={20} max={100000} format={trMoney} />
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 8, padding: 14 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Senaryo</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => {
                  const on = scenario === k;
                  return (
                    <Pressable key={k} onPress={() => setScenario(k)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surfaceAlt, borderRadius: 999, flex: 1, paddingVertical: 9 }}>
                      <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{SCENARIOS[k].label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Sonuç */}
          <View style={{ flex: 1, gap: 12, minWidth: 0 }}>
            <View style={{ backgroundColor: colors.primaryDark, borderRadius: 18, gap: 6, padding: 22 }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700" }}>Tahmini aylık kazanç</Text>
              <Text style={{ color: "#FFFFFF", fontSize: 38, fontWeight: "900" }}>{trMoney(calc.monthly)}</Text>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700" }}>Yıllık ≈ {trMoney(calc.yearly)}</Text>
            </View>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
              <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "800", textTransform: "uppercase" }}>Aylık huni</Text>
              <FunnelRow icon="eye-outline" label="Toplam erişim" value={trNum(calc.reach)} />
              <FunnelRow icon="cursor-default-click-outline" label="Link tıklaması" value={trNum(calc.clicks)} />
              <FunnelRow icon="cart-check" label="Satış" value={trNum(calc.sales)} />
              <View style={{ backgroundColor: colors.line, height: 1 }} />
              <FunnelRow icon="cash" label="Kazanç" value={trMoney(calc.monthly)} />
            </View>
            <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600", lineHeight: 17 }}>
              Bu bir tahmindir; gerçek kazanç kitlene, ürüne, paylaşım kalitene ve komisyona göre değişir. OrtakSat kazanç garantisi vermez, ödeme tutmaz — komisyonu satıcı doğrudan sana öder.
            </Text>
          </View>
        </View>

        {/* Neden ortak olmalısın */}
        <View style={{ gap: 12, marginTop: 4 }}>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>Neden OrtakSat ortağı olmalısın?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {([
              { icon: "wallet-outline", t: "Sıfır sermaye", b: "Ürün almazsın, para yatırmazsın. Sadece link paylaşırsın." },
              { icon: "package-variant-closed-remove", t: "Stok & kargo yok", b: "Depo, paketleme, gönderi yok. Teslimatı satıcı yapar." },
              { icon: "clock-fast", t: "5 dakikada başla", b: "Ürünü seç, linkini al, paylaş. Bugün başlarsın." },
              { icon: "chart-line", t: "Ölçülebilir kazanç", b: "Tıklama ve satışların panelinde şeffaf görünür." }
            ] as const).map((c) => (
              <View key={c.t} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 240, flexGrow: 1, gap: 6, padding: 16 }}>
                <MaterialCommunityIcons name={c.icon} size={22} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>{c.t}</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{c.b}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={{ alignItems: isWideWeb ? "center" : "stretch", backgroundColor: colors.primarySoft, borderRadius: 18, flexDirection: isWideWeb ? "row" : "column", gap: 16, padding: 22 }}>
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "900" }}>Kazanmaya bugün başla</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>Ücretsiz kayıt ol, ürün seç, linkini paylaş.</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Link href="/partner" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 13 }}>
                <MaterialCommunityIcons name="handshake-outline" size={18} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 14.5, fontWeight: "900" }}>Ortak Ol</Text>
              </Pressable>
            </Link>
            <Link href="/nasil-calisir" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderColor: colors.primary, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 13 }}>
                <MaterialCommunityIcons name="information-outline" size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 14.5, fontWeight: "900" }}>Nasıl Çalışır</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </WebContainer>
      <WebFooter />
    </ScrollView>
  );
}
