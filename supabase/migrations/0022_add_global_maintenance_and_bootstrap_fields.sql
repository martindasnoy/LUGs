create table if not exists public.app_maintenance (
  id integer primary key,
  enabled boolean not null default false,
  message_line1 text not null default 'Estamos en mantenimiento',
  message_line2 text not null default 'Volve en un rato',
  updated_at timestamptz not null default now()
);

insert into public.app_maintenance (id, enabled, message_line1, message_line2)
values (1, false, 'Estamos en mantenimiento', 'Volve en un rato')
on conflict (id) do nothing;

alter table public.app_maintenance enable row level security;

drop policy if exists app_maintenance_select_auth on public.app_maintenance;
create policy app_maintenance_select_auth on public.app_maintenance
for select using (auth.uid() is not null);

drop policy if exists app_maintenance_update_master on public.app_maintenance;
create policy app_maintenance_update_master on public.app_maintenance
for update using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_master = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_master = true
  )
);

drop function if exists public.get_dashboard_bootstrap();

create or replace function public.get_dashboard_bootstrap()
returns table (
  full_name text,
  avatar_key text,
  preferred_language text,
  is_master boolean,
  current_lug_id uuid,
  rol_lug text,
  current_lug_color1 text,
  current_lug_color2 text,
  current_lug_color3 text,
  current_lug_logo_data_url text,
  my_pending_lug_ids uuid[],
  admin_pending_requests_count bigint,
  master_empty_notifications_count bigint,
  maintenance_enabled boolean,
  maintenance_message_line1 text,
  maintenance_message_line2 text
)
language sql
security definer
set search_path = public
as $$
  select
    p.full_name,
    p.avatar_key,
    p.preferred_language,
    p.is_master,
    p.current_lug_id,
    p.rol_lug,
    l.color1 as current_lug_color1,
    l.color2 as current_lug_color2,
    l.color3 as current_lug_color3,
    l.logo_data_url as current_lug_logo_data_url,
    coalesce(
      (
        select array_agg(r.lug_id)
        from public.lug_join_requests r
        where r.requester_id = p.id
          and r.status = 'pending'
      ),
      '{}'::uuid[]
    ) as my_pending_lug_ids,
    case
      when p.rol_lug = 'admin' and p.current_lug_id is not null then (
        select count(*)::bigint
        from public.lug_join_requests r
        where r.lug_id = p.current_lug_id
          and r.status = 'pending'
      )
      else 0::bigint
    end as admin_pending_requests_count,
    case
      when p.is_master then (
        select count(*)::bigint
        from public.lug_empty_notifications n
        where n.status = 'pending'
      )
      else 0::bigint
    end as master_empty_notifications_count,
    m.enabled as maintenance_enabled,
    m.message_line1 as maintenance_message_line1,
    m.message_line2 as maintenance_message_line2
  from public.profiles p
  left join public.lugs l on l.lug_id = p.current_lug_id
  cross join public.app_maintenance m
  where p.id = auth.uid()
    and m.id = 1;
$$;

revoke all on function public.get_dashboard_bootstrap() from public;
grant execute on function public.get_dashboard_bootstrap() to authenticated;
