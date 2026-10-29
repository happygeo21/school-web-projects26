-- Test project only. No production schema, teacher accounts, or Firebase data migration.
-- No anon/authenticated policies: only the server service role can reach these objects.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('veterans-private','veterans-private',false,15728640,array['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf'])
on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='veterans-private' and public) then
  raise exception 'Existing bucket is public; stop and review manually';
 end if;
end $$;

create table public.veterans_media (
 asset_id text primary key check(asset_id ~ '^p_[a-f0-9]{64}$'),
 school_id text not null check(school_id ~ '^S[1-7]$'),owner_uid text not null,work_id text not null,
 object_key text unique not null,size bigint not null check(size>0),content_type text not null,sha256 text not null,
 state text not null check(state in ('uploading','ready','missing','deleted')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.veterans_media_budget (
 month date primary key,bytes bigint not null default 0,downloads bigint not null default 0
);
alter table public.veterans_media enable row level security;
alter table public.veterans_media_budget enable row level security;
revoke all on public.veterans_media,public.veterans_media_budget from anon,authenticated;
grant all on public.veterans_media,public.veterans_media_budget to service_role;

create function public.veterans_reserve_media(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.veterans_media;used_bytes bigint;amount bigint:=(p->>'size')::bigint;kind text:=p->>'content_type';object_name text;
begin
 perform pg_advisory_xact_lock(26012901); -- serializes reservations across all 7 schools
 if amount<1 or (kind like 'image/%' and amount>3145728) or (kind like 'video/%' and amount>15728640) or (kind='application/pdf' and amount>5242880)
 or kind not in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf') then raise exception 'invalid_file';end if;
 select * into item from public.veterans_media where asset_id=p->>'asset_id' for update;
 if found and item.state<>'deleted' then
  if item.owner_uid<>p->>'owner_uid' or item.sha256<>p->>'sha256' or item.size<>amount or item.content_type<>kind then raise exception 'identity_conflict';end if;
  if item.state='ready' then return jsonb_build_object('existing',true,'object_key',item.object_key);end if;
  raise exception 'upload_busy';
 end if;
 -- Actual object metadata across this dedicated project + conservative outstanding reservations.
 select coalesce(sum((metadata->>'size')::bigint),0) into used_bytes from storage.objects;
 used_bytes:=used_bytes+coalesce((select sum(size) from public.veterans_media where state in ('uploading','missing')),0);
 if used_bytes+amount>1000000000 or (kind like 'video/%' and used_bytes+amount>=900000000) then raise exception 'quota_full';end if;
 if (select count(*) from public.veterans_media where owner_uid=p->>'owner_uid' and created_at>now()-interval '1 day')>=3
 and item.asset_id is null then raise exception 'daily_limit';end if;
 if (select count(*) from public.veterans_media where created_at>now()-interval '1 day')>=300
 and item.asset_id is null then raise exception 'daily_limit_project';end if;
 object_name:='private/'||(p->>'asset_id')||'/'||gen_random_uuid()::text;
 insert into public.veterans_media(asset_id,school_id,owner_uid,work_id,object_key,size,content_type,sha256,state)
 values(p->>'asset_id',p->>'school_id',p->>'owner_uid',p->>'work_id',object_name,amount,kind,p->>'sha256','uploading')
 on conflict(asset_id) do update set object_key=excluded.object_key,state='uploading',updated_at=now();
 return jsonb_build_object('existing',false,'object_key',object_name,'warning',used_bytes+amount>=700000000);
end $$;
create function public.veterans_media_state(p_id text,p_state text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_state not in ('ready','missing','deleted') then raise exception 'invalid_state';end if;
 update public.veterans_media set state=p_state,updated_at=now() where asset_id=p_id;
 return jsonb_build_object('ok',true);
end $$;
create function public.veterans_download_budget(p_bytes bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_month date:=date_trunc('month',now())::date;row public.veterans_media_budget;
begin
 if p_bytes<1 then raise exception 'invalid_bytes';end if;
 insert into public.veterans_media_budget(month) values(current_month) on conflict do nothing;
 select * into row from public.veterans_media_budget where month=current_month for update;
 -- Estimated transfer budget, conservatively below the published 5GB egress allowance.
 if row.bytes+p_bytes>4000000000 or row.downloads>=400000 then raise exception 'quota_egress';end if;
 update public.veterans_media_budget set bytes=bytes+p_bytes,downloads=downloads+1 where month=current_month;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.veterans_reserve_media(jsonb),public.veterans_media_state(text,text),public.veterans_download_budget(bigint) from public,anon,authenticated;
grant execute on function public.veterans_reserve_media(jsonb),public.veterans_media_state(text,text),public.veterans_download_budget(bigint) to service_role;

create function public.veterans_storage_usage() returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('objectBytes',coalesce((select sum((metadata->>'size')::bigint) from storage.objects),0),
 'reservedBytes',coalesce((select sum(size) from public.veterans_media where state in ('uploading','missing')),0),
 'capacity',1000000000,'estimatedTransferBytes',coalesce((select bytes from public.veterans_media_budget where month=date_trunc('month',now())::date),0),
 'transferEstimate',true)
$$;
revoke all on function public.veterans_storage_usage() from public,anon,authenticated;
grant execute on function public.veterans_storage_usage() to service_role;
