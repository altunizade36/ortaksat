import aliases from "@/data/url-aliases.json";

/**
 * TÜRKÇE ADRESLER — uygulamanın İÇ rota adları İngilizce (dosya adları: /partner, /listing/[id], ?tab=requests…),
 * kullanıcının ve arama motorlarının gördüğü adresler Türkçe (/ortak-satis, /ilan/…, ?sekme=talepler).
 *
 * Kullanıcı 2026-11-14'te adres çubuğunda ve arama sonuçlarında İngilizce adres görmek istemediğini söyledi.
 * Yüzlerce `router.push("/partner…")` çağrısını ve rota dosyalarını yeniden adlandırmak yerine TEK bir çeviri
 * katmanı var; eşleme `data/url-aliases.json`'dadır ve dört yerde kullanılır:
 *   1. Tarayıcı: `app/+html.tsx` içindeki başlangıç betiği adres çubuğunu Türkçe gösterir, Türkçe adresle gelen
 *      ziyaretçiyi iç rotaya çevirir (bkz. `urlAliasBootScript`).
 *   2. Sunucu: `vercel.json` — eski İngilizce adres Türkçesine kalıcı yönlenir, Türkçe adres aynı sayfayı sunar
 *      (`node scripts/sync-url-aliases.mjs` ile üretilir).
 *   3. Arama motorları: kanonik adresler, site haritası ve sayfa içi bağlantılar Türkçe yazılır (scripts/*.mjs).
 *   4. Uygulama: paylaşılan Türkçe bağlantı uygulamada açılınca iç rotaya çevrilir (`app/+native-intent.tsx`).
 *
 * Yeni bir İngilizce rota eklenirse eşlemeye de eklenmeli; yoksa o sayfa İngilizce adresle görünür (bozulmaz).
 * ÖNEMLİ: `paths` içinde uzun ön ek ÖNCE gelmelidir (/partnership-request, /partnership, /partner).
 */
type AliasData = { paths: [string, string][]; params: Record<string, string>; values: Record<string, Record<string, string>> };
const data = aliases as unknown as AliasData;

function convert(url: string, toInternal: boolean): string {
  if (typeof url !== "string" || url[0] !== "/") return url;
  const hashAt = url.indexOf("#");
  const hash = hashAt >= 0 ? url.slice(hashAt) : "";
  const rest = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const queryAt = rest.indexOf("?");
  let path = queryAt >= 0 ? rest.slice(0, queryAt) : rest;
  const query = queryAt >= 0 ? rest.slice(queryAt + 1) : "";
  for (const [internal, pub] of data.paths) {
    const from = toInternal ? pub : internal;
    const to = toInternal ? internal : pub;
    if (path === from || path.startsWith(from + "/")) { path = to + path.slice(from.length); break; }
  }
  if (!query) return path + hash;
  const pairs = query.split("&").map((pair) => {
    const eq = pair.indexOf("=");
    const key = eq >= 0 ? pair.slice(0, eq) : pair;
    const value = eq >= 0 ? pair.slice(eq + 1) : "";
    // İç anahtar: çeviri yönüne göre bulunur; değer eşlemesi her zaman İÇ anahtara göredir.
    const internalKey = toInternal ? (Object.keys(data.params).find((k) => data.params[k] === key) ?? key) : key;
    const outKey = toInternal ? internalKey : (data.params[key] ?? key);
    const map = data.values[internalKey];
    let outValue = value;
    if (map) outValue = toInternal ? (Object.keys(map).find((k) => map[k] === value) ?? value) : (map[value] ?? value);
    return eq >= 0 ? `${outKey}=${outValue}` : outKey;
  });
  return `${path}?${pairs.join("&")}${hash}`;
}

/** İç adres → kullanıcının gördüğü Türkçe adres ("/partner?tab=requests" → "/ortak-satis?sekme=talepler"). */
export function toPublicUrl(internalUrl: string): string { return convert(internalUrl, false); }
/** Türkçe adres → iç rota ("/ilan/123" → "/listing/123"). Eski İngilizce adres olduğu gibi kalır. */
export function toInternalUrl(publicUrl: string): string { return convert(publicUrl, true); }

/**
 * Tarayıcıda uygulama paketi yüklenmeden ÖNCE çalışan betik (app/+html.tsx satır içi yazar).
 *  • history.pushState/replaceState sarılır: yönlendirici iç adres yazar, adres çubuğunda Türkçesi görünür.
 *  • Sayfa Türkçe adresle açıldıysa, ertelenmiş betikler çalışmadan hemen önce adres iç rotaya çevrilir
 *    (yönlendirici iç adresi okur); yönlendiricinin ilk yazışında yeniden Türkçeye döner.
 *  • Geri/ileri (popstate): yönlendirici adresi okumadan önce iç rotaya çevrilir, sonra Türkçeye döndürülür.
 * Mantık yukarıdaki `convert` ile AYNIDIR (ES5; test: scripts/check-url-aliases.mjs).
 */
export const urlAliasBootScript =
  "(function(){try{var D=" + JSON.stringify(data) + ";" +
  "function cv(u,ti){if(typeof u!=='string'||u.charAt(0)!=='/')return u;var hi=u.indexOf('#'),h=hi>=0?u.slice(hi):'',r=hi>=0?u.slice(0,hi):u,qi=r.indexOf('?'),p=qi>=0?r.slice(0,qi):r,q=qi>=0?r.slice(qi+1):'';" +
  "for(var i=0;i<D.paths.length;i++){var f=ti?D.paths[i][1]:D.paths[i][0],t=ti?D.paths[i][0]:D.paths[i][1];if(p===f||p.indexOf(f+'/')===0){p=t+p.slice(f.length);break;}}" +
  "if(!q)return p+h;var out=q.split('&').map(function(pair){var e=pair.indexOf('='),k=e>=0?pair.slice(0,e):pair,v=e>=0?pair.slice(e+1):'',ik=k,x;" +
  "if(ti){for(x in D.params)if(D.params[x]===k){ik=x;break;}}var ok=ti?ik:(D.params[k]||k),m=D.values[ik],ov=v;" +
  "if(m){if(ti){for(x in m)if(m[x]===v){ov=x;break;}}else ov=m[v]||v;}return e>=0?ok+'='+ov:ok;});return p+'?'+out.join('&')+h;}" +
  "var H=window.history,oP=H.pushState,oR=H.replaceState;function cur(){return location.pathname+location.search+location.hash;}" +
  "function inward(){var c=cur(),n=cv(c,true);if(n!==c){oR.call(H,H.state,'',n);return true;}return false;}" +
  "function outward(){var c=cur(),n=cv(c,false);if(n!==c)oR.call(H,H.state,'',n);}" +
  "H.pushState=function(s,t,u){return oP.call(H,s,t,typeof u==='string'?cv(u,false):u);};" +
  "H.replaceState=function(s,t,u){return oR.call(H,s,t,typeof u==='string'?cv(u,false):u);};" +
  "if(document.readyState==='loading'){document.addEventListener('readystatechange',function once(){if(document.readyState!=='loading'){document.removeEventListener('readystatechange',once);inward();}});}else inward();" +
  "window.addEventListener('popstate',function(){if(inward())setTimeout(outward,0);},true);" +
  // Sayfa içi bağlantılar (<a href>) da Türkçe görünsün: yeni sekmede aç / bağlantıyı kopyala doğru adresi versin.
  "function fix(a){var h=a.getAttribute&&a.getAttribute('href');if(h&&h.charAt(0)==='/'&&h.charAt(1)!=='/'){var n=cv(h,false);if(n!==h)a.setAttribute('href',n);}}" +
  "function scan(n){if(!n||n.nodeType!==1)return;if(n.tagName==='A')fix(n);var l=n.querySelectorAll?n.querySelectorAll('a[href]'):[];for(var i=0;i<l.length;i++)fix(l[i]);}" +
  "if(window.MutationObserver){new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var m=ms[i];if(m.type==='attributes')fix(m.target);else for(var j=0;j<m.addedNodes.length;j++)scan(m.addedNodes[j]);}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});}" +
  "window.__osUrl={toPublic:function(u){return cv(u,false);},toInternal:function(u){return cv(u,true);}};" +
  "}catch(e){}})();";
