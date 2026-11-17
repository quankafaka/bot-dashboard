-- 018: steam latency -- how long each steam bet took to reach the Confirm press.
--
-- Three numbers per bet, in seconds, written by the bots (BetInAsian through
-- m_dashboard_sync, Mise-o-jeu through dashboard/pending.py) for steam bets
-- placed from 2026-11-10 on. NULL on model bets, hand-logged bets and
-- everything older:
--
--   latency_signal_s   pdropper's alert time -> Confirm (the alert time is to
--                      the minute at best, so this one is rough)
--   latency_seen_s     the bot first saw the alert -> Confirm
--   latency_click_s    the betslip was opened -> Confirm (the clicking alone)
--
-- Until this has run the bots skip the columns (both check what fact_wager
-- has) and the dashboard shows no latency.
--
-- Run once in Supabase -> SQL Editor. Safe to run again.

alter table public.fact_wager
    add column if not exists latency_signal_s numeric,
    add column if not exists latency_seen_s   numeric,
    add column if not exists latency_click_s  numeric;

-- Only the bets the visitor may see (v_wager decides that), like the other
-- side views.
create or replace view public.v_wager_latency with (security_invoker = true) as
select f.wager_id, f.latency_signal_s, f.latency_seen_s, f.latency_click_s
from public.fact_wager f
where f.latency_seen_s is not null
  and f.wager_id in (select wager_id from public.v_wager);

grant select on public.v_wager_latency to authenticated;

-- The public site: CAD books only, read through a security definer function
-- for the reason 017 gives.
create or replace function public.cad_wager_latency()
returns setof public.v_wager_latency
language sql stable security definer set search_path = '' as $$
    select l.* from public.v_wager_latency l
    where l.wager_id in (select wager_id from public.v_wager_public)
$$;

revoke all on function public.cad_wager_latency() from public, anon, authenticated;
grant execute on function public.cad_wager_latency() to anon;

create or replace view public.v_wager_latency_public as
select * from public.cad_wager_latency();

grant select on public.v_wager_latency_public to anon;
