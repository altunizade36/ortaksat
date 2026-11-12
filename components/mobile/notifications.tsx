import { HorizontalScroll } from "@/components/horizontal-scroll";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { NotificationDetail } from "@/components/notification-detail";
import { showToast } from "@/lib/toast";
import { notificationTarget } from "@/lib/notification-target";
import { useStore } from "@/lib/use-store";
import { useForegroundRefresh } from "@/lib/use-foreground-refresh";
import { notificationDateTime, notificationDayBucket, notificationMs } from "@/lib/notification-time";
import type { Notification, NotificationType } from "@/lib/types";
import { MobileBottomNav, MobileButton, MobileCard, MobileChip, MobileScreen, IconButton, mobile, ms, type MobileIcon } from "./ui";
const styles: Record<NotificationType, { icon: MobileIcon; bg: string; color: string }> = {
  application: { icon: "handshake", bg: mobile.tealSoft, color: mobile.teal }, lead: { icon: "account-group", bg: "#DBE4F4", color: mobile.teal }, sale: { icon: "currency-usd", bg: "#D5E0F6", color: mobile.teal }, message: { icon: "chat", bg: "#D9ECFF", color: "#1186F2" }, payout: { icon: "currency-usd", bg: "#D5E0F6", color: mobile.teal }, review: { icon: "star", bg: "#FFF0BE", color: "#F7B800" }, price_drop: { icon: "star", bg: "#FFF0BE", color: "#F7B800" }, sold: { icon: "tag-check", bg: "#E4F5E9", color: "#04A367" }, follow: { icon: "account-plus", bg: mobile.tealSoft, color: mobile.teal }, offer: { icon: "handshake", bg: "#E7DEFD", color: "#8158DE" }, question: { icon: "comment-question", bg: "#D9ECFF", color: "#1186F2" }, system: { icon: "bullhorn", bg: "#E9EDF2", color: "#55647B" },
};

const groups = ["Tümü", "Mesajlar", "Ortaklık", "İlanlar", "Sistem"];
const belongs = (n: Notification, filter: string) => filter === "Tümü" || filter === "Mesajlar" && ["message", "question"].includes(n.type) || filter === "Ortaklık" && ["application", "lead", "offer", "payout", "sale"].includes(n.type) || filter === "İlanlar" && ["price_drop", "sold", "review", "follow"].includes(n.type) || filter === "Sistem" && n.type === "system";
// createdAt iki biçimde gelir (tam ISO / realtime'ın saat dilimsiz "YYYY-MM-DD HH:MM" UTC damgası).
// `new Date(raw)` ikincisini Hermes'te ayrıştıramıyordu → "Invalid Date" + yanlış grup.
function dayGroup(raw: string) {
  const bucket = notificationDayBucket(raw);
  return bucket === "today" ? "Bugün" : bucket === "yesterday" ? "Dün" : bucket === "week" ? "Bu Hafta" : "Daha Önce";
}
export function MobileNotifications() {
  const store = useStore(), router = useRouter();
  useForegroundRefresh(() => store.refreshNotifications().catch(() => {}));
  const [filter, setFilter] = useState(groups[0]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [detail, setDetail] = useState<Notification | null>(null);
  const [readingAll, setReadingAll] = useState(false);
  const allLock = useRef(false);
  const refreshLock = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const items = useMemo(() => store.notifications.filter(n => n.userId === store.currentUser.id).sort((a,b) => notificationMs(b.createdAt) - notificationMs(a.createdAt)), [store.notifications, store.currentUser.id]);
  const unread = items.filter(n => !n.read).length;
  const selected = items.filter(n => belongs(n, filter) && (!unreadOnly || !n.read));
  function open(n: Notification) {
    if (!n.read) void store.markNotificationRead(n.id).then(ok => { if (!ok) showToast("Okundu bilgisi kaydedilemedi. Tekrar deneyebilirsin."); });
    const target = notificationTarget(n, { userId: store.currentUser.id, listings: store.listings, partnerships: store.partnerships, conversations: store.conversations });
    if (target) router.push(target.href as never); else setDetail(n);
  }
  async function markAll() {
    if (allLock.current) return;
    allLock.current = true; setReadingAll(true);
    try {
      // TEK istek (eskiden bildirim başına ayrı istek atılıyordu). Başarısızsa store iyimser durumu geri alır.
      const ok = await store.markAllNotificationsRead().catch(() => false);
      if (!ok) showToast("Bildirimler okundu işaretlenemedi. Tekrar deneyebilirsin.");
    } finally { allLock.current = false; setReadingAll(false); }
  }
  return <><MobileScreen title="Bildirimler" right={<IconButton name="cog-outline" label="Bildirim ayarları" onPress={() => router.push("/notification-settings")} />} bottom={<MobileBottomNav />}>
    {!store.authReady ? <Text style={ms.muted}>Hesabın yükleniyor…</Text> : !store.isAuthenticated ? <MobileCard><Text style={ms.section}>Bildirimlerin için giriş yap</Text><Text style={ms.muted}>Mesajlarını, ilan güncellemelerini ve ortaklık taleplerini tek yerden takip et.</Text><MobileButton onPress={() => router.push({ pathname: "/auth", params: { redirect: "/notifications" } })}>Giriş Yap</MobileButton></MobileCard> : <>
      <MobileCard style={{ backgroundColor: "#EAEFFA" }}><Text style={ms.section}>Gelişmelerin burada</Text><Text style={ms.muted}>{items.length} bildirim · {unread} okunmamış</Text><View style={ms.wrap}><MobileChip label="Sadece okunmamış" selected={unreadOnly} onPress={() => setUnreadOnly(v => !v)} icon="email-open-outline" />{(unread > 0 || readingAll) && <MobileButton secondary disabled={readingAll} onPress={() => void markAll()} icon="check-all">{readingAll ? "İşaretleniyor…" : "Tümünü okundu işaretle"}</MobileButton>}</View></MobileCard>
      <HorizontalScroll  showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 12 }}>{groups.map(g => <MobileChip key={g} label={`${g} (${items.filter(n => belongs(n,g)).length})`} selected={filter === g} onPress={() => setFilter(g)} />)}</HorizontalScroll>
      {selected.map((n,i) => { const style = styles[n.type] || styles.system, listing = n.metadata?.listingId ? store.findListing(n.metadata.listingId) : undefined; const group = dayGroup(n.createdAt); const target = notificationTarget(n, { userId: store.currentUser.id, listings: store.listings, partnerships: store.partnerships, conversations: store.conversations }); return <View key={n.id}>{(i === 0 || group !== dayGroup(selected[i-1].createdAt)) && <Text style={[ms.section, { marginVertical: 12 }]}>{group}</Text>}<Pressable accessibilityRole="button" accessibilityLabel={n.title} accessibilityHint={target?.label || "Bildirim ayrıntılarını aç"} onPress={() => open(n)} style={{ flexDirection: "row", gap: 10, padding: 13, marginBottom: 9, borderRadius: 14, borderWidth: 1, borderColor: n.read ? mobile.line : "#BFCDEC", backgroundColor: n.read ? "white" : "#F0F3FC", alignItems: "flex-start" }}><View style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: style.bg, alignItems: "center", justifyContent: "center" }}><Icon name={style.icon} size={24} color={style.color} /></View><View style={{ flex: 1, gap: 6, minWidth: 0 }}><Text style={{ color: mobile.ink, fontWeight: n.read ? "600" : "800", fontSize: 14, lineHeight: 20 }}>{n.title}</Text><Text numberOfLines={3} style={{ color: mobile.muted, fontSize: 12, lineHeight: 18 }}>{n.body}</Text><Text style={{ color: mobile.teal, fontSize: 11 }}>{target?.label || "Ayrıntıları oku"} →</Text><Text style={{ fontSize: 10, color: mobile.muted }}>{notificationDateTime(n.createdAt)}</Text></View>{listing && <SafeRemoteImage uri={listing.image} style={{ width: 42, height: 42, borderRadius: 8 }} />}{!n.read && <View style={{ width: 7, height: 7, backgroundColor: mobile.teal, borderRadius: 4, marginTop: 5 }} />}</Pressable></View>; })}
      {!selected.length && <MobileCard><Icon name="bell-check-outline" size={38} color={mobile.teal} /><Text style={ms.section}>{!store.accountLoaded ? "Bildirimler yükleniyor…" : items.length ? "Bu görünümde bildirim yok" : "Henüz bildirim yok"}</Text><Text style={ms.muted}>{unreadOnly ? "Seçtiğin kategoride okunmamış bildirim bulunmuyor." : "Yeni mesajların ve ortaklık gelişmeleri burada görünecek."}</Text>{(unreadOnly || filter !== "Tümü") && <MobileButton secondary onPress={() => { setUnreadOnly(false); setFilter("Tümü"); }}>Tüm Bildirimleri Göster</MobileButton>}</MobileCard>}
      {refreshError && <Text accessibilityRole="alert" style={ms.error}>{refreshError}</Text>}
      <MobileButton secondary disabled={refreshing} icon="refresh" onPress={() => { if(refreshLock.current)return; refreshLock.current=true; setRefreshError(""); setRefreshing(true); void store.refreshNotifications().catch(() => setRefreshError("Bildirimler yenilenemedi. Tekrar deneyebilirsin.")).finally(() => { refreshLock.current=false; setRefreshing(false); }); }}>{refreshing ? "Yenileniyor…" : "Bildirimleri Yenile"}</MobileButton>
    </>}
  </MobileScreen><NotificationDetail notification={detail} onClose={() => setDetail(null)} /></>;
}
