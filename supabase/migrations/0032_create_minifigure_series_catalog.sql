create table if not exists public.minifigure_series_catalog (
  theme_id integer primary key,
  name text not null,
  parent_theme_id integer null,
  year_from integer null,
  year_to integer null,
  set_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.minifigure_series_catalog enable row level security;

drop policy if exists minifigure_series_catalog_select_auth on public.minifigure_series_catalog;
create policy minifigure_series_catalog_select_auth
on public.minifigure_series_catalog
for select
using (auth.uid() is not null);
