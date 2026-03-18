alter table public.minifig_user_inventory
add column if not exists is_favorite boolean not null default false;

create table if not exists public.minifig_user_series_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  theme_id integer not null,
  is_selected boolean not null default false,
  is_favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, theme_id)
);

alter table public.minifig_user_series_preferences enable row level security;

drop policy if exists minifig_user_series_preferences_select_own on public.minifig_user_series_preferences;
create policy minifig_user_series_preferences_select_own
on public.minifig_user_series_preferences
for select
using (auth.uid() = user_id);

drop policy if exists minifig_user_series_preferences_insert_own on public.minifig_user_series_preferences;
create policy minifig_user_series_preferences_insert_own
on public.minifig_user_series_preferences
for insert
with check (auth.uid() = user_id);

drop policy if exists minifig_user_series_preferences_update_own on public.minifig_user_series_preferences;
create policy minifig_user_series_preferences_update_own
on public.minifig_user_series_preferences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists minifig_user_series_preferences_delete_own on public.minifig_user_series_preferences;
create policy minifig_user_series_preferences_delete_own
on public.minifig_user_series_preferences
for delete
using (auth.uid() = user_id);

create table if not exists public.minifig_user_ui_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  show_only_favorite_series boolean not null default false,
  show_only_favorite_figures boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.minifig_user_ui_preferences enable row level security;

drop policy if exists minifig_user_ui_preferences_select_own on public.minifig_user_ui_preferences;
create policy minifig_user_ui_preferences_select_own
on public.minifig_user_ui_preferences
for select
using (auth.uid() = user_id);

drop policy if exists minifig_user_ui_preferences_insert_own on public.minifig_user_ui_preferences;
create policy minifig_user_ui_preferences_insert_own
on public.minifig_user_ui_preferences
for insert
with check (auth.uid() = user_id);

drop policy if exists minifig_user_ui_preferences_update_own on public.minifig_user_ui_preferences;
create policy minifig_user_ui_preferences_update_own
on public.minifig_user_ui_preferences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists minifig_user_ui_preferences_delete_own on public.minifig_user_ui_preferences;
create policy minifig_user_ui_preferences_delete_own
on public.minifig_user_ui_preferences
for delete
using (auth.uid() = user_id);
