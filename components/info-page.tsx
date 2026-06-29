import { ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { WebContainer } from "@/components/web-container";

export type InfoSection = { heading?: string; body: string };

/**
 * Simple, centered content page used for static informational routes
 * (about, how-it-works, FAQ). Renders well on both web and mobile.
 */
export function InfoPage({ title, intro, sections }: { title: string; intro?: string; sections: InfoSection[] }) {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
      <WebContainer max={820} padding={0} style={{ gap: 18 }}>
        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 36 }}>
            {title}
          </Text>
          {intro ? (
            <Text selectable style={{ color: colors.muted, fontSize: 16, fontWeight: "600", lineHeight: 24 }}>
              {intro}
            </Text>
          ) : null}
        </View>
        {sections.map((section, index) => (
          <View key={section.heading ?? index} style={{ gap: 8 }}>
            {section.heading ? (
              <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: "900" }}>
                {section.heading}
              </Text>
            ) : null}
            <Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "500", lineHeight: 23 }}>
              {section.body}
            </Text>
          </View>
        ))}
      </WebContainer>
    </ScrollView>
  );
}
