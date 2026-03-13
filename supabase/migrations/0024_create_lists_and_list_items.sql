create table if not exists public.lists (
  list_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  lug_id uuid references public.lugs(lug_id) on delete set null,
  name text not null,
  list_type text not null check (list_type in ('deseos', 'venta')),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.list_items (
  item_id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(list_id) on delete cascade,
  part_num text,
  part_name text,
  color_name text,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lists_owner on public.lists(owner_id);
create index if not exists idx_lists_lug on public.lists(lug_id);
create index if not exists idx_list_items_list on public.list_items(list_id);

create or replace function public.touch_lists_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lists_updated_at on public.lists;
create trigger trg_lists_updated_at
before update on public.lists
for each row execute function public.touch_lists_updated_at();

create or replace function public.touch_list_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_list_items_updated_at on public.list_items;
create trigger trg_list_items_updated_at
before update on public.list_items
for each row execute function public.touch_list_items_updated_at();

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

drop policy if exists lists_select_owner_or_public on public.lists;
create policy lists_select_owner_or_public on public.lists
for select using (
  owner_id = auth.uid() or is_public = true
);

drop policy if exists lists_insert_owner on public.lists;
create policy lists_insert_owner on public.lists
for insert with check (owner_id = auth.uid());

drop policy if exists lists_update_owner on public.lists;
create policy lists_update_owner on public.lists
for update using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists lists_delete_owner on public.lists;
create policy lists_delete_owner on public.lists
for delete using (owner_id = auth.uid());

drop policy if exists list_items_select_owner_or_public on public.list_items;
create policy list_items_select_owner_or_public on public.list_items
for select using (
  exists (
    select 1
    from public.lists l
    where l.list_id = list_items.list_id
      and (l.owner_id = auth.uid() or l.is_public = true)
  )
);

drop policy if exists list_items_insert_owner on public.list_items;
create policy list_items_insert_owner on public.list_items
for insert with check (
  exists (
    select 1
    from public.lists l
    where l.list_id = list_items.list_id
      and l.owner_id = auth.uid()
  )
);

drop policy if exists list_items_update_owner on public.list_items;
create policy list_items_update_owner on public.list_items
for update using (
  exists (
    select 1
    from public.lists l
    where l.list_id = list_items.list_id
      and l.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lists l
    where l.list_id = list_items.list_id
      and l.owner_id = auth.uid()
  )
);

drop policy if exists list_items_delete_owner on public.list_items;
create policy list_items_delete_owner on public.list_items
for delete using (
  exists (
    select 1
    from public.lists l
    where l.list_id = list_items.list_id
      and l.owner_id = auth.uid()
  )
);
