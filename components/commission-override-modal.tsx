import { MaterialCommunityIcons } from "@/components/icons";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { PrimaryButton } from "@/components/ui";
import { moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { parseTrPrice } from "@/lib/validation";

/**
 * Satıcının bir ortağa ÖZEL komisyon belirlemesi (ilan varsayılanını ezer). Rate (%) veya
 * sabit (₺). "Kaldır" ile varsayılana döner. Platform para tutmaz; yalnız hesap parametresi.
 */
export function CommissionOverrideModal({
  visible,
  partnerName,
  currency,
  defaultLabel,
  currentType,
  currentValue,
  onClose,
  onSubmit,
  onClear
}: {
  visible: boolean;
  partnerName: string;
  currency?: string;
  defaultLabel: string;
  currentType?: "rate" | "fixed";
  currentValue?: number;
  onClose: () => void;
  onSubmit: (type: "rate" | "fixed", value: number) => void;
  onClear: () => void;
}) {
  const { language, t } = useLanguage();
  const [type, setType] = useState<"rate" | "fixed">(currentType ?? "rate");
  const [value, setValue] = useState(currentValue != null ? String(currentValue) : "");
  useEffect(() => {
    if (visible) { setType(currentType ?? "rate"); setValue(currentValue != null ? String(currentValue) : ""); }
  }, [visible, currentType, currentValue]);
  const parsed = type === "rate" ? Math.max(0, Math.min(90, Number(value.replace(/[^0-9]/g, "")) || 0)) : Math.max(0, parseTrPrice(value));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* KAV + ScrollView: klavye acilinca kart yukari kalkmiyor ve gonder butonu
          klavyenin ALTINDA kaliyordu (iOS sayisal klavyede Done YOK). RN Modal ebeveynin
          KAV'ini MIRAS ALMAZ -> her modalin kendi KAV'i olmali. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Pressable onPress={onClose} style={{ backgroundColor: "rgba(16,24,40,0.45)", flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", flexGrow: 1, justifyContent: "center", padding: 20 }}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: colors.surface, borderRadius: 16, gap: 12, maxWidth: 420, padding: 18, width: "100%" }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name="cash-edit" size={20} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>{translateCopy("Ortağa özel komisyon", language)}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>
            {partnerName} {translateCopy("için bu ilanda özel komisyon belirle. Boş/kaldır → ilan varsayılanı", language)} ({defaultLabel}).
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["rate", "fixed"] as const).map((k) => {
              const on = type === k;
              return (
                <Pressable key={k} onPress={() => setType(k)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 10 }}>
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy(k === "rate" ? "Yüzde (%)" : "Sabit (₺)", language)}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="numeric"
              placeholder={type === "rate" ? "10" : "500"}
              placeholderTextColor={colors.subtle}
              style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "800", minHeight: 48 }}
            />
            <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "900" }}>{type === "rate" ? "%" : (currency === "USD" ? "$" : currency === "EUR" ? "€" : "₺")}</Text>
          </View>
          {parsed > 0 ? (
            <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>
              {translateCopy("Bu ortağa uygulanacak", language)}: {type === "rate" ? `%${parsed}` : moneyIn(parsed, currency)}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {currentType ? (
              <View style={{ flex: 1 }}><PrimaryButton tone="secondary" icon="restore" onPress={() => { onClear(); onClose(); }}>{translateCopy("Kaldır", language)}</PrimaryButton></View>
            ) : null}
            <View style={{ flex: 1 }}><PrimaryButton icon="content-save" onPress={() => { if (parsed > 0) { onSubmit(type, parsed); onClose(); } }}>{t("save") || translateCopy("Kaydet", language)}</PrimaryButton></View>
          </View>
        </Pressable>
          </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
