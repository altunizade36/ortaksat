import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { WebContainer } from "@/components/web-container";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { searchKey } from "@/lib/locale";

type MenuGroup = {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone?: "partner";
  children: Array<{ label: string; href?: Href }>;
};

const groups: MenuGroup[] = [
  {
    title: "Ortak Satış Merkezi",
    icon: "handshake-outline",
    tone: "partner",
    children: [
      { label: "Ortak satış ilanları", href: "/(tabs)/explore" },
      { label: "Komisyon kazan", href: "/(tabs)/partner" },
      { label: "Teklif gönder", href: "/(tabs)/partner" },
      { label: "Ortaklık taleplerim", href: "/(tabs)/partner" },
      { label: "Kazançlarım", href: "/(tabs)/partner" },
      { label: "Satış takibi", href: "/(tabs)/seller" },
      { label: "Ortak satış eğitimleri", href: "/trust" },
      { label: "Davet et kazan", href: "/(tabs)/partner" }
    ]
  },
  { title: "Elektronik", icon: "cellphone-link", children: ["Telefon ve tablet", "Bilgisayar", "Ses ve görüntü", "Akıllı saat"].map((label) => ({ label })) },
  { title: "Ev ve Yaşam", icon: "home-variant-outline", children: ["Mobilya", "Beyaz eşya", "Mutfak", "Dekorasyon"].map((label) => ({ label })) },
  { title: "Moda", icon: "hanger", children: ["Ayakkabı", "Kozmetik", "Çanta", "Aksesuar"].map((label) => ({ label })) },
  { title: "Anne Bebek", icon: "baby-face-outline", children: ["Bebek bakım", "Oyuncak", "Çocuk giyim", "Okul ürünleri"].map((label) => ({ label })) },
  { title: "Spor", icon: "dumbbell", children: ["Fitness", "Outdoor", "Bisiklet", "Takım sporları"].map((label) => ({ label })) },
  { title: "Otomotiv", icon: "car-outline", children: ["Araç aksesuar", "Yedek parça", "Motosiklet", "Lastik"].map((label) => ({ label })) },
  { title: "Evcil Hayvan", icon: "paw-outline", children: ["Mama", "Bakım", "Oyuncak", "Aksesuar"].map((label) => ({ label })) },
  { title: "Kitap", icon: "book-open-page-variant-outline", children: ["Roman", "Eğitim", "Çocuk kitabı", "Dergi"].map((label) => ({ label })) },
  { title: "Hobi", icon: "palette-outline", children: ["Koleksiyon", "El işi", "Müzik ekipmanı", "Dijital oyun"].map((label) => ({ label })) },
  { title: "Bahçe", icon: "flower-outline", children: ["Bahçe mobilyası", "Bitki", "Sulama", "Bahçe aleti"].map((label) => ({ label })) },
  { title: "Endüstriyel Ürünler", icon: "factory", children: ["Makine", "Hırdavat", "Paketleme", "Toptan ürün"].map((label) => ({ label })) },
  { title: "Hizmetler", icon: "briefcase-outline", children: ["Temizlik", "Tamir", "Danışmanlık", "Etkinlik"].map((label) => ({ label })) },
  { title: "Emlak", icon: "office-building-outline", children: ["Konut", "İşyeri", "Arsa", "Kiralık"].map((label) => ({ label })) },
  { title: "Araç", icon: "car-multiple", children: ["Otomobil", "Ticari araç", "Kiralama", "Karavan"].map((label) => ({ label })) },
  { title: "İş Makinesi", icon: "excavator", children: ["Forklift", "Ekskavatör", "Vinç", "Kiralık makine"].map((label) => ({ label })) },
  { title: "İkinci El", icon: "recycle-variant", children: ["Elektronik", "Ev eşyası", "Giyim", "Yenilenmiş ürün"].map((label) => ({ label })) },
  { title: "Dijital Ürünler", icon: "cloud-outline", children: ["E-kitap", "Tasarım", "Yazılım", "Dijital eğitim"].map((label) => ({ label })) }
];

export default function MenuScreen() {
  const { language } = useLanguage();
  const [open, setOpen] = useState<string>("Ortak Satış Merkezi");
  const [query, setQuery] = useState("");
  const tokens = searchKey(query).split(" ").filter(Boolean);
  const visibleGroups = useMemo(() => {
    if (tokens.length === 0) return groups;
    return groups
      .map((group) => {
        const groupText = `${group.title} ${translateCopy(group.title, language)}`;
        const groupMatch = tokens.every((token) => searchKey(groupText).includes(token));
        const children = group.children.filter((child) => tokens.every((token) => searchKey(`${group.title} ${child.label} ${translateCopy(group.title, language)} ${translateCopy(child.label, language)}`).includes(token)));
        return groupMatch ? group : { ...group, children };
      })
      .filter((group) => group.children.length > 0 || tokens.every((token) => searchKey(`${group.title} ${translateCopy(group.title, language)}`).includes(token)));
  }, [language, tokens]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ backgroundColor: "#FFFFFF", gap: 8, padding: 12, paddingBottom: 108 }}>
      <WebContainer max={1000} padding={0} style={{ gap: 8 }}>
      <View style={{ gap: 8, marginBottom: 4 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>
          {translateCopy("Kategoriler ve Ortak Satış", language)}
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700", lineHeight: 18 }}>
          {translateCopy("Ürün bul, ortak satış merkeziyle kazanç ve başvurularına hızlı ulaş.", language)}
        </Text>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderRadius: 18,
            borderWidth: 1,
            flexDirection: "row",
            gap: 8,
            minHeight: 50,
            paddingHorizontal: 12
          }}
        >
          <MaterialCommunityIcons name="magnify" size={22} color={colors.primary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={translateCopy("Kategori, ürün veya ortak satış ara", language)}
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "700", minHeight: 48 }}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Aramayı temizle">
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {visibleGroups.length === 0 ? (
        <View style={{ alignItems: "center", gap: 8, padding: 28 }}>
          <MaterialCommunityIcons name="text-search" size={34} color={colors.primary} />
          <Text selectable style={{ color: colors.ink, fontSize: 17, fontWeight: "900", textAlign: "center" }}>
            {translateCopy("Sonuç bulunamadı", language)}
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700", lineHeight: 19, textAlign: "center" }}>
            {translateCopy("Farklı bir kategori veya ürün adıyla tekrar ara.", language)}
          </Text>
        </View>
      ) : null}

      {visibleGroups.map((group) => (
        <AccordionCard key={group.title} expanded={open === group.title} group={group} language={language} onPress={() => setOpen(open === group.title ? "" : group.title)} />
      ))}
      </WebContainer>
    </ScrollView>
  );
}

function AccordionCard({ expanded, group, language, onPress }: { expanded: boolean; group: MenuGroup; language: "tr" | "en"; onPress: () => void }) {
  const isPartner = group.tone === "partner";

  return (
    <View style={{ backgroundColor: "#FFFFFF", borderColor: expanded ? colors.primary : "#C8D4DC", borderRadius: 14, borderWidth: expanded ? 1.5 : 1, overflow: "hidden" }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: isPartner ? colors.primarySoft : "#FFFFFF",
          flexDirection: "row",
          gap: 12,
          minHeight: 52,
          opacity: pressed ? 0.72 : 1,
          paddingHorizontal: 10,
          paddingVertical: 7
        })}
      >
        <View style={{ alignItems: "center", backgroundColor: isPartner ? "#FFFFFF" : "#F1F7F6", borderRadius: 11, height: 38, justifyContent: "center", width: 38 }}>
          <MaterialCommunityIcons name={group.icon} size={23} color={isPartner ? colors.primary : colors.primaryDark} />
        </View>
        <Text selectable numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "800" }}>
          {translateCopy(group.title, language)}
        </Text>
        <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={23} color={colors.primaryDark} />
      </Pressable>
      {expanded ? (
        <View style={{ borderTopColor: colors.line, borderTopWidth: 1, paddingBottom: 6, paddingHorizontal: 10, paddingTop: 2 }}>
          {group.children.map((child) => (
            <SubItem key={child.label} item={child} language={language} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SubItem({ item, language }: { item: { label: string; href?: Href }; language: "tr" | "en" }) {
  const row = (
    <Pressable style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 8, minHeight: 40, opacity: pressed ? 0.7 : 1 })}>
      <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primary} />
      <Text selectable numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>
        {translateCopy(item.label, language)}
      </Text>
    </Pressable>
  );

  if (!item.href) return row;

  return (
    <Link href={item.href} asChild>
      {row}
    </Link>
  );
}
