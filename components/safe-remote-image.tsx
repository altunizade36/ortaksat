import { Image, type ImageProps } from "expo-image";
import { useEffect, useState } from "react";

const fallbackImage = require("../assets/mascot.png");

type SafeRemoteImageProps = Omit<ImageProps, "source"> & {
  uri?: string | null;
  fallback?: ImageProps["source"];
};

export function SafeRemoteImage({ fallback = fallbackImage, onError, uri, ...props }: SafeRemoteImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  return (
    <Image
      {...props}
      source={!uri || failed ? fallback : { uri }}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
