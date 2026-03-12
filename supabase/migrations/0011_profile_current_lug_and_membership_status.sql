-- Add explicit current LUG on profile and membership status.

alter table public.profiles
add column if not exists current_lug_id uuid references public.lugs(id) on delete set null;

alter table public.lug_memberships
add column if not exists membership_status text not null default 'active'
check (membership_status in ('active', 'pending', 'suspended'));

create index if not exists idx_profiles_current_lug on public.profiles(current_lug_id);
create index if not exists idx_lug_memberships_status on public.lug_memberships(membership_status);
