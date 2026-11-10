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
