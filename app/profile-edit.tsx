import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { AuthRequired } from "@/components/auth-gate";
import { Card, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { changePasswordLive, uploadProfileAvatar } from "@/lib/live-service";
import { useStore } from "@/lib/use-store";

type SettingsSection = "personal" | "security" | "notifications" | "store" | "verification";

function isImageAvatar(value: string) {
  return value.startsWith("http") || value.startsWith("file");
}

function ProfileEditScreenInner() {
  const { language } = useLanguage();
  const router = useRouter();
  const { authError, backendMode, currentUser, updateProfile } = useStore();
  const isLiveAccount = backendMode === "supabase" && currentUser.id.includes("-");
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [bio, setBio] = useState(currentUser.bio);
  const [saving, setSaving] = useState(false);
  const isWideWeb = useIsWideWeb();
  const [section, setSection] = useState<SettingsSection>("personal");
  const [storeName, setStoreName] = useState(currentUser.name);
  const [iban, setIban] = useState("");
  const [notif, setNotif] = useState<Record<string, boolean>>({ email: true, sms: false, push: true, whatsapp: true, marketing: false });
  const [storePrefs, setStorePrefs] = useState<Record<string, boolean>>({ autoApprove: false, vacation: false, showPhone: true });
  const [twoFA, setTwoFA] = useState(false);
  // Şifre değiştir
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [storeSaving, setStoreSaving] = useState(false);

  async function changePassword() {
    if (pwNew.length < 8) { Alert.alert("Zayıf şifre", "Yeni şifre en az 8 karakter olmalı."); return; }
    if (pwNew !== pwNew2) { Alert.alert("Şifreler uyuşmuyor", "Yeni şifre ile tekrarı aynı olmalı."); return; }
    if (!isLiveAccount) { Alert.alert("Ön izleme hesabı", "Şifre değişikliği yalnızca canlı hesaplarda geçerlidir."); return; }
    setPwSaving(true);
    const res = await changePasswordLive(pwNew);
    setPwSaving(false);
    if (!res.ok) { Alert.alert("Güncellenemedi", res.error ?? "Şifre güncellenemedi."); return; }
    setPwNew(""); setPwNew2("");
    Alert.alert("Şifre güncellendi", "Yeni şifren kaydedildi. Bir sonraki girişte bunu kullan.");
  }

  async function saveStore() {
    setStoreSaving(true);
    const ok = await updateProfile({ name: storeName.trim() || name, phone, avatar, bio });
    setStoreSaving(false);
    Alert.alert(ok ? "Kaydedildi" : "Kaydedilemedi", ok ? "Mağaza bilgilerin güncellendi." : (authError ?? "Bir sorun oluştu."));
  }

  function closeAccount() {
    Alert.alert(
      "Hesabı kapat",
      "Hesap kapatma kalıcıdır ve KVKK kapsamında işlenir. Talebini Yasal & Destek üzerinden başlatalım mı?",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Talep oluştur", style: "destructive", onPress: () => router.push("/kvkk") }
      ]
    );
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
    const notifRows: Array<{ key: string; label: string; sub: string }> = [
      { key: "email", label: "E-posta bildirimleri", sub: "Satış, komisyon ve talepler" },
      { key: "push", label: "Anlık bildirimler", sub: "Tarayıcı ve uygulama" },
      { key: "sms", label: "SMS bildirimleri", sub: "Yalnızca önemli hareketler" },
      { key: "whatsapp", label: "WhatsApp bildirimleri", sub: "Satış ve komisyon özetleri" },
      { key: "marketing", label: "Pazarlama & kampanyalar", sub: "Fırsat ve duyurular" }
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, gap: 16, paddingBottom: 0, paddingHorizontal: 20, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
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
                  <View style={{ flexDirection: "row", gap: 14 }}>
                    <View style={{ flex: 1 }}><DeskField label="Yeni şifre (en az 8 karakter)" value={pwNew} onChangeText={setPwNew} icon="lock-reset" secure /></View>
                    <View style={{ flex: 1 }}><DeskField label="Yeni şifre (tekrar)" value={pwNew2} onChangeText={setPwNew2} icon="lock-check-outline" secure /></View>
                  </View>
                  <Pressable disabled={pwSaving} onPress={() => void changePassword()} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, opacity: pwSaving ? 0.6 : 1, paddingHorizontal: 22, paddingVertical: 12 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{pwSaving ? "Güncelleniyor…" : "Şifreyi güncelle"}</Text>
                  </Pressable>
                </View>
                <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 22 }}>
                  <ToggleRow label="İki adımlı doğrulama (2FA)" sub="Girişte SMS ile ek güvenlik kodu" on={twoFA} onPress={() => setTwoFA((v) => !v)} />
                  <View style={{ backgroundColor: colors.line, height: 1 }} />
                  <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>Aktif oturumlar</Text>
                  <SessionRow icon="laptop" device="Windows · Chrome" meta="İstanbul · Şu an aktif" current />
                  <SessionRow icon="cellphone" device="iPhone · Ortaksat App" meta="İstanbul · 2 saat önce" />
                </View>
              </View>
            ) : null}

            {section === "notifications" ? (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 22 }}>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Bildirim Tercihleri</Text>
                {notifRows.map((r, i) => (
                  <View key={r.key} style={{ borderTopColor: colors.line, borderTopWidth: i === 0 ? 0 : 1, paddingTop: i === 0 ? 0 : 14 }}>
                    <ToggleRow label={r.label} sub={r.sub} on={notif[r.key]} onPress={() => setNotif((s) => ({ ...s, [r.key]: !s[r.key] }))} />
                  </View>
                ))}
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
                <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 22 }}>
                  <ToggleRow label="Ortak başvurularını otomatik onayla" sub="Yeni ortak satıcılar onay beklemeden başlasın" on={storePrefs.autoApprove} onPress={() => setStorePrefs((s) => ({ ...s, autoApprove: !s.autoApprove }))} />
                  <View style={{ backgroundColor: colors.line, height: 1 }} />
                  <ToggleRow label="Telefon numaramı ilanlarda göster" sub="Alıcılar doğrudan arayabilsin" on={storePrefs.showPhone} onPress={() => setStorePrefs((s) => ({ ...s, showPhone: !s.showPhone }))} />
                  <View style={{ backgroundColor: colors.line, height: 1 }} />
                  <ToggleRow label="Tatil modu" sub="İlanların geçici olarak pasife alınır" on={storePrefs.vacation} onPress={() => setStorePrefs((s) => ({ ...s, vacation: !s.vacation }))} />
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
                    {v.done ? (
                      <View style={{ backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><Text style={{ color: colors.success, fontSize: 12, fontWeight: "800" }}>Onaylı</Text></View>
                    ) : (
                      <Pressable style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 }}><Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" }}>Doğrula</Text></Pressable>
                    )}
                  </View>
                ))}
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

        <WebFooter />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
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
      </ScrollView>
    </KeyboardAvoidingView>
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

function SessionRow({ current, device, icon, meta }: { current?: boolean; device: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; meta: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
      <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.primaryDark} />
      </View>
      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{device}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{meta}</Text>
      </View>
      {current ? (
        <View style={{ backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: colors.success, fontSize: 11.5, fontWeight: "800" }}>Bu cihaz</Text></View>
      ) : (
        <Pressable><Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "800" }}>Çıkış yap</Text></Pressable>
      )}
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
