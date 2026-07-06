import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

const REASONS = [
  "Komisyon henüz ödenmedi",
  "Satış gerçekleşmedi / iptal oldu",
  "Tutar hatalı",
  "Ürün iade edildi",
  "Diğer"
];

/** Komisyon anlaşmazlığı için neden toplayan modal (satıcı veya ortak açabilir). */
export function DisputeModal({
  visible,
  onClose,
  onSubmit
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const { language } = useLanguage();
  const [picked, setPicked] = useState<string | null>(null);
  const [detail, setDetail] = useState("");

  function submit() {
    const base = picked && picked !== "Diğer" ? picked : "";
    const reason = [base, detail.trim()].filter(Boolean).join(" — ") || "Anlaşmazlık bildirildi";
    onSubmit(reason);
    setPicked(null);
    setDetail("");
  }

  function close() {
    setPicked(null);
    setDetail("");
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ backgroundColor: "rgba(0,0,0,0.45)", flex: 1, justifyContent: "center", padding: 20 }}>
        <View style={{ alignSelf: "center", backgroundColor: colors.background, borderRadius: 18, gap: 14, maxWidth: 440, padding: 20, width: "100%" }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
            <MaterialCommunityIcons name="scale-balance" size={20} color={colors.warning} />
            <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>{translateCopy("Anlaşmazlık bildir", language)}</Text>
            <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateCopy("Kapat", language)}>
              <MaterialCommunityIcons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 17 }}>
            {translateCopy("Ortaksat para tutmaz; anlaşmazlık kaydı taraflar arasındaki durumu belgeler ve karşı tarafa bildirilir. Nedeni seç:", language)}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {REASONS.map((r) => {
              const on = picked === r;
              return (
                <Pressable key={r} onPress={() => setPicked(r)} style={{ backgroundColor: on ? colors.warning : colors.surfaceAlt, borderColor: on ? colors.warning : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{translateCopy(r, language)}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={detail}
            onChangeText={setDetail}
            multiline
            placeholder={translateCopy("Detay (opsiyonel) — ne olduğunu kısaca açıkla", language)}
            placeholderTextColor={colors.subtle}
            style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 76, padding: 12, textAlignVertical: "top" }}
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={close} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 11, borderWidth: 1, flex: 1, paddingVertical: 12 }}>
              <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{translateCopy("Vazgeç", language)}</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!picked}
              style={{ alignItems: "center", backgroundColor: picked ? colors.warning : colors.line, borderRadius: 11, flex: 1, paddingVertical: 12 }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Anlaşmazlık Aç", language)}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
