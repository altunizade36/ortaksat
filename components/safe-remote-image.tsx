import { Image, type ImageProps } from "expo-image";
import { useEffect, useState } from "react";

const fallbackImage = require("../assets/mascot.png");

type SafeRemoteImageProps = Omit<ImageProps, "source"> & {
  uri?: string | null;
  fallback?: ImageProps["source"];
};

export function SafeRemoteImage({ fallback = fallbackImage, onError, uri, transition, ...props }: SafeRemoteImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  return (
    <Image
      {...props}
      source={!uri || failed ? fallback : { uri }}
      // Görseller ekrana "çarparak" değil, yumuşak bir geçişle (fade) gelsin.
      transition={transition ?? { duration: 260, effect: "cross-dissolve" }}
      recyclingKey={uri ?? undefined}
      cachePolicy="memory-disk"
      placeholderContentFit="cover"
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
