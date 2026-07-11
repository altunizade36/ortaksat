import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

// Native (iOS/Android): AsyncStorage GERÇEK kalıcı depodur → oturum persist + auto-refresh
// AÇIK olmalı. Önceki config native'i "tarayıcı yok = depolama yok" sanıp persistSession'ı
// KAPATIYORDU → giriş yapılıp uygulama kapanınca oturum kayboluyor/çalışmıyordu.
const isNativeApp = Platform.OS === "ios" || Platform.OS === "android";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfig = {
  url: supabaseUrl,
  key: supabasePublishableKey,
  projectRef: supabaseUrl?.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1]
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

// During static web rendering (expo export, output: "static") this module runs
// in Node where `window` is undefined. AsyncStorage on web wraps localStorage, so
// persisting the session there would crash SSR. Only attach browser storage when a
// real browser environment is present; the client hydrates with the full session.
const hasBrowserStorage = typeof window !== "undefined";

// "Beni Hatırla" — GERÇEK davranış (no-op değil): işaretliyse oturum localStorage'da
// kalıcıdır; işaretli değilse sessionStorage'a yazılır ve tarayıcı/sekme kapanınca
// silinir (kullanıcı çıkış yapmış olur). Bayrak her zaman localStorage'da tutulur ki
// adaptör hangi deponun okunacağını tutarlı bilsin. Native'de kavram yok → AsyncStorage.
const REMEMBER_KEY = "ortaksat.remember_session";

export function setRememberSession(remember: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  } catch {
    /* private mode / storage kapalı — sessiz geç */
  }
}

export function getRememberSession(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(REMEMBER_KEY) !== "0";
  } catch {
    return true;
  }
}

function activeWebStore(): Storage {
  return getRememberSession() ? window.localStorage : window.sessionStorage;
}

// Çağrı anında doğru depoyu seçen web adaptörü: kullanıcı girişten önce "Beni Hatırla"
// bayrağını değiştirince sonraki oturum yazımları doğru depoya gider.
const rememberAwareWebStorage = {
  getItem: (key: string) => {
    try {
      return activeWebStore().getItem(key) ?? window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      activeWebStore().setItem(key, value);
      // Diğer depoda kalmış eski oturum kalıntısını temizle.
      (getRememberSession() ? window.sessionStorage : window.localStorage).removeItem(key);
    } catch {
      /* sessiz geç */
    }
  },
  removeItem: (key: string) => {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      /* sessiz geç */
    }
  }
};

const authStorage = isNativeApp
  ? AsyncStorage
  : hasBrowserStorage
    ? (typeof window.sessionStorage !== "undefined" ? rememberAwareWebStorage : AsyncStorage)
    : undefined;

// Ağ isteklerine üst zaman sınırı: takılı/kara-delik bağlantıda (mobil, captive portal)
// istek sonsuza kadar asılı kalıp UI'ı dondurmasın — 15sn sonra iptal → sorgu hatası →
// çağıran retry/empty UI'ına düşer. Çağıranın kendi AbortSignal'ı (ör. arama iptali) korunur.
const REQUEST_TIMEOUT_MS = 15000;
function reqUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  try { return (input as Request).url ?? ""; } catch { return ""; }
}
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // MUAFİYET: Storage yüklemeleri (fotoğraf/video) yavaş uplink'te 15sn'yi kolayca aşar;
  // timeout onları iptal edince yükleme yerel blob:/file: URI'ye düşüp KIRIK görsel olarak
  // kaydediliyordu (yalnız yükleyen görür, herkese kırık). Yükleme/storage yollarını
  // timeout'tan muaf tut (kullanıcı-başlatımlı, kendi UI'ında iptal edilebilir). 15sn yalnız
  // veri/auth sorgularına uygulanır (sonsuz-spinner koruması yalnız orada gerekli).
  const u = reqUrl(input);
  if (u.includes("/storage/v1/")) return fetch(input, init);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      global: { fetch: fetchWithTimeout },
      auth: {
        autoRefreshToken: isNativeApp || hasBrowserStorage,
        storage: authStorage,
        persistSession: isNativeApp || hasBrowserStorage,
        // Web'de Google/OAuth dönüşünde URL'deki #access_token'ı işleyip oturumu
        // kurar. SSR (window yok) sırasında kapalı kalır.
        detectSessionInUrl: hasBrowserStorage,
        // Statik SPA'da Google girişi: PKCE akışı sunucudaki flow_state'e bağlı
        // olduğundan zaman zaman "bad_oauth_state" hatası veriyordu. Implicit akış
        // oturumu doğrudan URL hash'inde döndürür; flow_state'e bağımlılık yok.
        flowType: "implicit"
      }
    })
  : null;
