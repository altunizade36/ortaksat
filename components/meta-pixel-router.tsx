import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";

import { metaPageView } from "@/lib/meta-pixel";

/**
 * SPA gezinmesinde Meta Pixel PageView'ı gönderir.
 * Base pixel (app/+html.tsx) yalnız İLK belge yüklemesinde PageView sayar; expo-router
 * istemci-taraflı gezinmede sayfa yeniden yüklenmez → reklam huni sayfaları (ilan detay,
 * kategori, arama…) sayılmazdı. Bu bileşen path değişince PageView'ı tekrar gönderir.
 * İLK mount ATLANIR (base kod o görüntülemeyi zaten saydı → çift sayım olmaz).
 * fbq yoksa metaPageView sessiz no-op (native + ID'siz web güvenli).
 */
export function MetaPixelRouter() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    metaPageView();
  }, [pathname]);
  return null;
}
