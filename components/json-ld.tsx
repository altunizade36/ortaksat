import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Sayfa-özel JSON-LD yapısal verisini <head>'e enjekte eder.
 *
 * NEDEN: expo-router/head, `<script type="application/ld+json">` ÇOCUKLARINI yok
 * sayıyor (yalnız title/meta/link işler) → sayfalardaki Product/FAQ/Breadcrumb
 * şemaları ne statik HTML'e ne de DOM'a giriyordu (ölü SEO). Bu bileşen script'i
 * doğrudan `document.head`'e ekler; Googlebot JS-render ederek okur.
 *
 * `id` script'i benzersiz kılar (aynı sayfada product+breadcrumb+faq çakışmasın);
 * `json` önceden JSON.stringify edilmiş metindir. Native'de no-op.
 */
export function JsonLd({ id, json }: { id: string; json: string }) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const scriptId = `jsonld-${id}`;
    let el = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = scriptId;
      document.head.appendChild(el);
    }
    el.textContent = json;
    return () => { document.getElementById(scriptId)?.remove(); };
  }, [id, json]);
  return null;
}
