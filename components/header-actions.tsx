import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

export function HeaderActions() {
  const { language } = useLanguage();
  const [pressed, setPressed] = useState(false);
  // KIRMIZI "İlan Ver" CTA — mobil header'da ziyaretçiyi ÜCRETSİZ ilan vermeye çeker (dikkat çeken
  // kırmızı). Mesaj/bildirim ikonları KALDIRILDI → hamburger menüsünde (rozetiyle) zaten var; header
  // sadeleşti + ilan-verme öne çıktı. asChild + STATİK stil + useState (fonksiyon-style anchor'da bg düşer).
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 6, zIndex: 2 }}>
      <Link href="/create" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={translateCopy("Ücretsiz İlan Ver", language)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 999, elevation: 2, flexDirection: "row", gap: 5, minHeight: 40, opacity: pressed ? 0.85 : 1, paddingHorizontal: 12, shadowColor: colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 }}
        >
          <MaterialCommunityIcons name="plus-box" size={19} color="#FFFFFF" />
          {/* 2-satır: küçük "ÜCRETSİZ" etiketi + "İlan Ver" — genişlik artmadan "ücretsiz" vurgusu (mobilde tam metin logoyu sıkıştırıyordu). */}
          <View style={{ gap: 0 }}>
            <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.9)", fontSize: 7.5, fontWeight: "900", letterSpacing: 0.6, lineHeight: 9 }}>{translateCopy("ÜCRETSİZ", language)}</Text>
            <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900", lineHeight: 15 }}>{translateCopy("İlan Ver", language)}</Text>
          </View>
        </Pressable>
      </Link>
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
