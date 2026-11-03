-- REVIEW ONLY. Do not execute changes without separate production authorization.
-- Target only: Seoul pwedcxqkjolntwylgoyr, after approved V2 installation.
-- Never run on the Mumbai test project or V1 Firebase. Aggregate counts only.
-- Run the SELECT before class, during class, and before any approved resume.
with usage as (
 select
 (select enabled from public.veterans_v2_control where id=true) as submissions_enabled,
 (select count(*) from public.veterans_v2_media where created_at > now()-interval '24 hours') as new_files_24h,
 coalesce((select sum((metadata->>'size')::bigint) from storage.objects),0)
 +coalesce((select sum(size) from public.veterans_v2_media where state in ('uploading','missing')),0) as used_and_reserved_bytes,
 coalesce((select bytes from public.veterans_v2_media_budget where month=date_trunc('month',now())::date),0) as estimated_month_transfer_bytes,
 (select count(*) from public.veterans_v2_media where state in ('uploading','missing')) as unsettled_files
)
select *, new_files_24h>=16 or used_and_reserved_bytes>=53687091
 or estimated_month_transfer_bytes>=400000000 as warn_pause_and_review,
 20 as max_files_24h,67108864 as max_storage_bytes,500000000 as max_estimated_transfer_bytes
from usage;
-- APPROVAL REQUIRED: pause new text/file submissions, retain teacher review/withdrawal.
-- update public.veterans_v2_control set enabled=false where id=true returning enabled;
-- Already accepted uploads may finish. Check unsettled files and stable counts before handoff.
-- RESUME REQUIRES: approved school/window, no abuse, adequate headroom, no unexplained files.
-- update public.veterans_v2_control set enabled=true where id=true returning enabled;
-- Never reset counters, recreate identities or delete student files to bypass limits.