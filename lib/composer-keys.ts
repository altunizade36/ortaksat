import { Platform } from "react-native";

type KeyEventLike = { nativeEvent: { key?: string; shiftKey?: boolean; isComposing?: boolean; keyCode?: number; which?: number } };

let coarsePointer: boolean | null = null;
/** Birincil girdi dokunmatik mi (telefon/tablet tarayıcısı)? Fiziksel klavye/fare varsa false. */
function touchKeyboard(): boolean {
  if (coarsePointer !== null) return coarsePointer;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    coarsePointer = window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches;
  } catch {
    coarsePointer = false;
  }
  return coarsePointer;
}

/**
 * Web sohbet composer'ı: bu tuş olayı "gönder" mi?
 *
 *  - Enter gönderir, Shift+Enter yeni satır ekler (varsayılan davranışa bırakılır).
 *  - IME bileşimi sürerken (Japonca/Çince/Korece, bazı Android klavyelerinin öneri çubuğu)
 *    Enter ADAYI onaylar; mesajı göndermemeli. `isComposing` bazı tarayıcılarda compositionend
 *    sonrasına kalır; `keyCode 229` aynı durumu eski motorlar için işaretler.
 *  - Dokunmatik klavyede Shift+Enter YOKTUR: Enter yeni satır olarak kalır, gönderim düğmeyle
 *    yapılır (yoksa telefonda çok satırlı mesaj yazmak imkânsızdı).
 */
export function isComposerSendKey(e: KeyEventLike): boolean {
  if (Platform.OS !== "web") return false;
  const ev = e.nativeEvent;
  if (ev.key !== "Enter" || ev.shiftKey) return false;
  if (ev.isComposing || ev.keyCode === 229 || ev.which === 229) return false;
  return !touchKeyboard();
}
