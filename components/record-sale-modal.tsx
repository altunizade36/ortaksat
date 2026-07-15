import { MaterialCommunityIcons } from "@/components/icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";

/**
 * Satıcının bir ortağa doğrudan satış eklemesi için tutar+adet modalı.
 * Ortak referans linkiyle gelen alıcı site dışında (WhatsApp/elden) satın aldıysa,
 * satıcı burada satışı kaydedip ortağın komisyonunu başlatır. Platform para tutmaz;
 * bu kayıt yalnızca komisyon sürecini belgeler.
 */
export function RecordSaleModal({
  visible,
  partnerName,
  listPrice,
  currency,
  commissionType,
  commissionValue,
  computeCommission,
  onClose,
  onSubmit
}: {
  visible: boolean;
  partnerName: string;
  listPrice: number;
  currency?: string;
  commissionType: "rate" | "fixed";
  commissionValue: number;
  // Verilirse önizleme bunu kullanır (per-ortak override/kademe/bonus dahil EFEKTİF komisyon).
  // Yoksa basit ilan-baz oranıyla hesaplanır (geriye-dönük uyum).
  computeCommission?: (amount: number, quantity: number) => number;
  onClose: () => void;
  onSubmit: (amount: number, quantity: number) => void;
}) {
  const { language } = useLanguage();
  const [amount, setAmount] = useState(String(listPrice));
  const [qty, setQty] = useState("1");

  useEffect(() => {
    if (visible) { setAmount(String(listPrice)); setQty("1"); }
  }, [visible, listPrice]);

  const amountNum = Number(amount.replace(/[^0-9]/g, "")) || 0;
  const qtyNum = Math.max(1, Number(qty.replace(/[^0-9]/g, "")) || 1);
  const totalAmount = amountNum > 0 ? amountNum : listPrice * qtyNum;
  const commission = computeCommission
    ? computeCommission(totalAmount, qtyNum)
    : commissionType === "rate" ? Math.round((totalAmount * commissionValue) / 100) : commissionValue * qtyNum;
  const valid = totalAmount > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ backgroundColor: "rgba(0,0,0,0.45)", flex: 1, justifyContent: "center", padding: 20 }}>
        <View style={{ alignSelf: "center", backgroundColor: colors.background, borderRadius: 18, gap: 14, maxWidth: 420, padding: 20, width: "100%" }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
            <MaterialCommunityIcons name="cash-plus" size={20} color={colors.primary} />
            <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>{translateCopy("Ortağa satış ekle", language)}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateCopy("Kapat", language)}>
              <MaterialCommunityIcons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 17 }}>
            {translateCopy("Ortak", language)}: <Text style={{ color: colors.ink, fontWeight: "900" }}>{partnerName}</Text>{"\n"}
            {translateCopy("Referans linkiyle gelen alıcı site dışında satın aldıysa satışı buradan kaydet; ortağın komisyonu süreç başlar.", language)}
          </Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1.6, gap: 5 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Satış tutarı (toplam)", language)}</Text>
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder={String(listPrice)}
                placeholderTextColor={colors.subtle}
                style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 46, paddingHorizontal: 12 }}
              />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Adet", language)}</Text>
              <TextInput
                value={qty}
                onChangeText={(t) => setQty(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={colors.subtle}
                style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 46, paddingHorizontal: 12 }}
              />
            </View>
          </View>

          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Ortağın komisyonu", language)}</Text>
            <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{moneyIn(commission, currency)}</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={onClose} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 11, borderWidth: 1, flex: 1, paddingVertical: 12 }}>
              <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{translateCopy("Vazgeç", language)}</Text>
            </Pressable>
            <Pressable onPress={() => { if (valid) onSubmit(totalAmount, qtyNum); }} disabled={!valid} style={{ alignItems: "center", backgroundColor: valid ? colors.primary : colors.line, borderRadius: 11, flex: 1, paddingVertical: 12 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Satışı Kaydet", language)}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
