import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { Card, EmptyState } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { money } from "@/lib/format";
import { useIsWideWeb } from "@/lib/layout";
import { displayText } from "@/lib/text";
import type { SaleStatus } from "@/lib/types";
import { useStore } from "@/lib/use-store";

const STATUS_META: Record<SaleStatus, { label: string; tint: string; color: string }> = {
  pending: { label: "Bekliyor", tint: colors.warningSoft, color: colors.warning },
  return_pending: { label: "İade süresi", tint: colors.warningSoft, color: colors.warning },
  approved: { label: "Onaylandı", tint: colors.infoSoft, color: colors.info },
  seller_paid: { label: "Onay bekliyor", tint: colors.goldSoft, color: colors.gold },
  paid: { label: "Ödendi", tint: colors.successSoft, color: colors.success },
  cancelled: { label: "İptal", tint: colors.surfaceAlt, color: colors.muted },
  disputed: { label: "İtiraz", tint: colors.accentSoft, color: colors.accent }
};

const CHART = [
  { m: "Oca", v: 1240 },
  { m: "Şub", v: 1860 },
  { m: "Mar", v: 1520 },
  { m: "Nis", v: 2380 },
  { m: "May", v: 2940 },
  { m: "Haz", v: 3420 }
];

type Txn = { id: string; title: string; image?: string; date: string; amount: number; commission: number; status: SaleStatus };

const SAMPLE_TXNS: Txn[] = [
  { id: "t1", title: "Akıllı çocuk saati", date: "28 Haz 2026", amount: 2450, commission: 294, status: "approved" },
  { id: "t2", title: "Taşınabilir blender", date: "26 Haz 2026", amount: 1290, commission: 181, status: "paid" },
  { id: "t3", title: "Minimal gümüş kolye", date: "22 Haz 2026", amount: 540, commission: 90, status: "paid" },
  { id: "t4", title: "Bebek bakım çantası", date: "19 Haz 2026", amount: 1180, commission: 160, status: "seller_paid" },
  { id: "t5", title: "Köşe koltuk takımı", date: "14 Haz 2026", amount: 18900, commission: 945, status: "pending" },
  { id: "t6", title: "Kablosuz kulaklık", date: "09 Haz 2026", amount: 2790, commission: 223, status: "paid" }
];

export default function EarningsScreen() {
  const { currentUser, findListing, partnerships, sales } = useStore();
  const isWideWeb = useIsWideWeb();
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  const myPartnershipIds = new Set(partnerships.filter((p) => p.partnerId === currentUser.id).map((p) => p.id));
  const partnerSales = sales.filter((s) => myPartnershipIds.has(s.partnershipId));
  const realTxns: Txn[] = partnerSales.map((s) => {
    const listing = findListing(s.listingId);
    return { id: s.id, title: listing ? displayText(listing.title) : "İlan", image: listing?.image, date: s.paidAt ?? s.approvedAt ?? "—", amount: s.amount, commission: s.commissionAmount, status: s.status };
  });
  const txns: Txn[] = [...realTxns, ...SAMPLE_TXNS];

  const totalCommission = txns.reduce((sum, t) => sum + t.commission, 0);
  const paidCommission = txns.filter((t) => t.status === "paid").reduce((sum, t) => sum + t.commission, 0);
  const pendingCommission = txns.filter((t) => t.status !== "paid" && t.status !== "cancelled").reduce((sum, t) => sum + t.commission, 0);
  const monthEarn = CHART[CHART.length - 1].v;
  const chartMax = Math.max(...CHART.map((c) => c.v));

  const topListings = [...txns].sort((a, b) => b.commission - a.commission).slice(0, 4);

  if (isWideWeb) {
    const periods: Array<{ key: typeof period; label: string }> = [
      { key: "month", label: "Bu ay" },
      { key: "quarter", label: "Son 3 ay" },
      { key: "year", label: "Bu yıl" }
    ];
    const stats: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; color: string; value: string; title: string; sub: string }> = [
      { icon: "cash-multiple", tint: colors.successSoft, color: colors.success, value: money(totalCommission), title: "Toplam kazanç", sub: "Tüm dönemler" },
      { icon: "wallet-outline", tint: colors.primarySoft, color: colors.primaryDark, value: money(paidCommission), title: "Ödenen komisyon", sub: "Hesabına aktarıldı" },
      { icon: "clock-outline", tint: colors.goldSoft, color: colors.gold, value: money(pendingCommission), title: "Bekleyen komisyon", sub: "Onay sürecinde" },
      { icon: "trending-up", tint: colors.violetSoft, color: colors.violet, value: money(monthEarn), title: "Bu ay", sub: "Haziran 2026" }
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, gap: 16, paddingBottom: 0, paddingHorizontal: 20, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
        <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>Kazançlarım</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Ortak satışlarından elde ettiğin komisyonları ve ödeme durumunu buradan takip et.</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {periods.map((p) => {
              const on = period === p.key;
              return (
                <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={{ backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {stats.map((s) => (
            <View key={s.title} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 220, flexGrow: 1, gap: 10, minWidth: 0, padding: 16 }}>
              <View style={{ alignItems: "center", backgroundColor: s.tint, borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
                <MaterialCommunityIcons name={s.icon} size={23} color={s.color} />
              </View>
              <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{s.value}</Text>
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{s.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{s.sub}</Text>
            </View>
          ))}
        </View>

        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
          <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
            {/* Chart */}
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 16, padding: 20 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Kazanç grafiği</Text>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>Son 6 ay komisyon kazancın</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.success, fontSize: 13, fontWeight: "900" }}>↑ %16,3</Text>
                  <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>geçen aya göre</Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 18, height: 200, justifyContent: "space-between", paddingTop: 10 }}>
                {CHART.map((c, i) => {
                  const h = Math.round((c.v / chartMax) * 168) + 8;
                  const last = i === CHART.length - 1;
                  return (
                    <View key={c.m} style={{ alignItems: "center", flex: 1, gap: 8, justifyContent: "flex-end" }}>
                      <Text style={{ color: last ? colors.primaryDark : colors.muted, fontSize: 11.5, fontWeight: "800" }}>{money(c.v)}</Text>
                      <View style={{ backgroundColor: last ? colors.primary : colors.primarySoft, borderRadius: 8, height: h, width: "100%" }} />
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{c.m}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Transactions */}
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Komisyon hareketleri</Text>
                <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Rapor indir</Text>
              </View>
              <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderTopWidth: 1, flexDirection: "row", paddingHorizontal: 18, paddingVertical: 10 }}>
                <Text style={{ color: colors.muted, flex: 3, fontSize: 11.5, fontWeight: "800" }}>ÜRÜN</Text>
                <Text style={{ color: colors.muted, flex: 1.4, fontSize: 11.5, fontWeight: "800" }}>TARİH</Text>
                <Text style={{ color: colors.muted, flex: 1.2, fontSize: 11.5, fontWeight: "800", textAlign: "right" }}>TUTAR</Text>
                <Text style={{ color: colors.muted, flex: 1.2, fontSize: 11.5, fontWeight: "800", textAlign: "right" }}>KOMİSYON</Text>
                <Text style={{ color: colors.muted, flex: 1.3, fontSize: 11.5, fontWeight: "800", textAlign: "right" }}>DURUM</Text>
              </View>
              {txns.map((t, idx) => {
                const meta = STATUS_META[t.status];
                return (
                  <View key={t.id} style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: idx === 0 ? 0 : 1, flexDirection: "row", paddingHorizontal: 18, paddingVertical: 13 }}>
                    <View style={{ alignItems: "center", flex: 3, flexDirection: "row", gap: 10, minWidth: 0 }}>
                      {t.image ? <Image source={{ uri: t.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 36, width: 36 }} /> : <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 36, justifyContent: "center", width: 36 }}><MaterialCommunityIcons name="tag-outline" size={18} color={colors.primaryDark} /></View>}
                      <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "800" }}>{t.title}</Text>
                    </View>
                    <Text style={{ color: colors.muted, flex: 1.4, fontSize: 12.5, fontWeight: "600" }}>{t.date}</Text>
                    <Text style={{ color: colors.muted, flex: 1.2, fontSize: 13, fontWeight: "700", textAlign: "right" }}>{money(t.amount)}</Text>
                    <Text style={{ color: colors.ink, flex: 1.2, fontSize: 13.5, fontWeight: "900", textAlign: "right" }}>{money(t.commission)}</Text>
                    <View style={{ alignItems: "flex-end", flex: 1.3 }}>
                      <View style={{ backgroundColor: meta.tint, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                        <Text style={{ color: meta.color, fontSize: 11, fontWeight: "900" }}>{meta.label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Sidebar */}
          <View style={{ gap: 16, width: 300 }}>
            <View style={{ backgroundColor: colors.primaryDark, borderRadius: 16, gap: 10, padding: 18 }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700" }}>Ödenebilir bakiye</Text>
              <Text style={{ color: "#FFFFFF", fontSize: 30, fontWeight: "900" }}>{money(pendingCommission)}</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" }}>İade süresi dolan komisyonlar ödemeye hazır.</Text>
              <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 4, paddingVertical: 11 }}>
                <MaterialCommunityIcons name="bank-transfer-out" size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Ödeme talep et</Text>
              </Pressable>
            </View>

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Ödeme yöntemi</Text>
                <Link href="/profile-edit" asChild><Pressable><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>Düzenle</Text></Pressable></Link>
              </View>
              <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 12, flexDirection: "row", gap: 12, padding: 12 }}>
                <MaterialCommunityIcons name="bank-outline" size={26} color={colors.primaryDark} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>TR** **** 4521</Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{currentUser.name}</Text>
                </View>
                <MaterialCommunityIcons name="check-decagram" size={18} color={colors.success} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>Komisyon ödemeleri her ayın 1'i ve 15'inde IBAN'ına aktarılır.</Text>
            </View>

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>En çok kazandıran</Text>
              {topListings.map((t, i) => (
                <View key={t.id} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                  <Text style={{ color: colors.subtle, fontSize: 14, fontWeight: "900", width: 16 }}>{i + 1}</Text>
                  {t.image ? <Image source={{ uri: t.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 34, width: 34 }} /> : <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 34, justifyContent: "center", width: 34 }}><MaterialCommunityIcons name="tag-outline" size={16} color={colors.primaryDark} /></View>}
                  <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{t.title}</Text>
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{money(t.commission)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <WebFooter />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, padding: 12, paddingBottom: 96 }}>
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>Kazançlarım</Text>
        <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>Ortak satış komisyonların ve ödeme durumun.</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <MiniStat label="Toplam" value={money(totalCommission)} />
        <MiniStat label="Bekleyen" value={money(pendingCommission)} />
        <MiniStat label="Ödenen" value={money(paidCommission)} />
      </View>
      {txns.length === 0 ? <EmptyState title="Henüz kazanç yok" body="Ortak satış yaptıkça komisyonların burada görünecek." /> : null}
      {txns.map((t) => {
        const meta = STATUS_META[t.status];
        return (
          <Card key={t.id}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              {t.image ? <Image source={{ uri: t.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 42, width: 42 }} /> : <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 42, justifyContent: "center", width: 42 }}><MaterialCommunityIcons name="tag-outline" size={20} color={colors.primaryDark} /></View>}
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{t.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{t.date}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{money(t.commission)}</Text>
                <View style={{ backgroundColor: meta.tint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: meta.color, fontSize: 10.5, fontWeight: "900" }}>{meta.label}</Text></View>
              </View>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flex: 1, gap: 3, padding: 10 }}>
      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}
