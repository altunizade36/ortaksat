/** 81 il + ilçe kapsam denetimi (gerçek TR verisiyle karşılaştırır). */
import { provinces, districts } from "../data/tr-locations";
const districtsOf = (pid: number) => districts.filter((d) => d.provinceId === pid);

// TR resmî: 81 il. İlçe sayıları (2024, TÜİK/İçişleri) — il başına beklenen ilçe adedi.
const EXPECTED: Record<string, number> = {
  Adana: 15, Adıyaman: 9, Afyonkarahisar: 18, Ağrı: 8, Aksaray: 8, Amasya: 7, Ankara: 25, Antalya: 19,
  Ardahan: 6, Artvin: 8, Aydın: 17, Balıkesir: 20, Bartın: 4, Batman: 6, Bayburt: 3, Bilecik: 8,
  Bingöl: 8, Bitlis: 7, Bolu: 9, Burdur: 11, Bursa: 17, Çanakkale: 12, Çankırı: 12, Çorum: 14,
  Denizli: 19, Diyarbakır: 17, Düzce: 8, Edirne: 9, Elazığ: 11, Erzincan: 9, Erzurum: 20,
  Eskişehir: 14, Gaziantep: 9, Giresun: 16, Gümüşhane: 6, Hakkâri: 4, Hatay: 15, Iğdır: 4,
  Isparta: 13, İstanbul: 39, İzmir: 30, Kahramanmaraş: 11, Karabük: 6, Karaman: 6, Kars: 8,
  Kastamonu: 20, Kayseri: 16, Kırıkkale: 9, Kırklareli: 8, Kırşehir: 7, Kilis: 4, Kocaeli: 12,
  Konya: 31, Kütahya: 13, Malatya: 13, Manisa: 17, Mardin: 10, Mersin: 13, Muğla: 13, Muş: 6,
  Nevşehir: 8, Niğde: 6, Ordu: 19, Osmaniye: 7, Rize: 12, Sakarya: 16, Samsun: 17, Siirt: 7,
  Sinop: 9, Sivas: 17, Şanlıurfa: 13, Şırnak: 7, Tekirdağ: 11, Tokat: 12, Trabzon: 18,
  Tunceli: 8, Uşak: 6, Van: 13, Yalova: 6, Yozgat: 14, Zonguldak: 8
};

const have = provinces;
console.log(`İL SAYISI: ${have.length} (beklenen 81)`);

const haveNames = have.map((p) => p.name);
const expNames = Object.keys(EXPECTED);
const missingProv = expNames.filter((n) => !haveNames.some((h) => h.localeCompare(n, "tr") === 0));
const extraProv = haveNames.filter((n) => !expNames.some((e) => e.localeCompare(n, "tr") === 0));
if (missingProv.length) console.log(`!! EKSİK İLLER (${missingProv.length}): ${missingProv.join(", ")}`);
if (extraProv.length) console.log(`?? FAZLA/FARKLI İSİM (${extraProv.length}): ${extraProv.join(", ")}`);
if (!missingProv.length && !extraProv.length) console.log("ok tüm 81 il mevcut");

let totalHave = 0, totalExp = 0;
const bad: Array<{ il: string; var: number; bekl: number }> = [];
have.forEach((p) => {
  const d = districtsOf(p.id);
  const exp = EXPECTED[expNames.find((e) => e.localeCompare(p.name, "tr") === 0) ?? ""] ?? 0;
  totalHave += d.length;
  totalExp += exp;
  if (exp && d.length < exp) bad.push({ il: p.name, var: d.length, bekl: exp });
});

console.log(`\nİLÇE TOPLAMI: ${totalHave} (beklenen ~${totalExp})`);
if (bad.length) {
  console.log(`\n!! İLÇESİ EKSİK İLLER (${bad.length}):`);
  bad.sort((a, b) => (b.bekl - b.var) - (a.bekl - a.var))
    .forEach((b) => console.log(`   ${b.il.padEnd(18)} var=${String(b.var).padStart(3)}  beklenen=${String(b.bekl).padStart(3)}  EKSİK=${b.bekl - b.var}`));
} else {
  console.log("ok tüm illerin ilçeleri tam");
}
