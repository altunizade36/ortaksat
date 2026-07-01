import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { subscribeNewsletterLive } from "@/lib/live-service";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { WebFooter } from "@/components/web-landing";
import { BLOG_CATEGORIES, BLOG_POSTS, POPULAR_TAGS, type BlogCategory, type BlogPost } from "@/lib/blog";
import { useIsWideWeb } from "@/lib/layout";
import { useStore } from "@/lib/use-store";

const CAT_COLOR: Record<BlogCategory, [string, string]> = {
  "Satış İpuçları": [colors.primarySoft, colors.primaryDark],
  "Komisyon Rehberleri": [colors.infoSoft, colors.info],
  "E-Ticaret": [colors.accentSoft, colors.accent],
  "Girişimcilik": [colors.violetSoft, colors.violet],
  "Pazarlama": [colors.goldSoft, colors.gold],
  "Başarı Hikayeleri": [colors.successSoft, colors.success]
};

export default function BlogPage() {
  const isWideWeb = useIsWideWeb();
  const [active, setActive] = useState<BlogCategory | "Tümü">("Tümü");
  const [email, setEmail] = useState("");
  const [subState, setSubState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [subMsg, setSubMsg] = useState("");

  async function subscribe() {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setSubState("error"); setSubMsg("Geçerli bir e-posta adresi gir."); return; }
    setSubState("saving");
    const res = await subscribeNewsletterLive(value);
    if (res.ok) { setSubState("done"); setSubMsg("Kaydın alındı. Yeni içerikler yayınlandıkça haber vereceğiz."); setEmail(""); }
    else { setSubState("error"); setSubMsg("Şu an kaydedilemedi, lütfen daha sonra tekrar dene."); }
  }

  const { blogPosts } = useStore();
  // Admin panelden eklenen (Supabase) yazıları statik yazılarla birleştir.
  const dbPosts: BlogPost[] = blogPosts.filter((p) => p.status === "published").map((p) => ({
    slug: p.slug, category: p.category as BlogCategory, title: p.title, excerpt: p.excerpt, author: p.author,
    authorRole: p.authorRole, readMin: p.readMin, date: p.createdAt, dateShort: p.createdAt.slice(5), image: p.image, featured: p.featured, body: p.body
  }));
  const ALL_POSTS: BlogPost[] = [...dbPosts, ...BLOG_POSTS.filter((s) => !dbPosts.some((d) => d.slug === s.slug))];

  const featured = ALL_POSTS.find((p) => p.featured) ?? ALL_POSTS[0];
  const rest = ALL_POSTS.filter((p) => p.slug !== featured.slug);
  const grid = active === "Tümü" ? rest : rest.filter((p) => p.category === active);
  const popular = ALL_POSTS.slice(0, 5);
  const recent = ALL_POSTS.slice().reverse().slice(0, 5);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, gap: 16, paddingBottom: 0, paddingHorizontal: 20, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
        <Link href="/" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Ana Sayfa</Text></Pressable></Link>
        <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>Blog</Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.ink, fontSize: 28, fontWeight: "900" }}>OrtakSat Blog</Text>
        <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600" }}>Ortak satış, e-ticaret ve girişimcilik üzerine rehberler, ipuçları ve ilham veren içerikler.</Text>
      </View>

      <View style={{ alignItems: "flex-start", flexDirection: isWideWeb ? "row" : "column", gap: 20 }}>
        {/* Main */}
        <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
          {/* Featured */}
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flexDirection: isWideWeb ? "row" : "column", gap: 20, overflow: "hidden", padding: 20 }}>
            <View style={{ flex: 1.1, gap: 12, justifyContent: "center", minWidth: 0 }}>
              <View style={{ alignSelf: "flex-start", backgroundColor: colors.goldSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: colors.gold, fontSize: 11, fontWeight: "900" }}>Öne Çıkan Yazı</Text>
              </View>
              <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900", lineHeight: 30 }}>{featured.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 21 }}>{featured.excerpt}</Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 36, justifyContent: "center", width: 36 }}>
                  <MaterialCommunityIcons name="account" size={20} color={colors.primaryDark} />
                </View>
                <View style={{ gap: 1 }}>
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{featured.author}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{featured.authorRole}</Text>
                </View>
              </View>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 16 }}>
                <Meta icon="clock-outline" text={`${featured.readMin} dk okuma`} />
                <Meta icon="calendar-blank-outline" text={featured.date} />
                <Link href={{ pathname: "/blog/[slug]", params: { slug: featured.slug } }} asChild>
                  <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, marginLeft: "auto", paddingHorizontal: 18, paddingVertical: 10 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Yazıyı Oku</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
            <View style={{ backgroundColor: colors.line, borderRadius: 14, flex: 1, height: 220, minWidth: isWideWeb ? 0 : undefined, overflow: "hidden", width: isWideWeb ? undefined : "100%" }}>
              <SafeRemoteImage uri={featured.image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={160} />
            </View>
          </View>

          {/* Category chips */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["Tümü", ...BLOG_CATEGORIES] as Array<BlogCategory | "Tümü">).map((cat) => {
              const on = active === cat;
              return (
                <Pressable key={cat} onPress={() => setActive(cat)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
                  <MaterialCommunityIcons name={cat === "Tümü" ? "view-grid-outline" : "tag-outline"} size={14} color={on ? "#FFFFFF" : colors.primary} />
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "800" }}>{cat}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Grid */}
          {grid.length === 0 ? (
            <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 6, padding: 40 }}>
              <MaterialCommunityIcons name="text-box-search-outline" size={30} color={colors.primary} />
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>Bu kategoride yazı yok</Text>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Başka bir kategori seçmeyi dene.</Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              {grid.map((post) => <PostCard key={post.slug} post={post} />)}
            </View>
          )}
        </View>

        {/* Sidebar */}
        {isWideWeb ? (
          <View style={{ gap: 16, width: 320 }}>
            <SideCard title="Popüler yazılar">
              {popular.map((post, i) => (
                <Link key={post.slug} href={{ pathname: "/blog/[slug]", params: { slug: post.slug } }} asChild>
                  <Pressable style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 10, opacity: pressed ? 0.8 : 1 })}>
                    <View style={{ alignItems: "center", borderColor: colors.primary, borderRadius: 999, borderWidth: 1.5, height: 26, justifyContent: "center", width: 26 }}>
                      <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{i + 1}</Text>
                    </View>
                    <View style={{ backgroundColor: colors.line, borderRadius: 8, height: 44, overflow: "hidden", width: 44 }}>
                      <SafeRemoteImage uri={post.image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={120} />
                    </View>
                    <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                      <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800", lineHeight: 16 }}>{post.title}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{post.readMin} dk okuma</Text>
                    </View>
                  </Pressable>
                </Link>
              ))}
            </SideCard>

            <SideCard title="Son yazılar" footerLabel="Tüm yazıları gör" footerHref="/blog">
              {recent.map((post) => (
                <Link key={post.slug} href={{ pathname: "/blog/[slug]", params: { slug: post.slug } }} asChild>
                  <Pressable style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 8, opacity: pressed ? 0.8 : 1 })}>
                    <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{post.title}</Text>
                    <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>{post.dateShort}</Text>
                  </Pressable>
                </Link>
              ))}
            </SideCard>

            <View style={{ backgroundColor: colors.primarySoft, borderRadius: 16, gap: 10, padding: 16 }}>
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>E-bültenimize abone olun</Text>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 18 }}>Ortak satış ipuçları, yeni rehberler ve özel içerikler mailinize gelsin.</Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <TextInput value={email} onChangeText={(v) => { setEmail(v); if (subState !== "idle") setSubState("idle"); }} placeholder="E-posta adresiniz" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13, fontWeight: "600", height: 42, paddingHorizontal: 12 }} />
                <Pressable disabled={subState === "saving"} onPress={() => void subscribe()} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, height: 42, justifyContent: "center", opacity: subState === "saving" ? 0.6 : 1, paddingHorizontal: 16 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{subState === "saving" ? "…" : subState === "done" ? "✓" : "Abone Ol"}</Text>
                </Pressable>
              </View>
              {subState === "done" || subState === "error" ? (
                <Text style={{ color: subState === "done" ? colors.success : colors.accent, fontSize: 11.5, fontWeight: "700" }}>{subMsg}</Text>
              ) : null}
              <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
                <MaterialCommunityIcons name="check-circle-outline" size={13} color={colors.primary} />
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>İstediğiniz zaman kolayca çıkış yapabilirsiniz.</Text>
              </View>
            </View>

            <SideCard title="Popüler etiketler">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {POPULAR_TAGS.map((tag) => (
                  <Link key={tag} href={{ pathname: "/explore", params: { q: tag.replace("#", "") } }} asChild>
                    <Pressable style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "700" }}>{tag}</Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            </SideCard>
          </View>
        ) : null}
      </View>

      <WebFooter />
    </ScrollView>
  );
}

function Meta({ icon, text }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
      <MaterialCommunityIcons name={icon} size={14} color={colors.muted} />
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  const [bg, fg] = CAT_COLOR[post.category];
  return (
    <Link href={{ pathname: "/blog/[slug]", params: { slug: post.slug } }} asChild>
      <Pressable dataSet={{ card: "listing" }} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 240, flexGrow: 1, maxWidth: 360, overflow: "hidden" }}>
        <View style={{ backgroundColor: colors.line, height: 150, width: "100%" }}>
          <SafeRemoteImage uri={post.image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={160} />
          <View style={{ left: 10, position: "absolute", top: 10 }}>
            <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Text style={{ color: fg, fontSize: 10, fontWeight: "900" }}>{post.category}</Text>
            </View>
          </View>
        </View>
        <View style={{ gap: 8, padding: 14 }}>
          <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 15, fontWeight: "800", lineHeight: 19, minHeight: 38 }}>{post.title}</Text>
          <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12.5, fontWeight: "500", lineHeight: 18 }}>{post.excerpt}</Text>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
            <Meta icon="clock-outline" text={`${post.readMin} dk okuma`} />
            <Meta icon="calendar-blank-outline" text={post.date} />
          </View>
          <View style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 8, paddingTop: 10 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 26, justifyContent: "center", width: 26 }}>
              <MaterialCommunityIcons name="account" size={15} color={colors.primaryDark} />
            </View>
            <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{post.author}</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function SideCard({ title, children, footerLabel, footerHref }: { title: string; children: ReactNode; footerLabel?: string; footerHref?: "/blog" }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
      <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{title}</Text>
      {children}
      {footerLabel && footerHref ? (
        <Link href={footerHref} asChild>
          <Pressable style={{ alignItems: "center", alignSelf: "flex-end", flexDirection: "row", gap: 4 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{footerLabel}</Text>
            <MaterialCommunityIcons name="arrow-right" size={15} color={colors.primaryDark} />
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}
