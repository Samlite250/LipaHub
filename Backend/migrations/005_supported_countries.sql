begin;

alter table public.robot_payment_instructions drop constraint if exists robot_payment_instructions_country_check;

alter table public.robot_payment_instructions add constraint robot_payment_instructions_country_check check (country in ('Kenya','Uganda','Tanzania','Rwanda','Burundi','Malawi','Cameroon','Nigeria','Ghana','DR Congo','Mozambique','Botswana','South Sudan','Zambia','Zimbabwe','South Africa','International'));

alter table public.system_balance_accounts drop constraint if exists system_balance_accounts_country_check;

alter table public.system_balance_accounts add constraint system_balance_accounts_country_check check (country in ('Kenya','Uganda','Tanzania','Rwanda','Burundi','Malawi','Cameroon','Nigeria','Ghana','DR Congo','Mozambique','Botswana','South Sudan','Zambia','Zimbabwe','South Africa','International'));

alter table public.system_content drop constraint if exists system_content_country_check;

alter table public.system_content add constraint system_content_country_check check (country in ('All countries','Kenya','Uganda','Tanzania','Rwanda','Burundi','Malawi','Cameroon','Nigeria','Ghana','DR Congo','Mozambique','Botswana','South Sudan','Zambia','Zimbabwe','South Africa','International'));

create or replace function public.adjust_system_balance(p_actor uuid,p_user uuid,p_country text,p_available bigint,p_bonus bigint,p_reason text,p_version integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_wallet public.system_balance_accounts; previous_request public.system_balance_adjustments; currency_code text; counter_delta bigint;
begin
  if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'role'='admin' and (banned_until is null or banned_until < now())) then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_country is null or p_country not in ('Kenya','Uganda','Tanzania','Rwanda','Burundi','Malawi','Cameroon','Nigeria','Ghana','DR Congo','Mozambique','Botswana','South Sudan','Zambia','Zimbabwe','South Africa','International') or p_available is null or p_bonus is null or p_available not between 0 and 1000000000000 or p_bonus not between 0 and 1000000000000 or p_reason is null or char_length(trim(p_reason)) not between 10 and 500 or p_version is null or p_version<0 or p_request is null then raise exception 'Invalid adjustment' using errcode='22023'; end if;
  currency_code := case p_country when 'Rwanda' then 'RWF' when 'Burundi' then 'BIF' when 'Uganda' then 'UGX' when 'Kenya' then 'KES' when 'South Africa' then 'ZAR' else 'USD' end;
  -- Serialize retries of the same request before checking its prior receipt.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request::text,0));
  select * into previous_request from public.system_balance_adjustments where request_id=p_request;
  if found then
    if previous_request.actor_id<>p_actor or previous_request.user_id<>p_user or previous_request.country<>p_country or previous_request.available_after<>p_available or previous_request.bonus_after<>p_bonus or previous_request.reason<>trim(p_reason) or previous_request.expected_version<>p_version then raise exception 'Request ID reused' using errcode='23505'; end if;
    select * into current_wallet from public.system_balance_accounts where user_id=p_user and country=p_country;
    return to_jsonb(current_wallet);
  end if;
  perform 1 from auth.users where id=p_user for key share;
  if not found then raise exception 'User not found' using errcode='23503'; end if;
  insert into public.system_balance_clearing(currency) values(currency_code) on conflict do nothing;
  perform 1 from public.system_balance_clearing where currency=currency_code for update;
  insert into public.system_balance_accounts(user_id,country,currency) values(p_user,p_country,currency_code) on conflict do nothing;
  select * into current_wallet from public.system_balance_accounts where user_id=p_user and country=p_country for update;
  if current_wallet.version<>p_version then raise exception 'Balance changed' using errcode='40001'; end if;
  if current_wallet.available_minor=p_available and current_wallet.bonus_minor=p_bonus then raise exception 'No change' using errcode='22023'; end if;
  counter_delta := (current_wallet.available_minor-p_available)+(current_wallet.bonus_minor-p_bonus);
  insert into public.system_balance_adjustments(user_id,country,currency,available_before,available_after,bonus_before,bonus_after,clearing_delta,reason,actor_id,request_id,expected_version)
  values(p_user,p_country,currency_code,current_wallet.available_minor,p_available,current_wallet.bonus_minor,p_bonus,counter_delta,trim(p_reason),p_actor,p_request,p_version);
  update public.system_balance_clearing set balance_minor=balance_minor+counter_delta where currency=currency_code;
  update public.system_balance_accounts set available_minor=p_available,bonus_minor=p_bonus,version=version+1,updated_at=now() where user_id=p_user and country=p_country returning * into current_wallet;
  insert into public.system_admin_audit(actor_id,action,target_id,outcome) values(p_actor,'balances.adjust',p_user::text||':'||p_country,'succeeded');
  return to_jsonb(current_wallet);
end $$;

commit;
