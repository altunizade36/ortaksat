import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";

import { MaterialCommunityIcons } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import type { BlogCategory } from "@/lib/blog";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * BLOG KAPAĞI — kodla çizilir (2026-11-15). Eskiden yazı kapakları başka bir sitenin fotoğraf sunucusundan
 * bağlanıyordu: telif riski (kullanıcı kuralı: dışarıdan görsel çekilmez), aynı fotoğrafın birkaç yazıda tekrarı,
 * içinde üçüncü taraf marka logosu görünen kareler ve o sunucu yavaşladığında boş kutular. Artık her yazının
 * kapağı marka mavisinde bir zemin + yazının konusunu anlatan büyük simgedir; ağ isteği yoktur.
 *
 * Yönetim panelinden eklenen bir yazı KENDİ görsel adresini verdiyse o gösterilir (bkz. ownImage).
 * Renk kuralı: yalnız mavi/lacivert tonlar. Simge adları BURADA düz metin olmalı (yazı tipi alt kümesi kaynak tarar).
 */
const GRADIENTS: Array<readonly [string, string]> = [
  ["#1668F2", "#0645C9"],
  ["#0645C9", "#09275E"],
  ["#2F7BFF", "#0A4FD6"],
  ["#0B3A9E", "#061B45"],
  ["#3D8BFF", "#0645C9"],
  ["#0A4FD6", "#09275E"]
];

const CATEGORY_STYLE: Record<BlogCategory, { gradient: number; icon: IconName }> = {
  "Satış İpuçları": { gradient: 0, icon: "lightbulb-on-outline" },
  "Komisyon Rehberleri": { gradient: 1, icon: "percent-outline" },
  "E-Ticaret": { gradient: 2, icon: "cart-outline" },
  "Girişimcilik": { gradient: 3, icon: "rocket-launch-outline" },
  "Pazarlama": { gradient: 4, icon: "bullhorn-outline" },
  "Vaka Analizleri": { gradient: 5, icon: "chart-box-outline" }
};

/** Yazı adresindeki anahtar sözcüğe göre konu simgesi (ilk eşleşen kazanır). Eşleşme yoksa kategori simgesi. */
const TOPIC_ICONS: Array<[RegExp, IconName]> = [
  [/dolandiricilik/, "shield-alert-outline"],
  [/sahte-ilan|kirmizi-bayrak/, "flag-outline"],
  [/guven/, "shield-check-outline"],
  [/kargo|teslimat/, "truck-delivery-outline"],
  [/instagram/, "camera-outline"],
  [/tiktok|reels|video/, "video-outline"],
  [/whatsapp|telegram|grup/, "forum-outline"],
  [/influencer/, "account-star-outline"],
  [/sosyal-medya/, "share-variant-outline"],
  [/mesajlasma|iletisim/, "message-text-outline"],
  [/referans-linki|affiliate/, "link-variant"],
  [/ogrenci/, "school-outline"],
  [/sifir-sermaye|ek-gelir/, "wallet-outline"],
  [/donusum/, "chart-line"],
  [/trend/, "trending-up"],
  [/komisyon-oranlari/, "percent-outline"],
  [/altin-kural/, "trophy-outline"],
  [/ucretsiz|sattirirsin/, "storefront-outline"],
  [/hikaye|girisim/, "rocket-launch-outline"],
  [/ortak-satis/, "handshake-outline"]
];

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** Yalnız yazının KENDİ görseli gösterilir; eski dış fotoğraf sunucusu adresleri yok sayılır. */
function ownImage(uri?: string | null) {
  if (!uri || !/^https:\/\//i.test(uri)) return null;
  if (/(^|\.)unsplash\.com\//i.test(uri.replace(/^https:\/\//i, ""))) return null;
  return uri;
}

export function blogCoverIcon(slug: string, category: BlogCategory | string): IconName {
  for (const [pattern, icon] of TOPIC_ICONS) if (pattern.test(slug)) return icon;
  return (CATEGORY_STYLE[category as BlogCategory] ?? CATEGORY_STYLE["Satış İpuçları"]).icon;
}

export type BlogCoverPost = { slug: string; category: BlogCategory | string; title: string; image?: string | null };

/**
 * Bulunduğu kutuyu doldurur (yükseklik/genişlik ebeveynden gelir; ebeveyn overflow: "hidden" olmalı).
 * `thumb` küçük kare, `card` liste kartı, `hero` yazı sayfasının üst şeridi.
 */
export function BlogCover({ post, variant = "card" }: { post: BlogCoverPost; variant?: "thumb" | "card" | "hero" }) {
  const remote = ownImage(post.image);
  if (remote) {
    return <SafeRemoteImage uri={remote} alt={post.title} accessibilityLabel={post.title} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={160} />;
  }

  const seed = hash(post.slug);
  const base = (CATEGORY_STYLE[post.category as BlogCategory] ?? CATEGORY_STYLE["Satış İpuçları"]).gradient;
  const gradient = GRADIENTS[(base + (seed % 2)) % GRADIENTS.length];
  const icon = blogCoverIcon(post.slug, post.category);
  const mirrored = seed % 3 === 0;

  if (variant === "thumb") {
    return (
      <LinearGradient accessibilityRole="image" accessibilityLabel={post.title} colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ alignItems: "center", height: "100%", justifyContent: "center", width: "100%" }}>
        <MaterialCommunityIcons name={icon} size={22} color="#FFFFFF" />
      </LinearGradient>
    );
  }

  const hero = variant === "hero";
  const tile = hero ? 96 : 68;
  const ghost = hero ? 240 : 150;
  return (
    <LinearGradient accessibilityRole="image" accessibilityLabel={post.title} colors={gradient} start={{ x: mirrored ? 1 : 0, y: 0 }} end={{ x: mirrored ? 0 : 1, y: 1 }} style={{ alignItems: "center", height: "100%", justifyContent: "center", overflow: "hidden", width: "100%" }}>
      {/* yumuşak daireler — düz zemini kırar, simgenin arkasında derinlik verir */}
      <View pointerEvents="none" style={[{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, height: hero ? 300 : 190, position: "absolute", top: hero ? -120 : -80, width: hero ? 300 : 190 }, mirrored ? { left: -60 } : { right: -60 }]} />
      <View pointerEvents="none" style={[{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 999, bottom: hero ? -110 : -70, height: hero ? 230 : 150, position: "absolute", width: hero ? 230 : 150 }, mirrored ? { right: -40 } : { left: -40 }]} />
      {/* konunun soluk büyük izi */}
      <View pointerEvents="none" style={[{ bottom: hero ? -46 : -30, position: "absolute" }, mirrored ? { left: hero ? 28 : 6 } : { right: hero ? 28 : 6 }]}>
        <MaterialCommunityIcons name={icon} size={ghost} color="rgba(255,255,255,0.10)" />
      </View>
      <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.34)", borderRadius: hero ? 26 : 20, borderWidth: 1.5, height: tile, justifyContent: "center", width: tile }}>
        <MaterialCommunityIcons name={icon} size={hero ? 52 : 36} color="#FFFFFF" />
      </View>
    </LinearGradient>
  );
}
