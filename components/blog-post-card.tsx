import { Link } from "expo-router";
import type { ReactNode } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";

import { BlogCover, blogCoverHasImage } from "@/components/blog-cover";
import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import type { BlogPost } from "@/lib/blog";

/**
 * BLOG — DAR / GENİŞ EKRAN DÜZENİ (2026-11-15).
 *
 * Sorun: telefonda her yazı tam genişlikte, 150 px kapaklı dev bir karttı (20 yazı ≈ 6500 px kaydırma), yazı
 * sayfasında başlık 30 px'ti → "aşırı büyük, ölçüsüz". Telefonda artık küçük kapaklı YATAY SATIR kartı kullanılır.
 *
 * Genişlik nasıl seçilir:
 * - WEB: JS genişlik OKUMAZ (sunucuda üretilen sayfa her genişlikte aynı HTML olmalı; JS ile seçmek sayfayı yüklenince
 *   kaydırıyor ve hydration uyuşmazlığı üretiyordu). Taban stil DAR ekrandır; 760 px ve üstünü app/+html.tsx içindeki
 *   `data-blog-*` kuralları geniş düzene çevirir. Yalnız-geniş / yalnız-dar parçalar da aynı kurallarla açılıp kapanır.
 * - UYGULAMA: pencere genişliği doğrudan okunur (tablet → geniş düzen).
 * Yeni bir `data-blog-*` adı eklersen app/+html.tsx içindeki kuralı da ekle; yoksa masaüstünde dar görünüm kalır.
 */
export const BLOG_WIDE_MIN = 760;

/** Uygulamada tablet genişliği; web'de HER ZAMAN false (geniş düzeni CSS verir). */
export function useBlogWide() {
  const { width } = useWindowDimensions();
  return Platform.OS !== "web" && width >= BLOG_WIDE_MIN;
}

export function NarrowOnly({ wide, children, style }: { wide: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  if (Platform.OS !== "web") return wide ? null : <View style={style}>{children}</View>;
  return <View dataSet={{ blogOnlyNarrow: "1" }} style={style}>{children}</View>;
}

export function WideOnly({ wide, children, style }: { wide: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  if (Platform.OS !== "web") return wide ? <View style={style}>{children}</View> : null;
  return <View dataSet={{ blogOnlyWide: "1" }} style={[style, { display: "none" }]}>{children}</View>;
}

const fill: ViewStyle = { height: "100%", width: "100%" };

/**
 * Yazı kartı. Dar ekranda: solda 88 px kapak, sağda kategori + başlık + süre/tarih (≈110 px yükseklik).
 * Geniş ekranda: üstte 150 px kapak, altında başlık + özet + süre/tarih (ızgara kartı).
 */
export function BlogPostCard({ post, wide }: { post: BlogPost; wide: boolean }) {
  const hasImage = blogCoverHasImage(post);
  return (
    <Link href={{ pathname: "/blog/[slug]", params: { slug: post.slug } }} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={post.title} dataSet={{ card: "blog", blogCard: "1" }}
        style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: wide ? 250 : "100%", flexDirection: wide ? "column" : "row", flexGrow: 1, maxWidth: wide ? 420 : undefined, minWidth: 0, overflow: "hidden" }}>
        <View dataSet={{ blogCardCover: "1" }} style={wide ? { height: 150, width: "100%" } : { borderRadius: 12, height: 88, margin: 10, marginRight: 0, overflow: "hidden", width: 88 }}>
          {hasImage ? <BlogCover post={post} /> : (
            <>
              <NarrowOnly wide={wide} style={fill}><BlogCover post={post} variant="tile" /></NarrowOnly>
              <WideOnly wide={wide} style={fill}><BlogCover post={post} variant="card" /></WideOnly>
            </>
          )}
          <WideOnly wide={wide} style={{ left: 10, position: "absolute", top: 10 }}>
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "900" }}>{post.category}</Text>
            </View>
          </WideOnly>
        </View>
        <View dataSet={{ blogCardBody: "1" }} style={{ flex: 1, gap: wide ? 8 : 4, justifyContent: wide ? "flex-start" : "center", minWidth: 0, padding: wide ? 14 : 10, paddingLeft: 12 }}>
          <NarrowOnly wide={wide}>
            <Text numberOfLines={1} style={{ color: colors.primary, fontSize: 11, fontWeight: "900" }}>{post.category}</Text>
          </NarrowOnly>
          <Text numberOfLines={3} {...({ role: "heading", "aria-level": 3 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: 14.5, fontWeight: "800", lineHeight: 19 }}>{post.title}</Text>
          <WideOnly wide={wide}>
            <Text numberOfLines={3} style={{ color: colors.muted, fontSize: 13, fontWeight: "500", lineHeight: 19 }}>{post.excerpt}</Text>
          </WideOnly>
          <NarrowOnly wide={wide}>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{post.readMin} dk okuma · {post.date}</Text>
          </NarrowOnly>
          <WideOnly wide={wide} style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: "auto", paddingTop: 10 }}>
            <BlogMeta icon="clock-outline" text={`${post.readMin} dk okuma`} />
            <BlogMeta icon="calendar-blank-outline" text={post.date} />
          </WideOnly>
        </View>
      </Pressable>
    </Link>
  );
}

export function BlogMeta({ icon, text }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
      <MaterialCommunityIcons name={icon} size={14} color={colors.muted} />
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}
