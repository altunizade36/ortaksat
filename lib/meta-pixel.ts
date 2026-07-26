// Meta (Facebook) Pixel — ince çalışma-zamanı yardımcısı.
//
// Base kod app/+html.tsx <head>'de ENV-KORUMALI enjekte edilir: EXPO_PUBLIC_META_PIXEL_ID
// set değilse fbevents.js HİÇ yüklenmez (site tamamen etkisiz). ID set olunca (Vercel env
// var + yeniden deploy) base kod init + ilk PageView'ı gönderir; bu modül ise ek/olayları
// (ViewContent, Search, CompleteRegistration, Lead…) gönderir.
//
// TÜM fonksiyonlar GÜVENLİ NO-OP: window.fbq yoksa (native, ID'siz web, reklam engelleyici,
// SSR) sessizce hiçbir şey yapmaz — asla hata fırlatmaz, akışı bloklamaz.
import { Platform } from "react-native";

export const META_PIXEL_ID = process.env.EXPO_PUBLIC_META_PIXEL_ID ?? "";
export const metaPixelEnabled = !!META_PIXEL_ID;

type FbqValue = string | number | boolean | string[];
type FbqParams = Record<string, FbqValue | undefined>;

function getFbq(): ((...args: unknown[]) => void) | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const f = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
  return typeof f === "function" ? f : null;
}

// undefined/boş değerleri at (Meta paneli boş parametreyi gürültü sayar).
function clean(p?: FbqParams): FbqParams | undefined {
  if (!p) return undefined;
  const o: FbqParams = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    if (typeof v === "string" && !v.trim()) continue;
    o[k] = v;
  }
  return Object.keys(o).length ? o : undefined;
}

/** Standart Meta olayı (ViewContent, Search, CompleteRegistration, Lead, SubmitApplication…). */
export function metaTrack(event: string, params?: FbqParams): void {
  const f = getFbq();
  if (!f) return;
  try {
    const c = clean(params);
    if (c) f("track", event, c);
    else f("track", event);
  } catch { /* sessiz */ }
}

/** Özel (custom) Meta olayı — standart listede olmayan adlar için. */
export function metaTrackCustom(event: string, params?: FbqParams): void {
  const f = getFbq();
  if (!f) return;
  try {
    const c = clean(params);
    if (c) f("trackCustom", event, c);
    else f("trackCustom", event);
  } catch { /* sessiz */ }
}

/** SPA gezinmesinde sayfa görüntüleme — base kod yalnız İLK yüklemede sayar. */
export function metaPageView(): void {
  const f = getFbq();
  if (!f) return;
  try { f("track", "PageView"); } catch { /* sessiz */ }
}
