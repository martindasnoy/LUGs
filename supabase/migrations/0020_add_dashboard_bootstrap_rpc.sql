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
  master_empty_notifications_count bigint
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
    end as master_empty_notifications_count
  from public.profiles p
  left join public.lugs l on l.lug_id = p.current_lug_id
  where p.id = auth.uid();
$$;

revoke all on function public.get_dashboard_bootstrap() from public;
grant execute on function public.get_dashboard_bootstrap() to authenticated;
