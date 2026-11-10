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
