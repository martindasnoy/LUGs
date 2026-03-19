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
- `supabase/migrations/0026_create_part_color_catalog.sql`
  - Adds local cache table for per-part color availability and color-specific images.
- `supabase/migrations/0027_add_imgmatchcolor_to_list_items.sql`
  - Adds persisted `imgmatchcolor` flag in `list_items` to avoid recalculating color-image match at runtime.
- `supabase/migrations/0028_create_wishlist_item_offers.sql`
  - Adds wishlist offers table so members can offer quantity on public wishlist items.
- `supabase/migrations/0029_add_value_to_list_items.sql`
  - Adds `list_items.value` (price) with non-negative constraint for sale lists.
- `supabase/migrations/0030_fix_handle_new_user_username_conflicts.sql`
  - Makes `handle_new_user` resilient to duplicate usernames (same local-part email) to avoid signup failures.
- `supabase/migrations/0031_add_footer_legend_to_app_maintenance.sql`
  - Adds customizable footer legend and extends dashboard bootstrap with `maintenance_footer_legend`.
- `supabase/migrations/0032_create_minifigure_series_catalog.sql`
  - Adds local cache table for minifigure collectible series.
- `supabase/migrations/0033_create_minifig_user_inventory.sql`
  - Adds per-user minifigure and minifigure-part inventory tables with RLS.
- `supabase/migrations/0034_add_minifig_preferences.sql`
  - Adds per-user series selection/favorites, UI preference flags, and minifigure favorites.
- `supabase/migrations/0035_create_minifig_catalog_sets_and_parts.sql`
  - Adds local minifigure sets and set-parts catalog tables for a Rebrickable-free Minifiguras section.
- `supabase/migrations/0036_add_parts_import_status_to_minifigure_sets_catalog.sql`
  - Adds `parts_import_status` to track pending/imported/empty sets and avoid retrying known-empty imports.
- `supabase/migrations/0037_add_get_profile_names_by_ids_rpc.sql`
  - Adds a security-definer RPC to resolve profile display names across users for offers/pools UIs.
- `supabase/migrations/0038_add_dashboard_sections_visibility_to_app_maintenance.sql`
  - Adds ON/OFF toggles for Dashboard sections (balance, listas, sets, minifiguras).

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
27. Run `0026_create_part_color_catalog.sql`.
28. Run `0027_add_imgmatchcolor_to_list_items.sql`.
29. Run `0028_create_wishlist_item_offers.sql`.
30. Run `0029_add_value_to_list_items.sql`.
31. Run `0030_fix_handle_new_user_username_conflicts.sql`.
32. Run `0031_add_footer_legend_to_app_maintenance.sql`.
33. Run `0032_create_minifigure_series_catalog.sql`.
34. Run `0033_create_minifig_user_inventory.sql`.
35. Run `0034_add_minifig_preferences.sql`.
36. Run `0035_create_minifig_catalog_sets_and_parts.sql`.
37. Run `0036_add_parts_import_status_to_minifigure_sets_catalog.sql`.
38. Run `0037_add_get_profile_names_by_ids_rpc.sql`.
39. Run `0038_add_dashboard_sections_visibility_to_app_maintenance.sql`.

## Notes

- This reset leaves only user/auth related data (`auth.users` + `public.profiles`).
- Do not expose secret keys in frontend code.
