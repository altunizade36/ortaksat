import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { commissionValueLabel } from "@/lib/format";
import { parseListingRate } from "@/lib/listing-numbers";
import type { Listing } from "@/lib/types";
import { parseTrPrice } from "@/lib/validation";

/**
 * WEB ortaklık başvuru penceresi (yalnız SATICI ONAYLI ilanlarda açılır; açık/davetli ilanda katılım anında başlar).
 *
 * İsteğe bağlı iki alan: komisyon önerisi ve satıcıya kısa not. Öneri ilanın komisyon türünde (yüzde ya da tutar)
 * girilir ve ilandaki değerden YÜKSEK olmalıdır; boş bırakılırsa ilandaki komisyonla başvurulur. Sunucu öneriyi
 * `partner_join(p_proposed_value)` ile saklar, satıcı "öneriyle" ya da "ilan oranıyla" kabul eder.
 * Uygulamadaki karşılığı: app/partnership-request/[id].tsx (aynı doğrulama kuralları).
 */
export function PartnershipApplyDialog({ listing, visible, busy, onClose, onSubmit }: {
  listing: Listing;
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { proposedCommissionValue?: number; note: string }) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (visible) { setAmount(""); setNote(""); setError(""); } }, [visible]);

  const kind = listing.commissionType;
  const current = commissionValueLabel(kind, listing.commissionValue, listing.currency);

  function submit() {
    if (busy) return;
    const raw = amount.trim();
    if (!raw) { onSubmit({ note: note.trim() }); return; }
    const value = kind === "rate" ? parseListingRate(raw) : parseTrPrice(raw);
    if (!/^[\d.,\s%₺]+$/.test(raw) || !Number.isFinite(value) || value <= 0 || (kind === "rate" && value > 90)) {
      setError(kind === "rate" ? "Geçerli bir yüzde gir (en çok 90). Örnek: 12 ya da 12,5." : "Geçerli bir tutar gir. Örnek: 1.500");
      return;
    }
    if (value < listing.commissionValue) { setError(`Önerin ilandaki komisyondan (${current}) düşük olamaz. Öneri yapmak istemiyorsan alanı boş bırak.`); return; }
    onSubmit({ proposedCommissionValue: value > listing.commissionValue ? value : undefined, note: note.trim() });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ alignItems: "center", backgroundColor: "rgba(7,18,45,0.55)", flex: 1, justifyContent: "center", padding: 12 }}>
        <View testID="partnership-apply-dialog" style={{ backgroundColor: colors.surface, borderRadius: 16, maxHeight: "92%" as never, maxWidth: 480, overflow: "hidden", width: "100%" }}>
          <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>
            <MaterialCommunityIcons name="handshake-outline" size={22} color={colors.primary} />
            <Text accessibilityRole="header" style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900", minWidth: 0 }}>Ortaklık başvurusu</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={onClose} hitSlop={8} style={{ alignItems: "center", height: 34, justifyContent: "center", width: 34 }}>
              <MaterialCommunityIcons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, padding: 16 }}>
            <View style={{ backgroundColor: colors.primarySoft, borderRadius: 12, gap: 4, padding: 12 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>Satıcının belirlediği komisyon: {current}</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18 }}>Satıcı başvurunu onaylayınca şartlar kayıt altına alınır; ilan sonradan değişse de senin şartların değişmez.</Text>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>Komisyon önerin (isteğe bağlı)</Text>
              <View style={{ alignItems: "center", borderColor: error ? colors.accent : colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", paddingHorizontal: 12 }}>
                <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "800" }}>{kind === "rate" ? "%" : "₺"}</Text>
                <TextInput
                  testID="partnership-apply-proposal"
                  accessibilityLabel="Komisyon önerin"
                  value={amount}
                  onChangeText={(v) => { setAmount(v); setError(""); }}
                  keyboardType="decimal-pad"
                  placeholder={kind === "rate" ? `ör. ${listing.commissionValue + 2}` : "ör. 1.500"}
                  placeholderTextColor={colors.subtle}
                  style={{ color: colors.ink, flex: 1, fontSize: 16, minHeight: 44, minWidth: 0, paddingHorizontal: 8 }}
                />
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>Boş bırakırsan ilandaki komisyonla başvurursun. Önerin ilandakinden yüksekse satıcı onu kabul edebilir ya da ilan oranıyla onaylayabilir.</Text>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>Satıcıya not (isteğe bağlı)</Text>
              <TextInput
                testID="partnership-apply-note"
                accessibilityLabel="Satıcıya not"
                value={note}
                onChangeText={setNote}
                maxLength={400}
                multiline
                placeholder="Ürünü nasıl tanıtacağını kısaca yazabilirsin."
                placeholderTextColor={colors.subtle}
                style={{ borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 80, padding: 10, textAlignVertical: "top" }}
              />
            </View>
            {error ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>{error}</Text> : null}
          </ScrollView>
          <View style={{ borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 8, padding: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Vazgeç" onPress={onClose} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 44 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "800" }}>Vazgeç</Text>
            </Pressable>
            <Pressable testID="partnership-apply-submit" accessibilityRole="button" accessibilityLabel="Başvuruyu gönder" disabled={busy} onPress={submit} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flex: 1, justifyContent: "center", minHeight: 44, opacity: busy ? 0.6 : 1 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>{busy ? "Gönderiliyor…" : "Başvuruyu gönder"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
