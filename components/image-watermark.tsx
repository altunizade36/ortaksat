import { Text, View } from "react-native";

/**
 * ÜRÜN GÖRSELİ FİLİGRANI — Sahibinden tarzı: ilan görselinin üzerine ÇAPRAZ, TEK ŞERİT,
 * şeffaf "ortaksat.com" yazar (ortadan köşeye doğru). Kaynağı belli eder; ürünü çok etkilemez.
 *
 * TASARIM (kullanıcı isteği: "çapraz BİR ADET şeffaf, ürünü çok etkilemeden ortadan köşeye"):
 *  - Tek diagonal şerit (-30°), tekrarlı grid DEĞİL → ürün detayı kapanmaz.
 *  - Düşük opaklık + gölge → hem açık hem koyu görselde okunur ama baskın değil.
 *  - Dosyaya GÖMÜLMEZ (render katmanı) → orijinal görsel bozulmaz.
 *  - `pointerEvents="none"` → büyüt/kaydırma engellenmez.
 *  - Görsel YOKSA da (placeholder) görünür — marka HER ürün görselinde vardır.
 */
export function ImageWatermark({ opacity = 0.18, size = 13 }: { opacity?: number; size?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{ alignItems: "center", bottom: 0, justifyContent: "center", left: 0, overflow: "hidden", position: "absolute", right: 0, top: 0 }}
    >
      <Text
        numberOfLines={1}
        selectable={false}
        style={{
          color: "#FFFFFF",
          fontSize: size,
          fontWeight: "800",
          letterSpacing: 2,
          opacity,
          textAlign: "center",
          textShadowColor: "rgba(0,0,0,0.30)",
          textShadowOffset: { height: 1, width: 0 },
          textShadowRadius: 2,
          transform: [{ rotate: "-30deg" }],
          width: 1200 // görselden geniş → köşeden köşeye kesintisiz çapraz şerit (overflow ile kırpılır)
        }}
      >
        ortaksat.com   ·   ortaksat.com   ·   ortaksat.com   ·   ortaksat.com   ·   ortaksat.com
      </Text>
    </View>
  );
}
