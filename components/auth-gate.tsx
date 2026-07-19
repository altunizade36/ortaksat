import { MaterialCommunityIcons } from "@/components/icons";
import { Link, usePathname } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { BrandMark } from "@/components/brand/brand-mark";
import { Mascot } from "@/components/brand/Mascot";
import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { MascotName } from "@/lib/mascots";

/**
 * Hesap/aksiyon gerektiren ekranlar için giriş kapısı. Kullanıcı giriş yapmadan
 * siteyi gezebilir; ilan verme, favoriler, mesajlar, kazançlar gibi sayfalarda
 * bu kart gösterilir. `useStore().isAuthenticated` false ise sayfa bunu render eder.
 */
export function AuthRequired({
  title = "Bu sayfa için giriş yapın",
  body = "Gezmeye devam edebilirsin; ancak bu bölümü kullanmak için ücretsiz bir hesap gerekiyor.",
  icon,
  mascot,
  mode
}: {
  title?: string;
  body?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  mascot?: MascotName;
  /** "register" → auth ekranı Kayıt sekmesinde açılır (yeni ziyaretçi arz kapısı için). */
  mode?: "login" | "register";
}) {
  const { language } = useLanguage();
  // Mevcut yolu redirect olarak taşı → giriş/kayıt sonrası kullanıcı ANA SAYFAYA değil
  // gelmek istediği sayfaya döner (niyet kaybı yok). mode=register ile yeni ziyaretçi
  // doğrudan Kayıt sekmesinde açılır (login sekmesinde "kayıt"ı aramak zorunda kalmaz).
  const pathname = usePathname();
  const redirect = typeof pathname === "string" && pathname.startsWith("/") && pathname !== "/auth" ? pathname : null;
  const authHref = `/auth${redirect || mode ? "?" : ""}${redirect ? `redirect=${encodeURIComponent(redirect)}` : ""}${redirect && mode ? "&" : ""}${mode ? `mode=${mode}` : ""}`;
  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", backgroundColor: colors.background, flexGrow: 1, justifyContent: "center", padding: 24 }} style={{ backgroundColor: colors.background }}>
      <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, gap: 14, maxWidth: 420, padding: 30, width: "100%" }}>
        {/* Sıra: maskot (istendiyse) > bağlamsal ikon (askıya alındı/e-posta/yetki gibi) > MARKA LOGOSU.
            Varsayılan giriş kapısı artık jenerik kilit değil, logo gösterir. */}
        {mascot ? (
          <Mascot name={mascot} size={172} />
        ) : icon ? (
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 64, justifyContent: "center", width: 64 }}>
            <MaterialCommunityIcons name={icon} size={32} color={colors.primaryDark} />
          </View>
        ) : (
          <BrandMark size={68} />
        )}
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900", textAlign: "center" }}>{translateCopy(title, language)}</Text>
        <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, textAlign: "center" }}>{translateCopy(body, language)}</Text>
        <Link href={authHref as never} asChild>
          <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 13, width: "100%" }}>
            <MaterialCommunityIcons name={mode === "register" ? "account-plus" : "login"} size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{translateCopy(mode === "register" ? "Ücretsiz kayıt ol" : "Giriş yap / Kayıt ol", language)}</Text>
          </Pressable>
        </Link>
        <Link href="/" asChild>
          <Pressable style={{ alignItems: "center", paddingVertical: 4 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Gezmeye devam et →", language)}</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}
