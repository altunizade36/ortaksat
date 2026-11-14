// Türkçe adres çevirisi denetimi: örnek adresler iki yönde doğru çevriliyor mu? (derleme betiği sürümü)
// Tarayıcıdaki başlangıç betiği aynı örneklerle `URL_ALIAS_CASES` üzerinden sınanır (bkz. e2e / tarayıcı denetimi).
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { toPublicUrl, toInternalUrl } from "./url-aliases.mjs";

/** [iç adres, Türkçe adres] */
export const URL_ALIAS_CASES = [
  ["/partner?tab=requests", "/ortak-satis?sekme=talepler"],
  ["/partner?tab=discover", "/ortak-satis?sekme=kesfet"],
  ["/partner?view=advanced&focus=abc", "/ortak-satis?gorunum=ayrintili&focus=abc"],
  ["/partner?listingId=123&tab=active", "/ortak-satis?ilan=123&sekme=ortakliklarim"],
  ["/partnership/abc", "/ortaklik/abc"],
  ["/partnership-request/abc", "/ortaklik-basvurusu/abc"],
  ["/listing/0bf4-1c94", "/ilan/0bf4-1c94"],
  ["/listing/0bf4?ortak-davet=x1#yorumlar", "/ilan/0bf4?ortak-davet=x1#yorumlar"],
  ["/listing-edit/9?section=partnership", "/ilan-duzenle/9?section=partnership"],
  ["/store/77", "/magaza/77"],
  ["/explore?q=granit%20k%C3%BCpta%C5%9F", "/kesfet?ara=granit%20k%C3%BCpta%C5%9F"],
  ["/explore-feed/5", "/kesfet-akisi/5"],
  ["/create", "/ilan-ver"],
  ["/auth?redirect=%2Flisting%2F5", "/giris?redirect=%2Flisting%2F5"],
  ["/notifications", "/bildirimler"],
  ["/notification-settings", "/bildirim-ayarlari"],
  ["/profile-edit", "/profil-duzenle"],
  ["/", "/"],
  ["/kategori/emlak", "/kategori/emlak"],
  ["/ortaklar", "/ortaklar"],
  ["/ortak/abc", "/ortak/abc"],
  ["/magaza-sirasi", "/magaza-sirasi"],
  ["/_expo/static/js/web/entry-abc.js", "/_expo/static/js/web/entry-abc.js"],
  ["/partnerx", "/partnerx"]
];

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const [internal, pub] of URL_ALIAS_CASES) {
    assert.equal(toPublicUrl(internal), pub, `iç → Türkçe: ${internal}`);
    assert.equal(toInternalUrl(pub), internal, `Türkçe → iç: ${pub}`);
  }
  console.log(`adres çevirisi doğru: ${URL_ALIAS_CASES.length} örnek, iki yön`);
}
