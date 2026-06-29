import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { CategoryPicker } from "@/components/category-picker";
import { colors } from "@/components/colors";
import { LocationSelector, type LocationValue } from "@/components/location-selector";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { getFormSchema, resolveFormKey, type CategoryNode, type FieldDef } from "@/lib/category-tree";
import { money } from "@/lib/format";
import { formatLocation, getProvince } from "@/lib/locations";
import type { CommissionType, PartnershipMode } from "@/lib/types";
import { useStore } from "@/lib/use-store";

const STEPS = ["Kategori", "İlan Bilgileri", "Konum", "Fotoğraflar", "Komisyon & Ortak Satış", "Önizleme & Yayınla"];
const CONDITION_IMG = "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=1200";

type Values = Record<string, string | boolean>;

export function DesktopCreateFlow() {
  const router = useRouter();
  const { createListing, addCategorySuggestion, addLocationSuggestion } = useStore();
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<CategoryNode[]>([]);
  const [values, setValues] = useState<Values>({});
  const [images, setImages] = useState<string[]>([]);
  const [imageDraft, setImageDraft] = useState("");
  const [loc, setLoc] = useState<LocationValue>({});
  const [visibility, setVisibility] = useState<"city_only" | "district_only" | "neighborhood" | "full_address_private">("neighborhood");

  const [commissionType, setCommissionType] = useState<CommissionType>("rate");
  const [commissionValue, setCommissionValue] = useState("15");
  const [partnershipMode, setPartnershipMode] = useState<PartnershipMode>("approval");
  const [autoApprove, setAutoApprove] = useState(false);
  const [maxPartners, setMaxPartners] = useState("");
  const [trigger, setTrigger] = useState("Satış onaylanınca");
  const [partnerNote, setPartnerNote] = useState("");
  const [contactMethod, setContactMethod] = useState<"message" | "whatsapp" | "phone">("message");
  const [publishing, setPublishing] = useState(false);

  const formKey = path.length ? resolveFormKey(path) : "";
  const schema = formKey ? getFormSchema(formKey) : undefined;
  const leafLabel = path.length ? path[path.length - 1].label : "";
  const coverImage = images[0] || path.find((p) => p.image)?.image || CONDITION_IMG;

  const setV = (k: string, v: string | boolean) => setValues((s) => ({ ...s, [k]: v }));
  const missingFields = useMemo(() => (schema ? schema.fields.filter((f) => f.required && !String(values[f.key] ?? "").trim()) : []), [schema, values]);

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ["images"], quality: 0.85, selectionLimit: 5 });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri).filter(Boolean);
    setImages((s) => [...s, ...uris].slice(0, 5));
  }

  const canNext = () => {
    if (step === 0) return path.length > 0;
    if (step === 1) return missingFields.length === 0;
    if (step === 2) return !!loc.provinceId && !!loc.districtId;
    if (step === 3) return images.length > 0;
    if (step === 4) return Number(commissionValue) > 0;
    return true;
  };

  async function publish() {
    if (!schema) return;
    setPublishing(true);
    try {
      // "Diğer" seçildiyse kategori önerisi olarak admin incelemesine düşür.
      if (path[0]?.label === "Diğer") {
        addCategorySuggestion({ suggestedPath: `${String(values.title ?? "").trim() || "Yeni ürün"} — ${String(values.description ?? "").slice(0, 60)}`, note: "İlan formundan 'Diğer' kategorisi ile gönderildi." });
      }
      void addLocationSuggestion; // konum önerisi 'Mahallemi bulamadım' akışına bağlı (canlıda mahalle listesi gelince)
      const price = Number(values.price) || 0;
      const tags = [path[0]?.label, leafLabel, String(values.brand ?? ""), String(values.condition ?? "")].map((t) => String(t).trim()).filter(Boolean).slice(0, 8);
      const detailLines = schema.fields
        .filter((f) => f.key !== "title" && f.key !== "description" && f.key !== "price" && values[f.key] !== undefined && String(values[f.key]).trim() && typeof values[f.key] !== "boolean")
        .map((f) => `${f.label}: ${values[f.key]}${f.suffix ? " " + f.suffix : ""}`);
      const boolLines = schema.fields.filter((f) => f.type === "bool" && values[f.key] === true).map((f) => `${f.label}: Evet`);

      createListing({
        title: String(values.title ?? leafLabel).trim() || leafLabel,
        description: String(values.description ?? "").trim() || "Açıklama eklenmedi.",
        salesPitch: detailLines.slice(0, 4).length ? detailLines.slice(0, 4) : ["Ürünün ana faydasını kısa ve net anlat."],
        shareTemplates: { instagram: "", whatsapp: "", tiktok: "" },
        adAssets: images.slice(1, 5),
        tags: tags.length ? tags : ["ortak satış"],
        price,
        commissionType,
        commissionValue: Number(commissionValue) || 0,
        partnershipMode,
        category: leafLabel || path[0]?.label || "Genel",
        location: formatLocation(loc, visibility) || getProvince(loc.provinceId)?.name || "Türkiye",
        image: coverImage,
        stockCount: Number(values.stock) || 1,
        minPartnerRating: 4,
        commissionDueDays: 3,
        returnWindowDays: 7,
        partnerRules: [...boolLines, partnerNote.trim()].filter(Boolean).length ? [...boolLines, partnerNote.trim()].filter(Boolean) : ["Komisyon sadece onaylı satış kaydında oluşur."],
        deliveryNote: "Teslimat ve ödeme satıcıyla alıcı arasında netleştirilir; Ortaksat para tutmaz.",
        contactMethod
      });
      router.replace("/(tabs)/seller");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>Yeni ilan oluştur</Text>
        <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Kategorini seç, sana özel form açılsın. Ortak satışa açarak ortakların ürününü kendi kitlesine yaysın.</Text>
      </View>

      {/* Stepper */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {STEPS.map((s, i) => {
          const done = i < step;
          const on = i === step;
          const reachable = i <= step || (i === step + 1 && canNext());
          return (
            <Pressable key={s} onPress={() => { if (i < step || reachable) setStep(i); }} style={{ alignItems: "center", backgroundColor: on ? colors.primary : done ? colors.primarySoft : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 13, paddingVertical: 8 }}>
              <View style={{ alignItems: "center", backgroundColor: on ? "#FFFFFF" : done ? colors.primary : colors.surfaceAlt, borderRadius: 999, height: 20, justifyContent: "center", width: 20 }}>
                {done ? <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" /> : <Text style={{ color: on ? colors.primary : colors.muted, fontSize: 11, fontWeight: "900" }}>{i + 1}</Text>}
              </View>
              <Text style={{ color: on ? "#FFFFFF" : done ? colors.primaryDark : colors.muted, fontSize: 12.5, fontWeight: "800" }}>{s}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Body */}
      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, padding: 22 }}>
        {step === 0 ? <CategoryPicker value={path} onChange={(p) => { setPath(p); if (p.length) setStep(1); }} /> : null}

        {step === 1 && schema ? (
          <View style={{ gap: 16 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{schema.title}</Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{leafLabel} için gerekli alanlar. * işaretliler zorunlu.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              {schema.fields.map((f) => (
                <DField key={f.key} field={f} value={values[f.key]} onChange={(v) => setV(f.key, v)} />
              ))}
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: 16 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Konum</Text>
            <LocationSelector value={loc} onChange={setLoc} required showNeighborhood showAddressLine mode="listing" />
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Adres görünürlüğü</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {([["city_only", "Sadece il/ilçe"], ["neighborhood", "İl/ilçe/mahalle"], ["full_address_private", "Açık adres yalnızca onay sonrası"]] as const).map(([k, lbl]) => {
                  const on = visibility === k;
                  return (
                    <Pressable key={k} onPress={() => setVisibility(k)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 }}>
                      <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{lbl}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: 14 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Fotoğraflar</Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>En az 1, en fazla 5 görsel. İlk görsel kapak olur.</Text>
            <Pressable onPress={() => void pickFromGallery()} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 11, flexDirection: "row", gap: 7, paddingHorizontal: 16, paddingVertical: 11 }}>
              <MaterialCommunityIcons name="image-multiple-outline" size={17} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>Galeriden / cihazdan seç</Text>
            </Pressable>
            <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>veya görsel adresi yapıştır:</Text>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <TextInput value={imageDraft} onChangeText={setImageDraft} placeholder="https://…/foto.jpg" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 46, paddingHorizontal: 12 }} />
              <Pressable onPress={() => { const u = imageDraft.trim(); if (u && images.length < 5) { setImages((s) => [...s, u]); setImageDraft(""); } }} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 12 }}>
                <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Ekle</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {images.length === 0 ? <Text style={{ color: colors.subtle, fontSize: 12.5, fontWeight: "600" }}>Henüz görsel yok — kategori görseli kapak olarak kullanılır.</Text> : null}
              {images.map((img, i) => (
                <View key={img + i} style={{ borderColor: i === 0 ? colors.primary : colors.line, borderRadius: 12, borderWidth: i === 0 ? 2 : 1, height: 110, overflow: "hidden", width: 150 }}>
                  <SafeRemoteImage uri={img} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                  <Pressable onPress={() => setImages((s) => s.filter((_, idx) => idx !== i))} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, height: 24, justifyContent: "center", position: "absolute", right: 6, top: 6, width: 24 }}>
                    <MaterialCommunityIcons name="close" size={15} color="#FFFFFF" />
                  </Pressable>
                  {i === 0 ? <View style={{ backgroundColor: colors.primary, borderRadius: 6, left: 6, paddingHorizontal: 7, paddingVertical: 2, position: "absolute", top: 6 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>Kapak</Text></View> : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={{ gap: 16 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Komisyon & Ortak Satış</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, gap: 6, minWidth: 200 }}>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Komisyon tipi</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["rate", "fixed"] as const).map((tp) => {
                    const on = commissionType === tp;
                    return <Pressable key={tp} onPress={() => setCommissionType(tp)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 11 }}><Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800", textAlign: "center" }}>{tp === "rate" ? "Yüzde (%)" : "Sabit (₺)"}</Text></Pressable>;
                  })}
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800", marginBottom: 6 }}>Komisyon {commissionType === "rate" ? "oranı (%)" : "tutarı (₺)"}</Text>
                <TextInput value={commissionValue} onChangeText={setCommissionValue} keyboardType="numeric" style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 46, paddingHorizontal: 12 }} />
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Ortaklık kabul şekli</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {([["open", "Herkese açık (anında ortak)"], ["approval", "Başvuru onayı gerekir"], ["invite", "Sadece davetle"]] as const).map(([k, lbl]) => {
                  const on = partnershipMode === k;
                  return <Pressable key={k} onPress={() => setPartnershipMode(k)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 }}><Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{lbl}</Text></Pressable>;
                })}
              </View>
            </View>

            <ToggleRow label="Ortak başvurularını otomatik onayla" on={autoApprove} onPress={() => setAutoApprove((v) => !v)} />

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800", marginBottom: 6 }}>Maksimum ortak satıcı (boş = sınırsız)</Text>
                <TextInput value={maxPartners} onChangeText={setMaxPartners} keyboardType="numeric" placeholder="Sınırsız" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 46, paddingHorizontal: 12 }} />
              </View>
              <View style={{ flex: 1, minWidth: 200 }}>
                <DSelect label="Komisyon ne zaman hak edilir?" value={trigger} options={["Alıcı talebi oluşunca", "Satış onaylanınca", "Ödeme alınınca", "Teslimat tamamlanınca"]} onChange={setTrigger} />
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>İletişim tercihi</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {([["message", "Mesaj"], ["whatsapp", "WhatsApp"], ["phone", "Telefon"]] as const).map(([k, lbl]) => {
                  const on = contactMethod === k;
                  return <Pressable key={k} onPress={() => setContactMethod(k)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}><MaterialCommunityIcons name={k === "whatsapp" ? "whatsapp" : k === "phone" ? "phone" : "message-text-outline"} size={15} color={on ? "#FFFFFF" : colors.primary} /><Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{lbl}</Text></Pressable>;
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Ortak satıcıya özel açıklama (opsiyonel)</Text>
              <TextInput value={partnerNote} onChangeText={setPartnerNote} multiline placeholder="Ortakların dikkat etmesi gerekenler…" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 70, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: "top" }} />
            </View>

            <View style={{ alignItems: "flex-start", backgroundColor: colors.infoSoft, borderRadius: 10, flexDirection: "row", gap: 8, padding: 11 }}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.info} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>Ortaksat para tutmaz; komisyon, satış sonrası satıcı ile ortak arasında doğrudan ödenir. Uygulama yalnızca kaydı tutar.</Text>
            </View>
          </View>
        ) : null}

        {step === 5 ? (
          <View style={{ gap: 14 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Önizleme & Yayınla</Text>
            <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
              <View style={{ borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden", width: 280 }}>
                <View style={{ backgroundColor: colors.line, height: 170, width: "100%" }}><SafeRemoteImage uri={coverImage} style={{ height: "100%", width: "100%" }} contentFit="cover" /></View>
                <View style={{ gap: 6, padding: 14 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{path.map((p) => p.label).join(" › ")}</Text>
                  <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{String(values.title ?? leafLabel)}</Text>
                  <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{money(Number(values.price) || 0)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{formatLocation(loc, visibility) || "Konum belirtilmedi"}</Text>
                  <View style={{ alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>{commissionType === "rate" ? `%${commissionValue} komisyon` : `${money(Number(commissionValue) || 0)} komisyon`}</Text>
                  </View>
                </View>
              </View>
              <View style={{ flex: 1, gap: 8, minWidth: 240 }}>
                <PreviewRow label="Kategori" value={path.map((p) => p.label).join(" › ")} />
                <PreviewRow label="Konum" value={formatLocation(loc, "neighborhood") || "—"} />
                <PreviewRow label="Görsel" value={`${images.length || "kategori görseli"} adet`} />
                <PreviewRow label="Ortaklık" value={partnershipMode === "open" ? "Herkese açık" : partnershipMode === "approval" ? "Onaylı" : "Davetle"} />
                <PreviewRow label="Komisyon hak edişi" value={trigger} />
                {missingFields.length ? <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>Eksik zorunlu alan: {missingFields.map((f) => f.label).join(", ")}</Text> : <Text style={{ color: colors.success, fontSize: 12.5, fontWeight: "800" }}>✓ Tüm zorunlu alanlar dolu</Text>}
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {/* Nav */}
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable disabled={step === 0} onPress={() => setStep((s) => Math.max(0, s - 1))} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, opacity: step === 0 ? 0.4 : 1, paddingHorizontal: 18, paddingVertical: 11 }}>
          <MaterialCommunityIcons name="arrow-left" size={16} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>Geri</Text>
        </Pressable>
        {step < STEPS.length - 1 ? (
          <Pressable disabled={!canNext()} onPress={() => setStep((s) => s + 1)} style={{ alignItems: "center", backgroundColor: canNext() ? colors.primary : colors.line, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 22, paddingVertical: 12 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>Devam</Text><MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable disabled={publishing || missingFields.length > 0} onPress={() => void publish()} style={{ alignItems: "center", backgroundColor: missingFields.length ? colors.line : colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 24, paddingVertical: 12 }}>
            <MaterialCommunityIcons name="check-decagram" size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{publishing ? "Yayınlanıyor…" : "İlanı Yayınla"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function DField({ field, value, onChange }: { field: FieldDef; value: string | boolean | undefined; onChange: (v: string | boolean) => void }) {
  const wide = field.type === "textarea";
  return (
    <View style={{ flexBasis: wide ? "100%" : 230, flexGrow: 1, gap: 6, minWidth: 0 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{field.label}{field.required ? " *" : ""}{field.suffix ? ` (${field.suffix})` : ""}</Text>
      {field.type === "bool" ? (
        <Pressable onPress={() => onChange(!(value === true))} style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
          <View style={{ alignItems: value === true ? "flex-end" : "flex-start", backgroundColor: value === true ? colors.primary : colors.line, borderRadius: 999, height: 26, justifyContent: "center", paddingHorizontal: 3, width: 48 }}><View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 20, width: 20 }} /></View>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{value === true ? "Evet" : "Hayır"}</Text>
        </Pressable>
      ) : field.type === "select" ? (
        <DSelect label="" value={String(value ?? "")} options={field.options ?? []} onChange={onChange} placeholder="Seçin" />
      ) : (
        <TextInput
          value={String(value ?? "")}
          onChangeText={onChange}
          keyboardType={field.type === "number" ? "numeric" : "default"}
          multiline={wide}
          placeholder={field.placeholder}
          placeholderTextColor={colors.subtle}
          style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: wide ? 84 : 46, paddingHorizontal: 12, paddingVertical: wide ? 10 : 8, textAlignVertical: wide ? "top" : "center" }}
        />
      )}
    </View>
  );
}

function DSelect({ label, value, options, onChange, placeholder }: { label: string; value: string; options: string[]; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: label ? 6 : 0, position: "relative", zIndex: open ? 1000 : 1 }}>
      {label ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{label}</Text> : null}
      <Pressable onPress={() => setOpen((o) => !o)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: open ? colors.primary : colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 46, paddingHorizontal: 12 }}>
        <Text style={{ color: value ? colors.ink : colors.subtle, flex: 1, fontSize: 13.5, fontWeight: value ? "700" : "500" }}>{value || placeholder || "Seçin"}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <>
          <Pressable onPress={() => setOpen(false)} style={{ bottom: -2000, left: -2000, position: "absolute", right: -2000, top: -2000, zIndex: 900 }} />
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, left: 0, maxHeight: 260, position: "absolute", right: 0, shadowColor: "#101828", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 20, top: label ? 74 : 52, zIndex: 1000 }}>
            <ScrollView style={{ maxHeight: 260 }}>
              {options.map((o) => (
                <Pressable key={o} onPress={() => { onChange(o); setOpen(false); }} style={({ pressed }) => ({ backgroundColor: pressed || o === value ? colors.surfaceAlt : "transparent", paddingHorizontal: 12, paddingVertical: 10 })}>
                  <Text style={{ color: o === value ? colors.primaryDark : colors.ink, fontSize: 13, fontWeight: o === value ? "800" : "600" }}>{o}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </>
      ) : null}
    </View>
  );
}

function ToggleRow({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <View style={{ alignItems: on ? "flex-end" : "flex-start", backgroundColor: on ? colors.primary : colors.line, borderRadius: 999, height: 26, justifyContent: "center", paddingHorizontal: 3, width: 48 }}><View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 20, width: 20 }} /></View>
      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700", width: 140 }}>{label}</Text>
      <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}
