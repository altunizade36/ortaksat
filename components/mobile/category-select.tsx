import { resolveCategoryPath } from "@/lib/category-path";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { useStore } from "@/lib/use-store";
import { searchKey } from "@/lib/locale";
import { searchCategoryPaths } from "@/lib/mobile-catalog";
import type { CategoryNode } from "@/lib/category-tree";
import { MobileButton, mobile, ms, useMobileLayout } from "./ui";

export function MobileCategorySelect({ visible, initial, onClose, onSelect, leafOnly = false }: { visible: boolean; initial: CategoryNode[]; onClose: () => void; onSelect: (path: CategoryNode[]) => void; leafOnly?: boolean }) {
  const { categoryTree } = useStore();
  const { insets, tablet } = useMobileLayout();
  const initialTrail = () => {
    const path = resolveCategoryPath(categoryTree, initial);
    return path.length && !path[path.length - 1].children?.length ? path.slice(0, -1) : path;
  };
  const [trail, setTrail] = useState<CategoryNode[]>(initialTrail);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(60);
  const initialKey = initial.map(n => n.key).join("/");
  useEffect(() => {
    if (!visible) return;
    setTrail(initialTrail());
    setQuery(""); setLimit(60);
    // Keys identify the initial path; reopening must discard cancelled navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialKey]);
  const current = trail[trail.length - 1];
  const nodes = (current?.children ?? categoryTree).filter((n) => searchKey(n.label).includes(searchKey(query)));
  const matches = useMemo(() => searchCategoryPaths(categoryTree, query), [categoryTree, query]);
  function back() { if (query) setQuery(""); else if (trail.length) setTrail(p => p.slice(0, -1)); else onClose(); }
  function select(path: CategoryNode[]) { onSelect(path); setQuery(""); onClose(); }
  return <Modal visible={visible} animationType="slide" onRequestClose={back}>
    <View style={{ flex: 1, backgroundColor: mobile.canvas, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={[ms.row, { padding: 12 }]}><Pressable accessibilityRole="button" accessibilityLabel="Önceki kategori" onPress={back} style={ms.iconButton}><Icon name="chevron-left" size={27} color={mobile.ink} /></Pressable><Text style={[ms.section, { flex: 1 }]}>Kategori seç</Text><Pressable accessibilityRole="button" onPress={onClose}><Text style={{ color: mobile.teal }}>Kapat</Text></Pressable></View>
      <View style={{ paddingHorizontal: 16, gap: 10, flex: 1, width: "100%", maxWidth: tablet ? 760 : undefined, alignSelf: "center" }}>
        <Text style={ms.muted}>{trail.map((n) => n.label).join(" / ") || "Tüm kategoriler"}</Text>
        <TextInput accessibilityLabel="Kategorilerde ara" value={query} onChangeText={v => { setQuery(v); setLimit(60); }} placeholder="Tüm alt kategorilerde ara..." style={ms.input} />
        <ScrollView keyboardShouldPersistTaps="handled">{(query.trim() ? matches.slice(0, limit) : nodes.map(n => [...trail, n])).map(path => {
          const node = path[path.length - 1];
          return <Pressable key={path.map(n => n.key).join("/")} accessibilityRole="button" accessibilityLabel={path.map(n => n.label).join(" / ")} onPress={() => { if (node.children?.length) { setTrail(path); setQuery(""); } else select(path); }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 53, borderBottomWidth: 1, borderColor: mobile.line, padding: 8 }}><View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: mobile.ink }}>{node.label}</Text>{query.trim() && path.length > 1 ? <Text style={[ms.muted, { fontSize: 10 }]}>{path.slice(0, -1).map(n => n.label).join(" / ")}</Text> : null}</View><Icon name="chevron-right" size={20} color={mobile.muted} /></Pressable>;
        })}{query.trim() && matches.length > limit ? <MobileButton secondary onPress={() => setLimit(v => v + 60)}>Diğer kategorileri göster</MobileButton> : null}{query.trim() && !matches.length ? <Text style={[ms.muted, { padding: 20 }]}>Bu aramada kategori bulunamadı.</Text> : null}</ScrollView>
        {!leafOnly && <MobileButton onPress={() => select(trail)}>{trail.length ? "Bu kategoriyi seç" : "Tüm ilanları göster"}</MobileButton>}
      </View>
    </View>
  </Modal>;
}
