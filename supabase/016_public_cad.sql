-- 016: the public site -- the CAD books, readable without a login.
--
-- The steam-chasing-dashboard Vercel project (VITE_PUBLIC=1) has no login
-- and reads every table through its *_public view below instead. Each view
-- keeps only the CAD books' rows, and only these views are granted to anon:
-- the real tables and views stay signed-in only, so USD never leaves the
-- database for a visitor. The views run as their owner (postgres), which is
-- what lets anon read them without a policy of its own; the CAD filter in
-- each one is the whole access rule.
--
-- Run once in Supabase -> SQL Editor. Safe to run again. Undo with the drops
-- at the bottom.

create or replace view public.dim_book_public as
select * from public.dim_book where currency = 'CAD';

create or replace view public.v_wager_public as
select * from public.v_wager
where book in (select name from public.dim_book_public);

-- Only the accounts that bet on a CAD book.
create or replace view public.dim_account_public as
select * from public.dim_account
where tag in (select account from public.v_wager_public);

create or replace view public.v_wager_strategy_public as
select * from public.v_wager_strategy
where wager_id in (select wager_id from public.v_wager_public);

create or replace view public.v_wager_limit_public as
select * from public.v_wager_limit
where wager_id in (select wager_id from public.v_wager_public);

create or replace view public.v_wager_model_public as
select * from public.v_wager_model
where wager_id in (select wager_id from public.v_wager_public);

create or replace view public.v_wager_devig_public as
select * from public.v_wager_devig
where wager_id in (select wager_id from public.v_wager_public);

revoke all on public.dim_book_public, public.v_wager_public, public.dim_account_public,
    public.v_wager_strategy_public, public.v_wager_limit_public,
    public.v_wager_model_public, public.v_wager_devig_public
    from anon, authenticated;
grant select on public.dim_book_public, public.v_wager_public, public.dim_account_public,
    public.v_wager_strategy_public, public.v_wager_limit_public,
    public.v_wager_model_public, public.v_wager_devig_public
    to anon;


-- Check, as a visitor would see it: should list only CAD books.
-- set role anon; select name, currency from public.dim_book_public; reset role;

-- Take the public site's data away again.
-- drop view if exists public.v_wager_devig_public, public.v_wager_model_public,
--     public.v_wager_limit_public, public.v_wager_strategy_public,
--     public.dim_account_public, public.v_wager_public, public.dim_book_public;
