-- No-args RPC variant to avoid named-arg schema cache issues.

create or replace function public.get_lugs_panel_data()
returns table (
  id uuid,
  owner_id uuid,
  name text,
  country_city text,
  description text,
  logo_data_url text,
  lug_language text,
  ui_color1 text,
  ui_color2 text,
  ui_color3 text,
  ui_color4 text,
  members_count bigint,
  user_role text,
  membership_status text
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select p.id as user_id, p.current_lug_id
    from public.profiles p
    where p.id = auth.uid()
  ),
  my_membership as (
    select lug_id, role, membership_status
    from public.lug_memberships
    where user_id = auth.uid()
  ),
  member_counts as (
    select lug_id, count(*)::bigint as members_count
    from public.lug_memberships
    group by lug_id
  )
  select
    l.id,
    l.owner_id,
    l.name,
    l.country_city,
    l.description,
    l.logo_data_url,
    l.lug_language,
    l.ui_color1,
    l.ui_color2,
    l.ui_color3,
    l.ui_color4,
    coalesce(mc.members_count, 0) as members_count,
    case
      when l.id = me.current_lug_id then
        case
          when l.owner_id = me.user_id then 'admin'
          when exists (
            select 1 from my_membership mm
            where mm.lug_id = l.id and mm.role in ('owner', 'admin')
          ) then 'admin'
          when exists (
            select 1 from my_membership mm
            where mm.lug_id = l.id
          ) then 'member'
          else 'none'
        end
      else 'none'
    end as user_role,
    case
      when l.id = me.current_lug_id then
        coalesce(
          (select mm.membership_status from my_membership mm where mm.lug_id = l.id limit 1),
          case when l.owner_id = me.user_id then 'active' else 'none' end
        )
      else 'none'
    end as membership_status
  from public.lugs l
  left join me on true
  left join member_counts mc on mc.lug_id = l.id
  where coalesce(l.is_active, true) = true
  order by
    case when l.id = me.current_lug_id then 0 else 1 end,
    l.name asc;
$$;

grant execute on function public.get_lugs_panel_data() to authenticated;
