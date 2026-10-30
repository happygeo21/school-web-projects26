-- READ ONLY. Select test project jfkjuhxkcctfmwojhpci in the management connection first.
-- SQL alone cannot identify a Supabase project. Never run against the operating project.
begin transaction read only;
do $$ begin
 if to_regclass('public.veterans_media') is null
  or to_regprocedure('public.veterans_reserve_media(jsonb)') is null then
  raise exception 'invite_baseline_missing';
 end if;
 if to_regclass('public.veterans_upload_invites') is not null
  or to_regclass('public.veterans_upload_grants') is not null
  or to_regclass('public.veterans_upload_claims') is not null
  or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='veterans_upload_access') then
  raise exception 'invite_schema_conflict';
 end if;
 if exists(select 1 from (values
  ('asset_id','text'),('school_id','text'),('owner_uid','text'),('work_id','text'),
  ('object_key','text'),('size','int8'),('content_type','text'),('sha256','text'),
  ('state','text'),('created_at','timestamptz'),('updated_at','timestamptz')) expected(name,kind)
  where not exists(select 1 from information_schema.columns c where c.table_schema='public'
    and c.table_name='veterans_media' and c.column_name=expected.name and c.udt_name=expected.kind)) then
  raise exception 'invite_baseline_schema_mismatch';
 end if;
 if not exists(select 1 from storage.buckets where id='veterans-private' and public=false) then
  raise exception 'invite_private_bucket_required';
 end if;
end $$;
-- Aggregate counts and metadata only; never emit teacher/student identifiers or tokens.
select count(*) as existing_media_count from public.veterans_media;
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='veterans-private';
select p.proname,p.prosecdef,p.proconfig,p.proacl,md5(pg_get_functiondef(p.oid)) as source_md5
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in
 ('veterans_reserve_media','veterans_media_state','veterans_download_budget','veterans_storage_usage')
 order by p.proname;
rollback;
