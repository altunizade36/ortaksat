import { Image } from "expo-image";
import { useEffect, useState } from "react";
import type { ImageStyle, StyleProp } from "react-native";

import { cityCoverFor, normalizeProfileCity } from "@/lib/city-cover";

const istanbulCover = require("../assets/mobile/istanbul-marketplace.webp");

export function CityCoverImage({
  city,
  style,
  priority = "normal",
}: {
  city?: string | null;
  style?: StyleProp<ImageStyle>;
  priority?: "low" | "normal" | "high";
}) {
  const cover = cityCoverFor(city);
  const normalizedCity = normalizeProfileCity(city) ?? "İstanbul";
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [cover?.url]);

  return (
    <Image
      accessibilityLabel={`${normalizedCity} şehir manzarası`}
      alt={`${normalizedCity} şehir manzarası`}
      cachePolicy="memory-disk"
      contentFit="cover"
      contentPosition="center"
      onError={() => setFailed(true)}
      priority={priority}
      recyclingKey={
        failed ? "istanbul-default" : (cover?.url ?? "istanbul-default")
      }
      source={!cover || failed ? istanbulCover : { uri: cover.url }}
      style={style}
      transition={priority === "high" ? 0 : 140}
    />
  );
}
