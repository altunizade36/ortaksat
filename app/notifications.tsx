import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AuthRequired } from "@/components/auth-gate";
import { colors } from "@/components/colors";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Card, EmptyState, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import type { NotificationType } from "@/lib/types";
import { useStore } from "@/lib/use-store";

const typeIcons: Record<NotificationType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  application: "account-plus",
  lead: "account-clock",
  sale: "cart-check",
  message: "message-text",
  payout: "cash-check",
  system: "bullhorn-outline"
};

const typeMeta: Record<NotificationType, { label: string; tint: string; color: string }> = {
  application: { label: "Başvuru", tint: colors.infoSoft, color: colors.info },
  lead: { label: "Talep", tint: colors.violetSoft, color: colors.violet },
  sale: { label: "Satış", tint: colors.successSoft, color: colors.success },
  message: { label: "Mesaj", tint: colors.primarySoft, color: colors.primaryDark },
  payout: { label: "Komisyon", tint: colors.goldSoft, color: colors.gold },
  system: { label: "Duyuru", tint: colors.accentSoft, color: colors.accent }
};

type DeskNotif = { id: string; type: NotificationType; title: string; body: string; createdAt: string; group: "Bugün" | "Bu hafta" | "Daha önce"; real: boolean };

const SAMPLE: DeskNotif[] = [
  { id: "s1", type: "application", title: "Yeni ortaklık başvurusu", body: "Mehmet K., “Akıllı çocuk saati” ilanın için ortak satıcı olmak istiyor. Başvuruyu inceleyip onaylayabilirsin.", createdAt: "12 dk önce", group: "Bugün", real: false },
  { id: "s2", type: "sale", title: "Tebrikler, yeni bir satış!", body: "“Taşınabilir blender” ilanın ortak Ayşe D. üzerinden satıldı. ₺181 komisyon kaydın oluşturuldu.", createdAt: "48 dk önce", group: "Bugün", real: false },
  { id: "s3", type: "lead", title: "Yeni müşteri talebi", body: "“Minimal gümüş kolye” için bir alıcı iletişim talebi oluşturdu. 24 saat içinde dönüş yapman önerilir.", createdAt: "2 saat önce", group: "Bugün", real: false },
  { id: "s4", type: "payout", title: "Komisyon onaylandı", body: "“Akıllı çocuk saati” satışını satıcı onayladı. ₺294 komisyonunu satıcıyla anlaştığınız kanaldan tahsil edebilirsin.", createdAt: "5 saat önce", group: "Bugün", real: false },
  { id: "s5", type: "message", title: "Yeni mesaj: Kaan Y.", body: "“Bebek bakım çantası stok durumu hakkında bilgi alabilir miyim?” mesajını yanıtlamayı unutma.", createdAt: "Dün, 21:14", group: "Bu hafta", real: false },
  { id: "s6", type: "application", title: "Başvuru onaylandı", body: "“Yüksek komisyonlu elektronik” kampanyasına ortak satıcı başvurun onaylandı. Paylaşım bağlantın hazır.", createdAt: "Dün, 16:02", group: "Bu hafta", real: false },
  { id: "s7", type: "sale", title: "Ortak satış gerçekleşti", body: "Paylaştığın bağlantı üzerinden 2 ürün satıldı. Toplam ₺372 komisyon kazandın.", createdAt: "Çar, 11:30", group: "Bu hafta", real: false },
  { id: "s8", type: "lead", title: "Talep hatırlatması", body: "“Köşe koltuk” talebine henüz dönüş yapmadın. Yanıt süresi performans puanını etkiler.", createdAt: "Sal, 09:45", group: "Bu hafta", real: false },
  { id: "s9", type: "payout", title: "Komisyon tamamlandı", body: "“Köşe koltuk” satışının ₺945 komisyonunu satıcıdan aldığını onayladın. Kayıt kapatıldı.", createdAt: "3 hafta önce", group: "Daha önce", real: false },
  { id: "s10", type: "message", title: "Hoş geldin 👋", body: "Ortaksat'a hoş geldin! İlk ilanını oluştur ya da ortak satıcı olarak kazanmaya başla.", createdAt: "1 ay önce", group: "Daha önce", real: false }
];

export default function NotificationsScreen() {
  const { isAuthenticated } = useStore();
  if (!isAuthenticated) {
    return <AuthRequired title="Bildirimlerin için giriş yap" body="Başvuru, satış ve mesaj bildirimlerin hesabına özeldir; görmek için giriş yapman gerekir." />;
  }
  return <NotificationsScreenInner />;
}

function NotificationsScreenInner() {
  const { language } = useLanguage();
  const { currentUser, markNotificationRead, notifications } = useStore();
  const isWideWeb = useIsWideWeb();
  const myNotifications = notifications.filter((notification) => notification.userId === currentUser.id);
  const unreadCount = myNotifications.filter((notification) => !notification.read).length;

  const [tab, setTab] = useState<"all" | "unread" | NotificationType>("all");
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ push: true, email: true, sms: false, whatsapp: true });

  if (isWideWeb) {
    const realDesk: DeskNotif[] = myNotifications.map((n) => ({
      id: n.id, type: n.type, title: n.title, body: n.body, createdAt: n.createdAt, group: "Bugün", real: true
    }));
    // Canlıda yalnızca gerçek bildirimler; örnek (SAMPLE) veriler sadece yerel önizlemede.
    const all: DeskNotif[] = isSupabaseConfigured ? realDesk : [...realDesk, ...SAMPLE];
    const isRead = (n: DeskNotif) => readMap[n.id] === true || (n.real && !!notifications.find((x) => x.id === n.id)?.read);
    const totalUnread = all.filter((n) => !isRead(n)).length;

    const counts: Record<NotificationType, number> = { application: 0, lead: 0, sale: 0, message: 0, payout: 0, system: 0 };
    all.forEach((n) => { counts[n.type] += 1; });

    const tabs: Array<{ key: typeof tab; label: string; count: number }> = [
      { key: "all", label: "Tümü", count: all.length },
      { key: "unread", label: "Okunmamış", count: totalUnread },
      { key: "application", label: "Başvurular", count: counts.application },
      { key: "lead", label: "Talepler", count: counts.lead },
      { key: "sale", label: "Satışlar", count: counts.sale },
      { key: "payout", label: "Komisyon", count: counts.payout },
      { key: "message", label: "Mesajlar", count: counts.message }
    ];

    const filtered = all.filter((n) => tab === "all" ? true : tab === "unread" ? !isRead(n) : n.type === tab);
    const groups: Array<DeskNotif["group"]> = ["Bugün", "Bu hafta", "Daha önce"];

    const markRead = (n: DeskNotif) => {
      setReadMap((s) => ({ ...s, [n.id]: true }));
      if (n.real) markNotificationRead(n.id);
    };
    const markAll = () => {
      const next: Record<string, boolean> = {};
      all.forEach((n) => { next[n.id] = true; });
      setReadMap((s) => ({ ...s, ...next }));
      myNotifications.filter((n) => !n.read).forEach((n) => markNotificationRead(n.id));
    };

    const prefRows: Array<{ key: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; sub: string }> = [
      { key: "push", icon: "bell-ring-outline", label: "Anlık bildirim", sub: "Tarayıcı & uygulama" },
      { key: "email", icon: "email-outline", label: "E-posta", sub: "Hesabına bağlı e-posta" },
      { key: "sms", icon: "message-badge-outline", label: "SMS", sub: "Önemli hareketler" },
      { key: "whatsapp", icon: "whatsapp", label: "WhatsApp", sub: "Satış & komisyon" }
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, gap: 16, paddingBottom: 0, paddingHorizontal: 20, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
        <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>Bildirimler</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Başvuru, talep, satış ve komisyon hareketlerinin tümünü buradan takip et.</Text>
          </View>
          <Pressable onPress={markAll} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 14, paddingVertical: 9 })}>
            <MaterialCommunityIcons name="check-all" size={17} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>Tümünü okundu işaretle</Text>
          </Pressable>
          <Link href="/profile-edit" asChild>
            <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, height: 38, justifyContent: "center", width: 40 })}>
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
              <EmptyState title="Bildirim yok" body="Bu filtreye uygun bildirim bulunmuyor. Yeni hareketler burada görünecek." />
            ) : null}
            {groups.map((g) => {
              const items = filtered.filter((n) => n.group === g);
              if (items.length === 0) return null;
              return (
                <View key={g} style={{ gap: 10 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" }}>{g}</Text>
                  <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
                    {items.map((n, idx) => {
                      const read = isRead(n);
                      const meta = typeMeta[n.type] ?? { label: "Bildirim", tint: colors.infoSoft, color: colors.info };
                      return (
                        <Pressable key={n.id} onPress={() => markRead(n)} style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : read ? colors.surface : colors.primarySoft + "55", borderTopColor: colors.line, borderTopWidth: idx === 0 ? 0 : 1, flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 14 })}>
                          <View style={{ alignItems: "center", backgroundColor: meta.tint, borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
                            <MaterialCommunityIcons name={typeIcons[n.type] ?? "bell-outline"} size={22} color={meta.color} />
                          </View>
                          <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                              <View style={{ backgroundColor: meta.tint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                                <Text style={{ color: meta.color, fontSize: 10.5, fontWeight: "900" }}>{meta.label}</Text>
                              </View>
                              <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 14.5, fontWeight: "900" }}>{n.title}</Text>
                              {!read ? <View style={{ backgroundColor: colors.accent, borderRadius: 999, height: 9, width: 9 }} /> : null}
                            </View>
                            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500", lineHeight: 19 }}>{n.body}</Text>
                            <View style={{ alignItems: "center", flexDirection: "row", gap: 10, marginTop: 2 }}>
                              <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "600" }}>{n.createdAt}</Text>
                              <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{read ? "Görüntülendi" : "Okundu işaretle"}</Text>
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
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Özet</Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 12, flex: 1, paddingVertical: 12 }}>
                  <Text style={{ color: colors.accent, fontSize: 22, fontWeight: "900" }}>{totalUnread}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>Okunmamış</Text>
                </View>
                <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 12, flex: 1, paddingVertical: 12 }}>
                  <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{all.length}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>Toplam</Text>
                </View>
              </View>
              {(Object.keys(typeMeta) as NotificationType[]).map((t) => {
                const meta = typeMeta[t];
                return (
                  <Pressable key={t} onPress={() => setTab(t)} style={{ alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 4 }}>
                    <View style={{ alignItems: "center", backgroundColor: meta.tint, borderRadius: 8, height: 30, justifyContent: "center", width: 30 }}>
                      <MaterialCommunityIcons name={typeIcons[t]} size={16} color={meta.color} />
                    </View>
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{meta.label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{counts[t]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Bildirim tercihleri</Text>
                <Link href="/profile-edit" asChild>
                  <Pressable><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>Tümü</Text></Pressable>
                </Link>
              </View>
              {prefRows.map((p) => (
                <View key={p.key} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                  <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 8, height: 34, justifyContent: "center", width: 34 }}>
                    <MaterialCommunityIcons name={p.icon} size={18} color={colors.muted} />
                  </View>
                  <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{p.label}</Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{p.sub}</Text>
                  </View>
                  <Pressable onPress={() => setPrefs((s) => ({ ...s, [p.key]: !s[p.key] }))} style={{ alignItems: prefs[p.key] ? "flex-end" : "flex-start", backgroundColor: prefs[p.key] ? colors.primary : colors.line, borderRadius: 999, height: 22, justifyContent: "center", paddingHorizontal: 2, width: 40 }}>
                    <View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 18, width: 18 }} />
                  </Pressable>
                </View>
              ))}
            </View>

            <View style={{ backgroundColor: colors.primaryDark, borderRadius: 16, gap: 8, padding: 18 }}>
              <MaterialCommunityIcons name="handshake" size={26} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>Daha çok kazan</Text>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>Yüksek komisyonlu ilanları keşfet, paylaş ve her satıştan kazan.</Text>
              <Link href="/partner" asChild>
                <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, marginTop: 4, paddingVertical: 10 }}>
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Fırsatları gör</Text>
                </Pressable>
              </Link>
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

      <SectionTitle title="Son bildirimler" action={`${myNotifications.length}`} />

      {myNotifications.length === 0 ? <EmptyState title="Bildirim yok" body="Yeni ortaklık, talep, satış ve ödeme hareketleri burada görünecek." /> : null}

      {myNotifications.map((notification) => (
        <Card key={notification.id}>
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
                {!notification.read ? <StatusPill label="Yeni" tone="warning" /> : null}
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
      ))}
    </ScrollView>
  );
}
