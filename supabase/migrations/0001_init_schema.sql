-- LUGs app - base schema for Supabase

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  is_master boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.lugs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.lug_memberships (
  id uuid primary key default gen_random_uuid(),
  lug_id uuid not null references public.lugs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (lug_id, user_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('lug_group', 'direct')),
  lug_id uuid references public.lugs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (type = 'lug_group' and lug_id is not null) or
    (type = 'direct' and lug_id is null)
  )
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_lug_memberships_user on public.lug_memberships(user_id);
create index if not exists idx_lug_memberships_lug on public.lug_memberships(lug_id);
create index if not exists idx_conversations_lug on public.conversations(lug_id);
create index if not exists idx_messages_conv_created on public.messages(conversation_id, created_at desc);
create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read, created_at desc);
create unique index if not exists only_one_master on public.profiles(is_master) where is_master = true;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.lugs enable row level security;
alter table public.lug_memberships enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select using (auth.uid() = id);

drop policy if exists profiles_select_master_all on public.profiles;
create policy profiles_select_master_all on public.profiles
for select using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists profiles_update_master_all on public.profiles;
create policy profiles_update_master_all on public.profiles
for update using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
)
with check (true);

drop policy if exists lugs_select_member on public.lugs;
create policy lugs_select_member on public.lugs
for select using (
  exists (
    select 1
    from public.lug_memberships m
    where m.lug_id = lugs.id and m.user_id = auth.uid()
  )
  or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
);

drop policy if exists lugs_insert_auth_as_owner on public.lugs;
create policy lugs_insert_auth_as_owner on public.lugs
for insert with check (owner_id = auth.uid());

drop policy if exists lugs_update_owner_or_master on public.lugs;
create policy lugs_update_owner_or_master on public.lugs
for update using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
)
with check (true);

drop policy if exists memberships_select_own_or_master on public.lug_memberships;
create policy memberships_select_own_or_master on public.lug_memberships
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
);

drop policy if exists memberships_insert_owner_admin_master on public.lug_memberships;
create policy memberships_insert_owner_admin_master on public.lug_memberships
for insert with check (
  exists (
    select 1
    from public.lug_memberships m
    where m.lug_id = lug_memberships.lug_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
);

drop policy if exists conversations_select_participant_or_master on public.conversations;
create policy conversations_select_participant_or_master on public.conversations
for select using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversations.id
      and cp.user_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
);

drop policy if exists conversations_insert_creator on public.conversations;
create policy conversations_insert_creator on public.conversations
for insert with check (
  created_by = auth.uid()
);

drop policy if exists participants_select_self_or_master on public.conversation_participants;
create policy participants_select_self_or_master on public.conversation_participants
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
);

drop policy if exists participants_insert_creator_or_master on public.conversation_participants;
create policy participants_insert_creator_or_master on public.conversation_participants
for insert with check (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_participants.conversation_id
      and c.created_by = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
);

drop policy if exists messages_select_participant_or_master on public.messages;
create policy messages_select_participant_or_master on public.messages
for select using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
);

drop policy if exists messages_insert_sender_is_participant on public.messages;
create policy messages_insert_sender_is_participant on public.messages
for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists notifications_select_own_or_master on public.notifications;
create policy notifications_select_own_or_master on public.notifications
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notifications_insert_own_or_master on public.notifications;
create policy notifications_insert_own_or_master on public.notifications
for insert with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  )
);
