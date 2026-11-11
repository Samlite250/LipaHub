-- Short opaque username hashes for alternative invitation URLs.
-- Collisions and duplicate usernames never select an arbitrary account.
begin;
create or replace function public.resolve_invitation_code(p_code text)
returns table(id uuid, username text)
language sql stable security definer set search_path = '' as $$
  with matches as (
    select u.id,
      btrim(coalesce(nullif(u.raw_user_meta_data->>'username', ''), u.raw_user_meta_data->>'display_name', '')) as username,
      u.banned_until
    from auth.users u
    where left(translate(encode(sha256(convert_to(lower(btrim(coalesce(nullif(u.raw_user_meta_data->>'username', ''), u.raw_user_meta_data->>'display_name', ''))), 'UTF8')), 'base64'), '+/', '-_'), 8) = p_code
      and char_length(p_code) = 8
      and char_length(btrim(coalesce(nullif(u.raw_user_meta_data->>'username', ''), u.raw_user_meta_data->>'display_name', ''))) between 2 and 80
    limit 2
  )
  select m.id, m.username from matches m
  where (select count(*) from matches) = 1
    and (m.banned_until is null or m.banned_until <= now());
$$;
revoke all on function public.resolve_invitation_code(text) from public, anon, authenticated;
grant execute on function public.resolve_invitation_code(text) to service_role;
commit;
