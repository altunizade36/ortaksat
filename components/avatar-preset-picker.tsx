import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";

/**
 * Hazır profil karakterleri. Görseller kendi üretimimizdir (scripts/avatar-presets/generate.py) ve
 * sitenin kendi adresinden sunulur; seçilen karakter profil fotoğrafı olarak adresiyle kaydedilir,
 * bu yüzden web'de de uygulamada da herkes aynı görseli görür.
 */
export const AVATAR_PRESETS: string[] = Array.from({ length: 12 }, (_, i) => `https://www.ortaksat.com/avatars/k${String(i + 1).padStart(2, "0")}.webp`);

export function isAvatarPreset(uri?: string | null) {
  return Boolean(uri && AVATAR_PRESETS.includes(uri));
}

export function AvatarPresetPicker({ value, onSelect, disabled, size = 52 }: { value?: string | null; onSelect: (uri: string) => void; disabled?: boolean; size?: number }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>Ya da hazır bir karakter seç</Text>
      <View testID="avatar-presets" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {AVATAR_PRESETS.map((uri, index) => {
          const selected = value === uri;
          return (
            <Pressable
              key={uri}
              testID={`avatar-preset-${index + 1}`}
              accessibilityRole="button"
              accessibilityLabel={`Hazır karakter ${index + 1}`}
              accessibilityState={{ selected }}
              disabled={disabled}
              onPress={() => onSelect(uri)}
              style={({ pressed }) => ({ borderColor: selected ? colors.primary : "transparent", borderRadius: 999, borderWidth: 3, opacity: disabled ? 0.5 : pressed ? 0.75 : 1, padding: 2 })}
            >
              <Image source={{ uri }} cachePolicy="memory-disk" contentFit="cover" style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, height: size, width: size }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
