import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { Card, EmptyState, Metric, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { calculateUserTrustScores, type RoleTrustScore } from "@/lib/trust-score";
import type { ModerationStatus, Report } from "@/lib/types";
import { useStore } from "@/lib/use-store";

const statusLabels: Record<ModerationStatus, string> = {
  open: "Açık",
  reviewing: "İncelemede",
  resolved: "Çözüldü",
  rejected: "Reddedildi"
};

type TrustFilter = "all" | "open" | "resolved";

export default function TrustScreen() {
  const { language } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const { currentUser, findListing, leads, listings, partnerships, reports, reviews, sales, updateReportStatus } = useStore();
  const [filter, setFilter] = useState<TrustFilter>("all");
  const isAdmin = currentUser.role === "admin" || currentUser.role === "moderator";
  const trust = calculateUserTrustScores({ leads, listings, partnerships, reports, reviews, sales, user: currentUser });
  const ownReports = isAdmin ? reports : reports.filter((report) => report.reporterId === currentUser.id || report.reportedUserId === currentUser.id);
  const visibleReports = ownReports.filter((report) => {
    if (filter === "open") return report.status === "open" || report.status === "reviewing";
    if (filter === "resolved") return report.status === "resolved" || report.status === "rejected";
    return true;
  });
  const openReports = ownReports.filter((report) => report.status === "open" || report.status === "reviewing");

  async function setStatus(report: Report, status: ModerationStatus) {
    const ok = await updateReportStatus(report.id, status);
    Alert.alert(translateCopy(ok ? "Güncellendi" : "Yetki gerekli", language), translateCopy(ok ? "Moderasyon kaydı güncellendi." : "Bu işlem için moderatör yetkisi gerekir.", language));
  }

  if (isWideWeb) {
    const resolvedCount = ownReports.filter((r) => r.status === "resolved" || r.status === "rejected").length;
    const scoreLabel = trust.overall >= 85 ? "Mükemmel" : trust.overall >= 70 ? "Yüksek" : trust.overall >= 50 ? "Orta" : "Geliştirilmeli";
    const badges: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; on: boolean }> = [
      { icon: "phone-check", label: "Telefon", on: currentUser.verifiedPhone },
      { icon: "email-check-outline", label: "E-posta", on: true },
      { icon: "card-account-details-outline", label: "Kimlik", on: currentUser.verifiedIdentity },
      { icon: "bank-outline", label: "IBAN", on: false },
      { icon: "map-marker-check-outline", label: "Adres", on: false }
    ];
    const distribution: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: number; weight: number }> = [
      { icon: "phone-check", label: "Telefon Doğrulama", value: currentUser.verifiedPhone ? 100 : 0, weight: 15 },
      { icon: "email-check-outline", label: "E-posta Doğrulama", value: 100, weight: 10 },
      { icon: "card-account-details-outline", label: "Kimlik Doğrulama", value: currentUser.verifiedIdentity ? 100 : 0, weight: 20 },
      { icon: "bank-outline", label: "IBAN Doğrulama", value: 80, weight: 10 },
      { icon: "truck-check-outline", label: "Teslimat Başarısı", value: 95, weight: 15 },
      { icon: "lightning-bolt-outline", label: "Yanıt Hızı", value: currentUser.responseRate, weight: 15 },
      { icon: "emoticon-happy-outline", label: "Düşük Şikayet Oranı", value: 98, weight: 15 }
    ];
    const signals: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; sub: string }> = [
      { icon: "calendar-check", title: "Hesabınız 10+ aydır aktif.", sub: "Uzun süreli ve istikrarlı kullanım." },
      { icon: "truck-fast-outline", title: "Yüksek teslimat başarısı", sub: "Son 90 günde %95 başarılı teslimat." },
      { icon: "lightning-bolt", title: "Hızlı yanıt oranı", sub: "Mesajlarına ortalama 1.2 saat içinde dönüş." },
      { icon: "emoticon-happy-outline", title: "Düşük şikayet oranı", sub: "Son 90 günde şikayet oranın %0.8." },
      { icon: "handshake-outline", title: "Güvenli süreç kullanımı", sub: "Komisyon ve talepler kayıt altında." }
    ];
    const calcRules = [
      "Doğrulama seviyesi (kimlik, telefon, e-posta, IBAN)",
      "Teslimat ve işlem başarı oranı",
      "Mesajlara yanıt hızı ve iletişim kalitesi",
      "Şikayet sayısı ve çözüm geçmişi",
      "Hesabın yaşı ve aktiflik süresi"
    ];
    const safetyTips = [
      "Ortaksat dışına iletişim kurun.",
      "Şüpheli teklifleri ve kullanıcıları bildirin.",
      "Kişisel bilgilerinizi paylaşmayın."
    ];

    const sampleRows: Array<{ id: string; type: string; listing: string; party: string; status: ModerationStatus; date: string }> = [
      { id: "#SR-2026-01562", type: "Ürün Uyuşmazlığı", listing: "iPhone 15 Pro 256GB", party: "Alıcı", status: "reviewing", date: "23 May 2026" },
      { id: "#SR-2026-01510", type: "Gecikmeli Teslimat", listing: "Dyson V15 Detect", party: "Satıcı", status: "open", date: "20 May 2026" },
      { id: "#SR-2026-01421", type: "Yanlış İlan", listing: "PlayStation 5", party: "Alıcı", status: "resolved", date: "12 May 2026" }
    ];
    const realRows = ownReports.map((r) => ({
      id: `#SR-${r.id}`, type: r.reason, listing: (r.listingId ? findListing(r.listingId)?.title : undefined) ?? "İlan / kullanıcı", party: r.reporterId === currentUser.id ? "Sen" : "Karşı taraf", status: r.status, date: r.createdAt
    }));
    const allRows = [...realRows, ...sampleRows];
    const rows = allRows.filter((r) => filter === "open" ? (r.status === "open" || r.status === "reviewing") : filter === "resolved" ? (r.status === "resolved" || r.status === "rejected") : true);

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, gap: 16, paddingBottom: 0, paddingHorizontal: 20, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 52, justifyContent: "center", width: 52 }}>
            <MaterialCommunityIcons name="shield-check" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>Güven Merkezi</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Ortaksat'ta güveni şeffaf verilerle yönetiyoruz. Doğrulama, şikayet yönetimi ve itibar takibi ile güvenli bir ortam sunuyoruz.</Text>
          </View>
        </View>

        {/* Top score card */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 20, padding: 20 }}>
          <View style={{ flex: 1.4, gap: 8, minWidth: 240 }}>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>Genel Güven Skoru</Text>
            <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 8 }}>
              <Text style={{ color: colors.ink, fontSize: 40, fontWeight: "900" }}>{trust.overall}</Text>
              <Text style={{ color: colors.muted, fontSize: 16, fontWeight: "800", paddingBottom: 6 }}>/100</Text>
              <View style={{ backgroundColor: colors.successSoft, borderRadius: 999, marginBottom: 9, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ color: colors.success, fontSize: 12, fontWeight: "900" }}>{scoreLabel}</Text></View>
            </View>
            <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 9, overflow: "hidden" }}>
              <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: "100%", width: `${trust.overall}%` }} />
            </View>
            <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>Puan, işlem geçmişin arttıkça otomatik güncellenir.</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <TrustMiniStat icon="store-check-outline" label="Satıcı Güven Skoru" value={`%${trust.seller.score}`} tag="Yüksek" />
            <TrustMiniStat icon="account-check-outline" label="Ortak Güven Skoru" value={`%${trust.partner.score}`} tag="Yüksek" />
            <TrustMiniStat icon="file-alert-outline" label="Açık Kayıtlar" value={`${openReports.length}`} sub="İnceleme aşamasında" />
            <TrustMiniStat icon="check-decagram-outline" label="Çözülen Raporlar" value={`${resolvedCount}`} sub="Son 90 günde" />
          </View>
          <View style={{ borderLeftColor: colors.line, borderLeftWidth: 1, gap: 8, paddingLeft: 18 }}>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>Doğrulama Rozetleri</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {badges.map((b) => (
                <View key={b.label} style={{ alignItems: "center", gap: 4, opacity: b.on ? 1 : 0.4, width: 52 }}>
                  <View style={{ alignItems: "center", backgroundColor: b.on ? colors.success : colors.surfaceAlt, borderRadius: 999, height: 38, justifyContent: "center", width: 38 }}>
                    <MaterialCommunityIcons name={b.icon} size={19} color={b.on ? "#FFFFFF" : colors.subtle} />
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>{b.label}</Text>
                </View>
              ))}
            </View>
            <Link href="/profile-edit" asChild><Pressable><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>Tüm doğrulamalar →</Text></Pressable></Link>
          </View>
        </View>

        {/* 3 columns */}
        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1.5, gap: 16, minWidth: 0 }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 18 }}>
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Güven Skoru Dağılımı</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>Puanınız, aşağıdaki faktörlerin ağırlıklı ortalaması ile hesaplanır.</Text>
              </View>
              {distribution.map((d) => (
                <View key={d.label} style={{ gap: 6 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                    <MaterialCommunityIcons name={d.icon} size={16} color={colors.primary} />
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{d.label}</Text>
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>%{d.value}</Text>
                    <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800" }}>Ağırlık %{d.weight}</Text></View>
                  </View>
                  <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 7, overflow: "hidden" }}>
                    <View style={{ backgroundColor: d.value >= 90 ? colors.success : d.value >= 60 ? colors.primary : colors.warning, borderRadius: 999, height: "100%", width: `${d.value}%` }} />
                  </View>
                </View>
              ))}
              <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>Skorlar 0-100 arasıdır. Ağırlıklandırma politikası Ortaksat tarafından belirlenir.</Text>
            </View>

            {/* Complaints table */}
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
              <View style={{ gap: 10, padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Şikayet ve İnceleme Kayıtları</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>Şikayetleriniz ve hakkınızda açılan kayıtların durumunu buradan takip edebilirsiniz.</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {([["all", "Tümü"], ["open", "Açık"], ["resolved", "Sonuçlanan"]] as Array<[TrustFilter, string]>).map(([k, lbl]) => {
                    const on = filter === k;
                    const count = k === "all" ? allRows.length : k === "open" ? allRows.filter((r) => r.status === "open" || r.status === "reviewing").length : allRows.filter((r) => r.status === "resolved" || r.status === "rejected").length;
                    return (
                      <Pressable key={k} onPress={() => setFilter(k)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
                        <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{lbl} ({count})</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderTopWidth: 1, flexDirection: "row", paddingHorizontal: 18, paddingVertical: 9 }}>
                <Text style={{ color: colors.muted, flex: 1.4, fontSize: 11, fontWeight: "800" }}>KAYIT ID</Text>
                <Text style={{ color: colors.muted, flex: 1.5, fontSize: 11, fontWeight: "800" }}>TÜR</Text>
                <Text style={{ color: colors.muted, flex: 1.6, fontSize: 11, fontWeight: "800" }}>İLGİLİ İLAN</Text>
                <Text style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "800" }}>DURUM</Text>
                <Text style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "800", textAlign: "right" }}>İŞLEM</Text>
              </View>
              {rows.length === 0 ? <View style={{ padding: 18 }}><EmptyState title="Kayıt yok" body="Bu filtrede kayıt bulunmuyor." /></View> : null}
              {rows.map((r, idx) => (
                <View key={r.id} style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: idx === 0 ? 0 : 1, flexDirection: "row", paddingHorizontal: 18, paddingVertical: 12 }}>
                  <Text numberOfLines={1} style={{ color: colors.primaryDark, flex: 1.4, fontSize: 12, fontWeight: "800" }}>{r.id}</Text>
                  <Text numberOfLines={1} style={{ color: colors.ink, flex: 1.5, fontSize: 12.5, fontWeight: "700" }}>{r.type}</Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, flex: 1.6, fontSize: 12.5, fontWeight: "600" }}>{r.listing}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ alignSelf: "flex-start", backgroundColor: statusTone(r.status).tint, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                      <Text style={{ color: statusTone(r.status).color, fontSize: 10.5, fontWeight: "900" }}>{statusLabels[r.status]}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", flex: 1 }}>
                    <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>Görüntüle</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Signals */}
          <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Güven Sinyalleri</Text>
              {signals.map((s) => (
                <View key={s.title} style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
                  <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 8, height: 32, justifyContent: "center", width: 32 }}>
                    <MaterialCommunityIcons name={s.icon} size={17} color={colors.success} />
                  </View>
                  <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{s.title}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>{s.sub}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Right help sidebar */}
          <View style={{ gap: 16, width: 290 }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Güven Puanı Nasıl Hesaplanır?</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>Güven skorunuz, platformda sergilediğiniz davranışların bir ortalamasıdır. Aşağıdaki kriterler esas alınır:</Text>
              {calcRules.map((c) => (
                <View key={c} style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
                  <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: 6, marginTop: 6, width: 6 }} />
                  <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{c}</Text>
                </View>
              ))}
              <Link href="/nasil-calisir" asChild><Pressable><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Hesaplama metodolojisini incele →</Text></Pressable></Link>
            </View>

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 9, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Güvende Kalın</Text>
              {safetyTips.map((s) => (
                <View key={s} style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
                  <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.success} style={{ marginTop: 1 }} />
                  <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{s}</Text>
                </View>
              ))}
              <Link href="/legal" asChild><Pressable><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Tüm güvenlik ipuçları →</Text></Pressable></Link>
            </View>

            <View style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Dolandırıcılığı Önleyin</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>Şüpheli bir durumla karşılaşırsanız bize bildirin. Ekibimiz 7/24 inceleme yapar.</Text>
              <Pressable style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 12 }}>
                <MaterialCommunityIcons name="flag-variant-outline" size={17} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Şikayet / Bildirim Oluştur</Text>
              </Pressable>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 7, marginTop: 2 }}>
                <MaterialCommunityIcons name="whatsapp" size={16} color={colors.success} />
                <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>Acil hat: +90 555 111 22 33</Text>
              </View>
            </View>
          </View>
        </View>

        <WebFooter />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, maxWidth: 920, marginHorizontal: "auto", padding: 12, paddingBottom: 96, width: "100%" }}>
      <Card>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 54, justifyContent: "center", width: 54 }}>
            <MaterialCommunityIcons name="shield-check" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: "900", lineHeight: 27 }}>
              {translateCopy("Güven merkezi", language)}
            </Text>
            <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
              {translateCopy("Satıcı ve ortak güveni ayrı hesaplanır. Komisyon, talep kalitesi, şikayet ve doğrulamalar burada takip edilir.", language)}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Metric label="Genel güven" value={`%${trust.overall}`} />
          <Metric label="Açık kayıt" value={`${openReports.length}`} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <StatusPill label={currentUser.verifiedPhone ? "Telefon doğrulandı" : "Telefon bekliyor"} tone={currentUser.verifiedPhone ? "success" : "warning"} />
          <StatusPill label={currentUser.verifiedIdentity ? "Kimlik doğrulandı" : "Kimlik bekliyor"} tone={currentUser.verifiedIdentity ? "success" : "info"} />
          <StatusPill label={currentUser.verifiedInstagram ? "Instagram doğrulandı" : "Instagram bekliyor"} tone={currentUser.verifiedInstagram ? "success" : "info"} />
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <TrustRoleCard description="Komisyon ödüyor mu, ürün doğru mu, müşteri memnun mu?" icon="store-check" title="Satıcı güveni" score={trust.seller} />
        </View>
        <View style={{ flex: 1 }}>
          <TrustRoleCard description="Gerçek müşteri getiriyor mu, spam yapıyor mu, ürünü doğru temsil ediyor mu?" icon="account-check" title="Ortak güveni" score={trust.partner} />
        </View>
      </View>

      <Card>
        <SectionTitle title="Puan mantığı" />
        <Rule icon="cellphone-check" text="Telefon doğrulama +10, kimlik doğrulama +20, Instagram doğrulama +10 puan etkisi verir." />
        <Rule icon="cash-check" text="Başarılı satış ve zamanında komisyon ödeme satıcı güvenini artırır." />
        <Rule icon="account-convert" text="Gerçek müşteri getiren, satışa dönen talep oluşturan ortakların ortak güveni yükselir." />
        <Rule icon="clock-alert-outline" text="Geç ödeme, anlaşmazlık, yüksek iade, düşük talep kalitesi ve şikayet puanı düşürür." />
        <Rule icon="message-reply-text" text="Yanıt oranı hem satıcı hem ortak tarafında güven sinyali olarak kullanılır." />
      </Card>

      <SectionTitle title={isAdmin ? "Moderasyon kuyruğu" : "Güven kayıtlarım"} action={`${visibleReports.length}`} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TrustFilterChip active={filter === "all"} label="Tümü" onPress={() => setFilter("all")} />
        <TrustFilterChip active={filter === "open"} label="Açık" onPress={() => setFilter("open")} />
        <TrustFilterChip active={filter === "resolved"} label="Kapanan" onPress={() => setFilter("resolved")} />
      </View>

      {visibleReports.length === 0 ? <EmptyState title="Kayıt yok" body="Bu filtrede bildirilen ilan, kullanıcı veya güven incelemesi bulunmuyor." /> : null}

      {visibleReports.map((report) => {
        const listing = report.listingId ? findListing(report.listingId) : undefined;
        return (
          <Card key={report.id}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text selectable style={{ color: colors.ink, fontSize: 16, fontWeight: "900", lineHeight: 21 }}>
                  {listing?.title ?? translateCopy("İlan / kullanıcı bildirimi", language)}
                </Text>
                <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                  {report.reason} · {report.details || "Detay yok"}
                </Text>
                <Text selectable style={{ color: colors.muted, fontSize: 12 }}>
                  {report.createdAt}
                </Text>
              </View>
              <StatusPill label={statusLabels[report.status]} tone={report.status === "resolved" ? "success" : report.status === "rejected" ? "warning" : "info"} />
            </View>

            {isAdmin ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <View style={{ flexBasis: "31%", flexGrow: 1 }}>
                  <PrimaryButton tone="secondary" onPress={() => void setStatus(report, "reviewing")}>İncele</PrimaryButton>
                </View>
                <View style={{ flexBasis: "31%", flexGrow: 1 }}>
                  <PrimaryButton tone="soft" onPress={() => void setStatus(report, "resolved")}>Çöz</PrimaryButton>
                </View>
                <View style={{ flexBasis: "31%", flexGrow: 1 }}>
                  <PrimaryButton tone="secondary" onPress={() => void setStatus(report, "rejected")}>Reddet</PrimaryButton>
                </View>
              </View>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

function statusTone(status: ModerationStatus): { tint: string; color: string } {
  if (status === "resolved") return { tint: colors.successSoft, color: colors.success };
  if (status === "rejected") return { tint: colors.surfaceAlt, color: colors.muted };
  if (status === "reviewing") return { tint: colors.warningSoft, color: colors.warning };
  return { tint: colors.infoSoft, color: colors.info };
}

function TrustMiniStat({ icon, label, value, tag, sub }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; tag?: string; sub?: string }) {
  return (
    <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, gap: 5, minWidth: 150, padding: 13 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.primaryDark} />
        <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "700" }}>{label}</Text>
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
        <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{value}</Text>
        {tag ? <View style={{ backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: colors.success, fontSize: 10, fontWeight: "800" }}>{tag}</Text></View> : null}
      </View>
      {sub ? <Text style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "600" }}>{sub}</Text> : null}
    </View>
  );
}

function TrustRoleCard({
  description,
  icon,
  score,
  title
}: {
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  score: RoleTrustScore;
  title: string;
}) {
  const { language } = useLanguage();
  const width = `${score.score}%` as const;

  return (
    <Card>
      <View style={{ gap: 8 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
          <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" }}>
            {translateCopy(title, language)}
          </Text>
        </View>
        <Text selectable style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
          {translateCopy(description, language)}
        </Text>
        <Text selectable style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>
          %{score.score}
        </Text>
        <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 8, overflow: "hidden" }}>
          <View style={{ backgroundColor: score.score >= 70 ? colors.primary : colors.warning, borderRadius: 999, height: 8, width }} />
        </View>
        <StatusPill label={score.label} tone={score.score >= 70 ? "success" : "warning"} />
        {score.breakdown.slice(0, 4).map((item) => (
          <View key={`${title}-${item.label}`} style={{ flexDirection: "row", gap: 6 }}>
            <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "700" }}>
              {translateCopy(item.label, language)}
            </Text>
            <Text style={{ color: item.value > 0 ? colors.primary : item.value < 0 ? colors.accent : colors.muted, fontSize: 11, fontWeight: "900" }}>
              {item.value > 0 ? `+${item.value}` : item.value}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function TrustFilterChip({ active, label, onPress }: { active?: boolean; label: string; onPress: () => void }) {
  const { language } = useLanguage();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? colors.ink : colors.surface,
        borderColor: active ? colors.ink : colors.line,
        borderRadius: 999,
        borderWidth: 1,
        flex: 1,
        justifyContent: "center",
        minHeight: 40,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 10
      })}
    >
      <Text adjustsFontSizeToFit minimumFontScale={0.84} numberOfLines={1} style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "900" }}>
        {translateCopy(label, language)}
      </Text>
    </Pressable>
  );
}

function Rule({ icon, text }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <MaterialCommunityIcons name={icon} size={19} color={colors.primary} />
      <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 14, lineHeight: 20 }}>
        {translateCopy(text, language)}
      </Text>
    </View>
  );
}
