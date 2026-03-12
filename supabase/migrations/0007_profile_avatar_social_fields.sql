-- Optional profile fields for user settings panel.

alter table public.profiles
add column if not exists social_platform text;

alter table public.profiles
add column if not exists social_handle text;

alter table public.profiles
add column if not exists avatar_key text;
