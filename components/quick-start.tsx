import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Step = { icon: IconName; title: string; body: string };

const SELLER: { steps: Step[]; ctaLabel: string; ctaHref: Href; ctaIcon: IconName } = {
  steps: [
    { icon: "store-plus-outline", title: "İlanını aç", body: "Ürününü ekle, ortağa vereceğin komisyonu (ve istersen başlangıç bonusunu) belirle." },
    { icon: "account-group-outline", title: "Ortaklar paylaşsın", body: "Ortaklar senin ürününü kendi kitlesine tanıtır, alıcı getirir. Sen sadece onaylarsın." },
    { icon: "cash-multiple", title: "Sat, komisyonu öde", body: "Satış olunca komisyonu doğrudan ortağa ödersin. Ortaksat para tutmaz, yalnızca kaydı tutar." }
  ],
  ctaLabel: "İlk ilanını aç",
  ctaHref: "/create",
  ctaIcon: "plus-circle-outline"
};

const PARTNER: { steps: Step[]; ctaLabel: string; ctaHref: Href; ctaIcon: IconName } = {
  steps: [
    { icon: "magnify", title: "Fırsat seç", body: "Komisyonu yüksek ürünlere göz at, kitlene uygun olanı seç." },
    { icon: "link-variant", title: "Ortak ol & paylaş", body: "Sana özel referans bağlantını al, WhatsApp/Instagram'da kendi kitlene paylaş." },
    { icon: "hand-coin-outline", title: "Kazan", body: "Getirdiğin satıştan komisyonu satıcıdan alırsın. Üyelik ücretsiz, stok/ödeme derdi yok." }
  ],
  ctaLabel: "Fırsatları keşfet",
  ctaHref: "/partner",
  ctaIcon: "compass-outline"
};

/** Yeni satıcı/ortağa modeli 3 adımda anlatan hızlı başlangıç kartı. */
export function QuickStart({ role }: { role: "seller" | "partner" }) {
  const cfg = role === "seller" ? SELLER : PARTNER;
  const title = role === "seller" ? "Ortak satışla nasıl kazanırsın?" : "Ortak olarak nasıl kazanırsın?";

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 18 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="rocket-launch-outline" size={20} color={colors.primaryDark} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 16.5, fontWeight: "900" }}>{title}</Text>
      </View>

      <View style={{ gap: 12 }}>
        {cfg.steps.map((s, i) => (
          <View key={s.title} style={{ alignItems: "flex-start", flexDirection: "row", gap: 12 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}>
              <MaterialCommunityIcons name={s.icon} size={22} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1, gap: 2, minWidth: 0, paddingTop: 1 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, height: 18, justifyContent: "center", width: 18 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" }}>{i + 1}</Text>
                </View>
                <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>{s.title}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>{s.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Link href={cfg.ctaHref} asChild>
        <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 13 }}>
          <MaterialCommunityIcons name={cfg.ctaIcon} size={18} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{cfg.ctaLabel}</Text>
        </Pressable>
      </Link>

      <View style={{ alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "center" }}>
        <MaterialCommunityIcons name="shield-check-outline" size={14} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>Ortaksat aracıdır; ödeme ve teslimat taraflar arasındadır.</Text>
      </View>
    </View>
  );
}
