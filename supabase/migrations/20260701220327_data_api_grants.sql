-- 20260701220327_data_api_grants.sql
-- Make the Data API table grants EXPLICIT instead of relying on Supabase's
-- legacy implicit default privileges.
--
-- WHY: the Supabase CLI's auto_expose_new_tables default flipped on 2026-05-30;
-- fresh local/CI stacks no longer hand anon/authenticated/service_role the
-- legacy default table privileges. This project's schema predated that flip and
-- never declared grants, so the CI pgTAP suite failed with
-- "42501: permission denied for table recipes" while prod (which keeps its
-- pre-flip grants) kept working. Root cause reproduced and this exact fix
-- verified locally on 2026-07-01: without grants the suite dies at test 1;
-- with them all 33 assertions pass.
--
-- Row-level security remains the actual security gate on every table (owner
-- policies keyed on auth.uid()); these grants are the coarse capability layer
-- RLS filters beneath, restoring exactly what Supabase's legacy defaults gave.
--
-- SAFETY: grants only; writes no rows; touches no data. On prod this is a
-- NO-OP that documents existing reality (verified: authenticated already holds
-- full DML there). No sequence grants are needed: every table uses uuid
-- primary keys via gen_random_uuid(); there are no serial/identity sequences.
--
-- PREFLIGHT (read-only; on prod EXPECT these grants to already be present):
--   select grantee, table_name, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and grantee in ('anon', 'authenticated', 'service_role')
--   order by table_name, grantee, privilege_type;
--
-- ROLLBACK: revoke the same grants (would break fresh stacks again, not prod):
--   revoke select, insert, update, delete on table public.recipes, ... ;

grant select, insert, update, delete on table
  public.recipes,
  public.ingredients,
  public.recipe_steps,
  public.recipe_tags,
  public.tags,
  public.meal_plans,
  public.meal_plan_items,
  public.user_settings,
  public.grocery_list_items
to authenticated, service_role;

-- Units are a globally readable lookup (RLS policy: select using true).
grant select on table public.units to anon, authenticated, service_role;
