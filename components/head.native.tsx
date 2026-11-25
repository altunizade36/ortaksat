import type { ReactNode } from "react";

// Uygulamada sayfa <head> etiketlerinin karşılığı yoktur; bu bileşen bilerek hiçbir şey çizmez.
//
// NEDEN: expo-router'ın iOS'taki Head bileşeni her ekranda site adresini (router "origin") arar;
// adres tanımlı değilse mağaza derlemesinde kullanıcıya "Expo Head: Add the handoff origin…"
// uyarı penceresi açar. Sürüm 1.0.0 bu yüzden her ekranda uyarı gösterdi. Bu hata yalnız iOS
// mağaza derlemesinde görünür: Expo Go'da, Android'de ve web'de aynı kod sessiz kalır.
export default function Head(_props: { children?: ReactNode }) {
  return null;
}

Head.Provider = function HeadProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
};
