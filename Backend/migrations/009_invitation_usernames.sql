-- Preserve the existing registration username separately from the display name.
-- Duplicate legacy names remain ambiguous and never select an arbitrary account.
begin;
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('username', btrim(raw_user_meta_data->>'display_name'))
where nullif(btrim(raw_user_meta_data->>'username'), '') is null
  and nullif(btrim(raw_user_meta_data->>'display_name'), '') is not null;

create or replace function public.resolve_invitation_username(p_username text)
returns table(id uuid, username text)
language sql stable security definer set search_path = '' as $$
  with matches as (
    select u.id, btrim(coalesce(nullif(u.raw_user_meta_data->>'username', ''), u.raw_user_meta_data->>'display_name', '')) as username,
      u.banned_until
    from auth.users u
    where lower(btrim(coalesce(nullif(u.raw_user_meta_data->>'username', ''), u.raw_user_meta_data->>'display_name', ''))) = lower(btrim(p_username))
      and char_length(p_username) between 2 and 80
    limit 2
  )
  select m.id, m.username from matches m
  where (select count(*) from matches) = 1
    and (m.banned_until is null or m.banned_until <= now());
$$;
revoke all on function public.resolve_invitation_username(text) from public, anon, authenticated;
grant execute on function public.resolve_invitation_username(text) to service_role;
commit;
