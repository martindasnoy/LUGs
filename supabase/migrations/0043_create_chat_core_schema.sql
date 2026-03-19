create table if not exists public.chat_rooms (
  room_id uuid primary key default gen_random_uuid(),
  room_type text not null check (room_type in ('direct', 'group', 'lug')),
  room_name text,
  direct_key text,
  lug_id uuid references public.lugs(lug_id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_rooms_direct_key_required check (
    (room_type = 'direct' and direct_key is not null)
    or (room_type <> 'direct' and direct_key is null)
  )
);

create unique index if not exists chat_rooms_direct_key_unique_idx
on public.chat_rooms(direct_key)
where room_type = 'direct';

create index if not exists chat_rooms_type_idx on public.chat_rooms(room_type);
create index if not exists chat_rooms_lug_id_idx on public.chat_rooms(lug_id);

create table if not exists public.chat_room_members (
  room_id uuid not null references public.chat_rooms(room_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  is_active boolean not null default true,
  last_read_message_id uuid,
  last_read_at timestamptz,
  muted_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists chat_room_members_user_idx on public.chat_room_members(user_id);
create index if not exists chat_room_members_room_active_idx on public.chat_room_members(room_id, is_active);

create table if not exists public.chat_messages (
  message_id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(room_id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  message_type text not null default 'text' check (message_type in ('text', 'system')),
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists chat_messages_room_created_idx on public.chat_messages(room_id, created_at desc, message_id desc);
create index if not exists chat_messages_sender_idx on public.chat_messages(sender_id);

create table if not exists public.chat_message_receipts (
  room_id uuid not null references public.chat_rooms(room_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_message_id uuid,
  last_read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists chat_message_receipts_user_idx on public.chat_message_receipts(user_id);

create or replace function public.chat_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_chat_rooms_updated_at on public.chat_rooms;
create trigger trg_chat_rooms_updated_at
before update on public.chat_rooms
for each row execute function public.chat_touch_updated_at();

drop trigger if exists trg_chat_room_members_updated_at on public.chat_room_members;
create trigger trg_chat_room_members_updated_at
before update on public.chat_room_members
for each row execute function public.chat_touch_updated_at();

drop trigger if exists trg_chat_messages_updated_at on public.chat_messages;
create trigger trg_chat_messages_updated_at
before update on public.chat_messages
for each row execute function public.chat_touch_updated_at();

drop trigger if exists trg_chat_message_receipts_updated_at on public.chat_message_receipts;
create trigger trg_chat_message_receipts_updated_at
before update on public.chat_message_receipts
for each row execute function public.chat_touch_updated_at();

create or replace function public.chat_is_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_room_members m
    where m.room_id = p_room_id
      and m.user_id = p_user_id
      and m.is_active = true
  );
$$;

create or replace function public.chat_is_admin_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_room_members m
    where m.room_id = p_room_id
      and m.user_id = p_user_id
      and m.is_active = true
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.chat_is_member(uuid, uuid) from public;
grant execute on function public.chat_is_member(uuid, uuid) to authenticated;
grant execute on function public.chat_is_member(uuid, uuid) to service_role;

revoke all on function public.chat_is_admin_member(uuid, uuid) from public;
grant execute on function public.chat_is_admin_member(uuid, uuid) to authenticated;
grant execute on function public.chat_is_admin_member(uuid, uuid) to service_role;

alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_receipts enable row level security;

drop policy if exists chat_rooms_select_member on public.chat_rooms;
create policy chat_rooms_select_member
on public.chat_rooms
for select
using (public.chat_is_member(room_id, auth.uid()));

drop policy if exists chat_rooms_insert_creator on public.chat_rooms;
create policy chat_rooms_insert_creator
on public.chat_rooms
for insert
with check (created_by = auth.uid());

drop policy if exists chat_rooms_update_admin on public.chat_rooms;
create policy chat_rooms_update_admin
on public.chat_rooms
for update
using (public.chat_is_admin_member(room_id, auth.uid()))
with check (public.chat_is_admin_member(room_id, auth.uid()));

drop policy if exists chat_room_members_select_member on public.chat_room_members;
create policy chat_room_members_select_member
on public.chat_room_members
for select
using (public.chat_is_member(room_id, auth.uid()));

drop policy if exists chat_room_members_insert_admin on public.chat_room_members;
create policy chat_room_members_insert_admin
on public.chat_room_members
for insert
with check (public.chat_is_admin_member(room_id, auth.uid()));

drop policy if exists chat_room_members_update_self_or_admin on public.chat_room_members;
create policy chat_room_members_update_self_or_admin
on public.chat_room_members
for update
using (user_id = auth.uid() or public.chat_is_admin_member(room_id, auth.uid()))
with check (user_id = auth.uid() or public.chat_is_admin_member(room_id, auth.uid()));

drop policy if exists chat_room_members_delete_self_or_admin on public.chat_room_members;
create policy chat_room_members_delete_self_or_admin
on public.chat_room_members
for delete
using (user_id = auth.uid() or public.chat_is_admin_member(room_id, auth.uid()));

drop policy if exists chat_messages_select_member on public.chat_messages;
create policy chat_messages_select_member
on public.chat_messages
for select
using (public.chat_is_member(room_id, auth.uid()));

drop policy if exists chat_messages_insert_member on public.chat_messages;
create policy chat_messages_insert_member
on public.chat_messages
for insert
with check (
  sender_id = auth.uid()
  and public.chat_is_member(room_id, auth.uid())
);

drop policy if exists chat_messages_update_sender on public.chat_messages;
create policy chat_messages_update_sender
on public.chat_messages
for update
using (sender_id = auth.uid() and deleted_at is null)
with check (sender_id = auth.uid());

drop policy if exists chat_receipts_select_own on public.chat_message_receipts;
create policy chat_receipts_select_own
on public.chat_message_receipts
for select
using (user_id = auth.uid());

drop policy if exists chat_receipts_insert_own on public.chat_message_receipts;
create policy chat_receipts_insert_own
on public.chat_message_receipts
for insert
with check (user_id = auth.uid());

drop policy if exists chat_receipts_update_own on public.chat_message_receipts;
create policy chat_receipts_update_own
on public.chat_message_receipts
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.chat_get_or_create_direct_room(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_direct_key text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_other_user_id is null or p_other_user_id = v_user_id then
    raise exception 'Invalid direct chat target';
  end if;

  v_direct_key := least(v_user_id::text, p_other_user_id::text) || '::' || greatest(v_user_id::text, p_other_user_id::text);

  select r.room_id
  into v_room_id
  from public.chat_rooms r
  where r.room_type = 'direct'
    and r.direct_key = v_direct_key
  limit 1;

  if v_room_id is null then
    insert into public.chat_rooms (room_type, direct_key, created_by)
    values ('direct', v_direct_key, v_user_id)
    returning room_id into v_room_id;
  end if;

  insert into public.chat_room_members (room_id, user_id, role, is_active, left_at)
  values
    (v_room_id, v_user_id, 'member', true, null),
    (v_room_id, p_other_user_id, 'member', true, null)
  on conflict (room_id, user_id)
  do update set
    is_active = true,
    left_at = null,
    updated_at = now();

  return v_room_id;
end;
$$;

revoke all on function public.chat_get_or_create_direct_room(uuid) from public;
grant execute on function public.chat_get_or_create_direct_room(uuid) to authenticated;
grant execute on function public.chat_get_or_create_direct_room(uuid) to service_role;

create or replace function public.chat_create_group_room(p_name text, p_member_ids uuid[] default array[]::uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.chat_rooms (room_type, room_name, created_by)
  values ('group', coalesce(v_name, 'Grupo'), v_user_id)
  returning room_id into v_room_id;

  insert into public.chat_room_members (room_id, user_id, role)
  values (v_room_id, v_user_id, 'owner')
  on conflict (room_id, user_id) do nothing;

  insert into public.chat_room_members (room_id, user_id, role)
  select v_room_id, m.user_id, 'member'
  from (
    select distinct unnest(coalesce(p_member_ids, array[]::uuid[])) as user_id
  ) m
  where m.user_id is not null
    and m.user_id <> v_user_id
  on conflict (room_id, user_id) do nothing;

  return v_room_id;
end;
$$;

revoke all on function public.chat_create_group_room(text, uuid[]) from public;
grant execute on function public.chat_create_group_room(text, uuid[]) to authenticated;
grant execute on function public.chat_create_group_room(text, uuid[]) to service_role;

create or replace function public.chat_add_room_members(p_room_id uuid, p_member_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.chat_is_admin_member(p_room_id, v_user_id) then
    raise exception 'Forbidden';
  end if;

  insert into public.chat_room_members (room_id, user_id, role, is_active, left_at)
  select p_room_id, m.user_id, 'member', true, null
  from (
    select distinct unnest(coalesce(p_member_ids, array[]::uuid[])) as user_id
  ) m
  where m.user_id is not null
    and m.user_id <> v_user_id
  on conflict (room_id, user_id)
  do update set
    is_active = true,
    left_at = null,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.chat_add_room_members(uuid, uuid[]) from public;
grant execute on function public.chat_add_room_members(uuid, uuid[]) to authenticated;
grant execute on function public.chat_add_room_members(uuid, uuid[]) to service_role;

create or replace function public.chat_remove_room_member(p_room_id uuid, p_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_member_id is null then
    return false;
  end if;

  if v_user_id <> p_member_id and not public.chat_is_admin_member(p_room_id, v_user_id) then
    raise exception 'Forbidden';
  end if;

  update public.chat_room_members
  set is_active = false,
      left_at = now(),
      updated_at = now()
  where room_id = p_room_id
    and user_id = p_member_id
    and is_active = true;

  return found;
end;
$$;

revoke all on function public.chat_remove_room_member(uuid, uuid) from public;
grant execute on function public.chat_remove_room_member(uuid, uuid) to authenticated;
grant execute on function public.chat_remove_room_member(uuid, uuid) to service_role;

create or replace function public.chat_mark_room_read(p_room_id uuid, p_last_message_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_message_id uuid := p_last_message_id;
  v_message_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.chat_is_member(p_room_id, v_user_id) then
    raise exception 'Forbidden';
  end if;

  if v_message_id is null then
    select m.message_id, m.created_at
    into v_message_id, v_message_at
    from public.chat_messages m
    where m.room_id = p_room_id
      and m.deleted_at is null
    order by m.created_at desc, m.message_id desc
    limit 1;
  else
    select m.created_at
    into v_message_at
    from public.chat_messages m
    where m.message_id = v_message_id
      and m.room_id = p_room_id;
  end if;

  update public.chat_room_members
  set last_read_message_id = coalesce(v_message_id, last_read_message_id),
      last_read_at = coalesce(v_message_at, now()),
      updated_at = now()
  where room_id = p_room_id
    and user_id = v_user_id;

  insert into public.chat_message_receipts (room_id, user_id, last_read_message_id, last_read_at)
  values (p_room_id, v_user_id, v_message_id, coalesce(v_message_at, now()))
  on conflict (room_id, user_id)
  do update set
    last_read_message_id = excluded.last_read_message_id,
    last_read_at = excluded.last_read_at,
    updated_at = now();
end;
$$;

revoke all on function public.chat_mark_room_read(uuid, uuid) from public;
grant execute on function public.chat_mark_room_read(uuid, uuid) to authenticated;
grant execute on function public.chat_mark_room_read(uuid, uuid) to service_role;

create or replace function public.chat_list_rooms_current(p_limit integer default 200)
returns table (
  room_id uuid,
  room_type text,
  room_name text,
  lug_id uuid,
  member_role text,
  joined_at timestamptz,
  last_read_at timestamptz,
  participant_ids uuid[],
  last_message_id uuid,
  last_message_sender_id uuid,
  last_message_content text,
  last_message_at timestamptz,
  unread_count integer
)
language sql
security definer
set search_path = public
as $$
with me as (
  select auth.uid() as user_id
),
my_rooms as (
  select m.room_id, m.role, m.joined_at, m.last_read_at
  from public.chat_room_members m
  join me on me.user_id = m.user_id
  where m.is_active = true
),
participants as (
  select m.room_id, array_agg(m.user_id order by m.user_id) as participant_ids
  from public.chat_room_members m
  where m.is_active = true
  group by m.room_id
),
last_messages as (
  select distinct on (m.room_id)
    m.room_id,
    m.message_id,
    m.sender_id,
    m.content,
    m.created_at
  from public.chat_messages m
  join my_rooms r on r.room_id = m.room_id
  where m.deleted_at is null
  order by m.room_id, m.created_at desc, m.message_id desc
),
unread as (
  select
    r.room_id,
    count(*)::integer as unread_count
  from my_rooms r
  join public.chat_messages m on m.room_id = r.room_id
  join me on true
  where m.deleted_at is null
    and m.sender_id is distinct from me.user_id
    and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
  group by r.room_id
)
select
  room.room_id,
  room.room_type,
  room.room_name,
  room.lug_id,
  r.role as member_role,
  r.joined_at,
  r.last_read_at,
  coalesce(p.participant_ids, array[]::uuid[]) as participant_ids,
  lm.message_id as last_message_id,
  lm.sender_id as last_message_sender_id,
  lm.content as last_message_content,
  lm.created_at as last_message_at,
  coalesce(u.unread_count, 0) as unread_count
from my_rooms r
join public.chat_rooms room on room.room_id = r.room_id
left join participants p on p.room_id = room.room_id
left join last_messages lm on lm.room_id = room.room_id
left join unread u on u.room_id = room.room_id
where room.is_archived = false
order by coalesce(lm.created_at, room.created_at) desc, room.created_at desc
limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

revoke all on function public.chat_list_rooms_current(integer) from public;
grant execute on function public.chat_list_rooms_current(integer) to authenticated;
grant execute on function public.chat_list_rooms_current(integer) to service_role;
