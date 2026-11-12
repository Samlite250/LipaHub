-- LipaHub: NEW EMPTY PROJECT ONLY. Run once in the intended Supabase SQL editor.
-- Existing installations must apply only missing individual migrations.

-- Migration: 001_robot_payment_proofs.sql
-- Run in the intended Supabase project before enabling proof intake.
-- No wallet credits, payment verification, or robot activation is performed here.
begin;

create table if not exists public.robot_payment_instructions (
  country text primary key check (country in ('Rwanda','Burundi','Uganda','Kenya','South Africa','International')),
  version integer not null check (version > 0),
  methods jsonb not null check (jsonb_typeof(methods) = 'array'),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id)
);
create table if not exists public.robot_activation_requests (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  country text not null references public.robot_payment_instructions(country),
  plan_id text not null check (plan_id ~ '^robot-(0[1-9]|[12][0-9]|3[0-3])$'),
  status text not null default 'pending_review' check (status in ('pending_review','under_review','rejected','verified')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  transaction_reference text not null default '' check (char_length(transaction_reference) <= 100),
  instruction_version integer not null,
  payment_method jsonb not null,
  quote jsonb not null,
  submitted_at timestamptz not null default now(),
  review_note text not null default '' check (char_length(review_note) <= 1000),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  check (country <> 'Rwanda')
);
create unique index if not exists one_open_robot_activation_request
  on public.robot_activation_requests(user_id, country, plan_id)
  where status in ('pending_review','under_review','verified');
create index if not exists robot_requests_owner_date on public.robot_activation_requests(user_id, submitted_at desc);
create table if not exists public.robot_payment_proofs (
  id uuid primary key,
  request_id uuid not null references public.robot_activation_requests(id) on delete cascade,
  object_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 180),
  mime_type text not null check (mime_type in ('image/png','image/jpeg')),
  size_bytes integer not null check (size_bytes between 1 and 5242880)
);
create table if not exists public.robot_payment_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null,
  target_id text not null,
  created_at timestamptz not null default now()
);
alter table public.robot_payment_instructions enable row level security;
alter table public.robot_activation_requests enable row level security;
alter table public.robot_payment_proofs enable row level security;
alter table public.robot_payment_audit enable row level security;

revoke all on public.robot_payment_instructions, public.robot_activation_requests, public.robot_payment_proofs, public.robot_payment_audit from anon, authenticated;
grant select on public.robot_payment_instructions, public.robot_activation_requests, public.robot_payment_proofs, public.robot_payment_audit to authenticated;
grant all on public.robot_payment_instructions, public.robot_activation_requests, public.robot_payment_proofs, public.robot_payment_audit to service_role;
grant usage, select on sequence public.robot_payment_audit_id_seq to service_role;

create policy instructions_authenticated_read on public.robot_payment_instructions for select to authenticated using (true);
create policy requests_owner_or_admin_read on public.robot_activation_requests for select to authenticated
  using (user_id = auth.uid() or (auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy proofs_owner_or_admin_read on public.robot_payment_proofs for select to authenticated
  using (exists(select 1 from public.robot_activation_requests r where r.id = request_id and (r.user_id = auth.uid() or (auth.jwt()->'app_metadata'->>'role') = 'admin')));
create policy payment_audit_admin_read on public.robot_payment_audit for select to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('robot-payment-proofs','robot-payment-proofs',false,5242880,array['image/png','image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/png','image/jpeg'];
create policy robot_proof_storage_private_read on storage.objects for select to authenticated using (
  bucket_id = 'robot-payment-proofs' and exists (
    select 1 from public.robot_payment_proofs p join public.robot_activation_requests r on r.id = p.request_id
    where p.object_path = name and (r.user_id = auth.uid() or (auth.jwt()->'app_metadata'->>'role') = 'admin')
  )
);
-- Restrictive guards also constrain any broader storage policies already present.
create policy robot_proof_storage_read_guard on storage.objects as restrictive for select to authenticated using (
  bucket_id <> 'robot-payment-proofs' or exists (
    select 1 from public.robot_payment_proofs p join public.robot_activation_requests r on r.id = p.request_id
    where p.object_path = name and (r.user_id = auth.uid() or (auth.jwt()->'app_metadata'->>'role') = 'admin')
  )
);
create policy robot_proof_storage_anon_guard on storage.objects as restrictive for select to anon using (bucket_id <> 'robot-payment-proofs');
create policy robot_proof_storage_insert_guard on storage.objects as restrictive for insert to anon, authenticated with check (bucket_id <> 'robot-payment-proofs');
create policy robot_proof_storage_update_guard on storage.objects as restrictive for update to anon, authenticated using (bucket_id <> 'robot-payment-proofs') with check (bucket_id <> 'robot-payment-proofs');
create policy robot_proof_storage_delete_guard on storage.objects as restrictive for delete to anon, authenticated using (bucket_id <> 'robot-payment-proofs');

create or replace function public.save_robot_payment_instructions(p_country text, p_methods jsonb, p_expected_version integer, p_actor uuid)
returns setof public.robot_payment_instructions language plpgsql security definer set search_path = public, pg_temp as $$
declare current_version integer;
begin
  if not exists(select 1 from auth.users where id = p_actor and raw_app_meta_data->>'role' = 'admin') then raise insufficient_privilege; end if;
  -- Serialize first creation as well as updates for a country's instruction revision.
  perform pg_advisory_xact_lock(hashtextextended('robot-payment-' || p_country, 0));
  select version into current_version from public.robot_payment_instructions where country = p_country for update;
  if coalesce(current_version,0) <> p_expected_version then raise exception 'Instruction version conflict' using errcode = '40001'; end if;
  insert into public.robot_payment_instructions(country,version,methods,updated_by) values(p_country,p_expected_version+1,p_methods,p_actor)
    on conflict(country) do update set version = excluded.version, methods = excluded.methods, updated_by = excluded.updated_by, updated_at = now();
  insert into public.robot_payment_audit(actor_id,action,target_id) values(p_actor,'instructions_saved',p_country);
  return query select * from public.robot_payment_instructions where country = p_country;
end $$;

create or replace function public.submit_robot_activation_request(p_actor uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare config public.robot_payment_instructions; selected_method jsonb; proof jsonb; new_id uuid;
begin
  select * into config from public.robot_payment_instructions where country = p_payload->>'country' for share;
  if config.country is null or config.version <> (p_payload->>'instruction_version')::integer then raise exception 'Instruction version conflict' using errcode = '40001'; end if;
  select item into selected_method from jsonb_array_elements(config.methods) item where item->>'id' = p_payload->>'method_id' and item->>'enabled' = 'true';
  if selected_method is null then raise exception 'Payment option unavailable' using errcode = '40001'; end if;
  if jsonb_typeof(p_payload->'files') <> 'array' or jsonb_array_length(p_payload->'files') not between 1 and 3 then raise check_violation; end if;
  new_id := (p_payload->>'id')::uuid;
  insert into public.robot_activation_requests(id,user_id,country,plan_id,full_name,phone,transaction_reference,instruction_version,payment_method,quote)
    values(new_id,p_actor,p_payload->>'country',p_payload->>'plan_id',p_payload->>'full_name',p_payload->>'phone',coalesce(p_payload->>'transaction_reference',''),config.version,selected_method,p_payload->'quote');
  for proof in select * from jsonb_array_elements(p_payload->'files') loop
    if proof->>'object_path' not like p_actor::text || '/' || new_id::text || '/%' then raise check_violation; end if;
    insert into public.robot_payment_proofs(id,request_id,object_path,original_name,mime_type,size_bytes)
      values((proof->>'id')::uuid,new_id,proof->>'object_path',proof->>'original_name',proof->>'mime_type',(proof->>'size_bytes')::integer);
  end loop;
  insert into public.robot_payment_audit(actor_id,action,target_id) values(p_actor,'proof_submitted',new_id::text);
end $$;

create or replace function public.review_robot_activation_request(p_id uuid,p_status text,p_note text,p_actor uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists(select 1 from auth.users where id = p_actor and raw_app_meta_data->>'role' = 'admin') then raise insufficient_privilege; end if;
  if p_status not in ('under_review','rejected') or (p_status = 'rejected' and char_length(trim(p_note)) < 3) then raise check_violation; end if;
  update public.robot_activation_requests set status = p_status, review_note = p_note, reviewed_by = p_actor, reviewed_at = now()
    where id = p_id and status in ('pending_review','under_review');
  if not found then raise exception 'Request is no longer reviewable' using errcode = '40001'; end if;
  insert into public.robot_payment_audit(actor_id,action,target_id) values(p_actor,'proof_' || p_status,p_id::text);
end $$;

revoke all on function public.save_robot_payment_instructions(text,jsonb,integer,uuid) from public, anon, authenticated;
revoke all on function public.submit_robot_activation_request(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.review_robot_activation_request(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.save_robot_payment_instructions(text,jsonb,integer,uuid) to service_role;
grant execute on function public.submit_robot_activation_request(uuid,jsonb) to service_role;
grant execute on function public.review_robot_activation_request(uuid,text,text,uuid) to service_role;
commit;


-- Migration: 002_system_administration.sql
begin;

create table if not exists public.system_content (
  id uuid primary key default gen_random_uuid(),
  collection text not null check (collection in ('resources','announcements')),
  title text not null check (char_length(title) between 2 and 160),
  description text not null check (char_length(description) between 2 and 8000),
  category text not null check (category in ('courses','articles','ebooks','announcement')),
  status text not null check (status in ('draft','published')),
  url text not null default '' check (url = '' or url ~ '^https://'),
  country text not null default 'All countries' check (country in ('All countries','Rwanda','Burundi','Uganda','Kenya','South Africa','International')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((collection = 'announcements' and category = 'announcement') or (collection = 'resources' and category <> 'announcement'))
);
create index if not exists system_content_publication on public.system_content(collection,status,updated_at desc);
create table if not exists public.system_settings (
  id text primary key check (id = 'general'),
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.system_settings(id,value) values ('general','{"siteName":"LipaHub","supportEmail":"","supportMessage":"","showAnnouncements":true}') on conflict do nothing;
create table if not exists public.system_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  action text not null,
  target_id text not null,
  outcome text not null check (outcome in ('started','succeeded','failed')),
  created_at timestamptz not null default now()
);
alter table public.system_content enable row level security;
alter table public.system_settings enable row level security;
alter table public.system_admin_audit enable row level security;
revoke all on public.system_content,public.system_settings,public.system_admin_audit from anon,authenticated;
grant all on public.system_content,public.system_settings,public.system_admin_audit to service_role;
grant usage,select on sequence public.system_admin_audit_id_seq to service_role;

create or replace function public.manage_system_content(p_actor uuid,p_action text,p_id uuid,p_collection text,p_version integer,p_value jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item public.system_content;
begin
  if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'role'='admin' and (banned_until is null or banned_until < now())) then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_collection not in ('resources','announcements') or p_action not in ('create','update','delete') then raise exception 'Invalid content action'; end if;
  if p_action='create' then
    insert into public.system_content(collection,title,description,category,status,url,country)
    values(p_collection,p_value->>'title',p_value->>'description',p_value->>'category',p_value->>'status',coalesce(p_value->>'url',''),p_value->>'country') returning * into item;
  else
    select * into item from public.system_content where id=p_id and collection=p_collection for update;
    if not found or item.version<>p_version then raise exception 'Record changed' using errcode='40001'; end if;
    if p_action='delete' then delete from public.system_content where id=p_id;
    else
      update public.system_content set title=p_value->>'title',description=p_value->>'description',category=p_value->>'category',status=p_value->>'status',url=coalesce(p_value->>'url',''),country=p_value->>'country',version=version+1,updated_at=now()
      where id=p_id returning * into item;
    end if;
  end if;
  insert into public.system_admin_audit(actor_id,action,target_id,outcome) values(p_actor,p_collection||'.'||p_action,item.id::text,'succeeded');
  return to_jsonb(item);
end $$;

create or replace function public.save_system_settings(p_actor uuid,p_version integer,p_value jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item public.system_settings;
begin
  if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'role'='admin' and (banned_until is null or banned_until < now())) then raise exception 'Administrator required' using errcode='42501'; end if;
  update public.system_settings set value=p_value,version=version+1,updated_at=now() where id='general' and version=p_version returning * into item;
  if not found then raise exception 'Settings changed' using errcode='40001'; end if;
  insert into public.system_admin_audit(actor_id,action,target_id,outcome) values(p_actor,'settings.update','general','succeeded');
  return to_jsonb(item);
end $$;
revoke all on function public.manage_system_content(uuid,text,uuid,text,integer,jsonb) from public,anon,authenticated;
revoke all on function public.save_system_settings(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.manage_system_content(uuid,text,uuid,text,integer,jsonb) to service_role;
grant execute on function public.save_system_settings(uuid,integer,jsonb) to service_role;
commit;


-- Migration: 003_account_balances.sql
begin;
create table if not exists public.system_balance_accounts (
  user_id uuid not null references auth.users(id),
  country text not null check (country in ('Rwanda','Burundi','Uganda','Kenya','South Africa','International')),
  currency text not null check (currency in ('RWF','BIF','UGX','KES','ZAR','USD')),
  available_minor bigint not null default 0 check (available_minor between 0 and 1000000000000),
  bonus_minor bigint not null default 0 check (bonus_minor between 0 and 1000000000000),
  version integer not null default 0 check (version >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id,country),
  check (currency = case country when 'Rwanda' then 'RWF' when 'Burundi' then 'BIF' when 'Uganda' then 'UGX' when 'Kenya' then 'KES' when 'South Africa' then 'ZAR' else 'USD' end)
);
create table if not exists public.system_balance_clearing (
  currency text primary key check (currency in ('RWF','BIF','UGX','KES','ZAR','USD')),
  balance_minor bigint not null default 0
);
create table if not exists public.system_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  country text not null,
  currency text not null,
  available_before bigint not null,
  available_after bigint not null,
  bonus_before bigint not null,
  bonus_after bigint not null,
  clearing_delta bigint not null,
  reason text not null check (char_length(reason) between 10 and 500),
  actor_id uuid not null,
  request_id uuid not null unique,
  expected_version integer not null,
  created_at timestamptz not null default now(),
  foreign key(user_id,country) references public.system_balance_accounts(user_id,country),
  check ((available_after-available_before)+(bonus_after-bonus_before)+clearing_delta=0)
);
create index if not exists system_balance_history on public.system_balance_adjustments(user_id,country,created_at desc);
alter table public.system_balance_accounts enable row level security;
alter table public.system_balance_clearing enable row level security;
alter table public.system_balance_adjustments enable row level security;
revoke all on public.system_balance_accounts,public.system_balance_clearing,public.system_balance_adjustments from public,anon,authenticated,service_role;
grant select on public.system_balance_accounts,public.system_balance_adjustments to service_role;

create or replace function public.adjust_system_balance(p_actor uuid,p_user uuid,p_country text,p_available bigint,p_bonus bigint,p_reason text,p_version integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_wallet public.system_balance_accounts; previous_request public.system_balance_adjustments; currency_code text; counter_delta bigint;
begin
  if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'role'='admin' and (banned_until is null or banned_until < now())) then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_country is null or p_country not in ('Rwanda','Burundi','Uganda','Kenya','South Africa','International') or p_available is null or p_bonus is null or p_available not between 0 and 1000000000000 or p_bonus not between 0 and 1000000000000 or p_reason is null or char_length(trim(p_reason)) not between 10 and 500 or p_version is null or p_version<0 or p_request is null then raise exception 'Invalid adjustment' using errcode='22023'; end if;
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
revoke all on function public.adjust_system_balance(uuid,uuid,text,bigint,bigint,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.adjust_system_balance(uuid,uuid,text,bigint,bigint,text,integer,uuid) to service_role;
commit;


-- Migration: 004_member_support.sql
-- Apply after 001, 002 and 003. All writes use server-only transactional RPCs.
begin;
create table public.support_tickets (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  subject text not null check (char_length(subject) between 3 and 160),
  status text not null default 'open' check (status in ('open','closed')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.support_messages (
  id uuid primary key,
  ticket_id uuid not null references public.support_tickets(id),
  author_id uuid not null references auth.users(id),
  author_role text not null check (author_role in ('member','admin')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index support_owner_date on public.support_tickets(user_id,updated_at desc);
create index support_queue_date on public.support_tickets(updated_at desc);
create index support_message_date on public.support_messages(ticket_id,created_at);
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets,public.support_messages from public,anon,authenticated,service_role;
grant select on public.support_tickets,public.support_messages to service_role;

create function public.create_support_ticket(p_actor uuid,p_id uuid,p_subject text,p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.support_tickets; actor_role text;
begin
  select case when raw_app_meta_data->>'role'='admin' then 'admin' else 'member' end into actor_role from auth.users where id=p_actor and (banned_until is null or banned_until<now());
  if actor_role is null then raise insufficient_privilege; end if;
  if p_id is null or p_subject is null or char_length(trim(p_subject)) not between 3 and 160 or p_body is null or char_length(trim(p_body)) not between 10 and 4000 then raise exception 'Invalid ticket' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
  select * into existing from public.support_tickets where id=p_id;
  if found then
    if existing.user_id<>p_actor or existing.subject<>trim(p_subject) or not exists(select 1 from public.support_messages where id=p_id and ticket_id=p_id and author_id=p_actor and body=trim(p_body)) then raise unique_violation; end if;
    return to_jsonb(existing);
  end if;
  insert into public.support_tickets(id,user_id,subject) values(p_id,p_actor,trim(p_subject)) returning * into existing;
  insert into public.support_messages(id,ticket_id,author_id,author_role,body) values(p_id,p_id,p_actor,actor_role,trim(p_body));
  return to_jsonb(existing);
end $$;

create function public.reply_support_ticket(p_actor uuid,p_ticket uuid,p_id uuid,p_body text,p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ticket public.support_tickets; previous public.support_messages; actor_role text;
begin
  select case when raw_app_meta_data->>'role'='admin' then 'admin' else 'member' end into actor_role from auth.users where id=p_actor and (banned_until is null or banned_until<now());
  if actor_role is null then raise insufficient_privilege; end if;
  if p_id is null or p_body is null or char_length(trim(p_body)) not between 1 and 4000 or p_version is null or p_version<1 then raise exception 'Invalid reply' using errcode='22023'; end if;
  -- Lock the message ID before the ticket so concurrent retries cannot duplicate a reply.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
  select * into ticket from public.support_tickets where id=p_ticket for update;
  if not found then raise no_data_found; end if;
  if ticket.user_id<>p_actor and actor_role<>'admin' then raise insufficient_privilege; end if;
  select * into previous from public.support_messages where id=p_id;
  if found then
    if previous.ticket_id<>p_ticket or previous.author_id<>p_actor or previous.body<>trim(p_body) then raise unique_violation; end if;
    return to_jsonb(ticket);
  end if;
  if ticket.version<>p_version then raise exception 'Ticket changed' using errcode='40001'; end if;
  if ticket.status='closed' then raise exception 'Ticket closed' using errcode='22023'; end if;
  insert into public.support_messages(id,ticket_id,author_id,author_role,body) values(p_id,p_ticket,p_actor,actor_role,trim(p_body));
  update public.support_tickets set version=version+1,updated_at=now() where id=p_ticket returning * into ticket;
  if actor_role='admin' then insert into public.system_admin_audit(actor_id,action,target_id,outcome) values(p_actor,'support.reply',p_ticket::text,'succeeded'); end if;
  return to_jsonb(ticket);
end $$;

create function public.set_support_ticket_status(p_actor uuid,p_ticket uuid,p_status text,p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ticket public.support_tickets;
begin
  if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'role'='admin' and (banned_until is null or banned_until<now())) then raise insufficient_privilege; end if;
  if p_status is null or p_status not in ('open','closed') or p_version is null or p_version<1 then raise exception 'Invalid status' using errcode='22023'; end if;
  select * into ticket from public.support_tickets where id=p_ticket for update;
  if not found then raise no_data_found; end if;
  if ticket.version<>p_version then raise exception 'Ticket changed' using errcode='40001'; end if;
  update public.support_tickets set status=p_status,version=version+1,updated_at=now() where id=p_ticket returning * into ticket;
  insert into public.system_admin_audit(actor_id,action,target_id,outcome) values(p_actor,'support.'||p_status,p_ticket::text,'succeeded');
  return to_jsonb(ticket);
end $$;
revoke all on function public.create_support_ticket(uuid,uuid,text,text),public.reply_support_ticket(uuid,uuid,uuid,text,integer),public.set_support_ticket_status(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.create_support_ticket(uuid,uuid,text,text),public.reply_support_ticket(uuid,uuid,uuid,text,integer),public.set_support_ticket_status(uuid,uuid,text,integer) to service_role;
commit;


-- Migration: 005_supported_countries.sql
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


-- Migration: 006_worldwide_countries.sql
begin;

alter table public.robot_payment_instructions drop constraint if exists robot_payment_instructions_country_check;

alter table public.robot_payment_instructions add constraint robot_payment_instructions_country_check check (country in ('Afghanistan','Åland Islands','Albania','Algeria','American Samoa','Andorra','Angola','Anguilla','Antarctica','Antigua & Barbuda','Argentina','Armenia','Aruba','Ascension Island','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bermuda','Bhutan','Bolivia','Bosnia & Herzegovina','Botswana','Bouvet Island','Brazil','British Indian Ocean Territory','British Virgin Islands','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde','Caribbean Netherlands','Cayman Islands','Central African Republic','Chad','Chile','China','Christmas Island','Cocos (Keeling) Islands','Colombia','Comoros','Congo - Brazzaville','Cook Islands','Costa Rica','Côte d’Ivoire','Croatia','Cuba','Curaçao','Cyprus','Czechia','Denmark','Djibouti','Dominica','Dominican Republic','DR Congo','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Falkland Islands','Faroe Islands','Fiji','Finland','France','French Guiana','French Polynesia','French Southern Territories','Gabon','Gambia','Georgia','Germany','Ghana','Gibraltar','Greece','Greenland','Grenada','Guadeloupe','Guam','Guatemala','Guernsey','Guinea','Guinea-Bissau','Guyana','Haiti','Heard & McDonald Islands','Honduras','Hong Kong SAR China','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Isle of Man','Israel','Italy','Jamaica','Japan','Jersey','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Macao SAR China','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Martinique','Mauritania','Mauritius','Mayotte','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Montserrat','Morocco','Mozambique','Myanmar (Burma)','Namibia','Nauru','Nepal','Netherlands','New Caledonia','New Zealand','Nicaragua','Niger','Nigeria','Niue','Norfolk Island','North Korea','North Macedonia','Northern Mariana Islands','Norway','Oman','Pakistan','Palau','Palestinian Territories','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Pitcairn Islands','Poland','Portugal','Puerto Rico','Qatar','Réunion','Romania','Russia','Rwanda','Samoa','San Marino','São Tomé & Príncipe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Sint Maarten','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Georgia & South Sandwich Islands','South Korea','South Sudan','Spain','Sri Lanka','St. Barthélemy','St. Helena','St. Kitts & Nevis','St. Lucia','St. Martin','St. Pierre & Miquelon','St. Vincent & Grenadines','Sudan','Suriname','Svalbard & Jan Mayen','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tokelau','Tonga','Trinidad & Tobago','Tunisia','Türkiye','Turkmenistan','Turks & Caicos Islands','Tuvalu','U.S. Outlying Islands','U.S. Virgin Islands','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Wallis & Futuna','Western Sahara','Yemen','Zambia','Zimbabwe','International'));

alter table public.system_content drop constraint if exists system_content_country_check;

alter table public.system_content add constraint system_content_country_check check (country in ('All countries','Afghanistan','Åland Islands','Albania','Algeria','American Samoa','Andorra','Angola','Anguilla','Antarctica','Antigua & Barbuda','Argentina','Armenia','Aruba','Ascension Island','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bermuda','Bhutan','Bolivia','Bosnia & Herzegovina','Botswana','Bouvet Island','Brazil','British Indian Ocean Territory','British Virgin Islands','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde','Caribbean Netherlands','Cayman Islands','Central African Republic','Chad','Chile','China','Christmas Island','Cocos (Keeling) Islands','Colombia','Comoros','Congo - Brazzaville','Cook Islands','Costa Rica','Côte d’Ivoire','Croatia','Cuba','Curaçao','Cyprus','Czechia','Denmark','Djibouti','Dominica','Dominican Republic','DR Congo','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Falkland Islands','Faroe Islands','Fiji','Finland','France','French Guiana','French Polynesia','French Southern Territories','Gabon','Gambia','Georgia','Germany','Ghana','Gibraltar','Greece','Greenland','Grenada','Guadeloupe','Guam','Guatemala','Guernsey','Guinea','Guinea-Bissau','Guyana','Haiti','Heard & McDonald Islands','Honduras','Hong Kong SAR China','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Isle of Man','Israel','Italy','Jamaica','Japan','Jersey','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Macao SAR China','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Martinique','Mauritania','Mauritius','Mayotte','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Montserrat','Morocco','Mozambique','Myanmar (Burma)','Namibia','Nauru','Nepal','Netherlands','New Caledonia','New Zealand','Nicaragua','Niger','Nigeria','Niue','Norfolk Island','North Korea','North Macedonia','Northern Mariana Islands','Norway','Oman','Pakistan','Palau','Palestinian Territories','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Pitcairn Islands','Poland','Portugal','Puerto Rico','Qatar','Réunion','Romania','Russia','Rwanda','Samoa','San Marino','São Tomé & Príncipe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Sint Maarten','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Georgia & South Sandwich Islands','South Korea','South Sudan','Spain','Sri Lanka','St. Barthélemy','St. Helena','St. Kitts & Nevis','St. Lucia','St. Martin','St. Pierre & Miquelon','St. Vincent & Grenadines','Sudan','Suriname','Svalbard & Jan Mayen','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tokelau','Tonga','Trinidad & Tobago','Tunisia','Türkiye','Turkmenistan','Turks & Caicos Islands','Tuvalu','U.S. Outlying Islands','U.S. Virgin Islands','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Wallis & Futuna','Western Sahara','Yemen','Zambia','Zimbabwe','International'));

alter table public.system_balance_accounts drop constraint if exists system_balance_accounts_country_check;

alter table public.system_balance_accounts add constraint system_balance_accounts_country_check check (country in ('Afghanistan','Åland Islands','Albania','Algeria','American Samoa','Andorra','Angola','Anguilla','Antarctica','Antigua & Barbuda','Argentina','Armenia','Aruba','Ascension Island','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bermuda','Bhutan','Bolivia','Bosnia & Herzegovina','Botswana','Bouvet Island','Brazil','British Indian Ocean Territory','British Virgin Islands','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde','Caribbean Netherlands','Cayman Islands','Central African Republic','Chad','Chile','China','Christmas Island','Cocos (Keeling) Islands','Colombia','Comoros','Congo - Brazzaville','Cook Islands','Costa Rica','Côte d’Ivoire','Croatia','Cuba','Curaçao','Cyprus','Czechia','Denmark','Djibouti','Dominica','Dominican Republic','DR Congo','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Falkland Islands','Faroe Islands','Fiji','Finland','France','French Guiana','French Polynesia','French Southern Territories','Gabon','Gambia','Georgia','Germany','Ghana','Gibraltar','Greece','Greenland','Grenada','Guadeloupe','Guam','Guatemala','Guernsey','Guinea','Guinea-Bissau','Guyana','Haiti','Heard & McDonald Islands','Honduras','Hong Kong SAR China','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Isle of Man','Israel','Italy','Jamaica','Japan','Jersey','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Macao SAR China','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Martinique','Mauritania','Mauritius','Mayotte','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Montserrat','Morocco','Mozambique','Myanmar (Burma)','Namibia','Nauru','Nepal','Netherlands','New Caledonia','New Zealand','Nicaragua','Niger','Nigeria','Niue','Norfolk Island','North Korea','North Macedonia','Northern Mariana Islands','Norway','Oman','Pakistan','Palau','Palestinian Territories','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Pitcairn Islands','Poland','Portugal','Puerto Rico','Qatar','Réunion','Romania','Russia','Rwanda','Samoa','San Marino','São Tomé & Príncipe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Sint Maarten','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Georgia & South Sandwich Islands','South Korea','South Sudan','Spain','Sri Lanka','St. Barthélemy','St. Helena','St. Kitts & Nevis','St. Lucia','St. Martin','St. Pierre & Miquelon','St. Vincent & Grenadines','Sudan','Suriname','Svalbard & Jan Mayen','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tokelau','Tonga','Trinidad & Tobago','Tunisia','Türkiye','Turkmenistan','Turks & Caicos Islands','Tuvalu','U.S. Outlying Islands','U.S. Virgin Islands','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Wallis & Futuna','Western Sahara','Yemen','Zambia','Zimbabwe','International'));

create or replace function public.adjust_system_balance(p_actor uuid,p_user uuid,p_country text,p_available bigint,p_bonus bigint,p_reason text,p_version integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_wallet public.system_balance_accounts; previous_request public.system_balance_adjustments; currency_code text; counter_delta bigint;
begin
  if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'role'='admin' and (banned_until is null or banned_until < now())) then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_country is null or p_country not in ('Afghanistan','Åland Islands','Albania','Algeria','American Samoa','Andorra','Angola','Anguilla','Antarctica','Antigua & Barbuda','Argentina','Armenia','Aruba','Ascension Island','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bermuda','Bhutan','Bolivia','Bosnia & Herzegovina','Botswana','Bouvet Island','Brazil','British Indian Ocean Territory','British Virgin Islands','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde','Caribbean Netherlands','Cayman Islands','Central African Republic','Chad','Chile','China','Christmas Island','Cocos (Keeling) Islands','Colombia','Comoros','Congo - Brazzaville','Cook Islands','Costa Rica','Côte d’Ivoire','Croatia','Cuba','Curaçao','Cyprus','Czechia','Denmark','Djibouti','Dominica','Dominican Republic','DR Congo','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Falkland Islands','Faroe Islands','Fiji','Finland','France','French Guiana','French Polynesia','French Southern Territories','Gabon','Gambia','Georgia','Germany','Ghana','Gibraltar','Greece','Greenland','Grenada','Guadeloupe','Guam','Guatemala','Guernsey','Guinea','Guinea-Bissau','Guyana','Haiti','Heard & McDonald Islands','Honduras','Hong Kong SAR China','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Isle of Man','Israel','Italy','Jamaica','Japan','Jersey','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Macao SAR China','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Martinique','Mauritania','Mauritius','Mayotte','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Montserrat','Morocco','Mozambique','Myanmar (Burma)','Namibia','Nauru','Nepal','Netherlands','New Caledonia','New Zealand','Nicaragua','Niger','Nigeria','Niue','Norfolk Island','North Korea','North Macedonia','Northern Mariana Islands','Norway','Oman','Pakistan','Palau','Palestinian Territories','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Pitcairn Islands','Poland','Portugal','Puerto Rico','Qatar','Réunion','Romania','Russia','Rwanda','Samoa','San Marino','São Tomé & Príncipe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Sint Maarten','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Georgia & South Sandwich Islands','South Korea','South Sudan','Spain','Sri Lanka','St. Barthélemy','St. Helena','St. Kitts & Nevis','St. Lucia','St. Martin','St. Pierre & Miquelon','St. Vincent & Grenadines','Sudan','Suriname','Svalbard & Jan Mayen','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tokelau','Tonga','Trinidad & Tobago','Tunisia','Türkiye','Turkmenistan','Turks & Caicos Islands','Tuvalu','U.S. Outlying Islands','U.S. Virgin Islands','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Wallis & Futuna','Western Sahara','Yemen','Zambia','Zimbabwe','International') or p_available is null or p_bonus is null or p_available not between 0 and 1000000000000 or p_bonus not between 0 and 1000000000000 or p_reason is null or char_length(trim(p_reason)) not between 10 and 500 or p_version is null or p_version<0 or p_request is null then raise exception 'Invalid adjustment' using errcode='22023'; end if;
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


-- Migration: 007_fresh_payment_authorization.sql
-- Apply after 006. Browser-readable proof data must use current account status,
-- not a possibly stale administrator role captured in a previously issued JWT.
begin;
create function public.is_active_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id=auth.uid() and (banned_until is null or banned_until<now()))
$$;
create function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id=auth.uid() and raw_app_meta_data->>'role'='admin' and (banned_until is null or banned_until<now()))
$$;
revoke all on function public.is_active_member(),public.is_platform_admin() from public,anon,authenticated;
grant execute on function public.is_active_member(),public.is_platform_admin() to authenticated,service_role;

drop policy instructions_authenticated_read on public.robot_payment_instructions;
create policy instructions_authenticated_read on public.robot_payment_instructions for select to authenticated
  using (public.is_active_member());
drop policy requests_owner_or_admin_read on public.robot_activation_requests;
create policy requests_owner_or_admin_read on public.robot_activation_requests for select to authenticated
  using (public.is_active_member() and (user_id=auth.uid() or public.is_platform_admin()));
drop policy proofs_owner_or_admin_read on public.robot_payment_proofs;
create policy proofs_owner_or_admin_read on public.robot_payment_proofs for select to authenticated
  using (public.is_active_member() and exists(select 1 from public.robot_activation_requests r where r.id=request_id and (r.user_id=auth.uid() or public.is_platform_admin())));
drop policy payment_audit_admin_read on public.robot_payment_audit;
create policy payment_audit_admin_read on public.robot_payment_audit for select to authenticated
  using (public.is_platform_admin());
drop policy robot_proof_storage_private_read on storage.objects;
create policy robot_proof_storage_private_read on storage.objects for select to authenticated using (
  bucket_id='robot-payment-proofs' and public.is_active_member() and exists(
    select 1 from public.robot_payment_proofs p join public.robot_activation_requests r on r.id=p.request_id
    where p.object_path=name and (r.user_id=auth.uid() or public.is_platform_admin())
  )
);
drop policy robot_proof_storage_read_guard on storage.objects;
create policy robot_proof_storage_read_guard on storage.objects as restrictive for select to authenticated using (
  bucket_id<>'robot-payment-proofs' or (public.is_active_member() and exists(
    select 1 from public.robot_payment_proofs p join public.robot_activation_requests r on r.id=p.request_id
    where p.object_path=name and (r.user_id=auth.uid() or public.is_platform_admin())
  ))
);

create or replace function public.save_robot_payment_instructions(p_country text, p_methods jsonb, p_expected_version integer, p_actor uuid)
returns setof public.robot_payment_instructions language plpgsql security definer set search_path = '' as $$
declare current_version integer;
begin
  if not exists(select 1 from auth.users where id = p_actor and raw_app_meta_data->>'role' = 'admin' and (banned_until is null or banned_until < now())) then raise insufficient_privilege; end if;
  if p_country is null or p_methods is null or jsonb_typeof(p_methods) <> 'array' or p_expected_version is null or p_expected_version < 0 then raise exception 'Invalid instructions' using errcode = '22023'; end if;
  -- Serialize first creation as well as updates for a country's instruction revision.
  perform pg_advisory_xact_lock(hashtextextended('robot-payment-' || p_country, 0));
  select version into current_version from public.robot_payment_instructions where country = p_country for update;
  if coalesce(current_version,0) <> p_expected_version then raise exception 'Instruction version conflict' using errcode = '40001'; end if;
  insert into public.robot_payment_instructions(country,version,methods,updated_by) values(p_country,p_expected_version+1,p_methods,p_actor)
    on conflict(country) do update set version = excluded.version, methods = excluded.methods, updated_by = excluded.updated_by, updated_at = now();
  insert into public.robot_payment_audit(actor_id,action,target_id) values(p_actor,'instructions_saved',p_country);
  return query select * from public.robot_payment_instructions where country = p_country;
end $$;

create or replace function public.submit_robot_activation_request(p_actor uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare config public.robot_payment_instructions; selected_method jsonb; proof jsonb; new_id uuid;
begin
  if not exists(select 1 from auth.users where id = p_actor and (banned_until is null or banned_until < now())) then raise insufficient_privilege; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Invalid proof request' using errcode = '22023'; end if;
  select * into config from public.robot_payment_instructions where country = p_payload->>'country' for share;
  if config.country is null or config.version <> (p_payload->>'instruction_version')::integer then raise exception 'Instruction version conflict' using errcode = '40001'; end if;
  select item into selected_method from jsonb_array_elements(config.methods) item where item->>'id' = p_payload->>'method_id' and item->>'enabled' = 'true';
  if selected_method is null then raise exception 'Payment option unavailable' using errcode = '40001'; end if;
  if p_payload->'files' is null or jsonb_typeof(p_payload->'files') <> 'array' or jsonb_array_length(p_payload->'files') not between 1 and 3 then raise check_violation; end if;
  new_id := (p_payload->>'id')::uuid;
  insert into public.robot_activation_requests(id,user_id,country,plan_id,full_name,phone,transaction_reference,instruction_version,payment_method,quote)
    values(new_id,p_actor,p_payload->>'country',p_payload->>'plan_id',p_payload->>'full_name',p_payload->>'phone',coalesce(p_payload->>'transaction_reference',''),config.version,selected_method,p_payload->'quote');
  for proof in select * from jsonb_array_elements(p_payload->'files') loop
    if proof->>'object_path' not like p_actor::text || '/' || new_id::text || '/%' then raise check_violation; end if;
    insert into public.robot_payment_proofs(id,request_id,object_path,original_name,mime_type,size_bytes)
      values((proof->>'id')::uuid,new_id,proof->>'object_path',proof->>'original_name',proof->>'mime_type',(proof->>'size_bytes')::integer);
  end loop;
  insert into public.robot_payment_audit(actor_id,action,target_id) values(p_actor,'proof_submitted',new_id::text);
end $$;

create or replace function public.review_robot_activation_request(p_id uuid,p_status text,p_note text,p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from auth.users where id = p_actor and raw_app_meta_data->>'role' = 'admin' and (banned_until is null or banned_until < now())) then raise insufficient_privilege; end if;
  if p_status is null or p_note is null or p_status not in ('under_review','rejected') or (p_status = 'rejected' and char_length(trim(p_note)) < 3) then raise check_violation; end if;
  update public.robot_activation_requests set status = p_status, review_note = p_note, reviewed_by = p_actor, reviewed_at = now()
    where id = p_id and status in ('pending_review','under_review');
  if not found then raise exception 'Request is no longer reviewable' using errcode = '40001'; end if;
  insert into public.robot_payment_audit(actor_id,action,target_id) values(p_actor,'proof_' || p_status,p_id::text);
end $$;


commit;


-- Migration: 008_private_payment_instruction_drafts.sql
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


-- Migration: 009_invitation_usernames.sql
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


-- Migration: 010_short_invitation_codes.sql
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


-- Migration: 011_robot_payment_approval.sql
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


-- Migration: 012_rwanda_account_activation.sql
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


-- Migration: 013_withdrawal_state_machine.sql
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

