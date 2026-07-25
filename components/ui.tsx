import { MaterialCommunityIcons } from "@/components/icons";
import { Link, type Href } from "expo-router";
import { PropsWithChildren, useState } from "react";
import { Platform, Pressable, Text, View, type ViewStyle } from "react-native";

import { Mascot } from "@/components/brand/Mascot";
import { colors, shadow } from "@/components/colors";
import { haptic } from "@/lib/haptics";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { MascotName } from "@/lib/mascots";

type ButtonProps = PropsWithChildren<{
  onPress?: () => void;
  href?: Href;
  tone?: "primary" | "secondary" | "danger" | "soft";
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}>;

// KRİTİK web tuzağı: <Link asChild> + fonksiyon-style Pressable (style={({pressed})=>({...})})
// → react-native-web bunu anchor'a UYGULAMAZ; bg/border/width/height/flexDirection DÜŞER, buton
// içerik boyutuna çöker (ör. header ikonu 40px yerine 20px). Doğru kalıp STATİK obje + useState.
// PressLink bunu kapsüller (döngülerde de güvenli — her örnek kendi state'ini tutar).
export function PressLink({
  href,
  style,
  pressedOpacity = 0.85,
  accessibilityLabel,
  accessibilityRole = "link",
  hitSlop,
  onPress,
  children
}: PropsWithChildren<{
  href: Href;
  style: ViewStyle;
  pressedOpacity?: number;
  accessibilityLabel?: string;
  accessibilityRole?: "link" | "button";
  hitSlop?: number;
  onPress?: () => void;
}>) {
  const [pressed, setPressed] = useState(false);
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        hitSlop={hitSlop}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{ ...style, opacity: pressed ? pressedOpacity : 1 }}
      >
        {children}
      </Pressable>
    </Link>
  );
}

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
        ...shadow.card
      }}
    >
      {children}
    </View>
  );
}

export function PrimaryButton({ children, onPress, href, tone = "primary", icon }: ButtonProps) {
  const { language } = useLanguage();
  const [pressed, setPressed] = useState(false);
  // WCAG AA: beyaz metin colors.primary (#0EA5B7) üstünde ~2.9:1 (AA'yı geçmez). primaryDark
  // (#0B7285 ~5:1) marka turkuazının koyu tonu → hue korunur, kontrast geçer. En sık buton.
  const backgroundColor =
    tone === "primary" ? colors.primaryDark : tone === "danger" ? colors.accent : tone === "soft" ? colors.primarySoft : colors.surface;
  const color = tone === "secondary" ? colors.ink : tone === "soft" ? colors.primaryDark : "#FFFFFF";
  const borderColor = tone === "secondary" ? colors.line : backgroundColor;

  // KRİTİK: style STATİK OBJE olmalı — fonksiyon-style (`({pressed})=>…`) `<Link asChild>`
  // ile sarılınca web'de anchor'a UYGULANMIYOR (bg/kenar/flexDirection kayboluyor → görünmez/
  // bozuk buton). Pressed durumu state ile → obje statik kalır, asChild korur. Anchor,
  // ebeveyninin align:stretch'i ile genişliği zaten doldurur (teşhisle doğrulandı).
  const style = {
    alignItems: "center" as const,
    backgroundColor,
    borderColor,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row" as const,
    gap: 8,
    justifyContent: "center" as const,
    minHeight: 46,
    opacity: pressed ? 0.76 : 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: tone === "primary" ? colors.primaryDark : "transparent",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: tone === "primary" ? 0.16 : 0,
    shadowRadius: 14
  };

  const button = (
    <Pressable
      accessibilityRole={href ? "link" : "button"}
      accessibilityLabel={typeof children === "string" ? translateCopy(children, language) : undefined}
      onPress={onPress ? () => { haptic.light(); onPress(); } : undefined}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={style}
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
    neutral: [colors.muted, colors.neutralSoft],
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
  // STATİK style: action.href → <Link asChild> ile sarılıyor; fonksiyon-style web'de anchor'a
  // uygulanmaz (bg/flexDirection düşer → görünmez CTA). Statik obje asChild'da korunur.
  const cta = action ? (
    <Pressable
      accessibilityRole={action.href ? "link" : "button"}
      accessibilityLabel={translateCopy(action.label, language)}
      onPress={action.onPress}
      style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primaryDark, borderRadius: 10, flexDirection: "row", gap: 6, marginTop: 4, minHeight: 44, paddingHorizontal: 16, paddingVertical: 10 }}
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

// Filtre/segment çipi. tone: "dark" (varsayılan, mevcut çağıranlar) | "primary" (turkuaz).
// icon opsiyonel. a11y (role/state/label) + hitSlop dahil (küçük dokunma hedefi telafisi).
export function Chip({ label, active, onPress, tone = "dark", icon }: { label: string; active?: boolean; onPress?: () => void; tone?: "dark" | "primary"; icon?: keyof typeof MaterialCommunityIcons.glyphMap }) {
  const { language } = useLanguage();
  const activeBg = tone === "primary" ? colors.primary : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={translateCopy(label, language)}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? activeBg : colors.surface,
        borderColor: active ? activeBg : colors.line,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: "row",
        gap: icon ? 5 : 0,
        justifyContent: "center",
        maxWidth: 260,
        minHeight: 38,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 13,
        paddingVertical: 8
      })}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={14} color={active ? "#FFFFFF" : colors.muted} /> : null}
      <Text ellipsizeMode="tail" numberOfLines={1} selectable style={{ color: active ? "#FFFFFF" : colors.ink, flexShrink: 1, fontSize: 13, fontWeight: "900", lineHeight: 16 }}>
        {translateCopy(label, language)}
      </Text>
    </Pressable>
  );
}

// İkon+etiketli segment düğmesi (mod seçici). ortaklar/ortak-araniyor'da kopyalıydı → tek kaynak.
export function SegButton({ active, icon, label, onPress, small }: { active: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; small?: boolean }) {
  const { language } = useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={translateCopy(label, language)}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", backgroundColor: active ? colors.primary : colors.surfaceAlt, borderColor: active ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: small ? 36 : 40, opacity: pressed ? 0.8 : 1, paddingHorizontal: small ? 10 : 12, paddingVertical: small ? 6 : 8 })}
    >
      <MaterialCommunityIcons name={icon} size={small ? 13 : 15} color={active ? "#FFFFFF" : colors.muted} />
      <Text style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: small ? 11.5 : 12.5, fontWeight: "800" }}>{translateCopy(label, language)}</Text>
    </Pressable>
  );
}

// İkon+etiketli küçük istatistik/rozet pili (salt-gösterim). Tek kaynak.
export function StatChip({ icon, label, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; tone?: "success" }) {
  const c = tone === "success" ? colors.success : colors.muted;
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 8, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
      <MaterialCommunityIcons name={icon} size={12} color={c} />
      <Text style={{ color: tone === "success" ? colors.success : colors.ink, fontSize: 11, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

// Yükleniyor bloğu (spinner + metin) — birden çok ekranda kopyalıydı.
export function LoadingBlock({ label }: { label?: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ alignItems: "center", paddingVertical: 44 }}>
      <MaterialCommunityIcons name="loading" size={28} color={colors.muted} />
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 8 }}>{translateCopy(label ?? "Yükleniyor…", language)}</Text>
    </View>
  );
}
