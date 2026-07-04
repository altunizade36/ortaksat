import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

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

// Tırnak-duyarlı CSV satır ayrıştırıcı (virgül; "" ile kaçış).
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// CSV metnini iç "pipe" formatına çevirir; başlık satırı varsa atlar.
function csvToPipe(csv: string): string {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return "";
  const startIdx = /ba[sş]l[iı]k|title|fiyat|price/i.test(lines[0]) ? 1 : 0;
  return lines.slice(startIdx).map((l) => parseCsvLine(l).join(" | ")).join("\n");
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
  const canUpload = Platform.OS === "web" && typeof document !== "undefined";

  function pickCsv() {
    if (!canUpload) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv,text/plain";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setText(csvToPipe(String(reader.result ?? "")));
      reader.readAsText(file, "utf-8");
    };
    input.click();
  }

  // Excel/Sheets'te açılıp doldurulabilen örnek şablonu indirir (yalnız web).
  function downloadTemplate() {
    if (!canUpload) return;
    const csv = "Başlık,Fiyat,Komisyon%,Kategori,GörselURL\nKablosuz Kulaklık Pro,1899,12,Elektronik,https://\nHakiki Deri Kadın Çanta,2499,15,Moda,https://\n";
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }); // BOM: Excel TR karakterleri
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ortaksat-toplu-ilan-sablonu.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const MAX_BULK = 50; // spam/hız-limiti koruması: tek seferde en fazla 50 ilan
  const rows = useMemo(() => text.split("\n").map(parseLine).filter((r): r is ParsedRow => r !== null), [text]);
  const validRows = rows.filter((r) => r.valid);

  function publish() {
    const batch = validRows.slice(0, MAX_BULK);
    batch.forEach((r) => onCreate({ title: r.title, price: r.price, commission: r.commission, category: r.category, image: r.image ?? PLACEHOLDER_IMAGE }));
    setDone(batch.length);
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
                  <Text style={{ color: colors.info, fontSize: 12.5, fontWeight: "900" }}>Her satır bir ilan. Alanları | veya , (CSV) ile ayır:</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Başlık | Fiyat | Komisyon% | Kategori | GörselURL (opsiyonel)</Text>
                  <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800", marginTop: 2 }}>✨ Açıklama, satış metni ve Instagram/WhatsApp/TikTok paylaşım metinleri her ilan için otomatik oluşturulur — sonradan düzenleyebilirsin.</Text>
                </View>

                {canUpload ? (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable onPress={pickCsv} accessibilityRole="button" accessibilityLabel="CSV dosyası yükle" style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.primary, borderRadius: 11, borderStyle: "dashed", borderWidth: 1.5, flex: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 13 }}>
                      <MaterialCommunityIcons name="file-delimited-outline" size={18} color={colors.primaryDark} />
                      <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>CSV yükle</Text>
                    </Pressable>
                    <Pressable onPress={downloadTemplate} accessibilityRole="button" accessibilityLabel="Örnek CSV şablonu indir" style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 13 }}>
                      <MaterialCommunityIcons name="download-outline" size={18} color={colors.muted} />
                      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>Şablon</Text>
                    </Pressable>
                  </View>
                ) : null}

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
