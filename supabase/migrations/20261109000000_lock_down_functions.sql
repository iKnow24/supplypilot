-- Milestone 6: no function in public is callable by anonymous users.
-- touch_updated_at kept Postgres' default EXECUTE-to-PUBLIC grant. It's a trigger function
-- (calling it directly fails), but "anon can execute nothing" should hold without exceptions,
-- and functions created by later migrations should start closed too.

revoke execute on function public.touch_updated_at() from public, anon, authenticated;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
