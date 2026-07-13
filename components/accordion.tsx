import { MaterialCommunityIcons } from "@/components/icons";
import { useState, type PropsWithChildren } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";

/** Vertical collapsible section (product detail: description, specs, delivery, FAQ). */
export function Accordion({ title, icon, defaultOpen, children }: PropsWithChildren<{ title: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap; defaultOpen?: boolean }>) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, overflow: "hidden" }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 10, opacity: pressed ? 0.8 : 1, paddingHorizontal: 16, paddingVertical: 15 })}
      >
        {icon ? <MaterialCommunityIcons name={icon} size={19} color={colors.primaryDark} /> : null}
        <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>{title}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={22} color={colors.muted} />
      </Pressable>
      {open ? <View style={{ gap: 10, paddingBottom: 16, paddingHorizontal: 16 }}>{children}</View> : null}
    </View>
  );
}
