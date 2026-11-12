-- Olcek: katalog sorgusunun kategori kapisi (kok + form semasi) indeksli calissin.
create index if not exists listings_root_fold_idx on public.listings (public.mobile_filter_fold(attributes ->> '_root')) where deleted_at is null;
create index if not exists listings_form_key_idx on public.listings ((attributes ->> '_formKey')) where deleted_at is null;
create index if not exists listings_status_price_idx on public.listings (status, price);