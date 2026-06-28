import * as Linking from "expo-linking";

import { supabase } from "@/lib/supabase";

function paramsFromUrl(url: string) {
  const [, fragment = ""] = url.split("#");
  const query = url.includes("?") ? (url.split("?")[1]?.split("#")[0] ?? "") : "";
  return new URLSearchParams(fragment || query);
}

export async function handleSupabaseAuthUrl(url: string) {
  if (!supabase) return false;

  const params = paramsFromUrl(url);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return false;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  return !error;
}

export async function getInitialAuthUrl() {
  return Linking.getInitialURL();
}

export function subscribeToAuthUrls(listener: (url: string) => void) {
  const subscription = Linking.addEventListener("url", ({ url }) => listener(url));
  return () => subscription.remove();
}
