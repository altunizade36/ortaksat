import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { WebFooter } from "@/components/web-landing";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { useIsWideWeb } from "@/lib/layout";

export type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };

// Mağaza-uyumlu düz yasal belge sunucusu (gizlilik/şartlar/çerez). Okunur, tek sütun,
// bölümlü; başlık + son-güncelleme + Seo + footer. Sahte veri yok — gerçek politika metni.
export function LegalDoc({
  title,
  path,
  updated,
  intro,
  sections,
  seoDescription
}: {
  title: string;
  path: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  seoDescription: string;
}) {
  const isWideWeb = useIsWideWeb();
  const body = (
    <View style={{ alignSelf: "center", gap: 18, maxWidth: 820, paddingHorizontal: isWideWeb ? 20 : 14, paddingTop: 16, width: "100%" }}>
      <Seo title={`${title} | OrtakSat`} description={seoDescription} path={path} />
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Link href="/" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Ana Sayfa</Text></Pressable></Link>
        <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{title}</Text>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 48, justifyContent: "center", width: 48 }}>
            <MaterialCommunityIcons name="shield-check-outline" size={26} color={colors.primaryDark} />
          </View>
          <Text style={{ color: colors.ink, flex: 1, fontSize: isWideWeb ? 30 : 25, fontWeight: "900", lineHeight: isWideWeb ? 36 : 30 }}>{title}</Text>
        </View>
        <Text style={{ color: colors.subtle, fontSize: 12.5, fontWeight: "700" }}>Son güncelleme: {updated}</Text>
        <Text style={{ color: colors.muted, fontSize: 14.5, fontWeight: "600", lineHeight: 22 }}>{intro}</Text>
      </View>

      {sections.map((s, i) => (
        <View key={s.heading} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
          <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 8, height: 26, justifyContent: "center", minWidth: 26 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{i + 1}</Text>
            </View>
            <Text style={{ color: colors.ink, flex: 1, fontSize: 17, fontWeight: "900", lineHeight: 23 }}>{s.heading}</Text>
          </View>
          {s.paragraphs.map((p, pi) => (
            <Text key={pi} style={{ color: colors.muted, fontSize: 13.5, fontWeight: "500", lineHeight: 21 }}>{p}</Text>
          ))}
          {s.bullets ? (
            <View style={{ gap: 6, marginTop: 2 }}>
              {s.bullets.map((b, bi) => (
                <View key={bi} style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
                  <MaterialCommunityIcons name="circle-medium" size={18} color={colors.primary} style={{ marginTop: 1 }} />
                  <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>{b}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}

      <View style={{ alignItems: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 14, flexDirection: "row", gap: 10, padding: 16 }}>
        <MaterialCommunityIcons name="email-outline" size={19} color={colors.primaryDark} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>Sorularınız için</Text>
          <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{SUPPORT_EMAIL}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>OrtakSat çağrı merkezi/telefon hattı işletmez; tüm başvuru ve iletişim bu e-posta üzerinden yürür.</Text>
        </View>
      </View>
    </View>
  );

  if (isWideWeb) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        {body}
        <View style={{ marginTop: 22 }}><WebFooter /></View>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 96 }} style={{ backgroundColor: colors.background }}>
      {body}
    </ScrollView>
  );
}
