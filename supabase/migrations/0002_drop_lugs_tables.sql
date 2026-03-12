drop table if exists public.lug_join_requests cascade;
drop table if exists public.messages cascade;
drop table if exists public.conversation_participants cascade;
drop table if exists public.conversations cascade;
drop table if exists public.notifications cascade;
drop table if exists public.lug_memberships cascade;
drop table if exists public.lugs cascade;

drop function if exists public.handle_new_lug() cascade;
drop function if exists public.handle_join_request_approved() cascade;
drop function if exists public.is_master_user() cascade;
drop function if exists public.get_lugs_panel_data() cascade;
drop function if exists public.get_lugs_panel_data(uuid) cascade;
