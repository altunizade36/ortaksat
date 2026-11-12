import { useCallback } from "react";
import { usePathname, useRouter, type Href } from "expo-router";
import { backFallback } from "./back-navigation";

/** Prefer the navigator's real history; never replace a previous screen with home. */
export function useBackNavigation(fallback?: Href) {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback ?? (backFallback(pathname) as Href));
  }, [router, pathname, fallback]);
}
