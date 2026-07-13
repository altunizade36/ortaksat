import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/use-store";

export function HeaderActions() {
  const { language } = useLanguage();
  const { currentUser, messages, notifications } = useStore();
  const unreadMessages = messages.filter((message) => message.receiverId === currentUser.id && !message.read).length;
  const unreadNotifications = notifications.filter((notification) => notification.userId === currentUser.id && !notification.read).length;

  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 8, zIndex: 2 }}>
      <HeaderAction href="/(tabs)/messages" icon="message-text-outline" label={translateCopy("Mesaj", language)} badge={unreadMessages} />
      <HeaderAction href="/(tabs)/notifications-tab" icon="bell-outline" label={translateCopy("Bildirim", language)} badge={unreadNotifications} />
      <HeaderAction href="/(tabs)/profile" icon="account-circle-outline" label={translateCopy("Profil", language)} primary />
    </View>
  );
}

function HeaderAction({
  badge,
  href,
  icon,
  label,
  primary
}: {
  badge?: number;
  href: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: colors.surface,
          borderColor: primary ? colors.primary : colors.line,
          borderRadius: 999,
          borderWidth: primary ? 2 : 1,
          elevation: 3,
          height: 36,
          justifyContent: "center",
          opacity: pressed ? 0.72 : 1,
          shadowColor: "#101828",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          width: 36
        })}
      >
        <MaterialCommunityIcons name={icon} size={primary ? 23 : 20} color={primary ? colors.primaryDark : colors.primaryDark} />
        {badge ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: colors.accent,
              borderColor: "#FFFFFF",
              borderRadius: 999,
              borderWidth: 1,
              minWidth: 15,
              paddingHorizontal: 3,
              position: "absolute",
              right: -3,
              top: -4
            }}
          >
            <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 8, fontWeight: "900", lineHeight: 11 }}>
              {badge > 9 ? "9+" : badge}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}
