import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { fetchFunnelSummary, type FunnelSummary } from "@/lib/funnel";
import { displayListingTitle } from "@/lib/listing-title";

const SOURCE_LABELS: Record<string, string> = { direct: "Doğrudan", internal: "Site içi", search: "Arama motoru", social: "Sosyal medya", other: "Başka site", app: "Uygulama" };
const PLATFORM_LABELS: Record<string, string> = { web: "masaüstü", mweb: "mobil tarayıcı", ios: "iPhone", android: "Android" };

/**
 * Yönetim paneli — İLAN HUNİSİ: ilan sayfası görüntülemesi → iletişim/ortaklık/teklif düğmesine basma → giriş
 * ekranına takılma. Yalnız toplam sayılar (kişi verisi yok). Veri 2026-11-14'ten itibaren birikir; öncesi yoktur.
 */
export function ListingFunnelPanel() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<FunnelSummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let alive = true;
    setState("loading");
    void fetchFunnelSummary(days).then((summary) => { if (!alive) return; setData(summary); setState(summary ? "ready" : "error"); });
    return () => { alive = false; };
  }, [days]);

  const views = data?.totals.view ?? 0;
  const clicks = (data?.totals.contact_click ?? 0) + (data?.totals.partner_click ?? 0) + (data?.totals.offer_click ?? 0);
  const walls = data?.totals.auth_wall ?? 0;
  const shares = data?.totals.share ?? 0;
  const rate = (part: number, whole: number) => (whole > 0 ? `%${Math.round((part / whole) * 100)}` : "—");
  const steps = [
    { label: "İlan görüntüleme", value: views, note: "ilan sahibi ve botlar hariç" },
    { label: "Düğmeye basan", value: clicks, note: `görüntüleyenlerin ${rate(clicks, views)}'i · iletişim (mesaj/teklif/numara) ${data?.totals.contact_click ?? 0}, ortak ol ${data?.totals.partner_click ?? 0}` },
    { label: "Giriş ekranına takılan", value: walls, note: `basanların ${rate(walls, clicks)}'i üye değildi` },
    { label: "Paylaşan", value: shares, note: "ilanı paylaş düğmesi" }
  ];

  return (
    <View testID="listing-funnel-panel" style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 18 }}>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: 3, minWidth: 220 }}>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>İlan hunisi</Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>
            İlan sayfasına gelen ziyaretçi satıcıya ulaşmaya çalışıyor mu, nerede bırakıyor? Yalnız toplam sayılar; kişi verisi tutulmaz. Kayıt 14 Kasım 2026'da başladı.
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[7, 30, 90].map((value) => (
            <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: days === value }} onPress={() => setDays(value)}
              style={{ backgroundColor: days === value ? colors.primarySoft : colors.surfaceAlt, borderColor: days === value ? colors.primary : colors.line, borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: days === value ? colors.primaryDark : colors.muted, fontSize: 12.5, fontWeight: "800" }}>{value} gün</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {state === "loading" ? <Text style={{ color: colors.muted, fontSize: 13 }}>Yükleniyor…</Text> : null}
      {state === "error" ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 13, fontWeight: "700" }}>Huni verisi yüklenemedi.</Text> : null}

      {state === "ready" && data ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {steps.map((step, index) => (
              <View key={step.label} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexBasis: 200, flexGrow: 1, gap: 4, padding: 12 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                  {index > 0 && index < 3 ? <MaterialCommunityIcons name="arrow-right" size={14} color={colors.muted} /> : null}
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{step.label}</Text>
                </View>
                <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>{step.value.toLocaleString("tr-TR")}</Text>
                <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{step.note}</Text>
              </View>
            ))}
          </View>

          {views === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Bu dönemde kayıtlı görüntüleme yok. Ziyaretçi geldikçe burada birikir.</Text>
          ) : (
            <>
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>Ziyaretçi nereden geliyor</Text>
                {data.by_source.map((row) => (
                  <View key={`${row.source}:${row.platform}`} style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 7 }}>
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700", minWidth: 0 }}>{SOURCE_LABELS[row.source] ?? row.source} · {PLATFORM_LABELS[row.platform] ?? row.platform}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{row.views ?? 0} görüntüleme · {row.clicks ?? 0} tıklama · {row.auth_walls ?? 0} giriş duvarı</Text>
                  </View>
                ))}
              </View>
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>En çok görüntülenen ilanlar</Text>
                {data.top_listings.map((row) => (
                  <View key={row.listing_id} style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 7 }}>
                    <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700", minWidth: 0 }}>{displayListingTitle(row.title)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{row.views ?? 0} görüntüleme · {row.clicks ?? 0} tıklama</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      ) : null}
    </View>
  );
}
