import { Link } from "expo-router";
import type { Href } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/use-store";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const DISMISS_KEY = "ortaksat_onb_dismissed";

// Y11: Kalıcı onboarding kontrol listesi — üye ol → profil → ilk ilan → ilk ortaklık.
// Aktivasyonu artırır: yeni kullanıcı ne yapacağını bilir, ortaklık sistemine hızla girer.
// Mevcut veriden hesaplanır (yeni DB yok). Tümü tamamlanınca VEYA kapatılınca gizlenir.
export function OnboardingChecklist() {
  const { currentUser, listings, partnerships } = useStore();
  const { language } = useLanguage();
  const t = (s: string) => translateCopy(s, language);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (!currentUser?.id || dismissed) return null;

  const hasPhone = Boolean(currentUser.phone && currentUser.phone.trim());
  const myListings = listings.filter((l) => l.ownerId === currentUser.id && l.status !== "archived");
  const myPartnerships = partnerships.filter(
    (p) => p.partnerId === currentUser.id && (p.status === "active" || p.status === "pending")
  );

  const steps: Array<{ key: string; done: boolean; icon: IconName; label: string; hint: string; href?: Href }> = [
    { key: "acc", done: true, icon: "account-check", label: t("Hesabını oluşturdun"), hint: t("Hoş geldin!") },
    { key: "prof", done: hasPhone, icon: "card-account-details-outline", label: t("Profilini tamamla"), hint: t("Telefonunu ekle — alıcılar ve ortaklar sana ulaşabilsin."), href: "/profile-edit" as unknown as Href },
    { key: "list", done: myListings.length > 0, icon: "tag-plus-outline", label: t("İlk ilanını ver"), hint: t("Ürününü ücretsiz yayınla; komisyonunu belirle, ortaklar sattırsın."), href: "/create" as unknown as Href },
    { key: "part", done: myPartnerships.length > 0, icon: "handshake-outline", label: t("İlk ortaklığını kur"), hint: t("Beğendiğin bir ürüne ortak ol; sattığında komisyon kazan."), href: "/(tabs)/explore" as unknown as Href }
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null; // hepsi tamam → gösterme

  const pct = Math.round((doneCount / steps.length) * 100);
  const dismiss = () => {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* yok */
    }
    setDismissed(true);
  };

  return (
    <View style={{ backgroundColor: colors.primarySoft, borderRadius: 16, gap: 12, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="rocket-launch-outline" size={18} color={colors.primaryDark} />
        <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 14, fontWeight: "900" }}>
          {t("OrtakSat'a başlangıç")} · {doneCount}/{steps.length}
        </Text>
        <Pressable onPress={dismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("Kapat")}>
          <MaterialCommunityIcons name="close" size={16} color={colors.muted} />
        </Pressable>
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: 999, height: 7, overflow: "hidden" }}>
        <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: 7, width: `${pct}%` }} />
      </View>

      <View style={{ gap: 8 }}>
        {steps.map((s) => {
          const body = (
            <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: s.done ? colors.successSoft : colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
              <MaterialCommunityIcons name={s.done ? "check-circle" : s.icon} size={20} color={s.done ? colors.success : colors.primaryDark} />
              <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                <Text style={{ color: s.done ? colors.muted : colors.ink, fontSize: 13, fontWeight: "800", textDecorationLine: s.done ? "line-through" : "none" }}>{s.label}</Text>
                {!s.done ? <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 15 }}>{s.hint}</Text> : null}
              </View>
              {!s.done && s.href ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} /> : null}
            </View>
          );
          return !s.done && s.href ? (
            <Link key={s.key} href={s.href} asChild>
              <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>{body}</Pressable>
            </Link>
          ) : (
            <View key={s.key}>{body}</View>
          );
        })}
      </View>
    </View>
  );
}
