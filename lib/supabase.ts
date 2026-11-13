import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

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

// NATIVE OTURUM DEPOSU — Keychain (iOS) / Keystore (Android) üzerinden expo-secure-store.
// Eskiden oturum (erişim + yenileme token'ı) AsyncStorage'da DÜZ METİN duruyordu. SecureStore
// tek değerde ~2048 bayt sınırına sahip, oturum JSON'u ise 2-5 KB → değer PARÇALARA bölünür:
//   <key>.idx        → "<nesil>:<parça sayısı>"  (küçük dizin anahtarı; yazımın "commit" noktası)
//   <key>.<nesil>.<i> → i. parça (≤ SECURE_CHUNK_BYTES bayt)
// Nesil (a/b) dönüşümlü: yeni parçalar ÖNCE diğer nesle yazılır, dizin en son güncellenir →
// yazım yarıda kesilirse eski oturum bozulmadan okunur.
// GEÇİŞ: AsyncStorage'da (eski sürümden ya da yedek yoldan) bir kopya varsa O geçerlidir; ilk
// okumada SecureStore'a taşınır ve AsyncStorage'dan silinir. SecureStore yoksa/hata verirse
// AsyncStorage'a düşülür (oturum asla kaybolmaz). WEB bu koda hiç girmez (aşağıdaki seçim).
type SecureStoreModule = typeof import("expo-secure-store");
let secureStoreModule: SecureStoreModule | null = null;
if (Platform.OS === "ios" || Platform.OS === "android") {
  try {
    // Koşullu require: web paketine girmez; native modülü olmayan eski bir geliştirme
    // derlemesinde import patlarsa uygulama çökmesin → AsyncStorage'a düşülür.
    secureStoreModule = require("expo-secure-store") as SecureStoreModule;
  } catch {
    secureStoreModule = null;
  }
}
const SECURE_CHUNK_BYTES = 1800;

function splitForSecureStore(value: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const pair = code >= 0xd800 && code <= 0xdbff && i + 1 < value.length; // vekil çift bölünmez
    const size = code < 0x80 ? 1 : code < 0x800 ? 2 : pair ? 4 : 3;
    if (bytes + size > SECURE_CHUNK_BYTES) {
      chunks.push(value.slice(start, i));
      start = i;
      bytes = 0;
    }
    bytes += size;
    if (pair) i++;
  }
  chunks.push(value.slice(start));
  return chunks;
}

let secureAvailable: Promise<boolean> | null = null;
function canUseSecureStore(): Promise<boolean> {
  if (!secureStoreModule) return Promise.resolve(false);
  if (!secureAvailable) secureAvailable = secureStoreModule.isAvailableAsync().catch(() => false);
  return secureAvailable;
}
function secureOptions(store: SecureStoreModule) {
  // Cihaz ilk kilit açılışından sonra okunabilir: uygulama arka planda/kilitliyken (bildirim)
  // açılırsa oturum "yok" sanılıp kullanıcı çıkış yapmış görünmesin.
  return { keychainAccessible: store.AFTER_FIRST_UNLOCK };
}
async function secureIndex(store: SecureStoreModule, key: string): Promise<{ gen: string; count: number } | null> {
  const raw = await store.getItemAsync(`${key}.idx`, secureOptions(store));
  const match = raw ? /^([ab]):(\d+)$/.exec(raw) : null;
  return match ? { gen: match[1], count: Number(match[2]) } : null;
}
async function secureGet(store: SecureStoreModule, key: string): Promise<string | null> {
  const index = await secureIndex(store, key);
  if (!index) return null;
  const parts = await Promise.all(Array.from({ length: index.count }, (_, i) => store.getItemAsync(`${key}.${index.gen}.${i}`, secureOptions(store))));
  return parts.some((part) => part == null) ? null : parts.join("");
}
async function secureSet(store: SecureStoreModule, key: string, value: string): Promise<void> {
  const previous = await secureIndex(store, key);
  const gen = previous?.gen === "a" ? "b" : "a";
  const chunks = splitForSecureStore(value);
  for (let i = 0; i < chunks.length; i++) await store.setItemAsync(`${key}.${gen}.${i}`, chunks[i], secureOptions(store));
  await store.setItemAsync(`${key}.idx`, `${gen}:${chunks.length}`, secureOptions(store));
  // Eski neslin parçaları artık gereksiz (temizlik başarısız olsa da okuma dizine göre yapılır).
  if (previous) await Promise.all(Array.from({ length: previous.count }, (_, i) => store.deleteItemAsync(`${key}.${previous.gen}.${i}`, secureOptions(store)).catch(() => {})));
}
async function secureRemove(store: SecureStoreModule, key: string): Promise<void> {
  const index = await secureIndex(store, key).catch(() => null);
  await store.deleteItemAsync(`${key}.idx`, secureOptions(store));
  if (index) await Promise.all(Array.from({ length: index.count }, (_, i) => store.deleteItemAsync(`${key}.${index.gen}.${i}`, secureOptions(store)).catch(() => {})));
}

async function loadNativeItem(key: string): Promise<string | null> {
  const store = (await canUseSecureStore()) ? secureStoreModule : null;
  if (!store) return AsyncStorage.getItem(key);
  // AsyncStorage'da kopya varsa (eski sürüm / yedek yol) EN GÜNCEL odur: taşı ve sil.
  const legacy = await AsyncStorage.getItem(key).catch(() => null);
  if (legacy != null) {
    try {
      await secureSet(store, key, legacy);
      await AsyncStorage.removeItem(key);
    } catch {
      /* taşınamadı → AsyncStorage'da kalır, sonraki açılışta yeniden denenir */
    }
    return legacy;
  }
  try {
    return await secureGet(store, key);
  } catch {
    return null;
  }
}

// Bellek kopyası: supabase-js HER istekte oturumu depodan okur; her okumada birkaç Keychain/
// Keystore çağrısı yapmak açılıştaki paralel istekleri yavaşlatırdı. Depoya yalnız bu adaptör
// yazdığı için (tek süreç) bellek kopyası her zaman günceldir; ilk okuma diskten yapılır.
const nativeItemCache = new Map<string, string | null>();
const nativeItemLoads = new Map<string, Promise<string | null>>();

const nativeSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (nativeItemCache.has(key)) return nativeItemCache.get(key) ?? null;
    let load = nativeItemLoads.get(key);
    if (!load) {
      load = loadNativeItem(key)
        .then((value) => {
          // Yükleme sürerken set/remove çağrıldıysa onların yazdığı değer geçerlidir.
          if (!nativeItemCache.has(key)) nativeItemCache.set(key, value);
          return nativeItemCache.get(key) ?? null;
        })
        .finally(() => { nativeItemLoads.delete(key); });
      nativeItemLoads.set(key, load);
    }
    return load;
  },
  async setItem(key: string, value: string): Promise<void> {
    nativeItemCache.set(key, value);
    const store = (await canUseSecureStore()) ? secureStoreModule : null;
    if (store) {
      try {
        await secureSet(store, key, value);
        await AsyncStorage.removeItem(key).catch(() => {});
        return;
      } catch {
        /* SecureStore yazamadı → oturum kaybolmasın diye AsyncStorage'a düş */
      }
    }
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    nativeItemCache.set(key, null);
    const store = (await canUseSecureStore()) ? secureStoreModule : null;
    if (store) await secureRemove(store, key).catch(() => {});
    await AsyncStorage.removeItem(key);
  }
};

const authStorage = isNativeApp
  ? nativeSecureStorage
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
  // XML bağlantısı işlevleri karşı siteden dosya indirir (kendi 25 sn sınırı var) → 15 sn'lik kesme uygulanmaz.
  if (u.includes("/functions/v1/feed-")) return fetch(input, init);
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

export type StoredAuthUser = {
  id: string;
  phone?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: { full_name?: string; avatar_url?: string; picture?: string } | null;
};

/**
 * NATIVE: cihazda saklı oturumun kullanıcısı (ağ GEREKTİRMEZ). auth-js, yenileme isteği AĞ
 * hatasıyla başarısız olunca oturumu depoda bırakır ama çağırana `session: null` döner;
 * gerçek çıkışta/geçersiz token'da ise depoyu siler. Yani bu fonksiyon değer döndürüyorsa
 * "oturum var ama şu an doğrulanamadı (çevrimdışı)" demektir → kullanıcı çıkmış SAYILMAMALI.
 * Web'de her zaman null (web davranışı değişmez).
 */
export async function readStoredAuthUser(): Promise<StoredAuthUser | null> {
  if (!isNativeApp || !supabaseUrl) return null;
  try {
    // supabase-js'in varsayılan anahtarıyla AYNI (storageKey özelleştirilmedi).
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
    const raw = await nativeSecureStorage.getItem(storageKey);
    const user = raw ? (JSON.parse(raw) as { user?: StoredAuthUser } | null)?.user : null;
    return user && typeof user.id === "string" && user.id ? user : null;
  } catch {
    return null;
  }
}

// One client owns token refresh; backgrounding the app does not discard its persisted session.
if (isNativeApp && supabase) {
  const client = supabase;
  AppState.addEventListener("change", state => {
    if (state === "active") client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
}
