update public.profiles
set current_lug_id = lug_id
where current_lug_id is null and lug_id is not null;

drop index if exists public.idx_profiles_lug_id;

alter table public.profiles
drop column if exists lug_id;
