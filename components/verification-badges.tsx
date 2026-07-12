import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { verificationBadges, type VerificationBadge } from "@/lib/verification";
import type { User } from "@/lib/types";

// Satıcının GERÇEK doğrulama rozetleri (chip'ler). Uygulanmayan seviye gösterilmez.
export function VerificationBadges({ user, size = "md" }: { user: Pick<User, "verifiedPhone" | "verifiedIdentity" | "verifiedInstagram" | "successfulSales"> | undefined | null; size?: "sm" | "md" }) {
  const { language } = useLanguage();
  const badges = verificationBadges(user);
  if (badges.length === 0) return null;
  const fs = size === "sm" ? 10.5 : 11.5;
  const ic = size === "sm" ? 11 : 13;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {badges.map((b: VerificationBadge) => (
        <View key={b.key} style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 9, paddingVertical: 4 }}>
          <MaterialCommunityIcons name={b.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={ic} color={colors.success} />
          <Text style={{ color: colors.success, fontSize: fs, fontWeight: "800" }}>{translateCopy(b.label, language)}</Text>
        </View>
      ))}
    </View>
  );
}
