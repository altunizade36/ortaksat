/**
 * Web-güvenli Alert — MARKALI, UYGULAMA-İÇİ.
 *
 * GEÇMİŞ: react-native-web'in `Alert.alert` gövdesi BOŞTUR (`static alert() {}`) —
 * web'de ne kutu çıkar ne de buton `onPress` tetiklenir. Bu yüzden bir sarmalayıcı
 * yazılmış ve web'de `window.confirm/alert` kullanılmıştı. Çalışıyordu ama:
 *   • Tarayıcının HAM SİSTEM KUTUSU çıkıyordu ("www.ortaksat.com web sitesinin
 *     mesajı…") — markasız ve sayfayı kilitleyen.
 *   • Kullanıcıya "İletişim kutularını gizle" (bu sitenin kutularını engelle)
 *     seçeneği sunuyordu. Bir kez basan kullanıcı TÜM onay akışlarını sessizce
 *     kaybederdi (satışa çevir, ilan sil, ortaklık onayı… hiçbiri çalışmazdı).
 *   • Çok eylemli akışlarda arka arkaya confirm soruyordu (berbat UX).
 *
 * ŞİMDİ: web'de istek bir kuyruğa alınır; <AlertHost /> (root layout) markalı bir
 * modal olarak gösterir. API imzası RN Alert.alert ile AYNI kaldı → 105 çağrı
 * yerinin hiçbiri değişmedi. Native'de gerçek RN Alert'e delege edilir.
 *
 * GÜVENLİK: <AlertHost /> bir sebeple bağlı değilse eski window.confirm davranışına
 * düşer — onay akışları asla sessizce kaybolmaz.
 */
import { Alert as RNAlert, Platform } from "react-native";

export type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export type AlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

let seq = 0;
const queue: AlertRequest[] = [];
let notify: (() => void) | null = null;

/** AlertHost bağlanır (root layout). Dönen fonksiyon aboneliği bırakır. */
export function subscribeAlerts(fn: () => void): () => void {
  notify = fn;
  return () => { notify = null; };
}

/** Sıradaki istek (yoksa undefined). */
export function peekAlert(): AlertRequest | undefined {
  return queue[0];
}

/** İsteği kapat ve seçilen butonun eylemini çalıştır. */
export function resolveAlert(id: number, button?: AlertButton): void {
  const i = queue.findIndex((r) => r.id === id);
  if (i >= 0) queue.splice(i, 1);
  button?.onPress?.();
  notify?.();
}

// AlertHost yoksa (teorik) eski davranış — onay akışı asla kaybolmasın.
function fallbackWebAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (typeof window === "undefined") return;
  const text = [title, message].filter(Boolean).join("\n\n");
  if (!buttons || buttons.length === 0) { window.alert(text); return; }
  if (buttons.length === 1) { window.alert(text); buttons[0].onPress?.(); return; }
  const cancel = buttons.find((b) => b.style === "cancel");
  const actions = buttons.filter((b) => b.style !== "cancel");
  if (actions.length <= 1) {
    if (window.confirm(text)) actions[0]?.onPress?.();
    else cancel?.onPress?.();
    return;
  }
  for (const a of actions) {
    if (window.confirm(`${text}\n\n→ ${a.text ?? "Onayla"}?`)) { a.onPress?.(); return; }
  }
  cancel?.onPress?.();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: unknown): void {
    if (Platform.OS !== "web") {
      // @ts-expect-error RN Alert imza uyumlu; options RN'de opsiyonel.
      RNAlert.alert(title, message ?? "", buttons, options);
      return;
    }
    if (!notify) { fallbackWebAlert(title, message, buttons); return; }
    queue.push({ id: ++seq, title, message, buttons });
    notify();
  }
};
