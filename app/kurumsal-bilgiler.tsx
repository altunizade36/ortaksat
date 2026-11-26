import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { AuthRequired } from "@/components/auth-gate";
import { colors } from "@/components/colors";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { LegalConsentModal } from "@/components/legal-consent-modal";
import { MobileBottomNav, MobileButton, MobileCard, MobileField, MobileScreen, MobileSelect, mobile, ms } from "@/components/mobile/ui";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { Seo } from "@/components/seo";
import { BUSINESS_CONTRACT_VERSION, loadBusinessAccount, saveBusinessAccount, type BusinessAccount } from "@/lib/business-account";
import { categoryTree } from "@/lib/category-tree";
import { TR_PROVINCES } from "@/lib/cities";
import { LEGAL_DOCS } from "@/lib/legal-content";
import { useIsWideWeb } from "@/lib/layout";
import { showToast } from "@/lib/toast";
import { useStore } from "@/lib/use-store";

// Kayıt ekranındaki "Kurumsal hesap aç" formuyla aynı alanlar: işletme bilgileri kayıttan sonra buradan
// görülür ve düzeltilir; bireysel hesap da buradan kurumsala geçer. Vergi / TC kimlik numarası istenmez.
const ACTIVITIES: string[] = categoryTree.map((node) => node.label).filter((label) => label !== "Arayanlar");
const EMPTY: BusinessAccount = { name: "", type: "sahis", contactName: "", city: "", activity: "", phone: "" };

export default function BusinessInfoScreen() {
  const store = useStore();
  if (!store.authReady) return <ScreenSkeleton />;
  if (!store.isAuthenticated) return <AuthRequired title="Kurumsal hesap bilgileri için giriş yap" />;
  if (!store.accountLoaded) return <ScreenSkeleton />;
  return <BusinessInfo key={store.currentUser.id} />;
}

function BusinessInfo() {
  const store = useStore(), router = useRouter(), wide = useIsWideWeb(), user = store.currentUser;
  const [state, setState] = useState<"loading" | "failed" | "ready">("loading");
  const [exists, setExists] = useState(false);
  const [form, setForm] = useState<BusinessAccount>(EMPTY);
  const [accepted, setAccepted] = useState(false);
  const [contractVersion, setContractVersion] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<"kurumsal" | "magaza" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);

  useEffect(() => {
    let alive = true;
    setState("loading");
    void loadBusinessAccount(user.id).then((result) => {
      if (!alive) return;
      if (!result.ok) { setState("failed"); return; }
      setExists(!!result.account);
      // Bireysel hesap kurumsala geçerken yetkili adı ve il, profildeki bilgiyle hazır gelir.
      setForm(result.account ?? { ...EMPTY, contactName: user.name || "", city: user.city && TR_PROVINCES.includes(user.city) ? user.city : "" });
      setContractVersion(result.contractVersion);
      setState("ready");
    });
    return () => { alive = false; };
  }, [user.id, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<BusinessAccount>) => { setForm((old) => ({ ...old, ...patch })); setError(""); };

  async function save() {
    if (lock.current) return;
    if (form.name.trim().length < 2) { setError("İşletme adını yaz."); return; }
    if (form.contactName.trim().length < 2) { setError("Yetkili kişinin adını ve soyadını yaz."); return; }
    if (!form.city) { setError("İşletmenin bulunduğu ili seç."); return; }
    const digits = form.phone.replace(/\D/g, "");
    if (form.phone.trim() && (digits.length < 10 || digits.length > 13)) { setError("Telefon numarasını alan koduyla birlikte yaz ya da boş bırak."); return; }
    if (!exists && !accepted) { setError("Devam etmek için sözleşme kutusunu işaretle."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const ok = await saveBusinessAccount(user.id, form, !exists);
      if (!ok) { setError("Bilgiler kaydedilemedi. Bağlantını kontrol edip yeniden dene."); return; }
      showToast(exists ? "Kurumsal hesap bilgilerin güncellendi." : "Hesabın kurumsal hesaba çevrildi.");
      if (!exists) setContractVersion(BUSINESS_CONTRACT_VERSION);
      setExists(true);
    } finally { lock.current = false; setBusy(false); }
  }

  const link = { color: colors.primaryDark, fontWeight: "800" as const, textDecorationLine: "underline" as const };
  // MobileField / MobileSelect "flex: 1" taşır: sütunda yükseklik olur, alan şişer → her biri satır kabında.
  const line = (child: ReactNode) => <View style={{ flexDirection: "row", gap: 12 }}>{child}</View>;

  return <MobileScreen title="Kurumsal Hesap Bilgileri" headerShown={wide} bottom={wide ? undefined : <MobileBottomNav active="profile" />}>
    <Seo title="Kurumsal Hesap Bilgileri | OrtakSat" description="Kurumsal hesabının işletme bilgilerini gör ve güncelle." path="/kurumsal-bilgiler" noindex />
    <View style={{ alignSelf: "center", maxWidth: 760, width: "100%" }}>
      {state === "loading" ? <MobileCard><Text style={ms.muted}>Bilgiler yükleniyor…</Text></MobileCard> : null}
      {state === "failed" ? <MobileCard><Text style={ms.error}>Bilgiler yüklenemedi. Bağlantını kontrol et.</Text><MobileButton secondary icon="refresh" onPress={() => setAttempt((n) => n + 1)}>Tekrar Dene</MobileButton></MobileCard> : null}
      {state === "ready" ? <>
        <MobileCard style={{ backgroundColor: colors.surfaceAlt }}>
          <View style={ms.row}>
            <Icon name={exists ? "domain" : "account-outline"} size={24} color={colors.primary} />
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <Text style={ms.section}>{exists ? "Hesap türün: Kurumsal" : "Hesap türün: Bireysel"}</Text>
              <Text style={ms.muted}>{exists
                ? "Bu bilgileri yalnız sen ve OrtakSat görür; ilanlarında ve mağazanda yayımlanmaz. Mağazanda görünen ad profil adındır."
                : "İşletme adına satış yapıyorsan hesabını kurumsal hesaba çevirebilirsin. İlanların, mesajların ve ortaklıkların aynen kalır. Vergi ya da kimlik numarası istemiyoruz."}</Text>
            </View>
          </View>
        </MobileCard>
        <MobileCard>
          {line(<MobileField label="İşletme adı" required value={form.name} onChange={(v) => set({ name: v })} placeholder="Örn. Demir Mobilya" maxLength={120} />)}
          <View style={{ gap: 5 }}>
            <Text style={ms.label}>İşletme türü</Text>
            <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 4 }}>
              {([["sahis", "Şahıs işletmesi"], ["sirket", "Limited veya anonim şirket"]] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: form.type === value }} accessibilityLabel={label} onPress={() => set({ type: value })} style={{ alignItems: "center", flexDirection: "row", gap: 7, minHeight: 44 }}>
                <Icon name={form.type === value ? "radiobox-marked" : "radiobox-blank"} size={21} color={form.type === value ? colors.primary : mobile.muted} />
                <Text style={{ color: mobile.ink, fontSize: 14 }}>{label}</Text>
              </Pressable>)}
            </View>
          </View>
          {line(<><MobileSelect label="İl" value={form.city} placeholder="Seçiniz" options={TR_PROVINCES} onChange={(v) => set({ city: v })} /><MobileSelect label="Faaliyet alanı" value={form.activity} placeholder="Seçiniz" options={ACTIVITIES} onChange={(v) => set({ activity: v })} /></>)}
          {line(<MobileField label="Yetkili adı ve soyadı" required value={form.contactName} onChange={(v) => set({ contactName: v })} placeholder="Ayşe Demir" maxLength={120} />)}
          <View style={{ gap: 5 }}>
            <Text style={ms.label}>İşletme telefonu (isteğe bağlı)</Text>
            <TextInput accessibilityLabel="İşletme telefonu" value={form.phone} onChangeText={(v) => set({ phone: v.replace(/[^0-9+ ()-]/g, "").slice(0, 20) })} placeholder="0212 000 00 00" placeholderTextColor="#8B93A1" keyboardType="phone-pad" style={ms.input} />
          </View>
          {!exists ? <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 9, paddingTop: 4 }}>
            <Pressable onPress={() => { setAccepted((v) => !v); setError(""); }} hitSlop={8} accessibilityRole="checkbox" accessibilityLabel="Kurumsal hesap sözleşmesini kabul ediyorum" accessibilityState={{ checked: accepted }} style={{ paddingTop: 1 }}>
              <Icon name={accepted ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={accepted ? colors.primary : mobile.muted} />
            </Pressable>
            <Text style={{ color: mobile.muted, flex: 1, fontSize: 12.5, lineHeight: 19 }}>
              <Text onPress={() => setDoc("kurumsal")} style={link}>Kurumsal Hesap Sözleşmesi</Text>{" ve "}
              <Text onPress={() => setDoc("magaza")} style={link}>Mağaza Kullanım Kuralları</Text>{"’nı kabul ediyorum. İşletme adına işlem yapmaya yetkiliyim."}
            </Text>
          </View> : null}
          {error ? <Text accessibilityLiveRegion="polite" style={ms.error}>{error}</Text> : null}
          <MobileButton icon={exists ? "content-save-outline" : "domain"} disabled={busy} onPress={() => void save()}>{busy ? "Kaydediliyor…" : exists ? "Bilgileri Kaydet" : "Kurumsal Hesaba Geç"}</MobileButton>
        </MobileCard>
        {exists ? <MobileCard>
          {contractVersion ? <Text style={ms.muted}>Kabul ettiğin sözleşme sürümü: {contractVersion}</Text> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6 }}>
            <Text onPress={() => setDoc("kurumsal")} style={[link, { fontSize: 13 }]}>Kurumsal Hesap Sözleşmesi</Text>
            <Text onPress={() => setDoc("magaza")} style={[link, { fontSize: 13 }]}>Mağaza Kullanım Kuralları</Text>
          </View>
          <MobileButton secondary icon="storefront-outline" onPress={() => router.push({ pathname: "/profile-edit", params: { view: "advanced", section: "store" } } as never)}>Mağaza Bilgilerini Düzenle</MobileButton>
        </MobileCard> : null}
      </> : null}
    </View>
    <LegalConsentModal doc={doc ? LEGAL_DOCS[doc] : null} visible={!!doc} onClose={() => setDoc(null)} onApprove={() => setDoc(null)} />
  </MobileScreen>;
}
