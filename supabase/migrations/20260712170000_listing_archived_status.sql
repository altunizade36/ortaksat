-- OrtakSat — İlan kaldırma/silme güçlendirme: 'archived' durumu.
-- Kullanıcı ilanını sildiğinde: finansal/ilişki geçmişi YOKSA gerçekten silinir;
-- VARSA (komisyon/sipariş FK'si NO ACTION → hard delete başarısız olur, partnership/lead
-- CASCADE ile geçmiş kaybolur) ilan ARŞİVLENİR — her yerden gizlenir, satır+geçmiş korunur.
-- removeListingLive() önce delete dener, FK (23503) hatasında status='archived' yapar.
alter type public.listing_status add value if not exists 'archived';
