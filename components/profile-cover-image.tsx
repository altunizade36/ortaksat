import { Image } from "expo-image";
import { useEffect, useState } from "react";
import type { ImageStyle, StyleProp } from "react-native";

const defaultCover = require("../assets/mobile/istanbul-marketplace.webp");

/**
 * Profil / mağaza kapağı. Kullanıcı kendi kapağını yüklediyse o, yüklemediyse (ya da görsel açılamazsa)
 * herkes için aynı olan standart OrtakSat kapağı gösterilir. Yüklenen kapaklar her zaman 3:1 oranında
 * kaydedildiği için (bkz. components/cover-field.tsx) hangi ölçüde gösterilirse gösterilsin düzeni bozmaz.
 */
export function ProfileCoverImage({ uri, style, priority = "normal" }: { uri?: string | null; style?: StyleProp<ImageStyle>; priority?: "low" | "normal" | "high" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const custom = Boolean(uri) && !failed;
  return (
    <Image
      accessibilityLabel="Profil kapak görseli"
      alt="Profil kapak görseli"
      cachePolicy="memory-disk"
      contentFit="cover"
      contentPosition="center"
      onError={() => setFailed(true)}
      priority={priority}
      recyclingKey={custom ? uri! : "standart-kapak"}
      source={custom ? { uri: uri! } : defaultCover}
      style={style}
      transition={priority === "high" ? 0 : 140}
    />
  );
}
