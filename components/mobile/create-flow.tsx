import { parseListingMoney, parseListingRate, listingCommissionError } from "@/lib/listing-numbers";
import { movePhoto, restorePhoto, type RemovedPhoto } from "@/lib/photo-order";
import { HorizontalScroll } from "@/components/horizontal-scroll";
import { ListingLocationFields } from "@/components/listing-location-fields";
import { CompactFooter } from "@/components/compact-footer";
import { ListingTitleInput } from "@/components/listing-title-input";
import { ListingVideoField, type ListingVideoStatus } from "@/components/listing-video-field";
import { withListingVideo, type ListingVideoValue } from "@/lib/listing-video";
import { validateListingTitle, normalizeListingTitle } from "@/lib/listing-title";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Keyboard, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View, type TextInputInstance, type ScrollViewInstance, type ViewInstance } from "react-native";
import { useFocusEffect } from "expo-router";
import { useBackNavigation } from "@/lib/use-back-navigation";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { OptionSheet } from "@/components/option-sheet";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { type LocationValue } from "@/components/location-selector";
import { LegalDisclaimerAccept } from "@/components/legal-disclaimer";
import { modelsForSchema, type CategoryNode, type FormSchema, type FieldDef } from "@/lib/category-tree";
import { parseTrPrice } from "@/lib/validation";
import { LIMITS, validateListing } from "@/lib/validation";
import { moneyIn } from "@/lib/format";
import { showToast } from "@/lib/toast";
import type { CommissionType, PartnershipMode } from "@/lib/types";
import { MobileListingPreview, type PreviewListing } from "./listing-preview";
import { formatLocation, validateListingLocation } from "@/lib/locations";
import { MobileCategorySelect } from "./category-select";
import { MobileBottomNav, MobileButton, MobileCard, MobileChip, MobileField, MobileScreen, MobileSelect, IconButton, SectionLabel, mobile, ms, useMobileLayout } from "./ui";

type Values = Record<string, string | boolean | string[]>;
type Props = {
  picking?: boolean;
  currency?: "TRY" | "USD" | "EUR";
  path: CategoryNode[]; onPath: (p: CategoryNode[]) => void; schema?: FormSchema; values: Values; onValue: (k: string, v: string | boolean | string[]) => void;
  images: string[]; onImages: (v: string[]) => void; onGallery: () => void; onCamera: () => void;
  /** İsteğe bağlı TEK video (yüklenmiş URL) — fotoğraf sayısına dahil değil. */
  video: ListingVideoValue | null; onVideo: (v: ListingVideoValue | null) => void; videoStatus: ListingVideoStatus; onVideoStatus: (s: ListingVideoStatus) => void; videoUserId?: string; canUploadVideo: boolean;
  /** Kayıtlı taslağın videosu (alan onu depodan silmez) · alanı yeniden kuran anahtar (taslak geri yüklenince) · taslak videosu doğrulanıyor mu. */
  videoKeepUrl?: string | null; videoFieldKey?: number; videoChecking?: boolean;
  loc: LocationValue; onLocation: (v: LocationValue) => void; visibility: string; onVisibility: (v: "city_only" | "district_only" | "neighborhood" | "full_address_private") => void;
  commissionType: CommissionType; onCommissionType: (v: CommissionType) => void; commissionValue: string; onCommission: (v: string) => void; partnershipMode: PartnershipMode; onPartnership: (v: PartnershipMode) => void;
  maxPartners: string; onMaxPartners: (v: string) => void; contactMethod: "message" | "whatsapp" | "phone"; onContact: (v: "message" | "whatsapp" | "phone") => void;
  acceptedLegal: boolean; onLegal: (v: boolean) => void; publishing: boolean; error: string | null; onPublish: () => void; hasDraft: boolean; onRestore: () => void; onClearDraft: () => void; onSaveDraft: () => void;
};
const steps = ["Fotoğraf", "Ürün Bilgileri", "Ortaklık Ayarları", "Önizleme"];

export function MobileCreateFlow(p: Props) {
  const leave = useBackNavigation();
  const { tablet, maxWidth, insets } = useMobileLayout();
  const [draftOpen, setDraftOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [removedPhoto, setRemovedPhoto] = useState<RemovedPhoto | null>(null);
  const [photoOptions, setPhotoOptions] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [step, setStep] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [invalidField, setInvalidField] = useState("");
  const titleRef = useRef<TextInputInstance>(null);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardOpen(true);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        scrollFocusedField();
      }));
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [validation, setValidation] = useState("");
  const scroll = useRef<ScrollViewInstance>(null);
  const content = useRef<ViewInstance>(null);
  const positions = useRef<Record<number, number>>({});
  useEffect(() => {
    if (photoIndex !== null && photoIndex >= p.images.length) setPhotoIndex(p.images.length ? p.images.length - 1 : null);
  }, [photoIndex, p.images.length]);
  function moveSelectedPhoto(direction: number) {
    if (photoIndex === null || p.picking || p.publishing) return;
    const target = photoIndex + direction;
    const next = movePhoto(p.images, photoIndex, target);
    if (next === p.images) return;
    p.onImages(next); setPhotoIndex(target);
  }

  function scrollFocusedField() {
    if (Platform.OS === "web") return;
    const focused = TextInput.State.currentlyFocusedInput();
    const inner = content.current;
    if (focused && inner) focused.measureLayout(inner, (_x, y) => {
      scroll.current?.scrollTo({ y: Math.max(0, y - 42), animated: true });
    }, () => {});
  }

  function back() {
    if (p.publishing || p.picking) return;
    if (photoOptions) { setPhotoOptions(false); return; }
    if (preview) { goto(2); return; }
    if (step > 0) { goto(step - 1); return; }
    leave();
  }
  const backRef = useRef(back);
  backRef.current = back;
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!preview && step === 0 && !photoOptions && !p.publishing && !p.picking) return false;
      backRef.current(); return true;
    });
    return () => subscription.remove();
  }, [preview, step, photoOptions, p.publishing, p.picking]));
  const priceField = p.schema?.fields.find((f) => f.key === "price" || f.key.toLowerCase().includes("price") && f.type === "number");
  const price = parseListingMoney(p.values[priceField?.key || "price"] ? String(p.values[priceField?.key || "price"]) : 0);
  const commissionNumber = p.commissionType === "rate" ? parseListingRate(p.commissionValue) : parseListingMoney(p.commissionValue);
  const setValue = (key: string) => (v: string) => p.onValue(key, v);
  const formFields = (p.schema?.fields ?? []).filter((f) => !["title", "description"].includes(f.key));
  const isPrimary = (f: FieldDef) => f.required || [priceField?.key || "price", "bodyType", "color", "condition", "warranty"].includes(f.key);
  const shownFields = formFields.filter((f) => isPrimary(f) || optionalOpen);
  const partnerable = p.partnershipMode !== "none";
  function invalid(message: string, section: number, field = "") {
    Keyboard.dismiss(); setPreview(false); setValidation(message); setInvalidField(field);
    setStep(section === 4 || section === 5 ? 1 : section);
    scroll.current?.scrollTo({ y: positions.current[section] || 0, animated: true });
    if (field === "title") requestAnimationFrame(() => titleRef.current?.focus());
    showToast(message);
  }
  function validateProduct() {
    if (!p.schema) { invalid("İlanın için bir kategori seç.", 5); return false; }
    const titleCheck = validateListingTitle(String(p.values.title || ""));
    if (titleCheck.error) { invalid(titleCheck.error, 1, "title"); return false; }
    const checked = validateListing({ title: String(p.values.title || ""), description: String(p.values.description || ""), price: String(p.values[priceField?.key || "price"] ?? "") });
    const baseError = checked.errors.find(e => e.field === "description" ? p.schema?.fields.find(f => f.key === "description")?.required || String(p.values.description || "").trim() : e.field === "price" ? priceField?.required || String(p.values[priceField?.key || "price"] || "").trim() : true);
    if (baseError) { invalid(baseError.message, 1, baseError.field); return false; }
    const rawPrice = String(p.values[priceField?.key || "price"] || "").trim();
    if (rawPrice && !/^[\d.,\s]+$/.test(rawPrice)) { invalid("Fiyatı yalnızca rakam, nokta ve virgül kullanarak gir.", 1, "price"); return false; }
    const missing = p.schema.fields.find(f => f.required && (Array.isArray(p.values[f.key]) ? !(p.values[f.key] as string[]).length : !String(p.values[f.key] ?? "").trim()));
    if (missing) { invalid(`${missing.label} alanını doldur.`, 1, missing.key); return false; }
    return true;
  }
  function validatePartnership() {
    if (!partnerable) return true;
    const error = listingCommissionError(p.commissionType, p.commissionValue, p.maxPartners);
    if (error) { invalid(error, 2); return false; }
    return true;
  }
  /** Video yüklenirken ilerleme yok; başarısız video sessizce düşürülmez (kullanıcı karar verir). */
  function videoBlocked() {
    if (p.videoStatus === "uploading") { invalid("Video yükleniyor; yükleme bitince devam edebilirsin.", 0); return true; }
    if (p.videoStatus === "error") { invalid("Video yüklenemedi: tekrar dene ya da videosuz devam et.", 0); return true; }
    if (p.videoChecking) { invalid("Taslaktaki video kontrol ediliyor; birkaç saniye sonra tekrar dene.", 0); return true; }
    return false;
  }
  function showPreview() {
    if (p.picking || p.publishing) return;
    if (!p.images.length) { invalid("En az bir fotoğraf ekle.", 0); return; }
    if (videoBlocked()) return;
    if (!validateProduct()) return;
    const locationError = validateListingLocation(p.loc);
    if (locationError) { invalid(locationError, 4); return; }
    if (!validatePartnership()) return;
    Keyboard.dismiss(); setValidation(""); setInvalidField(""); setPreview(true); setStep(3); scroll.current?.scrollTo({ y: 0, animated: true });
  }
  function goto(i: number) {
    if (p.picking || p.publishing) return;
    Keyboard.dismiss();
    if (i === 3) { showPreview(); return; }
    setPreview(false); setStep(i); setValidation(""); setInvalidField("");
    const section = i === 1 && !p.schema ? 5 : i;
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: positions.current[section] || 0, animated: true }));
  }
  function advance() {
    if (p.picking || p.publishing) return;
    if (step === 0) {
      if (!p.images.length) { invalid("En az bir fotoğraf ekle.", 0); return; }
      if (videoBlocked()) return;
      goto(1); return;
    }
    if (step === 1) {
      if (!validateProduct()) return;
      const locationError = validateListingLocation(p.loc);
      if (locationError) { invalid(locationError, 4); return; }
      goto(2); return;
    }
    showPreview();
  }
  function renderField(f: FieldDef) {
    let options = f.options ?? [];
    if (f.key === "model") { const models = modelsForSchema(p.schema?.key || "", String(p.values.brand || "")); if (models.length) options = [...models, "Diğer"]; }
    const value = p.values[f.key];
    if (f.type === "bool") return <View style={[ms.row, { flex: 1 }]}><Text style={ms.label}>{f.label}</Text><Switch {...({ activeThumbColor: "#FFFFFF" } as object)} thumbColor="white" accessibilityLabel={f.label} value={value === true} onValueChange={(v) => p.onValue(f.key, v)} trackColor={{ true: mobile.teal }} /></View>;
    if (f.type === "multiselect") return <View style={{ gap: 6 }}><Text style={ms.label}>{f.label}</Text><View style={ms.wrap}>{options.map((v) => <MobileChip key={v} label={v} selected={Array.isArray(value) && value.includes(v)} onPress={() => { const prev = Array.isArray(value) ? value : []; p.onValue(f.key, prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]); }} />)}</View></View>;
    return options.length ? <MobileSelect label={`${f.label}${f.required ? " *" : ""}`} value={String(value || "")} options={options} onChange={setValue(f.key)} /> : <MobileField label={f.label} required={f.required} numeric={f.type === "number"} multiline={f.type === "textarea"} value={String(value || "")} onChange={setValue(f.key)} placeholder={f.placeholder} />;
  }
  if (preview) {
    const attributes: NonNullable<PreviewListing["attributes"]> = { _formKey: p.schema?.key || "", _maxPartners: p.maxPartners };
    for (const def of formFields) {
      const value = p.values[def.key];
      if (value != null && value !== "") attributes[def.key] = def.type === "number" ? parseTrPrice(String(value)) : value;
    }
    const draft: PreviewListing = { title: normalizeListingTitle(String(p.values.title || "")), description: String(p.values.description || ""), price, currency: p.currency || "TRY", category: p.path.map(n => n.label).join(" / "), location: formatLocation(p.loc, p.visibility as "city_only" | "district_only" | "neighborhood" | "full_address_private"), image: p.images[0] || "", adAssets: withListingVideo(p.images.slice(1), p.video?.url), attributes, partnershipMode: p.partnershipMode, commissionType: p.commissionType, commissionValue: partnerable ? commissionNumber : 0 };
    return <MobileListingPreview listing={draft} onBack={back} onEdit={section => { if (section === "category") { setPreview(false); setCategoryOpen(true); } else goto(section === "photos" ? 0 : section === "partnership" ? 2 : 1); }} onConfirm={p.onPublish} busy={p.publishing} disabled={!p.acceptedLegal} legal={<LegalDisclaimerAccept value={p.acceptedLegal} onChange={p.onLegal}/>} error={p.error} />;
  }
  return <MobileScreen keyboardBehavior={Platform.OS === "android" ? "height" : undefined} onBack={back} title={preview ? "İlan Önizleme" : "İlan Ver"} right={<Pressable accessibilityRole="button" accessibilityLabel="Taslaklarım" onPress={() => setDraftOpen(true)}><Text style={{ color: mobile.teal, fontSize: 12, fontWeight: "700" }}>Taslaklarım</Text></Pressable>} scroll={false} bottom={<View><View testID="create-step-actions" style={{ paddingHorizontal: 13, paddingTop: 9, paddingBottom: keyboardOpen ? Math.max(9, insets.bottom + 9) : 9, backgroundColor: "white", borderTopWidth: 1, borderColor: mobile.line, gap: 6 }}>
      <Text accessibilityLiveRegion="polite" style={[ms.muted, { fontSize: 11 }]}>{step + 1}/4 · {steps[step]}</Text>
      <View style={ms.row}>{step > 0 && <MobileButton secondary disabled={p.picking || p.publishing} onPress={back} icon="chevron-left">Önceki</MobileButton>}<MobileButton style={{ flex: 1 }} disabled={p.picking || p.publishing} onPress={advance} icon="chevron-right">{p.picking ? "Fotoğraflar hazırlanıyor…" : step === 0 ? "Ürün bilgilerine devam et" : step === 1 ? "Ortaklık ayarlarına devam et" : "İleri — Önizlemeye Geç"}</MobileButton></View>
    </View><MobileBottomNav active="create" /></View>}>
    {!keyboardOpen && <View style={{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row" }}>{steps.map((label, i) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${i + 1}. ${label}`} accessibilityState={{ selected: i === step }} aria-pressed={i === step} onPress={() => goto(i)} style={{ flex: 1, minHeight: 48, alignItems: "center", gap: 5 }}><View style={{ position: "absolute", left: 0, right: 0, top: 11, height: 1, backgroundColor: mobile.line }} /><View style={{ width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: step === i ? mobile.teal : "#C7CFDB", backgroundColor: step === i ? mobile.teal : "white", justifyContent: "center", alignItems: "center" }}><Text style={{ color: step === i ? "white" : mobile.muted, fontSize: 12 }}>{i + 1}</Text></View><Text style={{ fontSize: 9, color: step === i ? mobile.teal : mobile.muted, textAlign: "center" }}>{label}</Text></Pressable>)}</View>}
    {(validation || p.error) && <Text accessibilityRole="alert" style={[ms.error, { paddingHorizontal: 16, paddingBottom: 8 }]}>{validation || p.error}</Text>}
    <ScrollView ref={scroll} onLayout={() => { if (keyboardOpen) requestAnimationFrame(scrollFocusedField); }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flex: 1 }} automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, padding: 13, paddingBottom: 0, maxWidth, width: "100%", alignSelf: "center" }}>
      <View ref={content} collapsable={false} style={{ flexGrow: 1 }}>
      {p.hasDraft && <MobileCard><Text style={ms.section}>Yarım kalan bir taslağın var</Text><View style={ms.row}><MobileButton onPress={p.onRestore} style={{ flex: 1 }}>Taslağa devam et</MobileButton><MobileButton secondary onPress={p.onClearDraft} style={{ flex: 1 }}>Vazgeç</MobileButton></View></MobileCard>}
        <View onLayout={(e) => { positions.current[0] = e.nativeEvent.layout.y; }}><MobileCard><View style={[ms.row, { justifyContent: "space-between", flexWrap: "wrap" }]}><SectionLabel icon="camera">1. Fotoğraf Ekle</SectionLabel><Text style={{ color: mobile.muted, fontSize: 9 }}>En fazla 5 fotoğraf ekleyebilirsin.</Text></View>
          <Text style={ms.muted}>{p.images.length}/5 fotoğraf · İlk fotoğraf ilanın kapağıdır.</Text>
          <HorizontalScroll  showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 5 }}>
            {p.images.length < 5 && <Pressable accessibilityRole="button" accessibilityLabel="Fotoğraf ekle" accessibilityState={{ disabled: !!p.picking }} disabled={p.picking} onPress={() => setPhotoOptions(v => !v)} style={{ width: 100, height: 112, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: mobile.teal, borderRadius: 10, gap: 8, opacity: p.picking ? 0.5 : 1 }}><Icon name="camera-plus" size={28} color={mobile.teal} /><Text style={{ color: mobile.teal, fontSize: 12 }}>{p.picking ? "Açılıyor…" : "Fotoğraf Ekle"}</Text></Pressable>}
            {p.images.map((uri, i) => <Pressable key={`${uri}-${i}`} accessibilityRole="button" accessibilityLabel={`Fotoğraf ${i + 1} büyüt`} onPress={() => setPhotoIndex(i)} style={{ width: tablet ? 140 : 112, height: 112, borderRadius: 10, overflow: "hidden" }}><SafeRemoteImage uri={uri} style={{ width: "100%", height: "100%" }} /><View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 6, backgroundColor: "#061629BB" }}><Text style={{ color: "white", fontSize: 11 }}>{i === 0 ? "Kapak fotoğrafı" : `${i + 1}. fotoğraf`}</Text></View></Pressable>)}
          </HorizontalScroll>
          <Text style={{ color: mobile.muted, fontSize: 11, lineHeight: 17 }}>Büyütmek, sıralamak, kapak yapmak veya kaldırmak için fotoğrafa dokun. İlk fotoğraf kapaktır.</Text>
          {removedPhoto && <View style={[ms.row, { flexWrap: "wrap" }]}><Text style={[ms.muted, { flex: 1 }]}>Fotoğraf kaldırıldı.</Text><MobileButton secondary disabled={p.picking || p.publishing || p.images.length >= 5 || p.images.includes(removedPhoto.uri)} onPress={() => { p.onImages(restorePhoto(p.images, removedPhoto)); setRemovedPhoto(null); }}>Geri al</MobileButton></View>}
          {photoOptions && <View style={ms.row}><MobileChip label="Galeriden seç" icon="image" onPress={() => { setPhotoOptions(false); p.onGallery(); }} /><MobileChip label="Fotoğraf çek" icon="camera" onPress={() => { setPhotoOptions(false); p.onCamera(); }} /></View>}
          <ListingVideoField key={p.videoFieldKey ?? 0} value={p.video} onChange={p.onVideo} userId={p.videoUserId} canUpload={p.canUploadVideo} disabled={p.publishing || !!p.picking} keepUrl={p.videoKeepUrl} onStatus={p.onVideoStatus} />
        </MobileCard></View>
        <View onLayout={e => { positions.current[5] = e.nativeEvent.layout.y; }}><MobileCard><View style={[ms.row, { justifyContent: "space-between" }]}><SectionLabel icon="folder">2. Kategori Seç</SectionLabel><Pressable accessibilityRole="button" onPress={() => setCategoryOpen(true)}><Text style={{ color: mobile.teal, fontSize: 12 }}>Değiştir ›</Text></Pressable></View><Pressable accessibilityRole="button" accessibilityLabel="İlan kategorisi seç" onPress={() => setCategoryOpen(true)} style={[ms.row, { flexWrap: "wrap" }]}>{p.path.length ? p.path.map((n, i) => <View key={n.key} style={[ms.row, { maxWidth: "100%" }]}><Text style={[ms.chip, { fontSize: 11, color: mobile.ink, paddingVertical: 9, flexShrink: 1 }]}>{n.label}</Text>{i < p.path.length - 1 && <Icon name="chevron-right" size={16} color={mobile.muted} />}</View>) : <Text style={ms.muted}>İlanına uygun kategoriyi seç ›</Text>}</Pressable></MobileCard></View>
        <View onLayout={(e) => { positions.current[1] = e.nativeEvent.layout.y; }}><MobileCard><SectionLabel icon="text-box">3. Ürün Bilgileri</SectionLabel><ListingTitleInput inputRef={titleRef} invalid={invalidField === "title"} value={String(p.values.title || "")} onChange={setValue("title")} /><MobileField label="Açıklama" required={p.schema?.fields.find((f) => f.key === "description")?.required} value={String(p.values.description || "")} onChange={setValue("description")} multiline maxLength={LIMITS.description.max} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{shownFields.filter((f) => f.type !== "bool" && f.type !== "multiselect").map((f) => <View key={f.key} style={{ width: f.type === "textarea" ? "100%" : tablet ? "31%" : "47%", flexGrow: 1 }}>{renderField(f)}</View>)}</View>
          {shownFields.filter((f) => f.type === "bool" || f.type === "multiselect").map((f) => <View key={f.key}>{renderField(f)}</View>)}
          {formFields.some((f) => !isPrimary(f)) && <MobileChip label={optionalOpen ? "Diğer özellikleri gizle" : "Diğer özellikleri ekle"} icon={optionalOpen ? "chevron-up" : "plus"} onPress={() => setOptionalOpen((v) => !v)} />}
        </MobileCard></View>
        <View onLayout={(e) => { positions.current[2] = e.nativeEvent.layout.y; }}><MobileCard><SectionLabel icon="account-group">4. Ortaklık Ayarları</SectionLabel><View style={[ms.row, { backgroundColor: "#EFF3FB", borderWidth: 1, borderColor: "#D1DBF1", borderRadius: 10, padding: 10 }]}><View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: mobile.teal, justifyContent: "center", alignItems: "center" }}><Icon name="handshake" size={27} color="white" /></View><View style={{ flex: 1 }}><Text style={{ fontSize: 12, fontWeight: "700", color: mobile.ink }}>İlanımı ortaklığa aç</Text><Text style={{ color: mobile.muted, fontSize: 10, lineHeight: 15 }}>Ürününü başkaları da satarak sana müşteri getirebilir. Satış gerçekleştiğinde belirlediğin komisyonu alırlar.</Text></View><Switch {...({ activeThumbColor: "#FFFFFF" } as object)} thumbColor="white" accessibilityLabel="İlanımı ortaklığa aç" value={partnerable} onValueChange={(v) => p.onPartnership(v ? "approval" : "none")} trackColor={{ true: mobile.teal }} /></View>
          {partnerable && <><View style={ms.wrap}><MobileChip label="₺  TL Tutarı ile Belirle" selected={p.commissionType === "fixed"} onPress={() => p.onCommissionType("fixed")} /><MobileChip label="%  Yüzde ile Belirle" selected={p.commissionType === "rate"} onPress={() => p.onCommissionType("rate")} /></View><MobileField label="Ortaklık Komisyonu" required value={p.commissionValue} onChange={p.onCommission} numeric /><Text style={{ fontSize: 10, color: mobile.muted }}>Satış gerçekleştiğinde anlaşma koşullarına göre ödenir.</Text><View style={ms.row}><MobileField label="Maksimum Ortak Sayısı" value={p.maxPartners} onChange={p.onMaxPartners} numeric placeholder="Sınırsız" /><MobileSelect label="Ortaklık Onayı" value={p.partnershipMode === "open" ? "Anında ortaklık" : p.partnershipMode === "invite" ? "Sadece davetle" : "Satıcı onaylı"} options={["Satıcı onaylı", "Anında ortaklık", "Sadece davetle"]} onChange={(v) => p.onPartnership(v === "Anında ortaklık" ? "open" : v === "Sadece davetle" ? "invite" : "approval")} /></View></>}
        </MobileCard></View>
        <View onLayout={e => { positions.current[4] = e.nativeEvent.layout.y; }}><MobileCard><SectionLabel icon="map-marker">5. İletişim ve Konum</SectionLabel><ListingLocationFields value={p.loc} onChange={p.onLocation} visibility={p.visibility as import("@/lib/locations").AddressVisibility} onVisibility={p.onVisibility} /><MobileSelect label="İletişim tercihi" value={p.contactMethod === "phone" ? "Telefon" : p.contactMethod === "whatsapp" ? "WhatsApp" : "Uygulama içi mesaj"} options={["Uygulama içi mesaj", "Telefon", "WhatsApp"]} onChange={(v) => p.onContact(v === "Telefon" ? "phone" : v === "WhatsApp" ? "whatsapp" : "message")} /></MobileCard></View>
        {(validation || p.error) && <Text accessibilityRole="alert" style={ms.error}>{validation || p.error}</Text>}
    <CompactFooter />
      </View>
    </ScrollView>
    <Modal visible={photoIndex !== null} animationType="fade" onRequestClose={() => setPhotoIndex(null)}>
      <View style={{ flex: 1, backgroundColor: "#0A1119", paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={[ms.row, { justifyContent: "space-between", paddingHorizontal: 12 }]}><Text style={{ color: "white", fontSize: 16 }}>Fotoğraf {(photoIndex ?? 0) + 1} / {p.images.length}</Text><IconButton name="close" label="Fotoğrafı kapat" color="white" onPress={() => setPhotoIndex(null)} /></View>
        <SafeRemoteImage full uri={photoIndex === null ? undefined : p.images[photoIndex]} contentFit="contain" style={{ flex: 1, backgroundColor: "#0A1119" }} />
        <View style={[ms.row, { justifyContent: "space-between", paddingHorizontal: 16 }]}><IconButton name="chevron-left" label="Önceki fotoğraf" color="white" onPress={() => setPhotoIndex(i => p.images.length ? ((i ?? 0) - 1 + p.images.length) % p.images.length : null)} /><Text style={{ color: "white" }}>{photoIndex === 0 ? "Kapak fotoğrafı" : ""}</Text><IconButton name="chevron-right" label="Sonraki fotoğraf" color="white" onPress={() => setPhotoIndex(i => p.images.length ? ((i ?? 0) + 1) % p.images.length : null)} /></View>
        <View style={{ padding: 16, gap: 12 }}><Text style={{ color: "#C9D7DF", textAlign: "center", fontSize: 12 }}>İlk fotoğraf ilanın kapağıdır. Sırayı değiştirebilirsin.</Text><View style={ms.row}><MobileButton secondary style={{ flex: 1 }} disabled={photoIndex === null || photoIndex === 0 || p.picking || p.publishing} onPress={() => moveSelectedPhoto(-1)} icon="chevron-left">Öne taşı</MobileButton><MobileButton secondary style={{ flex: 1 }} disabled={photoIndex === null || photoIndex >= p.images.length - 1 || p.picking || p.publishing} onPress={() => moveSelectedPhoto(1)} icon="chevron-right">Arkaya taşı</MobileButton></View><MobileButton disabled={photoIndex === 0 || p.picking || p.publishing} onPress={() => { if (photoIndex === null) return; const uri = p.images[photoIndex]; p.onImages([uri, ...p.images.filter((_, i) => i !== photoIndex)]); setPhotoIndex(0); }}>Kapak Yap</MobileButton><MobileButton secondary disabled={p.picking || p.publishing} onPress={() => { if (photoIndex === null) return; setRemovedPhoto({ uri: p.images[photoIndex], index: photoIndex }); p.onImages(p.images.filter((_, i) => i !== photoIndex)); setPhotoIndex(null); }}>Fotoğrafı Kaldır</MobileButton></View>
      </View>
    </Modal>
    <OptionSheet visible={draftOpen} title="İlan taslağın" options={["Bu ilanı taslak olarak kaydet", ...(p.hasDraft ? ["Kaydedilmiş taslağı aç", "Kaydedilmiş taslağı sil"] : [])]} onClose={() => setDraftOpen(false)} onSelect={choice => { setDraftOpen(false); if (choice === "Kaydedilmiş taslağı aç") { p.onRestore(); setPreview(false); setStep(0); setValidation(""); } else if (choice === "Kaydedilmiş taslağı sil") p.onClearDraft(); else p.onSaveDraft(); }} />
    <MobileCategorySelect key={categoryOpen ? "open" : "closed"} visible={categoryOpen} initial={p.path} leafOnly onClose={() => setCategoryOpen(false)} onSelect={p.onPath} />
  </MobileScreen>;
}

