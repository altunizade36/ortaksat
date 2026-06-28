import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { Card, EmptyState, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { NotificationType } from "@/lib/types";
import { useStore } from "@/lib/use-store";

const typeIcons: Record<NotificationType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  application: "account-plus",
  lead: "account-clock",
  sale: "cart-check",
  message: "message-text",
  payout: "cash-check"
};

export default function NotificationsScreen() {
  const { language } = useLanguage();
  const { currentUser, markNotificationRead, notifications } = useStore();
  const myNotifications = notifications.filter((notification) => notification.userId === currentUser.id);
  const unreadCount = myNotifications.filter((notification) => !notification.read).length;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 12, paddingBottom: 96 }}>
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
