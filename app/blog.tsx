import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from "react-native";

import { BlogCover, blogCoverHasImage } from "@/components/blog-cover";
import { BlogMeta, BlogPostCard, NarrowOnly, WideOnly, useBlogWide } from "@/components/blog-post-card";
import { Mascot } from "@/components/brand/Mascot";
import { colors } from "@/components/colors";
import { PressLink } from "@/components/ui";
import { subscribeNewsletterLive } from "@/lib/live-service";
import { WebFooter } from "@/components/web-landing";
import { BLOG_CATEGORIES, BLOG_POSTS, BLOG_TOPICS, blogPostMatches, fromManagedPost, mergeBlogPosts, type BlogCategory } from "@/lib/blog";
import { useStore } from "@/lib/use-store";

/**
 * BLOG ANA SAYFASI (2026-11-15'te güçlendirildi).
 * - Kapaklar kodla çizilir (components/blog-cover.tsx); dışarıdan fotoğraf bağlanmaz.
 * - Yazılar tarihe göre en yeni önce; blog içinde arama + kategori süzgeci (sayılarıyla) + konu kısayolları.
 * - "Popüler yazılar" başlığı kaldırıldı: okunma sayısı tutulmuyor, olmayan bir ölçümü ima ediyordu →
 *   "Editörün seçtikleri" (hazır yazıların editoryal sırası).
 * - Düzen CSS ile duyarlıdır (app/+html.tsx → data-blog-*): JS ile genişlik okumak sayfayı yüklenince kaydırıyordu.
 * - Taban stil TELEFON içindir (küçük başlık, 140 px kapak, satır kartları); 760 px üstünü CSS büyütür. Uygulamada
 *   tablet genişliği `useBlogWide` ile okunur (bkz. components/blog-post-card.tsx).
 * - Renkler: yalnız marka mavisi + lacivert + nötr tonlar.
 */
const heading = (level: 1 | 2 | 3) => ({ role: "heading", "aria-level": level }) as Record<string, unknown>;

export default function BlogPage() {
  const [active, setActive] = useState<BlogCategory | "Tümü">("Tümü");
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [subState, setSubState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [subMsg, setSubMsg] = useState("");
  const scrollRef = useRef<ScrollViewInstance>(null);
  const wide = useBlogWide();

  async function subscribe() {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setSubState("error"); setSubMsg("Geçerli bir e-posta adresi gir."); return; }
    setSubState("saving");
    try {
      const res = await subscribeNewsletterLive(value);
      if (res.ok) { setSubState("done"); setSubMsg("Kaydın alındı. Yeni içerikler yayınlandıkça haber vereceğiz."); setEmail(""); }
      else { setSubState("error"); setSubMsg("Şu an kaydedilemedi, lütfen daha sonra tekrar dene."); }
    } catch {
      setSubState("error"); setSubMsg("Şu an kaydedilemedi, lütfen daha sonra tekrar dene.");
    }
  }

  const { blogPosts } = useStore();
  // Yönetim panelinden eklenen (yayında olan) yazılar hazır yazılarla birleşir; en yeni önce.
  const allPosts = useMemo(() => mergeBlogPosts(blogPosts.filter((p) => p.status === "published").map(fromManagedPost)), [blogPosts]);

  const searching = query.trim().length > 0;
  const filtering = searching || active !== "Tümü";
  const featured = allPosts.find((p) => p.featured) ?? allPosts[0];
  const matches = useMemo(() => allPosts.filter((p) => (active === "Tümü" || p.category === active) && blogPostMatches(p, query)), [active, allPosts, query]);
  // Süzgeç yokken öne çıkan yazı üstte ayrı durur, ızgarada tekrar edilmez; süzgeç varken sonuçların hepsi ızgaradadır.
  const grid = filtering ? matches : matches.filter((p) => p.slug !== featured.slug);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const post of allPosts) map.set(post.category, (map.get(post.category) ?? 0) + 1);
    return map;
  }, [allPosts]);
  const picks = BLOG_POSTS.slice(0, 5);
  const recent = allPosts.slice(0, 5);

  function clearFilters() { setQuery(""); setActive("Tümü"); }
  function pickTopic(value: string) {
    setActive("Tümü");
    setQuery(value);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  return (
    <ScrollView ref={scrollRef} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
      <Head>
        <title>Blog — Ortak satış, komisyon ve pazarlama rehberi | OrtakSat</title>
        <meta name="description" content="OrtakSat blog: ortak satış, komisyon, referans pazarlama, ilan optimizasyonu ve güvenli alışveriş üzerine rehberler. Satıcı ve ortaklar için pratik ipuçları." />
        <link rel="canonical" href="https://www.ortaksat.com/blog" />
        <meta property="og:title" content="OrtakSat Blog — Ortak satış rehberleri" />
        <meta property="og:description" content="Ortak satış, komisyon ve referans pazarlama üzerine pratik rehberler." />
        <meta property="og:url" content="https://www.ortaksat.com/blog" />
      </Head>
      <View style={{ alignSelf: "center", gap: 14, maxWidth: 1280, paddingHorizontal: 16, paddingTop: 14, width: "100%" }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
          <Link href="/" asChild><Pressable accessibilityRole="link"><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Ana Sayfa</Text></Pressable></Link>
          <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>Blog</Text>
        </View>

        {/* ---- Üst şerit: başlık + blog içi arama ---- */}
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 18, flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 14, paddingVertical: 14 }}>
          <View style={{ alignItems: "center", flexBasis: 280, flexDirection: "row", flexGrow: 1, gap: 12, minWidth: 0 }}>
            <Mascot name="idea" size={60} priority panel panelColor="#FFFFFF" />
            <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
              <Text accessibilityRole="header" {...heading(1)} dataSet={{ blogH1: "1" }} style={{ color: colors.ink, fontSize: wide ? 28 : 22, fontWeight: "900", lineHeight: wide ? 34 : 28 }}>OrtakSat Blog</Text>
              <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 19 }}>Ortak satış, komisyon, e-ticaret ve güvenli alışveriş üzerine sade rehberler.</Text>
            </View>
          </View>
          <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexBasis: 280, flexDirection: "row", flexGrow: 1, gap: 8, maxWidth: 440, minHeight: 46, minWidth: 0, paddingHorizontal: 12 }}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.primaryDark} />
            <TextInput testID="blog-search" accessibilityLabel="Blogda ara" value={query} onChangeText={setQuery} placeholder="Blogda ara: komisyon, kargo, Instagram…" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "600", height: 44, minWidth: 0 }} />
            {searching ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" hitSlop={8} onPress={() => setQuery("")}>
                <MaterialCommunityIcons name="close-circle" size={19} color={colors.subtle} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View dataSet={{ blogWrap: "1" }} style={{ alignItems: "flex-start", flexDirection: wide ? "row" : "column", gap: wide ? 20 : 16 }}>
          {/* ---- Ana sütun ---- */}
          <View style={{ alignSelf: "stretch", flex: 1, gap: 16, minWidth: 0 }}>
            {!filtering ? (
              <View dataSet={{ blogFeat: "1" }} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flexDirection: wide ? "row" : "column-reverse", gap: wide ? 18 : 12, overflow: "hidden", padding: wide ? 18 : 12 }}>
                <View dataSet={{ blogFeattext: "1" }} style={[{ gap: 9, minWidth: 0 }, wide ? { flex: 1.1, justifyContent: "center" } : null]}>
                  <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <MaterialCommunityIcons name="star-four-points-outline" size={12} color={colors.primaryDark} />
                    <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>Öne çıkan yazı · {featured.category}</Text>
                  </View>
                  <Text accessibilityRole="header" {...heading(2)} dataSet={{ blogFeatTitle: "1" }} style={{ color: colors.ink, fontSize: wide ? 24 : 18, fontWeight: "900", lineHeight: wide ? 30 : 24 }}>{featured.title}</Text>
                  <Text numberOfLines={3} style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>{featured.excerpt}</Text>
                  <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
                    <BlogMeta icon="clock-outline" text={`${featured.readMin} dk okuma`} />
                    <BlogMeta icon="calendar-blank-outline" text={featured.date} />
                  </View>
                  <PressLink href={{ pathname: "/blog/[slug]", params: { slug: featured.slug } }} accessibilityLabel={`${featured.title} — yazıyı oku`} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 6, minHeight: 42, paddingHorizontal: 18 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>Yazıyı Oku</Text>
                    <MaterialCommunityIcons name="arrow-right" size={17} color="#FFFFFF" />
                  </PressLink>
                </View>
                <View dataSet={{ blogFeatimg: "1" }} style={wide ? { borderRadius: 14, flex: 1, height: 220, minHeight: 220, overflow: "hidden" } : { borderRadius: 12, height: 132, minHeight: 132, overflow: "hidden" }}>
                  {blogCoverHasImage(featured) ? <BlogCover post={featured} /> : (
                    <>
                      <NarrowOnly wide={wide} style={{ height: "100%", width: "100%" }}><BlogCover post={featured} variant="card" /></NarrowOnly>
                      <WideOnly wide={wide} style={{ height: "100%", width: "100%" }}><BlogCover post={featured} variant="hero" /></WideOnly>
                    </>
                  )}
                </View>
              </View>
            ) : null}

            {/* Kategori süzgeci */}
            {/* Tek satır + yatay kaydırma: telefonda üç satır çip yerine bir satır; geniş ekranda zaten sığar. */}
            <ScrollView horizontal accessibilityRole="tablist" showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
              {(["Tümü", ...BLOG_CATEGORIES] as Array<BlogCategory | "Tümü">).map((cat) => {
                const on = active === cat;
                const count = cat === "Tümü" ? allPosts.length : counts.get(cat) ?? 0;
                return (
                  <Pressable key={cat} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setActive(cat)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 36, paddingHorizontal: 13 }}>
                    <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "800" }}>{cat}</Text>
                    <Text style={{ color: on ? "#D7E2F6" : colors.subtle, fontSize: 12, fontWeight: "800" }}>{count}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {filtering ? (
              <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <Text testID="blog-result-count" style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>
                  {searching ? `“${query.trim()}” için ${matches.length} yazı` : `${active}: ${matches.length} yazı`}
                </Text>
                <Pressable accessibilityRole="button" onPress={clearFilters} style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                  <MaterialCommunityIcons name="close" size={15} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Süzgeci temizle</Text>
                </Pressable>
              </View>
            ) : null}

            {grid.length === 0 ? (
              <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 8, padding: 36 }}>
                <MaterialCommunityIcons name="text-box-search-outline" size={32} color={colors.primary} />
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900", textAlign: "center" }}>{searching ? "Aramana uyan yazı bulunamadı" : "Bu kategoride henüz yazı yok"}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", textAlign: "center" }}>{searching ? "Daha kısa ya da farklı bir sözcük dene." : "Başka bir kategori seçmeyi dene."}</Text>
                <Pressable accessibilityRole="button" onPress={clearFilters} style={{ alignItems: "center", borderColor: colors.primary, borderRadius: 10, borderWidth: 1.5, justifyContent: "center", marginTop: 4, minHeight: 40, paddingHorizontal: 16 }}>
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Tüm yazıları göster</Text>
                </Pressable>
              </View>
            ) : (
              <View testID="blog-grid" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {grid.map((post) => <BlogPostCard key={post.slug} post={post} wide={wide} />)}
                {/* Görünmez dolgular (yalnız geniş düzende): son satırdaki kartlar diğerleriyle aynı genişlikte kalır. */}
                <WideOnly wide={wide} style={FILLER}>{null}</WideOnly>
                <WideOnly wide={wide} style={FILLER}>{null}</WideOnly>
                <WideOnly wide={wide} style={FILLER}>{null}</WideOnly>
              </View>
            )}
          </View>

          {/* ---- Yan sütun (mobilde altta, tam genişlik). Koşulsuz çizilir → sunucu çıktısıyla aynı. ---- */}
          <View dataSet={{ blogSide: "1" }} style={wide ? { flexBasis: 320, flexGrow: 0, flexShrink: 0, gap: 16, width: 320 } : { gap: 14, width: "100%" }}>
            <SideCard title="Editörün seçtikleri">
              {picks.map((post, i) => (
                <PressLink key={post.slug} href={{ pathname: "/blog/[slug]", params: { slug: post.slug } }} accessibilityLabel={post.title} pressedOpacity={0.8} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                  <View style={{ borderRadius: 10, height: 46, overflow: "hidden", width: 46 }}>
                    <BlogCover post={post} variant="thumb" />
                  </View>
                  <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                    <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 13, fontWeight: "800", lineHeight: 17 }}>{post.title}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{post.readMin} dk okuma</Text>
                  </View>
                  <Text style={{ color: "#B4C6E8", fontSize: 20, fontWeight: "900" }}>{i + 1}</Text>
                </PressLink>
              ))}
            </SideCard>

            <SideCard title="Son yazılar">
              {recent.map((post) => (
                <PressLink key={post.slug} href={{ pathname: "/blog/[slug]", params: { slug: post.slug } }} accessibilityLabel={post.title} pressedOpacity={0.8} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{post.title}</Text>
                  <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "700" }}>{post.dateShort}</Text>
                </PressLink>
              ))}
            </SideCard>

            <SideCard title="Konular">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {BLOG_TOPICS.map((topic) => (
                  <Pressable key={topic.label} accessibilityRole="button" accessibilityLabel={`${topic.label} konulu yazılar`} onPress={() => pickTopic(topic.query)} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 34, paddingHorizontal: 12 }}>
                    <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{topic.label}</Text>
                  </Pressable>
                ))}
              </View>
            </SideCard>

            <View style={{ backgroundColor: colors.primarySoft, borderRadius: 16, gap: 10, padding: 16 }}>
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>Yeni rehberler e-postana gelsin</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>Ortak satış ipuçları ve yeni yazılar yayınlandıkça haber veririz.</Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <TextInput accessibilityLabel="E-posta adresin" value={email} onChangeText={(v) => { setEmail(v); if (subState !== "idle") setSubState("idle"); }} onSubmitEditing={() => void subscribe()} placeholder="E-posta adresin" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 14, fontWeight: "600", height: 44, minWidth: 0, paddingHorizontal: 12 }} />
                <Pressable accessibilityRole="button" disabled={subState === "saving"} onPress={() => void subscribe()} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, height: 44, justifyContent: "center", opacity: subState === "saving" ? 0.6 : 1, paddingHorizontal: 16 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{subState === "saving" ? "…" : subState === "done" ? "✓" : "Abone Ol"}</Text>
                </Pressable>
              </View>
              {subState === "done" || subState === "error" ? (
                <Text accessibilityLiveRegion="polite" style={{ color: subState === "done" ? colors.primaryDark : colors.accent, fontSize: 12, fontWeight: "800" }}>{subMsg}</Text>
              ) : null}
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>İstediğin zaman abonelikten çıkabilirsin.</Text>
            </View>

            <View style={{ backgroundColor: colors.primaryDark, borderRadius: 16, gap: 10, padding: 16 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>Ortak satışa yeni misin?</Text>
              <Text style={{ color: "#D7E2F6", fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>Satıcı, ortak ve alıcı için adım adım anlatım: kim ne yapar, komisyon nasıl ödenir.</Text>
              <PressLink href="/nasil-calisir" accessibilityLabel="OrtakSat nasıl çalışır?" style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 10, flexDirection: "row", gap: 6, minHeight: 40, paddingHorizontal: 14 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Nasıl çalışır?</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primaryDark} />
              </PressLink>
            </View>
          </View>
        </View>
      </View>

      <View style={{ height: 26 }} />
      <WebFooter />
    </ScrollView>
  );
}

const FILLER = { flexBasis: 250, flexGrow: 1, height: 0, maxWidth: 420, minWidth: 0 } as const;

function SideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
      <Text accessibilityRole="header" {...heading(2)} style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{title}</Text>
      {children}
    </View>
  );
}
