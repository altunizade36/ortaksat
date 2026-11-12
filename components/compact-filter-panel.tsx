import { Children, isValidElement, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

type SectionProps = { id: string; label: string; children: ReactNode };
export function CompactFilterSection({ children }: SectionProps) { return <>{children}</>; }

/** One inline group at a time keeps results close, including on short phones. */
export function CompactFilterPanel({ children, onClear, onClose, resultLabel }: {
  children: ReactNode; onClear: () => void; onClose: () => void; resultLabel: string;
}) {
  const [selected, setSelected] = useState("price");
  const { height } = useWindowDimensions();
  const { language } = useLanguage();
  const tr = (copy: string) => translateCopy(copy, language);
  const sections = Children.toArray(children).filter(isValidElement<SectionProps>);
  const active = sections.find(section => section.props.id === selected) ?? sections[0];
  return <View testID="compact-filter-panel" style={{ width: "100%", minWidth: 0, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.surface, overflow: "hidden" }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 4 }}>
      <Icon name="tune-variant" size={18} color={colors.primaryDark}/>
      <Text style={{ flex: 1, color: colors.ink, fontSize: 14, fontWeight: "700" }}>{tr("İlanları filtrele")}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={tr("Filtreleri temizle")} onPress={onClear} style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: "center" }}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "600" }}>{tr("Temizle")}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={tr("Filtreyi kapat")} onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name="close" size={20} color={colors.muted}/></Pressable>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 10, gap: 6 }}>
      {sections.map(section => <Pressable key={section.props.id} accessibilityRole="button" accessibilityLabel={tr(`${section.props.label} filtresi`)} accessibilityState={{ selected: active?.props.id === section.props.id }} onPress={() => setSelected(section.props.id)} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: active?.props.id === section.props.id ? colors.primary : "transparent" }}><Text style={{ fontSize: 13, fontWeight: "600", color: active?.props.id === section.props.id ? colors.primaryDark : colors.muted }}>{tr(section.props.label)}</Text></Pressable>)}
    </ScrollView>
    <ScrollView key={active?.props.id} nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: Math.min(190, Math.max(100, height * 0.23)), flexGrow: 0, borderTopWidth: 1, borderTopColor: colors.line }} contentContainerStyle={{ padding: 12, gap: 12 }}>
      {active?.props.children}
    </ScrollView>
    <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 12, paddingVertical: 8 }}><Pressable accessibilityRole="button" accessibilityLabel={resultLabel} onPress={onClose} style={{ minHeight: 44, backgroundColor: colors.primaryDark, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }}><Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>{resultLabel}</Text></Pressable></View>
  </View>;
}
