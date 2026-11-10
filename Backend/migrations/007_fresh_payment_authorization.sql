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
