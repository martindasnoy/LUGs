-- Extra profile fields for onboarding panel.

alter table public.profiles
add column if not exists country text;

alter table public.profiles
add column if not exists social_links text;
