import { supabase } from "@/lib/supabase";

/**
 * Kurumsal hesap bilgileri (public.business_accounts). Yalnız hesap sahibi okur ve yazar (RLS).
 * Vergi / TC kimlik numarası BİLEREK yoktur. Mağazada görünen ad profil adıdır; buradaki ad beyandır.
 */
export type BusinessAccount = { name: string; type: "sahis" | "sirket"; contactName: string; city: string; activity: string; phone: string };

/** Kurumsal Hesap Sözleşmesi'nin kabul edilen sürümü (kayıt ekranı ve hesap ayarları aynı değeri yazar). */
export const BUSINESS_CONTRACT_VERSION = "2026-11-25";

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** `ok: false` = okunamadı (bağlantı/sunucu); `account: null` = hesap bireysel. */
export async function loadBusinessAccount(userId: string): Promise<{ ok: boolean; account: BusinessAccount | null; contractVersion: string }> {
  if (!supabase || !userId) return { ok: false, account: null, contractVersion: "" };
  try {
    const { data, error } = await supabase.from("business_accounts").select("business_name,business_type,contact_name,city,activity,phone,contract_version").eq("user_id", userId).maybeSingle();
    if (error) return { ok: false, account: null, contractVersion: "" };
    if (!data) return { ok: true, account: null, contractVersion: "" };
    return { ok: true, contractVersion: text(data.contract_version), account: { name: text(data.business_name), type: data.business_type === "sirket" ? "sirket" : "sahis", contactName: text(data.contact_name), city: text(data.city), activity: text(data.activity), phone: text(data.phone) } };
  } catch {
    return { ok: false, account: null, contractVersion: "" };
  }
}

/** `isNew`: bireysel hesap kurumsala geçiyor (sözleşme sürümü ve kabul zamanı yazılır). Güncellemede bunlara dokunulmaz. */
export async function saveBusinessAccount(userId: string, account: BusinessAccount, isNew: boolean): Promise<boolean> {
  if (!supabase || !userId) return false;
  const clean = (value: string, max: number) => (value.trim() ? value.trim().slice(0, max) : null);
  const fields = {
    business_name: account.name.trim().slice(0, 120),
    business_type: account.type === "sirket" ? "sirket" : "sahis",
    contact_name: account.contactName.trim().slice(0, 120),
    city: clean(account.city, 60),
    activity: clean(account.activity, 80),
    phone: clean(account.phone, 24),
    updated_at: new Date().toISOString()
  };
  try {
    if (isNew) {
      const { error } = await supabase.from("business_accounts").insert({ user_id: userId, ...fields, contract_version: BUSINESS_CONTRACT_VERSION });
      return !error;
    }
    const { data, error } = await supabase.from("business_accounts").update(fields).eq("user_id", userId).select("user_id");
    return !error && Array.isArray(data) && data.length === 1;
  } catch {
    return false;
  }
}
