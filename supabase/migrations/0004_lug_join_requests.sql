-- Join request flow for LUG access approval.

alter table public.lugs
add column if not exists is_active boolean not null default true;

drop policy if exists lugs_select_member on public.lugs;
drop policy if exists lugs_select_member_or_active_authenticated on public.lugs;
create policy lugs_select_member_or_active_authenticated on public.lugs
for select using (
  (is_active = true and auth.uid() is not null)
  or exists (
    select 1
    from public.lug_memberships m
    where m.lug_id = lugs.id and m.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
);

create table if not exists public.lug_join_requests (
  id uuid primary key default gen_random_uuid(),
  lug_id uuid not null references public.lugs(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_lug_join_requests_lug on public.lug_join_requests(lug_id);
create index if not exists idx_lug_join_requests_user on public.lug_join_requests(requested_by);
create index if not exists idx_lug_join_requests_status on public.lug_join_requests(status);
create unique index if not exists uq_lug_join_request_pending
on public.lug_join_requests(lug_id, requested_by)
where status = 'pending';

alter table public.lug_join_requests enable row level security;

drop policy if exists lug_join_requests_select on public.lug_join_requests;
create policy lug_join_requests_select on public.lug_join_requests
for select using (
  requested_by = auth.uid()
  or exists (
    select 1
    from public.lug_memberships m
    where m.lug_id = lug_join_requests.lug_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
);

drop policy if exists lug_join_requests_insert on public.lug_join_requests;
create policy lug_join_requests_insert on public.lug_join_requests
for insert with check (
  requested_by = auth.uid()
  and status = 'pending'
);

drop policy if exists lug_join_requests_update on public.lug_join_requests;
create policy lug_join_requests_update on public.lug_join_requests
for update using (
  exists (
    select 1
    from public.lug_memberships m
    where m.lug_id = lug_join_requests.lug_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
)
with check (
  status in ('approved', 'rejected')
  and reviewed_by = auth.uid()
);

create or replace function public.handle_join_request_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.lug_memberships (lug_id, user_id, role)
    values (new.lug_id, new.requested_by, 'member')
    on conflict (lug_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_lug_join_request_approved on public.lug_join_requests;
create trigger on_lug_join_request_approved
after update of status on public.lug_join_requests
for each row execute function public.handle_join_request_approved();
