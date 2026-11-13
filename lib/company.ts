/**
 * İŞLETME TANITICI BİLGİLERİ — tek merkezden.
 *
 * 5651 sayılı Kanun md. 3 ve 6563 sayılı Kanun uyarınca sitede işletmeyi tanıtan bilgiler (unvan ya da
 * ad-soyad, adres, e-posta, telefon; varsa MERSİS, vergi dairesi/no, KEP) erişilebilir olmalıdır.
 * KVKK md. 10 uyarınca veri sorumlusunun kimliği de aydınlatma metninde yer almalıdır.
 *
 * ŞU AN BOŞ: bu bilgileri yalnız işletme sahibi verebilir; UYDURMA DEĞER YAZILMAZ (sahte veri yasağı).
 * Boş alanlar sitede HİÇ gösterilmez. Sahibi bilgileri verdiğinde yalnız bu dosya doldurulur;
 * İletişim sayfası ve KVKK Aydınlatma Metni kendiliğinden günceller.
 */
import { SUPPORT_EMAIL } from "@/lib/contact";

export const COMPANY = {
  /** Ticaret unvanı ya da (şahıs işletmesi / birey ise) ad-soyad. */
  legalName: "",
  /** Tebligata elverişli açık adres. */
  address: "",
  /** İletişim telefonu. */
  phone: "",
  /** MERSİS numarası (şirket ise). */
  mersis: "",
  /** Vergi dairesi ve vergi kimlik numarası. */
  taxOffice: "",
  taxNo: "",
  /** Kayıtlı elektronik posta (KEP) adresi. */
  kep: "",
  email: SUPPORT_EMAIL
} as const;

export type CompanyRow = { label: string; value: string };

/** Yalnız DOLU alanları döndürür. Marka adı ve e-posta her zaman vardır. */
export function companyIdentityRows(): CompanyRow[] {
  const rows: CompanyRow[] = [];
  const add = (label: string, value: string) => { if (value.trim()) rows.push({ label, value: value.trim() }); };
  add("Unvan", COMPANY.legalName);
  add("Adres", COMPANY.address);
  add("Telefon", COMPANY.phone);
  add("MERSİS No", COMPANY.mersis);
  add("Vergi Dairesi / No", [COMPANY.taxOffice, COMPANY.taxNo].filter((v) => v.trim()).join(" / "));
  add("KEP", COMPANY.kep);
  add("E-posta", COMPANY.email);
  return rows;
}

/** Yasal tanıtıcı bilgiler girilmiş mi? (unvan + adres asgari koşul) */
export function hasCompanyIdentity(): boolean {
  return Boolean(COMPANY.legalName.trim() && COMPANY.address.trim());
}
