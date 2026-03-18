create table if not exists public.minifigure_sets_catalog (
  set_num text primary key,
  name text not null,
  set_img_url text null,
  num_parts integer not null default 0,
  year integer null,
  theme_id integer not null references public.minifigure_series_catalog(theme_id) on update cascade on delete cascade,
  updated_at timestamptz not null default now(),
  constraint minifigure_sets_catalog_num_parts_non_negative check (num_parts >= 0)
);

create index if not exists minifigure_sets_catalog_theme_id_idx
on public.minifigure_sets_catalog (theme_id);

alter table public.minifigure_sets_catalog enable row level security;

drop policy if exists minifigure_sets_catalog_select_auth on public.minifigure_sets_catalog;
create policy minifigure_sets_catalog_select_auth
on public.minifigure_sets_catalog
for select
using (auth.uid() is not null);

create table if not exists public.minifigure_set_parts_catalog (
  set_num text not null references public.minifigure_sets_catalog(set_num) on update cascade on delete cascade,
  part_num text not null,
  part_name text not null,
  color_name text not null,
  part_img_url text null,
  quantity integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (set_num, part_num, color_name),
  constraint minifigure_set_parts_catalog_quantity_positive check (quantity > 0)
);

create index if not exists minifigure_set_parts_catalog_set_num_idx
on public.minifigure_set_parts_catalog (set_num);

alter table public.minifigure_set_parts_catalog enable row level security;

drop policy if exists minifigure_set_parts_catalog_select_auth on public.minifigure_set_parts_catalog;
create policy minifigure_set_parts_catalog_select_auth
on public.minifigure_set_parts_catalog
for select
using (auth.uid() is not null);
