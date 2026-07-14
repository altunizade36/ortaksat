import { Image, type ImageProps } from "expo-image";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { cardImageUrl } from "@/lib/image-url";

const fallbackImage = require("../assets/mascot.png");

type SafeRemoteImageProps = Omit<ImageProps, "source"> & {
  uri?: string | null;
  fallback?: ImageProps["source"];
  fallbackUri?: string | null;
  /** Tam çözünürlük gerektiren büyük görünümler (ilan galerisi, tam ekran) için `full`. */
  full?: boolean;
};

export function SafeRemoteImage({ fallback = fallbackImage, fallbackUri, full, onError, onLoadEnd, onLoadStart, uri, transition, style, ...props }: SafeRemoteImageProps) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(uri));
  // Kartlar/küçük görünümler tam boyut görsel indiriyordu (demo JPEG'ler ~150kB × 23 =
  // keşfette ~3MB). Varsayılan artık küçük varyant; büyük görünümler `full` ile devre dışı.
  //
  // KENDİNİ ONARAN: küçük varyant yoksa (bu değişiklikten ÖNCE yüklenmiş görseller,
  // ya da thumb yüklemesi başarısız olmuş) 404 gelir → maskot fallback'i basmak yerine
  // ORİJİNALE döneriz. Yani optimize edilmemiş olur, ama HİÇBİR görsel kaybolmaz.
  const [noThumb, setNoThumb] = useState(false);
  const thumb = full || noThumb ? (uri ?? undefined) : cardImageUrl(uri);
  const shown = thumb;
  const resolvedFallback = fallbackUri ? { uri: fallbackUri } : fallback;

  useEffect(() => {
    setFailed(false);
    setNoThumb(false);
    setLoading(Boolean(uri));
  }, [uri, fallbackUri]);

  return (
    <View style={[{ backgroundColor: "#EDF0F2", overflow: "hidden" }, style]}>
      <Image
        {...props}
        style={{ height: "100%", width: "100%" }}
        source={!shown || failed ? resolvedFallback : { uri: shown }}
        transition={transition ?? { duration: 260, effect: "cross-dissolve" }}
        recyclingKey={(failed ? fallbackUri : shown) ?? undefined}
        cachePolicy="memory-disk"
        placeholderContentFit="cover"
        priority={props.priority ?? "low"}
        onLoadStart={() => {
          setLoading(true);
          onLoadStart?.();
        }}
        onLoadEnd={() => {
          setLoading(false);
          onLoadEnd?.();
        }}
        onError={(event) => {
          // Küçük varyant bulunamadıysa önce orijinali dene; asıl görsel de düşerse fallback.
          if (!noThumb && !full && uri && shown && shown !== uri) {
            setNoThumb(true);
            return;
          }
          setFailed(true);
          setLoading(false);
          onError?.(event);
        }}
      />
      {loading ? (
        <View
          pointerEvents="none"
          style={{
            backgroundColor: "#E7EBEF",
            bottom: 0,
            left: 0,
            opacity: 0.72,
            position: "absolute",
            right: 0,
            top: 0
          }}
        />
      ) : null}
    </View>
  );
}