import { Link } from "expo-router";
import Head from "expo-router/head";
import { Fragment, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { WebFooter } from "@/components/web-landing";
import { useStore } from "@/lib/use-store";

/**
 * Admin panelden düzenlenen içerik sayfasını (content_pages) gösterir. DB'de o
 * slug için içerik varsa onu render eder (SEO Head dahil); yoksa `fallback`
 * (mevcut statik tasarım) gösterilir. Böylece admin isterse sayfayı ezer, aksi
 * halde tasarım korunur.
 */
export function ContentPageView({ slug, fallback }: { slug: string; fallback?: ReactNode }) {
  const { contentPages } = useStore();
  const page = contentPages.find((p) => p.slug === slug && p.body.trim().length > 0);
  if (!page) return <Fragment>{fallback ?? <NotFound />}</Fragment>;

  const paras = page.body.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, gap: 16, paddingHorizontal: 20, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
      <Head>
        {page.seoTitle ? <title>{page.seoTitle}</title> : null}
        {page.seoDescription ? <meta name="description" content={page.seoDescription} /> : null}
        {page.seoTitle ? <meta property="og:title" content={page.seoTitle} /> : null}
        {page.seoDescription ? <meta property="og:description" content={page.seoDescription} /> : null}
      </Head>
      <View style={{ alignSelf: "center", gap: 14, maxWidth: 820, width: "100%" }}>
        <Text style={{ color: colors.ink, fontSize: 28, fontWeight: "900", lineHeight: 34 }}>{page.title || slug}</Text>
        {paras.map((p, i) => (
          <Text key={i} selectable style={{ color: colors.muted, fontSize: 15, fontWeight: "500", lineHeight: 24 }}>{p}</Text>
        ))}
      </View>
      <WebFooter />
    </ScrollView>
  );
}

function NotFound() {
  return (
    <ScrollView contentContainerStyle={{ backgroundColor: colors.background, gap: 12, padding: 24 }} style={{ backgroundColor: colors.background }}>
      <View style={{ alignSelf: "center", gap: 12, maxWidth: 760, width: "100%" }}>
        <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>Sayfa bulunamadı</Text>
        <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Bu sayfa henüz yayınlanmamış olabilir.</Text>
        <Link href="/" asChild>
          <Pressable style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Ana sayfaya dön</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}
