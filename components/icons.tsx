// ALT-YOLDAN import: barrel ("@expo/vector-icons") BÜTÜN ikon ailelerinin glyph
// haritalarını bundle'a sokuyordu (FontAwesome6Pro tek başına 654kB) — oysa yalnız
// MaterialCommunityIcons kullanılıyor. Metro tree-shake etmiyor.
import MaterialCommunityIconsBase from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useState, type ComponentProps } from "react";
import { Platform, Text } from "react-native";

type IconProps = ComponentProps<typeof MaterialCommunityIconsBase>;

/**
 * HİDRASYON-GÜVENLİ İKON (React #418 kök çözümü).
 *
 * SORUN: Statik export'ta (SSG) ikon fontu yüklü olmadığı için @expo/vector-icons
 * BOŞ bir eleman basıyordu:            <div dir="auto" class="css-146c3p1"></div>
 * İstemcide ise font yüklendiği için glif basılıyordu:
 *                                       <div style="font-family: material-community">󰅁</div>
 * Bu uyuşmazlık React #418'e yol açıyor ve React SUNUCUDAN GELEN TÜM HTML'İ ATIP
 * sayfayı baştan çiziyordu → mobilde görünür titreme/jank + boşa iş.
 * (Ana sayfada geri butonu olmadığı için orada tetiklenmiyordu; geri butonu olan
 *  her sayfada — kategoriler, blog, yasal, iletişim… — tetikleniyordu.)
 *
 * ÇÖZÜM: Web'de İLK render sunucuyla BİREBİR aynı (stilsiz, boş Text) basılır;
 * mount sonrası gerçek ikon gelir. Hidrasyon temiz kalır, sayfa yeniden çizilmez,
 * SEO metni etkilenmez (ikonlar zaten SSG'de yoktu). Native'de davranış değişmez.
 *
 * ÖNEMLİ: Yeni kodda ikonları "@expo/vector-icons"tan DEĞİL, buradan import et.
 */
function HydrationSafeIcon(props: IconProps) {
  // Native'de SSG yok → doğrudan gerçek ikon.
  const [hydrated, setHydrated] = useState(Platform.OS !== "web");
  useEffect(() => { setHydrated(true); }, []);
  // Sunucunun bastığıyla BİREBİR aynı: stilsiz, boş Text. (Stil eklersek RN-web
  // inline style üretir ve uyuşmazlık geri gelir.)
  if (!hydrated) return <Text />;
  return <MaterialCommunityIconsBase {...props} />;
}

// glyphMap korunur — kod tabanı `keyof typeof MaterialCommunityIcons.glyphMap`
// tipini yaygın kullanıyor.
export const MaterialCommunityIcons = Object.assign(HydrationSafeIcon, {
  glyphMap: MaterialCommunityIconsBase.glyphMap
});
