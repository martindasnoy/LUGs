-- Add per-LUG UI colors and expand read access for LUG panel.

alter table public.lugs
add column if not exists ui_color1 text not null default '#006eb2';

alter table public.lugs
add column if not exists ui_color2 text not null default '#f3f4f6';

alter table public.lugs
add column if not exists ui_color3 text not null default '#111827';

alter table public.lugs
add column if not exists ui_color4 text not null default '#ffffff';

drop policy if exists memberships_select_own_or_master on public.lug_memberships;
create policy memberships_select_own_or_master on public.lug_memberships
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.lugs l
    where l.id = lug_memberships.lug_id
      and l.is_active = true
      and auth.uid() is not null
  )
  or public.is_master_user()
);

drop policy if exists profiles_select_same_active_lug on public.profiles;
create policy profiles_select_same_active_lug on public.profiles
for select using (
  auth.uid() = id
  or public.is_master_user()
  or exists (
    select 1
    from public.lug_memberships lm
    join public.lugs l on l.id = lm.lug_id
    where lm.user_id = profiles.id
      and l.is_active = true
      and auth.uid() is not null
  )
);
