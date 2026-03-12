alter table public.lugs
drop constraint if exists lugs_color1_hex_check;

alter table public.lugs
drop constraint if exists lugs_color2_hex_check;

alter table public.lugs
drop constraint if exists lugs_color3_hex_check;

alter table public.lugs
add constraint lugs_color1_hex_check
check (color1 is null or color1 ~ '^#[0-9A-Fa-f]{6}$');

alter table public.lugs
add constraint lugs_color2_hex_check
check (color2 is null or color2 ~ '^#[0-9A-Fa-f]{6}$');

alter table public.lugs
add constraint lugs_color3_hex_check
check (color3 is null or color3 ~ '^#[0-9A-Fa-f]{6}$');

alter table public.profiles
drop constraint if exists profiles_rol_lug_check;

alter table public.profiles
add constraint profiles_rol_lug_check
check (rol_lug is null or rol_lug in ('admin', 'miembro', 'visitante'));
