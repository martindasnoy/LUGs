alter table public.lug_join_requests
add column if not exists request_message text;

alter table public.lug_join_requests
add column if not exists contact_social text;

alter table public.lug_join_requests
drop constraint if exists lug_join_requests_status_check;

alter table public.lug_join_requests
add constraint lug_join_requests_status_check
check (status in ('pending', 'cancelled', 'rejected', 'accepted'));
