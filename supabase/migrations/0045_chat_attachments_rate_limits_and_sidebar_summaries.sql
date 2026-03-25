create table if not exists public.chat_message_attachments (
  attachment_id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(message_id) on delete cascade,
  room_id uuid not null references public.chat_rooms(room_id) on delete cascade,
  uploader_id uuid references public.profiles(id) on delete set null,
  storage_bucket text not null default 'chat-attachments',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists chat_message_attachments_message_idx on public.chat_message_attachments(message_id);
create index if not exists chat_message_attachments_room_idx on public.chat_message_attachments(room_id, created_at desc);

alter table public.chat_message_attachments enable row level security;

drop policy if exists chat_attachments_select_member on public.chat_message_attachments;
create policy chat_attachments_select_member
on public.chat_message_attachments
for select
using (public.chat_is_member(room_id, auth.uid()));

drop policy if exists chat_attachments_insert_member on public.chat_message_attachments;
create policy chat_attachments_insert_member
on public.chat_message_attachments
for insert
with check (
  uploader_id = auth.uid()
  and public.chat_is_member(room_id, auth.uid())
);

drop policy if exists chat_attachments_delete_uploader_or_admin on public.chat_message_attachments;
create policy chat_attachments_delete_uploader_or_admin
on public.chat_message_attachments
for delete
using (uploader_id = auth.uid() or public.chat_is_admin_member(room_id, auth.uid()));

create table if not exists public.chat_room_summaries (
  room_id uuid primary key references public.chat_rooms(room_id) on delete cascade,
  last_message_id uuid,
  last_message_sender_id uuid,
  last_message_content text,
  last_message_at timestamptz,
  message_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists chat_room_summaries_last_message_idx on public.chat_room_summaries(last_message_at desc nulls last);

create table if not exists public.chat_room_user_unread (
  room_id uuid not null references public.chat_rooms(room_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unread_count integer not null default 0,
  last_read_message_id uuid,
  last_read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists chat_room_user_unread_user_idx on public.chat_room_user_unread(user_id, unread_count desc);

alter table public.chat_room_user_unread enable row level security;

drop policy if exists chat_room_user_unread_select_own on public.chat_room_user_unread;
create policy chat_room_user_unread_select_own
on public.chat_room_user_unread
for select
using (user_id = auth.uid());

drop policy if exists chat_room_user_unread_update_own on public.chat_room_user_unread;
create policy chat_room_user_unread_update_own
on public.chat_room_user_unread
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists chat_room_user_unread_insert_own on public.chat_room_user_unread;
create policy chat_room_user_unread_insert_own
on public.chat_room_user_unread
for insert
with check (user_id = auth.uid());

create or replace function public.chat_validate_message_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sender uuid := new.sender_id;
  v_recent_count integer;
  v_last_created timestamptz;
begin
  if coalesce(length(trim(new.content)), 0) = 0 then
    raise exception 'El mensaje no puede estar vacio';
  end if;

  if length(new.content) > 2000 then
    raise exception 'El mensaje supera el maximo de 2000 caracteres';
  end if;

  if v_sender is null then
    return new;
  end if;

  select count(*)::integer
  into v_recent_count
  from public.chat_messages m
  where m.sender_id = v_sender
    and m.created_at >= now() - interval '10 seconds';

  if v_recent_count >= 20 then
    raise exception 'Demasiados mensajes en poco tiempo';
  end if;

  select m.created_at
  into v_last_created
  from public.chat_messages m
  where m.sender_id = v_sender
  order by m.created_at desc
  limit 1;

  if v_last_created is not null and v_last_created >= now() - interval '300 milliseconds' then
    raise exception 'Espera un instante antes de enviar otro mensaje';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_chat_validate_message_write on public.chat_messages;
create trigger trg_chat_validate_message_write
before insert on public.chat_messages
for each row execute function public.chat_validate_message_write();

create or replace function public.chat_update_summary_and_unread_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  insert into public.chat_room_summaries (
    room_id,
    last_message_id,
    last_message_sender_id,
    last_message_content,
    last_message_at,
    message_count,
    updated_at
  )
  values (
    new.room_id,
    new.message_id,
    new.sender_id,
    new.content,
    new.created_at,
    1,
    now()
  )
  on conflict (room_id)
  do update set
    last_message_id = excluded.last_message_id,
    last_message_sender_id = excluded.last_message_sender_id,
    last_message_content = excluded.last_message_content,
    last_message_at = excluded.last_message_at,
    message_count = public.chat_room_summaries.message_count + 1,
    updated_at = now();

  insert into public.chat_room_user_unread (room_id, user_id, unread_count, updated_at)
  select
    m.room_id,
    m.user_id,
    case when m.user_id = new.sender_id then 0 else 1 end,
    now()
  from public.chat_room_members m
  where m.room_id = new.room_id
    and m.is_active = true
  on conflict (room_id, user_id)
  do update set
    unread_count = case
      when excluded.user_id = new.sender_id then public.chat_room_user_unread.unread_count
      else public.chat_room_user_unread.unread_count + 1
    end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_chat_update_summary_on_insert on public.chat_messages;
create trigger trg_chat_update_summary_on_insert
after insert on public.chat_messages
for each row execute function public.chat_update_summary_and_unread_on_insert();

create or replace function public.chat_sync_unread_on_member_upsert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unread integer := 0;
begin
  if new.is_active is not true then
    return new;
  end if;

  select count(*)::integer
  into v_unread
  from public.chat_messages m
  where m.room_id = new.room_id
    and m.deleted_at is null
    and m.sender_id is distinct from new.user_id
    and m.created_at > coalesce(new.last_read_at, 'epoch'::timestamptz);

  insert into public.chat_room_user_unread (room_id, user_id, unread_count, last_read_message_id, last_read_at, updated_at)
  values (new.room_id, new.user_id, greatest(0, v_unread), new.last_read_message_id, new.last_read_at, now())
  on conflict (room_id, user_id)
  do update set
    unread_count = greatest(0, v_unread),
    last_read_message_id = new.last_read_message_id,
    last_read_at = new.last_read_at,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_chat_sync_unread_on_member_upsert on public.chat_room_members;
create trigger trg_chat_sync_unread_on_member_upsert
after insert or update of is_active, last_read_at, last_read_message_id on public.chat_room_members
for each row execute function public.chat_sync_unread_on_member_upsert();

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

  insert into public.chat_room_user_unread (room_id, user_id, unread_count, last_read_message_id, last_read_at, updated_at)
  values (p_room_id, v_user_id, 0, v_message_id, coalesce(v_message_at, now()), now())
  on conflict (room_id, user_id)
  do update set
    unread_count = 0,
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
  s.last_message_id,
  s.last_message_sender_id,
  s.last_message_content,
  s.last_message_at,
  coalesce(u.unread_count, 0) as unread_count
from my_rooms r
join public.chat_rooms room on room.room_id = r.room_id
left join public.chat_room_summaries s on s.room_id = room.room_id
left join public.chat_room_user_unread u on u.room_id = room.room_id and u.user_id = auth.uid()
left join participants p on p.room_id = room.room_id
where room.is_archived = false
order by coalesce(s.last_message_at, room.created_at) desc, room.created_at desc
limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

revoke all on function public.chat_list_rooms_current(integer) from public;
grant execute on function public.chat_list_rooms_current(integer) to authenticated;
grant execute on function public.chat_list_rooms_current(integer) to service_role;

insert into public.chat_room_summaries (room_id, last_message_id, last_message_sender_id, last_message_content, last_message_at, message_count, updated_at)
select
  r.room_id,
  lm.message_id,
  lm.sender_id,
  lm.content,
  lm.created_at,
  coalesce(mc.message_count, 0),
  now()
from public.chat_rooms r
left join lateral (
  select m.message_id, m.sender_id, m.content, m.created_at
  from public.chat_messages m
  where m.room_id = r.room_id
    and m.deleted_at is null
  order by m.created_at desc, m.message_id desc
  limit 1
) lm on true
left join (
  select room_id, count(*)::bigint as message_count
  from public.chat_messages
  where deleted_at is null
  group by room_id
) mc on mc.room_id = r.room_id
on conflict (room_id)
do update set
  last_message_id = excluded.last_message_id,
  last_message_sender_id = excluded.last_message_sender_id,
  last_message_content = excluded.last_message_content,
  last_message_at = excluded.last_message_at,
  message_count = excluded.message_count,
  updated_at = now();

insert into public.chat_room_user_unread (room_id, user_id, unread_count, last_read_message_id, last_read_at, updated_at)
select
  m.room_id,
  m.user_id,
  (
    select count(*)::integer
    from public.chat_messages cm
    where cm.room_id = m.room_id
      and cm.deleted_at is null
      and cm.sender_id is distinct from m.user_id
      and cm.created_at > coalesce(m.last_read_at, 'epoch'::timestamptz)
  ) as unread_count,
  m.last_read_message_id,
  m.last_read_at,
  now()
from public.chat_room_members m
where m.is_active = true
on conflict (room_id, user_id)
do update set
  unread_count = excluded.unread_count,
  last_read_message_id = excluded.last_read_message_id,
  last_read_at = excluded.last_read_at,
  updated_at = now();

create materialized view if not exists public.chat_sidebar_summary_mv as
select
  r.room_id,
  r.room_type,
  r.room_name,
  r.lug_id,
  s.last_message_id,
  s.last_message_sender_id,
  s.last_message_content,
  s.last_message_at,
  s.message_count,
  s.updated_at
from public.chat_rooms r
left join public.chat_room_summaries s on s.room_id = r.room_id;

create unique index if not exists chat_sidebar_summary_mv_room_idx on public.chat_sidebar_summary_mv(room_id);

create or replace function public.chat_refresh_sidebar_summary_mv()
returns void
language sql
security definer
set search_path = public
as $$
  refresh materialized view public.chat_sidebar_summary_mv;
$$;

revoke all on function public.chat_refresh_sidebar_summary_mv() from public;
grant execute on function public.chat_refresh_sidebar_summary_mv() to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/zip']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_attachments_storage_select on storage.objects;
create policy chat_attachments_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-attachments'
  and name ~* '^[0-9a-f-]{36}/'
  and public.chat_is_member(split_part(name, '/', 1)::uuid, auth.uid())
);

drop policy if exists chat_attachments_storage_insert on storage.objects;
create policy chat_attachments_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-attachments'
  and name ~* '^[0-9a-f-]{36}/'
  and public.chat_is_member(split_part(name, '/', 1)::uuid, auth.uid())
);

drop policy if exists chat_attachments_storage_update on storage.objects;
create policy chat_attachments_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'chat-attachments'
  and name ~* '^[0-9a-f-]{36}/'
  and public.chat_is_member(split_part(name, '/', 1)::uuid, auth.uid())
)
with check (
  bucket_id = 'chat-attachments'
  and name ~* '^[0-9a-f-]{36}/'
  and public.chat_is_member(split_part(name, '/', 1)::uuid, auth.uid())
);

drop policy if exists chat_attachments_storage_delete on storage.objects;
create policy chat_attachments_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-attachments'
  and name ~* '^[0-9a-f-]{36}/'
  and public.chat_is_member(split_part(name, '/', 1)::uuid, auth.uid())
);
