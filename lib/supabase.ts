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

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: hasBrowserStorage,
        storage: hasBrowserStorage ? AsyncStorage : undefined,
        persistSession: hasBrowserStorage,
        // Web'de Google/OAuth dönüşünde URL'deki #access_token'ı işleyip oturumu
        // kurar. SSR (window yok) sırasında kapalı kalır.
        detectSessionInUrl: hasBrowserStorage
      }
    })
  : null;
