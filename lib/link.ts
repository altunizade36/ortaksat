/**
 * Web-güvenli link açma.
 *
 * `Linking.openURL` react-native-web'de bir shim'dir ve popup engeli, güvensiz
 * bağlam veya kullanıcı-hareketi dışı çağrılarda reject/throw edebilir. try/catch
 * olmayan çağrılar unhandled-rejection üretir ve buton sessizce ölür.
 *
 * Bu yardımcı: RN Linking'i dener; web'de başarısızsa window.open, o da olmazsa
 * aynı sekmede location değişimini (tel:/mailto:/wa.me için de çalışır) dener.
 * Başarılıysa true, hepsi başarısızsa false döner — çağıran YEDEK akışa düşebilir
 * (ör. WhatsApp açılamazsa uygulama-içi mesaja geç).
 */
import { Linking, Platform } from "react-native";

export async function openUrlSafe(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        const w = window.open(url, "_blank", "noopener,noreferrer");
        if (w) return true;
        // Popup engellendi → aynı sekmede dene.
        window.location.href = url;
        return true;
      } catch { return false; }
    }
    return false;
  }
}
