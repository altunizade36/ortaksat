import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { PrimaryButton } from "@/components/ui";
import { moneyIn } from "@/lib/format";
import { parseTrPrice } from "@/lib/validation";

type ParsedRow = {
  title: string;
  price: number;
  commission: number;
  category: string;
  image?: string;
  valid: boolean;
  reason?: string;
};

/** Bir satırı ayrıştır: Başlık | Fiyat | Komisyon% | Kategori | GörselURL(ops.) */
function parseLine(raw: string): ParsedRow | null {
  const line = raw.trim();
  if (!line) return null;
  const parts = (line.includes("|") ? line.split("|") : line.split("\t")).map((p) => p.trim());
  const [title = "", priceRaw = "", commissionRaw = "", category = "", image = ""] = parts;
  const price = parseTrPrice(priceRaw);
  const commission = Number(String(commissionRaw).replace(/[^\d.,]/g, "").replace(",", "."));
  let reason: string | undefined;
  if (title.length < 10) reason = "Başlık en az 10 karakter olmalı";
  else if (!(price > 0)) reason = "Geçerli fiyat gir";
  else if (!(commission > 0)) reason = "Komisyon %";
  else if (!category) reason = "Kategori gir";
  return {
    title,
    price,
    commission: commission || 0,
    category: category || "Genel",
    image: /^https?:\/\//i.test(image) ? image : undefined,
    valid: !reason,
    reason
  };
}

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200";
const SAMPLE = "Kablosuz Kulaklık Pro | 1.899 | 12 | Elektronik | https://...\nAkıllı Saat Seri 5 | 2.499 | 10 | Elektronik";

/**
 * Toplu ilan ekleme — çok ürünlü satıcılar için. Her satır bir ilan:
 * Başlık | Fiyat | Komisyon% | Kategori | GörselURL(opsiyonel)
 */
export function BulkListingModal({
  visible,
  onClose,
  onCreate
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (row: { title: string; price: number; commission: number; category: string; image: string }) => void;
}) {
  const [text, setText] = useState("");
  const [done, setDone] = useState<number | null>(null);

  const rows = useMemo(() => text.split("\n").map(parseLine).filter((r): r is ParsedRow => r !== null), [text]);
  const validRows = rows.filter((r) => r.valid);

  function publish() {
    validRows.forEach((r) => onCreate({ title: r.title, price: r.price, commission: r.commission, category: r.category, image: r.image ?? PLACEHOLDER_IMAGE }));
    setDone(validRows.length);
    setText("");
  }

  function close() {
    setDone(null);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={{ backgroundColor: "rgba(0,0,0,0.45)", flex: 1, justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%", paddingBottom: 24 }}>
          <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingVertical: 14 }}>
            <MaterialCommunityIcons name="table-arrow-up" size={20} color={colors.primary} />
            <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>Toplu ilan ekle</Text>
            <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Kapat">
              <MaterialCommunityIcons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: 14, padding: 18 }}>
            {done !== null ? (
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 14, gap: 8, padding: 20 }}>
                <MaterialCommunityIcons name="check-circle" size={40} color={colors.primary} />
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{done} ilan eklendi</Text>
                <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>İlanların listende görünür. Görsel eklemediklerine düzenleme ekranından fotoğraf ekleyebilirsin.</Text>
                <View style={{ width: "100%" }}>
                  <PrimaryButton onPress={close}>Tamam</PrimaryButton>
                </View>
              </View>
            ) : (
              <>
                <View style={{ backgroundColor: colors.infoSoft, borderRadius: 10, gap: 4, padding: 12 }}>
                  <Text style={{ color: colors.info, fontSize: 12.5, fontWeight: "900" }}>Her satır bir ilan. Alanları | ile ayır:</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Başlık | Fiyat | Komisyon% | Kategori | GörselURL (opsiyonel)</Text>
                </View>

                <TextInput
                  value={text}
                  onChangeText={setText}
                  multiline
                  placeholder={SAMPLE}
                  placeholderTextColor={colors.subtle}
                  style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 150, padding: 14, textAlignVertical: "top" }}
                />

                {rows.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>
                      Önizleme · {validRows.length} geçerli / {rows.length} satır
                    </Text>
                    {rows.slice(0, 30).map((r, i) => (
                      <View key={i} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: r.valid ? colors.line : colors.warning, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 10, padding: 10 }}>
                        <MaterialCommunityIcons name={r.valid ? "check-circle" : "alert-circle-outline"} size={18} color={r.valid ? colors.primary : colors.warning} />
                        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{r.title || "(başlık yok)"}</Text>
                          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>
                            {r.valid ? `${moneyIn(r.price, "TRY")} · %${r.commission} komisyon · ${r.category}` : r.reason}
                          </Text>
                        </View>
                      </View>
                    ))}
                    {rows.length > 30 ? <Text style={{ color: colors.subtle, fontSize: 12 }}>+{rows.length - 30} satır daha…</Text> : null}
                  </View>
                ) : null}

                <PrimaryButton tone={validRows.length ? "primary" : "secondary"} onPress={validRows.length ? publish : undefined} icon="cloud-upload-outline">
                  {validRows.length > 0 ? `${validRows.length} ilanı yayınla` : "Yayınlanacak geçerli satır yok"}
                </PrimaryButton>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
