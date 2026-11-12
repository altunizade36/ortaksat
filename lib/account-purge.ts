import { supabase } from "@/lib/supabase";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const attempted = new Set<string>();

/**
 * Kalıcı silinmiş bir hesabın depodaki dosyalarını (profil fotoğrafı, ilan görselleri/videoları,
 * yorum medyası) temizler. İş `purge-account-files` sunucu fonksiyonunda yapılır: yalnız yönetici
 * oturumu ve yalnız `status = 'deleted'` hesaplar kabul edilir; karşı tarafın mesaj geçmişindeki
 * sohbet ekleri korunur. Tekrar çağırmak zararsızdır; oturum başına hesap başına bir kez denenir.
 */
export async function purgeDeletedAccountFiles(userId: string): Promise<boolean> {
  if (!supabase || !uuidPattern.test(userId) || attempted.has(userId)) return false;
  attempted.add(userId);
  try {
    const { data, error } = await supabase.functions.invoke("purge-account-files", { body: { userId } });
    if (error) { attempted.delete(userId); return false; }
    return (data as { ok?: boolean } | null)?.ok === true;
  } catch {
    attempted.delete(userId);
    return false;
  }
}
