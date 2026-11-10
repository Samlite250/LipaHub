-- Members read published instructions through the API, which filters disabled
-- methods. Direct table reads would expose the complete JSON, including drafts.
begin;
revoke all on public.robot_payment_instructions from public,anon,authenticated;
drop policy instructions_authenticated_read on public.robot_payment_instructions;
-- Service-role access and administrator-only editing RPC permissions are retained.
create function public.backend_schema_revision()
returns integer language sql stable set search_path = '' as $$ select 8 $$;
revoke all on function public.backend_schema_revision() from public,anon,authenticated;
grant execute on function public.backend_schema_revision() to service_role;
commit;
