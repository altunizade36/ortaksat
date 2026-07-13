import { MaterialCommunityIcons } from "@/components/icons";
import { Link, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { User } from "@/lib/types";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function isImageAvatar(value: string) {
  return value.startsWith("http") || value.startsWith("file:");
}

/**
 * Profil gücü göstergesi + eksikleri tamamlamaya yönlendiren aksiyonlar.
 * Güçlü profil = daha çok güven = daha çok ortak/satış. Sahte doğrulama yapmaz;
 * yalnız kullanıcının kendisinin tamamlayabileceği gerçek adımları teşvik eder.
 */
export function ProfileStrength({ user, hasListing }: { user: User; hasListing: boolean }) {
  const { language } = useLanguage();
  const items: Array<{ label: string; done: boolean; icon: IconName; href: Href; cta: string }> = [
    { label: "Profil fotoğrafı ekle", done: isImageAvatar(user.avatar), icon: "camera-outline", href: "/profile-edit", cta: "Ekle" },
    { label: "Kısa tanıtım yaz", done: !!user.bio, icon: "text-account", href: "/profile-edit", cta: "Yaz" },
    { label: "İlk ilanını aç", done: hasListing, icon: "store-plus-outline", href: "/create", cta: "Aç" },
    { label: "Telefonunu doğrula", done: user.verifiedPhone, icon: "phone-check-outline", href: "/trust", cta: "Doğrula" },
    { label: "Kimliğini doğrula", done: user.verifiedIdentity, icon: "card-account-details-outline", href: "/trust", cta: "Doğrula" }
  ];
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  const tone = pct >= 80 ? colors.success : pct >= 40 ? colors.primary : colors.gold;

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 12, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="shield-star-outline" size={19} color={colors.primaryDark} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 15.5, fontWeight: "900" }}>{translateCopy("Profil gücü", language)}</Text>
        <Text style={{ color: tone, fontSize: 16, fontWeight: "900" }}>%{pct}</Text>
      </View>

      <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 8, overflow: "hidden" }}>
        <View style={{ backgroundColor: tone, height: "100%", width: `${pct}%` }} />
      </View>

      {pct < 100 ? (
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>
          {translateCopy("Güçlü profil daha çok güven kazandırır; ortaklar ve alıcılar seninle daha rahat çalışır.", language)}
        </Text>
      ) : null}

      <View style={{ gap: 8 }}>
        {items.map((item) => (
          <View key={item.label} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
            <MaterialCommunityIcons name={item.done ? "check-circle" : item.icon} size={18} color={item.done ? colors.success : colors.muted} />
            <Text style={{ color: item.done ? colors.muted : colors.ink, flex: 1, fontSize: 13, fontWeight: item.done ? "600" : "800", textDecorationLine: item.done ? "line-through" : "none" }}>
              {translateCopy(item.label, language)}
            </Text>
            {item.done ? (
              <Text style={{ color: colors.success, fontSize: 11.5, fontWeight: "800" }}>{translateCopy("Tamam", language)}</Text>
            ) : (
              <Link href={item.href} asChild>
                <Pressable accessibilityRole="button" accessibilityLabel={translateCopy(item.label, language)} style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                  <Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "900" }}>{translateCopy(item.cta, language)}</Text>
                </Pressable>
              </Link>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
