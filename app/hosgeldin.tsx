import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useRouter, type Href } from "expo-router";
import Head from "expo-router/head";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { WebContainer } from "@/components/web-container";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { useStore } from "@/lib/use-store";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type RoleCard = {
  icon: IconName;
  tint: string;
  accent: string;
  title: string;
  desc: string;
  points: string[];
  cta: string;
  href: Href;
};

const ROLES: RoleCard[] = [
  {
    icon: "storefront-outline",
    tint: colors.primarySoft,
    accent: colors.primaryDark,
    title: "Ürünüm var, satmak istiyorum",
    desc: "Ücretsiz ilan aç, komisyonunu belirle; ortaklar senin için satsın.",
    points: ["Ücretsiz listeleme, aidat yok", "Sadece satışta komisyon", "Ortaklar bedava tanıtır"],
    cta: "Ücretsiz İlan Ver",
    href: "/create"
  },
  {
    icon: "cash-multiple",
    tint: colors.infoSoft,
    accent: colors.info,
    title: "Kazanmak istiyorum (ortak)",
    desc: "Ürün seç, linkini paylaş; satışta komisyon kazan. Sıfır sermaye.",
    points: ["Stok/para yatırma yok", "5 dakikada başla", "Sosyal medyandan kazan"],
    cta: "Ortak Ol, Kazan",
    href: "/partner"
  },
  {
    icon: "shopping-outline",
    tint: colors.goldSoft,
    accent: colors.gold,
    title: "Ürün arıyorum (alıcı)",
    desc: "İlanları keşfet, satıcıyla iletişime geç, güvenle al.",
    points: ["Komisyonlu ilanlar", "Doğrulanmış satıcılar", "Doğrudan iletişim"],
    cta: "Ürünleri Keşfet",
    href: "/explore"
  }
];

export default function WelcomePage() {
  const isWideWeb = useIsWideWeb();
  const { language } = useLanguage();
  const router = useRouter();
  const { currentUser } = useStore();
  const firstName = currentUser?.name ? currentUser.name.split(" ")[0] : undefined;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 32 }} style={{ backgroundColor: colors.background }}>
      <Head>
        <title>{translateCopy("Hoş geldin — Nasıl başlamak istersin? | OrtakSat", language)}</title>
        <meta name="description" content={translateCopy("OrtakSat'a hoş geldin. Satıcı olarak ürününü komisyonla sattır, ortak olarak sosyal medyadan komisyon kazan, ya da ürünleri keşfet.", language)} />
        <link rel="canonical" href="https://www.ortaksat.com/hosgeldin" />
        <meta name="robots" content="noindex, follow" />
      </Head>

      <WebContainer max={1080} padding={16} style={{ gap: 18, paddingTop: 22 }}>
        {/* Karşılama */}
        <View style={{ gap: 8 }}>
          <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}>
            <MaterialCommunityIcons name="hand-wave" size={15} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Hoş geldin", language)}{firstName ? `, ${firstName}` : ""}!</Text>
          </View>
          <Text style={{ color: colors.ink, fontSize: isWideWeb ? 30 : 25, fontWeight: "900", lineHeight: isWideWeb ? 36 : 30 }}>{translateCopy("Nasıl başlamak istersin?", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 14.5, fontWeight: "600", lineHeight: 22, maxWidth: 640 }}>
            {translateCopy("OrtakSat; satıcı, ortak ve alıcıyı buluşturan ücretsiz bir ortak satış platformu. Aşağıdan sana uygun olanı seç — istediğin zaman diğerlerini de yapabilirsin.", language)}
          </Text>
        </View>

        {/* Rol kartları */}
        <View style={{ flexDirection: isWideWeb ? "row" : "column", gap: 14 }}>
          {ROLES.map((r) => (
            <View key={r.title} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flex: 1, gap: 12, minWidth: 0, padding: 20 }}>
              <View style={{ alignItems: "center", backgroundColor: r.tint, borderRadius: 14, height: 52, justifyContent: "center", width: 52 }}>
                <MaterialCommunityIcons name={r.icon} size={26} color={r.accent} />
              </View>
              <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900", lineHeight: 22 }}>{translateCopy(r.title, language)}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>{translateCopy(r.desc, language)}</Text>
              <View style={{ gap: 6 }}>
                {r.points.map((p) => (
                  <View key={p} style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                    <MaterialCommunityIcons name="check-circle" size={14} color={r.accent} />
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{translateCopy(p, language)}</Text>
                  </View>
                ))}
              </View>
              <Pressable onPress={() => router.push(r.href)} style={{ alignItems: "center", backgroundColor: r.accent, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: "auto", paddingVertical: 12 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{translateCopy(r.cta, language)}</Text>
                <MaterialCommunityIcons name="arrow-right" size={17} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>

        {/* Alt aksiyonlar */}
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 14, justifyContent: "center", marginTop: 4 }}>
          <Link href="/nasil-calisir" asChild>
            <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Nasıl çalışır?", language)}</Text>
            </Pressable>
          </Link>
          <Text style={{ color: colors.subtle }}>·</Text>
          <Pressable onPress={() => router.replace("/")} accessibilityRole="button" style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "800" }}>{translateCopy("Şimdilik atla", language)}</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={colors.muted} />
          </Pressable>
        </View>
      </WebContainer>
    </ScrollView>
  );
}
