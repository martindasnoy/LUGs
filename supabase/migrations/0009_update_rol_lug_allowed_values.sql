update public.profiles
set rol_lug = case
  when rol_lug = 'admin' then 'admin'
  when rol_lug is null then null
  else 'common'
end;

alter table public.profiles
drop constraint if exists profiles_rol_lug_check;

alter table public.profiles
add constraint profiles_rol_lug_check
check (rol_lug is null or rol_lug in ('admin', 'common'));
