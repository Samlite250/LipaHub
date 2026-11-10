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
