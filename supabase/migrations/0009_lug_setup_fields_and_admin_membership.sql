-- LUG creation fields + creator becomes admin member.

alter table public.lugs
add column if not exists logo_data_url text;

alter table public.lugs
add column if not exists country_city text;

alter table public.lugs
add column if not exists lug_language text not null default 'es';

create or replace function public.handle_new_lug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lug_memberships (lug_id, user_id, role)
  values (new.id, new.owner_id, 'admin')
  on conflict (lug_id, user_id) do update
  set role = 'admin';

  return new;
end;
$$;

update public.lug_memberships m
set role = 'admin'
from public.lugs l
where m.lug_id = l.id
  and m.user_id = l.owner_id
  and m.role = 'owner';
