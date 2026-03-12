alter table public.profiles
add column if not exists lug_joined_at timestamptz;

update public.profiles
set lug_joined_at = coalesce(lug_joined_at, created_at)
where current_lug_id is not null;

create or replace function public.set_profile_lug_joined_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.current_lug_id is null then
      new.lug_joined_at := null;
    elsif new.lug_joined_at is null then
      new.lug_joined_at := now();
    end if;
    return new;
  end if;

  if old.current_lug_id is distinct from new.current_lug_id then
    if new.current_lug_id is null then
      new.lug_joined_at := null;
    else
      new.lug_joined_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_set_lug_joined_at on public.profiles;
create trigger trg_profiles_set_lug_joined_at
before insert or update of current_lug_id on public.profiles
for each row execute function public.set_profile_lug_joined_at();

create or replace function public.transfer_lug_admin_on_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_lug uuid;
  replacement_member_id uuid;
begin
  if tg_op = 'UPDATE' then
    old_lug := old.current_lug_id;

    if old_lug is null or old.rol_lug <> 'admin' then
      return new;
    end if;

    if old.current_lug_id is not distinct from new.current_lug_id
       and coalesce(new.rol_lug, '') = 'admin' then
      return new;
    end if;
  else
    old_lug := old.current_lug_id;

    if old_lug is null or old.rol_lug <> 'admin' then
      return old;
    end if;
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.current_lug_id = old_lug
      and p.rol_lug = 'admin'
      and p.id <> old.id
  ) then
    if tg_op = 'UPDATE' then
      return new;
    end if;
    return old;
  end if;

  select p.id
  into replacement_member_id
  from public.profiles p
  where p.current_lug_id = old_lug
    and p.id <> old.id
  order by coalesce(p.lug_joined_at, p.created_at), p.created_at, p.id
  limit 1;

  if replacement_member_id is not null then
    update public.profiles
    set rol_lug = 'admin'
    where id = replacement_member_id;
  end if;

  if tg_op = 'UPDATE' then
    return new;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_profiles_transfer_admin_update on public.profiles;
create trigger trg_profiles_transfer_admin_update
after update of current_lug_id, rol_lug on public.profiles
for each row execute function public.transfer_lug_admin_on_leave();

drop trigger if exists trg_profiles_transfer_admin_delete on public.profiles;
create trigger trg_profiles_transfer_admin_delete
after delete on public.profiles
for each row execute function public.transfer_lug_admin_on_leave();
