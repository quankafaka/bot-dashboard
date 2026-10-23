-- 014: a starting balance per account, for books shared by more than one
-- person (Bet99: Alex and Jack).
--
-- Works like dim_book.starting_balance / balance_start (migration 003): the
-- balance is the starting balance on balance_start plus every settled bet
-- placed since. A book whose accounts have one shows each account's balance
-- in the page header, and their total on the Overall page; the book's own
-- columns are then left empty. Single-person books keep theirs on dim_book.
--
-- Run once in Supabase -> SQL Editor. Safe to run again.

alter table public.dim_account
    add column if not exists starting_balance numeric,
    add column if not exists balance_start    date;

-- Bet99's bankroll on 2026-10-23, split by account.
update public.dim_account a
set starting_balance = v.bal, balance_start = date '2026-10-23'
from (values ('bet99#alex', 2100.00), ('bet99#jack', 1000.00)) v(tag, bal)
where a.tag = v.tag;

update public.dim_book
set starting_balance = null, balance_start = null
where name = 'Bet99';
