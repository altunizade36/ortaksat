import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { hasProfilePhoto } from "@/lib/profile-photo";

/** A missing or broken profile photo always uses the same neutral silhouette. */
export function UserAvatar({ uri, size = 40, style, accessibilityLabel = "Profil fotoğrafı" }: { uri?: string | null; size?: number; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return <View accessibilityLabel={accessibilityLabel} style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: "#FFFFFF" }, style]}>
    <Svg width="100%" height="100%" viewBox="0 0 100 100"><Circle cx="50" cy="50" r="49" fill="#ABADB0" /><Circle cx="50" cy="43" r="17" fill="white" /><Path d="M17 91 C17 62 83 62 83 91 L83 100 L17 100Z" fill="white" /></Svg>
    {hasProfilePhoto(uri) && failedUri !== uri && <Image source={{ uri: uri! }} style={StyleSheet.absoluteFill} contentFit="cover" onError={() => setFailedUri(uri!)} accessibilityLabel={accessibilityLabel} />}
  </View>;
}
