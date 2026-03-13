# Supabase setup (users only)

## Folder structure

- `supabase/migrations/0001_users_only_schema.sql`
  - Creates only `profiles` + trigger + RLS for authenticated users.
- `supabase/migrations/0002_drop_lugs_tables.sql`
  - Drops all LUG-related tables and functions.
- `supabase/migrations/0003_add_is_master_to_profiles.sql`
  - Adds `profiles.is_master` for master panel visibility.
- `supabase/migrations/0004_create_lugs_and_profile_role.sql`
  - Creates `lugs` table and adds `profiles.rol_lug`.
- `supabase/migrations/0005_add_lugs_profile_constraints.sql`
  - Adds color hex checks and allowed values for `profiles.rol_lug`.
- `supabase/migrations/0006_add_logo_to_lugs.sql`
  - Adds logo field to `lugs` table.
- `supabase/migrations/0007_add_profile_lug_id.sql`
  - Adds `profiles.lug_id` to link users with LUGs.
- `supabase/migrations/0008_add_current_lug_id_to_profiles.sql`
  - Adds `profiles.current_lug_id` and backfills from `lug_id`.
- `supabase/migrations/0009_update_rol_lug_allowed_values.sql`
  - Restricts `profiles.rol_lug` to `admin` or `common`.
- `supabase/migrations/0010_add_lug_member_rpc.sql`
  - Adds RPCs to read LUG members and counts by `profiles.current_lug_id`.
- `supabase/migrations/0011_drop_profiles_lug_id.sql`
  - Backfills `current_lug_id` and removes legacy `profiles.lug_id`.
- `supabase/migrations/0012_add_lug_join_requests.sql`
  - Adds join request notifications for LUG admins.
- `supabase/migrations/0013_add_admin_pending_requests_rpc.sql`
  - Adds RPC for admins to read pending requests list.
- `supabase/migrations/0014_extend_lug_join_requests.sql`
  - Adds request message/social and status values `accepted`/`rejected`.
- `supabase/migrations/0015_add_join_request_resolution_rpc.sql`
  - Adds RPC for admin request detail and accept/reject actions.
- `supabase/migrations/0016_update_lug_members_rpc_with_role.sql`
  - Updates LUG members RPC to include `rol_lug` for admin badge in member list.
- `supabase/migrations/0017_add_promote_member_admin_rpc.sql`
  - Adds RPC to let LUG admins promote a member to admin.
- `supabase/migrations/0018_empty_lug_notifications_and_open_access.sql`
  - Adds empty LUG notifications for master and open-access resolution flow.
- `supabase/migrations/0019_add_admin_handover_on_leave.sql`
  - Transfers admin role to the next member when an admin leaves a LUG.
- `supabase/migrations/0020_add_dashboard_bootstrap_rpc.sql`
  - Adds a single RPC to bootstrap dashboard state in one request.
- `supabase/migrations/0021_add_lug_logos_storage_bucket.sql`
  - Creates public storage bucket for LUG logos to avoid base64-heavy DB payloads.
- `supabase/migrations/0022_add_global_maintenance_and_bootstrap_fields.sql`
  - Adds global maintenance settings and extends dashboard bootstrap RPC.
- `supabase/migrations/0023_fix_app_maintenance_rls_insert.sql`
  - Fixes RLS insert policy for app maintenance setup.
- `supabase/migrations/0024_create_lists_and_list_items.sql`
  - Creates `lists` and `list_items` tables with RLS policies.
- `supabase/migrations/0025_create_parts_catalog_and_search_rpc.sql`
  - Adds local parts catalog, categories, and search RPC for list item picker.

## How to run in Supabase dashboard

1. Open `SQL Editor` in your Supabase project.
2. Run `0002_drop_lugs_tables.sql` first (clean LUG data/model).
3. Run `0001_users_only_schema.sql`.
4. Run `0003_add_is_master_to_profiles.sql`.
5. Run `0004_create_lugs_and_profile_role.sql`.
6. Run `0005_add_lugs_profile_constraints.sql`.
7. Run `0006_add_logo_to_lugs.sql`.
8. Run `0007_add_profile_lug_id.sql`.
9. Run `0008_add_current_lug_id_to_profiles.sql`.
10. Run `0009_update_rol_lug_allowed_values.sql`.
11. Run `0010_add_lug_member_rpc.sql`.
12. Run `0011_drop_profiles_lug_id.sql`.
13. Run `0012_add_lug_join_requests.sql`.
14. Run `0013_add_admin_pending_requests_rpc.sql`.
15. Run `0014_extend_lug_join_requests.sql`.
16. Run `0015_add_join_request_resolution_rpc.sql`.
17. Run `0016_update_lug_members_rpc_with_role.sql`.
18. Run `0017_add_promote_member_admin_rpc.sql`.
19. Run `0018_empty_lug_notifications_and_open_access.sql`.
20. Run `0019_add_admin_handover_on_leave.sql`.
21. Run `0020_add_dashboard_bootstrap_rpc.sql`.
22. Run `0021_add_lug_logos_storage_bucket.sql`.
23. Run `0022_add_global_maintenance_and_bootstrap_fields.sql`.
24. Run `0023_fix_app_maintenance_rls_insert.sql`.
25. Run `0024_create_lists_and_list_items.sql`.
26. Run `0025_create_parts_catalog_and_search_rpc.sql`.

## Notes

- This reset leaves only user/auth related data (`auth.users` + `public.profiles`).
- Do not expose secret keys in frontend code.
