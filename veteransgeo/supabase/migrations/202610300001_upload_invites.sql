-- TEST PROJECT ONLY. Requires 202610290001_private_media.sql. Never run on production without review.
-- Only SHA256 capabilities live here. No invite/grant is written to Firebase student records.
create table public.veterans_upload_invites (
 id uuid primary key default gen_random_uuid(), token_hash text unique not null check(token_hash ~ '^[a-f0-9]{64}$'),
 school_id text not null check(school_id ~ '^S[1-7]$'), teacher_uid text not null,
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
 revoked_at timestamptz, per_uid integer not null check(per_uid between 1 and 3),
 total integer not null check(total between 1 and 300), max_bytes bigint not null check(max_bytes between 1 and 15728640)
);
create table public.veterans_upload_grants (
 grant_hash text primary key check(grant_hash ~ '^[a-f0-9]{64}$'),
 invite_id uuid not null references public.veterans_upload_invites(id), owner_uid text not null,
 expires_at timestamptz not null, created_at timestamptz not null default clock_timestamp()
);
create table public.veterans_upload_claims (
 invite_id uuid not null references public.veterans_upload_invites(id), owner_uid text not null,
 work_id text not null, asset_id text not null, size bigint not null, sha256 text not null,
 committed boolean not null default false, primary key(invite_id,owner_uid,work_id)
);
alter table public.veterans_upload_invites enable row level security;
alter table public.veterans_upload_grants enable row level security;
alter table public.veterans_upload_claims enable row level security;
revoke all on public.veterans_upload_invites,public.veterans_upload_grants,public.veterans_upload_claims from public,anon,authenticated;
grant all on public.veterans_upload_invites,public.veterans_upload_grants,public.veterans_upload_claims to service_role;

create function public.veterans_upload_access(a text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.veterans_upload_invites; g public.veterans_upload_grants;
 c public.veterans_upload_claims; m public.veterans_media;
 t timestamptz; n integer; result jsonb;
begin
 if a='issue' then
  if (p->>'school') !~ '^S[1-7]$' or coalesce(p->>'teacher','') !~ '^[A-Za-z0-9_-]{1,128}$'
   or (p->>'hash') !~ '^[a-f0-9]{64}$' or not (p ?& array['school','teacher','hash','ttl','per_uid','total','max_bytes'])
   or (p->>'ttl')::integer not between 1 and 60 then raise exception 'invite_denied'; end if;
  insert into public.veterans_upload_invites(token_hash,school_id,teacher_uid,expires_at,per_uid,total,max_bytes)
   values(p->>'hash',p->>'school',p->>'teacher',clock_timestamp()+make_interval(mins=>(p->>'ttl')::integer),
    (p->>'per_uid')::integer,(p->>'total')::integer,(p->>'max_bytes')::bigint) returning * into i;
  return jsonb_build_object('id',i.id,'schoolId',i.school_id,'expiresAt',i.expires_at,'perStudent',i.per_uid,'total',i.total,'maxBytes',i.max_bytes);
 elsif a='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'schoolId',x.school_id,'expiresAt',x.expires_at,
   'revoked',x.revoked_at is not null,'perStudent',x.per_uid,'total',x.total,'maxBytes',x.max_bytes,
   'used',(select count(*) from public.veterans_upload_claims q where q.invite_id=x.id)) order by x.created_at desc),'[]'::jsonb)
   into result from (select * from public.veterans_upload_invites where school_id=p->>'school' order by created_at desc limit 30) x;
  return result;
 elsif a='revoke' then
  -- All approved teachers can revoke; never deletes existing works or previously accepted files.
  update public.veterans_upload_invites set revoked_at=clock_timestamp() where id=(p->>'id')::uuid returning * into i;
  if not found then raise exception 'invite_denied'; end if;
  return jsonb_build_object('revoked',true,'id',i.id);
 elsif a='redeem' then
  select * into i from public.veterans_upload_invites where token_hash=p->>'hash' for update;
  if not found then raise exception 'invite_denied'; end if;
 else
  select * into g from public.veterans_upload_grants where grant_hash=p->>'grant_hash';
  if not found or g.owner_uid is distinct from p->>'uid' then raise exception 'invite_denied'; end if;
  select * into i from public.veterans_upload_invites where id=g.invite_id for update;
  if not found or i.school_id is distinct from p->>'school' or g.expires_at<=clock_timestamp() then raise exception 'invite_denied'; end if;
 end if;
 -- Check clock after obtaining the lock: waiting requests cannot use a stale transaction time.
 t:=clock_timestamp();
 if i.revoked_at is not null or i.expires_at<=t or coalesce(p->>'uid','') !~ '^[A-Za-z0-9_-]{1,128}$' then raise exception 'invite_denied'; end if;
 if a='redeem' then
  select count(*) into n from public.veterans_upload_grants where invite_id=i.id and owner_uid=p->>'uid' and expires_at>t;
  if n>=10 then raise exception 'invite_quota'; end if;
  if (select count(*) from public.veterans_upload_grants where invite_id=i.id and expires_at>t)>=300 then raise exception 'invite_quota'; end if;
  insert into public.veterans_upload_grants(grant_hash,invite_id,owner_uid,expires_at)
   values(p->>'grant_hash',i.id,p->>'uid',least(i.expires_at,t+interval '15 minutes')) returning * into g;
  return jsonb_build_object('schoolId',i.school_id,'expiresAt',g.expires_at,'maxBytes',i.max_bytes,'perStudent',i.per_uid);
 end if;
 if a='check' then return jsonb_build_object('schoolId',i.school_id,'expiresAt',g.expires_at,'maxBytes',i.max_bytes); end if;
 if a not in ('claim','commit') or coalesce(p->>'work_id','') !~ '^[A-Za-z0-9_-]{1,128}$'
  or coalesce(p->>'asset_id','') !~ '^p_[a-f0-9]{64}$' or coalesce(p->>'sha256','') !~ '^[a-f0-9]{64}$'
  or not(p ? 'size') or (p->>'size')::bigint<1 or (p->>'size')::bigint>i.max_bytes then raise exception 'invite_denied'; end if;
 select * into c from public.veterans_upload_claims where invite_id=i.id and owner_uid=p->>'uid' and work_id=p->>'work_id';
 if found then
  if c.asset_id is distinct from p->>'asset_id' or c.sha256 is distinct from p->>'sha256' or c.size is distinct from (p->>'size')::bigint then raise exception 'invite_denied'; end if;
 elsif a='claim' then
  if (select count(*) from public.veterans_upload_claims where invite_id=i.id)>=i.total
   or (select count(*) from public.veterans_upload_claims where invite_id=i.id and owner_uid=p->>'uid')>=i.per_uid then raise exception 'invite_quota'; end if;
  insert into public.veterans_upload_claims(invite_id,owner_uid,work_id,asset_id,size,sha256)
   values(i.id,p->>'uid',p->>'work_id',p->>'asset_id',(p->>'size')::bigint,p->>'sha256');
 else raise exception 'invite_denied'; end if;
 if a='commit' then
  select * into m from public.veterans_media where asset_id=p->>'asset_id' for update;
  if not found or m.school_id<>i.school_id or m.owner_uid<>g.owner_uid or m.work_id<>c.work_id
   or m.size<>c.size or m.sha256<>c.sha256 or m.state not in ('uploading','ready') then raise exception 'invite_denied'; end if;
  -- Recheck expiry immediately before commit; revoke is serialized by the invitation row lock.
  if least(i.expires_at,g.expires_at)<=clock_timestamp() then raise exception 'invite_denied'; end if;
  update public.veterans_media set state='ready',updated_at=clock_timestamp() where asset_id=m.asset_id;
  update public.veterans_upload_claims set committed=true where invite_id=i.id and owner_uid=g.owner_uid and work_id=c.work_id;
 end if;
 return jsonb_build_object('authorized',true);
end $$;
revoke all on function public.veterans_upload_access(text,jsonb) from public,anon,authenticated;
grant execute on function public.veterans_upload_access(text,jsonb) to service_role;
