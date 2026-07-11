// Maskot görsel kaynağı — NATIVE (iOS/Android) sürüm.
// Native'de root-relative URI ("/assets/...") ÇÖZÜLEMEZ → maskotlar görünmezdi.
// Çözüm: görselleri require ile uygulama paketine göm (Metro asset olarak bundle'lar).
// Not: require() statik-literal olmalı; bu yüzden 8 poz açıkça yazılır.
import type { ImageSourcePropType } from "react-native";

import type { MascotName } from "./mascots";

const SRC: Record<MascotName, ImageSourcePropType> = {
  success: require("../public/assets/mascot/webp-512/success.webp"),
  mobile: require("../public/assets/mascot/webp-512/mobile.webp"),
  package: require("../public/assets/mascot/webp-512/package.webp"),
  approved: require("../public/assets/mascot/webp-512/approved.webp"),
  thinking: require("../public/assets/mascot/webp-512/thinking.webp"),
  laptop: require("../public/assets/mascot/webp-512/laptop.webp"),
  idea: require("../public/assets/mascot/webp-512/idea.webp"),
  heart: require("../public/assets/mascot/webp-512/heart.webp")
};

// wide parametresi native'de kullanılmaz (tek 512 sürüm gömülür — paket boyutu için).
export function mascotSource(name: MascotName, _wide: boolean): ImageSourcePropType {
  return SRC[name];
}
