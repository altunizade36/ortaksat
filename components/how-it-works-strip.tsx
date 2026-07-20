import { MaterialCommunityIcons } from "@/components/icons";
import { Link, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Mascot } from "@/components/brand/Mascot";
import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

// Gerçek, görsel "nasıl çalışır + neden güvenli" şeridi — ilk-izlenim + dönüşüm için.
// Sahte veri/rakam YOK; yalnız modelin gerçek akışı + gerçek güven noktaları. CTA'lar çalışır.
const STEPS: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; n: string; title: string; body: string; tint: string; color: string }> = [
  { icon: "compass-outline", n: "1", title: "Keşfet veya İlan Ver", body: "Ürünleri keşfet ya da kendi ürününü ücretsiz yayınla.", tint: colors.primarySoft, color: colors.primaryDark },
  { icon: "handshake-outline", n: "2", title: "Ortak Ol & Tanıt", body: "Beğendiğin ürüne ortak ol; kendi yönteminle tanıtıp müşteri getir. Link/takip yok.", tint: colors.violetSoft, color: colors.violet },
  { icon: "cash-multiple", n: "3", title: "Komisyon Kazan", body: "Sattığında anlaştığın komisyonu satıcıdan al — anlaşma ve satışlar sistemde kayıtlı.", tint: colors.goldSoft, color: "#B7791F" }
];

const TRUST = ["Doğrulanmış satıcılar", "Şeffaf komisyon", "Ücretsiz üyelik", "Aracı platform — para tutmaz"];

export function HowItWorksStrip() {
  const { language } = useLanguage();
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, gap: 16, padding: 20, shadowColor: "#0B3A44", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 14 }}>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 12, minWidth: 200 }}>
          <Mascot name="laptop" size={64} />
          <View style={{ gap: 2, flexShrink: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "900", letterSpacing: -0.3 }}>{translateCopy("3 Adımda OrtakSat", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{translateCopy("Sat, ortak ol, kazan — hepsi tek platformda, ücretsiz.", language)}</Text>
          </View>
        </View>
        <Link href={"/nasil-calisir" as Href} asChild>
          <Pressable accessibilityRole="link" style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, opacity: pressed ? 0.85 : 1, paddingHorizontal: 13, paddingVertical: 8 })}>
            <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "900" }}>{translateCopy("Nasıl çalışır?", language)}</Text>
            <MaterialCommunityIcons name="arrow-right" size={15} color={colors.primaryDark} />
          </Pressable>
        </Link>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {STEPS.map((s) => (
          <View key={s.n} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 220, flexGrow: 1, gap: 8, minWidth: 200, padding: 15 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
              <View style={{ alignItems: "center", backgroundColor: s.tint, borderRadius: 11, height: 38, justifyContent: "center", width: 38 }}>
                <MaterialCommunityIcons name={s.icon} size={20} color={s.color} />
              </View>
              <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 22, justifyContent: "center", width: 22 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{s.n}</Text>
              </View>
            </View>
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy(s.title, language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy(s.body, language)}</Text>
          </View>
        ))}
      </View>

      {/* Gerçek güven noktaları (sahte rakam yok) */}
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {TRUST.map((t) => (
          <View key={t} style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 5 }}>
            <MaterialCommunityIcons name="check-circle" size={13} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: 11.5, fontWeight: "800" }}>{translateCopy(t, language)}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Link href={"/explore" as Href} asChild>
          <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, opacity: pressed ? 0.9 : 1, paddingHorizontal: 16, paddingVertical: 10 })}>
            <MaterialCommunityIcons name="compass-outline" size={16} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Ürünleri Keşfet", language)}</Text>
          </Pressable>
        </Link>
        <Link href={"/create" as Href} asChild>
          <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.9 : 1, paddingHorizontal: 16, paddingVertical: 10 })}>
            <MaterialCommunityIcons name="store-plus-outline" size={16} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("İlan Ver", language)}</Text>
          </Pressable>
        </Link>
        <Link href={"/partner" as Href} asChild>
          <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.9 : 1, paddingHorizontal: 16, paddingVertical: 10 })}>
            <MaterialCommunityIcons name="handshake-outline" size={16} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Ortak Ol", language)}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
