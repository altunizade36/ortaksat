import { MaterialCommunityIcons } from "@/components/icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

/**
 * Tek merkezden yönetilen yasal koruma uyarısı. Ortaksat'ın aracı bir ilan/iletişim
 * platformu olduğunu; ödeme almadığını/tutmadığını, kargo/komisyon/emanet işlemediğini
 * ve tarafların kendi sorumluluğunu net biçimde belirtir. Para/işlem imalı her ekrana
 * konur ki uygulama e-ticaret/ödeme kuruluşu sorumluluğuna kaymasın.
 */

export const DISCLAIMER_SHORT =
  "Ortaksat aracı bir ilan ve iletişim platformudur; ödeme almaz, para tutmaz, komisyon kesmez, kargo yapmaz. Fiyat, ücret ve komisyon yalnızca taraflar arasında belirlenir; tüm alışveriş, ödeme ve teslimat uygulama dışında, kullanıcıların kendi sorumluluğunda yapılır.";

const POINTS = [
  "Ödeme almaz, para tutmaz, transfer etmez.",
  "Komisyon/satıştan kesinti yapmaz; cüzdan, bakiye veya güvenli ödeme (emanet) sistemi yoktur.",
  "Kargo, teslimat veya iade süreçlerini yürütmez.",
  "Gösterilen fiyat, ücret ve komisyon yalnızca tarafların kendi belirlediği bilgilerdir.",
  "Alışveriş, ödeme, komisyon tahsilatı ve teslimat; alıcı, satıcı ve ortak arasında uygulama dışında yapılır.",
  "Ortaksat bu işlemlerin tarafı değildir; ürün, ödeme, teslimat ve anlaşmazlıklardan sorumlu değildir."
];

/** Kompakt tek-satır uyarı (form altları, kartlar). */
export function LegalNote({ style }: { style?: object }) {
  return (
    <View style={[{ alignItems: "flex-start", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, padding: 11 }, style]}>
      <MaterialCommunityIcons name="information-outline" size={16} color={colors.muted} style={{ marginTop: 1 }} />
      <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{DISCLAIMER_SHORT}</Text>
    </View>
  );
}

/**
 * Açılır-kapanır koruma kutusu (ilan ver adımları). Varsayılan KAPALI: tek satır özet +
 * "Detay" oku. Böylece tüm maddeler KORUNUR ama her adımda ekranı 6 satırla doldurmaz.
 */
export function LegalDisclaimerCollapsible() {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ backgroundColor: colors.infoSoft, borderColor: colors.info, borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, paddingVertical: open ? 12 : 10 }}>
      <Pressable accessibilityRole="button" onPress={() => setOpen((v) => !v)} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="shield-check-outline" size={17} color={colors.info} />
        <Text numberOfLines={open ? undefined : 1} style={{ color: colors.ink, flex: 1, fontSize: 12, fontWeight: "800" }}>
          {translateCopy("Ortaksat aracı platformdur: ödeme almaz, para tutmaz, komisyon kesmez, kargo yapmaz.", language)}
        </Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={{ gap: 6, marginTop: 10 }}>
          {POINTS.map((p) => (
            <View key={p} style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
              <MaterialCommunityIcons name="circle-small" size={18} color={colors.muted} style={{ marginTop: -1 }} />
              <Text style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy(p, language)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Açık, maddeli koruma kutusu (ilan ver önizleme, ilan detay, yasal sayfa). */
export function LegalDisclaimer({ title = "Önemli: Ortaksat ödeme/komisyon işlemez" }: { title?: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ backgroundColor: colors.infoSoft, borderColor: colors.info, borderRadius: 14, borderWidth: 1, gap: 8, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="shield-alert-outline" size={20} color={colors.info} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "900" }}>{translateCopy(title, language)}</Text>
      </View>
      {POINTS.map((p) => (
        <View key={p} style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
          <MaterialCommunityIcons name="circle-small" size={18} color={colors.muted} style={{ marginTop: -1 }} />
          <Text style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{p}</Text>
        </View>
      ))}
    </View>
  );
}
