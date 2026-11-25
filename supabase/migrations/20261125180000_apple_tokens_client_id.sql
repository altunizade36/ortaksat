-- Apple yenileme belirteci hangi istemci kimliğiyle alındıysa (uygulama: com.ortaksat.app, web/Android tarayıcı
-- yönlendirmesi: com.ortaksat.web) iptal de onunla yapılmalı. Boş değer = uygulama kimliği (eski kayıtlar).
alter table public.apple_tokens add column if not exists client_id text;
