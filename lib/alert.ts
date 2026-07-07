/**
 * Web-güvenli Alert.
 *
 * react-native-web'in `Alert.alert` gövdesi BOŞTUR (`static alert() {}`) — yani
 * web'de hem uyarı kutusu çıkmaz hem de buton `onPress` geri-çağırmaları TETİKLENMEZ.
 * Bu, satıcının "Satışa Çevir / Reddet / Komisyon Ödendi / İlanı Kaldır" ve admin
 * onayları gibi callback'e bağlı akışları web'de sessizce çalışmaz hâle getiriyordu.
 *
 * Bu sarmalayıcı web'de tarayıcının `window.confirm/alert`'ini kullanır; native'de
 * gerçek RN Alert'e delege eder. API imzası RN Alert.alert ile aynıdır — çağrı
 * yerlerinde yalnızca import değişir.
 */
import { Alert as RNAlert, Platform } from "react-native";

export type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

function webAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (typeof window === "undefined") return; // SSR/statik export güvenliği
  const text = [title, message].filter(Boolean).join("\n\n");

  // Buton yok / tek buton → bilgi kutusu, varsa tek onPress'i çağır.
  if (!buttons || buttons.length === 0) { window.alert(text); return; }
  if (buttons.length === 1) { window.alert(text); buttons[0].onPress?.(); return; }

  const cancel = buttons.find((b) => b.style === "cancel");
  const actions = buttons.filter((b) => b.style !== "cancel");

  // Tek eylem (iptal + onayla) → confirm.
  if (actions.length <= 1) {
    const primary = actions[0];
    const ok = window.confirm(text);
    if (ok) primary?.onPress?.();
    else cancel?.onPress?.();
    return;
  }

  // Çok eylemli (ör. "Pasife Al" / "Kalıcı Kaldır") → her eylemi sırayla sor.
  for (const a of actions) {
    const ok = window.confirm(`${text}\n\n→ ${a.text ?? "Onayla"}?`);
    if (ok) { a.onPress?.(); return; }
  }
  cancel?.onPress?.();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: unknown): void {
    if (Platform.OS === "web") { webAlert(title, message, buttons); return; }
    // @ts-expect-error RN Alert imza uyumlu; options RN'de opsiyonel.
    RNAlert.alert(title, message ?? "", buttons, options);
  }
};
