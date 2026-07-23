import { Text, View } from "react-native";

/**
 * ÜRÜN GÖRSELİ FİLİGRANI — Sahibinden'in yaptığı gibi ilan görselinin üzerine çapraz,
 * tekrarlı ve ÇOK ŞEFFAF site adı yazar.
 *
 * NEDEN: yayınlanan görsel başka sitelere/ilanlara kopyalanınca kaynağı belli olsun.
 *
 * TASARIM KURALLARI (kullanıcı isteği: "ürünü kötü göstermesin, çok şeffaf olsun"):
 *  - opacity çok düşük (0.13) + ince harf → ürün detayını kapatmaz
 *  - dosyaya GÖMÜLMEZ: yalnızca render katmanı → orijinal görsel bozulmaz, indirilen
 *    dosya temiz kalır, istenirse tek satırda kapatılır
 *  - `pointerEvents="none"` → üstüne tıklama/kaydırma (büyüt, galeri swipe) engellenmez
 *  - görsel YOKSA da (placeholder) görünür — marka her durumda oradadır
 */
export function ImageWatermark({
  rows = 4,
  cols = 3,
  size = 13,
  opacity = 0.13
}: {
  rows?: number;
  cols?: number;
  size?: number;
  opacity?: number;
}) {
  const cells = Array.from({ length: rows * cols });
  return (
    <View
      pointerEvents="none"
      style={{
        alignItems: "center",
        bottom: 0,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-around",
        left: 0,
        opacity,
        overflow: "hidden",
        position: "absolute",
        right: 0,
        top: 0
      }}
    >
      {cells.map((_, i) => (
        <Text
          key={i}
          selectable={false}
          style={{
            color: "#FFFFFF",
            fontSize: size,
            fontWeight: "800",
            // Beyaz görselde de okunur kalsın diye hafif koyu gölge (iki tonda da çalışır).
            textShadowColor: "rgba(0,0,0,0.35)",
            textShadowOffset: { height: 1, width: 0 },
            textShadowRadius: 2,
            transform: [{ rotate: "-30deg" }],
            width: `${100 / cols}%`,
            textAlign: "center"
          }}
        >
          ortaksat.com
        </Text>
      ))}
    </View>
  );
}
