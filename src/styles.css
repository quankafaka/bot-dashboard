-- Run once in the Supabase SQL Editor.
-- Each signed-in user sees only the books (bots) granted to them in
-- user_book_access. Enforced by the database, not the website: a user
-- without a grant gets no rows even if they call the API directly.

create table if not exists user_book_access (
    user_id    uuid     not null references auth.users (id) on delete cascade,
    book_id    smallint not null references dim_book on delete cascade,
    granted_at timestamptz not null default now(),
    primary key (user_id, book_id)
);
alter table user_book_access enable row level security;

drop policy if exists read_own on user_book_access;
create policy read_own on user_book_access
    for select to authenticated
    using (user_id = (select auth.uid()));

-- Wagers: only books you have been granted.
drop policy if exists read_all on fact_wager;
drop policy if exists read_granted_books on fact_wager;
create policy read_granted_books on fact_wager
    for select to authenticated
    using (exists (select 1 from user_book_access g
                   where g.book_id = fact_wager.book_id
                     and g.user_id = (select auth.uid())));

-- Books: the header only lists the ones you can open.
drop policy if exists read_all on dim_book;
drop policy if exists read_granted_books on dim_book;
create policy read_granted_books on dim_book
    for select to authenticated
    using (exists (select 1 from user_book_access g
                   where g.book_id = dim_book.book_id
                     and g.user_id = (select auth.uid())));

-- Accounts: only ones that appear in wagers you can see (so a BetInAsia-only
-- user never sees the Mise account names).
create index if not exists fact_wager_account_id_idx on fact_wager (account_id);
drop policy if exists read_all on dim_account;
drop policy if exists read_visible_accounts on dim_account;
create policy read_visible_accounts on dim_account
    for select to authenticated
    using (exists (select 1 from fact_wager f where f.account_id = dim_account.account_id));


-- ---------------------------------------------------------------------------
--  Granting access. Nobody sees anything until they are granted a book, so
--  grant yourself first. Replace the emails; book names are 'BetInAsian' and
--  'Mise-o-jeu'.
-- ---------------------------------------------------------------------------
insert into user_book_access (user_id, book_id)
select u.id, b.book_id
from auth.users u
cross join dim_book b
where u.email = 'your-email@example.com'                 -- you: every book
on conflict do nothing;

-- Examples (uncomment and edit):
-- insert into user_book_access (user_id, book_id)
-- select u.id, b.book_id from auth.users u, dim_book b
-- where u.email = 'kevin@example.com' and b.name = 'Mise-o-jeu'
-- on conflict do nothing;
--
-- Take a book away:
-- delete from user_book_access g using auth.users u, dim_book b
-- where g.user_id = u.id and g.book_id = b.book_id
--   and u.email = 'kevin@example.com' and b.name = 'Mise-o-jeu';
--
-- Who sees what:
-- select u.email, b.name from user_book_access g
-- join auth.users u on u.id = g.user_id join dim_book b using (book_id)
-- order by 1, 2;