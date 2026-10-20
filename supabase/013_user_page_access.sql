-- 013: user_page_access -- who may open the pages that are not a book.
--
-- Today that is only 'overall' (every book the user can see, added up by
-- currency). Works like user_book_access: one row per person per page, and
-- each signed-in user can read only their own rows, so the dashboard learns
-- what it may show from what comes back. The Overall page only adds up the
-- books the person can already see, so this decides who gets the page, not
-- which bets they can read.
--
-- Run once in Supabase -> SQL Editor. Safe to run again.

create table if not exists public.user_page_access (
    user_id     uuid not null references auth.users (id) on delete cascade,
    page        text not null check (page in ('overall')),
    granted_at  timestamptz not null default now(),
    primary key (user_id, page)
);

alter table public.user_page_access enable row level security;

drop policy if exists read_own on public.user_page_access;
create policy read_own on public.user_page_access
    for select to authenticated
    using (user_id = (select auth.uid()));

-- Read only from the dashboard. Grants and revokes go through the SQL
-- Editor (below), which runs as postgres and is not held to the policy.
revoke all on public.user_page_access from anon, authenticated;
grant select on public.user_page_access to authenticated;


-- ---------------------------------------------------------------------------
--  GRANT the Overall page (put the real emails in; run as often as you like)
-- ---------------------------------------------------------------------------
insert into public.user_page_access (user_id, page)
select id, 'overall'
from auth.users
where lower(email) in (
    'first.person@example.com',
    'second.person@example.com'
)
on conflict do nothing;


-- ---------------------------------------------------------------------------
--  Handy queries (run one at a time as needed)
-- ---------------------------------------------------------------------------

-- Who has which page. An email you granted that is missing here has no
-- Supabase user yet: create it under Authentication -> Users, then re-run
-- the grant.
-- select u.email, a.page, a.granted_at
-- from public.user_page_access a
-- join auth.users u on u.id = a.user_id
-- order by u.email, a.page;

-- Take the Overall page away from someone.
-- delete from public.user_page_access a
-- using auth.users u
-- where u.id = a.user_id
--   and a.page = 'overall'
--   and lower(u.email) = 'first.person@example.com';
