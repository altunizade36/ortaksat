import { useRef, useState } from "react";
import { usePreventRemove } from "expo-router";
import { Alert } from "@/lib/alert";

// SDK 58 (expo-router): engellenen gezinme artık `navigation.dispatch(data.action)` ile DEĞİL,
// koşul false yapılıp `repeat()` çağrılarak sürdürülür; başka yere gidilecekse hook'un döndürdüğü
// `disablePrevention()` çağrılır. Koşul true kalırsa aynı eylem yeniden engellenir.
export function useUnsavedForm(dirty: boolean, busy = false) {
  const allowed = useRef(false);
  const [released, setReleased] = useState(false);
  const disablePrevention = usePreventRemove(dirty && !released, ({ repeat }) => {
    const leave = () => { setReleased(true); repeat(); };
    if (allowed.current) { leave(); return; }
    if (busy) { Alert.alert("İşlem sürüyor", "Kayıt tamamlanana kadar bu ekranda bekle."); return; }
    Alert.alert("Kaydedilmeyen Bilgiler", "Bu ekrandaki kaydedilmemiş bilgileri silerek ayrılmak istiyor musun?", [
      { text: "Düzenlemeye Devam", style: "cancel" },
      { text: "Ayrıl", style: "destructive", onPress: leave },
    ]);
  });
  return () => { allowed.current = true; setReleased(true); disablePrevention(); };
}
