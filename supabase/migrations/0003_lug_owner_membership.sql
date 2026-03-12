-- Ensure every created LUG has its owner membership row.

drop policy if exists memberships_insert_owner_admin_master on public.lug_memberships;
create policy memberships_insert_owner_admin_master on public.lug_memberships
for insert with check (
  exists (
    select 1
    from public.lug_memberships m
    where m.lug_id = lug_memberships.lug_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.lugs l
    where l.id = lug_memberships.lug_id
      and l.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
);

create or replace function public.handle_new_lug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lug_memberships (lug_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (lug_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_lug_created_add_owner_membership on public.lugs;
create trigger on_lug_created_add_owner_membership
after insert on public.lugs
for each row execute function public.handle_new_lug();

insert into public.lug_memberships (lug_id, user_id, role)
select l.id, l.owner_id, 'owner'
from public.lugs l
on conflict (lug_id, user_id) do nothing;
