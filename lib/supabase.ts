import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

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

const authStorage = hasBrowserStorage
  ? (typeof window.sessionStorage !== "undefined" ? rememberAwareWebStorage : AsyncStorage)
  : undefined;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: hasBrowserStorage,
        storage: authStorage,
        persistSession: hasBrowserStorage,
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
