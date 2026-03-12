create or replace function public.promote_lug_member_to_admin(target_lug_id uuid, target_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.rol_lug = 'admin'
      and admin_profile.current_lug_id = target_lug_id
  ) then
    raise exception 'No autorizado para promover miembros';
  end if;

  update public.profiles
  set rol_lug = 'admin'
  where id = target_member_id
    and current_lug_id = target_lug_id;

  if not found then
    raise exception 'Miembro no encontrado en este LUG';
  end if;
end;
$$;

revoke all on function public.promote_lug_member_to_admin(uuid, uuid) from public;
grant execute on function public.promote_lug_member_to_admin(uuid, uuid) to authenticated;
