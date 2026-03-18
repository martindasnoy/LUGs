create table if not exists public.minifig_user_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  set_num text not null,
  is_owned boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, set_num)
);

alter table public.minifig_user_inventory enable row level security;

drop policy if exists minifig_user_inventory_select_own on public.minifig_user_inventory;
create policy minifig_user_inventory_select_own
on public.minifig_user_inventory
for select
using (auth.uid() = user_id);

drop policy if exists minifig_user_inventory_insert_own on public.minifig_user_inventory;
create policy minifig_user_inventory_insert_own
on public.minifig_user_inventory
for insert
with check (auth.uid() = user_id);

drop policy if exists minifig_user_inventory_update_own on public.minifig_user_inventory;
create policy minifig_user_inventory_update_own
on public.minifig_user_inventory
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists minifig_user_inventory_delete_own on public.minifig_user_inventory;
create policy minifig_user_inventory_delete_own
on public.minifig_user_inventory
for delete
using (auth.uid() = user_id);

create table if not exists public.minifig_user_part_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  set_num text not null,
  part_num text not null,
  color_name text not null default '',
  owned_quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, set_num, part_num, color_name),
  constraint minifig_user_part_inventory_owned_quantity_non_negative check (owned_quantity >= 0)
);

alter table public.minifig_user_part_inventory enable row level security;

drop policy if exists minifig_user_part_inventory_select_own on public.minifig_user_part_inventory;
create policy minifig_user_part_inventory_select_own
on public.minifig_user_part_inventory
for select
using (auth.uid() = user_id);

drop policy if exists minifig_user_part_inventory_insert_own on public.minifig_user_part_inventory;
create policy minifig_user_part_inventory_insert_own
on public.minifig_user_part_inventory
for insert
with check (auth.uid() = user_id);

drop policy if exists minifig_user_part_inventory_update_own on public.minifig_user_part_inventory;
create policy minifig_user_part_inventory_update_own
on public.minifig_user_part_inventory
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists minifig_user_part_inventory_delete_own on public.minifig_user_part_inventory;
create policy minifig_user_part_inventory_delete_own
on public.minifig_user_part_inventory
for delete
using (auth.uid() = user_id);
