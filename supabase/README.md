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

## Notes

- This reset leaves only user/auth related data (`auth.users` + `public.profiles`).
- Do not expose secret keys in frontend code.
