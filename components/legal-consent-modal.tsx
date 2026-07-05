import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import type { LegalDoc } from "@/lib/legal-content";

/**
 * Hukuki belge onay modalı: belge açılır, kullanıcı SONA KADAR kaydırınca
 * "Okudum, onaylıyorum" butonu aktifleşir; onaylayınca ilgili kutucuk işaretlenir.
 */
export function LegalConsentModal({
  doc,
  visible,
  onClose,
  onApprove
}: {
  doc: LegalDoc | null;
  visible: boolean;
  onClose: () => void;
  onApprove: () => void;
}) {
  const [reachedEnd, setReachedEnd] = useState(false);
  const scrolledRef = useRef(false);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    scrolledRef.current = true;
    // Sona (≈40px tolerans) gelince onay açılır. Kısa metinlerde de bir miktar
    // kaydırma yeterli olur; içerik ekrandan kısaysa zaten baştan sona görünür.
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 40) setReachedEnd(true);
  }

  function onContentSizeChange(_w: number, h: number) {
    // İçerik pencereye sığıyorsa (kaydırma gerekmiyorsa) onayı doğrudan aç.
    if (!scrolledRef.current && h > 0 && h < 520) setReachedEnd(true);
  }

  function handleClose() {
    setReachedEnd(false);
    scrolledRef.current = false;
    onClose();
  }

  function handleApprove() {
    onApprove();
    setReachedEnd(false);
    scrolledRef.current = false;
  }

  if (!doc) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={{ backgroundColor: "rgba(0,0,0,0.5)", flex: 1, justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "88%", overflow: "hidden" }}>
          <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingVertical: 14 }}>
            <MaterialCommunityIcons name="file-document-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 15.5, fontWeight: "900" }}>{doc.title}</Text>
              <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "700" }}>Güncelleme: {doc.updated}</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Kapat">
              <MaterialCommunityIcons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView
            onScroll={onScroll}
            onContentSizeChange={onContentSizeChange}
            scrollEventThrottle={64}
            contentContainerStyle={{ gap: 14, padding: 18, paddingBottom: 28 }}
          >
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>{doc.intro}</Text>
            {doc.sections.map((s) => (
              <View key={s.heading} style={{ gap: 6 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{s.heading}</Text>
                {s.body.map((p, i) => (
                  <Text key={i} style={{ color: colors.ink, fontSize: 13, fontWeight: "500", lineHeight: 20 }}>{p}</Text>
                ))}
              </View>
            ))}
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingTop: 4 }}>
              <MaterialCommunityIcons name={reachedEnd ? "check-circle" : "arrow-down-circle-outline"} size={18} color={reachedEnd ? colors.primary : colors.subtle} />
              <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "700" }}>{reachedEnd ? "Metnin sonuna ulaştın." : "Onaylamak için metni sonuna kadar kaydır."}</Text>
            </View>
          </ScrollView>

          <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 8, padding: 16 }}>
            <Pressable
              disabled={!reachedEnd}
              onPress={handleApprove}
              style={{ alignItems: "center", backgroundColor: reachedEnd ? colors.primary : colors.line, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 14 }}
            >
              <MaterialCommunityIcons name="check-bold" size={18} color={reachedEnd ? "#FFFFFF" : colors.muted} />
              <Text style={{ color: reachedEnd ? "#FFFFFF" : colors.muted, fontSize: 14, fontWeight: "900" }}>Okudum, onaylıyorum</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
