import { Image, type ImageProps } from "expo-image";
import { useEffect, useState } from "react";
import { View } from "react-native";

const fallbackImage = require("../assets/mascot.png");

type SafeRemoteImageProps = Omit<ImageProps, "source"> & {
  uri?: string | null;
  fallback?: ImageProps["source"];
  fallbackUri?: string | null;
};

export function SafeRemoteImage({ fallback = fallbackImage, fallbackUri, onError, onLoadEnd, onLoadStart, uri, transition, style, ...props }: SafeRemoteImageProps) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(uri));
  const resolvedFallback = fallbackUri ? { uri: fallbackUri } : fallback;

  useEffect(() => {
    setFailed(false);
    setLoading(Boolean(uri));
  }, [uri, fallbackUri]);

  return (
    <View style={[{ backgroundColor: "#EDF0F2", overflow: "hidden" }, style]}>
      <Image
        {...props}
        style={{ height: "100%", width: "100%" }}
        source={!uri || failed ? resolvedFallback : { uri }}
        transition={transition ?? { duration: 260, effect: "cross-dissolve" }}
        recyclingKey={(failed ? fallbackUri : uri) ?? undefined}
        cachePolicy="memory-disk"
        placeholderContentFit="cover"
        loading={props.loading ?? "lazy"}
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