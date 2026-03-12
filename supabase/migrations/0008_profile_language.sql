-- Store user UI language preference.

alter table public.profiles
add column if not exists preferred_language text not null default 'es';
