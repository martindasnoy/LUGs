-- Fix RLS recursion caused by profiles policies querying profiles.

create or replace function public.is_master_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and is_master = true
  );
$$;

drop policy if exists profiles_select_master_all on public.profiles;
create policy profiles_select_master_all on public.profiles
for select using (public.is_master_user());

drop policy if exists profiles_update_master_all on public.profiles;
create policy profiles_update_master_all on public.profiles
for update using (public.is_master_user())
with check (true);
