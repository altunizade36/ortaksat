import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { Card, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { uploadProfileAvatar } from "@/lib/live-service";
import { useStore } from "@/lib/use-store";

function isImageAvatar(value: string) {
  return value.startsWith("http") || value.startsWith("file");
}

export default function ProfileEditScreen() {
  const { language } = useLanguage();
  const router = useRouter();
  const { authError, backendMode, currentUser, updateProfile } = useStore();
  const isLiveAccount = backendMode === "supabase" && currentUser.id.includes("-");
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [bio, setBio] = useState(currentUser.bio);
  const [saving, setSaving] = useState(false);

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
