import { CompactFooter } from "@/components/compact-footer";
import { MaterialCommunityIcons } from "@/components/icons";
import { Text, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Compact trust signals shared by marketplace landing surfaces. */
export function WebTrustStrip() {
  const { language } = useLanguage();
  const items: Array<{ icon: IconName; title: string; body: string }> = [
    { icon: "shield-check", title: "Anlaşma şartları kayıt altında", body: "Ortak satış anlaşması ve komisyon şartı sistemde saklanır; ödeme taraflar arasındadır." },
    { icon: "eye-check-outline", title: "Şeffaf süreç", body: "Talep, anlaşma ve komisyon şartı canlı panelde görünür." },
    { icon: "account-check-outline", title: "Doğrulanmış satıcılar", body: "Telefon/e-posta doğrulama ve güven puanı." },
    { icon: "star-check-outline", title: "Puan & yorumlar", body: "Her satış sonrası karşılıklı değerlendirme." }
  ];
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
    {items.map((item) => <View key={item.title} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 240, flexDirection: "row", flexGrow: 1, gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
      <MaterialCommunityIcons name={item.icon} size={24} color={colors.primary} />
      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy(item.title, language)}</Text>
        <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>{translateCopy(item.body, language)}</Text>
      </View>
    </View>)}
  </View>;
}

/** One restrained footer on desktop, mobile web and native shells. */
export function WebFooter() {
  return <CompactFooter />;
}
