import { InformationPage } from "@/components/information-page";
import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { Fragment, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { PressLink } from "@/components/ui";
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
  return <InformationPage title={page.title || slug} seoTitle={page.seoTitle} path={`/${slug}`} intro={page.seoDescription || "OrtakSat hakkında güncel bilgiler ve destek."}>{paras.map((paragraph, i) => <View key={i} style={{ padding: 18, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 14 }}><Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 23 }}>{paragraph}</Text></View>)}</InformationPage>;

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
