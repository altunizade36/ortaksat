import { useRef } from "react";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { Alert } from "@/lib/alert";

export function useUnsavedForm(dirty: boolean, busy = false) {
  const navigation = useNavigation(), allowed = useRef(false);
  usePreventRemove(dirty, ({ data }) => {
    if (allowed.current) { navigation.dispatch(data.action); return; }
    if (busy) { Alert.alert("İşlem sürüyor", "Kayıt tamamlanana kadar bu ekranda bekle."); return; }
    Alert.alert("Kaydedilmeyen Bilgiler", "Bu ekrandaki kaydedilmemiş bilgileri silerek ayrılmak istiyor musun?", [
      { text: "Düzenlemeye Devam", style: "cancel" },
      { text: "Ayrıl", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  return () => { allowed.current = true; };
}
