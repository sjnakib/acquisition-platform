-- Drop trigger and function
drop trigger if exists trg_activity_touches_deal on public.activity_log;
drop function if exists public.touch_last_contacted();

-- Drop table
drop table if exists public.activity_log;
