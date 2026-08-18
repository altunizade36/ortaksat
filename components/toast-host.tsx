import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { clearToast, peekToast, subscribeToast, type ToastRequest } from "@/lib/toast";

/**
 * HAFİF BAŞARI/BİLGİ TOAST'ı — showToast(...) çağrılarını alttan yükselen bloklamayan
 * şerit olarak gösterir (ErrorToast'ın pozitif ikizi). Detay: lib/toast.ts.
 * ErrorToast'ın biraz ÜSTÜNDE konumlanır → ikisi aynı anda çıkarsa üst üste binmez.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [req, setReq] = useState<ToastRequest | undefined>(undefined);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => subscribeToast(() => setReq(peekToast())), []);

  useEffect(() => {
    if (!req) return;
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== "web" }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => dismiss(), 3200);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req?.id]);

  const dismiss = () => {
    const id = req?.id;
    Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: Platform.OS !== "web" }).start(() => {
      if (id != null) clearToast(id);
      setReq(undefined);
    });
  };

  if (!req) return null;
  const success = req.tone === "success";

  return (
    <Animated.View
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      role={"status" as never}
      style={{
        bottom: 0,
        left: 0,
        opacity: anim,
        // ErrorToast (bottom ~insets+12) ile çakışmasın diye biraz yukarıda.
        paddingBottom: (insets.bottom || 12) + 72,
        paddingHorizontal: 12,
        position: "absolute",
        right: 0,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        zIndex: 9998
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${req.message}. Kapatmak için dokun.`}
        onPress={dismiss}
        style={{
          alignItems: "center",
          alignSelf: "center",
          backgroundColor: colors.ink, // ErrorToast ile aynı koyu zemin (beyaz metin kontrastı) — ton İKONDA.
          borderRadius: 12,
          elevation: 8,
          flexDirection: "row",
          gap: 10,
          maxWidth: 520,
          paddingHorizontal: 14,
          paddingVertical: 12,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.24,
          shadowRadius: 16,
          width: "100%"
        }}
      >
        <MaterialCommunityIcons name={success ? "check-circle" : "information"} size={19} color={success ? colors.success : colors.info} />

        <Text style={{ color: "#FFFFFF", flex: 1, fontSize: 13, fontWeight: "800", lineHeight: 18 }}>{req.message}</Text>
      </Pressable>
    </Animated.View>
  );
}
