/**
 * İŞLETME TANITICI BİLGİLERİ — tek merkezden.
 *
 * 5651 sayılı Kanun md. 3 ve 6563 sayılı Kanun uyarınca sitede işletmeyi tanıtan bilgiler (unvan ya da
 * ad-soyad, adres, e-posta, telefon; varsa MERSİS, vergi dairesi/no, KEP) erişilebilir olmalıdır.
 * KVKK md. 10 uyarınca veri sorumlusunun kimliği de aydınlatma metninde yer almalıdır.
 *
 * KARAR (kurucu, 25 Kasım 2026): tanıtıcı olarak YALNIZ marka adı ("OrtakSat") ve destek e-postası gösterilir.
 * Kurucunun adı-soyadı, adresi ve telefonu güvenlik gerekçesiyle YAYIMLANMAZ; şirket kurulmadığı için MERSİS,
 * vergi no ve KEP yoktur. Bu alanları doldurma, kullanıcıya yeniden sorma. UYDURMA DEĞER YAZILMAZ (sahte veri
 * yasağı). Boş alanlar sitede HİÇ gösterilmez. İleride şirket kurulursa yalnız bu dosya doldurulur;
 * İletişim sayfası ve KVKK Aydınlatma Metni kendiliğinden günceller.
 */
import { SUPPORT_EMAIL } from "@/lib/contact";

export const COMPANY = {
  /** Tanıtıcı ad. Şirket yok → marka adı; "Unvan" diye değil "Platform" diye gösterilir (tescilli unvan izlenimi vermesin). */
  legalName: "OrtakSat",
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
  add("Platform", COMPANY.legalName);
  add("Adres", COMPANY.address);
  add("Telefon", COMPANY.phone);
  add("MERSİS No", COMPANY.mersis);
  add("Vergi Dairesi / No", [COMPANY.taxOffice, COMPANY.taxNo].filter((v) => v.trim()).join(" / "));
  add("KEP", COMPANY.kep);
  add("E-posta", COMPANY.email);
  return rows;
}

/** Tanıtıcı blok gösterilsin mi? (ad varsa; adres artık koşul değil — yukarıdaki karar) */
export function hasCompanyIdentity(): boolean {
  return Boolean(COMPANY.legalName.trim());
}
