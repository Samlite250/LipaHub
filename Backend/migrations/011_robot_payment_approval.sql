-- Manual payment approval, robot activation and the saved one-time bonus commit together.
begin;
alter table public.robot_activation_requests add column review_version integer not null default 1 check (review_version > 0);
alter table public.robot_activation_requests add column bonus_credited_minor bigint not null default 0 check (bonus_credited_minor >= 0);
drop function public.review_robot_activation_request(uuid,text,text,uuid);
create function public.review_robot_activation_request(p_id uuid,p_status text,p_note text,p_actor uuid,p_expected_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare receipt public.robot_activation_requests; wallet public.system_balance_accounts; bonus_amount bigint; currency_code text;
begin
  if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'role'='admin' and (banned_until is null or banned_until<now())) then raise insufficient_privilege; end if;
  if p_status is null or p_status not in ('under_review','rejected','verified') or p_note is null or char_length(trim(p_note))>1000 or (p_status in ('verified','rejected') and char_length(trim(p_note))<3) or p_expected_version is null or p_expected_version<1 then raise exception 'Invalid review' using errcode='22023'; end if;
  select * into receipt from public.robot_activation_requests where id=p_id for update;
  if not found then raise exception 'Request not found' using errcode='P0002'; end if;
  -- A network retry of the exact same decision is harmless, including after COMMIT.
  if receipt.status=p_status and receipt.reviewed_by=p_actor and receipt.review_note=trim(p_note) and receipt.review_version=p_expected_version+1 then return; end if;
  if receipt.review_version<>p_expected_version or receipt.status not in ('pending_review','under_review') then raise exception 'Request already reviewed or changed' using errcode='40001'; end if;
  bonus_amount := 0;
  if p_status='verified' then
    if not exists(select 1 from auth.users where id=receipt.user_id and (banned_until is null or banned_until<now())) then raise insufficient_privilege; end if;
    if not exists(select 1 from public.robot_payment_proofs where request_id=p_id) then raise exception 'Payment proof required' using errcode='22023'; end if;
    currency_code := case receipt.country when 'Burundi' then 'BIF' when 'Uganda' then 'UGX' when 'Kenya' then 'KES' when 'South Africa' then 'ZAR' else 'USD' end;
    if receipt.quote->>'currency' is distinct from currency_code or coalesce(receipt.quote->>'bonusMinor','') !~ '^[0-9]{1,13}$' then raise exception 'Invalid saved plan bonus' using errcode='22023'; end if;
    bonus_amount := (receipt.quote->>'bonusMinor')::bigint;
    if bonus_amount not between 1 and 1000000000000 then raise exception 'Invalid saved plan bonus' using errcode='22023'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
    insert into public.system_balance_clearing(currency) values(currency_code) on conflict do nothing;
    perform 1 from public.system_balance_clearing where currency=currency_code for update;
    insert into public.system_balance_accounts(user_id,country,currency) values(receipt.user_id,receipt.country,currency_code) on conflict do nothing;
    select * into wallet from public.system_balance_accounts where user_id=receipt.user_id and country=receipt.country for update;
    if wallet.bonus_minor+bonus_amount>1000000000000 then raise exception 'Bonus balance limit exceeded' using errcode='22023'; end if;
    insert into public.system_balance_adjustments(user_id,country,currency,available_before,available_after,bonus_before,bonus_after,clearing_delta,reason,actor_id,request_id,expected_version)
      values(receipt.user_id,receipt.country,currency_code,wallet.available_minor,wallet.available_minor,wallet.bonus_minor,wallet.bonus_minor+bonus_amount,-bonus_amount,'Robot activation bonus: '||receipt.plan_id||' ('||p_id::text||')',p_actor,p_id,wallet.version);
    update public.system_balance_clearing set balance_minor=balance_minor-bonus_amount where currency=currency_code;
    update public.system_balance_accounts set bonus_minor=bonus_minor+bonus_amount,version=version+1,updated_at=now() where user_id=receipt.user_id and country=receipt.country;
  end if;
  update public.robot_activation_requests set status=p_status,review_note=trim(p_note),reviewed_by=p_actor,reviewed_at=now(),review_version=review_version+1,bonus_credited_minor=bonus_amount where id=p_id;
  insert into public.robot_payment_audit(actor_id,action,target_id) values(p_actor,case p_status when 'verified' then 'payment_approved_bonus_credited' else 'proof_'||p_status end,p_id::text);
  insert into public.system_admin_audit(actor_id,action,target_id,outcome) values(p_actor,'payments.'||case p_status when 'verified' then 'approved' else p_status end,p_id::text,'succeeded');
end $$;
revoke all on function public.review_robot_activation_request(uuid,text,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.review_robot_activation_request(uuid,text,text,uuid,integer) to service_role;
commit;
