import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { hasProfilePhoto } from "@/lib/profile-photo";

/** Ad soyaddan en çok iki baş harf ("Mehmet Fatih" → "MF"). Harf içermeyen ad boş döner. */
export function nameInitials(name?: string | null): string {
  return String(name ?? "")
    .split(/\s+/)
    .map((part) => Array.from(part.replace(/[^\p{L}\p{N}]/gu, ""))[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("tr-TR");
}

/**
 * Kullanıcı simgesi: kendi fotoğrafı varsa o, yoksa AD BAŞ HARFLERİ (2026-11-14 kararı: hazır karakter yok —
 * "kendi resmini koysun veya isim harfleri olsun"). Baş harf iki yerden gelir: `name` verilmişse ondan; verilmemişse
 * `uri` kısa bir metinse ondan (profil eşlemesi fotoğrafı olmayan kullanıcıda `avatar` alanına baş harfleri yazar).
 * İkisi de yoksa (ad bilinmiyor) nötr siluet çizilir. Fotoğraf yüklenemezse de baş harflere düşülür.
 */
export function UserAvatar({ uri, name, size = 40, style, accessibilityLabel = "Profil fotoğrafı" }: { uri?: string | null; name?: string | null; size?: number; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const photo = hasProfilePhoto(uri) && failedUri !== uri;
  const fromUri = uri && !hasProfilePhoto(uri) && !/[/:.]/.test(uri) && Array.from(uri.trim()).length <= 3 ? uri.trim().toLocaleUpperCase("tr-TR") : "";
  const initials = nameInitials(name) || fromUri;
  return <View accessibilityLabel={accessibilityLabel} style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: initials ? "#DCE8FF" : "#FFFFFF", alignItems: "center", justifyContent: "center" }, style]}>
    {initials
      ? <Text allowFontScaling={false} numberOfLines={1} style={{ color: "#0645C9", fontSize: Math.max(10, Math.round(size * (Array.from(initials).length > 2 ? 0.3 : 0.38))), fontWeight: "800", letterSpacing: 0.2 }}>{initials}</Text>
      : <Svg width="100%" height="100%" viewBox="0 0 100 100"><Circle cx="50" cy="50" r="49" fill="#ABADB0" /><Circle cx="50" cy="43" r="17" fill="white" /><Path d="M17 91 C17 62 83 62 83 91 L83 100 L17 100Z" fill="white" /></Svg>}
    {photo && <Image source={{ uri: uri! }} style={StyleSheet.absoluteFill} contentFit="cover" onError={() => setFailedUri(uri!)} accessibilityLabel={accessibilityLabel} />}
  </View>;
}
