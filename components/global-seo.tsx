import { usePathname } from "expo-router";
import Head from "expo-router/head";

import { useStore } from "@/lib/use-store";

/**
 * Admin panelden girilen sayfa-bazlı SEO ayarlarını (seo_settings) mevcut route'un
 * <head>'ine uygular. Root layout'ta bir kez render edilir; pathname değiştikçe
 * eşleşen ayarı bulur. Eşleşme yoksa hiçbir şey enjekte etmez (sayfanın kendi
 * Head'i geçerli kalır).
 */
export function GlobalSeo() {
  const pathname = usePathname();
  const { seoSettings } = useStore();
  const s = seoSettings.find((x) => x.path === pathname);
  if (!s) return null;
  return (
    <Head>
      {s.metaTitle ? <title>{s.metaTitle}</title> : null}
      {s.metaDescription ? <meta name="description" content={s.metaDescription} /> : null}
      {s.metaTitle ? <meta property="og:title" content={s.metaTitle} /> : null}
      {s.metaDescription ? <meta property="og:description" content={s.metaDescription} /> : null}
      {s.ogImage ? <meta property="og:image" content={s.ogImage} /> : null}
      {s.noindex ? <meta name="robots" content="noindex, nofollow" /> : null}
    </Head>
  );
}
