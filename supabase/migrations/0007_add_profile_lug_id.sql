alter table public.profiles
add column if not exists lug_id uuid references public.lugs(lug_id) on delete set null;

create index if not exists idx_profiles_lug_id on public.profiles(lug_id);
