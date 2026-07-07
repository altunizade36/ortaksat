import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Alert } from "@/lib/alert";

import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
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
    const scoreLabel = trust.overall >= 85 ? translateCopy("Mükemmel", language) : trust.overall >= 70 ? translateCopy("Yüksek", language) : trust.overall >= 50 ? translateCopy("Orta", language) : translateCopy("Geliştirilmeli", language);
    const badges: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; on: boolean }> = [
      { icon: "phone-check", label: translateCopy("Telefon", language), on: currentUser.verifiedPhone },
      { icon: "email-check-outline", label: translateCopy("E-posta", language), on: true },
      { icon: "card-account-details-outline", label: translateCopy("Kimlik", language), on: currentUser.verifiedIdentity },
      { icon: "bank-outline", label: "IBAN", on: false },
      { icon: "map-marker-check-outline", label: translateCopy("Adres", language), on: false }
    ];
    // Gerçek verilerden türetilen dağılım (sabit/sahte değer yok).
    const complaintScore = openReports.length === 0 ? 100 : Math.max(40, 100 - openReports.length * 15);
    const distribution: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: number; weight: number }> = [
      { icon: "phone-check", label: translateCopy("Telefon Doğrulama", language), value: currentUser.verifiedPhone ? 100 : 0, weight: 20 },
      { icon: "email-check-outline", label: translateCopy("E-posta Doğrulama", language), value: 100, weight: 15 },
      { icon: "card-account-details-outline", label: translateCopy("Kimlik Doğrulama", language), value: currentUser.verifiedIdentity ? 100 : 0, weight: 25 },
      { icon: "lightning-bolt-outline", label: translateCopy("Yanıt Hızı", language), value: currentUser.responseRate, weight: 20 },
      { icon: "emoticon-happy-outline", label: translateCopy("Şikayet Kaydı Durumu", language), value: complaintScore, weight: 20 }
    ];
    // Gerçek durumdan üretilen güven sinyalleri.
    const signals: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; sub: string }> = [];
    if (currentUser.verifiedPhone) signals.push({ icon: "phone-check", title: translateCopy("Telefonun doğrulanmış.", language), sub: translateCopy("Alıcılar seninle daha güvenle iletişim kurar.", language) });
    if (currentUser.verifiedIdentity) signals.push({ icon: "card-account-details-outline", title: translateCopy("Kimliğin doğrulanmış.", language), sub: translateCopy("Doğrulanmış kimlik güven skorunu yükseltir.", language) });
    if (typeof currentUser.responseRate === "number" && currentUser.responseRate > 0) signals.push({ icon: "lightning-bolt", title: translateCopy("Mesaj yanıt oranın", language), sub: `Yanıt oranın %${currentUser.responseRate}.` });
    if (openReports.length === 0) signals.push({ icon: "emoticon-happy-outline", title: translateCopy("Açık şikayet kaydın yok.", language), sub: translateCopy("Hakkında bekleyen inceleme bulunmuyor.", language) });
    signals.push({ icon: "handshake-outline", title: translateCopy("Güvenli süreç kullanımı", language), sub: translateCopy("Komisyon ve talepler platformda kayıt altında.", language) });
    const calcRules = [
      translateCopy("Doğrulama seviyesi (kimlik, telefon, e-posta, IBAN)", language),
      translateCopy("Teslimat ve işlem başarı oranı", language),
      translateCopy("Mesajlara yanıt hızı ve iletişim kalitesi", language),
      translateCopy("Şikayet sayısı ve çözüm geçmişi", language),
      translateCopy("Hesabın yaşı ve aktiflik süresi", language)
    ];
    const safetyTips = [
      translateCopy("Ortaksat dışına iletişim kurun.", language),
      translateCopy("Şüpheli teklifleri ve kullanıcıları bildirin.", language),
      translateCopy("Kişisel bilgilerinizi paylaşmayın.", language)
    ];

    // Yalnızca gerçek şikayet/inceleme kayıtları — örnek/sahte kayıt yok.
    const allRows = ownReports.map((r) => ({
      id: `#SR-${r.id}`, type: r.reason, listing: (r.listingId ? findListing(r.listingId)?.title : undefined) ?? translateCopy("İlan / kullanıcı", language), party: r.reporterId === currentUser.id ? translateCopy("Sen", language) : translateCopy("Karşı taraf", language), status: r.status, date: r.createdAt
    }));
    const rows = allRows.filter((r) => filter === "open" ? (r.status === "open" || r.status === "reviewing") : filter === "resolved" ? (r.status === "resolved" || r.status === "rejected") : true);

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        <Seo title={translateCopy("Güven Merkezi — Doğrulama, şeffaflık ve şikayet | OrtakSat", language)} description={translateCopy("OrtakSat Güven Merkezi: satıcı/ortak doğrulama, güven puanı, şikayet yönetimi ve şeffaf süreçlerle güvenli bir ortak satış ortamı.", language)} path="/trust" />
        <View style={{ alignSelf: "center", gap: 16, maxWidth: 1280, paddingHorizontal: 20, paddingTop: 16, width: "100%" }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 52, justifyContent: "center", width: 52 }}>
            <MaterialCommunityIcons name="shield-check" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>{translateCopy("Güven Merkezi", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>{translateCopy("Ortaksat'ta güveni şeffaf verilerle yönetiyoruz. Doğrulama, şikayet yönetimi ve itibar takibi ile güvenli bir ortam sunuyoruz.", language)}</Text>
          </View>
        </View>

        {/* Top score card */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 20, padding: 20 }}>
          <View style={{ flex: 1.4, gap: 8, minWidth: 240 }}>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Genel Güven Skoru", language)}</Text>
            <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 8 }}>
              <Text style={{ color: colors.ink, fontSize: 40, fontWeight: "900" }}>{trust.overall}</Text>
              <Text style={{ color: colors.muted, fontSize: 16, fontWeight: "800", paddingBottom: 6 }}>/100</Text>
              <View style={{ backgroundColor: colors.successSoft, borderRadius: 999, marginBottom: 9, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ color: colors.success, fontSize: 12, fontWeight: "900" }}>{scoreLabel}</Text></View>
            </View>
            <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 9, overflow: "hidden" }}>
              <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: "100%", width: `${trust.overall}%` }} />
            </View>
            <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>{translateCopy("Puan, işlem geçmişin arttıkça otomatik güncellenir.", language)}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <TrustMiniStat icon="store-check-outline" label={translateCopy("Satıcı Güven Skoru", language)} value={`%${trust.seller.score}`} tag={translateCopy(scoreTag(trust.seller.score), language)} />
            <TrustMiniStat icon="account-check-outline" label={translateCopy("Ortak Güven Skoru", language)} value={`%${trust.partner.score}`} tag={translateCopy(scoreTag(trust.partner.score), language)} />
            <TrustMiniStat icon="file-alert-outline" label={translateCopy("Açık Kayıtlar", language)} value={`${openReports.length}`} sub={translateCopy("İnceleme aşamasında", language)} />
            <TrustMiniStat icon="check-decagram-outline" label={translateCopy("Çözülen Raporlar", language)} value={`${resolvedCount}`} sub={translateCopy("Tüm zamanlar", language)} />
          </View>
          <View style={{ borderLeftColor: colors.line, borderLeftWidth: 1, gap: 8, paddingLeft: 18 }}>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Doğrulama Rozetleri", language)}</Text>
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
            <Link href="/profile-edit" asChild><Pressable><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Tüm doğrulamalar →", language)}</Text></Pressable></Link>
          </View>
        </View>

        {/* 3 columns */}
        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1.5, gap: 16, minWidth: 0 }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 18 }}>
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Güven Skoru Dağılımı", language)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{translateCopy("Puanınız, aşağıdaki faktörlerin ağırlıklı ortalaması ile hesaplanır.", language)}</Text>
              </View>
              {distribution.map((d) => (
                <View key={d.label} style={{ gap: 6 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                    <MaterialCommunityIcons name={d.icon} size={16} color={colors.primary} />
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{d.label}</Text>
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>%{d.value}</Text>
                    <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800" }}>{translateCopy("Ağırlık", language)} %{d.weight}</Text></View>
                  </View>
                  <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 7, overflow: "hidden" }}>
                    <View style={{ backgroundColor: d.value >= 90 ? colors.success : d.value >= 60 ? colors.primary : colors.warning, borderRadius: 999, height: "100%", width: `${d.value}%` }} />
                  </View>
                </View>
              ))}
              <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{translateCopy("Skorlar 0-100 arasıdır. Ağırlıklandırma politikası Ortaksat tarafından belirlenir.", language)}</Text>
            </View>

            {/* Complaints table */}
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
              <View style={{ gap: 10, padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Şikayet ve İnceleme Kayıtları", language)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{translateCopy("Şikayetleriniz ve hakkınızda açılan kayıtların durumunu buradan takip edebilirsiniz.", language)}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {([["all", translateCopy("Tümü", language)], ["open", translateCopy("Açık", language)], ["resolved", translateCopy("Sonuçlanan", language)]] as Array<[TrustFilter, string]>).map(([k, lbl]) => {
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
                <Text style={{ color: colors.muted, flex: 1.4, fontSize: 11, fontWeight: "800" }}>{translateCopy("KAYIT ID", language)}</Text>
                <Text style={{ color: colors.muted, flex: 1.5, fontSize: 11, fontWeight: "800" }}>{translateCopy("TÜR", language)}</Text>
                <Text style={{ color: colors.muted, flex: 1.6, fontSize: 11, fontWeight: "800" }}>{translateCopy("İLGİLİ İLAN", language)}</Text>
                <Text style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "800" }}>{translateCopy("DURUM", language)}</Text>
                <Text style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "800", textAlign: "right" }}>{translateCopy("İŞLEM", language)}</Text>
              </View>
              {rows.length === 0 ? <View style={{ padding: 18 }}><EmptyState title={translateCopy("Kayıt yok", language)} body={translateCopy("Bu filtrede kayıt bulunmuyor.", language)} /></View> : null}
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
                    <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Görüntüle", language)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Signals */}
          <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Güven Sinyalleri", language)}</Text>
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
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Güven Puanı Nasıl Hesaplanır?", language)}</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Güven skorunuz, platformda sergilediğiniz davranışların bir ortalamasıdır. Aşağıdaki kriterler esas alınır:", language)}</Text>
              {calcRules.map((c) => (
                <View key={c} style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
                  <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: 6, marginTop: 6, width: 6 }} />
                  <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{c}</Text>
                </View>
              ))}
              <Link href="/nasil-calisir" asChild><Pressable><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Hesaplama metodolojisini incele →", language)}</Text></Pressable></Link>
            </View>

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 9, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Güvende Kalın", language)}</Text>
              {safetyTips.map((s) => (
                <View key={s} style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
                  <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.success} style={{ marginTop: 1 }} />
                  <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{s}</Text>
                </View>
              ))}
              <Link href="/guvenli-alisveris" asChild><Pressable><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Güvenli alışveriş rehberi →", language)}</Text></Pressable></Link>
            </View>

            <View style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Dolandırıcılığı Önleyin", language)}</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy('Şüpheli bir durumla karşılaşırsan ilan veya profildeki "Bildir" ile kayda geçir. Ekibimiz kayıt üzerinden inceleme yapar.', language)}</Text>
              <Link href="/iletisim" asChild>
                <Pressable style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 12 }}>
                  <MaterialCommunityIcons name="flag-variant-outline" size={17} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Şikayet / Bildirim Oluştur", language)}</Text>
                </Pressable>
              </Link>
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
          <Metric label={translateCopy("Genel güven", language)} value={`%${trust.overall}`} />
          <Metric label={translateCopy("Açık kayıt", language)} value={`${openReports.length}`} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <StatusPill label={currentUser.verifiedPhone ? translateCopy("Telefon doğrulandı", language) : translateCopy("Telefon bekliyor", language)} tone={currentUser.verifiedPhone ? "success" : "warning"} />
          <StatusPill label={currentUser.verifiedIdentity ? translateCopy("Kimlik doğrulandı", language) : translateCopy("Kimlik bekliyor", language)} tone={currentUser.verifiedIdentity ? "success" : "info"} />
          <StatusPill label={currentUser.verifiedInstagram ? translateCopy("Instagram doğrulandı", language) : translateCopy("Instagram bekliyor", language)} tone={currentUser.verifiedInstagram ? "success" : "info"} />
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
        <SectionTitle title={translateCopy("Puan mantığı", language)} />
        <Rule icon="cellphone-check" text="Telefon doğrulama +10, kimlik doğrulama +20, Instagram doğrulama +10 puan etkisi verir." />
        <Rule icon="cash-check" text="Başarılı satış ve zamanında komisyon ödeme satıcı güvenini artırır." />
        <Rule icon="account-convert" text="Gerçek müşteri getiren, satışa dönen talep oluşturan ortakların ortak güveni yükselir." />
        <Rule icon="clock-alert-outline" text="Geç ödeme, anlaşmazlık, yüksek iade, düşük talep kalitesi ve şikayet puanı düşürür." />
        <Rule icon="message-reply-text" text="Yanıt oranı hem satıcı hem ortak tarafında güven sinyali olarak kullanılır." />
      </Card>

      <SectionTitle title={isAdmin ? translateCopy("Moderasyon kuyruğu", language) : translateCopy("Güven kayıtlarım", language)} action={`${visibleReports.length}`} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TrustFilterChip active={filter === "all"} label="Tümü" onPress={() => setFilter("all")} />
        <TrustFilterChip active={filter === "open"} label="Açık" onPress={() => setFilter("open")} />
        <TrustFilterChip active={filter === "resolved"} label="Kapanan" onPress={() => setFilter("resolved")} />
      </View>

      {visibleReports.length === 0 ? <EmptyState title={translateCopy("Kayıt yok", language)} body={translateCopy("Bu filtrede bildirilen ilan, kullanıcı veya güven incelemesi bulunmuyor.", language)} /> : null}

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
                  {report.reason} · {report.details || translateCopy("Detay yok", language)}
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
                  <PrimaryButton tone="secondary" onPress={() => void setStatus(report, "reviewing")}>{translateCopy("İncele", language)}</PrimaryButton>
                </View>
                <View style={{ flexBasis: "31%", flexGrow: 1 }}>
                  <PrimaryButton tone="soft" onPress={() => void setStatus(report, "resolved")}>{translateCopy("Çöz", language)}</PrimaryButton>
                </View>
                <View style={{ flexBasis: "31%", flexGrow: 1 }}>
                  <PrimaryButton tone="secondary" onPress={() => void setStatus(report, "rejected")}>{translateCopy("Reddet", language)}</PrimaryButton>
                </View>
              </View>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

function scoreTag(score: number): string {
  return score >= 70 ? "Yüksek" : score >= 50 ? "Orta" : "Geliştirilmeli";
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
