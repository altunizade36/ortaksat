import { Image } from "expo-image";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, PanResponder, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { ProfileCoverImage } from "@/components/profile-cover-image";

/** Kapak oranı (genişlik / yükseklik). Bütün kapaklar bu oranda kaydedilir. */
export const COVER_RATIO = 3;
const COVER_WIDTH = 1500;

type Draft = { uri: string; width: number; height: number };

/**
 * Profil düzenleme ekranlarındaki "Kapak görseli" alanı (web + uygulama ortak).
 * value: kayıtlı kapak adresi, yeni seçilmiş yerel görsel ya da null (standart kapak).
 * Seçilen görsel kırpma penceresinden geçer; çıktı her zaman 1500×500'dür.
 */
export function CoverField({ value, onChange, disabled }: { value?: string | null; onChange: (next: string | null) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick() {
    if (busy || disabled) return;
    setError("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError("Kapak seçmek için galeri izni gerekli."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (result.canceled || !result.assets?.[0]) return;
      setBusy(true);
      const asset = result.assets[0];
      // Yönü düzelt ve çok büyük görseli küçült; kırpma hesabı bu görselin gerçek ölçüsüyle yapılır.
      const prep = await manipulateAsync(asset.uri, asset.width ? [{ resize: { width: Math.min(asset.width, 2400) } }] : [], { compress: 0.92, format: SaveFormat.JPEG });
      if (!prep.width || !prep.height) throw new Error("ölçü yok");
      setDraft({ uri: prep.uri, width: prep.width, height: prep.height });
    } catch {
      setError("Görsel açılamadı. Başka bir görsel dene.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <View testID="cover-preview" style={{ aspectRatio: COVER_RATIO, backgroundColor: colors.primaryDark, borderRadius: 12, overflow: "hidden", width: "100%" }}>
        <ProfileCoverImage uri={value} style={{ height: "100%", width: "100%" }} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18 }}>
        {value ? "Kendi kapağını kullanıyorsun." : "Standart OrtakSat kapağı kullanılıyor."} İstersen kendi görselini yükleyip konumunu ve ölçüsünü ayarlayabilirsin; kapak her ekranda aynı oranda görünür.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable testID="cover-pick" accessibilityRole="button" accessibilityLabel="Kapak görseli seç" disabled={busy || disabled} onPress={() => void pick()} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, minHeight: 42, opacity: busy || disabled ? 0.6 : pressed ? 0.85 : 1, paddingHorizontal: 14 })}>
          {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <MaterialCommunityIcons name="image-plus" size={18} color="#FFFFFF" />}
          <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "800" }}>{value ? "Kapağı Değiştir" : "Kapak Görseli Yükle"}</Text>
        </Pressable>
        {value ? (
          <Pressable testID="cover-reset" accessibilityRole="button" accessibilityLabel="Standart kapağa dön" disabled={busy || disabled} onPress={() => onChange(null)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 42, opacity: pressed ? 0.7 : 1, paddingHorizontal: 14 })}>
            <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "800" }}>Standart Kapağa Dön</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>{error}</Text> : null}
      {draft ? <CoverCropModal draft={draft} onCancel={() => setDraft(null)} onDone={(uri) => { setDraft(null); onChange(uri); }} /> : null}
    </View>
  );
}

function CoverCropModal({ draft, onCancel, onDone }: { draft: Draft; onCancel: () => void; onDone: (uri: string) => void }) {
  const { width: winW } = useWindowDimensions();
  const fw = Math.max(240, Math.min(winW - 48, 720));
  const fh = fw / COVER_RATIO;
  const base = Math.max(fw / draft.width, fh / draft.height); // çerçeveyi tam dolduran en küçük ölçek
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: (fw - draft.width * base) / 2, y: (fh - draft.height * base) / 2 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dw = draft.width * base * zoom;
  const dh = draft.height * base * zoom;
  const clamp = (p: { x: number; y: number }, w: number, h: number) => ({ x: Math.min(0, Math.max(fw - w, p.x)), y: Math.min(0, Math.max(fh - h, p.y)) });
  const shown = clamp(pos, dw, dh);
  const live = useRef({ shown, dw, dh, fw, fh });
  live.current = { shown, dw, dh, fw, fh };
  const start = useRef({ x: 0, y: 0 });
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { start.current = live.current.shown; },
    onPanResponderMove: (_event, g) => {
      const L = live.current;
      setPos({ x: Math.min(0, Math.max(L.fw - L.dw, start.current.x + g.dx)), y: Math.min(0, Math.max(L.fh - L.dh, start.current.y + g.dy)) });
    }
  }), []);

  function changeZoom(next: number) {
    const z = Math.min(3, Math.max(1, Math.round(next * 10) / 10));
    if (z === zoom) return;
    const nw = draft.width * base * z;
    const nh = draft.height * base * z;
    // Çerçevenin ortasındaki nokta yerinde kalsın.
    const cx = (fw / 2 - shown.x) / dw;
    const cy = (fh / 2 - shown.y) / dh;
    setZoom(z);
    setPos(clamp({ x: fw / 2 - cx * nw, y: fh / 2 - cy * nh }, nw, nh));
  }

  async function done() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const k = base * zoom;
      const originX = Math.max(0, Math.min(draft.width - 2, Math.round(-shown.x / k)));
      const originY = Math.max(0, Math.min(draft.height - 2, Math.round(-shown.y / k)));
      const width = Math.max(2, Math.min(draft.width - originX, Math.round(fw / k)));
      const height = Math.max(2, Math.min(draft.height - originY, Math.round(fh / k)));
      const out = await manipulateAsync(draft.uri, [{ crop: { originX, originY, width, height } }, { resize: { width: COVER_WIDTH, height: COVER_WIDTH / COVER_RATIO } }], { compress: 0.86, format: SaveFormat.JPEG });
      onDone(out.uri);
    } catch {
      setError("Görsel hazırlanamadı. Tekrar dene.");
      setSaving(false);
    }
  }

  const zoomButton = (label: string, icon: "minus" | "plus", next: number, off: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={off} onPress={() => changeZoom(next)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, height: 40, justifyContent: "center", opacity: off ? 0.4 : pressed ? 0.7 : 1, width: 44 })}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primaryDark} />
    </Pressable>
  );

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible>
      <View style={{ alignItems: "center", backgroundColor: "rgba(9,20,45,0.72)", flex: 1, justifyContent: "center", padding: 12 }}>
        <View testID="cover-crop" style={{ backgroundColor: "#FFFFFF", borderRadius: 16, gap: 12, maxWidth: 760, padding: 12, width: "100%" }}>
          <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Kapağı ayarla</Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18 }}>Görseli sürükleyerek konumlandır, düğmelerle yakınlaştır. Çerçevenin içinde kalan bölüm kapağın olur.</Text>
          <View
            {...responder.panHandlers}
            style={[{ alignSelf: "center", backgroundColor: "#0B1730", borderRadius: 10, height: fh, overflow: "hidden", width: fw }, Platform.OS === "web" ? ({ cursor: "grab", touchAction: "none", userSelect: "none" } as never) : null]}
          >
            <Image source={{ uri: draft.uri }} contentFit="fill" style={{ height: dh, left: shown.x, pointerEvents: "none", position: "absolute", top: shown.y, width: dw }} />
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center" }}>
            {zoomButton("Uzaklaştır", "minus", zoom - 0.2, zoom <= 1)}
            <Text testID="cover-zoom" style={{ color: colors.ink, fontSize: 13, fontWeight: "800", minWidth: 54, textAlign: "center" }}>%{Math.round(zoom * 100)}</Text>
            {zoomButton("Yakınlaştır", "plus", zoom + 0.2, zoom >= 3)}
          </View>
          {error ? <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>{error}</Text> : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Vazgeç" disabled={saving} onPress={onCancel} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 44, opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "800" }}>Vazgeç</Text>
            </Pressable>
            <Pressable testID="cover-crop-done" accessibilityRole="button" accessibilityLabel="Kapağı kullan" disabled={saving} onPress={() => void done()} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 44, opacity: saving ? 0.6 : pressed ? 0.85 : 1 })}>
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>Kapağı Kullan</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
