import { CompactFooter } from "@/components/compact-footer";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { OptionSheet } from "@/components/option-sheet";
import { useBackNavigation } from "@/lib/use-back-navigation";
import { useStore } from "@/lib/use-store";
import { useMobileDrawer } from "@/lib/mobile-drawer";
import { useContentWidth, useMounted } from "@/lib/layout";

// Eski `teal` alan adını geriye dönük uyumluluk için koruyoruz; değerler artık mavi marka sistemidir.
export const mobile = {
  teal: "#0645C9",
  tealSoft: "#E5F0FF",
  darkTeal: "#09275E",
  ink: "#09275E",
  muted: "#687386",
  line: "#DCE6F5",
  canvas: "#F6F9FF",
};
export type MobileIcon = keyof typeof Icon.glyphMap;
export function useMobileLayout() {
  const { width: nativeWidth, height } = useWindowDimensions();
  const contentWidth = useContentWidth();
  const mounted = useMounted();
  // Static web rendering has no viewport. Use the same initial width on server/client,
  // then update on mount instead of retaining a zero-width hydrated screen.
  const width = Platform.OS === "web" ? (mounted ? contentWidth : 390) : nativeWidth;
  const insets = useSafeAreaInsets();
  const tablet = width >= 700;
  const maxWidth = tablet ? Math.min(width - 48, 1180) : width;
  return { width, height, insets, tablet, maxWidth, padding: tablet ? 24 : 16 };
}

export function MobileScreen({ children, title, right, bottom, scroll = true, back = true, contentStyle, onBack, footer, headerShown = false, keyboardBehavior }: { children: ReactNode; title?: string; right?: ReactNode; bottom?: ReactNode; scroll?: boolean; back?: boolean; contentStyle?: StyleProp<ViewStyle>; onBack?: () => void; footer?: ReactNode; headerShown?: boolean; keyboardBehavior?: "height" | "padding" | "position" }) {
  const { insets, maxWidth } = useMobileLayout();
  return <KeyboardAvoidingView behavior={keyboardBehavior ?? (Platform.OS === "ios" ? "padding" : undefined)} style={ms.screen}>
    <Stack.Screen options={{ headerShown }} />
    {title ? <View style={{ paddingTop: insets.top, backgroundColor: mobile.canvas }}><MobileHeader title={title} right={right} back={back} onBack={onBack} /></View> : null}
    {scroll ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[{ flexGrow: 1, width: "100%", maxWidth, alignSelf: "center", paddingHorizontal: 16, paddingBottom: 0, paddingTop: title ? 4 : insets.top }, contentStyle]}>{children}{footer ?? <CompactFooter />}</ScrollView> : <View style={[{ flex: 1, width: "100%", maxWidth, alignSelf: "center" }, contentStyle]}>{children}</View>}
    {bottom}
  </KeyboardAvoidingView>;
}

export function MobileHeader({ title, subtitle, right, back = true, onBack }: { title: string; subtitle?: string; right?: ReactNode; back?: boolean; onBack?: () => void }) {
  const goBack = useBackNavigation();
  return <View style={ms.header}>
    {back ? <IconButton name="chevron-left" label="Geri" onPress={onBack || goBack} /> : <View style={{ width: 40 }} />}
    <View style={{ flex: 1, minWidth: 0, alignItems: "center" }}><Text accessibilityRole="header" accessibilityLabel={title} numberOfLines={2} ellipsizeMode="tail" style={ms.headerTitle}>{title}</Text>{subtitle ? <Text style={ms.muted}>{subtitle}</Text> : null}</View>
    <View style={{ minWidth: 40, alignItems: "flex-end" }}>{right}</View>
  </View>;
}

export function IconButton({ name, label, onPress, color = mobile.ink, style, badge }: { name: MobileIcon; label: string; onPress: () => void; color?: string; style?: StyleProp<ViewStyle>; badge?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={({ pressed }) => [ms.iconButton, { opacity: pressed ? 0.6 : 1 }, style]}><Icon name={name} size={26} color={color} />{badge && <View style={ms.badge} />}</Pressable>;
}

export function MobileButton({ children, onPress, icon, secondary, disabled, style }: { children: string; onPress: () => void; icon?: MobileIcon; secondary?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={children} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}>
    <LinearGradient colors={secondary ? ["#FFFFFF", "#F4F8FF"] : ["#075BEB", "#0645C9"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[ms.button, secondary && { borderColor: "#BBD3FA" }]}>{icon && <Icon name={icon} size={22} color={secondary ? mobile.teal : "white"} />}<Text style={[ms.buttonText, secondary && { color: mobile.teal }]}>{children}</Text></LinearGradient>
  </Pressable>;
}

export function MobileCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) { return <View style={[ms.card, style]}>{children}</View>; }
export function SectionLabel({ children, icon }: { children: string; icon?: MobileIcon }) { return <View style={{ flexDirection: "row", gap: 7, alignItems: "center", marginBottom: 10 }}>{icon && <Icon name={icon} size={22} color={mobile.ink} />}<Text style={ms.section}>{children}</Text></View>; }
export function MobileField({ label, value, onChange, placeholder, multiline, numeric, required, maxLength }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; numeric?: boolean; required?: boolean; maxLength?: number }) {
  return <View style={{ gap: 5, flex: 1 }}>
    {label && <Text style={ms.label}>{label}{required && <Text style={{ color: "#EA4D59" }}> *</Text>}</Text>}
    <TextInput accessibilityLabel={label || placeholder} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#8B93A1" multiline={multiline} maxLength={maxLength} keyboardType={numeric ? "decimal-pad" : "default"} textAlignVertical={multiline ? "top" : "center"} style={[ms.input, multiline && { minHeight: 102, paddingTop: 12 }]} />
    {multiline && maxLength && <Text style={{ textAlign: "right", color: "#9098A5", fontSize: 10 }}>{value.length}/{maxLength}</Text>}
  </View>;
}
export function MobileSelect({ label, value, placeholder = "Seçin", options, onChange, disabled }: { label?: string; value?: string; placeholder?: string; options: string[]; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 5, flex: 1 }}>
    {label && <Text style={ms.label}>{label}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={`${label || placeholder}: ${value || placeholder}`} disabled={disabled} accessibilityState={{ disabled }} onPress={() => setOpen(true)} style={[ms.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", opacity: disabled ? 0.45 : 1 }]}><Text numberOfLines={1} style={{ color: value ? mobile.ink : "#808998", fontSize: 13, flex: 1 }}>{value || placeholder}</Text><Icon name="chevron-down" size={19} color={mobile.muted} /></Pressable>
    <OptionSheet visible={open} title={label || placeholder} options={options} value={value} onSelect={(v) => { onChange(v); setOpen(false); }} onClose={() => setOpen(false)} />
  </View>;
}
export function MobileChip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: MobileIcon }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} aria-pressed={!!selected} onPress={onPress} style={[ms.chip, selected && { backgroundColor: mobile.teal, borderColor: mobile.teal }]}>{icon && <Icon name={icon} size={16} color={selected ? "white" : mobile.teal} />}<Text style={{ fontSize: 12, color: selected ? "white" : "#596174" }}>{label}</Text></Pressable>; }

export function MobileBottomNav({ active: requestedActive }: { active?: string }) {
  const pathname = usePathname();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const inferred = pathname === "/" ? "home" : /^\/(explore|kategori|kategoriler)/.test(pathname) ? "explore" : pathname.startsWith("/create") ? "create" : /^\/(partner|partnership|earnings)/.test(pathname) ? "partner" : "menu";
  const active = requestedActive && !["profile", "notifications"].includes(requestedActive) ? requestedActive : inferred;
  const router = useRouter();
  const drawer = useMobileDrawer();
  const { insets, tablet } = useMobileLayout();
  const { notifications, messages, currentUser } = useStore();
  const unread = notifications.some((n) => n.userId === currentUser.id && !n.read) || messages.some((m) => m.receiverId === currentUser.id && !m.read);
  const items: { key: string; label: string; icon: MobileIcon; href: string }[] = [
    { key: "home", label: "Ana Sayfa", icon: active === "home" ? "home" : "home-outline", href: "/" },
    { key: "explore", label: "Keşfet", icon: "compass-outline", href: "/explore" },
    { key: "create", label: "İlan Ver", icon: "plus", href: "/create" },
    { key: "partner", label: "Ortak Satış", icon: "account-group-outline", href: "/partner" },
    { key: "menu", label: "Menü", icon: "menu", href: "/menu" },
  ];
  if (keyboardOpen) return null;
  return <View testID="mobile-bottom-nav" style={[ms.nav, { paddingBottom: Math.max(4, insets.bottom), paddingHorizontal: tablet ? "12%" : 4 }]}>{items.map((item) => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: active === item.key }} onPress={() => item.key === "menu" ? drawer.open() : router.push(item.href as never)} style={ms.navItem}>
    {item.key === "create" ? <View style={ms.fab}><LinearGradient colors={["#075BEB", "#0645C9"]} style={ms.fabFill}><Icon name="plus" size={28} color="white" /></LinearGradient></View> : <View style={{ height: 27, justifyContent: "center" }}><Icon name={item.icon} size={tablet ? 27 : 24} color={active === item.key ? mobile.teal : "#152033"} />{unread && item.key === "menu" && <View style={ms.badge} />}</View>}
    <Text numberOfLines={1} style={{ color: active === item.key ? mobile.teal : "#687080", fontSize: tablet ? 11 : 9.5, lineHeight: 12, marginTop: 1, fontWeight: active === item.key ? "800" : "600" }}>{item.label}</Text>
  </Pressable>)}</View>;
}

export const ms = StyleSheet.create({
  screen: { flex: 1, backgroundColor: mobile.canvas }, header: { height: 58, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 4 }, headerTitle: { fontSize: 21, fontWeight: "800", color: mobile.ink }, muted: { fontSize: 12, color: mobile.muted, lineHeight: 18 }, iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, badge: { width: 8, height: 8, backgroundColor: "#F44257", borderRadius: 5, borderColor: "white", borderWidth: 1, position: "absolute", top: 0, right: 0 }, button: { minHeight: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderWidth: 1, borderColor: "transparent", paddingHorizontal: 12, paddingVertical: 11 }, buttonText: { color: "white", fontWeight: "700", fontSize: 14, textAlign: "center", flexShrink: 1 }, card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: mobile.line, borderRadius: 13, padding: 12, gap: 9, marginBottom: 10, boxShadow: "0px 2px 8px #09275E0A" }, section: { color: mobile.ink, fontWeight: "700", fontSize: 16 }, label: { fontSize: 12, color: "#555F72" }, input: { minHeight: 44, borderWidth: 1, borderColor: "#DCE6F5", backgroundColor: "#FCFDFF", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, color: mobile.ink, fontSize: Platform.OS === "web" ? 16 : 13 }, chip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 12, minHeight: 44, borderRadius: 9, backgroundColor: "#F2F6FC", borderWidth: 1, borderColor: mobile.line }, nav: { backgroundColor: "#FFFFFFFC", borderTopColor: "#DCE6F5", borderTopWidth: 1, flexDirection: "row", paddingTop: 4, boxShadow: "0px -2px 10px #09275E14" }, navItem: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 }, fab: { height: 46, width: 46, borderRadius: 24, borderWidth: 2, borderColor: "white", marginTop: -18, marginBottom: 0, boxShadow: "0px 3px 10px #0645C950" }, fabFill: { flex: 1, borderRadius: 23, alignItems: "center", justifyContent: "center" }, row: { flexDirection: "row", alignItems: "center", gap: 8 }, wrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, error: { color: "#C03443", fontSize: 12, lineHeight: 18, marginVertical: 8 },
});
