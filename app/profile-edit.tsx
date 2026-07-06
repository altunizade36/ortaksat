import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { AuthRequired } from "@/components/auth-gate";
import { PasswordStrengthMeter } from "@/components/password-strength-meter";
import { Card, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { changePasswordLive, reauthenticateLive, uploadProfileAvatar } from "@/lib/live-service";
import { actionLabel, fetchLoginHistory, type LoginEvent } from "@/lib/security-history";
import { useStore } from "@/lib/use-store";
import { passwordStrength } from "@/lib/validation";

type SettingsSection = "personal" | "security" | "notifications" | "store" | "verification";

function isImageAvatar(value: string) {
  return value.startsWith("http") || value.startsWith("file");
}

function ProfileEditScreenInner() {
  const { language } = useLanguage();
  const router = useRouter();
  const { authError, backendMode, currentUser, updateProfile, savePreferences, requestAccountDeletion, signOut, signOutAllDevices } = useStore();
  const prefs0 = currentUser.preferences ?? {};
  const isLiveAccount = backendMode === "supabase" && currentUser.id.includes("-");
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [bio, setBio] = useState(currentUser.bio);
  const [saving, setSaving] = useState(false);
  const isWideWeb = useIsWideWeb();
  const [section, setSection] = useState<SettingsSection>("personal");
  const [storeName, setStoreName] = useState(currentUser.name);
  const [iban, setIban] = useState((prefs0.iban as string) ?? "");
  const [storePrefs, setStorePrefs] = useState<Record<string, boolean>>({ autoApprove: prefs0.store_autoApprove === true, vacation: prefs0.store_vacation === true, showPhone: prefs0.store_showPhone !== false });

  function toggleStore(key: string) {
    setStorePrefs((s) => { const v = !s[key]; void savePreferences({ [`store_${key}`]: v }); return { ...s, [key]: v }; });
  }
  // Şifre değiştir (mevcut şifre + yeni + tekrar). Güvenlik: Supabase mevcut
  // şifreyi ister; ayrıca web'de Alert no-op olduğu için satır-içi mesaj gösteririz.
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [storeSaving, setStoreSaving] = useState(false);
  // Güvenlik: giriş/oturum geçmişi + tüm cihazlardan çıkış
  const [loginHistory, setLoginHistory] = useState<LoginEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!isLiveAccount) return;
    setHistoryLoading(true);
    const rows = await fetchLoginHistory(currentUser.id);
    setLoginHistory(rows);
    setHistoryLoading(false);
  }, [isLiveAccount, currentUser.id]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function signOutEverywhere() {
    if (signingOutAll) return;
    setSigningOutAll(true);
    const ok = await signOutAllDevices();
    setSigningOutAll(false);
    if (ok) { Alert.alert("Tüm cihazlardan çıkıldı", "Tüm oturumların kapatıldı. Tekrar giriş yapman gerekir."); router.replace("/auth"); }
    else Alert.alert("İşlem tamamlanamadı", "Oturumlar kapatılamadı, tekrar dene.");
  }

  async function changePassword() {
    setPwMsg(null);
    if (!pwCurrent) { const t = "Mevcut şifreni gir."; setPwMsg({ tone: "err", text: t }); Alert.alert("Mevcut şifre gerekli", t); return; }
    const s = passwordStrength(pwNew);
    if (!s.ok) { const miss = s.checks.filter((c) => !c.ok).map((c) => c.label.toLocaleLowerCase("tr-TR")).join(", "); const t = `Yeni şifre yeterince güçlü değil. Ekle: ${miss}.`; setPwMsg({ tone: "err", text: t }); Alert.alert("Şifre yeterince güçlü değil", t); return; }
    if (pwNew !== pwNew2) { const t = "Yeni şifre ile tekrarı aynı olmalı."; setPwMsg({ tone: "err", text: t }); Alert.alert("Şifreler uyuşmuyor", t); return; }
    if (pwNew === pwCurrent) { const t = "Yeni şifre mevcut şifreden farklı olmalı."; setPwMsg({ tone: "err", text: t }); Alert.alert("Aynı şifre", t); return; }
    if (!isLiveAccount) { const t = "Şifre değişikliği yalnızca canlı hesaplarda geçerlidir."; setPwMsg({ tone: "err", text: t }); Alert.alert("Ön izleme hesabı", t); return; }
    setPwSaving(true);
    const res = await changePasswordLive(pwNew, pwCurrent);
    setPwSaving(false);
    if (!res.ok) { const t = res.error ?? "Şifre güncellenemedi."; setPwMsg({ tone: "err", text: t }); Alert.alert("Güncellenemedi", t); return; }
    setPwCurrent(""); setPwNew(""); setPwNew2("");
    setPwMsg({ tone: "ok", text: "Şifren güncellendi. Bir sonraki girişte yeni şifreni kullan." });
    Alert.alert("Şifre güncellendi", "Yeni şifren kaydedildi. Bir sonraki girişte bunu kullan.");
  }

  async function saveStore() {
    setStoreSaving(true);
    // IBAN profiles kolonunda tutulmaz; preferences JSON'a kalıcı yazılır (komisyon
    // ödeme bilgisi). Önceden yalnız lokal state'teydi ve kaydedilmiyordu.
    const ibanClean = iban.replace(/\s+/g, "").toLocaleUpperCase("tr-TR");
    await savePreferences({ iban: ibanClean });
    const ok = await updateProfile({ name: storeName.trim() || name, phone, avatar, bio });
    setStoreSaving(false);
    Alert.alert(ok ? "Kaydedildi" : "Kaydedilemedi", ok ? "Mağaza bilgilerin güncellendi." : (authError ?? "Bir sorun oluştu."));
  }

  function startVerification(label: string) {
    Alert.alert(
      label,
      "Doğrulama işlemleri güvenlik nedeniyle ekibimiz tarafından, ilgili belge/bilgi kontrolüyle yapılır. Talebini Yasal & Destek üzerinden başlatabilirsin.",
      [
        { text: "Kapat", style: "cancel" },
        { text: "Destek talebi", onPress: () => router.push("/legal") }
      ]
    );
  }

  // Hesap silme: şifre doğrulaması + 30 gün geri alma bilgisi (soft-delete).
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  function closeAccount() {
    if (!isLiveAccount) {
      Alert.alert("Ön izleme hesabı", "Hesap silme yalnızca canlı hesaplarda geçerlidir.");
      return;
    }
    setDeletePw("");
    setDeleteReason("");
    setDeleteOpen(true);
  }

  async function confirmDeleteAccount() {
    if (deleting) return;
    if (deletePw.length < 1) { Alert.alert("Şifre gerekli", "Devam etmek için şifreni gir."); return; }
    setDeleting(true);
    const verified = await reauthenticateLive(deletePw);
    if (!verified) {
      setDeleting(false);
      Alert.alert("Şifre doğrulanamadı", "Girdiğin şifre hatalı. Hesap silme işlemi güvenlik için iptal edildi.");
      return;
    }
    const ok = await requestAccountDeletion(deleteReason.trim() || "Kullanıcı ayarlar ekranından hesap silme talebi oluşturdu.");
    setDeleting(false);
    setDeleteOpen(false);
    if (ok) {
      Alert.alert(
        "Hesap silme talebin alındı",
        "Hesabın 30 gün boyunca askıya alınır; bu süre içinde giriş yaparsan talebini iptal edip hesabını geri alabilirsin. 30 gün sonunda hesabın ve ilişkili verilerin kalıcı olarak silinir.",
        [{ text: "Anladım", onPress: () => void signOut() }]
      );
    } else {
      Alert.alert("Oluşturulamadı", authError ?? "Talep oluşturulamadı, lütfen tekrar dene.");
    }
  }

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(translateCopy("İzin gerekli", language), translateCopy("Profil fotoğrafı seçmek için galeri izni vermelisin.", language));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images"],
      quality: 0.82
    });

    if (!result.canceled && result.assets[0]?.uri) setAvatar(result.assets[0].uri);
  }

  async function submit() {
    if (!name.trim()) {
      Alert.alert(translateCopy("Ad gerekli", language), translateCopy("Profil adını boş bırakamazsın.", language));
      return;
    }

    setSaving(true);
    const uploadedAvatar = isLiveAccount ? await uploadProfileAvatar(avatar.trim(), currentUser.id) : avatar.trim();
    const ok = await updateProfile({ name, phone, avatar: uploadedAvatar, bio });
    setSaving(false);

    if (!ok) {
      Alert.alert(translateCopy("Kaydedilemedi", language), translateCopy(authError ?? "Profil güncellenemedi.", language));
      return;
    }

    Alert.alert(translateCopy("Profil güncellendi", language), translateCopy(isLiveAccount ? "Değişiklikler canlı profiline kaydedildi." : "Ön izleme profili güncellendi.", language));
    router.back();
  }

  // Hesap silme onay modalı (şifre doğrulaması + 30 gün geri alma) — her iki düzende ortak.
  const deleteModal = (
    <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
      <View style={{ backgroundColor: "rgba(0,0,0,0.55)", flex: 1, justifyContent: "center", padding: 20 }}>
        <View style={{ alignSelf: "center", backgroundColor: colors.background, borderRadius: 18, gap: 14, maxWidth: 440, padding: 22, width: "100%" }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
              <MaterialCommunityIcons name="account-alert-outline" size={24} color={colors.accent} />
            </View>
            <Text style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900" }}>Hesabını sil</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>
            Hesabın <Text style={{ color: colors.ink, fontWeight: "900" }}>30 gün</Text> boyunca askıya alınır. Bu süre içinde tekrar giriş yaparsan talebini iptal edip hesabını geri alabilirsin. 30 günün sonunda hesabın, ilanların ve ilişkili verilerin kalıcı olarak silinir.
          </Text>
          <DeskField icon="lock-outline" label="Devam etmek için şifreni gir" secure value={deletePw} onChangeText={setDeletePw} placeholder="Şifren" />
          <DeskField icon="comment-outline" label="Sebep (opsiyonel)" value={deleteReason} onChangeText={setDeleteReason} placeholder="Ayrılma sebebini yazabilirsin" />
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
            <Pressable onPress={() => setDeleteOpen(false)} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 11 }}>
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>Vazgeç</Text>
            </Pressable>
            <Pressable onPress={() => void confirmDeleteAccount()} disabled={deleting} style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 10, opacity: deleting ? 0.6 : 1, paddingHorizontal: 18, paddingVertical: 11 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{deleting ? "İşleniyor…" : "Hesabımı sil"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (isWideWeb) {
    const navItems: Array<{ key: SettingsSection; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; sub: string }> = [
      { key: "personal", icon: "account-outline", label: "Kişisel Bilgiler", sub: "Ad, telefon, foto, bio" },
      { key: "security", icon: "lock-outline", label: "Hesap Güvenliği", sub: "Şifre ve oturumlar" },
      { key: "notifications", icon: "bell-outline", label: "Bildirim Tercihleri", sub: "E-posta, SMS, anlık" },
      { key: "store", icon: "storefront-outline", label: "Mağaza Ayarları", sub: "Ödeme ve ortaklık" },
      { key: "verification", icon: "shield-check-outline", label: "Doğrulama Durumu", sub: "Kimlik ve hesap" }
    ];
    const verifications = [
      { label: "Telefon doğrulandı", done: currentUser.verifiedPhone },
      { label: "Kimlik doğrulandı", done: currentUser.verifiedIdentity },
      { label: "Instagram bağlandı", done: !!currentUser.verifiedInstagram }
    ];
    const doneCount = verifications.filter((v) => v.done).length;
    const completion = Math.round(((doneCount + (bio ? 1 : 0) + (avatar ? 1 : 0)) / 5) * 100);

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        {deleteModal}
        <View style={{ alignSelf: "center", gap: 16, maxWidth: 1280, paddingHorizontal: 20, paddingTop: 16, width: "100%" }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>Ayarlar</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Hesabını, güvenlik ve bildirim tercihlerini buradan yönet.</Text>
        </View>

        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
          {/* Left nav */}
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 4, padding: 10, width: 270 }}>
            {navItems.map((n) => {
              const on = section === n.key;
              return (
                <Pressable key={n.key} onPress={() => setSection(n.key)} style={{ alignItems: "center", backgroundColor: on ? colors.primarySoft : "transparent", borderRadius: 12, flexDirection: "row", gap: 12, paddingHorizontal: 12, paddingVertical: 11 }}>
                  <MaterialCommunityIcons name={n.icon} size={20} color={on ? colors.primaryDark : colors.muted} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: on ? colors.primaryDark : colors.ink, fontSize: 13.5, fontWeight: "800" }}>{n.label}</Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{n.sub}</Text>
                  </View>
                  {on ? <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primaryDark} /> : null}
                </Pressable>
              );
            })}
          </View>

          {/* Center content */}
          <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
            {section === "personal" ? (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 16, padding: 22 }}>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Kişisel Bilgiler</Text>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 16 }}>
                  <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 16, height: 80, justifyContent: "center", overflow: "hidden", width: 80 }}>
                    {isImageAvatar(avatar.trim()) ? <Image source={{ uri: avatar.trim() }} contentFit="cover" style={{ height: 80, width: 80 }} /> : <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "900" }}>{avatar.trim() || "OS"}</Text>}
                  </View>
                  <View style={{ gap: 8 }}>
                    <Pressable onPress={() => void pickAvatar()} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 16, paddingVertical: 10 }}>
                      <MaterialCommunityIcons name="image-plus" size={17} color={colors.primaryDark} />
                      <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>Fotoğraf yükle</Text>
                    </Pressable>
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>JPG veya PNG, en fazla 5MB.</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 14 }}>
                  <View style={{ flex: 1 }}><DeskField label="Ad soyad / mağaza adı" value={name} onChangeText={setName} icon="account-outline" /></View>
                  <View style={{ flex: 1 }}><DeskField label="Telefon" value={phone} onChangeText={setPhone} icon="phone-outline" /></View>
                </View>
                <DeskField label="Bio" value={bio} onChangeText={setBio} icon="text-account" multiline />
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>Rol, puan, yanıt oranı ve doğrulama durumu güvenlik nedeniyle elle değiştirilemez.</Text>
                <Pressable disabled={saving} onPress={() => void submit()} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 22, paddingVertical: 12 }}>
                  <MaterialCommunityIcons name="content-save-outline" size={17} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{saving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</Text>
                </Pressable>
              </View>
            ) : null}

            {section === "security" ? (
              <View style={{ gap: 16 }}>
                <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 22 }}>
                  <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Şifre değiştir</Text>
                  <DeskField label="Mevcut şifren" value={pwCurrent} onChangeText={setPwCurrent} icon="lock-outline" secure />
                  <View style={{ flexDirection: "row", gap: 14 }}>
                    <View style={{ flex: 1 }}><DeskField label="Yeni şifre (güçlü olmalı)" value={pwNew} onChangeText={setPwNew} icon="lock-reset" secure /></View>
                    <View style={{ flex: 1 }}><DeskField label="Yeni şifre (tekrar)" value={pwNew2} onChangeText={setPwNew2} icon="lock-check-outline" secure /></View>
                  </View>
                  <PasswordStrengthMeter password={pwNew} />
                  {pwMsg ? <Text style={{ color: pwMsg.tone === "ok" ? colors.success : colors.accent, fontSize: 12.5, fontWeight: "800" }}>{pwMsg.text}</Text> : null}
                  <Pressable disabled={pwSaving} onPress={() => void changePassword()} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, opacity: pwSaving ? 0.6 : 1, paddingHorizontal: 22, paddingVertical: 12 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{pwSaving ? "Güncelleniyor…" : "Şifreyi güncelle"}</Text>
                  </Pressable>
                </View>
                <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 22 }}>
                  <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
                    <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.primary} style={{ marginTop: 1 }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>Oturum güvenliği</Text>
                      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>Şu an bu cihazda giriş yapılı. Güvenlik için ortak cihazlarda işin bitince “Çıkış Yap” ile oturumunu kapat. Şüpheli bir durumda şifreni hemen değiştir.</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => void signOut()} style={{ alignItems: "center", alignSelf: "flex-start", borderColor: colors.accent, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 10 }}>
                    <MaterialCommunityIcons name="logout" size={16} color={colors.accent} />
                    <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "800" }}>Bu cihazdan çıkış yap</Text>
                  </Pressable>
                </View>
                <LoginHistoryCard history={loginHistory} loading={historyLoading} isLive={isLiveAccount} onRefresh={() => void loadHistory()} onSignOutAll={() => void signOutEverywhere()} signingOutAll={signingOutAll} />
              </View>
            ) : null}

            {section === "notifications" ? (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 22 }}>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Bildirimler</Text>
                <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
                  <MaterialCommunityIcons name="bell-ring-outline" size={20} color={colors.primary} style={{ marginTop: 1 }} />
                  <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>Talep, satış, komisyon, ortaklık ve mesaj gibi <Text style={{ fontWeight: "900" }}>önemli hareketler uygulama içinde anlık bildirim</Text> olarak sana gösterilir — Bildirimler sekmesinden takip edebilirsin.</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>E-posta/SMS bildirim kanalları ileride eklendiğinde buradan yönetebileceksin.</Text>
              </View>
            ) : null}

            {section === "store" ? (
              <View style={{ gap: 16 }}>
                <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 22 }}>
                  <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Mağaza Bilgileri</Text>
                  <DeskField label="Mağaza adı" value={storeName} onChangeText={setStoreName} icon="storefront-outline" />
                  <DeskField label="IBAN / ödeme bilgisi (opsiyonel)" value={iban} onChangeText={setIban} icon="bank-outline" placeholder="TR__ ____ ____ ____ ____ __" />
                  <View style={{ alignItems: "flex-start", backgroundColor: colors.infoSoft, borderRadius: 10, flexDirection: "row", gap: 8, padding: 12 }}>
                    <MaterialCommunityIcons name="information-outline" size={17} color={colors.info} style={{ marginTop: 1 }} />
                    <Text style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>Ortaksat ödeme almaz veya tutmaz. Bu bilgiyi yalnızca, ortakların komisyonlarını sana doğrudan öderken kullanabilmesi için isteğe bağlı paylaşırsın.</Text>
                  </View>
                  <Pressable disabled={storeSaving} onPress={() => void saveStore()} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, opacity: storeSaving ? 0.6 : 1, paddingHorizontal: 22, paddingVertical: 12 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{storeSaving ? "Kaydediliyor…" : "Mağaza ayarlarını kaydet"}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {section === "verification" ? (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 4, padding: 22 }}>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900", marginBottom: 8 }}>Doğrulama Durumu</Text>
                {verifications.map((v, i) => (
                  <View key={v.label} style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: i === 0 ? 0 : 1, flexDirection: "row", gap: 12, paddingVertical: 14 }}>
                    <View style={{ alignItems: "center", backgroundColor: v.done ? colors.successSoft : colors.surfaceAlt, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
                      <MaterialCommunityIcons name={v.done ? "check-decagram" : "alert-circle-outline"} size={20} color={v.done ? colors.success : colors.warning} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>{v.label}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{v.done ? "Onaylandı" : "Henüz doğrulanmadı"}</Text>
                    </View>
                    <View style={{ backgroundColor: v.done ? colors.successSoft : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ color: v.done ? colors.success : colors.muted, fontSize: 12, fontWeight: "800" }}>{v.done ? "Onaylı" : "Bekliyor"}</Text>
                    </View>
                  </View>
                ))}
                <View style={{ alignItems: "flex-start", backgroundColor: colors.infoSoft, borderRadius: 10, flexDirection: "row", gap: 8, marginTop: 6, padding: 12 }}>
                  <MaterialCommunityIcons name="information-outline" size={17} color={colors.info} style={{ marginTop: 1 }} />
                  <Text style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>Doğrulamalar güvenlik gereği ekibimizce, belge/bilgi kontrolüyle yapılır. Aşağıdan talep oluşturabilirsin.</Text>
                </View>
                <Pressable onPress={() => startVerification("Doğrulama talebi")} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, marginTop: 8, paddingHorizontal: 20, paddingVertical: 11 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Doğrulama talebi oluştur</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Right sidebar */}
          <View style={{ gap: 16, width: 280 }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Hesap gücü</Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 56, justifyContent: "center", width: 56 }}>
                  <Text style={{ color: colors.primaryDark, fontSize: 17, fontWeight: "900" }}>%{completion}</Text>
                </View>
                <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>Eksik adımları tamamlayarak hesabını güçlendir.</Text>
              </View>
              <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 8, overflow: "hidden" }}>
                <View style={{ backgroundColor: completion >= 75 ? colors.success : colors.warning, borderRadius: 999, height: "100%", width: `${completion}%` }} />
              </View>
              {verifications.map((v) => (
                <View key={v.label} style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
                  <MaterialCommunityIcons name={v.done ? "check-circle" : "circle-outline"} size={16} color={v.done ? colors.success : colors.subtle} />
                  <Text style={{ color: v.done ? colors.ink : colors.muted, fontSize: 12.5, fontWeight: "700" }}>{v.label}</Text>
                </View>
              ))}
            </View>

            <View style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: 16, borderWidth: 1, gap: 8, padding: 18 }}>
              <MaterialCommunityIcons name="alert-octagon-outline" size={22} color={colors.accent} />
              <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>Tehlikeli bölge</Text>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>Hesabını kapatırsan ilanların ve komisyon geçmişin kalıcı olarak silinir.</Text>
              <Pressable onPress={closeAccount} style={{ alignItems: "center", borderColor: colors.accent, borderRadius: 10, borderWidth: 1, marginTop: 2, paddingVertical: 10 }}>
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "800" }}>Hesabı kapat</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </View>

        <WebFooter />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      {deleteModal}
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 110 }}>
        <Card>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, height: 64, justifyContent: "center", overflow: "hidden", width: 64 }}>
              {isImageAvatar(avatar.trim()) ? (
                <Image source={{ uri: avatar.trim() }} contentFit="cover" style={{ height: 64, width: 64 }} />
              ) : (
                <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "900", paddingHorizontal: 4 }}>
                  {avatar.trim() || "OS"}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text selectable style={{ color: colors.ink, fontSize: 21, fontWeight: "900", lineHeight: 26 }}>
                {translateCopy("Profil bilgileri", language)}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <StatusPill label={isLiveAccount ? "Canlı hesap" : "Ön izleme"} tone={isLiveAccount ? "success" : "warning"} />
                <StatusPill label={currentUser.verifiedPhone ? "Telefon doğrulandı" : "Telefon bekliyor"} tone={currentUser.verifiedPhone ? "success" : "warning"} />
              </View>
            </View>
          </View>
          <PrimaryButton icon="image-plus" tone="secondary" onPress={() => void pickAvatar()}>Galeriden fotoğraf seç</PrimaryButton>
        </Card>

        <Card>
          <SectionTitle title="Genel profil" />
          <Field label="Ad soyad / mağaza adı" value={name} onChangeText={setName} icon="account-outline" />
          <Field label="Telefon" value={phone} onChangeText={setPhone} icon="phone-outline" keyboardType="phone-pad" />
          <Field label="Avatar kısa adı veya görsel adresi" value={avatar} onChangeText={setAvatar} icon="image-outline" />
          <Field label="Bio" value={bio} onChangeText={setBio} icon="text-account" multiline />
          <Text selectable style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            {translateCopy("Rol, hesap durumu, telefon doğrulama, kimlik doğrulama, puan ve yanıt oranı güvenlik nedeniyle kullanıcı tarafından yükseltilemez.", language)}
          </Text>
        </Card>

        <PrimaryButton icon="content-save-outline" onPress={() => void submit()}>{saving ? "Kaydediliyor" : "Profili kaydet"}</PrimaryButton>

        {/* Mobil paritesi: şifre/IBAN/bildirim/doğrulama/hesap web'de vardı, mobilde yoktu. */}
        {isLiveAccount ? (
          <>
            <Card>
              <SectionTitle title="Hesap güvenliği" />
              <DeskField icon="lock-outline" label="Mevcut şifren" secure value={pwCurrent} onChangeText={setPwCurrent} placeholder="Şu anki şifren" />
              <DeskField icon="lock-reset" label="Yeni şifre (güçlü olmalı)" secure value={pwNew} onChangeText={setPwNew} placeholder="Büyük/küçük harf, rakam, özel karakter" />
              <PasswordStrengthMeter password={pwNew} />
              <DeskField icon="lock-check-outline" label="Yeni şifre (tekrar)" secure value={pwNew2} onChangeText={setPwNew2} placeholder="Tekrar" />
              {pwMsg ? <Text style={{ color: pwMsg.tone === "ok" ? colors.success : colors.accent, fontSize: 12.5, fontWeight: "800" }}>{pwMsg.text}</Text> : null}
              <PrimaryButton icon="key-outline" tone="secondary" onPress={() => void changePassword()}>{pwSaving ? "Güncelleniyor" : "Şifreyi güncelle"}</PrimaryButton>
            </Card>
            <LoginHistoryCard history={loginHistory} loading={historyLoading} isLive={isLiveAccount} onRefresh={() => void loadHistory()} onSignOutAll={() => void signOutEverywhere()} signingOutAll={signingOutAll} />
          </>
        ) : null}

        <Card>
          <SectionTitle title="Bildirimler" />
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>Talep, satış, komisyon, ortaklık ve mesaj gibi <Text style={{ fontWeight: "900" }}>önemli hareketler uygulama içinde anlık bildirim</Text> olarak gösterilir; Bildirimler sekmesinden takip edebilirsin.</Text>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>E-posta/SMS bildirim kanalları ileride eklendiğinde buradan yönetebileceksin.</Text>
        </Card>

        <Card>
          <SectionTitle title="Mağaza & ödeme" />
          <Field label="Mağaza adı" value={storeName} onChangeText={setStoreName} icon="storefront-outline" />
          <DeskField icon="bank-outline" label="IBAN (komisyon tahsilatı için)" value={iban} onChangeText={setIban} placeholder="TR__ ____ ____ ____ ____ __" />
          <PrimaryButton icon="content-save-outline" tone="secondary" onPress={() => void saveStore()}>{storeSaving ? "Kaydediliyor" : "Mağaza & IBAN'ı kaydet"}</PrimaryButton>
        </Card>

        <Card>
          <SectionTitle title="Doğrulama durumu" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label={currentUser.verifiedPhone ? "Telefon ✓" : "Telefon —"} tone={currentUser.verifiedPhone ? "success" : "warning"} />
            <StatusPill label={currentUser.verifiedIdentity ? "Kimlik ✓" : "Kimlik —"} tone={currentUser.verifiedIdentity ? "success" : "warning"} />
            <StatusPill label={currentUser.verifiedInstagram ? "Instagram ✓" : "Instagram —"} tone={currentUser.verifiedInstagram ? "success" : "warning"} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Doğrulamalar güvenlik gereği ekibimizce, belge/bilgi kontrolüyle yapılır.</Text>
          <PrimaryButton icon="shield-check-outline" tone="secondary" onPress={() => startVerification("Doğrulama talebi")}>Doğrulama talebi oluştur</PrimaryButton>
        </Card>

        <Card>
          <SectionTitle title="Hesap" />
          <PrimaryButton icon="account-cancel-outline" tone="danger" onPress={closeAccount}>Hesabı kapat</PrimaryButton>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/** Giriş/oturum geçmişi + tüm cihazlardan çıkış kartı (masaüstü ve mobil ortak). */
function LoginHistoryCard({ history, loading, isLive, onRefresh, onSignOutAll, signingOutAll }: { history: LoginEvent[]; loading: boolean; isLive: boolean; onRefresh: () => void; onSignOutAll: () => void; signingOutAll: boolean }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 22 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="history" size={20} color={colors.primary} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>Son giriş etkinliği</Text>
        <Pressable onPress={onRefresh} hitSlop={8} accessibilityLabel="Yenile"><MaterialCommunityIcons name="refresh" size={18} color={colors.muted} /></Pressable>
      </View>
      {!isLive ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>Giriş geçmişi yalnızca canlı hesaplarda görüntülenir.</Text>
      ) : loading ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>Yükleniyor…</Text>
      ) : history.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>Henüz kayıtlı giriş etkinliği yok.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {history.map((e) => (
            <View key={e.id} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
              <MaterialCommunityIcons name={e.os === "iOS" || e.os === "Android" ? "cellphone" : "monitor"} size={18} color={colors.muted} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{actionLabel(e.action)} · {e.browser}</Text>
                <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{e.os} · {formatWhen(e.when)}</Text>
              </View>
              {e.isCurrent ? <View style={{ backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: colors.success, fontSize: 10.5, fontWeight: "900" }}>BU CİHAZ</Text></View> : null}
            </View>
          ))}
        </View>
      )}
      <Pressable onPress={onSignOutAll} disabled={signingOutAll || !isLive} style={{ alignItems: "center", alignSelf: "flex-start", borderColor: colors.accent, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, opacity: signingOutAll || !isLive ? 0.6 : 1, paddingHorizontal: 18, paddingVertical: 10 }}>
        <MaterialCommunityIcons name="logout-variant" size={16} color={colors.accent} />
        <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "800" }}>{signingOutAll ? "Çıkılıyor…" : "Tüm cihazlardan çıkış yap"}</Text>
      </Pressable>
    </View>
  );
}

function DeskField({ icon, label, multiline, onChangeText, placeholder, secure, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; multiline?: boolean; onChangeText: (v: string) => void; placeholder?: string; secure?: boolean; value: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
      <View style={{ alignItems: multiline ? "flex-start" : "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 9, paddingHorizontal: 12 }}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} style={{ marginTop: multiline ? 14 : 0 }} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          secureTextEntry={secure}
          placeholder={placeholder}
          placeholderTextColor={colors.subtle}
          style={{ color: colors.ink, flex: 1, fontSize: 14, minHeight: multiline ? 90 : 46, paddingVertical: 10, textAlignVertical: multiline ? "top" : "center" }}
        />
      </View>
    </View>
  );
}

function ToggleRow({ label, on, onPress, sub }: { label: string; on: boolean; onPress: () => void; sub: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>{label}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{sub}</Text>
      </View>
      <Pressable onPress={onPress} style={{ alignItems: on ? "flex-end" : "flex-start", backgroundColor: on ? colors.primary : colors.line, borderRadius: 999, height: 26, justifyContent: "center", paddingHorizontal: 3, width: 48 }}>
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 20, width: 20 }} />
      </Pressable>
    </View>
  );
}

function Field({
  icon,
  keyboardType,
  label,
  multiline,
  onChangeText,
  value
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  keyboardType?: "default" | "phone-pad";
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  value: string;
}) {
  const { language } = useLanguage();
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>
        {translateCopy(label, language)}
      </Text>
      <View style={{ alignItems: multiline ? "flex-start" : "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 9, paddingHorizontal: 12 }}>
        <MaterialCommunityIcons name={icon} size={19} color={colors.primary} style={{ marginTop: multiline ? 14 : 0 }} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          multiline={multiline}
          placeholderTextColor={colors.muted}
          style={{ color: colors.ink, flex: 1, fontSize: 15, minHeight: multiline ? 96 : 48, paddingVertical: 10, textAlignVertical: multiline ? "top" : "center" }}
        />
      </View>
    </View>
  );
}

export default function ProfileEditScreen() {
  const auth = useStore();
  if (!auth.isAuthenticated) return <AuthRequired title="Ayarlar için giriş yapın" />;
  return <ProfileEditScreenInner />;
}
