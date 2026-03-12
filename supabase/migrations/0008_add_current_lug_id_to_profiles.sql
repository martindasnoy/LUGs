alter table public.profiles
add column if not exists current_lug_id uuid references public.lugs(lug_id) on delete set null;

create index if not exists idx_profiles_current_lug_id on public.profiles(current_lug_id);

update public.profiles
set current_lug_id = lug_id
where current_lug_id is null and lug_id is not null;
