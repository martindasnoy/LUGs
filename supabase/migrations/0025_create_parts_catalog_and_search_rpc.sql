create table if not exists public.part_categories (
  id integer primary key,
  name text not null,
  part_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.parts_catalog (
  part_num text primary key,
  name text not null,
  part_cat_id integer references public.part_categories(id) on delete set null,
  part_url text,
  part_img_url text,
  search_text text generated always as (coalesce(part_num, '') || ' ' || coalesce(name, '')) stored,
  updated_at timestamptz not null default now()
);

create index if not exists idx_parts_catalog_cat on public.parts_catalog(part_cat_id);
create index if not exists idx_parts_catalog_name on public.parts_catalog(name);
create index if not exists idx_parts_catalog_part_num on public.parts_catalog(part_num);

create extension if not exists pg_trgm;
create index if not exists idx_parts_catalog_search_trgm on public.parts_catalog using gin (search_text gin_trgm_ops);

alter table public.part_categories enable row level security;
alter table public.parts_catalog enable row level security;

drop policy if exists part_categories_select_auth on public.part_categories;
create policy part_categories_select_auth on public.part_categories
for select using (auth.uid() is not null);

drop policy if exists parts_catalog_select_auth on public.parts_catalog;
create policy parts_catalog_select_auth on public.parts_catalog
for select using (auth.uid() is not null);

create or replace function public.search_parts_catalog(
  p_query text default null,
  p_category_id integer default null,
  p_limit integer default 30
)
returns table (
  part_num text,
  name text,
  part_img_url text,
  category_id integer
)
language sql
security definer
set search_path = public
as $$
  select
    p.part_num,
    p.name,
    p.part_img_url,
    p.part_cat_id as category_id
  from public.parts_catalog p
  where (p_category_id is null or p.part_cat_id = p_category_id)
    and (
      p_query is null
      or p_query = ''
      or p.search_text ilike '%' || p_query || '%'
      or p.part_num ilike p_query || '%'
    )
  order by
    case when p_query is not null and p.part_num ilike p_query || '%' then 0 else 1 end,
    p.name asc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

revoke all on function public.search_parts_catalog(text, integer, integer) from public;
grant execute on function public.search_parts_catalog(text, integer, integer) to authenticated;
