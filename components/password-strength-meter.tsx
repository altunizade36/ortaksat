import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { colors } from "@/components/colors";
import { passwordStrength } from "@/lib/validation";

/**
 * Gerçek zamanlı şifre gücü göstergesi (Trendyol/Amazon tarzı): 4 kademeli bar +
 * her kuralın (uzunluk, büyük/küçük harf, rakam, özel karakter) canlı tik listesi.
 * Kaynak tek: lib/validation passwordStrength — kayıt doğrulaması ile birebir aynı.
 */
export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const s = passwordStrength(password);
  const barColor = [colors.accent, colors.accent, colors.gold, colors.success, colors.success][s.score];

  return (
    <View style={{ gap: 8 }} accessibilityLabel={`Şifre gücü: ${s.label}`}>
      <View style={{ flexDirection: "row", gap: 5 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              backgroundColor: i <= s.score - 1 || (s.score > 0 && i < s.score) ? barColor : colors.line,
              borderRadius: 999,
              flex: 1,
              height: 5
            }}
          />
        ))}
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: barColor, fontSize: 12, fontWeight: "800" }}>{s.label}</Text>
        <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "700" }}>{s.passed}/5 kural</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {s.checks.map((c) => (
          <View key={c.key} style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
            <MaterialCommunityIcons
              name={c.ok ? "check-circle" : "circle-outline"}
              size={13}
              color={c.ok ? colors.success : colors.subtle}
            />
            <Text style={{ color: c.ok ? colors.ink : colors.subtle, fontSize: 11, fontWeight: "700" }}>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
