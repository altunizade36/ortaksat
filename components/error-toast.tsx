import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { useStore } from "@/lib/use-store";

/**
 * UYGULAMA-İÇİ HATA BİLDİRİMİ (toast).
 *
 * ÖNCEDEN: kritik yazım hatası `Alert.alert(...)` ile gösteriliyordu. Web'de bu
 * `window.alert` demek → tarayıcının ham sistem kutusu ("www.ortaksat.com web
 * sitesinin mesajı… / İletişim kutularını gizle") açılıyordu: markasız, sayfayı
 * kilitliyor, kullanıcıyı "siteyi engelle" seçeneğiyle karşılıyordu. Mesajlaşma
 * gibi sık akışlarda çok rahatsız edici.
 *
 * ŞİMDİ: alttan yükselen, kendiliğinden kaybolan, dokunulunca kapanan uygulama-içi
 * bir şerit. Sayfayı kilitlemez, markayla uyumlu, native + web'de aynı.
 */
export function ErrorToast() {
  const { syncError, clearSyncError } = useStore();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!syncError) return;
    setMsg(syncError);
    clearSyncError(); // store'u hemen boşalt; gösterimi toast üstlenir
  }, [syncError, clearSyncError]);

  useEffect(() => {
    if (!msg) return;
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== "web" }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => dismiss(), 5000);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg]);

  const dismiss = () => {
    Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: Platform.OS !== "web" }).start(() => setMsg(null));
  };

  if (!msg) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        bottom: 0,
        left: 0,
        opacity: anim,
        paddingBottom: (insets.bottom || 12) + 12,
        paddingHorizontal: 12,
        position: "absolute",
        right: 0,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        zIndex: 9999
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hatayı kapat"
        onPress={dismiss}
        style={{
          alignItems: "center",
          alignSelf: "center",
          backgroundColor: colors.ink,
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
        <MaterialCommunityIcons name="alert-circle-outline" size={19} color={colors.accent} />
        <Text style={{ color: "#FFFFFF", flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 18 }}>{msg}</Text>
        <MaterialCommunityIcons name="close" size={17} color="rgba(255,255,255,0.7)" />
      </Pressable>
    </Animated.View>
  );
}
