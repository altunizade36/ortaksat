import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

/**
 * İletişim/talep anında gösterilen kısa güvenlik uyarısı. Dolandırıcılığın en sık
 * olduğu an burasıdır: alıcı satıcıyla iletişime geçmeden önce temel kuralları
 * hatırlatır ve herkese açık Güvenli Alışveriş Rehberi'ne bağlar.
 */
export function SafetyNote() {
  const { language } = useLanguage();
  return (
    <View style={{ backgroundColor: colors.warningSoft, borderColor: colors.warning, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, padding: 12 }}>
      <MaterialCommunityIcons name="shield-alert-outline" size={18} color={colors.warning} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
        <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "900" }}>{translateCopy("Güvenli alışveriş", language)}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>
          {translateCopy("Ödemeyi ürünü görmeden yapma; platform dışına çıkıp kapora/ön ödeme isteyen kişiye dikkat et. OrtakSat ödeme tutmaz, taraflar kendi arasında anlaşır. Şüpheli durumu bildir.", language)}
        </Text>
        <Link href="/guvenli-alisveris" asChild>
          <Pressable accessibilityRole="link">
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Güvenli alışveriş rehberi →", language)}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
