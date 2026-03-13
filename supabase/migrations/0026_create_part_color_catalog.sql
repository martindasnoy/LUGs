create table if not exists public.part_color_catalog (
  part_num text not null references public.parts_catalog(part_num) on delete cascade,
  color_name text not null,
  color_id integer,
  part_img_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (part_num, color_name)
);

create index if not exists idx_part_color_catalog_part_num on public.part_color_catalog(part_num);
create index if not exists idx_part_color_catalog_color_name on public.part_color_catalog(color_name);

alter table public.part_color_catalog enable row level security;

drop policy if exists part_color_catalog_select_auth on public.part_color_catalog;
create policy part_color_catalog_select_auth on public.part_color_catalog
  for select to authenticated using (true);
