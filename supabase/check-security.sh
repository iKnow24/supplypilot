#!/bin/sh
# Database security invariants for everything in the public schema. Run after migrations
# (make db-check; CI runs it too). Fails loudly so a new table can't ship without RLS.
#   Local stack:     sh supabase/check-security.sh
#   Linked hosted project (supabase link):  REMOTE=1 sh supabase/check-security.sh
#   Any Postgres URL (needs psql):           DB_URL=postgresql://... sh supabase/check-security.sh
set -eu
if [ "${REMOTE:-}" = "1" ]; then
  # The linked hosted project, read-only, through the Supabase CLI (no psql needed).
  q() {
    apps/web/node_modules/.bin/supabase --workdir . db query --remote --read-only --output-format json "$1" 2>/dev/null |
      python3 -c 'import json,sys; [print(*r.values()) for r in json.load(sys.stdin)["rows"]]'
  }
elif [ -n "${DB_URL:-}" ]; then
  q() { psql "$DB_URL" -tA -c "$1"; }
else
  q() { docker exec supabase_db_supplypilot psql -U postgres -d postgres -tA -c "$1"; }
fi
fail=0
check() {
  out=$(q "$2")
  if [ -n "$out" ]; then echo "FAIL: $1: $out"; fail=1; else echo "ok:   $1"; fi
}

check "tables without row level security" "
  select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity having count(*) > 0"

check "table privileges granted to anon" "
  select string_agg(distinct table_name || ':' || privilege_type, ', ')
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public' having count(*) > 0"

check "functions anon can execute" "
  select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') having count(*) > 0"

check "SECURITY DEFINER functions without a fixed search_path" "
  select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  having count(*) > 0"

check "tables with RLS on but no policies (unreachable, probably a mistake)" "
  select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and not exists (select 1 from pg_policy pol where pol.polrelid = c.oid) having count(*) > 0"

exit $fail
