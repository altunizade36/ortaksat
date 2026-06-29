import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { WebFooter } from "@/components/web-landing";
import { BLOG_POSTS, getPost } from "@/lib/blog";
import { WebContainer } from "@/components/web-container";

export default function BlogPostPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const post = getPost(slug);

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

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 0, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
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
          {post.body.map((para, i) => (
            <Text key={i} selectable style={{ color: colors.ink, fontSize: 16, fontWeight: "500", lineHeight: 26 }}>{para}</Text>
          ))}
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
