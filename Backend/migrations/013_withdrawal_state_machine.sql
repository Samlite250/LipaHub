-- Manual-review withdrawals. Funds are held in the per-currency clearing
-- account while a request is open. No provider is contacted here: an
-- administrator records the payout, and every balance change is atomic.
begin;

create table if not exists public.withdrawal_requests (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  country text not null check (char_length(country) between 2 and 100),
  currency text not null check (currency in ('RWF','BIF','UGX','KES','ZAR','USD')),
  channel text not null default 'main' check (channel in ('main','youtube','trivia','games','tiktok','socials','chat')),
  amount_minor bigint not null check (amount_minor between 1 and 1000000000000),
  destination jsonb not null check (jsonb_typeof(destination) = 'object'),
  status text not null default 'requested' check (status in ('requested','under_review','approved','rejected','cancelled','paid')),
  version integer not null default 1 check (version >= 1),
  request_id uuid not null unique,
  review_note text not null default '' check (char_length(review_note) <= 1000),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((decided_at is null) = (decided_by is null)),
  check (paid_at is null or status = 'paid')
);
create index if not exists withdrawal_requests_owner_date on public.withdrawal_requests(user_id, created_at desc);
create index if not exists withdrawal_requests_status_date on public.withdrawal_requests(status, created_at desc);
create table if not exists public.withdrawal_transitions (
  id uuid primary key,
  request_id uuid not null references public.withdrawal_requests(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  from_status text not null,
  to_status text not null,
  note text not null default '' check (char_length(note) <= 1000),
  amount_minor bigint not null check (amount_minor between 1 and 1000000000000),
  created_at timestamptz not null default now()
);
create index if not exists withdrawal_transitions_request on public.withdrawal_transitions(request_id, created_at);
alter table public.withdrawal_requests enable row level security;
alter table public.withdrawal_transitions enable row level security;
revoke all on public.withdrawal_requests, public.withdrawal_transitions from public, anon, authenticated, service_role;
grant select on public.withdrawal_requests, public.withdrawal_transitions to service_role;

-- Member-initiated hold. The caller supplies the request UUID, so retries of the
-- same submission return the saved request instead of holding funds twice.
create or replace function public.request_withdrawal(p_actor uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  wallet public.system_balance_accounts;
  existing public.withdrawal_requests;
  new_id uuid;
  region text;
  source_channel text;
  destination jsonb;
  amount bigint;
  currency_code text;
begin
  if p_actor is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Invalid withdrawal request' using errcode = '22023'; end if;
  if not exists(select 1 from auth.users u where u.id = p_actor and (u.banned_until is null or u.banned_until < now())
      and not exists(select 1 from public.rwanda_account_activations a where a.user_id = u.id and a.activated_at is null)) then raise insufficient_privilege; end if;
  if coalesce(p_payload->>'id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'Invalid withdrawal ID' using errcode = '22023'; end if;
  new_id := (p_payload->>'id')::uuid;
  region := p_payload->>'country';
  if region is null or char_length(region) not between 2 and 100 then raise exception 'Select a supported wallet country' using errcode = '22023'; end if;
  source_channel := coalesce(p_payload->>'channel','main');
  if source_channel is null or source_channel not in ('main','youtube','trivia','games','tiktok','socials','chat') then raise exception 'Invalid withdrawal channel' using errcode = '22023'; end if;
  -- Only the account wallet is funded; activity-specific earnings are not connected yet.
  if source_channel <> 'main' then raise exception 'This withdrawal channel is not available' using errcode = '22023'; end if;
  if coalesce(p_payload->>'amountMinor','') !~ '^[1-9][0-9]{0,12}$' then raise exception 'Enter a valid withdrawal amount' using errcode = '22023'; end if;
  amount := (p_payload->>'amountMinor')::bigint;
  if amount > 1000000000000 then raise exception 'Enter a valid withdrawal amount' using errcode = '22023'; end if;
  destination := p_payload->'destination';
  if destination is null or jsonb_typeof(destination) <> 'object' or pg_catalog.pg_column_size(destination) > 2000 then raise exception 'Enter valid payout details' using errcode = '22023'; end if;
  if coalesce(destination->>'method','') not in ('mobile_money','bank','wallet') or char_length(coalesce(destination->>'account','')) not between 2 and 200
      or char_length(coalesce(destination->>'holder','')) > 120 then raise exception 'Enter valid payout details' using errcode = '22023'; end if;
  -- Serialize retries of the same submission before checking its prior receipt.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new_id::text,0));
  select * into existing from public.withdrawal_requests where id = new_id;
  if found then
    if existing.user_id <> p_actor or existing.country <> region or existing.channel <> source_channel
        or existing.amount_minor <> amount or existing.destination is distinct from destination then
      raise exception 'Request ID reused' using errcode = '23505';
    end if;
    return to_jsonb(existing);
  end if;
  currency_code := case region when 'Rwanda' then 'RWF' when 'Burundi' then 'BIF' when 'Uganda' then 'UGX' when 'Kenya' then 'KES' when 'South Africa' then 'ZAR' else 'USD' end;
  insert into public.system_balance_clearing(currency) values(currency_code) on conflict do nothing;
  perform 1 from public.system_balance_clearing where currency = currency_code for update;
  select * into wallet from public.system_balance_accounts where user_id = p_actor and country = region for update;
  if not found or wallet.available_minor < amount then raise exception 'Insufficient available balance' using errcode = '22023'; end if;
  if wallet.currency <> currency_code then raise exception 'Wallet currency mismatch' using errcode = '22023'; end if;
  update public.system_balance_accounts set available_minor = available_minor - amount, version = version + 1, updated_at = now()
    where user_id = p_actor and country = region;
  insert into public.system_balance_adjustments(user_id,country,currency,available_before,available_after,bonus_before,bonus_after,clearing_delta,reason,actor_id,request_id,expected_version)
    values(p_actor,region,currency_code,wallet.available_minor,wallet.available_minor - amount,wallet.bonus_minor,wallet.bonus_minor,amount,'Withdrawal hold: main balance (' || new_id::text || ')',p_actor,new_id,wallet.version);
  update public.system_balance_clearing set balance_minor = balance_minor + amount where currency = currency_code;
  insert into public.withdrawal_requests(id,user_id,country,currency,channel,amount_minor,destination,status,version,request_id)
    values(new_id,p_actor,region,currency_code,source_channel,amount,destination,'requested',1,new_id);
  insert into public.withdrawal_transitions(id,request_id,actor_id,from_status,to_status,note,amount_minor)
    values(pg_catalog.gen_random_uuid(),new_id,p_actor,'','requested','',amount);
  select * into existing from public.withdrawal_requests where id = new_id;
  return to_jsonb(existing);
end $$;
revoke all on function public.request_withdrawal(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.request_withdrawal(uuid,jsonb) to service_role;

-- Members may cancel an open request; the held amount is refunded atomically.
create or replace function public.cancel_withdrawal(p_actor uuid, p_id uuid, p_note text, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request_row public.withdrawal_requests;
  wallet public.system_balance_accounts;
  receipt_id uuid;
  previous_status text;
begin
  if p_actor is null or p_id is null or p_expected_version is null or p_expected_version < 1 or p_note is null or char_length(trim(p_note)) > 1000 then raise exception 'Invalid cancellation' using errcode = '22023'; end if;
  if not exists(select 1 from auth.users u where u.id = p_actor and (u.banned_until is null or u.banned_until < now())) then raise insufficient_privilege; end if;
  select * into request_row from public.withdrawal_requests where id = p_id for update;
  if not found then raise exception 'Withdrawal not found' using errcode = 'P0002'; end if;
  if request_row.status = 'cancelled' and request_row.decided_by = p_actor and request_row.version = p_expected_version + 1 then return to_jsonb(request_row); end if;
  if request_row.user_id <> p_actor then raise insufficient_privilege; end if;
  if request_row.version <> p_expected_version then raise exception 'Withdrawal changed' using errcode = '40001'; end if;
  if request_row.status not in ('requested','under_review') then raise exception 'Withdrawal can no longer be cancelled' using errcode = '40001'; end if;
  perform 1 from public.system_balance_clearing where currency = request_row.currency for update;
  select * into wallet from public.system_balance_accounts where user_id = request_row.user_id and country = request_row.country for update;
  if not found or wallet.available_minor + request_row.amount_minor > 1000000000000 then raise exception 'Balance limit exceeded' using errcode = '22023'; end if;
  receipt_id := pg_catalog.gen_random_uuid();
  previous_status := request_row.status;
  update public.system_balance_accounts set available_minor = available_minor + request_row.amount_minor, version = version + 1, updated_at = now()
    where user_id = request_row.user_id and country = request_row.country;
  insert into public.system_balance_adjustments(user_id,country,currency,available_before,available_after,bonus_before,bonus_after,clearing_delta,reason,actor_id,request_id,expected_version)
    values(request_row.user_id,request_row.country,request_row.currency,wallet.available_minor,wallet.available_minor + request_row.amount_minor,wallet.bonus_minor,wallet.bonus_minor,-request_row.amount_minor,'Withdrawal cancelled refund (' || p_id::text || ')',p_actor,receipt_id,wallet.version);
  update public.system_balance_clearing set balance_minor = balance_minor - request_row.amount_minor where currency = request_row.currency;
  update public.withdrawal_requests set status = 'cancelled', version = version + 1, review_note = trim(p_note), decided_by = p_actor, decided_at = now(), updated_at = now()
    where id = p_id returning * into request_row;
  insert into public.withdrawal_transitions(id,request_id,actor_id,from_status,to_status,note,amount_minor)
    values(receipt_id,p_id,p_actor,previous_status,'cancelled',trim(p_note),request_row.amount_minor);
  return to_jsonb(request_row);
end $$;
revoke all on function public.cancel_withdrawal(uuid,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.cancel_withdrawal(uuid,uuid,text,integer) to service_role;

-- Administrator state machine. Rejection refunds the held amount. A paid payout
-- needs no extra wallet change because the hold already moved funds into
-- clearing, so reconciliation stays: wallets + clearing = 0.
create or replace function public.review_withdrawal(p_id uuid, p_status text, p_note text, p_actor uuid, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request_row public.withdrawal_requests;
  wallet public.system_balance_accounts;
  receipt_id uuid;
  previous_status text;
begin
  if p_id is null or p_status is null or p_note is null or char_length(trim(p_note)) > 1000 or p_expected_version is null or p_expected_version < 1 then raise exception 'Invalid review' using errcode = '22023'; end if;
  if p_status not in ('under_review','approved','rejected','paid') or (p_status in ('approved','rejected','paid') and char_length(trim(p_note)) < 3) then raise exception 'Invalid review' using errcode = '22023'; end if;
  if not exists(select 1 from auth.users where id = p_actor and raw_app_meta_data->>'role' = 'admin' and (banned_until is null or banned_until < now())) then raise insufficient_privilege; end if;
  select * into request_row from public.withdrawal_requests where id = p_id for update;
  if not found then raise exception 'Withdrawal not found' using errcode = 'P0002'; end if;
  -- A network retry of the exact same decision is harmless, including after COMMIT.
  if request_row.status = p_status and request_row.decided_by = p_actor and request_row.review_note = trim(p_note) and request_row.version = p_expected_version + 1 then return to_jsonb(request_row); end if;
  if request_row.version <> p_expected_version then raise exception 'Withdrawal changed' using errcode = '40001'; end if;
  if p_status = 'under_review' and request_row.status <> 'requested' then raise exception 'Withdrawal is no longer reviewable' using errcode = '40001'; end if;
  if p_status = 'approved' and request_row.status <> 'under_review' then raise exception 'Withdrawal cannot be approved from its current state' using errcode = '40001'; end if;
  if p_status = 'rejected' and request_row.status not in ('requested','under_review','approved') then raise exception 'Withdrawal cannot be rejected from its current state' using errcode = '40001'; end if;
  if p_status = 'paid' and request_row.status <> 'approved' then raise exception 'Withdrawal must be approved before payout' using errcode = '40001'; end if;
  previous_status := request_row.status;
  -- A held amount already moved into clearing, so marking it paid needs no
  -- further balance change. A rejection returns the hold to the member wallet.
  if p_status = 'rejected' then
    perform 1 from public.system_balance_clearing where currency = request_row.currency for update;
    select * into wallet from public.system_balance_accounts where user_id = request_row.user_id and country = request_row.country for update;
    if not found or wallet.available_minor + request_row.amount_minor > 1000000000000 then raise exception 'Balance limit exceeded' using errcode = '22023'; end if;
    receipt_id := pg_catalog.gen_random_uuid();
    update public.system_balance_accounts set available_minor = available_minor + request_row.amount_minor, version = version + 1, updated_at = now()
      where user_id = request_row.user_id and country = request_row.country;
    insert into public.system_balance_adjustments(user_id,country,currency,available_before,available_after,bonus_before,bonus_after,clearing_delta,reason,actor_id,request_id,expected_version)
      values(request_row.user_id,request_row.country,request_row.currency,wallet.available_minor,wallet.available_minor + request_row.amount_minor,wallet.bonus_minor,wallet.bonus_minor,-request_row.amount_minor,'Withdrawal rejected refund (' || p_id::text || ')',p_actor,receipt_id,wallet.version);
    update public.system_balance_clearing set balance_minor = balance_minor - request_row.amount_minor where currency = request_row.currency;
  end if;
  update public.withdrawal_requests set status = p_status, version = version + 1, review_note = trim(p_note), decided_by = p_actor, decided_at = now(),
    paid_at = case when p_status = 'paid' then now() else paid_at end, updated_at = now()
    where id = p_id returning * into request_row;
  insert into public.withdrawal_transitions(id,request_id,actor_id,from_status,to_status,note,amount_minor)
    values(coalesce(receipt_id,pg_catalog.gen_random_uuid()),p_id,p_actor,previous_status,p_status,trim(p_note),request_row.amount_minor);
  insert into public.system_admin_audit(actor_id,action,target_id,outcome) values(p_actor,'withdrawals.' || p_status,p_id::text,'succeeded');
  return to_jsonb(request_row);
end $$;
revoke all on function public.review_withdrawal(uuid,text,text,uuid,integer) from public, anon, authenticated;
grant execute on function public.review_withdrawal(uuid,text,text,uuid,integer) to service_role;
commit;
