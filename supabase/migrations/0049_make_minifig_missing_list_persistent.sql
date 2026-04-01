-- Rename legacy automatic list name
update public.lists
set name = 'Faltantes de minifiguras'
where list_type = 'deseos'
  and name = 'Faltantes de CMF';

-- Heal stale current_lug_id values (if any)
update public.profiles p
set current_lug_id = null
where p.current_lug_id is not null
  and not exists (
    select 1
    from public.lugs l
    where l.lug_id = p.current_lug_id
  );

-- Ensure every profile has exactly one automatic minifigure missing list
insert into public.lists (owner_id, lug_id, name, list_type, is_public)
select
  p.id,
  case
    when p.current_lug_id is not null
      and exists (select 1 from public.lugs l where l.lug_id = p.current_lug_id)
    then p.current_lug_id
    else null
  end,
  'Faltantes de minifiguras',
  'deseos',
  false
from public.profiles p
where not exists (
  select 1
  from public.lists l
  where l.owner_id = p.id
    and l.list_type = 'deseos'
    and l.name = 'Faltantes de minifiguras'
);

with ranked as (
  select
    l.list_id,
    l.owner_id,
    first_value(l.list_id) over (partition by l.owner_id order by l.created_at asc, l.list_id asc) as keep_list_id,
    row_number() over (partition by l.owner_id order by l.created_at asc, l.list_id asc) as rn
  from public.lists l
  where l.list_type = 'deseos'
    and l.name = 'Faltantes de minifiguras'
), duplicates as (
  select list_id, keep_list_id
  from ranked
  where rn > 1
)
update public.list_items li
set list_id = d.keep_list_id
from duplicates d
where li.list_id = d.list_id;

delete from public.lists l
using (
  select list_id
  from (
    select
      l2.list_id,
      row_number() over (partition by l2.owner_id order by l2.created_at asc, l2.list_id asc) as rn
    from public.lists l2
    where l2.list_type = 'deseos'
      and l2.name = 'Faltantes de minifiguras'
  ) r
  where r.rn > 1
) d
where l.list_id = d.list_id;

create unique index if not exists lists_unique_auto_minifig_missing_per_owner
on public.lists (owner_id)
where list_type = 'deseos'
  and name = 'Faltantes de minifiguras';

create or replace function public.ensure_auto_minifig_missing_list_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lug_id uuid;
begin
  v_lug_id := null;
  if new.current_lug_id is not null and exists (
    select 1
    from public.lugs l
    where l.lug_id = new.current_lug_id
  ) then
    v_lug_id := new.current_lug_id;
  end if;

  insert into public.lists (owner_id, lug_id, name, list_type, is_public)
  values (new.id, v_lug_id, 'Faltantes de minifiguras', 'deseos', false)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_profiles_create_auto_minifig_missing_list on public.profiles;
create trigger trg_profiles_create_auto_minifig_missing_list
after insert on public.profiles
for each row execute function public.ensure_auto_minifig_missing_list_for_profile();
