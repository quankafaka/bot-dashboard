# Bot ledger

Performance dashboard for the BetInAsian and Mise-o-jeu bots. Reads the
`v_wager` view and `dim_account` table from Supabase; `dashboard_sync.py`
(separate project) is what fills them.

## Run locally

Needs Node 22.12 or newer (`node -v`).

```
npm install
copy .env.example .env.local     # then fill in the two values
npm run dev                      # http://localhost:5173
```

## Deploy

Push this folder to a GitHub repo, import it in Vercel (framework: Vite,
detected automatically), and add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` under Settings -> Environment Variables.

## Who can see the data

Anyone signed in to your Supabase project can read every wager (the RLS
policies are `to authenticated`). So in Supabase: turn OFF new-user sign-ups
and create each person by hand under Authentication -> Users.

## Where things are

- `src/lib/data.js`     loading from Supabase (paged; the API caps at 1,000 rows)
- `src/lib/metrics.js`  every number on the page, as plain functions
- `src/components/`     Performance, Pending, Graded views
