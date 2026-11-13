import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import type { CategoryNode } from "@/lib/category-tree";
import { translateCopy, useLanguage } from "@/lib/i18n";
import {
  DEFAULT_FEED_SETTINGS, FEED_INTERVALS, MAX_FEEDS, deleteFeed, describeFeedSummary, feedCategories, fetchFeedFromUrl, getMyFeeds,
  resolveCategoryText, saveFeed, suggestCategory, syncFeedNow, type CategoryTarget, type ListingFeed
} from "@/lib/listing-feeds";
import { districtsOfProvince, formatLocation, getProvince, resolveProvinceByName } from "@/lib/locations";
import type { PartnershipMode } from "@/lib/types";
import { parseListingRate } from "@/lib/listing-numbers";
import { parseXmlFeed } from "@/lib/xml-feed";

/**
 * XML BAĞLANTILARIM — satıcının kayıtlı ürün akışları ve her birinin otomatik eşitleme ayarları.
 * Eşitlemeyi sunucu yapar (feed-sync); bu ekran yalnız ayarları yazar, sonucu gösterir ve elle tetikler.
 * Kategori eşlemesi burada çözülüp ayarlara yazılır (ağaç istemcide; bkz. lib/listing-feeds.ts).
 */

type Draft = {
  id?: string; name: string; url: string; enabled: boolean; interval: number; pauseMissing: boolean;
  createNew: boolean; syncContent: boolean; shortenTitles: boolean; commission: string; mode: PartnershipMode;
  province: string; district: string; category: string;
  cats: Array<{ name: string; count: number }> | null; mapInputs: Record<string, string>; savedMap: Record<string, CategoryTarget>;
};
const MAX_MAP_ROWS = 80;
const MODES: Array<[PartnershipMode, string]> = [["approval", "Onayıma bağlı"], ["open", "Herkese açık"], ["none", "Ortaksız (normal ilan)"]];

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

function draftOf(feed?: ListingFeed): Draft {
  const s = feed?.settings ?? DEFAULT_FEED_SETTINGS;
  const province = s.provinceId ? getProvince(s.provinceId)?.name ?? "" : "";
  const district = s.provinceId && s.districtId ? districtsOfProvince(s.provinceId).find((d) => d.id === s.districtId)?.name ?? "" : "";
  return {
    id: feed?.id, name: feed?.name ?? "", url: feed?.url ?? "", enabled: feed?.enabled ?? true, interval: feed?.intervalHours ?? 6, pauseMissing: feed?.pauseMissing ?? false,
    createNew: s.createNew, syncContent: s.syncContent, shortenTitles: s.shortenTitles, commission: String(s.commission ?? 10).replace(".", ","), mode: s.partnershipMode,
    province, district, category: s.defaultCategory?.text ?? "", cats: null,
    mapInputs: Object.fromEntries(Object.entries(s.categoryMap).map(([k, v]) => [k, v.text])), savedMap: s.categoryMap
  };
}

export function FeedManager({ ownerId, categoryTree, onChanged }: { ownerId: string; categoryTree: CategoryNode[]; onChanged?: () => void }) {
  const { language } = useLanguage();
  const tr = (text: string) => translateCopy(text, language);
  const [feeds, setFeeds] = useState<ListingFeed[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // "save" | "cats" | bağlantı kimliği
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const reload = useCallback(async () => {
    const list = await getMyFeeds(ownerId);
    if (alive.current) setFeeds(list);
  }, [ownerId]);
  useEffect(() => { void reload(); }, [reload]);

  const patch = (fields: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...fields } : d));
  const provinceHit = draft?.province.trim() ? resolveProvinceByName(draft.province) : undefined;
  const districtHit = provinceHit && draft?.district.trim() ? districtsOfProvince(provinceHit.id).find((d) => d.name.toLocaleLowerCase("tr-TR").trim() === draft.district.toLocaleLowerCase("tr-TR").trim()) : undefined;
  const categoryHit = draft?.category.trim() ? resolveCategoryText(categoryTree, draft.category) : null;

  async function loadCategories() {
    if (!draft || busy) return;
    setBusy("cats");
    setNotice(null);
    try {
      const result = await fetchFeedFromUrl(draft.url);
      if (!alive.current) return;
      if (!result.ok) { setNotice({ text: tr(result.error), error: true }); return; }
      let cats: Draft["cats"];
      try { cats = feedCategories(parseXmlFeed(result.text)); } catch (e) { setNotice({ text: tr(e instanceof Error ? e.message : "XML dosyası ayrıştırılamadı."), error: true }); return; }
      // Önceden kaydedilmiş eşleme korunur; yeni görülen kategoriye öneri yazılır (satıcı düzeltebilir).
      const inputs = { ...draft.mapInputs };
      for (const cat of cats.slice(0, MAX_MAP_ROWS)) if (inputs[cat.name] === undefined) inputs[cat.name] = suggestCategory(categoryTree, cat.name)?.text ?? "";
      patch({ cats, mapInputs: inputs });
      if (!cats.length) setNotice({ text: tr("Akışta kategori bilgisi yok; tüm ürünler varsayılan kategoriye gider.") });
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  async function save() {
    if (!draft || busy) return;
    const commissionRaw = draft.commission.trim().replace(/^%\s*|\s*%$/g, "");
    const commission = commissionRaw ? parseListingRate(commissionRaw) : 10;
    if (draft.createNew) {
      if (!provinceHit) { setNotice({ text: tr("Yeni ürünlerin ilan olarak açılabilmesi için varsayılan ili yaz."), error: true }); return; }
      if (!categoryHit) { setNotice({ text: tr("Yeni ürünlerin ilan olarak açılabilmesi için varsayılan kategoriyi yaz."), error: true }); return; }
      if (draft.mode !== "none" && !(commission > 0 && commission <= 90)) { setNotice({ text: tr("Komisyon 1 ile 90 arasında bir sayı olmalı (örn. 15 ya da 12,5)."), error: true }); return; }
    }
    // Eşleme: ekranda görünen satırlar yazılana göre, görünmeyenler önceki kayıttan.
    const categoryMap: Record<string, CategoryTarget> = { ...draft.savedMap };
    for (const [name, text] of Object.entries(draft.mapInputs)) {
      const target = text.trim() ? resolveCategoryText(categoryTree, text) : null;
      if (target) categoryMap[name] = target; else delete categoryMap[name];
    }
    setBusy("save");
    setNotice(null);
    try {
      const result = await saveFeed(ownerId, {
        id: draft.id, name: draft.name, url: draft.url, enabled: draft.enabled, intervalHours: draft.interval, pauseMissing: draft.pauseMissing,
        settings: {
          createNew: draft.createNew, syncContent: draft.syncContent, shortenTitles: draft.shortenTitles,
          commission: commission > 0 && commission <= 90 ? commission : 10, partnershipMode: draft.mode,
          provinceId: provinceHit?.id ?? null, districtId: districtHit?.id ?? null,
          location: provinceHit ? formatLocation({ provinceId: provinceHit.id, districtId: districtHit?.id }, "neighborhood") || provinceHit.name : "",
          defaultCategory: categoryHit, categoryMap
        }
      });
      if (!alive.current) return;
      if (!result.ok) { setNotice({ text: tr(result.error), error: true }); return; }
      setDraft(null);
      setNotice({ text: tr("Bağlantı kaydedildi. İlk eşitleme yarım saat içinde yapılır; beklemek istemezsen 'Şimdi eşitle'ye bas.") });
      await reload();
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  async function syncNow(feed: ListingFeed) {
    if (busy) return;
    setBusy(feed.id);
    setNotice(null);
    try {
      const result = await syncFeedNow(feed.id);
      if (!alive.current) return;
      setNotice(result.ok ? { text: `${tr("Eşitlendi")}: ${tr(describeFeedSummary(result.summary))}` } : { text: tr(result.error), error: true });
      await reload();
      if (result.ok) onChanged?.();
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  async function toggle(feed: ListingFeed) {
    if (busy) return;
    setBusy(feed.id);
    try {
      const result = await saveFeed(ownerId, { id: feed.id, name: feed.name, url: feed.url, enabled: !feed.enabled, intervalHours: feed.intervalHours, pauseMissing: feed.pauseMissing, settings: feed.settings });
      if (alive.current && !result.ok) setNotice({ text: tr(result.error), error: true });
      await reload();
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  async function remove(feed: ListingFeed) {
    if (busy) return;
    setBusy(feed.id);
    try {
      const ok = await deleteFeed(ownerId, feed.id);
      if (!alive.current) return;
      setNotice(ok ? { text: tr("Bağlantı kaldırıldı. Bu bağlantıdan açılan ilanların olduğu gibi kalır; artık kendiliğinden güncellenmez.") } : { text: tr("Kaldırılamadı. Tekrar dene."), error: true });
      await reload();
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  const input = { backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13.5, minHeight: 44, paddingHorizontal: 12 } as const;
  const label = { color: colors.muted, fontSize: 12, fontWeight: "800" } as const;
  const hint = (ok: boolean) => ({ color: ok ? colors.primaryDark : colors.accent, fontSize: 11.5, fontWeight: "700" } as const);
  const check = (value: boolean, onPress: () => void, title: string, detail?: string) => (
    <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={tr(title)} style={{ alignItems: "flex-start", flexDirection: "row", gap: 9 }}>
      <MaterialCommunityIcons name={value ? "checkbox-marked" : "checkbox-blank-outline"} size={20} color={value ? colors.primaryDark : colors.muted} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800", lineHeight: 18 }}>{tr(title)}</Text>
        {detail ? <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{tr(detail)}</Text> : null}
      </View>
    </Pressable>
  );
  const chip = (selected: boolean, text: string, onPress: () => void, a11y: string) => (
    <Pressable key={a11y} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={a11y} style={{ backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 34, paddingHorizontal: 12 }}>
      <Text style={{ color: selected ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{text}</Text>
    </Pressable>
  );

  return (
    <View testID="feed-manager" style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 12, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <MaterialCommunityIcons name="sync" size={18} color={colors.primaryDark} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900", minWidth: 180 }}>{tr("XML bağlantılarım — otomatik eşitleme")}</Text>
        {!draft && feeds.length < MAX_FEEDS ? (
          <Pressable onPress={() => { setNotice(null); setDraft(draftOf()); }} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 9, flexDirection: "row", gap: 6, minHeight: 40, paddingHorizontal: 14 }}>
            <MaterialCommunityIcons name="plus" size={15} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{tr("Bağlantı ekle")}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{tr("E-ticaret sitenin ürün XML adresini kaydet; fiyat ve stoklar seçtiğin aralıkla kendiliğinden güncellensin. İstersen yeni ürünler ilan olarak açılır, başlık, açıklama ve görseller de akıştakiyle eşitlenir. En çok 5 bağlantı kaydedebilirsin; her birinin ayarı ayrıdır.")}</Text>

      {notice ? (
        <View testID="feed-notice" style={{ alignItems: "flex-start", backgroundColor: notice.error ? colors.accentSoft : colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 8, padding: 11 }}>
          <MaterialCommunityIcons name={notice.error ? "alert-circle-outline" : "information-outline"} size={16} color={notice.error ? colors.accent : colors.primaryDark} style={{ marginTop: 1 }} />
          <Text accessibilityRole={notice.error ? "alert" : undefined} style={{ color: notice.error ? colors.ink : colors.primaryDark, flex: 1, fontSize: 12.5, fontWeight: "700", lineHeight: 18 }}>{notice.text}</Text>
        </View>
      ) : null}

      {feeds.map((feed) => (
        <View key={feed.id} testID="feed-row" style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 7, padding: 13 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{feed.name}</Text>
            <Text style={{ color: feed.enabled ? colors.primaryDark : colors.muted, fontSize: 11.5, fontWeight: "800" }}>{tr(feed.enabled ? "Açık" : "Kapalı")} · {feed.intervalHours} {tr("saatte bir")}</Text>
          </View>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{feed.url}</Text>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700", lineHeight: 16 }}>
            {[feed.settings.createNew ? tr("yeni ürünler ilan olarak açılır") : tr("yeni ürün açılmaz"), feed.settings.syncContent ? tr("içerik eşitlenir") : tr("yalnız fiyat ve stok"), feed.pauseMissing ? tr("akıştan çıkanlar pasife alınır") : ""].filter(Boolean).join(" · ")}
          </Text>
          <Text testID="feed-status" style={{ color: feed.lastStatus === "error" ? colors.accent : colors.ink, fontSize: 11.5, fontWeight: "700", lineHeight: 16 }}>
            {feed.lastRunAt
              ? `${tr("Son eşitleme")}: ${shortDate(feed.lastRunAt)} — ${feed.lastStatus === "error" ? tr(feed.lastError ?? "Eşitleme tamamlanamadı.") : tr(describeFeedSummary(feed.lastSummary))}`
              : tr("Henüz eşitlenmedi.")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable disabled={!!busy} onPress={() => void syncNow(feed)} accessibilityRole="button" accessibilityLabel={`${tr("Şimdi eşitle")}: ${feed.name}`} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 9, flexDirection: "row", gap: 6, minHeight: 38, opacity: busy ? 0.6 : 1, paddingHorizontal: 12 }}>
              <MaterialCommunityIcons name={busy === feed.id ? "loading" : "refresh"} size={14} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900" }}>{tr("Şimdi eşitle")}</Text>
            </Pressable>
            <Pressable disabled={!!busy} onPress={() => { setNotice(null); setDraft(draftOf(feed)); }} accessibilityRole="button" accessibilityLabel={`${tr("Düzenle")}: ${feed.name}`} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 9, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: 12 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{tr("Düzenle")}</Text>
            </Pressable>
            <Pressable disabled={!!busy} onPress={() => void toggle(feed)} accessibilityRole="button" style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 9, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: 12 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{tr(feed.enabled ? "Duraklat" : "Yeniden başlat")}</Text>
            </Pressable>
            <Pressable disabled={!!busy} onPress={() => void remove(feed)} accessibilityRole="button" accessibilityLabel={`${tr("Kaldır")}: ${feed.name}`} style={{ justifyContent: "center", minHeight: 38, paddingHorizontal: 8 }}>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "800" }}>{tr("Kaldır")}</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {draft ? (
        <View testID="feed-editor" style={{ borderColor: colors.primary, borderRadius: 12, borderWidth: 1.5, gap: 11, padding: 14 }}>
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{tr(draft.id ? "Bağlantıyı düzenle" : "Yeni XML bağlantısı")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={{ gap: 4, minWidth: 200 }}>
              <Text style={label}>{tr("Ad")}</Text>
              <TextInput value={draft.name} onChangeText={(v) => patch({ name: v })} accessibilityLabel={tr("Bağlantı adı")} maxLength={60} placeholder={tr("örn. Ana mağaza")} placeholderTextColor={colors.subtle} style={[input, { width: 220 }]} />
            </View>
            <View style={{ flexGrow: 1, gap: 4, minWidth: 240 }}>
              <Text style={label}>{tr("XML adresi")}</Text>
              <TextInput value={draft.url} onChangeText={(v) => patch({ url: v })} accessibilityLabel={tr("XML adresi")} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://siten.com/urunler.xml" placeholderTextColor={colors.subtle} style={input} />
            </View>
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Text style={label}>{tr("Eşitleme aralığı:")}</Text>
            {FEED_INTERVALS.map((h) => chip(draft.interval === h, `${h} ${tr("saat")}`, () => patch({ interval: h }), `${h} ${tr("saatte bir")}`))}
          </View>
          {check(draft.createNew, () => patch({ createNew: !draft.createNew }), "Yeni ürünleri ilan olarak aç", "Akışa eklenen her yeni ürün için ilan açılır ve yayına girmeden önce incelemeye düşer.")}
          {check(draft.syncContent, () => patch({ syncContent: !draft.syncContent }), "Başlık, açıklama ve görselleri de eşitle", "Açıkken ilanlarındaki elle yaptığın başlık/açıklama/görsel değişiklikleri akıştakiyle değiştirilir.")}
          {check(draft.shortenTitles, () => patch({ shortenTitles: !draft.shortenTitles }), "70 karakterden uzun başlıkları kelime sınırında kısalt", "Kapalıyken uzun başlıklı yeni ürünler açılmaz.")}
          {check(draft.pauseMissing, () => patch({ pauseMissing: !draft.pauseMissing }), "Akıştan tamamen çıkarılan ürünlerin ilanlarını pasife al", "Stokta kalmayan ürünün ilanı bu seçenekten bağımsız olarak pasife alınır.")}

          <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "900" }}>{tr("Yeni açılacak ilanlar için")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={{ gap: 4 }}>
              <TextInput value={draft.province} onChangeText={(v) => patch({ province: v })} accessibilityLabel={tr("Bağlantı ili")} placeholder={tr("İl, örn. İstanbul")} placeholderTextColor={colors.subtle} style={[input, { width: 200 }]} />
              {draft.province.trim() ? <Text style={hint(!!provinceHit)}>{provinceHit ? provinceHit.name : tr("İl bulunamadı")}</Text> : null}
            </View>
            <View style={{ gap: 4 }}>
              <TextInput value={draft.district} onChangeText={(v) => patch({ district: v })} accessibilityLabel={tr("Bağlantı ilçesi")} placeholder={tr("İlçe (opsiyonel)")} placeholderTextColor={colors.subtle} style={[input, { width: 200 }]} />
              {draft.district.trim() ? <Text style={hint(!!districtHit)}>{districtHit ? districtHit.name : tr(provinceHit ? "Bu ilde böyle bir ilçe yok" : "Önce ili yaz")}</Text> : null}
            </View>
            <View style={{ gap: 4 }}>
              <TextInput value={draft.commission} onChangeText={(v) => patch({ commission: v })} accessibilityLabel={tr("Bağlantı komisyonu")} keyboardType="numeric" placeholder={tr("Komisyon %, örn. 15")} placeholderTextColor={colors.subtle} style={[input, { width: 170 }]} />
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <TextInput value={draft.category} onChangeText={(v) => patch({ category: v })} accessibilityLabel={tr("Bağlantı varsayılan kategorisi")} placeholder={tr("Varsayılan kategori, örn. Elektronik ya da Üst > Alt")} placeholderTextColor={colors.subtle} style={input} />
            {draft.category.trim() ? <Text style={hint(!!categoryHit)}>{categoryHit ? categoryHit.text.split(" > ").map((p) => tr(p)).join(" › ") : tr("Kategori bulunamadı — adı ya da yolu (Üst > Alt) yaz")}</Text> : null}
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Text style={label}>{tr("Ortaklık türü:")}</Text>
            {MODES.map(([mode, text]) => chip(draft.mode === mode, tr(text), () => patch({ mode }), `${tr("Bağlantı ortaklık türü")}: ${tr(text)}`))}
          </View>

          <View style={{ gap: 7 }}>
            <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "900", minWidth: 160 }}>{tr("Kategori eşleme")}</Text>
              <Pressable disabled={!!busy || !draft.url.trim()} onPress={() => void loadCategories()} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 9, flexDirection: "row", gap: 6, minHeight: 38, opacity: busy || !draft.url.trim() ? 0.6 : 1, paddingHorizontal: 12 }}>
                <MaterialCommunityIcons name={busy === "cats" ? "loading" : "shape-outline"} size={14} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{tr(busy === "cats" ? "Getiriliyor…" : "Akıştaki kategorileri getir")}</Text>
              </Pressable>
            </View>
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{tr("Mağazandaki her kategorinin OrtakSat'ta hangi kategoriye gideceğini bir kez belirle; eşitleme hep bu tabloyu kullanır. Önerileri kontrol et, yanlış olanı düzelt. Boş bıraktığın ya da sonradan eklenen kategoriler varsayılan kategoriye gider.")}</Text>
            {draft.cats ? draft.cats.slice(0, MAX_MAP_ROWS).map((cat) => {
              const text = draft.mapInputs[cat.name] ?? "";
              const hit = text.trim() ? resolveCategoryText(categoryTree, text) : null;
              return (
                <View key={cat.name} testID="feed-map-row" style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 4, paddingTop: 7 }}>
                  <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{cat.name} <Text style={{ color: colors.muted, fontWeight: "600" }}>· {cat.count} {tr("ürün")}</Text></Text>
                  <TextInput value={text} onChangeText={(v) => patch({ mapInputs: { ...draft.mapInputs, [cat.name]: v } })} accessibilityLabel={`${tr("Eşleme")}: ${cat.name}`} placeholder={tr("OrtakSat kategorisi (boşsa varsayılan)")} placeholderTextColor={colors.subtle} style={input} />
                  <Text style={hint(!text.trim() || !!hit)}>{!text.trim() ? tr("Varsayılan kategoriye gider") : hit ? hit.text.split(" > ").map((p) => tr(p)).join(" › ") : tr("Kategori bulunamadı — varsayılana gider")}</Text>
                </View>
              );
            }) : Object.keys(draft.savedMap).length ? <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{Object.keys(draft.savedMap).length} {tr("kategori eşlemesi kayıtlı. Görmek ve düzenlemek için kategorileri getir.")}</Text> : null}
            {draft.cats && draft.cats.length > MAX_MAP_ROWS ? <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{draft.cats.length - MAX_MAP_ROWS} {tr("kategori daha var; en çok ürünü olan ilk 80 gösteriliyor, kalanı varsayılan kategoriye gider.")}</Text> : null}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable disabled={!!busy || !draft.url.trim()} onPress={() => void save()} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, justifyContent: "center", minHeight: 44, opacity: busy || !draft.url.trim() ? 0.6 : 1, paddingHorizontal: 18 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{tr(busy === "save" ? "Kaydediliyor…" : "Bağlantıyı kaydet")}</Text>
            </Pressable>
            <Pressable disabled={!!busy} onPress={() => { setDraft(null); setNotice(null); }} accessibilityRole="button" style={{ alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: 14 }}>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{tr("Vazgeç")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
