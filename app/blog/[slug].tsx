import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { WebFooter } from "@/components/web-landing";
import { BLOG_POSTS, getPost, type BlogCategory, type BlogPost } from "@/lib/blog";
import { WebContainer } from "@/components/web-container";
import { useStore } from "@/lib/use-store";

// Statik export: her blog yazısını build'de kendi başlık/meta/içeriğiyle önceden
// üret (SEO — her URL benzersiz başlıkla, JS beklemeden indekslenir).
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export default function BlogPostPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { blogPosts } = useStore();
  const db = blogPosts.find((p) => p.slug === slug && p.status === "published");
  const post: BlogPost | undefined = db
    ? { slug: db.slug, category: db.category as BlogCategory, title: db.title, excerpt: db.excerpt, author: db.author, authorRole: db.authorRole, readMin: db.readMin, date: db.createdAt, dateShort: db.createdAt.slice(5), image: db.image, featured: db.featured, body: db.body }
    : getPost(slug);

  if (!post) {
    return (
      <ScrollView contentContainerStyle={{ backgroundColor: colors.background, padding: 24 }} style={{ backgroundColor: colors.background }}>
        <WebContainer max={760} padding={0} style={{ gap: 12 }}>
          <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>Yazı bulunamadı</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Aradığın yazı kaldırılmış ya da bağlantı geçersiz olabilir.</Text>
          <Link href="/blog" asChild>
            <Pressable style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Blog'a dön</Text>
            </Pressable>
          </Link>
        </WebContainer>
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
  const metaUrl = `https://ortaksat.com/blog/${post.slug}`;
  const articleLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: metaDesc,
    image: [post.image].filter(Boolean),
    articleSection: post.category,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: "OrtakSat", logo: { "@type": "ImageObject", url: "https://ortaksat.com/apple-touch-icon.png" } },
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
        <meta property="og:image" content={post.image} />
        <meta property="og:url" content={metaUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDesc} />
        <meta name="twitter:image" content={post.image} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleLd }} />
      </Head>
      <WebContainer max={820} padding={20} style={{ gap: 16 }}>
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Link href="/" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Ana Sayfa</Text></Pressable></Link>
          <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
          <Link href="/blog" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Blog</Text></Pressable></Link>
          <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800", maxWidth: 360 }}>{post.title}</Text>
        </View>

        <View style={{ alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>{post.category}</Text>
        </View>
        <Text style={{ color: colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 38 }}>{post.title}</Text>

        <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 40, justifyContent: "center", width: 40 }}>
            <MaterialCommunityIcons name="account" size={22} color={colors.primaryDark} />
          </View>
          <View style={{ gap: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{post.author}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{post.date} · {post.readMin} dk okuma</Text>
          </View>
        </View>

        <View style={{ backgroundColor: colors.line, borderRadius: 16, height: 360, overflow: "hidden", width: "100%" }}>
          <SafeRemoteImage uri={post.image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={160} />
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
                  onPress={() => void Linking.openURL(source.url)}
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

        <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 14, marginTop: 8, paddingTop: 20 }}>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>İlgili yazılar</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            {fallbackRelated.map((rp) => (
              <Link key={rp.slug} href={{ pathname: "/blog/[slug]", params: { slug: rp.slug } }} asChild>
                <Pressable dataSet={{ card: "listing" }} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 220, flexGrow: 1, maxWidth: 360, overflow: "hidden" }}>
                  <View style={{ backgroundColor: colors.line, height: 110, width: "100%" }}>
                    <SafeRemoteImage uri={rp.image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={140} />
                  </View>
                  <View style={{ gap: 4, padding: 12 }}>
                    <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800", lineHeight: 18 }}>{rp.title}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{rp.readMin} dk okuma</Text>
                  </View>
                </Pressable>
              </Link>
            ))}
          </View>
          <Link href="/blog" asChild>
            <Pressable style={{ alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 6 }}>
              <MaterialCommunityIcons name="arrow-left" size={18} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>Tüm yazılara dön</Text>
            </Pressable>
          </Link>
        </View>
      </WebContainer>

      <WebFooter />
    </ScrollView>
  );
}

function ArticleBlock({ text }: { text: string }) {
  const isNote = text.startsWith("Not:");
  const numbered = text.match(/^(\d+)\.\s(.+?)\.\s(.+)/);

  if (isNote) {
    return (
      <View style={{ backgroundColor: colors.infoSoft, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 6, padding: 14 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
          <MaterialCommunityIcons name="information-outline" size={17} color={colors.info} />
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
