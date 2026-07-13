import { MaterialCommunityIcons } from "@/components/icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { LEGAL_DOCS, LEGAL_GROUPS } from "@/lib/legal-content";
import { useIsWideWeb } from "@/lib/layout";

/**
 * Sahibinden benzeri gruplu hukuki belge kütüphanesi: solda kategoriler + belgeler
 * (Sözleşmeler / Kurallar ve Politikalar / KVKK / Çerez), sağda seçilen belgenin
 * tam metni. Tek kaynak: lib/legal-content (LEGAL_DOCS + LEGAL_GROUPS).
 * Mobilde menü üstte, belge altında; masaüstünde iki sütun.
 */
export function LegalLibrary({ initialKey }: { initialKey?: string }) {
  const isWideWeb = useIsWideWeb();
  const [activeKey, setActiveKey] = useState<string>(initialKey && LEGAL_DOCS[initialKey] ? initialKey : "hesap");
  const doc = LEGAL_DOCS[activeKey];

  const menu = (
    <View style={{ gap: 16 }}>
      {LEGAL_GROUPS.map((group) => (
        <View key={group.title} style={{ gap: 6 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 7, paddingHorizontal: 4 }}>
            <MaterialCommunityIcons name={group.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={15} color={colors.primaryDark} />
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" }}>{group.title}</Text>
          </View>
          {group.keys.map((k) => {
            const d = LEGAL_DOCS[k];
            if (!d) return null;
            const on = activeKey === k;
            return (
              <Pressable
                key={k}
                onPress={() => setActiveKey(k)}
                style={{ alignItems: "center", backgroundColor: on ? colors.primarySoft : "transparent", borderRadius: 9, flexDirection: "row", gap: 8, paddingHorizontal: 10, paddingVertical: 9 }}
              >
                <View style={{ backgroundColor: on ? colors.primary : colors.line, borderRadius: 999, height: 6, width: 6 }} />
                <Text style={{ color: on ? colors.primaryDark : colors.ink, flex: 1, fontSize: 13, fontWeight: on ? "900" : "600" }}>{d.title}</Text>
                {on ? <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primaryDark} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );

  const reader = (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: isWideWeb ? 26 : 18 }}>
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: colors.ink, fontSize: isWideWeb ? 22 : 19, fontWeight: "900" }}>{doc.title}</Text>
        <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "700" }}>Son güncelleme: {doc.updated}</Text>
      </View>
      <Text selectable style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", lineHeight: 21 }}>{doc.intro}</Text>
      <View style={{ backgroundColor: colors.line, height: 1 }} />
      {doc.sections.map((s) => (
        <View key={s.heading} style={{ gap: 7 }}>
          <Text selectable style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>{s.heading}</Text>
          {s.body.map((p, i) => (
            <View key={i} style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
              <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: 5, marginTop: 8, width: 5 }} />
              <Text selectable style={{ color: colors.muted, flex: 1, fontSize: 13, fontWeight: "500", lineHeight: 20 }}>{p}</Text>
            </View>
          ))}
        </View>
      ))}
      <View style={{ alignItems: "flex-start", backgroundColor: colors.surfaceAlt, borderRadius: 10, flexDirection: "row", gap: 8, marginTop: 4, padding: 12 }}>
        <MaterialCommunityIcons name="information-outline" size={16} color={colors.muted} style={{ marginTop: 1 }} />
        <Text style={{ color: colors.subtle, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 17 }}>
          Bu metinler bilgilendirme amaçlıdır ve hukuki tavsiye niteliği taşımaz. OrtakSat bir aracı platformdur; ödeme, komisyon ve teslimat işlemlerinin tarafı değildir.
        </Text>
      </View>
    </View>
  );

  if (isWideWeb) {
    return (
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, padding: 14, width: 280 }}>{menu}</View>
        <View style={{ flex: 1, minWidth: 0 }}>{reader}</View>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, padding: 14 }}>{menu}</View>
      {reader}
    </View>
  );
}
