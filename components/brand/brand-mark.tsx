import { Image } from "expo-image";
import { View } from "react-native";

// Ekranda 36-68px → 128px WebP (7kB); büyük PNG her sayfada inmesin.
const brandHead = require("../../assets/brand-head.webp");

// OrtakSat LOGOSU (turkuaz halka + tokalaşma). Şeffaf zeminli — beyaz/açık zeminlere
// temiz oturur. Header, giriş üst-barı, mobil menü başlığı, giriş kapısı hep bunu kullanır.
//
// STATİK: eskiden kedi maskotu olduğu için sürekli salınıyordu (Animated loop, ±2.5px).
// Logo salınmaz — kayma/oynama hissi vermesin + boşuna animasyon çalışmasın.
// Sabit ölçülü kap (width/height = size) → görsel geç yüklense de DÜZEN KAYMAZ (CLS yok).
//
// NOT: Maskot (kedi) AYRI bir sistemdir → components/brand/Mascot + lib/mascots.ts.
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <View style={{ alignItems: "center", height: size, justifyContent: "center", width: size }}>
      <Image
        source={brandHead}
        contentFit="contain"
        style={{ height: size, width: size }}
        accessibilityLabel="OrtakSat logosu"
        alt="OrtakSat logosu"
      />
    </View>
  );
}
