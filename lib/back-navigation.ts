/** Only used when a screen was opened directly, without a previous app screen. */
export function backFallback(pathname: string): string {
  if (/^\/kategori\//.test(pathname)) return "/kategoriler";
  if (/^\/listing-edit\//.test(pathname)) return "/seller";
  if (/^\/(listing|store|i)\//.test(pathname)) return "/explore";
  if (/^\/chat\//.test(pathname)) return "/messages";
  if (/^\/(partnership|partnership-request)\//.test(pathname) || pathname === "/earnings") return "/partner";
  if (pathname === "/profile-edit" || pathname === "/account-settings") return "/profile";
  if (["/account-security", "/notification-settings", "/engellenenler"].includes(pathname)) return "/account-settings";
  if (["/report", "/review", "/reports"].includes(pathname)) return "/profile";
  if (["/hakkimizda", "/sss", "/iletisim", "/kvkk", "/gizlilik-politikasi", "/kullanim-sartlari", "/support", "/mobile-tools", "/market-tools"].includes(pathname)) return "/menu";
  return "/";
}
