-- Arama ölçeklenebilirliği: searchListings, title/description/category/location
-- üzerinde ILIKE '*token*' (öndeki joker) kullanıyor. Btree bunu kullanamaz →
-- binlerce+ ilanda tam tablo taraması. pg_trgm GIN indeksleri öndeki-jokerli
-- ILIKE'yi indeksten karşılar (BitmapOr ile 4 kolon OR'u da hızlanır).
create extension if not exists pg_trgm;

create index if not exists listings_title_trgm on listings using gin (title gin_trgm_ops);
create index if not exists listings_description_trgm on listings using gin (description gin_trgm_ops);
create index if not exists listings_category_trgm on listings using gin (category gin_trgm_ops);
create index if not exists listings_location_trgm on listings using gin (location gin_trgm_ops);
