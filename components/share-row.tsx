import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Tek tık sosyal paylaşım: WhatsApp / Telegram / X / Kopyala. */
export function ShareRow({ url, text, compact }: { url: string; text: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const msg = `${text}\n${url}`;
  const targets: Array<{ key: string; label: string; icon: IconName; color: string; href: string }> = [
    { key: "wa", label: "WhatsApp", icon: "whatsapp", color: "#25D366", href: `https://wa.me/?text=${encodeURIComponent(msg)}` },
    { key: "tg", label: "Telegram", icon: "send", color: "#229ED9", href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
    { key: "x", label: "X", icon: "alpha-x-box-outline", color: colors.ink, href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` }
  ];

  async function copy() {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {targets.map((tg) => (
        <Pressable
          key={tg.key}
          accessibilityRole="button"
          accessibilityLabel={`${tg.label} ile paylaş`}
          onPress={() => void Linking.openURL(tg.href)}
          style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: compact ? 11 : 14, paddingVertical: compact ? 7 : 9 }}
        >
          <MaterialCommunityIcons name={tg.icon} size={16} color={tg.color} />
          {!compact ? <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{tg.label}</Text> : null}
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bağlantıyı kopyala"
        onPress={() => void copy()}
        style={{ alignItems: "center", backgroundColor: copied ? colors.primary : colors.surfaceAlt, borderColor: copied ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: compact ? 11 : 14, paddingVertical: compact ? 7 : 9 }}
      >
        <MaterialCommunityIcons name={copied ? "check" : "content-copy"} size={15} color={copied ? "#FFFFFF" : colors.primaryDark} />
        <Text style={{ color: copied ? "#FFFFFF" : colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{copied ? "Kopyalandı" : "Kopyala"}</Text>
      </Pressable>
    </View>
  );
}
