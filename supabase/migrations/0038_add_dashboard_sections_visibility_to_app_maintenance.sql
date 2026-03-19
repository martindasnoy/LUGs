alter table public.app_maintenance
add column if not exists show_balance boolean not null default true;

alter table public.app_maintenance
add column if not exists show_listas boolean not null default true;

alter table public.app_maintenance
add column if not exists show_sets boolean not null default true;

alter table public.app_maintenance
add column if not exists show_minifiguras boolean not null default true;

update public.app_maintenance
set
  show_balance = coalesce(show_balance, true),
  show_listas = coalesce(show_listas, true),
  show_sets = coalesce(show_sets, true),
  show_minifiguras = coalesce(show_minifiguras, true)
where id = 1;
