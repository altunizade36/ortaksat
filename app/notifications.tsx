import { MaterialCommunityIcons } from "@/components/icons";
import { Link, useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { AuthRequired } from "@/components/auth-gate";
import { colors } from "@/components/colors";
import { Card, EmptyState, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useNativeRefresh } from "@/lib/use-native-refresh";
import { useIsWideWeb, useMounted } from "@/lib/layout";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import type { NotificationMeta, NotificationType } from "@/lib/types";
import { useStore } from "@/lib/use-store";

const typeIcons: Record<NotificationType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  application: "account-plus",
  lead: "account-clock",
  sale: "cart-check",
  message: "message-text",
  payout: "cash-check",
  review: "star",
  price_drop: "tag-arrow-down",
  sold: "cart-remove",
  follow: "storefront-plus-outline",
  system: "bullhorn-outline"
};

const typeMeta: Record<NotificationType, { label: string; tint: string; color: string }> = {
  application: { label: "Başvuru", tint: colors.infoSoft, color: colors.info },
  lead: { label: "Talep", tint: colors.violetSoft, color: colors.violet },
  sale: { label: "Satış", tint: colors.successSoft, color: colors.success },
  message: { label: "Mesaj", tint: colors.primarySoft, color: colors.primaryDark },
  payout: { label: "Komisyon", tint: colors.goldSoft, color: colors.gold },
  review: { label: "Değerlendirme", tint: colors.goldSoft, color: colors.gold },
  price_drop: { label: "Fiyat düştü", tint: colors.successSoft, color: colors.success },
  sold: { label: "Satıldı", tint: colors.accentSoft, color: colors.accent },
  follow: { label: "Takip", tint: colors.primarySoft, color: colors.primaryDark },
  system: { label: "Duyuru", tint: colors.accentSoft, color: colors.accent }
};

type DeskNotif = { id: string; type: NotificationType; title: string; body: string; createdAt: string; group: "Bugün" | "Bu hafta" | "Daha önce"; real: boolean; metadata?: NotificationMeta };


export default function NotificationsScreen() {
  const { language } = useLanguage();
  const { isAuthenticated } = useStore();
  const mounted = useMounted();
  if (!mounted) return <ScreenSkeleton />; // hidrasyon-gate (#418)
  if (!isAuthenticated) {
    return <AuthRequired title={translateCopy("Bildirimlerin için giriş yap", language)} body={translateCopy("Başvuru, satış ve mesaj bildirimlerin hesabına özeldir; görmek için giriş yapman gerekir.", language)} />;
  }
  return <NotificationsScreenInner />;
}

function NotificationsScreenInner() {
  const { language } = useLanguage();
  const { conversations, currentUser, listings, markNotificationRead, notifications, partnerships, refreshUserData, savePreferences, setEmailNotifications } = useStore();
  const { refreshing, onRefresh } = useNativeRefresh(refreshUserData);
  const router = useRouter();
  const isWideWeb = useIsWideWeb();

  // Bildirime tıklayınca gidilecek hedef — ROL DUYARLI:
  //  • İlanın sahibi (satıcı) isem → satıcı panelinde ilgili ilanı aç (?focus=)
  //  • Ortaklığın ortağı isem → ortak panelinde ilgili ortaklığı öne al (?focus=)
  //  • Değilsem → ilan detayına git. Metadata yoksa null (sadece okundu işaretlenir).
  const hrefForMeta = (meta?: NotificationMeta, type?: NotificationType): Href | null => {
    // Mesaj bildirimi → doğrudan ilgili sohbeti aç (en aksiyon-odaklı bildirim).
    if (type === "message") {
      const convo = conversations
        .filter((c) => c.participantIds.includes(currentUser.id) && (!meta?.listingId || c.listingId === meta.listingId))
        .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""))[0];
      if (convo) return { pathname: "/chat/[id]", params: { id: convo.id } } as unknown as Href;
    }
    if (!meta?.listingId) return null;
    const listing = listings.find((l) => l.id === meta.listingId);
    const partnership = meta.partnershipId ? partnerships.find((p) => p.id === meta.partnershipId) : undefined;
    if (listing && listing.ownerId === currentUser.id) return `/(tabs)/seller?focus=${meta.listingId}` as Href;
    if (partnership && partnership.partnerId === currentUser.id) return `/(tabs)/partner?focus=${meta.listingId}` as Href;
    return { pathname: "/listing/[id]", params: { id: meta.listingId } } as unknown as Href;
  };
  const myNotifications = notifications.filter((notification) => notification.userId === currentUser.id);
  const unreadCount = myNotifications.filter((notification) => !notification.read).length;

  const [tab, setTab] = useState<"all" | "unread" | NotificationType>("all");
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const p0 = currentUser.preferences ?? {};
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ push: p0.notif_push !== false, email: currentUser.emailNotifications !== false, sms: p0.notif_sms === true, whatsapp: p0.notif_whatsapp !== false });
  // "email" gerçek bir sunucu tercihidir (profiles.email_notifications → e-posta
  // tetikleyicisi onu okur); diğerleri JSONB preferences'ta tutulur.
  const togglePref = (key: string) => setPrefs((s) => {
    const v = !s[key];
    if (key === "email") void setEmailNotifications(v);
    else void savePreferences({ [`notif_${key}`]: v });
    return { ...s, [key]: v };
  });
  // Tür bazında sustur — kalıcı tercih; susturulan tür listeden gizlenir.
  const [mutes, setMutes] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    (Object.keys(typeMeta) as NotificationType[]).forEach((tp) => { m[tp] = (p0 as Record<string, boolean>)[`notif_mute_${tp}`] === true; });
    return m;
  });
  const toggleMute = (tp: NotificationType) => setMutes((s) => { const v = !s[tp]; void savePreferences({ [`notif_mute_${tp}`]: v }); return { ...s, [tp]: v }; });
  const mutedCount = Object.values(mutes).filter(Boolean).length;
  const visibleNotifications = myNotifications.filter((n) => !mutes[n.type]);
  // Kanal tercihleri (uygulama-içi/e-posta aktif; SMS/WhatsApp yakında) — hem
  // masaüstü hem mobil kullanır (eskiden yalnız masaüstünde render ediliyordu).
  const prefRows: Array<{ key: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; sub: string; available: boolean }> = [
    { key: "push", icon: "bell-ring-outline", label: "Uygulama içi bildirim", sub: "Talep, satış, mesaj, ortaklık — anlık", available: true },
    { key: "email", icon: "email-outline", label: "E-posta bildirimleri", sub: "Talep, satış, mesaj ve ortaklık olaylarında e-posta", available: true },
    { key: "sms", icon: "message-badge-outline", label: "SMS", sub: "Yakında", available: false },
    { key: "whatsapp", icon: "whatsapp", label: "WhatsApp", sub: "Yakında", available: false }
  ];

  if (isWideWeb) {
    const dateGroup = (createdAt: string): DeskNotif["group"] => {
      const t = Date.parse(createdAt);
      if (Number.isNaN(t)) return "Daha önce";
      const days = (Date.now() - t) / 86400000;
      if (days < 1) return "Bugün";
      if (days < 7) return "Bu hafta";
      return "Daha önce";
    };
    const realDesk: DeskNotif[] = myNotifications.filter((n) => !mutes[n.type]).map((n) => ({
      id: n.id, type: n.type, title: n.title, body: n.body, createdAt: n.createdAt, group: dateGroup(n.createdAt), real: true, metadata: n.metadata
    }));
    // YALNIZCA gerçek bildirimler — sahte/örnek veri yok (eski SAMPLE dizisi tamamen kaldırıldı,
    // önizlemede bile). Bildirim yoksa gerçek boş-durum gösterilir.
    const all: DeskNotif[] = realDesk;
    const isRead = (n: DeskNotif) => readMap[n.id] === true || (n.real && !!notifications.find((x) => x.id === n.id)?.read);
    const totalUnread = all.filter((n) => !isRead(n)).length;

    const counts: Record<NotificationType, number> = { application: 0, lead: 0, sale: 0, message: 0, payout: 0, review: 0, price_drop: 0, sold: 0, follow: 0, system: 0 };
    all.forEach((n) => { counts[n.type] += 1; });

    const tabs: Array<{ key: typeof tab; label: string; count: number }> = [
      { key: "all", label: translateCopy("Tümü", language), count: all.length },
      { key: "unread", label: translateCopy("Okunmamış", language), count: totalUnread },
      { key: "application", label: translateCopy("Başvurular", language), count: counts.application },
      { key: "lead", label: translateCopy("Talepler", language), count: counts.lead },
      { key: "sale", label: translateCopy("Satışlar", language), count: counts.sale },
      { key: "payout", label: translateCopy("Komisyon", language), count: counts.payout },
      { key: "message", label: translateCopy("Mesajlar", language), count: counts.message }
    ];

    const filtered = all.filter((n) => tab === "all" ? true : tab === "unread" ? !isRead(n) : n.type === tab);
    const groups: Array<DeskNotif["group"]> = ["Bugün", "Bu hafta", "Daha önce"];

    const markRead = (n: DeskNotif) => {
      setReadMap((s) => ({ ...s, [n.id]: true }));
      if (n.real) markNotificationRead(n.id);
    };
    // Tıklayınca okundu işaretle + rol-duyarlı hedefe git (satıcı/ortak/ilan).
    const openDesk = (n: DeskNotif) => {
      markRead(n);
      const href = hrefForMeta(n.metadata, n.type);
      if (href) router.push(href);
    };
    const markAll = () => {
      const next: Record<string, boolean> = {};
      all.forEach((n) => { next[n.id] = true; });
      setReadMap((s) => ({ ...s, ...next }));
      myNotifications.filter((n) => !n.read).forEach((n) => markNotificationRead(n.id));
    };

    // Dürüst kanal durumu: yalnızca uygulama içi bildirim gerçek zamanlı çalışır.
    // E-posta yalnızca hesap/güvenlik (doğrulama, şifre) için kullanılır; olay-bazlı
    // e-posta/SMS/WhatsApp bildirimi henüz yok → "Yakında" olarak dürüstçe gösterilir.

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        <View style={{ alignSelf: "center", gap: 16, maxWidth: 1280, paddingHorizontal: 20, paddingTop: 16, width: "100%" }}>
        <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>{translateCopy("Bildirimler", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>{translateCopy("Başvuru, talep, satış ve komisyon hareketlerinin tümünü buradan takip et.", language)}</Text>
          </View>
          <Pressable onPress={markAll} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 14, paddingVertical: 9 })}>
            <MaterialCommunityIcons name="check-all" size={17} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Tümünü okundu işaretle", language)}</Text>
          </Pressable>
          <Link href="/profile-edit" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Ayarlar", language)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, height: 38, justifyContent: "center", width: 40 })}>
              <MaterialCommunityIcons name="cog-outline" size={19} color={colors.muted} />
            </Pressable>
          </Link>
        </View>

        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 13, paddingVertical: 8 }}>
                <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{t.label}</Text>
                <Text style={{ color: on ? "rgba(255,255,255,0.85)" : colors.muted, fontSize: 11, fontWeight: "800" }}>({t.count})</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
          <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
            {filtered.length === 0 ? (
              <EmptyState title={translateCopy("Bildirim yok", language)} body={translateCopy("Bu filtreye uygun bildirim bulunmuyor. Yeni hareketler burada görünecek.", language)} mascot="mobile" />
            ) : null}
            {groups.map((g) => {
              const items = filtered.filter((n) => n.group === g);
              if (items.length === 0) return null;
              return (
                <View key={g} style={{ gap: 10 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" }}>{translateCopy(g, language)}</Text>
                  <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
                    {items.map((n, idx) => {
                      const read = isRead(n);
                      const meta = typeMeta[n.type] ?? { label: translateCopy("Bildirim", language), tint: colors.infoSoft, color: colors.info };
                      const hasLink = Boolean(n.metadata?.listingId) || n.type === "message";
                      return (
                        <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={hasLink ? `${n.title} — ${translateCopy("ilana git", language)}` : n.title} onPress={() => openDesk(n)} style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : read ? colors.surface : colors.primarySoft + "55", borderTopColor: colors.line, borderTopWidth: idx === 0 ? 0 : 1, flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 14 })}>
                          <View style={{ alignItems: "center", backgroundColor: meta.tint, borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
                            <MaterialCommunityIcons name={typeIcons[n.type] ?? "bell-outline"} size={22} color={meta.color} />
                          </View>
                          <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                              <View style={{ backgroundColor: meta.tint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                                <Text style={{ color: meta.color, fontSize: 10.5, fontWeight: "900" }}>{translateCopy(meta.label, language)}</Text>
                              </View>
                              <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 14.5, fontWeight: "900" }}>{translateCopy(n.title, language)}</Text>
                              {!read ? <View style={{ backgroundColor: colors.accent, borderRadius: 999, height: 9, width: 9 }} /> : null}
                            </View>
                            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500", lineHeight: 19 }}>{translateCopy(n.body, language)}</Text>
                            <View style={{ alignItems: "center", flexDirection: "row", gap: 10, marginTop: 2 }}>
                              <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "600" }}>{n.createdAt}</Text>
                              <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{hasLink ? translateCopy(n.type === "message" ? "Mesaja git →" : "İlana git →", language) : read ? translateCopy("Görüntülendi", language) : translateCopy("Okundu işaretle", language)}</Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Sidebar */}
          <View style={{ gap: 16, width: 300 }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Özet", language)}</Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 12, flex: 1, paddingVertical: 12 }}>
                  <Text style={{ color: colors.accent, fontSize: 22, fontWeight: "900" }}>{totalUnread}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{translateCopy("Okunmamış", language)}</Text>
                </View>
                <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 12, flex: 1, paddingVertical: 12 }}>
                  <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{all.length}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{translateCopy("Toplam", language)}</Text>
                </View>
              </View>
              {(Object.keys(typeMeta) as NotificationType[]).map((t) => {
                const meta = typeMeta[t];
                return (
                  <Pressable key={t} onPress={() => setTab(t)} style={{ alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 4 }}>
                    <View style={{ alignItems: "center", backgroundColor: meta.tint, borderRadius: 8, height: 30, justifyContent: "center", width: 30 }}>
                      <MaterialCommunityIcons name={typeIcons[t]} size={16} color={meta.color} />
                    </View>
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{translateCopy(meta.label, language)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{counts[t]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Bildirim tercihleri", language)}</Text>
                <Link href="/profile-edit" asChild>
                  <Pressable><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Tümü", language)}</Text></Pressable>
                </Link>
              </View>
              {prefRows.map((p) => (
                <View key={p.key} style={{ alignItems: "center", flexDirection: "row", gap: 10, opacity: p.available ? 1 : 0.7 }}>
                  <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 8, height: 34, justifyContent: "center", width: 34 }}>
                    <MaterialCommunityIcons name={p.icon} size={18} color={colors.muted} />
                  </View>
                  <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy(p.label, language)}</Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{translateCopy(p.sub, language)}</Text>
                  </View>
                  {p.available ? (
                    <Pressable onPress={() => togglePref(p.key)} style={{ alignItems: prefs[p.key] ? "flex-end" : "flex-start", backgroundColor: prefs[p.key] ? colors.primary : colors.line, borderRadius: 999, height: 22, justifyContent: "center", paddingHorizontal: 2, width: 40 }}>
                      <View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 18, width: 18 }} />
                    </Pressable>
                  ) : (
                    <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 }}>
                      <Text style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "800" }}>{translateCopy("Yakında", language)}</Text>
                    </View>
                  )}
                </View>
              ))}

              <View style={{ backgroundColor: colors.line, height: 1, marginVertical: 4 }} />
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{translateCopy("Bildirim türleri", language)}</Text>
              {(Object.keys(typeMeta) as NotificationType[]).map((tp) => (
                <View key={tp} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                  <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 8, height: 34, justifyContent: "center", width: 34 }}>
                    <MaterialCommunityIcons name={typeIcons[tp]} size={18} color={mutes[tp] ? colors.subtle : typeMeta[tp].color} />
                  </View>
                  <Text style={{ color: mutes[tp] ? colors.muted : colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{translateCopy(typeMeta[tp].label, language)}</Text>
                  <Pressable accessibilityRole="switch" accessibilityState={{ checked: !mutes[tp] }} accessibilityLabel={`${translateCopy(typeMeta[tp].label, language)} ${translateCopy("bildirimleri", language)}`} onPress={() => toggleMute(tp)} style={{ alignItems: mutes[tp] ? "flex-start" : "flex-end", backgroundColor: mutes[tp] ? colors.line : colors.primary, borderRadius: 999, height: 22, justifyContent: "center", paddingHorizontal: 2, width: 40 }}>
                    <View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 18, width: 18 }} />
                  </Pressable>
                </View>
              ))}
            </View>

            <View style={{ backgroundColor: colors.primaryDark, borderRadius: 16, gap: 8, padding: 18 }}>
              <MaterialCommunityIcons name="handshake" size={26} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{translateCopy("Daha çok kazan", language)}</Text>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Yüksek komisyonlu ilanları keşfet, paylaş ve her satıştan kazan.", language)}</Text>
              <Link href="/partner" asChild>
                <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, marginTop: 4, paddingVertical: 10 }}>
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Fırsatları gör", language)}</Text>
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
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, maxWidth: 920, marginHorizontal: "auto", padding: 12, paddingBottom: 96, width: "100%" }} refreshControl={Platform.OS === "web" ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
      <Card>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.infoSoft, borderRadius: 8, height: 50, justifyContent: "center", width: 50 }}>
            <MaterialCommunityIcons name="bell-ring" size={26} color={colors.info} />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>
              {translateCopy("Bildirimler", language)}
            </Text>
            <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
              {translateCopy("Ortak başvurusu, müşteri talebi, satış ve komisyon hareketlerini burada takip et.", language)}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
          <StatusPill label={`${unreadCount} ${translateCopy("okunmamış", language)}`} tone={unreadCount ? "warning" : "success"} />
          <StatusPill label={`${myNotifications.length} ${translateCopy("toplam", language)}`} />
        </View>
      </Card>

      {/* Bildirim kanalları (mobil) — push/e-posta aç-kapa; eskiden yalnız masaüstündeydi. */}
      <Card>
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900", marginBottom: 4 }}>{translateCopy("Bildirim kanalları", language)}</Text>
        {prefRows.map((p) => (
          <View key={p.key} style={{ alignItems: "center", flexDirection: "row", gap: 10, opacity: p.available ? 1 : 0.7, paddingVertical: 8 }}>
            <MaterialCommunityIcons name={p.icon} size={18} color={colors.muted} />
            <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
              <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>{translateCopy(p.label, language)}</Text>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{translateCopy(p.sub, language)}</Text>
            </View>
            {p.available ? (
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: !!prefs[p.key] }} onPress={() => togglePref(p.key)} style={{ alignItems: prefs[p.key] ? "flex-end" : "flex-start", backgroundColor: prefs[p.key] ? colors.primary : colors.line, borderRadius: 999, height: 22, justifyContent: "center", paddingHorizontal: 2, width: 40 }}>
                <View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 18, width: 18 }} />
              </Pressable>
            ) : (
              <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Text style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "800" }}>{translateCopy("Yakında", language)}</Text>
              </View>
            )}
          </View>
        ))}
      </Card>

      <SectionTitle title={translateCopy("Son bildirimler", language)} action={`${visibleNotifications.length}`} />

      {/* Tür bazında sustur */}
      <Card>
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900", marginBottom: 4 }}>{translateCopy("Bildirim türleri", language)}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>{translateCopy("Kapattığın tür bildirim listende görünmez.", language)}</Text>
        {(Object.keys(typeMeta) as NotificationType[]).map((tp) => (
          <Pressable key={tp} onPress={() => toggleMute(tp)} style={{ alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 8 }}>
            <MaterialCommunityIcons name={typeIcons[tp]} size={18} color={mutes[tp] ? colors.subtle : typeMeta[tp].color} />
            <Text style={{ color: mutes[tp] ? colors.muted : colors.ink, flex: 1, fontSize: 13.5, fontWeight: "700" }}>{translateCopy(typeMeta[tp].label, language)}</Text>
            <View style={{ alignItems: mutes[tp] ? "flex-start" : "flex-end", backgroundColor: mutes[tp] ? colors.line : colors.primary, borderRadius: 999, height: 22, justifyContent: "center", paddingHorizontal: 2, width: 40 }}>
              <View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 18, width: 18 }} />
            </View>
          </Pressable>
        ))}
      </Card>

      {visibleNotifications.length === 0 ? <EmptyState title={mutedCount > 0 ? translateCopy("Görünür bildirim yok", language) : translateCopy("Bildirim yok", language)} body={mutedCount > 0 ? translateCopy("Bazı türleri kapattın. Görmek için yukarıdan aç.", language) : translateCopy("Yeni ortaklık, talep, satış ve ödeme hareketleri burada görünecek.", language)} action={mutedCount > 0 ? undefined : { label: "Ürünleri keşfet", href: "/explore", icon: "compass-outline" }} mascot="mobile" /> : null}

      {visibleNotifications.map((notification) => {
        const href = hrefForMeta(notification.metadata, notification.type);
        const openMobile = () => {
          if (!notification.read) markNotificationRead(notification.id);
          if (href) router.push(href);
        };
        return (
        <Pressable key={notification.id} accessibilityRole="button" accessibilityLabel={href ? `${notification.title} — ${translateCopy("aç", language)}` : notification.title} onPress={openMobile}>
        <Card>
          <View style={{ flexDirection: "row", gap: 11 }}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: notification.read ? colors.surfaceAlt : colors.primarySoft,
                borderRadius: 8,
                height: 42,
                justifyContent: "center",
                width: 42
              }}
            >
              <MaterialCommunityIcons name={typeIcons[notification.type]} size={22} color={notification.read ? colors.muted : colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900", lineHeight: 20 }}>
                  {translateCopy(notification.title, language)}
                </Text>
                {!notification.read ? <StatusPill label={translateCopy("Yeni", language)} tone="warning" /> : null}
              </View>
              <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                {translateCopy(notification.body, language)}
              </Text>
              <Text selectable style={{ color: colors.subtle, fontSize: 12 }}>
                {notification.createdAt}
              </Text>
            </View>
          </View>
          {!notification.read ? (
            <PrimaryButton tone="secondary" icon="check-circle-outline" onPress={() => markNotificationRead(notification.id)}>
              {translateCopy("Okundu İşaretle", language)}
            </PrimaryButton>
          ) : null}
        </Card>
        </Pressable>
        );
      })}
    </ScrollView>
  );
}
