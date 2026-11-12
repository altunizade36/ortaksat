import { Children, isValidElement, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

type IconName = keyof typeof Icon.glyphMap;

/** `badge` = bu sekmede uygulanmış filtre sayısı (sekme başlığında nokta gösterir). */
type SectionProps = { id: string; label: string; badge?: number; children: ReactNode };
export function CompactFilterSection({ children }: SectionProps) { return <>{children}</>; }

/** Panel içeriği için ortak üst sınır: tablette saçma genişlemesin. */
const PANEL_MAX_WIDTH = 720;
const TOUCH = 44;

/**
 * One inline group at a time keeps results close, including on short phones.
 * Gövde kendi içinde kayar; alt eylem çubuğu (Temizle + sonuç butonu) her zaman görünür.
 */
export function CompactFilterPanel({ children, onClear, onClose, resultLabel, activeCount }: {
  children: ReactNode; onClear: () => void; onClose: () => void; resultLabel: string;
  /** Uygulanmış filtre sayısı; verilirse başlıkta rozet gösterilir ve 0 iken "Temizle" soluklaşır. */
  activeCount?: number;
}) {
  const [selected, setSelected] = useState("price");
  const { height } = useWindowDimensions();
  const { language } = useLanguage();
  const tr = (copy: string) => translateCopy(copy, language);
  const sections = Children.toArray(children).filter(isValidElement<SectionProps>);
  const active = sections.find(section => section.props.id === selected) ?? sections[0];
  const clearDisabled = activeCount === 0;
  return <View testID="compact-filter-panel" style={{ width: "100%", maxWidth: PANEL_MAX_WIDTH, alignSelf: "center", minWidth: 0, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.surface, overflow: "hidden" }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 16, paddingRight: 4, minHeight: 48 }}>
      <Icon name="tune-variant" size={18} color={colors.primary}/>
      <Text numberOfLines={1} style={{ flexShrink: 1, minWidth: 0, color: colors.ink, fontSize: 15, fontWeight: "700" }}>{tr("İlanları filtrele")}</Text>
      {activeCount ? <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.surface, fontSize: 11, fontWeight: "700" }}>{activeCount}</Text></View> : null}
      <View style={{ flex: 1 }}/>
      <Pressable accessibilityRole="button" accessibilityLabel={tr("Filtreyi kapat")} onPress={onClose} style={{ width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" }}><Icon name="close" size={20} color={colors.muted}/></Pressable>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderTopWidth: 1, borderTopColor: colors.line }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 8 }}>
      {sections.map(section => {
        const on = active?.props.id === section.props.id;
        return <Pressable key={section.props.id} accessibilityRole="button" accessibilityLabel={tr(`${section.props.label} filtresi`)} accessibilityState={{ selected: on }} onPress={() => setSelected(section.props.id)} style={{ flexGrow: 1, minHeight: TOUCH, paddingHorizontal: 8, flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: on ? colors.primary : "transparent" }}>
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: on ? "700" : "600", color: on ? colors.primary : colors.muted }}>{tr(section.props.label)}</Text>
          {section.props.badge ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }}/> : null}
        </Pressable>;
      })}
    </ScrollView>
    <ScrollView key={active?.props.id} nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: Math.min(340, Math.max(176, height * 0.4)), flexGrow: 0, borderTopWidth: 1, borderTopColor: colors.line }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      {active?.props.children}
    </ScrollView>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={tr("Filtreleri temizle")} accessibilityState={{ disabled: clearDisabled }} disabled={clearDisabled} onPress={onClear} style={({ pressed }) => ({ minHeight: TOUCH, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", opacity: clearDisabled ? 0.5 : pressed ? 0.7 : 1 })}>
        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "600" }}>{tr("Temizle")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={resultLabel} onPress={onClose} style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: TOUCH, backgroundColor: colors.primary, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, opacity: pressed ? 0.85 : 1 })}>
        <Text numberOfLines={1} style={{ color: colors.surface, fontSize: 14, fontWeight: "700" }}>{resultLabel}</Text>
      </Pressable>
    </View>
  </View>;
}

/** Başlıklı filtre grubu. `divided` = üstte ince ayırıcı (aynı sekmedeki 2.+ gruplar için). */
export function FilterGroup({ title, divided, children }: { title?: string; divided?: boolean; children: ReactNode }) {
  return <View style={[{ gap: 8, minWidth: 0 }, divided ? { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 } : null]}>
    {title ? <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{title}</Text> : null}
    {children}
  </View>;
}

export type FilterOption = { key: string; label: string; icon?: IconName; active: boolean; onPress: () => void };

/** Tek-seçimli kısa seçenekler: satırı EŞİT bölen bitişik segmentler (sarkma/kırpma yok). */
export function FilterSegments({ options }: { options: FilterOption[] }) {
  return <View style={{ flexDirection: "row", minWidth: 0, borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: "hidden", backgroundColor: colors.surface }}>
    {options.map((option, index) => <Pressable key={option.key} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: option.active }} onPress={option.onPress} style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: 4, flexDirection: "row", gap: 3, alignItems: "center", justifyContent: "center", borderLeftWidth: index > 0 ? 1 : 0, borderLeftColor: colors.line, backgroundColor: option.active ? colors.primary : colors.surface, opacity: pressed ? 0.8 : 1 })}>
      {option.icon ? <Icon name={option.icon} size={13} color={option.active ? colors.surface : colors.muted}/> : null}
      <Text numberOfLines={1} style={{ flexShrink: 1, color: option.active ? colors.surface : colors.ink, fontSize: 13, fontWeight: option.active ? "700" : "600" }}>{option.label}</Text>
    </Pressable>)}
  </View>;
}

/** Uzun etiketli seçenekler: ölçülen genişliğe göre 2–4 EŞİT sütun; metin gerekirse 2 satıra iner. */
export function FilterOptionGrid({ options, minColumnWidth = 128 }: { options: FilterOption[]; minColumnWidth?: number }) {
  const [width, setWidth] = useState(0);
  const gap = 8;
  const columns = width ? Math.max(2, Math.min(4, Math.floor((width + gap) / (minColumnWidth + gap)))) : 2;
  const cell = width ? Math.floor((width - gap * (columns - 1)) / columns) : undefined;
  return <View onLayout={event => { const next = Math.round(event.nativeEvent.layout.width); if (next !== width) setWidth(next); }} style={{ flexDirection: "row", flexWrap: "wrap", gap, minWidth: 0 }}>
    {options.map(option => <Pressable key={option.key} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: option.active }} onPress={option.onPress} style={({ pressed }) => ({ width: cell ?? "48%", minHeight: 40, paddingHorizontal: 8, paddingVertical: 6, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 10, borderColor: option.active ? colors.primary : colors.line, backgroundColor: option.active ? colors.primarySoft : colors.surface, opacity: pressed ? 0.8 : 1 })}>
      {option.icon ? <Icon name={option.icon} size={15} color={option.active ? colors.primary : colors.muted}/> : null}
      <Text numberOfLines={2} style={{ flexShrink: 1, textAlign: "center", color: option.active ? colors.primary : colors.ink, fontSize: 13, lineHeight: 16, fontWeight: option.active ? "700" : "600" }}>{option.label}</Text>
    </Pressable>)}
  </View>;
}

/** Aç/kapa filtre satırı (onay kutulu, tam genişlik). */
export function FilterToggleRow({ label, icon, active, onPress, divided }: { label: string; icon?: IconName; active: boolean; onPress: () => void; divided?: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: active }} onPress={onPress} style={({ pressed }) => ({ minHeight: TOUCH, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0, borderTopWidth: divided ? 1 : 0, borderTopColor: colors.line, opacity: pressed ? 0.7 : 1 })}>
    {icon ? <Icon name={icon} size={18} color={active ? colors.primary : colors.muted}/> : null}
    <Text style={{ flex: 1, minWidth: 0, color: colors.ink, fontSize: 14, fontWeight: active ? "700" : "500" }}>{label}</Text>
    {active ? <Icon name="checkbox-marked" size={22} color={colors.primary}/> : <Icon name="checkbox-blank-outline" size={22} color={colors.subtle}/>}
  </Pressable>;
}
