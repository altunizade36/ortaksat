import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import { useState } from "react";
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
    <View style={{ alignItems: "center", flexDirection: "row", gap: 2, zIndex: 2 }}>
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
  // KRİTİK: <Link asChild> + fonksiyon-style ({pressed})=>({}) web anchor'a UYGULANMAZ
  // → bg/border/width/height düşer, buton ikon boyutuna (20px) çöker. STATİK obje + useState şart.
  const [pressed, setPressed] = useState(false);
  // DOKUNMA HEDEFİ: dış Pressable 44×44 ŞEFFAF (Apple HIG / DesktopActions ile aynı);
  // görsel daire 34px İÇ View'de kalır (ince tasarım korunur). RN-web hitSlop'u dokunma
  // için uygulamaz → gerçek hedef yalnız iç 34px olurdu; şeffaf 44 sarmalayıcı bunu çözer.
  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        hitSlop={6}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{ alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44 }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.surface,
            borderColor: primary ? colors.primary : colors.line,
            borderRadius: 999,
            borderWidth: primary ? 2 : 1,
            elevation: 2,
            height: 34,
            justifyContent: "center",
            opacity: pressed ? 0.72 : 1,
            shadowColor: "#101828",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 5,
            width: 34
          }}
        >
          <MaterialCommunityIcons name={icon} size={primary ? 20 : 18} color={colors.primaryDark} />
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
        </View>
      </Pressable>
    </Link>
  );
}
