import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { WebContainer } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";

export type InfoSection = { heading?: string; body: string };

/**
 * Simple, centered content page used for static informational routes
 * (about, how-it-works, FAQ). Renders well on both web and mobile.
 * Kendi <title>/description'ını, ekmek-kırıntısı (breadcrumb) navigasyonunu,
 * semantik h1 başlığını ve alt bilgi (footer) çıkışını içerir; böylece
 * kullanıcı sayfadan kolayca ayrılabilir ve arama motorları başlığı görür.
 */
export function InfoPage({
  title,
  intro,
  sections,
  seoTitle,
  seoDescription
}: {
  title: string;
  intro?: string;
  sections: InfoSection[];
  seoTitle?: string;
  seoDescription?: string;
}) {
  const metaTitle = seoTitle || `${title} — OrtakSat`;
  const metaDesc = seoDescription || intro || `${title} — OrtakSat ortak satış ve ilan platformu.`;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 0, paddingTop: 16 }}>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
      </Head>
      <WebContainer max={1180} padding={16} style={{ gap: 18 }}>
        {/* Breadcrumb — kullanıcı her zaman ana sayfaya dönebilir. */}
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          <Link href="/" asChild>
            <Pressable style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 3, opacity: pressed ? 0.7 : 1 })}>
              <MaterialCommunityIcons name="home-outline" size={14} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Ana sayfa</Text>
            </Pressable>
          </Link>
          <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{title}</Text>
        </View>
        <View style={{ gap: 8 }}>
          <Text
            selectable
            accessibilityRole="header"
            {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)}
            style={{ color: colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 36 }}
          >
            {title}
          </Text>
          {intro ? (
            <Text selectable style={{ color: colors.muted, fontSize: 16, fontWeight: "600", lineHeight: 24 }}>
              {intro}
            </Text>
          ) : null}
        </View>
        {sections.map((section, index) => (
          <View key={section.heading ?? index} style={{ gap: 8 }}>
            {section.heading ? (
              <Text
                selectable
                accessibilityRole="header"
                {...({ role: "heading", "aria-level": 2 } as Record<string, unknown>)}
                style={{ color: colors.ink, fontSize: 19, fontWeight: "900" }}
              >
                {section.heading}
              </Text>
            ) : null}
            <Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "500", lineHeight: 23 }}>
              {section.body}
            </Text>
          </View>
        ))}
      </WebContainer>
      <WebFooter />
    </ScrollView>
  );
}
