import { MaterialCommunityIcons } from "@/components/icons";
import { Link, useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { BlogCover, blogCoverHasImage } from "@/components/blog-cover";
import { BlogPostCard, NarrowOnly, WideOnly, useBlogWide } from "@/components/blog-post-card";
import { colors } from "@/components/colors";
import { PressLink } from "@/components/ui";
import { openUrlSafe } from "@/lib/link";
import { shareOrCopy } from "@/lib/share";
import { WebFooter } from "@/components/web-landing";
import { BLOG_POSTS, fromManagedPost, getPost, type BlogPost } from "@/lib/blog";
import { useStore } from "@/lib/use-store";

// Paylaşım / yapısal veri görseli: sitenin kendi kapağı (yazı kapakları kodla çizilir, dosyası yoktur).
const SHARE_IMAGE = "https://www.ortaksat.com/og-cover.png";
const heading = (level: 1 | 2 | 3) => ({ role: "heading", "aria-level": level }) as Record<string, unknown>;

// Statik export: her blog yazısını build'de kendi başlık/meta/içeriğiyle önceden
// üret (SEO — her URL benzersiz başlıkla, JS beklemeden indekslenir).
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export default function BlogPostPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { blogPosts } = useStore();
  // Kanca erken dönüşten ÖNCE (yazı bulunamadı dalı aşağıda) — sıra her çizimde aynı kalmalı.
  const [shareNote, setShareNote] = useState("");
  const wide = useBlogWide();
  const db = blogPosts.find((p) => p.slug === slug && p.status === "published");
  const post: BlogPost | undefined = db ? fromManagedPost(db) : getPost(slug);

  if (!post) {
    return (
      <ScrollView contentContainerStyle={{ backgroundColor: colors.background, padding: 24 }} style={{ backgroundColor: colors.background }}>
        <View style={{ alignSelf: "center", gap: 12, maxWidth: 760, width: "100%" }}>
          <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>Yazı bulunamadı</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Aradığın yazı kaldırılmış ya da bağlantı geçersiz olabilir.</Text>
          <Link href="/blog" asChild>
            <Pressable style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Blog'a dön</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    );
  }

  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug && p.category === post.category).slice(0, 3);
  const fallbackRelated = related.length > 0 ? related : BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);
  const sourceParagraph = post.body.find((para) => para.startsWith("Kaynaklar:"));
  const contentBody = post.body.filter((para) => !para.startsWith("Kaynaklar:"));
  const sources = parseSources(sourceParagraph);

  const metaTitle = `${post.title} | OrtakSat Blog`;
  const metaDesc = post.excerpt.replace(/\s+/g, " ").slice(0, 160);
  const metaUrl = `https://www.ortaksat.com/blog/${post.slug}`;
  const ownImage = post.image && /^https:\/\//i.test(post.image) && !/unsplash\.com/i.test(post.image) ? post.image : SHARE_IMAGE;
  const shareTitle = post.title;

  async function share() {
    const result = await shareOrCopy({ title: shareTitle, message: shareTitle, url: metaUrl });
    if (result === "copied") setShareNote("Bağlantı kopyalandı");
    else if (result === "failed") setShareNote("Paylaşılamadı; adres çubuğundaki bağlantıyı kopyalayabilirsin.");
    else setShareNote("");
  }
  const articleLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: metaDesc,
    image: [ownImage],
    articleSection: post.category,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: "OrtakSat", logo: { "@type": "ImageObject", url: "https://www.ortaksat.com/apple-touch-icon.png" } },
    mainEntityOfPage: metaUrl
  });

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 0, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={metaUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="OrtakSat" />
        <meta property="og:locale" content="tr_TR" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:image" content={ownImage} />
        <meta property="og:url" content={metaUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDesc} />
        <meta name="twitter:image" content={ownImage} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleLd }} />
      </Head>
      {/* Düz View: WebContainer uygulamada stilini (kenar boşluğu + aralık) UYGULAMAZ → metin ekran kenarına yapışıyordu. */}
      <View style={{ alignSelf: "center", gap: 14, maxWidth: 820, paddingHorizontal: 16, width: "100%" }}>
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Link href="/" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Ana Sayfa</Text></Pressable></Link>
          <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
          <Link href="/blog" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Blog</Text></Pressable></Link>
          {/* Yazının adı hemen altta başlık olarak duruyor; telefonda kırıntıda tekrar etmek satırı taşırıyordu. */}
          <WideOnly wide={wide} style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800", maxWidth: 360 }}>{post.title}</Text>
          </WideOnly>
        </View>

        <View style={{ alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>{post.category}</Text>
        </View>
        <Text accessibilityRole="header" {...heading(1)} dataSet={{ blogPostH1: "1" }} style={{ color: colors.ink, fontSize: wide ? 30 : 22, fontWeight: "900", lineHeight: wide ? 38 : 29 }}>{post.title}</Text>
        <Text dataSet={{ blogLead: "1" }} style={{ color: colors.muted, fontSize: wide ? 16 : 14.5, fontWeight: "600", lineHeight: wide ? 25 : 22 }}>{post.excerpt}</Text>

        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 40, justifyContent: "center", width: 40 }}>
            <MaterialCommunityIcons name="account-edit-outline" size={22} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1, gap: 1, minWidth: 150 }}>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{post.author}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{post.date} · {post.readMin} dk okuma</Text>
          </View>
          <Pressable testID="blog-share" accessibilityRole="button" accessibilityLabel="Yazıyı paylaş" onPress={() => void share()} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 10, borderWidth: 1.5, flexDirection: "row", gap: 6, minHeight: 40, paddingHorizontal: 14 }}>
            <MaterialCommunityIcons name="share-variant-outline" size={17} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Paylaş</Text>
          </Pressable>
        </View>
        {shareNote ? <Text accessibilityLiveRegion="polite" style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{shareNote}</Text> : null}

        <View dataSet={{ blogHero: "1" }} style={{ borderRadius: 14, height: wide ? 220 : 128, overflow: "hidden", width: "100%" }}>
          {blogCoverHasImage(post) ? <BlogCover post={post} /> : (
            <>
              <NarrowOnly wide={wide} style={{ height: "100%", width: "100%" }}><BlogCover post={post} variant="card" /></NarrowOnly>
              <WideOnly wide={wide} style={{ height: "100%", width: "100%" }}><BlogCover post={post} variant="hero" /></WideOnly>
            </>
          )}
        </View>

        <View style={{ gap: 16 }}>
          {contentBody.map((para, i) => (
            <ArticleBlock key={i} text={para} />
          ))}
        </View>

        {sources.length > 0 ? (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 16 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <MaterialCommunityIcons name="book-open-variant" size={18} color={colors.primaryDark} />
              <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Kaynaklar</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>
              Bu yazıdaki pazar verileri ve mevzuat notları aşağıdaki resmi veya referans kaynaklara göre hazırlanmıştır.
            </Text>
            <View style={{ gap: 8 }}>
              {sources.map((source, i) => (
                <Pressable
                  key={`${source.url}-${i}`}
                  onPress={() => void openUrlSafe(source.url)}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.line,
                    borderRadius: 12,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: 10,
                    opacity: pressed ? 0.78 : 1,
                    paddingHorizontal: 12,
                    paddingVertical: 10
                  })}
                >
                  <MaterialCommunityIcons name="link-variant" size={17} color={colors.primaryDark} />
                  <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 13, fontWeight: "800", lineHeight: 17 }}>{source.label}</Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{source.host}</Text>
                  </View>
                  <MaterialCommunityIcons name="open-in-new" size={15} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ backgroundColor: colors.primarySoft, borderRadius: 16, gap: 8, padding: 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>Editör Notu</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 20 }}>
            OrtakSat blog içerikleri bilgilendirme amaçlıdır. Vergi, tüketici hukuku, mesleki aracılık veya kişisel veri konularında işlem yapmadan önce ilgili resmi düzenlemeleri ve gerektiğinde uzman görüşünü kontrol etmek gerekir.
          </Text>
        </View>

        {/* Okuyan ne yapabilir: yazıdan doğrudan ürüne geçiş */}
        <View style={{ backgroundColor: colors.primaryDark, borderRadius: 16, gap: 10, padding: 16 }}>
          <Text {...heading(2)} style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "900", lineHeight: 23 }}>Okuduğunu uygulamaya hazır mısın?</Text>
          <Text style={{ color: "#D7E2F6", fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>İlan vermek ve üyelik ücretsiz. Satıcıysan ürününü ortaklara aç; ortaksan komisyonu sana uyan bir ilan seç.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <PressLink href="/create" accessibilityLabel="Ücretsiz ilan ver" style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, flexDirection: "row", gap: 6, minHeight: 44, paddingHorizontal: 16 }}>
              <MaterialCommunityIcons name="plus-circle-outline" size={17} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>Ücretsiz İlan Ver</Text>
            </PressLink>
            <PressLink href="/partner" accessibilityLabel="Ortaklık fırsatlarını gör" style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.5)", borderRadius: 10, borderWidth: 1.5, flexDirection: "row", gap: 6, minHeight: 44, paddingHorizontal: 16 }}>
              <MaterialCommunityIcons name="handshake-outline" size={17} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>Ortaklık Fırsatları</Text>
            </PressLink>
            <PressLink href="/nasil-calisir" accessibilityLabel="OrtakSat nasıl çalışır?" style={{ alignItems: "center", flexDirection: "row", gap: 5, minHeight: 44, paddingHorizontal: 6 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900", textDecorationLine: "underline" }}>Nasıl çalışır?</Text>
            </PressLink>
          </View>
        </View>

        <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 14, marginTop: 8, paddingTop: 20 }}>
          <Text {...heading(2)} style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>İlgili yazılar</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {fallbackRelated.map((rp) => <BlogPostCard key={rp.slug} post={rp} wide={wide} />)}
          </View>
          <Link href="/blog" asChild>
            <Pressable style={{ alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 6 }}>
              <MaterialCommunityIcons name="arrow-left" size={18} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>Tüm yazılara dön</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <WebFooter />
    </ScrollView>
  );
}

function ArticleBlock({ text }: { text: string }) {
  const isNote = text.startsWith("Not:");
  const numbered = text.match(/^(\d+)\.\s(.+?)\.\s(.+)/);

  if (isNote) {
    return (
      <View style={{ backgroundColor: colors.primarySoft, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 6, padding: 14 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
          <MaterialCommunityIcons name="information-outline" size={17} color={colors.primaryDark} />
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>Platform notu</Text>
        </View>
        <Text selectable style={{ color: colors.ink, fontSize: 14, fontWeight: "600", lineHeight: 22 }}>{text.replace(/^Not:\s*/, "")}</Text>
      </View>
    );
  }

  if (numbered) {
    return (
      <View style={{ gap: 6 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 16.5, fontWeight: "900", lineHeight: 23 }}>{numbered[1]}. {numbered[2]}</Text>
        <Text selectable style={{ color: colors.ink, fontSize: 16, fontWeight: "500", lineHeight: 26 }}>{numbered[3]}</Text>
      </View>
    );
  }

  return <Text selectable style={{ color: colors.ink, fontSize: 16, fontWeight: "500", lineHeight: 26 }}>{text}</Text>;
}

function parseSources(sourceParagraph?: string) {
  if (!sourceParagraph) return [];
  const raw = sourceParagraph.replace(/^Kaynaklar:\s*/, "");
  return raw.split(";").map((entry) => {
    const trimmed = entry.trim();
    const match = trimmed.match(/https?:\/\/\S+/);
    if (!match) return null;
    const url = match[0].replace(/[.,)]$/, "");
    const label = trimmed.slice(0, match.index).replace(/[,\s]+$/, "") || url;
    let host = url;
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    return { label, url, host };
  }).filter((source): source is { label: string; url: string; host: string } => Boolean(source));
}
