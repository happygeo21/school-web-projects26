begin;
-- Test project only. No production schema, teacher accounts, or Firebase data migration.
-- No anon/authenticated policies: only the server service role can reach these objects.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('veterans-v2-private','veterans-v2-private',false,15728640,array['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf'])
on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='veterans-v2-private' and public) then
  raise exception 'Existing bucket is public; stop and review manually';
 end if;
end $$;

create table public.veterans_v2_media (
 asset_id text primary key check(asset_id ~ '^p_[a-f0-9]{64}$'),
 school_id text not null check(school_id ~ '^S[1-7]$'),owner_uid text not null,work_id text not null,
 object_key text unique not null,size bigint not null check(size>0),content_type text not null,sha256 text not null,
 state text not null check(state in ('uploading','ready','missing','deleted')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.veterans_v2_media_budget (
 month date primary key,bytes bigint not null default 0,downloads bigint not null default 0
);
alter table public.veterans_v2_media enable row level security;
alter table public.veterans_v2_media_budget enable row level security;
revoke all on public.veterans_v2_media,public.veterans_v2_media_budget from anon,authenticated;
grant all on public.veterans_v2_media,public.veterans_v2_media_budget to service_role;

create function public.veterans_v2_reserve_media(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.veterans_v2_media;used_bytes bigint;amount bigint:=(p->>'size')::bigint;kind text:=p->>'content_type';object_name text;
begin
 perform pg_advisory_xact_lock(26622601); -- serializes reservations across all 7 schools
 if amount<1 or (kind like 'image/%' and amount>3145728) or (kind like 'video/%' and amount>15728640) or (kind='application/pdf' and amount>5242880)
 or kind not in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf') then raise exception 'invalid_file';end if;
 select * into item from public.veterans_v2_media where asset_id=p->>'asset_id' for update;
 if found and item.state<>'deleted' then
  if item.owner_uid<>p->>'owner_uid' or item.sha256<>p->>'sha256' or item.size<>amount or item.content_type<>kind then raise exception 'identity_conflict';end if;
  if item.state='ready' then return jsonb_build_object('existing',true,'object_key',item.object_key);end if;
  raise exception 'upload_busy';
 end if;
 -- Actual object metadata across this dedicated project + conservative outstanding reservations.
 select coalesce(sum((metadata->>'size')::bigint),0) into used_bytes from storage.objects;
 used_bytes:=used_bytes+coalesce((select sum(size) from public.veterans_v2_media where state in ('uploading','missing')),0);
 if used_bytes+amount>67108864 or (kind like 'video/%' and used_bytes+amount>=60000000) then raise exception 'quota_full';end if;
 if (select count(*) from public.veterans_v2_media where owner_uid=p->>'owner_uid' and created_at>now()-interval '1 day')>=3
 and item.asset_id is null then raise exception 'daily_limit';end if;
 if (select count(*) from public.veterans_v2_media where created_at>now()-interval '1 day')>=20
 and item.asset_id is null then raise exception 'daily_limit_project';end if;
 object_name:='private/'||(p->>'asset_id')||'/'||gen_random_uuid()::text;
 insert into public.veterans_v2_media(asset_id,school_id,owner_uid,work_id,object_key,size,content_type,sha256,state)
 values(p->>'asset_id',p->>'school_id',p->>'owner_uid',p->>'work_id',object_name,amount,kind,p->>'sha256','uploading')
 on conflict(asset_id) do update set object_key=excluded.object_key,state='uploading',updated_at=now();
 return jsonb_build_object('existing',false,'object_key',object_name,'warning',used_bytes+amount>=700000000);
end $$;
create function public.veterans_v2_media_state(p_id text,p_state text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_state not in ('ready','missing','deleted') then raise exception 'invalid_state';end if;
 update public.veterans_v2_media set state=p_state,updated_at=now() where asset_id=p_id;
 return jsonb_build_object('ok',true);
end $$;
create function public.veterans_v2_download_budget(p_bytes bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_month date:=date_trunc('month',now())::date;row public.veterans_v2_media_budget;
begin
 if p_bytes<1 then raise exception 'invalid_bytes';end if;
 insert into public.veterans_v2_media_budget(month) values(current_month) on conflict do nothing;
 select * into row from public.veterans_v2_media_budget where month=current_month for update;
 -- Estimated transfer budget, conservatively below the published 5GB egress allowance.
 if row.bytes+p_bytes>500000000 or row.downloads>=400000 then raise exception 'quota_egress';end if;
 update public.veterans_v2_media_budget set bytes=bytes+p_bytes,downloads=downloads+1 where month=current_month;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.veterans_v2_reserve_media(jsonb),public.veterans_v2_media_state(text,text),public.veterans_v2_download_budget(bigint) from public,anon,authenticated;
grant execute on function public.veterans_v2_reserve_media(jsonb),public.veterans_v2_media_state(text,text),public.veterans_v2_download_budget(bigint) to service_role;

create function public.veterans_v2_storage_usage() returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('objectBytes',coalesce((select sum((metadata->>'size')::bigint) from storage.objects),0),
 'reservedBytes',coalesce((select sum(size) from public.veterans_v2_media where state in ('uploading','missing')),0),
 'capacity',67108864,'estimatedTransferBytes',coalesce((select bytes from public.veterans_v2_media_budget where month=date_trunc('month',now())::date),0),
 'transferEstimate',true)
$$;
revoke all on function public.veterans_v2_storage_usage() from public,anon,authenticated;
grant execute on function public.veterans_v2_storage_usage() to service_role;

create table public.veterans_v2_records(kind text not null check(kind in ('submissions','works')),school text not null check(school ~ '^S[1-7]$'),owner text not null,id text not null,data jsonb not null,original jsonb not null,public_id text not null unique,projection jsonb,audit jsonb not null default '[]',created_at timestamptz not null default now(),primary key(kind,school,owner,id));
create table public.veterans_v2_control(id boolean primary key default true check(id),enabled boolean not null default false,max_requests_minute int not null default 240 check(max_requests_minute between 1 and 500),max_requests_day int not null default 5000 check(max_requests_day between 1 and 10000));
insert into public.veterans_v2_control(id) values(true);
create table public.veterans_v2_requests(bucket text primary key,count int not null default 0);
alter table public.veterans_v2_records enable row level security;alter table public.veterans_v2_control enable row level security;alter table public.veterans_v2_requests enable row level security;
revoke all on public.veterans_v2_records,public.veterans_v2_control,public.veterans_v2_requests from public,anon,authenticated;
grant all on public.veterans_v2_records,public.veterans_v2_control,public.veterans_v2_requests to service_role;
create function public.veterans_v2_guard(p_write boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.veterans_v2_control;n int;key text;
begin
 select * into c from public.veterans_v2_control where id=true;
 if p_write and not c.enabled then raise exception 'v2_paused';end if;
 foreach key in array array['minute:'||to_char(clock_timestamp(),'YYYYMMDDHH24MI'),'day:'||to_char(clock_timestamp(),'YYYYMMDD')] loop
 insert into public.veterans_v2_requests(bucket,count) values(key,1) on conflict(bucket) do update set count=public.veterans_v2_requests.count+1 returning count into n;
 if (key like 'minute:%' and n>c.max_requests_minute) or (key like 'day:%' and n>c.max_requests_day) then raise exception 'quota_requests';end if;
 end loop;
 return jsonb_build_object('enabled',c.enabled);
end $$;
create function public.veterans_v2_records_access(a text,p jsonb,actor jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.veterans_v2_records;next_data jsonb;result jsonb;teacher boolean:=coalesce((actor->>'teacher')::boolean,false);schools jsonb:=coalesce(actor->'schools','[]'::jsonb);who text:=coalesce(actor->>'uid','');
begin
 if a='public' then select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'public_id',public_id,'data',projection)),'[]') into result from public.veterans_v2_records where projection is not null and data->>'status'='approved' and kind=p->>'kind';return result;end if;
 if who='' then raise exception 'v2_denied';end if;
 if a='read' then
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'school',school,'owner',owner,'id',id,'data',data,'audit',audit)),'[]') into result from public.veterans_v2_records where kind=p->>'kind' and ((teacher and schools ? school) or (not teacher and owner=who)) and (coalesce(p->>'school','')='' or school=p->>'school') and (coalesce(p->>'owner','')='' or owner=p->>'owner') and (coalesce(p->>'id','')='' or id=p->>'id');return result;
 end if;
 if p->>'school' !~ '^S[1-7]$' or p->>'id' !~ '^[A-Za-z0-9_-]{1,128}$' or p->>'owner' !~ '^[A-Za-z0-9_-]{1,128}$' then raise exception 'v2_denied';end if;
 perform pg_advisory_xact_lock(26622602);
 select * into r from public.veterans_v2_records where kind=p->>'kind' and school=p->>'school' and owner=p->>'owner' and id=p->>'id' for update;
 if a='create' then
 if teacher or who<>p->>'owner' or p->'data'->>'status'<>'pending' or p->'data'->>'schoolId'<>p->>'school' then raise exception 'v2_denied';end if;
 if r.id is not null then if r.data<>p->'data' then raise exception 'v2_denied';end if;return r.data;end if;
 if (select count(*) from public.veterans_v2_records where created_at>now()-interval '1 day')>=200 or (select count(*) from public.veterans_v2_records where owner=who and created_at>now()-interval '1 day')>=8 then raise exception 'quota_records';end if;
 insert into public.veterans_v2_records(kind,school,owner,id,data,original,public_id) values(p->>'kind',p->>'school',p->>'owner',p->>'id',p->'data',p->'data',p->>'public_id');return p->'data';
 elsif a='review' then
 if not teacher or not(schools ? (p->>'school')) or r.id is null then raise exception 'v2_denied';end if;
 next_data:=p->'data';
 if next_data->>'schoolId'<>r.school or next_data->'studentOriginal' is distinct from r.original->'studentOriginal' or next_data->'awarenessOriginal' is distinct from r.original->'awarenessOriginal' or next_data->'activityCode' is distinct from r.original->'activityCode' or next_data->'createdAt' is distinct from r.original->'createdAt' or (next_data->>'revision')::int<>coalesce((r.data->>'revision')::int,0)+1 then raise exception 'v2_denied';end if;
 if next_data->>'status' not in ('approved','pending','changes_requested','rejected','private','archived') then raise exception 'v2_denied';end if;
 if next_data->>'status'='approved' and (p->'projection' is null or p->'projection'='null'::jsonb or p->'projection'->>'schoolId'<>r.school) then raise exception 'v2_denied';end if;
 update public.veterans_v2_records set data=next_data,projection=case when next_data->>'status'='approved' then p->'projection' else null end,audit=audit||jsonb_build_array(jsonb_build_object('before',r.data,'after',next_data,'editor',who,'editedAt',extract(epoch from clock_timestamp())*1000)) where kind=r.kind and school=r.school and owner=r.owner and id=r.id;return next_data;
 end if;
 raise exception 'v2_denied';
end $$;
revoke all on function public.veterans_v2_guard(boolean),public.veterans_v2_records_access(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.veterans_v2_guard(boolean),public.veterans_v2_records_access(text,jsonb,jsonb) to service_role;
commit;
