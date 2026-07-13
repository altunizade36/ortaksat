import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { Fragment, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/use-store";

/**
 * Admin panelden düzenlenen içerik sayfasını (content_pages) gösterir. DB'de o
 * slug için içerik varsa onu render eder (SEO Head dahil); yoksa `fallback`
 * (mevcut statik tasarım) gösterilir. Böylece admin isterse sayfayı ezer, aksi
 * halde tasarım korunur.
 */
export function ContentPageView({ slug, fallback }: { slug: string; fallback?: ReactNode }) {
  const { language } = useLanguage();
  const { contentPages } = useStore();
  const page = contentPages.find((p) => p.slug === slug && p.body.trim().length > 0);
  if (!page) return <Fragment>{fallback ?? <NotFound />}</Fragment>;

  const paras = page.body.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, gap: 16, paddingHorizontal: 20, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
      <Head>
        <title>{page.seoTitle || `${page.title || slug} — OrtakSat`}</title>
        {page.seoDescription ? <meta name="description" content={page.seoDescription} /> : null}
        <meta property="og:title" content={page.seoTitle || `${page.title || slug} — OrtakSat`} />
        {page.seoDescription ? <meta property="og:description" content={page.seoDescription} /> : null}
      </Head>
      <View style={{ alignSelf: "center", gap: 14, maxWidth: 1280, width: "100%" }}>
        {/* Breadcrumb — kullanıcı her zaman ana sayfaya dönebilir. */}
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          <Link href="/" asChild>
            <Pressable style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 3, opacity: pressed ? 0.7 : 1 })}>
              <MaterialCommunityIcons name="home-outline" size={14} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Ana sayfa", language)}</Text>
            </Pressable>
          </Link>
          <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{page.title || slug}</Text>
        </View>
        <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: 28, fontWeight: "900", lineHeight: 34 }}>{page.title || slug}</Text>
        {paras.map((p, i) => (
          <Text key={i} selectable style={{ color: colors.muted, fontSize: 15, fontWeight: "500", lineHeight: 24 }}>{p}</Text>
        ))}
      </View>
      <WebFooter />
    </ScrollView>
  );
}

function NotFound() {
  const { language } = useLanguage();
  return (
    <ScrollView contentContainerStyle={{ backgroundColor: colors.background, gap: 12, padding: 24 }} style={{ backgroundColor: colors.background }}>
      <View style={{ alignSelf: "center", gap: 12, maxWidth: 760, width: "100%" }}>
        <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{translateCopy("Sayfa bulunamadı", language)}</Text>
        <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>{translateCopy("Bu sayfa henüz yayınlanmamış olabilir.", language)}</Text>
        <Link href="/" asChild>
          <Pressable style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Ana sayfaya dön", language)}</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}
