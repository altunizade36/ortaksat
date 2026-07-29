import { MaterialCommunityIcons } from "@/components/icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

/**
 * Tek merkezden yönetilen yasal koruma uyarısı. OrtakSat'ın aracı bir ilan/iletişim
 * platformu olduğunu; ödeme almadığını/tutmadığını, kargo/komisyon/emanet işlemediğini
 * ve tarafların kendi sorumluluğunu net biçimde belirtir. Para/işlem imalı her ekrana
 * konur ki uygulama e-ticaret/ödeme kuruluşu sorumluluğuna kaymasın.
 */

export const DISCLAIMER_SHORT =
  "OrtakSat aracı bir ilan ve iletişim platformudur; ödeme almaz, para tutmaz, komisyon kesmez, kargo yapmaz. Fiyat, ücret ve komisyon yalnızca taraflar arasında belirlenir; tüm alışveriş, ödeme ve teslimat uygulama dışında, kullanıcıların kendi sorumluluğunda yapılır.";

const POINTS = [
  "Ödeme almaz, para tutmaz, transfer etmez.",
  "Komisyon/satıştan kesinti yapmaz; cüzdan, bakiye veya güvenli ödeme (emanet) sistemi yoktur.",
  "Kargo, teslimat veya iade süreçlerini yürütmez.",
  "Gösterilen fiyat, ücret ve komisyon yalnızca tarafların kendi belirlediği bilgilerdir.",
  "Alışveriş, ödeme, komisyon tahsilatı ve teslimat; alıcı, satıcı ve ortak arasında uygulama dışında yapılır.",
  "OrtakSat bu işlemlerin tarafı değildir; ürün, ödeme, teslimat ve anlaşmazlıklardan sorumlu değildir."
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
          {translateCopy("OrtakSat aracı platformdur: ödeme almaz, para tutmaz, komisyon kesmez, kargo yapmaz.", language)}
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

/**
 * KOMPAKT ONAY KUTUCUĞU (ilan ver — yayınlamadan önce). Eski 6-maddeli büyük kutu mobilde
 * ekranı kaplıyordu → tek satır + kutucuk. İşaretleyip yayınlayınca kullanıcı aracı-platform
 * şartlarını KABUL etmiş olur. "Tüm maddeleri gör" ile 6 madde açılır (hepsi KORUNUR).
 */
export function LegalDisclaimerAccept({ value, onChange, error }: { value: boolean; onChange: (v: boolean) => void; error?: boolean }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const showErr = Boolean(error) && !value;
  return (
    <View style={{ backgroundColor: value ? colors.infoSoft : colors.surface, borderColor: showErr ? colors.accent : value ? colors.info : colors.line, borderRadius: 12, borderWidth: 1.5, gap: 8, padding: 13 }}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
        <View style={{ alignItems: "center", backgroundColor: value ? colors.info : colors.surface, borderColor: value ? colors.info : showErr ? colors.accent : colors.subtle, borderRadius: 6, borderWidth: 2, height: 24, justifyContent: "center", marginTop: 1, width: 24 }}>
          {value ? <MaterialCommunityIcons name="check-bold" size={15} color="#FFFFFF" /> : null}
        </View>
        <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800", lineHeight: 18 }}>
          {translateCopy("OrtakSat aracı platformdur; ödeme almaz, komisyon kesmez, kargo/emanet yapmaz — alışveriş ve ödeme taraflar arasında yapılır. Okudum, kabul ediyorum.", language)}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setOpen((v) => !v)} style={{ alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 3, marginLeft: 34 }}>
        <Text style={{ color: colors.info, fontSize: 11.5, fontWeight: "800" }}>{open ? translateCopy("Gizle", language) : translateCopy("Tüm maddeleri gör", language)}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={15} color={colors.info} />
      </Pressable>
      {open ? (
        <View style={{ gap: 6, marginLeft: 34 }}>
          {POINTS.map((p) => (
            <View key={p} style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
              <MaterialCommunityIcons name="circle-small" size={18} color={colors.muted} style={{ marginTop: -1 }} />
              <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{translateCopy(p, language)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {showErr ? <Text style={{ color: colors.accent, fontSize: 11.5, fontWeight: "800", marginLeft: 34 }}>{translateCopy("Yayınlamak için bu onayı işaretlemelisin.", language)}</Text> : null}
    </View>
  );
}

/** Açık, maddeli koruma kutusu (ilan ver önizleme, ilan detay, yasal sayfa). */
export function LegalDisclaimer({ title = "Önemli: OrtakSat ödeme/komisyon işlemez" }: { title?: string }) {
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
