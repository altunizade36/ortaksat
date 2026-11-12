import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { InformationPage } from "@/components/information-page";
import { colors } from "@/components/colors";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { searchKey } from "@/lib/locale";

export type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };
export function LegalDoc({ title, path, updated, intro, sections, seoDescription }: {
  title: string; path: string; updated: string; intro: string; sections: LegalSection[]; seoDescription: string;
}) {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<string | null>(null);
  const needle = searchKey(query).trim();
  const shown = sections.filter(s => (!section || s.heading === section) && (!needle || searchKey([s.heading, ...s.paragraphs, ...(s.bullets || [])].join(" ")).includes(needle)));
  return <InformationPage title={title} intro={intro || seoDescription} path={path} icon="shield-check-outline">
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: colors.muted, fontSize: 12 }}>Son güncelleme: {updated}</Text><Text style={{ color: colors.primaryDark, fontSize: 12 }}>{sections.length} bölüm · {Math.max(1, Math.ceil(sections.map(s => [...s.paragraphs, ...(s.bullets || [])].join(" ")).join(" ").split(/\s+/).length / 200))} dk okuma</Text></View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "white", paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12 }}><Icon name="magnify" size={21} color={colors.muted} /><TextInput accessibilityLabel="Belgede ara" placeholder="Belgede ara…" value={query} onChangeText={setQuery} style={{ flex: 1, minHeight: 48, fontSize: 14, color: colors.ink }} />{query && <Pressable accessibilityRole="button" accessibilityLabel="Belge aramasını temizle" onPress={() => setQuery("")} style={{ padding: 12 }}><Icon name="close" size={18} color={colors.muted} /></Pressable>}</View>
    <View style={{ gap: 8 }}><Text style={{ color: colors.ink, fontSize: 15, fontWeight: "800" }}>Bölümlere göz at</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}><Pressable accessibilityRole="button" accessibilityState={{ selected: !section }} onPress={() => setSection(null)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 10, backgroundColor: !section ? colors.primarySoft : "white", borderWidth: 1, borderColor: colors.line }}><Text style={{ color: colors.primaryDark, fontSize: 12 }}>Tüm bölümler</Text></Pressable>{sections.map((s, i) => <Pressable key={s.heading} accessibilityRole="button" accessibilityState={{ selected: section === s.heading }} onPress={() => setSection(section === s.heading ? null : s.heading)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, maxWidth: "100%", borderWidth: 1, borderColor: section === s.heading ? colors.primary : colors.line, borderRadius: 10, backgroundColor: section === s.heading ? colors.primarySoft : "white" }}><Text style={{ color: colors.ink, fontSize: 12, lineHeight: 18 }}>{i + 1}. {s.heading}</Text></Pressable>)}</View></View>
    {!shown.length && <View style={{ padding: 18, backgroundColor: "white", borderRadius: 14, gap: 12 }}><Text style={{ color: colors.muted }}>Aramana uygun bölüm bulunamadı.</Text><Pressable accessibilityRole="button" onPress={() => { setQuery(""); setSection(null); }} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.primaryDark, fontWeight: "700" }}>Tüm metni göster</Text></Pressable></View>}
    {shown.map(s => <View key={s.heading} style={{ backgroundColor: "white", borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 12 }}><Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 18, fontWeight: "800", lineHeight: 25 }}>{sections.indexOf(s) + 1}. {s.heading}</Text>{s.paragraphs.map((p, i) => <Text selectable key={i} style={{ color: colors.muted, fontSize: 14, lineHeight: 23 }}>{p}</Text>)}{s.bullets?.map((b, i) => <View key={i} style={{ flexDirection: "row", gap: 9 }}><Text style={{ color: colors.primary }}>•</Text><Text selectable style={{ flex: 1, color: colors.muted, fontSize: 14, lineHeight: 23 }}>{b}</Text></View>)}</View>)}
    <View style={{ backgroundColor: colors.primarySoft, padding: 18, borderRadius: 14, gap: 8 }}><Text style={{ color: colors.ink, fontWeight: "800", fontSize: 16 }}>Soruların veya bir başvurun mu var?</Text><Text selectable style={{ color: colors.muted, lineHeight: 21 }}>{SUPPORT_EMAIL}</Text><Link href="/iletisim" asChild><Pressable accessibilityRole="link" style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.primaryDark, fontWeight: "700" }}>İletişim ve başvuru seçenekleri →</Text></Pressable></Link></View>
  </InformationPage>;
}
