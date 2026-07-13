import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { searchKey } from "@/lib/locale";

/**
 * NATIVE seçim sayfası (alttan açılan bottom sheet).
 *
 * Neden: native'de açılır liste, alandan AŞAĞI doğru inline açılıyordu; alan ekranın
 * altındaysa seçenekler görünmüyor ve ScrollView otomatik kaymıyordu (web'deki
 * scrollIntoView düzeltmesi `Platform.OS === "web"` ile korumalı olduğu için native'i
 * kapsamıyordu). Bottom sheet konumdan BAĞIMSIZ olarak listeyi hep tam görünür yapar —
 * mobilin standart deseni. Uzun listelerde (81 il, 50+ marka) arama kutusu da açılır.
 *
 * Web'de KULLANILMAZ (orada inline liste + scrollIntoView çalışıyor).
 */
export function OptionSheet({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  searchable
}: {
  visible: boolean;
  title: string;
  options: string[];
  value?: string;
  onSelect: (v: string) => void;
  onClose: () => void;
  /** Belirtilmezse 12+ seçenekte arama kutusu otomatik açılır. */
  searchable?: boolean;
}) {
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const withSearch = searchable ?? options.length >= 12;

  const results = useMemo(() => {
    const k = searchKey(query).trim();
    if (!k) return options;
    return options.filter((o) => searchKey(o).includes(k));
  }, [options, query]);

  function close() {
    setQuery("");
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      {/* Arka plana dokununca kapanır */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translateCopy("Kapat", language)}
        onPress={close}
        style={{ backgroundColor: "rgba(15,23,42,0.45)", flex: 1, justifyContent: "flex-end" }}
      >
        {/* İçeriğe dokunma kapatmasın */}
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "78%", paddingBottom: 22 }}>
          <View style={{ alignItems: "center", paddingTop: 10 }}>
            <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 4, width: 46 }} />
          </View>

          <View style={{ alignItems: "center", flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingVertical: 14 }}>
            <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 16.5, fontWeight: "900" }}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Kapat", language)} onPress={close} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {withSearch ? (
            <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12 }}>
              <MaterialCommunityIcons name="magnify" size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={translateCopy("Ara…", language)}
                placeholderTextColor={colors.subtle}
                accessibilityLabel={translateCopy("Ara…", language)}
                style={{ color: colors.ink, flex: 1, fontSize: 15, minHeight: 44, paddingVertical: 8 }}
              />
              {query ? (
                <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Temizle", language)} onPress={() => setQuery("")} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle" size={17} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <ScrollView keyboardShouldPersistTaps="handled" style={{ paddingHorizontal: 8 }}>
            {value ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => { onSelect(""); close(); }}
                style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : "transparent", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 })}
              >
                <Text style={{ color: colors.muted, fontSize: 14.5, fontWeight: "700" }}>{translateCopy("Temizle", language)}</Text>
              </Pressable>
            ) : null}

            {results.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 30 }}>
                <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "700" }}>{translateCopy("Sonuç yok", language)}</Text>
              </View>
            ) : null}

            {results.map((o) => {
              const on = o === value;
              return (
                <Pressable
                  key={o}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => { onSelect(o); close(); }}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: on ? colors.primarySoft : pressed ? colors.surfaceAlt : "transparent",
                    borderRadius: 12,
                    flexDirection: "row",
                    gap: 10,
                    // Mobil dokunma hedefi: min 48px
                    minHeight: 50,
                    paddingHorizontal: 14
                  })}
                >
                  <Text style={{ color: on ? colors.primaryDark : colors.ink, flex: 1, fontSize: 15, fontWeight: on ? "900" : "600" }}>{o}</Text>
                  {on ? <MaterialCommunityIcons name="check" size={19} color={colors.primaryDark} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
