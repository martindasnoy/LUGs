create table if not exists public.wishlist_item_offers (
  offer_id uuid primary key default gen_random_uuid(),
  list_item_id uuid not null references public.list_items(item_id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (list_item_id, requester_id)
);

create index if not exists idx_wishlist_item_offers_item on public.wishlist_item_offers(list_item_id);
create index if not exists idx_wishlist_item_offers_requester on public.wishlist_item_offers(requester_id);

alter table public.wishlist_item_offers enable row level security;

drop policy if exists wishlist_item_offers_select_auth on public.wishlist_item_offers;
create policy wishlist_item_offers_select_auth on public.wishlist_item_offers
  for select to authenticated using (true);

drop policy if exists wishlist_item_offers_insert_own on public.wishlist_item_offers;
create policy wishlist_item_offers_insert_own on public.wishlist_item_offers
  for insert to authenticated with check (auth.uid() = requester_id);

drop policy if exists wishlist_item_offers_update_own on public.wishlist_item_offers;
create policy wishlist_item_offers_update_own on public.wishlist_item_offers
  for update to authenticated using (auth.uid() = requester_id) with check (auth.uid() = requester_id);

drop policy if exists wishlist_item_offers_delete_own on public.wishlist_item_offers;
create policy wishlist_item_offers_delete_own on public.wishlist_item_offers
  for delete to authenticated using (auth.uid() = requester_id);
