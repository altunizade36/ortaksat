import { MaterialCommunityIcons } from "@/components/icons";
import { Link, router, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { Seo } from "@/components/seo";
import { EmptyState, PrimaryButton } from "@/components/ui";
import { PAGE_MAX_WIDTH } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { categoryTree } from "@/lib/category-tree";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb, useMounted } from "@/lib/layout";
import {
  applyToPartnerRequest, createPartnerRequest, loadMyPartnerRequests, loadPartnerRequestApplicants, loadPartnerRequestFeed,
  respondToPartnerApplication, updatePartnerRequestStatus,
  type MyPartnerRequest, type PartnerRequestApplicant, type PartnerRequestFeedItem
} from "@/lib/supabase-data";
import { useStore } from "@/lib/use-store";

const TOP_CATEGORIES: string[] = categoryTree.map((n) => n.label).filter((l) => l && l !== "Diğer");

export default function PartnerRequestsScreen() {
  return useMounted() ? <Inner /> : <ScreenSkeleton />;
}

function Inner() {
  const { language } = useLanguage();
  const t = (s: string) => translateCopy(s, language);
  const { width } = useWindowDimensions();
  const isWideWeb = useIsWideWeb();
  const { isAuthenticated } = useStore();

  const [mode, setMode] = useState<"feed" | "mine">("feed");
  const [feed, setFeed] = useState<PartnerRequestFeedItem[]>([]);
  const [mine, setMine] = useState<MyPartnerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const p = mode === "mine" ? loadMyPartnerRequests() : loadPartnerRequestFeed({ category });
    p.then((rows) => { if (mode === "mine") setMine(rows as MyPartnerRequest[]); else setFeed(rows as PartnerRequestFeedItem[]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mode, category]);
  useEffect(() => { load(); }, [load]);

  const pad = 12;
  const maxW = Math.min(width, PAGE_MAX_WIDTH);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
      <Seo
        title={t("Ortak Aranıyor — ilan olmadan ortak çağrısı | OrtakSat")}
        description={t("Ürününü satacak ortak mı arıyorsun? İlan olmadan ortak talebi oluştur; deneyimli ortaklar başvursun. Ortaksan açık talepleri gör, başvur.")}
        path="/ortak-araniyor"
      />
      <View style={{ alignSelf: "center", maxWidth: PAGE_MAX_WIDTH, paddingHorizontal: pad, paddingTop: 14, width: "100%" }}>
        {/* Başlık */}
        <View style={{ gap: 6, marginBottom: 12 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name="bullhorn-variant" size={22} color={colors.primary} />
            <Text style={{ color: colors.ink, fontSize: isWideWeb ? 24 : 20, fontWeight: "900" }}>{t("Ortak Aranıyor")}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>
            {t("İlan oluşturmadan ortak çağrısı aç: hangi işe, hangi kategoride ortak arıyorsun yaz — deneyimli ortaklar başvursun. Ortaksan açık talepleri gör ve başvur.")}
          </Text>
        </View>

        {/* Çapraz link: uzman ortak dizinine */}
        <Link href={"/ortaklar" as Href} asChild>
          <Pressable style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, flexDirection: "row", gap: 8, marginBottom: 12, padding: 11 }}>
            <MaterialCommunityIcons name="account-star" size={16} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{t("Hazır uzman ortakları dizinde de arayabilirsin →")}</Text>
          </Pressable>
        </Link>

        {/* Mod + oluştur */}
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <Seg active={mode === "feed"} icon="bullhorn-variant-outline" label={t("Açık talepler")} onPress={() => setMode("feed")} />
          {isAuthenticated ? <Seg active={mode === "mine"} icon="clipboard-list-outline" label={t("Taleplerim")} onPress={() => setMode("mine")} /> : null}
          <View style={{ marginLeft: "auto" }}>
            <PrimaryButton icon="plus" onPress={() => { if (!isAuthenticated) { void router.push("/auth"); return; } setShowCreate((s) => !s); }}>{t("Talep Oluştur")}</PrimaryButton>
          </View>
        </View>

        {/* Oluşturma formu (satır-içi → modal klavye tuzağı yok) */}
        {showCreate ? <CreateForm onDone={() => { setShowCreate(false); setMode("mine"); load(); }} onCancel={() => setShowCreate(false)} /> : null}

        {/* Kategori filtresi (yalnız feed) */}
        {mode === "feed" ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 2 }} style={{ marginBottom: 12 }}>
            <Chip active={category === null} label={t("Tümü")} onPress={() => setCategory(null)} />
            {TOP_CATEGORIES.map((c) => <Chip key={c} active={category === c} label={t(c)} onPress={() => setCategory(category === c ? null : c)} />)}
          </ScrollView>
        ) : null}

        {/* İçerik */}
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 44 }}>
            <MaterialCommunityIcons name="loading" size={28} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 8 }}>{t("Yükleniyor…")}</Text>
          </View>
        ) : mode === "feed" ? (
          feed.length === 0 ? (
            <EmptyState
              title={category ? `${t(category)} ${t("için açık talep yok")}` : t("Şu an açık ortak talebi yok")}
              body={t("İlk talebi sen oluştur: ürününü satacak bir ortak ara. Ya da uzman ortak dizininden doğrudan ortak seç.")}
              action={{ label: t("Talep Oluştur"), onPress: () => { if (!isAuthenticated) { void router.push("/auth"); return; } setShowCreate(true); }, icon: "plus" }}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {feed.map((r) => <FeedCard key={r.id} req={r} wide={isWideWeb} onChanged={load} />)}
            </View>
          )
        ) : (
          mine.length === 0 ? (
            <EmptyState
              title={t("Henüz talep oluşturmadın")}
              body={t("Ürününü satacak ortak arıyorsan bir talep oluştur; deneyimli ortaklar sana başvursun.")}
              action={{ label: t("Talep Oluştur"), onPress: () => setShowCreate(true), icon: "plus" }}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {mine.map((r) => <MineCard key={r.id} req={r} onChanged={load} />)}
            </View>
          )
        )}
      </View>
      <WebFooter />
    </ScrollView>
  );
}

function CreateForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { language } = useLanguage();
  const t = (s: string) => translateCopy(s, language);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [commission, setCommission] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (title.trim().length < 3) { setErr(t("Başlık en az 3 karakter olmalı.")); return; }
    setSaving(true); setErr("");
    const id = await createPartnerRequest({ title, description: desc, category: cat, commissionHint: commission, location });
    setSaving(false);
    if (id) onDone(); else setErr(t("Talep oluşturulamadı. Giriş yaptığından emin ol ve tekrar dene."));
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, marginBottom: 14, padding: 16 }}>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{t("Yeni ortak talebi")}</Text>
      <Field label={t("Başlık")} value={title} onChangeText={setTitle} placeholder={t("Örn: Instagram'da ayakkabı satacak ortak arıyorum")} />
      <Field label={t("Açıklama")} value={desc} onChangeText={setDesc} placeholder={t("Ne satılacak, ortaktan beklentin ne? (opsiyonel)")} multiline />
      <View>
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800", marginBottom: 6 }}>{t("Kategori")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {TOP_CATEGORIES.map((c) => <Chip key={c} active={cat === c} label={t(c)} onPress={() => setCat(cat === c ? null : c)} />)}
        </ScrollView>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Field label={t("Komisyon (opsiyonel)")} value={commission} onChangeText={setCommission} placeholder={t("Örn: %15 veya 500 TL")} /></View>
        <View style={{ flex: 1 }}><Field label={t("Konum (opsiyonel)")} value={location} onChangeText={setLocation} placeholder={t("İl / ilçe")} /></View>
      </View>
      {err ? <Text style={{ color: colors.warning, fontSize: 12, fontWeight: "700" }}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><PrimaryButton tone="secondary" icon="close" onPress={onCancel}>{t("Vazgeç")}</PrimaryButton></View>
        <View style={{ flex: 2 }}><PrimaryButton icon={saving ? "loading" : "check"} onPress={() => void submit()}>{saving ? t("Kaydediliyor…") : t("Talebi yayınla")}</PrimaryButton></View>
      </View>
    </View>
  );
}

function FeedCard({ req, wide, onChanged }: { req: PartnerRequestFeedItem; wide: boolean; onChanged: () => void }) {
  const { language } = useLanguage();
  const t = (s: string) => translateCopy(s, language);
  const { isAuthenticated } = useStore();
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState("");
  const [applied, setApplied] = useState(req.mineApplied);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const doApply = async () => {
    if (!isAuthenticated) { void router.push("/auth"); return; }
    setBusy(true);
    const res = await applyToPartnerRequest(req.id, msg);
    setBusy(false);
    if (res === "applied" || res === "already") { setApplied(true); setApplying(false); setNote(t("Başvurun iletildi. Satıcı kabul ederse mesajlaşabilirsin.")); onChanged(); }
    else if (res === "own_request") setNote(t("Kendi talebine başvuramazsın."));
    else if (res === "closed") setNote(t("Bu talep kapanmış."));
    else setNote(t("Başvuru gönderilemedi, tekrar dene."));
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 10, padding: 14 }}>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 10 }}>
        <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
          <Text style={{ color: colors.ink, fontSize: 15.5, fontWeight: "900" }}>{req.title}</Text>
          {req.description ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }} numberOfLines={3}>{req.description}</Text> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {req.category ? <Badge icon="shape-outline" label={t(req.category)} /> : null}
            {req.commissionHint ? <Badge icon="cash" label={req.commissionHint} tone="success" /> : null}
            {req.location ? <Badge icon="map-marker-outline" label={req.location} /> : null}
            <Badge icon="account-multiple" label={`${req.applicationCount} ${t("başvuru")}`} />
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
            <MaterialCommunityIcons name="store-outline" size={13} color={colors.subtle} />
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{req.sellerName || t("Satıcı")}</Text>
            {req.sellerVerified ? <MaterialCommunityIcons name="check-decagram" size={12} color={colors.primary} /> : null}
          </View>
        </View>
        <View style={{ justifyContent: "center", minWidth: wide ? 150 : undefined }}>
          {req.isOwner ? (
            <Badge icon="account-check" label={t("Bu talep senin")} />
          ) : applied ? (
            <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 999, flexDirection: "row", gap: 5, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 8 }}>
              <MaterialCommunityIcons name="check" size={15} color={colors.success} />
              <Text style={{ color: colors.success, fontSize: 12.5, fontWeight: "900" }}>{t("Başvurdun")}</Text>
            </View>
          ) : (
            <PrimaryButton icon="hand-wave" onPress={() => setApplying((s) => !s)}>{t("Başvur")}</PrimaryButton>
          )}
        </View>
      </View>

      {/* Başvuru mesajı (satır-içi) */}
      {applying && !applied && !req.isOwner ? (
        <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 8, paddingTop: 10 }}>
          <Field label={t("Mesajın (opsiyonel)")} value={msg} onChangeText={setMsg} placeholder={t("Neden uygun ortağım? Kitlen/deneyimin…")} multiline />
          <PrimaryButton icon={busy ? "loading" : "send"} onPress={() => void doApply()}>{busy ? t("Gönderiliyor…") : t("Başvuruyu gönder")}</PrimaryButton>
        </View>
      ) : null}
      {note ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{note}</Text> : null}
    </View>
  );
}

function MineCard({ req, onChanged }: { req: MyPartnerRequest; onChanged: () => void }) {
  const { language } = useLanguage();
  const t = (s: string) => translateCopy(s, language);
  const [open, setOpen] = useState(false);
  const [applicants, setApplicants] = useState<PartnerRequestApplicant[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && applicants.length === 0) {
      setLoadingApps(true);
      setApplicants(await loadPartnerRequestApplicants(req.id));
      setLoadingApps(false);
    }
  };
  const respond = async (applicationId: string, action: "accept" | "decline") => {
    const res = await respondToPartnerApplication(applicationId, action);
    if (res === "accepted" || res === "declined") setApplicants((prev) => prev.map((a) => a.applicationId === applicationId ? { ...a, status: res } : a));
  };
  const close = async () => { if (await updatePartnerRequestStatus(req.id, "fulfilled")) onChanged(); };

  const statusLabel = req.status === "open" ? t("Açık") : req.status === "fulfilled" ? t("Tamamlandı") : t("Kapalı");
  const statusTone = req.status === "open" ? colors.success : colors.muted;

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 8, padding: 14 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" }}>{req.title}</Text>
        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ color: statusTone, fontSize: 11, fontWeight: "900" }}>{statusLabel}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {req.category ? <Badge icon="shape-outline" label={t(req.category)} /> : null}
        {req.commissionHint ? <Badge icon="cash" label={req.commissionHint} tone="success" /> : null}
        {req.location ? <Badge icon="map-marker-outline" label={req.location} /> : null}
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Pressable onPress={() => void toggle()} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 7 }}>
          <MaterialCommunityIcons name="account-multiple" size={14} color={colors.primaryDark} />
          <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{req.applicationCount} {t("başvuru")}{req.pendingCount > 0 ? ` · ${req.pendingCount} ${t("yeni")}` : ""}</Text>
          <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.primaryDark} />
        </Pressable>
        {req.status === "open" ? (
          <Pressable onPress={() => void close()} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 4, paddingHorizontal: 11, paddingVertical: 7 }}>
            <MaterialCommunityIcons name="check-circle-outline" size={14} color={colors.muted} />
            <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{t("Talebi kapat")}</Text>
          </Pressable>
        ) : null}
      </View>

      {open ? (
        loadingApps ? (
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", paddingVertical: 8 }}>{t("Başvuranlar yükleniyor…")}</Text>
        ) : applicants.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", paddingVertical: 8 }}>{t("Henüz başvuru yok. Talebini paylaşarak daha çok ortağa ulaşabilirsin.")}</Text>
        ) : (
          <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 8, paddingTop: 10 }}>
            {applicants.map((a) => (
              <View key={a.applicationId} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, gap: 6, padding: 11 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                  <Link href={{ pathname: "/ortak/[id]", params: { id: a.partnerId } }} asChild>
                    <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
                      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{a.partnerName || t("Ortak")}</Text>
                      {a.partnerVerified ? <MaterialCommunityIcons name="check-decagram" size={13} color={colors.primary} /> : null}
                    </Pressable>
                  </Link>
                  <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>· {a.confirmedSales} {t("satış")}</Text>
                  {a.status !== "pending" ? (
                    <View style={{ backgroundColor: a.status === "accepted" ? colors.successSoft : colors.surface, borderRadius: 999, marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: a.status === "accepted" ? colors.success : colors.muted, fontSize: 10.5, fontWeight: "900" }}>{a.status === "accepted" ? t("Kabul edildi") : t("Reddedildi")}</Text>
                    </View>
                  ) : null}
                </View>
                {a.expertiseCategories.length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                    {a.expertiseCategories.slice(0, 4).map((c) => (
                      <View key={c} style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ color: colors.primaryDark, fontSize: 10, fontWeight: "800" }}>{t(c)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {a.message ? <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "600", lineHeight: 17 }}>{a.message}</Text> : null}
                {a.status === "pending" ? (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable onPress={() => void respond(a.applicationId, "accept")} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flex: 1, flexDirection: "row", gap: 5, justifyContent: "center", paddingVertical: 8 }}>
                      <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>{t("Kabul et")}</Text>
                    </Pressable>
                    <Pressable onPress={() => void respond(a.applicationId, "decline")} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 5, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{t("Reddet")}</Text>
                    </Pressable>
                  </View>
                ) : a.status === "accepted" ? (
                  <Link href={{ pathname: "/ortak/[id]", params: { id: a.partnerId } }} asChild>
                    <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                      <MaterialCommunityIcons name="storefront-outline" size={13} color={colors.primaryDark} />
                      <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{t("Ortağın vitrinini gör")}</Text>
                    </Pressable>
                  </Link>
                ) : null}
              </View>
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        multiline={multiline}
        style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: multiline ? 68 : 44, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: multiline ? "top" : "center" }}
      />
    </View>
  );
}

function Seg({ active, icon, label, onPress }: { active: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", backgroundColor: active ? colors.primary : colors.surfaceAlt, borderColor: active ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, opacity: pressed ? 0.8 : 1, paddingHorizontal: 12, paddingVertical: 8 })}>
      <MaterialCommunityIcons name={icon} size={15} color={active ? "#FFFFFF" : colors.muted} />
      <Text style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: active ? colors.primary : colors.surfaceAlt, borderColor: active ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, opacity: pressed ? 0.8 : 1, paddingHorizontal: 12, paddingVertical: 7 })}>
      <Text numberOfLines={1} style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function Badge({ icon, label, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; tone?: "success" }) {
  const c = tone === "success" ? colors.success : colors.muted;
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 8, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
      <MaterialCommunityIcons name={icon} size={12} color={c} />
      <Text style={{ color: tone === "success" ? colors.success : colors.ink, fontSize: 11, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}
