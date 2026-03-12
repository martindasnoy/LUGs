create table if not exists public.lug_join_requests (
  request_id uuid primary key default gen_random_uuid(),
  lug_id uuid not null references public.lugs(lug_id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lug_id, requester_id)
);

create index if not exists idx_lug_join_requests_lug_status
  on public.lug_join_requests(lug_id, status);

create index if not exists idx_lug_join_requests_requester
  on public.lug_join_requests(requester_id);

create or replace function public.touch_lug_join_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lug_join_requests_updated_at on public.lug_join_requests;
create trigger trg_lug_join_requests_updated_at
before update on public.lug_join_requests
for each row execute function public.touch_lug_join_requests_updated_at();

alter table public.lug_join_requests enable row level security;

drop policy if exists lug_join_requests_select_own_or_admin on public.lug_join_requests;
create policy lug_join_requests_select_own_or_admin on public.lug_join_requests
for select using (
  auth.uid() = requester_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.rol_lug = 'admin'
      and p.current_lug_id = lug_join_requests.lug_id
  )
);

drop policy if exists lug_join_requests_insert_own on public.lug_join_requests;
create policy lug_join_requests_insert_own on public.lug_join_requests
for insert with check (auth.uid() = requester_id);

drop policy if exists lug_join_requests_update_own on public.lug_join_requests;
create policy lug_join_requests_update_own on public.lug_join_requests
for update using (auth.uid() = requester_id)
with check (auth.uid() = requester_id);
