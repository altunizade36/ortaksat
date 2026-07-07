/**
 * Web-güvenli paylaşım.
 *
 * react-native-web'in `Share.share`'i `navigator.share` yoksa Promise.REJECT eder
 * (masaüstü Firefox'ta her zaman yok; Chrome'da yalnızca HTTPS + kullanıcı hareketi).
 * Çağrı yerleri `await Share.share(...)`'ı try/catch'siz kullandığından, masaüstünde
 * "Paylaş" butonu sessizce ölüyordu — ne paylaşım ne de yedek.
 *
 * Bu yardımcı: web'de mümkünse native paylaşım paneli, değilse panoya kopyalar ve
 * "copied" döner (çağıran bir bildirim gösterebilir). Native'de RN Share'e delege eder.
 */
import { Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";

export type ShareResult = "shared" | "copied" | "dismissed" | "failed";

export type ShareContent = { title?: string; message?: string; url?: string };

export async function shareOrCopy(content: ShareContent): Promise<ShareResult> {
  const fallbackText = [content.message, content.url].filter(Boolean).join("\n") || content.url || content.message || "";

  if (Platform.OS === "web") {
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title: content.title, text: content.message, url: content.url });
        return "shared";
      } catch (e) {
        // Kullanıcı paneli kapattıysa (AbortError) → sessiz; başka hatada panoya düş.
        if (e instanceof Error && e.name === "AbortError") return "dismissed";
      }
    }
    try { await Clipboard.setStringAsync(fallbackText); return "copied"; } catch { return "failed"; }
  }

  try {
    await Share.share({ title: content.title, message: content.message ?? "", url: content.url });
    return "shared";
  } catch {
    // Native'de de son çare panoya kopyala.
    try { await Clipboard.setStringAsync(fallbackText); return "copied"; } catch { return "failed"; }
  }
}
