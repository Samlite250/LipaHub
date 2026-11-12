-- New Rwanda registrations require a reviewed account-activation payment.
-- Existing users are grandfathered; editable profile metadata cannot clear this requirement.
begin;
create table public.rwanda_account_activations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  required_at timestamptz not null default now(),
  activated_at timestamptz,
  approved_request_id uuid references public.robot_activation_requests(id),
  check ((activated_at is null) = (approved_request_id is null))
);
alter table public.rwanda_account_activations enable row level security;
revoke all on public.rwanda_account_activations from public,anon,authenticated,service_role;
grant select on public.rwanda_account_activations to service_role;

create function public.mark_rwanda_activation_required()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if coalesce(new.raw_app_meta_data->>'role','')<>'admin' and lower(btrim(coalesce(new.raw_user_meta_data->>'country','Rwanda'))) in ('rwanda','rw') then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}'::jsonb)||'{"activation_required":true}'::jsonb;
  end if;
  return new;
end $$;
create function public.initialize_rwanda_activation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.raw_app_meta_data->>'activation_required'='true' then insert into public.rwanda_account_activations(user_id) values(new.id); end if;
  return new;
end $$;
revoke all on function public.mark_rwanda_activation_required(),public.initialize_rwanda_activation() from public,anon,authenticated;
create trigger lipahub_mark_rwanda_activation before insert on auth.users for each row execute function public.mark_rwanda_activation_required();
create trigger lipahub_initialize_rwanda_activation after insert on auth.users for each row execute function public.initialize_rwanda_activation();

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u where u.id=auth.uid() and (u.banned_until is null or u.banned_until<now())
    and (u.raw_app_meta_data->>'role'='admin' or not exists(select 1 from public.rwanda_account_activations a where a.user_id=u.id and a.activated_at is null)));
$$;

alter table public.robot_activation_requests add column purpose text not null default 'robot_activation' check (purpose in ('robot_activation','account_activation'));
alter table public.robot_activation_requests drop constraint robot_activation_requests_plan_id_check;
alter table public.robot_activation_requests drop constraint robot_activation_requests_country_check;
alter table public.robot_activation_requests add constraint robot_activation_request_purpose_check check (
  (purpose='robot_activation' and country<>'Rwanda' and plan_id ~ '^robot-(0[1-9]|[12][0-9]|3[0-3])$') or
  (purpose='account_activation' and country='Rwanda' and plan_id='account-activation')
);

create or replace function public.submit_robot_activation_request(p_actor uuid,p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare config public.robot_payment_instructions; selected_method jsonb; proof jsonb; new_id uuid; request_purpose text;
begin
  if not exists(select 1 from auth.users where id=p_actor and (banned_until is null or banned_until<now())) then raise insufficient_privilege; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid proof request' using errcode='22023'; end if;
  request_purpose := coalesce(p_payload->>'purpose','robot_activation');
  if request_purpose='account_activation' then
    if p_payload->>'country'<>'Rwanda' or p_payload->>'plan_id'<>'account-activation' or not exists(select 1 from public.rwanda_account_activations where user_id=p_actor and activated_at is null) then raise insufficient_privilege; end if;
  elsif request_purpose<>'robot_activation' or exists(select 1 from public.rwanda_account_activations where user_id=p_actor and activated_at is null) then raise insufficient_privilege;
  end if;
  select * into config from public.robot_payment_instructions where country=p_payload->>'country' for share;
  if config.country is null or config.version<>(p_payload->>'instruction_version')::integer then raise exception 'Instruction version conflict' using errcode='40001'; end if;
  select item into selected_method from jsonb_array_elements(config.methods) item where item->>'id'=p_payload->>'method_id' and item->>'enabled'='true';
  if selected_method is null then raise exception 'Payment option unavailable' using errcode='40001'; end if;
  if request_purpose='account_activation' and (selected_method->>'name' not in ('MTN','Airtel') or coalesce(selected_method->>'amountMinor','') !~ '^[1-9][0-9]{0,11}$' or p_payload->'quote'->>'currency' is distinct from 'RWF' or (p_payload->'quote'->>'valueMinor')::bigint is distinct from (selected_method->>'amountMinor')::bigint or (p_payload->'quote'->>'bonusMinor')::bigint is distinct from 0::bigint) then raise exception 'Invalid activation amount' using errcode='22023'; end if;
  if p_payload->'files' is null or jsonb_typeof(p_payload->'files')<>'array' or jsonb_array_length(p_payload->'files') not between 1 and 3 then raise check_violation; end if;
  new_id := (p_payload->>'id')::uuid;
  insert into public.robot_activation_requests(id,user_id,country,plan_id,purpose,full_name,phone,transaction_reference,instruction_version,payment_method,quote)
    values(new_id,p_actor,p_payload->>'country',p_payload->>'plan_id',request_purpose,p_payload->>'full_name',p_payload->>'phone',coalesce(p_payload->>'transaction_reference',''),config.version,selected_method,p_payload->'quote');
  for proof in select * from jsonb_array_elements(p_payload->'files') loop
    if proof->>'object_path' not like p_actor::text||'/'||new_id::text||'/%' then raise check_violation; end if;
    insert into public.robot_payment_proofs(id,request_id,object_path,original_name,mime_type,size_bytes)
      values((proof->>'id')::uuid,new_id,proof->>'object_path',proof->>'original_name',proof->>'mime_type',(proof->>'size_bytes')::integer);
  end loop;
  insert into public.robot_payment_audit(actor_id,action,target_id) values(p_actor,'proof_submitted',new_id::text);
end $$;

create or replace function public.review_robot_activation_request(p_id uuid,p_status text,p_note text,p_actor uuid,p_expected_version integer)
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
    if receipt.purpose='account_activation' then
      if receipt.quote->>'currency' is distinct from 'RWF' or coalesce(receipt.quote->>'valueMinor','') !~ '^[1-9][0-9]{0,11}$' or (receipt.quote->>'bonusMinor')::bigint is distinct from 0::bigint then raise exception 'Invalid account activation quote' using errcode='22023'; end if;
      perform 1 from public.rwanda_account_activations where user_id=receipt.user_id and activated_at is null for update;
      if not found then raise exception 'Account already activated or not eligible' using errcode='40001'; end if;
      update public.rwanda_account_activations set activated_at=now(),approved_request_id=p_id where user_id=receipt.user_id;
      update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||'{"activation_required":false}'::jsonb where id=receipt.user_id;
    else
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
  end if;
  update public.robot_activation_requests set status=p_status,review_note=trim(p_note),reviewed_by=p_actor,reviewed_at=now(),review_version=review_version+1,bonus_credited_minor=bonus_amount where id=p_id;
  insert into public.robot_payment_audit(actor_id,action,target_id) values(p_actor,case p_status when 'verified' then case receipt.purpose when 'account_activation' then 'account_activation_approved' else 'payment_approved_bonus_credited' end else 'proof_'||p_status end,p_id::text);
  insert into public.system_admin_audit(actor_id,action,target_id,outcome) values(p_actor,'payments.'||case p_status when 'verified' then 'approved' else p_status end,p_id::text,'succeeded');
end $$;

commit;
