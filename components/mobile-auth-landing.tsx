import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance, type ViewInstance } from "react-native";
import { useContentWidth } from "@/lib/layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MobileBrand } from "@/components/mobile-brand";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { translateCopy, useLanguage } from "@/lib/i18n";

type Props = {
  mode: "login" | "register";
  onModeChange: (mode: "login" | "register") => void;
  onEmail: () => void;
  onGoogle: () => void;
  onApple?: () => void;
  onSkip: () => void;
  consent: ReactNode;
  accepted: boolean;
  busy: boolean;
  error?: string | null;
  form?: ReactNode;
  formTitle?: string;
  onBack?: () => void;
  showTabs?: boolean;
};
const messages = ["Ürününü paylaş, ortak bul,", "Ücretsiz ilan ver, birlikte sat,", "Ortak ol, paylaş, kazan,"];

// iOS SOSYAL GİRİŞ. App Store kuralı 4.8: üçüncü taraf girişi (Google) sunan iOS uygulaması
// "Apple ile Giriş"i de sunmak ZORUNDA → iOS'ta ikisi BİRLİKTE gösterilir, Apple düğmesi üstte.
// Apple girişi yalnız iOS'ta vardır (yerel pencere): iOS'ta Apple ve Google YAN YANA iki eşit düğmedir,
// Android'de yalnız Google (tam genişlik) görünür. Çalışmayan "Yakında" düğmeleri mağaza incelemesinde
// ret sebebidir; ekleme.
const appleLogin = Platform.OS === "ios";
const socialLogin = true;

export function MobileAuthLanding({ mode, onModeChange, onEmail, onGoogle, onApple, onSkip, consent, accepted, busy, error, form, formTitle, onBack, showTabs = true }: Props) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const consentRef = useRef<ViewInstance>(null);
  const scrollY = useRef(0);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const contentWidth = useContentWidth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // SSG and the first client render share the same geometry.
  const width = mounted ? contentWidth : 390;
  const { language } = useLanguage();
  const tr = (copy: string) => translateCopy(copy, language);
  const [slide, setSlide] = useState(0);
  const tablet = width >= 960;
  const sceneWidth = tablet ? width * 0.52 : width;
  // Keep native hero geometry stable when Android reduces the window for the IME.
  const nativeViewport = useRef({ width, height });
  if (nativeViewport.current.width !== width) nativeViewport.current = { width, height };
  else nativeViewport.current.height = Math.max(nativeViewport.current.height, height);
  const compactNative = Platform.OS !== "web" && !tablet && nativeViewport.current.height < 760;
  const sceneHeight = Platform.OS !== "web" && !tablet
    ? form ? 180 : Math.max(300, Math.min(400, width * 1.02, nativeViewport.current.height * 0.44))
    : form ? 150 : Math.max(340, Math.min(480, width * 1.12));
  function showConsentIfMissing() {
    if (!accepted) consentRef.current?.measureInWindow((_x, y) => {
      scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + y - insets.top - 20), animated: true });
    });
  }
  function continueWithGoogle() {
    showConsentIfMissing();
    onGoogle();
  }
  function continueWithApple() {
    showConsentIfMissing();
    onApple?.();
  }
  // SOSYAL GİRİŞ DÜĞMELERİ: iOS'ta Apple (siyah) + Google (beyaz) yan yana; Android'de yalnız Google.
  const socialButtons = <View style={{ flexDirection: "row", gap: 10 }}>
    {appleLogin ? <Pressable accessibilityRole="button" accessibilityLabel={tr("Apple ile devam et")} disabled={busy} accessibilityState={{ disabled: busy, busy }} onPress={continueWithApple} style={[s.button, s.apple, s.half, { opacity: busy ? 0.6 : 1 }]}><Icon name="apple" size={24} color="white" /><Text style={[s.buttonText, { color: "white" }]}>Apple</Text></Pressable> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={tr("Google ile devam et")} disabled={busy} accessibilityState={{ disabled: busy, busy }} onPress={continueWithGoogle} style={[s.button, s.half, { opacity: busy ? 0.6 : 1 }]}><GoogleMark /><Text style={s.buttonText}>{appleLogin ? "Google" : tr(busy ? "Bağlanıyor…" : "Google ile devam et")}</Text></Pressable>
  </View>;
  return <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScroll={event => { scrollY.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} style={s.screen} contentContainerStyle={{ flexGrow: 1 }}>
    <View testID="auth-responsive-frame" style={{ flexGrow: 1, width: "100%", maxWidth: 1440, alignSelf: "center", flexDirection: tablet ? "row" : "column", minHeight: tablet ? Math.max(height, 680) : undefined }}>
    <View testID="auth-scene" style={{ ...(tablet ? { width: "52%", minHeight: Math.max(height, 680), alignSelf: "stretch" } : { height: sceneHeight + insets.top, width: "100%" }), overflow: "hidden" }}>

      <Image source={require("../assets/mobile/istanbul-marketplace.webp")} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={tr("İstanbul manzarası önünde otomobil, ev eşyaları ve elektronik ürünler")} />
      <LinearGradient colors={["#E7F8FF80", "#FFFFFF00"]} style={StyleSheet.absoluteFill} />
      {/* Form açıkken sahne kısalır: logo ve slogan fotoğrafın kalabalık kısmına denk gelir → okunurluk için açık örtü. */}
      {form && Platform.OS !== "web" ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFFFFB8" }]} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={tr("Geç")} disabled={busy} onPress={onSkip} style={[s.skip, { top: insets.top + 12 }]}><Text style={s.skipText}>{tr("Geç")}</Text><Icon name="chevron-right" size={23} color="#101827" /></Pressable>
      <View style={[s.intro, { paddingTop: insets.top + (tablet ? 70 : form ? 22 : compactNative ? 24 : 42) }]}>
        <MobileBrand size={Math.min(tablet ? 54 : 44, sceneWidth * 0.12)} />
        <Text style={s.slogan}>{tr("Al, Sat, Ortak Ol")}</Text>{!(Platform.OS === "web" && form && !tablet) ? <Text style={s.subSlogan}>{tr("Herkes Kazansın.")}</Text> : null}
        {!form && <View style={s.features}>
          {([{ icon: "tag", color: "#003AB3", bg: "#E5F0FFCC", text: "Ücretsiz\nİlan Ver" }, { icon: "account-group", color: "#003AB3", bg: "#DCE6F5CC", text: "Ürününü Ortak\nSatışa Aç" }, { icon: "chart-bar", color: "#7552D7", bg: "#E6DFF9CC", text: "Daha Fazla\nKişiye Ulaş" }] as const).map((f) => <View key={f.icon} style={s.feature}><View style={[s.featureIcon, { backgroundColor: f.bg }]}><Icon name={f.icon} size={29} color={f.color} /></View><Text style={s.featureText}>{tr(f.text)}</Text></View>)}
        </View>}
      </View>
      {(!form && !compactNative) || tablet ? <><View style={s.message}><View style={s.messageIcon}><Icon name="trending-up" size={24} color="white" /></View><Text style={s.messageText}>{tr(messages[slide])}{"\n"}<Text style={{ color: "#0039B1", fontWeight: "800" }}>{tr("daha fazla kişiye ulaş.")}</Text></Text></View>
      <View style={s.dots}>{messages.map((_, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${tr("Tanıtım")} ${i + 1}`} accessibilityState={{ selected: i === slide }} hitSlop={9} onPress={() => setSlide(i)} style={[s.dot, i === slide && { backgroundColor: "#003BB3" }]} />)}</View></> : null}
    </View>
    <View testID="auth-panel" style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 24) }, tablet && { flex: 1, minWidth: 0, justifyContent: "center", marginTop: 0, borderRadius: 0, paddingHorizontal: 40, paddingVertical: 48 }]}>
      <View testID="auth-panel-content" style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
      {form && onBack ? <Pressable accessibilityRole="button" accessibilityLabel={tr(Platform.OS === "web" ? "Girişe dön" : "Diğer giriş seçenekleri")} disabled={busy} onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44, alignSelf: "flex-start", marginBottom: 8 }}><Icon name="chevron-left" size={21} color="#002D92"/><Text style={{ fontSize: 13, color: "#002D92", fontWeight: "600" }}>{tr(Platform.OS === "web" ? "Girişe dön" : "Diğer giriş seçenekleri")}</Text></Pressable> : null}
      <Text accessibilityRole="header" style={s.title}>{tr(formTitle || (mode === "register" ? "Aramıza katıl" : "OrtakSat’a hoş geldin"))}</Text>
      <Text style={s.subtitle}>{tr(!showTabs ? "E-posta adresini gir; şifreni yenilemek için doğrulama kodu gönderelim." : mode === "register" ? "Ücretsiz hesabını oluştur. İlan ver veya satışa katkı sağlayarak komisyon kazan." : "İlanlarını ve ortaklıklarını tek hesaptan yönet.")}</Text>
      {showTabs && <View accessibilityRole="tablist" style={s.tabs}>{(["login", "register"] as const).map((tab) => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: mode === tab }} disabled={busy} onPress={() => onModeChange(tab)} style={[s.tab, mode === tab && s.activeTab]}><Text style={[s.tabText, mode === tab && { color: "#002D92" }]}>{tr(tab === "login" ? "Giriş Yap" : "Hesap Oluştur")}</Text></Pressable>)}</View>}
      {form ? <>
        <View style={{ gap: 14 }}>{form}</View>
        {/* UYGULAMA: e-posta formunun ALTINDA Google ile devam (web'de aynı blok formun içinde çizilir). */}
        {Platform.OS !== "web" && socialLogin && showTabs ? <View style={{ marginTop: 18 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12, marginBottom: 14 }}><View style={{ backgroundColor: "#DCE6F5", flex: 1, height: 1 }} /><Text style={{ color: "#667085", fontSize: 12.5, fontWeight: "700" }}>{tr("veya")}</Text><View style={{ backgroundColor: "#DCE6F5", flex: 1, height: 1 }} /></View>
          {/* Kayıt sekmesinde yasal onay kutusu formun içindedir; giriş sekmesinde Google için burada gösterilir. */}
          {mode === "login" ? <View ref={consentRef} collapsable={false} style={{ marginBottom: 12 }}>{consent}</View> : null}
          {socialButtons}
        </View> : null}
      </> : <>
      <Pressable accessibilityRole="button" accessibilityLabel={tr("E-posta ile devam et")} disabled={busy} onPress={onEmail} style={[s.button, s.email]}><Icon name="email" size={25} color="white" /><Text style={[s.buttonText, { color: "white" }]}>{tr("E-posta ile devam et")}</Text></Pressable>
      {/* Yasal onay kutusu yalnız sosyal giriş için gerekir (e-posta kaydı onayı kendi formunda alır). */}
      {socialLogin ? <>
      <View ref={consentRef} collapsable={false} style={{ marginBottom: 14, marginTop: 3 }}>{consent}</View>
      {socialButtons}
      </> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{tr(error)}</Text> : null}
      {socialLogin && !accepted && <Text style={s.legal}>{tr("Sosyal giriş için önce yukarıdaki yasal onay kutusunu işaretle.")}</Text>}
      </>}
      <Text style={s.copyright}>© 2026 OrtakSat</Text>
      </View>
    </View>
    </View>
  </ScrollView>;
}

function GoogleMark() {
  // Four coloured segments preserve the familiar Google identity without a remote image.
  return <View style={{ width: 25, height: 25, alignItems: "center", justifyContent: "center" }}><View style={{ width: 23, height: 23, borderRadius: 12, borderWidth: 5, borderTopColor: "#EA4335", borderLeftColor: "#FBBC05", borderBottomColor: "#34A853", borderRightColor: "#4285F4", transform: [{ rotate: "-20deg" }] }} /><View style={{ position: "absolute", right: 0, top: 7, width: 10, height: 5, backgroundColor: "white" }} /><View style={{ position: "absolute", right: 1, top: 11, width: 10, height: 4, backgroundColor: "#4285F4" }} /></View>;
}

const s = StyleSheet.create({
  title: { color: "#10192C", fontSize: 26, lineHeight: 33, fontWeight: "800", marginBottom: 8 },
  subtitle: { color: "#667085", fontSize: 14, lineHeight: 21, marginBottom: 22 },
  copyright: { color: "#667085", fontSize: 11, textAlign: "center", marginTop: 24 },
  screen: { flex: 1, backgroundColor: "white" }, skip: { position: "absolute", right: 19, zIndex: 2, flexDirection: "row", alignItems: "center", minHeight: 44 }, skipText: { color: "#101827", fontSize: 14 }, intro: { alignItems: "center", paddingHorizontal: 20 }, slogan: { color: "#0F172A", fontWeight: "700", fontSize: 21, marginTop: 3 }, subSlogan: { color: "#0F172A", fontSize: 20, marginTop: 1 },
  features: { flexDirection: "row", justifyContent: "center", gap: 9, marginTop: 18 }, feature: { alignItems: "center", width: 86 }, featureIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" }, featureText: { marginTop: 5, textAlign: "center", fontSize: 12, fontWeight: "600", lineHeight: 16, color: "#101827" },
  message: { position: "absolute", bottom: 34, alignSelf: "center", backgroundColor: "#FFFFFFDE", borderRadius: 40, flexDirection: "row", gap: 11, alignItems: "center", paddingHorizontal: 19, paddingVertical: 9 }, messageIcon: { width: 31, height: 31, borderRadius: 16, backgroundColor: "#0040BB", alignItems: "center", justifyContent: "center" }, messageText: { fontSize: 13, lineHeight: 18, color: "#172033" }, dots: { position: "absolute", bottom: 18, alignSelf: "center", flexDirection: "row", gap: 9 }, dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#FFFFFFCC" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingTop: 25, marginTop: -12 }, tabs: { flexDirection: "row", marginBottom: 17, borderBottomWidth: 1, borderColor: "#DCE6F5" }, tab: { flex: 1, alignItems: "center", paddingVertical: 11, borderBottomWidth: 3, borderColor: "transparent", marginBottom: -1 }, activeTab: { borderColor: "#0645C9" }, tabText: { fontSize: 15, fontWeight: "700", color: "#667085" }, button: { borderRadius: 15, minHeight: 52, borderWidth: 1, borderColor: "#DCE6F5", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: "#FFFFFF", boxShadow: "0px 3px 8px #09275E12" }, email: { backgroundColor: "#0645C9", borderColor: "#0645C9" }, apple: { backgroundColor: "#000000", borderColor: "#000000" }, half: { flex: 1, minWidth: 0, gap: 10 }, buttonText: { fontSize: 15, fontWeight: "600", color: "#09275E" }, legal: { color: "#667085", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 8, marginBottom: 12 }, legalLink: { color: "#0645C9", fontWeight: "600" }, error: { color: "#B42318", fontSize: 12, lineHeight: 18, textAlign: "center", marginVertical: 5 },
});
