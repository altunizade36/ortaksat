-- ---------------------------------------------------------------------------
-- MODEL: NORMAL İLAN (komisyonsuz) — partnership_mode enum'una 'none' eklenir.
-- SORUN: Platform modeli "satıcı isterse komisyon belirlemeden yalnızca NORMAL İLAN
-- yayınlayabilir" diyor ve istemci tipi (PartnershipMode) 'none' destekliyordu; create/edit
-- ekranlarına "Normal ilan" seçeneği eklendi. ANCAK DB enum'unda 'none' YOKTU
-- (open/approval/invite) → "Normal ilan" seçip yayınlayan satıcının insert'i enum hatasıyla
-- REDDEDİLİYORDU (özellik uçtan uca kırık).
-- ---------------------------------------------------------------------------
alter type public.partnership_mode add value if not exists 'none';
