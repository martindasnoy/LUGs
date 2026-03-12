# Supabase setup

## Folder structure

- `supabase/migrations/0001_init_schema.sql`
  - Creates tables, indexes, trigger and RLS policies.
- `supabase/migrations/0002_set_master_user.sql`
  - Marks one user as `is_master = true`.
- `supabase/migrations/0003_lug_owner_membership.sql`
  - Auto-creates owner membership when a LUG is created.
- `supabase/migrations/0004_lug_join_requests.sql`
  - Adds join-request flow and approval policies.
- `supabase/migrations/0005_profile_onboarding_fields.sql`
  - Adds profile onboarding fields (country, social links).
- `supabase/migrations/0006_fix_profiles_rls_recursion.sql`
  - Fixes recursive RLS error on `profiles`.
- `supabase/migrations/0007_profile_avatar_social_fields.sql`
  - Adds social + avatar fields for profile panel.
- `supabase/migrations/0008_profile_language.sql`
  - Adds preferred language field in profiles.
- `supabase/migrations/0009_lug_setup_fields_and_admin_membership.sql`
  - Adds LUG setup fields and sets creator membership as admin.
- `supabase/migrations/0010_lug_ui_colors_and_panel_access.sql`
  - Adds 4 UI colors per LUG and read policies for LUG panel/member list.
- `supabase/migrations/0011_profile_current_lug_and_membership_status.sql`
  - Adds `profiles.current_lug_id` and `lug_memberships.membership_status`.
- `supabase/migrations/0012_get_lugs_panel_data_rpc.sql`
  - Adds RPC `get_lugs_panel_data` for reliable LUG panel loading.
- `supabase/migrations/0013_get_lugs_panel_data_noargs.sql`
  - Adds no-args RPC variant for schema cache compatibility.
- `supabase/migrations/0014_profiles_insert_policy.sql`
  - Allows users to insert their own missing profile row.

## How to run in Supabase dashboard

1. Open `SQL Editor` in your Supabase project.
2. Run `0001_init_schema.sql` first.
3. Edit `0002_set_master_user.sql` and replace `TU_EMAIL_MASTER@MAIL.COM`.
4. Run `0002_set_master_user.sql`.
5. Run `0003_lug_owner_membership.sql`.
6. Run `0004_lug_join_requests.sql`.
7. Run `0005_profile_onboarding_fields.sql`.
8. Run `0006_fix_profiles_rls_recursion.sql`.
9. Run `0007_profile_avatar_social_fields.sql`.
10. Run `0008_profile_language.sql`.
11. Run `0009_lug_setup_fields_and_admin_membership.sql`.
12. Run `0010_lug_ui_colors_and_panel_access.sql`.
13. Run `0011_profile_current_lug_and_membership_status.sql`.
14. Run `0012_get_lugs_panel_data_rpc.sql`.
15. Run `0013_get_lugs_panel_data_noargs.sql`.
16. Run `0014_profiles_insert_policy.sql`.

## Notes

- Run file 2 only after at least one user has registered.
- Do not expose secret keys in frontend code.
