alter table public.veterans_v2_control add column write_until timestamptz;
CREATE OR REPLACE FUNCTION public.veterans_v2_guard(p_write boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.veterans_v2_control;n int;key text;
begin
 select * into c from public.veterans_v2_control where id=true;
 if p_write and (not c.enabled or c.write_until is null or clock_timestamp() >= c.write_until) then raise exception 'v2_paused';end if;
 foreach key in array array['minute:'||to_char(clock_timestamp(),'YYYYMMDDHH24MI'),'day:'||to_char(clock_timestamp(),'YYYYMMDD')] loop
 insert into public.veterans_v2_requests(bucket,count) values(key,1) on conflict(bucket) do update set count=public.veterans_v2_requests.count+1 returning count into n;
 if (key like 'minute:%' and n>c.max_requests_minute) or (key like 'day:%' and n>c.max_requests_day) then raise exception 'quota_requests';end if;
 end loop;
 return jsonb_build_object('enabled',c.enabled);
end $function$
