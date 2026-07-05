-- =====================================================================
-- Kullanıcı kendi aktivite/giriş geçmişini görebilsin (Güvenlik ekranı).
-- Şimdiye kadar activity_logs yalnızca admin tarafından okunabiliyordu;
-- burada kullanıcıya SADECE kendi satırlarını okuma izni ekliyoruz.
-- Admin okuma politikası aynen korunur (iki policy OR'lanır).
-- =====================================================================
drop policy if exists "users read own activity" on public.activity_logs;
create policy "users read own activity" on public.activity_logs
  for select using (user_id = auth.uid());
