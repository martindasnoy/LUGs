alter table public.profiles
add column if not exists is_master boolean not null default false;
