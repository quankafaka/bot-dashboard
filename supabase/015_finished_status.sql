-- 015: 'finished' -- the game is over, the result is not in yet.
--
-- A bet stayed 'pending' (at risk, in play) until 48 hours after kick-off
-- whenever pdropper had not graded it, so a game that ended this morning
-- still counted as money riding: Swiper showed $4,942 at risk on a $2,814
-- bankroll (24/10). A bet is now 'finished' once its game has run its usual
-- length, by sport (soccer 2.5 h, basketball 3 h, hockey 3.5 h, baseball and
-- football 4 h, tennis 5 h), until its result comes in ('graded') or 48 h
-- pass ('unlogged'). Neither 'finished' nor 'unlogged' counts as at risk or
-- in play.
--
-- Only the status column changes; every other column is as before.
--
-- Run once in Supabase -> SQL Editor. Safe to run again.

create or replace view public.v_wager as
 SELECT f.wager_id,
    f.source,
        CASE
            WHEN f.result IS NOT NULL THEN 'graded'::text
            WHEN f.pdropper_bet_key IS NULL AND COALESCE(e.start_time, f.placed_at) < (now() - '06:00:00'::interval) THEN 'unlogged'::text
            WHEN COALESCE(e.start_time, f.placed_at) < (now() - '48:00:00'::interval) THEN 'unlogged'::text
            WHEN COALESCE(e.start_time, f.placed_at) < (now() - (CASE s.name
                    WHEN 'Soccer' THEN '2:30'
                    WHEN 'Basketball' THEN '3:00'
                    WHEN 'Hockey' THEN '3:30'
                    WHEN 'Baseball' THEN '4:00'
                    WHEN 'American Football' THEN '4:00'
                    WHEN 'Tennis' THEN '5:00'
                    ELSE '4:00' END)::interval) THEN 'finished'::text
            ELSE 'pending'::text
        END AS status,
    f.placed_at,
    (f.placed_at AT TIME ZONE 'America/Toronto'::text)::date AS placed_date_local,
    s.name AS sport,
    l.name AS league,
    l.country,
    e.home_team,
    e.away_team,
    e.start_time,
    m.market_type,
    m.period,
    m.variant,
    b.name AS book,
    b.currency,
    a.tag AS account,
    f.selection,
    f.line,
    f.bet_ref,
    f.is_freebet,
    f.price_filled,
    f.stake,
    f.fill_status,
    f.pin_novig,
    f.nvp_at_log,
    f.closing_nvp,
    round(f.stake * f.price_filled, 2) AS to_return,
    f.ev_bot_pct AS ev_pct_bot,
    round((f.price_filled / NULLIF(f.nvp_at_log, 0::numeric) - 1::numeric) * 100::numeric, 2) AS ev_pct_log,
    round((f.price_filled / NULLIF(f.closing_nvp, 0::numeric) - 1::numeric) * 100::numeric, 2) AS clv_pct,
    round(f.stake * (f.price_filled / NULLIF(f.nvp_at_log, 0::numeric) - 1::numeric), 2) AS expected_profit,
    f.current_ev_pct,
    f.price_filled - f.price_asked AS fill_slippage,
    EXTRACT(epoch FROM f.placed_at - f.probed_at) AS probe_to_place_sec,
    EXTRACT(epoch FROM e.start_time - f.placed_at) / 3600::numeric AS hours_before_start,
    f.result,
    f.profit,
    f.home_score,
    f.away_score,
    f.graded_at,
    f.note,
    f.pin_price_before,
    f.pin_price_after,
    round((f.pin_price_after / NULLIF(f.pin_price_before, 0::numeric) - 1::numeric) * 100::numeric, 2) AS pin_drop_pct,
    f.closing_price,
    f.alert_selection
   FROM fact_wager f
     JOIN dim_event e USING (event_id)
     JOIN dim_league l USING (league_id)
     JOIN dim_sport s USING (sport_id)
     JOIN dim_market m USING (market_id)
     JOIN dim_book b USING (book_id)
     JOIN dim_account a USING (account_id)
  WHERE NOT f.is_test AND f.excluded_reason IS NULL;
