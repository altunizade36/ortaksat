import { MaterialCommunityIcons } from "@/components/icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { AuthRequired } from "@/components/auth-gate";
import { Card, EmptyState, PrimaryButton } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useNativeRefresh } from "@/lib/use-native-refresh";
import { useIsWideWeb, useMounted } from "@/lib/layout";
import { ScreenSkeleton } from "@/components/screen-skeleton";
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

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

type Txn = { id: string; title: string; image?: string; date: string; sortAt: number; amount: number; commission: number; status: SaleStatus };

function saleDate(s: { paidAt?: string; approvedAt?: string; createdAt?: string }) {
  const raw = s.paidAt ?? s.approvedAt ?? s.createdAt ?? "";
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

function EarningsScreenInner() {
  const { language } = useLanguage();
  const { currentUser, findListing, partnerships, refreshUserData, sales, updateSaleStatus } = useStore();
  const { refreshing, onRefresh } = useNativeRefresh(refreshUserData);
  const isWideWeb = useIsWideWeb();
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  // İki rol tek sayfada: ORTAK kazancım (ortak olarak yaptığın satışların komisyonu) +
  // SATICI satışlarım (kendi ilanlarından yapılan satışların cirosu + ortağa ödenecek
  // komisyon). Eskiden sayfa yalnız ortak-taraflıydı → saf satıcı "Henüz kazanç yok"
  // görüyor, cirosunu/satış geçmişini/CSV'sini hiçbir yerde bulamıyordu.
  const myPartnershipIds = new Set(partnerships.filter((p) => p.partnerId === currentUser.id).map((p) => p.id));
  const partnerSales = sales.filter((s) => myPartnershipIds.has(s.partnershipId));
  const sellerSales = sales.filter((s) => findListing(s.listingId)?.ownerId === currentUser.id);
  const hasPartner = partnerSales.length > 0;
  const hasSeller = sellerSales.length > 0;
  const showRoleToggle = hasPartner && hasSeller;
  const [viewPref, setViewPref] = useState<"partner" | "seller" | null>(null);
  // Tek veri varsa o rol; ikisi de varsa kullanıcı tercihi (varsayılan ortak). Stale-state yok.
  const view: "partner" | "seller" = showRoleToggle ? (viewPref ?? "partner") : (hasSeller && !hasPartner ? "seller" : "partner");
  const isSeller = view === "seller";

  const sourceSales = isSeller ? sellerSales : partnerSales;
  // Yalnızca gerçek satışlar — sahte/örnek veri yok.
  const txns: Txn[] = sourceSales
    .map((s) => {
      const listing = findListing(s.listingId);
      return { id: s.id, title: listing ? displayText(listing.title) : translateCopy("İlan", language), image: listing?.image, date: s.paidAt ?? s.approvedAt ?? "—", sortAt: saleDate(s), amount: s.amount, commission: s.commissionAmount, status: s.status };
    })
    .sort((a, b) => b.sortAt - a.sortAt);

  // Grafik/istatistik metriği role göre: ortak → kazandığı komisyon; satıcı → satış cirosu.
  const metric = (t: Txn) => (isSeller ? t.amount : t.commission);
  const totalCommission = txns.reduce((sum, t) => sum + t.commission, 0); // ortak: kazanç · satıcı: ortağa toplam komisyon
  const totalRevenue = txns.reduce((sum, t) => sum + t.amount, 0); // satıcı cirosu (GMV)
  const paidCommission = txns.filter((t) => t.status === "paid").reduce((sum, t) => sum + t.commission, 0);
  const pendingCommission = txns.filter((t) => t.status !== "paid" && t.status !== "cancelled").reduce((sum, t) => sum + t.commission, 0);

  // Son 6 ayın gerçek metriği (satış tarihine göre gruplanır).
  const now = new Date();
  const CHART = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const v = txns
      .filter((t) => { const td = new Date(t.sortAt); return t.sortAt > 0 && td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth(); })
      .reduce((sum, t) => sum + metric(t), 0);
    return { m: TR_MONTHS[d.getMonth()], v };
  });
  const monthEarn = CHART[CHART.length - 1].v;
  const prevMonthEarn = CHART[CHART.length - 2]?.v ?? 0;
  const growth = prevMonthEarn > 0 ? Math.round(((monthEarn - prevMonthEarn) / prevMonthEarn) * 1000) / 10 : null;
  const chartMax = Math.max(...CHART.map((c) => c.v), 1);
  const hasChartData = CHART.some((c) => c.v > 0);

  const topListings = [...txns].sort((a, b) => metric(b) - metric(a)).slice(0, 4);

  function downloadReport() {
    // Web'de gerçek CSV indir; hareketleri dışa aktarır (ortak: komisyon · satıcı: satış).
    if (typeof document === "undefined" || txns.length === 0) return;
    const header = isSeller ? "Ürün,Tarih,Ciro,Ortağa komisyon,Durum" : "Ürün,Tarih,Tutar,Komisyon,Durum";
    const rows = txns.map((t) => [t.title.replace(/[",\n]/g, " "), t.date, t.amount, t.commission, STATUS_META[t.status].label].join(","));
    const csv = "﻿" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = isSeller ? "ortaksat-satici-satislar.csv" : "ortaksat-komisyon-raporu.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Rol geçiş çipleri (yalnız kullanıcı hem ortak hem satıcıysa).
  const RoleToggle = showRoleToggle ? (
    <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", padding: 3 }}>
      {([["partner", "Ortak kazancım"], ["seller", "Satıcı satışlarım"]] as const).map(([key, label]) => {
        const on = view === key;
        return (
          <Pressable key={key} accessibilityRole="button" onPress={() => setViewPref(key)} style={{ backgroundColor: on ? colors.primary : "transparent", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
            <Text style={{ color: on ? "#FFFFFF" : colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy(label, language)}</Text>
          </Pressable>
        );
      })}
    </View>
  ) : null;

  if (isWideWeb) {
    const periods: Array<{ key: typeof period; label: string }> = [
      { key: "month", label: translateCopy("Bu ay", language) },
      { key: "quarter", label: translateCopy("Son 3 ay", language) },
      { key: "year", label: translateCopy("Bu yıl", language) }
    ];
    // Dönem seçici artık gerçekten işlem listesini filtreliyor (önceden yalnızca
    // butonun vurgusunu değiştiriyordu, hiçbir veriyi süzmüyordu).
    const periodStartMs = period === "month" ? new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      : period === "quarter" ? new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime()
      : new Date(now.getFullYear(), 0, 1).getTime();
    const periodTxns = txns.filter((t) => t.sortAt > 0 && t.sortAt >= periodStartMs);
    const stats: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; color: string; value: string; title: string; sub: string }> = isSeller
      ? [
          { icon: "cash-register", tint: colors.successSoft, color: colors.success, value: money(totalRevenue), title: translateCopy("Toplam ciro", language), sub: translateCopy("İlanlarından yapılan satışlar", language) },
          { icon: "handshake-outline", tint: colors.violetSoft, color: colors.violet, value: money(totalCommission), title: translateCopy("Ortağa komisyon", language), sub: translateCopy("Toplam ortak payı", language) },
          { icon: "check-decagram-outline", tint: colors.primarySoft, color: colors.primaryDark, value: money(paidCommission), title: translateCopy("Ödenen komisyon", language), sub: translateCopy("Ortaklara ödediğin", language) },
          { icon: "clock-outline", tint: colors.goldSoft, color: colors.gold, value: money(pendingCommission), title: translateCopy("Ödenecek komisyon", language), sub: translateCopy("Ortaklara borcun", language) }
        ]
      : [
          { icon: "cash-multiple", tint: colors.successSoft, color: colors.success, value: money(totalCommission), title: translateCopy("Toplam kazanç", language), sub: translateCopy("Tüm dönemler", language) },
          { icon: "check-decagram-outline", tint: colors.primarySoft, color: colors.primaryDark, value: money(paidCommission), title: translateCopy("Tahsil edilen", language), sub: translateCopy("Satıcıdan aldıkların", language) },
          { icon: "clock-outline", tint: colors.goldSoft, color: colors.gold, value: money(pendingCommission), title: translateCopy("Tahsil edilecek", language), sub: translateCopy("Onaylı, henüz alınmadı", language) },
          { icon: "trending-up", tint: colors.violetSoft, color: colors.violet, value: money(monthEarn), title: translateCopy("Bu ay", language), sub: `${TR_MONTHS[now.getMonth()]} ${now.getFullYear()}` }
        ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        <View style={{ alignSelf: "center", gap: 16, maxWidth: 1280, paddingHorizontal: 20, paddingTop: 16, width: "100%" }}>
        <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>{translateCopy(isSeller ? "Satıcı Satışlarım" : "Kazançlarım", language)}</Text>
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>{translateCopy(isSeller ? "İlanlarından yapılan satışların cirosu ve ortaklara ödenecek komisyonlar. Ortaksat para tutmaz." : "Ortak satışlarından kazandığın komisyonları takip et. Ödemeler satıcılarla aranızda yapılır; Ortaksat para tutmaz.", language)}</Text>
            </View>
            {RoleToggle}
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
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Kazanç grafiği", language)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{translateCopy("Son 6 ay komisyon kazancın", language)}</Text>
                </View>
                {growth !== null ? (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: growth >= 0 ? colors.success : colors.accent, fontSize: 13, fontWeight: "900" }}>{growth >= 0 ? "↑" : "↓"} %{Math.abs(growth).toString().replace(".", ",")}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{translateCopy("geçen aya göre", language)}</Text>
                  </View>
                ) : null}
              </View>
              {!hasChartData ? (
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", paddingVertical: 40, textAlign: "center" }}>{translateCopy("Henüz komisyon kazancın yok. Ortak satış yaptıkça grafiğin burada oluşacak.", language)}</Text>
              ) : (
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
              )}
            </View>

            {/* Transactions */}
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Komisyon hareketleri", language)}</Text>
                {txns.length ? (
                  <Pressable onPress={downloadReport} style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
                    <MaterialCommunityIcons name="download-outline" size={16} color={colors.primaryDark} />
                    <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Rapor indir", language)}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderTopWidth: 1, flexDirection: "row", paddingHorizontal: 18, paddingVertical: 10 }}>
                <Text style={{ color: colors.muted, flex: 3, fontSize: 11.5, fontWeight: "800" }}>{translateCopy("ÜRÜN", language)}</Text>
                <Text style={{ color: colors.muted, flex: 1.4, fontSize: 11.5, fontWeight: "800" }}>{translateCopy("TARİH", language)}</Text>
                <Text style={{ color: colors.muted, flex: 1.2, fontSize: 11.5, fontWeight: "800", textAlign: "right" }}>{translateCopy(isSeller ? "CİRO" : "TUTAR", language)}</Text>
                <Text style={{ color: colors.muted, flex: 1.2, fontSize: 11.5, fontWeight: "800", textAlign: "right" }}>{translateCopy(isSeller ? "ORTAĞA" : "KOMİSYON", language)}</Text>
                <Text style={{ color: colors.muted, flex: 1.3, fontSize: 11.5, fontWeight: "800", textAlign: "right" }}>{translateCopy("DURUM", language)}</Text>
              </View>
              {periodTxns.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", padding: 24, textAlign: "center" }}>{txns.length === 0 ? translateCopy("Henüz komisyon hareketin yok. Ortak satış tamamlandıkça burada listelenecek.", language) : translateCopy("Bu dönemde komisyon hareketin yok. Farklı bir dönem seç.", language)}</Text>
              ) : null}
              {periodTxns.map((t, idx) => {
                const meta = STATUS_META[t.status];
                // Ödeme mutabakatı (yalnız ORTAK görünümü): satıcı "ödedim" (seller_paid) dedikten
                // sonra ortak "Ödemeyi Aldım" ile 'paid' yapar. Eskiden bu aksiyon yalnız MOBİLDE
                // vardı; masaüstü tablo sadece durum-pill gösteriyordu (parite yok).
                const actionable = !isSeller && (t.status === "seller_paid" || t.status === "disputed");
                return (
                  <View key={t.id} style={{ borderTopColor: colors.line, borderTopWidth: idx === 0 ? 0 : 1 }}>
                    <View style={{ alignItems: "center", flexDirection: "row", paddingBottom: actionable ? 6 : 13, paddingHorizontal: 18, paddingTop: 13 }}>
                      <View style={{ alignItems: "center", flex: 3, flexDirection: "row", gap: 10, minWidth: 0 }}>
                        {t.image ? <Image source={{ uri: t.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 36, width: 36 }} /> : <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 36, justifyContent: "center", width: 36 }}><MaterialCommunityIcons name="tag-outline" size={18} color={colors.primaryDark} /></View>}
                        <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "800" }}>{t.title}</Text>
                      </View>
                      <Text style={{ color: colors.muted, flex: 1.4, fontSize: 12.5, fontWeight: "600" }}>{t.date}</Text>
                      <Text style={{ color: colors.muted, flex: 1.2, fontSize: 13, fontWeight: "700", textAlign: "right" }}>{money(t.amount)}</Text>
                      <Text style={{ color: colors.ink, flex: 1.2, fontSize: 13.5, fontWeight: "900", textAlign: "right" }}>{money(t.commission)}</Text>
                      <View style={{ alignItems: "flex-end", flex: 1.3 }}>
                        <View style={{ backgroundColor: meta.tint, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                          <Text style={{ color: meta.color, fontSize: 11, fontWeight: "900" }}>{translateCopy(meta.label, language)}</Text>
                        </View>
                      </View>
                    </View>
                    {actionable ? (
                      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", paddingBottom: 12, paddingHorizontal: 18 }}>
                        <Pressable onPress={() => updateSaleStatus(t.id, "paid")} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 }}>
                          <MaterialCommunityIcons name="check-circle-outline" size={15} color={colors.primaryDark} />
                          <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy(t.status === "disputed" ? "Çözüldü · Aldım" : "Ödemeyi Aldım", language)}</Text>
                        </Pressable>
                        {t.status !== "disputed" ? (
                          <Pressable onPress={() => updateSaleStatus(t.id, "disputed")} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 }}>
                            <MaterialCommunityIcons name="alert-outline" size={15} color={colors.muted} />
                            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Sorun bildir", language)}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Sidebar */}
          <View style={{ gap: 16, width: 300 }}>
            <View style={{ backgroundColor: colors.primaryDark, borderRadius: 16, gap: 10, padding: 18 }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700" }}>{translateCopy(isSeller ? "Ödenecek komisyon" : "Tahsil edilecek komisyon", language)}</Text>
              <Text style={{ color: "#FFFFFF", fontSize: 30, fontWeight: "900" }}>{money(pendingCommission)}</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" }}>{translateCopy(isSeller ? "Onaylanan satışlar için ortaklara ödeyeceğin komisyon. Doğrudan anlaştığınız kanaldan ödersin." : "Onaylanan satışların komisyonu. Tutarı satıcıdan doğrudan tahsil edersin.", language)}</Text>
              <Link href="/messages" asChild>
                <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 4, paddingVertical: 11 }}>
                  <MaterialCommunityIcons name="message-text-outline" size={18} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy(isSeller ? "Ortaklara mesaj at" : "Satıcıya mesaj at", language)}</Text>
                </Pressable>
              </Link>
            </View>

            <View style={{ backgroundColor: colors.infoSoft, borderColor: colors.info, borderRadius: 16, borderWidth: 1, gap: 8, padding: 18 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <MaterialCommunityIcons name="information-outline" size={20} color={colors.info} />
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{translateCopy(isSeller ? "Komisyon nasıl ödenir?" : "Komisyon nasıl alınır?", language)}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 19 }}>{translateCopy(isSeller ? "Ortaksat para tutmaz veya transfer etmez. Ortağının komisyonunu, anlaştığınız kanaldan (havale/EFT, elden vb.) doğrudan sen ödersin. Ödedikten sonra satışı satıcı panelinden “Ödendi” işaretle." : "Ortaksat para tutmaz veya transfer etmez. Komisyonunu satıcı, anlaştığınız kanaldan (havale/EFT, elden vb.) doğrudan sana öder. Ödemeyi aldığında satışı “Ödendi” olarak işaretle.", language)}</Text>
            </View>

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy(isSeller ? "En çok satan" : "En çok kazandıran", language)}</Text>
              {topListings.length === 0 ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{translateCopy(isSeller ? "Satış yaptıkça en çok satan ilanların burada sıralanır." : "Ortak satış yaptıkça en çok kazandıran ilanların burada sıralanır.", language)}</Text> : null}
              {topListings.map((t, i) => (
                <View key={t.id} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                  <Text style={{ color: colors.subtle, fontSize: 14, fontWeight: "900", width: 16 }}>{i + 1}</Text>
                  {t.image ? <Image source={{ uri: t.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 34, width: 34 }} /> : <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 34, justifyContent: "center", width: 34 }}><MaterialCommunityIcons name="tag-outline" size={16} color={colors.primaryDark} /></View>}
                  <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{t.title}</Text>
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{money(metric(t))}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        </View>

        <WebFooter />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, padding: 12, paddingBottom: 96 }} refreshControl={Platform.OS === "web" ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{translateCopy(isSeller ? "Satıcı Satışlarım" : "Kazançlarım", language)}</Text>
        <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{translateCopy(isSeller ? "İlanlarından yapılan satışlar ve ortaklara ödenecek komisyonlar. Ortaksat para tutmaz." : "Ortak satış komisyonların. Ödeme satıcıyla aranızda yapılır; Ortaksat para tutmaz.", language)}</Text>
      </View>
      {RoleToggle ? <View style={{ alignSelf: "flex-start" }}>{RoleToggle}</View> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {isSeller ? (
          <>
            <MiniStat label={translateCopy("Ciro", language)} value={money(totalRevenue)} />
            <MiniStat label={translateCopy("Ödenecek", language)} value={money(pendingCommission)} />
            <MiniStat label={translateCopy("Ödenen", language)} value={money(paidCommission)} />
          </>
        ) : (
          <>
            <MiniStat label={translateCopy("Toplam", language)} value={money(totalCommission)} />
            <MiniStat label={translateCopy("Tahsil edilecek", language)} value={money(pendingCommission)} />
            <MiniStat label={translateCopy("Tahsil edilen", language)} value={money(paidCommission)} />
          </>
        )}
      </View>
      {/* Satıcıda CSV dışa aktarım (masaüstünde de var) — satış geçmişini indir. */}
      {isSeller && txns.length > 0 && Platform.OS === "web" ? (
        <Pressable onPress={downloadReport} style={{ alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 5 }}>
          <MaterialCommunityIcons name="download-outline" size={16} color={colors.primaryDark} />
          <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Satış raporu indir (CSV)", language)}</Text>
        </Pressable>
      ) : null}
      {txns.length === 0 ? <EmptyState title={translateCopy(isSeller ? "Henüz satış yok" : "Henüz kazanç yok", language)} body={translateCopy(isSeller ? "İlanlarından satış yapıldıkça (ortak veya doğrudan) burada listelenecek." : "Ortak satış yaptıkça komisyonların burada görünecek.", language)} mascot="idea" /> : null}
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
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{money(isSeller ? t.amount : t.commission)}</Text>
                {isSeller ? <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{translateCopy("ortağa", language)} {money(t.commission)}</Text> : null}
                <View style={{ backgroundColor: meta.tint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: meta.color, fontSize: 10.5, fontWeight: "900" }}>{translateCopy(meta.label, language)}</Text></View>
              </View>
            </View>

            {/* ÖDEME MUTABAKATI KAZANÇ SAYFASINDA DA (yalnız ORTAK görünümü): satıcı "ödedim"
                dedikten sonra (seller_paid) ortağın "Ödemeyi Aldım" onayı komisyonu 'paid' yapar. */}
            {!isSeller && (t.status === "seller_paid" || t.status === "disputed") ? (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton tone="soft" onPress={() => updateSaleStatus(t.id, "paid")}>
                    {t.status === "disputed" ? translateCopy("Çözüldü · Aldım", language) : translateCopy("Ödemeyi Aldım", language)}
                  </PrimaryButton>
                </View>
                {t.status !== "disputed" ? (
                  <View style={{ flex: 1 }}>
                    <PrimaryButton tone="secondary" onPress={() => updateSaleStatus(t.id, "disputed")}>
                      {translateCopy("Sorun bildir", language)}
                    </PrimaryButton>
                  </View>
                ) : null}
              </View>
            ) : null}
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

export default function EarningsScreen() {
  const { language } = useLanguage();
  const auth = useStore();
  const mounted = useMounted();
  // SSG (giriş yok) → client (giriş var) uyuşmazlığını (#418) mount-gate ile giderir.
  if (!mounted) return <ScreenSkeleton />;
  if (!auth.isAuthenticated) return <AuthRequired title={translateCopy("Kazançlarını görmek için giriş yapın", language)} />;
  return <EarningsScreenInner />;
}
