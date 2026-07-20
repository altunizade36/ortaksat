import { MaterialCommunityIcons } from "@/components/icons";
import { Link, type Href } from "expo-router";
import { PropsWithChildren } from "react";
import { Pressable, Text, View } from "react-native";

import { Mascot } from "@/components/brand/Mascot";
import { colors } from "@/components/colors";
import { haptic } from "@/lib/haptics";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { MascotName } from "@/lib/mascots";

type ButtonProps = PropsWithChildren<{
  onPress?: () => void;
  href?: Href;
  tone?: "primary" | "secondary" | "danger" | "soft";
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}>;

export function Card({ children }: PropsWithChildren) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderRadius: 8,
        borderWidth: 1,
        gap: 12,
        padding: 14,
        shadowColor: "#101828",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 14
      }}
    >
      {children}
    </View>
  );
}

export function PrimaryButton({ children, onPress, href, tone = "primary", icon }: ButtonProps) {
  const { language } = useLanguage();
  // WCAG AA: beyaz metin colors.primary (#0EA5B7) üstünde ~2.9:1 (AA'yı geçmez). primaryDark
  // (#0B7285 ~5:1) marka turkuazının koyu tonu → hue korunur, kontrast geçer. En sık buton.
  const backgroundColor =
    tone === "primary" ? colors.primaryDark : tone === "danger" ? colors.accent : tone === "soft" ? colors.primarySoft : colors.surface;
  const color = tone === "secondary" ? colors.ink : tone === "soft" ? colors.primaryDark : "#FFFFFF";
  const borderColor = tone === "secondary" ? colors.line : backgroundColor;

  const button = (
    <Pressable
      accessibilityRole={href ? "link" : "button"}
      accessibilityLabel={typeof children === "string" ? translateCopy(children, language) : undefined}
      onPress={onPress ? () => { haptic.light(); onPress(); } : undefined}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor,
        borderColor,
        borderRadius: 8,
        borderWidth: 1,
        flexShrink: 1,
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
        minHeight: 46,
        opacity: pressed ? 0.76 : 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        shadowColor: tone === "primary" ? colors.primaryDark : "transparent",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: tone === "primary" ? 0.16 : 0,
        shadowRadius: 14
      })}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={color} /> : null}
      <Text ellipsizeMode="tail" numberOfLines={2} selectable style={{ color, flexShrink: 1, fontSize: 14, fontWeight: "800", lineHeight: 17, textAlign: "center" }}>
        {typeof children === "string" ? translateCopy(children, language) : children}
      </Text>
    </Pressable>
  );

  if (!href) return button;

  return (
    <Link href={href} asChild>
      {button}
    </Link>
  );
}

export function StatusPill({ label, tone = "info" }: { label: string; tone?: "info" | "success" | "warning" | "neutral" | "danger" }) {
  const { language } = useLanguage();
  const palette = {
    info: [colors.info, colors.infoSoft],
    success: [colors.success, colors.successSoft],
    warning: [colors.warning, colors.warningSoft],
    // pasif/nötr durumlar için gri; reddedildi/tükendi gibi olumsuzlar için kırmızı.
    neutral: [colors.muted, "#F2F4F7"],
    danger: [colors.accent, colors.accentSoft]
  } as const;
  const [color, backgroundColor] = palette[tone];

  return (
    <View style={{ alignSelf: "flex-start", backgroundColor, borderRadius: 999, maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text ellipsizeMode="tail" numberOfLines={1} selectable style={{ color, flexShrink: 1, fontSize: 12, fontWeight: "800" }}>
        {translateCopy(label, language)}
      </Text>
    </View>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  const { language } = useLanguage();
  return (
    // Kutular satırda flex:1 + stretch olduğu için zaten eşit yükseklikte hizalanır.
    // Eskiden etikete minHeight:28 (2 satırlık) veriliyordu → "Stok" gibi TEK satırlık
    // etiketlerde bile 2 satır yer rezerve edilip etiketle değer arasında büyük ÖLÜ BOŞLUK
    // oluşuyor, kutular gereksiz uzuyordu. Etiket artık doğal yüksekliğinde.
    <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flex: 1, gap: 3, padding: 11 }}>
      <Text ellipsizeMode="tail" numberOfLines={2} selectable style={{ color: colors.muted, fontSize: 11, fontWeight: "800", lineHeight: 14 }}>
        {translateCopy(label, language)}
      </Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} selectable style={{ color: colors.ink, fontSize: 18, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
        {value}
      </Text>
    </View>
  );
}

export function EmptyState({ title, body, action, mascot }: { title: string; body: string; action?: { label: string; href?: Href; onPress?: () => void; icon?: keyof typeof MaterialCommunityIcons.glyphMap }; mascot?: MascotName }) {
  const { language } = useLanguage();
  const cta = action ? (
    <Pressable
      accessibilityRole={action.href ? "link" : "button"}
      onPress={action.onPress}
      style={({ pressed }) => ({ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primaryDark, borderRadius: 10, flexDirection: "row", gap: 6, marginTop: 4, opacity: pressed ? 0.85 : 1, paddingHorizontal: 16, paddingVertical: 10 })}
    >
      {action.icon ? <MaterialCommunityIcons name={action.icon} size={16} color="#FFFFFF" /> : null}
      <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{translateCopy(action.label, language)}</Text>
    </Pressable>
  ) : null;
  return (
    <Card>
      <View style={{ alignItems: "center", gap: 10 }}>
        {mascot ? <Mascot name={mascot} size={168} /> : null}
        <Text selectable style={{ color: colors.ink, fontSize: 17, fontWeight: "900", textAlign: mascot ? "center" : "left" }}>
          {translateCopy(title, language)}
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: mascot ? "center" : "left" }}>
          {translateCopy(body, language)}
        </Text>
        {action?.href ? <Link href={action.href} asChild>{cta}</Link> : cta}
      </View>
    </Card>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <Text ellipsizeMode="tail" numberOfLines={1} selectable style={{ color: colors.ink, flex: 1, fontSize: 19, fontWeight: "900" }}>
        {translateCopy(title, language)}
      </Text>
      {action ? (
        <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, maxWidth: 104, minWidth: 0, paddingHorizontal: 9, paddingVertical: 5 }}>
          <Text adjustsFontSizeToFit ellipsizeMode="tail" minimumFontScale={0.82} numberOfLines={1} selectable style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>
            {translateCopy(action, language)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const { language } = useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={translateCopy(label, language)}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? colors.ink : colors.surface,
        borderColor: active ? colors.ink : colors.line,
        borderRadius: 999,
        borderWidth: 1,
        justifyContent: "center",
        minHeight: 38,
        opacity: pressed ? 0.72 : 1,
        maxWidth: 172,
        paddingHorizontal: 13,
        paddingVertical: 8
      })}
    >
      <Text
        ellipsizeMode="tail"
        numberOfLines={1}
        selectable
        style={{ color: active ? "#FFFFFF" : colors.ink, flexShrink: 1, fontSize: 13, fontWeight: "900", lineHeight: 16 }}
      >
        {translateCopy(label, language)}
      </Text>
    </Pressable>
  );
}
