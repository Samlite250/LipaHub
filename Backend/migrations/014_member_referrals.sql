-- Record referral relationships and the member's country as selected at signup.
begin;

create table public.member_referrals (
  member_id uuid primary key references auth.users(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  member_country text not null,
  created_at timestamptz not null default now(),
  check (member_id <> inviter_id)
);
create index member_referrals_inviter on public.member_referrals(inviter_id, created_at);
alter table public.member_referrals enable row level security;
revoke all on public.member_referrals from public, anon, authenticated, service_role;
grant select on public.member_referrals to service_role;

create function public.resolve_member_referral(p_reference text, p_member uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  inviter uuid;
  reference text := btrim(coalesce(p_reference, ''));
begin
  if reference = '' then return null; end if;
  if reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select u.id into inviter
    from auth.users u
    where u.id = reference::uuid and (u.banned_until is null or u.banned_until <= now());
  else
    select lookup.id into inviter from public.resolve_invitation_username(reference) lookup;
    if inviter is null and reference ~ '^[A-Za-z0-9_-]{8}$' then
      select lookup.id into inviter from public.resolve_invitation_code(reference) lookup;
    end if;
  end if;
  if inviter = p_member then return null; end if;
  return inviter;
end $$;
revoke all on function public.resolve_member_referral(text, uuid) from public, anon, authenticated, service_role;

create function public.capture_member_referral()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  inviter uuid;
begin
  inviter := public.resolve_member_referral(new.raw_user_meta_data->>'invitation_reference', new.id);
  if inviter is not null then
    insert into public.member_referrals(member_id, inviter_id, member_country)
    values(new.id, inviter, case when lower(btrim(coalesce(new.raw_user_meta_data->>'country', ''))) in ('rwanda', 'rw') then 'Rwanda'
      else coalesce(nullif(btrim(new.raw_user_meta_data->>'country'), ''), 'International') end)
    on conflict (member_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.capture_member_referral() from public, anon, authenticated, service_role;
create trigger lipahub_capture_member_referral
after insert on auth.users
for each row execute function public.capture_member_referral();

do $$
declare
  account record;
  inviter uuid;
begin
  for account in
    select u.id, u.raw_user_meta_data->>'invitation_reference' as reference,
      case when lower(btrim(coalesce(u.raw_user_meta_data->>'country', ''))) in ('rwanda', 'rw')
        or exists(select 1 from public.rwanda_account_activations a where a.user_id = u.id)
        then 'Rwanda'
        else coalesce(nullif(btrim(u.raw_user_meta_data->>'country'), ''), 'International') end as member_country
    from auth.users u
    where nullif(btrim(u.raw_user_meta_data->>'invitation_reference'), '') is not null
  loop
    inviter := public.resolve_member_referral(account.reference, account.id);
    if inviter is not null then
      insert into public.member_referrals(member_id, inviter_id, member_country) values(account.id, inviter, account.member_country)
      on conflict (member_id) do nothing;
    end if;
  end loop;
end $$;

create function public.get_member_referrals(p_actor uuid)
returns table(member_id uuid, name text, country text, level integer, joined_at timestamptz, active boolean)
language sql stable security definer set search_path = '' as $$
  with recursive referral_tree(member_id, level, path) as (
    select r.member_id, 1, array[p_actor, r.member_id]
    from public.member_referrals r
    where r.inviter_id = p_actor
    union all
    select r.member_id, tree.level + 1, tree.path || r.member_id
    from referral_tree tree
    join public.member_referrals r on r.inviter_id = tree.member_id
    where tree.level < 3 and not r.member_id = any(tree.path)
  )
  select tree.member_id,
    left(coalesce(nullif(btrim(u.raw_user_meta_data->>'display_name'), ''), nullif(btrim(u.raw_user_meta_data->>'username'), ''), 'LipaHub member'), 120),
    referral.member_country,
    tree.level,
    u.created_at,
    case
      when referral.member_country = 'Rwanda'
        then exists(select 1 from public.rwanda_account_activations a where a.user_id = u.id and a.activated_at is not null)
      else exists(select 1 from public.robot_activation_requests request
        where request.user_id = u.id
          and request.country = referral.member_country
          and request.purpose = 'robot_activation'
          and request.status = 'verified')
    end
  from referral_tree tree
  join auth.users u on u.id = tree.member_id
  join public.member_referrals referral on referral.member_id = tree.member_id
  order by tree.level, u.created_at desc, u.id;
$$;
revoke all on function public.get_member_referrals(uuid) from public, anon, authenticated;
grant execute on function public.get_member_referrals(uuid) to service_role;

create or replace function public.backend_schema_revision()
returns integer language sql stable set search_path = '' as $$ select 9 $$;
revoke all on function public.backend_schema_revision() from public, anon, authenticated;
grant execute on function public.backend_schema_revision() to service_role;

commit;
