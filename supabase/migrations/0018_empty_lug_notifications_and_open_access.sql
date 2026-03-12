alter table public.lugs
add column if not exists open_access boolean not null default false;

create table if not exists public.lug_empty_notifications (
  notification_id uuid primary key default gen_random_uuid(),
  lug_id uuid not null references public.lugs(lug_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  resolved_action text check (resolved_action in ('delete', 'open')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists idx_lug_empty_notifications_pending_unique
  on public.lug_empty_notifications(lug_id)
  where status = 'pending';

create index if not exists idx_lug_empty_notifications_status
  on public.lug_empty_notifications(status, created_at desc);

alter table public.lug_empty_notifications enable row level security;

drop policy if exists lug_empty_notifications_select_master on public.lug_empty_notifications;
create policy lug_empty_notifications_select_master on public.lug_empty_notifications
for select using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_master = true
  )
);

create or replace function public.handle_empty_lug_after_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_lug uuid;
  old_count bigint;
begin
  old_lug := old.current_lug_id;

  if old_lug is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.current_lug_id is not distinct from new.current_lug_id then
    return new;
  end if;

  select count(*)::bigint
  into old_count
  from public.profiles p
  where p.current_lug_id = old_lug;

  if old_count = 0 then
    update public.lugs
    set open_access = false
    where lug_id = old_lug;

    insert into public.lug_empty_notifications (lug_id, status)
    values (old_lug, 'pending')
    on conflict (lug_id) where status = 'pending' do nothing;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_empty_lug_update on public.profiles;
create trigger trg_profiles_empty_lug_update
after update of current_lug_id on public.profiles
for each row execute function public.handle_empty_lug_after_profile_change();

drop trigger if exists trg_profiles_empty_lug_delete on public.profiles;
create trigger trg_profiles_empty_lug_delete
after delete on public.profiles
for each row execute function public.handle_empty_lug_after_profile_change();

create or replace function public.get_master_empty_lug_notifications()
returns table (
  notification_id uuid,
  lug_id uuid,
  nombre text,
  pais text,
  descripcion text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    n.notification_id,
    n.lug_id,
    l.nombre,
    l.pais,
    l.descripcion,
    n.created_at
  from public.lug_empty_notifications n
  join public.lugs l on l.lug_id = n.lug_id
  where n.status = 'pending'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_master = true
    )
  order by n.created_at desc;
$$;

revoke all on function public.get_master_empty_lug_notifications() from public;
grant execute on function public.get_master_empty_lug_notifications() to authenticated;

create or replace function public.resolve_empty_lug_notification(target_notification_id uuid, action_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  notif record;
begin
  if action_value not in ('delete', 'open') then
    raise exception 'Accion invalida';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_master = true
  ) then
    raise exception 'No autorizado';
  end if;

  select n.notification_id, n.lug_id, n.status
  into notif
  from public.lug_empty_notifications n
  where n.notification_id = target_notification_id
  for update;

  if not found then
    raise exception 'Notificacion no encontrada';
  end if;

  if notif.status <> 'pending' then
    return;
  end if;

  if action_value = 'delete' then
    delete from public.lug_empty_notifications
    where notification_id = notif.notification_id;

    delete from public.lugs
    where lug_id = notif.lug_id;
  else
    update public.lugs
    set open_access = true
    where lug_id = notif.lug_id;

    update public.lug_empty_notifications
    set status = 'resolved',
        resolved_action = 'open',
        resolved_at = now()
    where notification_id = notif.notification_id;
  end if;
end;
$$;

revoke all on function public.resolve_empty_lug_notification(uuid, text) from public;
grant execute on function public.resolve_empty_lug_notification(uuid, text) to authenticated;
