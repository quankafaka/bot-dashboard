-- 017: fix the public site after `revoke select on v_wager from anon`.
--
-- v_wager_strategy and v_wager_limit check v_wager as the visitor, not as
-- their owner, so once anon lost v_wager their *_public views (016) failed
-- with "permission denied for view v_wager". Each now reads through a
-- security definer function, which runs as postgres and keeps the CAD filter.
-- anon needs execute (a view checks function rights as the visitor); the
-- functions return only CAD rows, the same as the views.
--
-- Run once in Supabase -> SQL Editor, after 016. Safe to run again.

create or replace function public.cad_wager_strategy()
returns setof public.v_wager_strategy
language sql stable security definer set search_path = '' as $$
    select s.* from public.v_wager_strategy s
    where s.wager_id in (select wager_id from public.v_wager_public)
$$;

create or replace function public.cad_wager_limit()
returns setof public.v_wager_limit
language sql stable security definer set search_path = '' as $$
    select l.* from public.v_wager_limit l
    where l.wager_id in (select wager_id from public.v_wager_public)
$$;

revoke all on function public.cad_wager_strategy(), public.cad_wager_limit()
    from public, anon, authenticated;
grant execute on function public.cad_wager_strategy(), public.cad_wager_limit() to anon;

create or replace view public.v_wager_strategy_public as
select * from public.cad_wager_strategy();

create or replace view public.v_wager_limit_public as
select * from public.cad_wager_limit();

grant select on public.v_wager_strategy_public, public.v_wager_limit_public to anon;
