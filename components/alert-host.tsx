import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { peekAlert, resolveAlert, subscribeAlerts, type AlertButton, type AlertRequest } from "@/lib/alert";

/**
 * Web'de Alert.alert isteklerini MARKALI bir modal olarak gösterir.
 * (Native'de RN'in kendi Alert'i kullanılır; bu bileşen orada hiçbir şey yapmaz.)
 * Detaylı gerekçe: lib/alert.ts başındaki not.
 */
export function AlertHost() {
  const [req, setReq] = useState<AlertRequest | undefined>(undefined);

  useEffect(() => subscribeAlerts(() => setReq(peekAlert())), []);

  if (!req) return null;

  const buttons: AlertButton[] = req.buttons?.length ? req.buttons : [{ text: "Tamam", style: "default" }];
  const cancel = buttons.find((b) => b.style === "cancel");
  const actions = buttons.filter((b) => b.style !== "cancel");
  const destructive = actions.some((b) => b.style === "destructive");

  const close = (b?: AlertButton) => {
    resolveAlert(req.id, b);
    setReq(peekAlert()); // kuyrukta başka istek varsa hemen onu göster
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(cancel)} statusBarTranslucent>
      {/* Dışarı dokunmak yalnızca iptal edilebilir diyaloğu kapatır (yıkıcı işlemi
          yanlışlıkla onaylatmaz). */}
      <Pressable
        onPress={() => (cancel ? close(cancel) : undefined)}
        style={{ alignItems: "center", backgroundColor: "rgba(8,15,25,0.55)", flex: 1, justifyContent: "center", padding: 20 }}
      >
        <Pressable
          onPress={() => undefined}
          style={{ backgroundColor: colors.surface, borderRadius: 18, gap: 12, maxWidth: 440, padding: 20, width: "100%" }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
            <View style={{ alignItems: "center", backgroundColor: destructive ? colors.accentSoft : colors.primarySoft, borderRadius: 999, height: 36, justifyContent: "center", width: 36 }}>
              <MaterialCommunityIcons
                name={destructive ? "alert-outline" : "information-outline"}
                size={19}
                color={destructive ? colors.accent : colors.primaryDark}
              />
            </View>
            <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>{req.title}</Text>
          </View>

          {req.message ? (
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>{req.message}</Text>
          ) : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            {cancel ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => close(cancel)}
                style={({ pressed }) => ({ borderColor: colors.line, borderRadius: 10, borderWidth: 1, opacity: pressed ? 0.75 : 1, paddingHorizontal: 16, paddingVertical: 11 })}
              >
                <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "800" }}>{cancel.text ?? "Vazgeç"}</Text>
              </Pressable>
            ) : null}
            {actions.map((b, i) => {
              const isDestructive = b.style === "destructive";
              return (
                <Pressable
                  key={`${b.text ?? "ok"}-${i}`}
                  accessibilityRole="button"
                  onPress={() => close(b)}
                  style={({ pressed }) => ({
                    backgroundColor: isDestructive ? colors.accent : colors.primary,
                    borderRadius: 10,
                    opacity: pressed ? 0.85 : 1,
                    paddingHorizontal: 18,
                    paddingVertical: 11
                  })}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{b.text ?? "Tamam"}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
