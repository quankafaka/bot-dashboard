// Patch notes, newest first. To add one, put a new entry at the TOP.
//
// An entry is { date: 'YYYY-MM-DD', title, sections: [...] }, and a section is
// { heading, text?, bullets?, table? } -- every part optional but the heading.
// table is { head: [...], rows: [[...], ...] }. Plain strings only.

export const PATCH_NOTES = [
  {
    date: '2026-10-06',
    title: 'Soccer limit rule: a higher EV instead of a smaller stake',
    sections: [
      {
        heading: 'What changed',
        text: 'In thin soccer markets the bot no longer halves the stake. A bet there now needs more EV to be taken, and every bet that qualifies gets the full stake. Very thin markets are still skipped outright.',
        table: {
          head: ['Market', 'Skipped under', 'Needs this EV', 'Normal +1% from'],
          rows: [
            ['Asian handicap', '$150', '+4.5% under $400', '$400'],
            ['Goal totals', '$200', '+2.5% under $400', '$400'],
            ['1X2', '$300', '+3.0% under $500', '$500'],
            ['Corners', '$125', '—', '$125'],
            ['Bookings', '$125', '—', '$125'],
          ],
        },
      },
      {
        heading: 'Why',
        text: "Tested on bia's 1,089 soccer bets, every method restaked with today's sizer and judged by closing line value after commission:",
        table: {
          head: ['Method', 'Bets', 'Handle', 'Expected profit', 'Expected yield'],
          rows: [
            ['No limit rule', '818', '$75,922', '+$2,019', '2.7%'],
            ['Skip + half stake + higher EV (old rule)', '341', '$26,546', '+$1,559', '5.9%'],
            ['Skip + higher EV, full stake (new rule)', '341', '$34,039', '+$1,956', '5.8%'],
          ],
        },
        bullets: [
          'Once a bet clears the higher EV, halving its stake only gives away money on a good bet.',
          'The new rule expects about the same profit as no rule at all, on 45% of the handle at twice the yield.',
          'Moving all three EV minimums up or down by 2 points barely changes the result, so it does not hang on the exact numbers. They will be refitted after another month.',
          'Actual profit was negative this month for every method, mostly from goal totals. On the same filters, mise\'s goal totals came in where the closing line predicted, so it reads as a bad month rather than a broken rule.',
        ],
      },
      {
        heading: 'Corners and bookings',
        text: 'Both are now skipped at a $100 limit. At $100, bia beat the closing line on 44% of corner bets and mise on 31%: both lost to the close, so it is the market, not the picks.',
      },
      {
        heading: 'In Discord',
        bullets: [
          "#bets: each soccer bet's limit line says what EV it needed, e.g. \"soccer asian handicap at a $250 Pinnacle limit -> needs +4.5% EV, full stake\".",
          '#status: every 6 hours, per market: cleared (passed the rule), held back (cleared +1% but not the higher EV), skipped (limit too low).',
          'The start post lists the rule.',
        ],
      },
      {
        heading: 'On this site',
        bullets: [
          'The Limit column says what the rule asks at that limit: "Needs +4.5%" or "Skip band". Bets the old rule halved still say "Reduced stake (old rule)".',
          'Split by "Pinnacle limit" has a new $400–499 band, where the 1X2 minimum stops.',
          'This page.',
        ],
      },
      {
        heading: 'Volume cashback',
        text: "BetInAsia's 0.1% monthly volume cashback now shows in Graded as a \"Cashback adjustment\" row on the 1st of each month: stake $0, profit = the cashback, counted in profit everywhere. Won and lost stakes count in full, half wins and half losses count half, pushes, voids and free bets count nothing. September 2026: +$49.39 on $49,390.99.",
      },
      {
        heading: 'Correction',
        text: "The bet log's EV, CLV and profit were already after commission, because the bot logs the price BetInAsia actually booked. An earlier analysis took the commission off a second time; everything above uses the numbers as logged. It also means \"EV at log\" on this site and the EV in Discord should roughly agree.",
      },
    ],
  },
  {
    date: '2026-10-05',
    title: 'EV after commission, the $200 max stake, and the first limit rule',
    sections: [
      {
        heading: 'EV is now after commission',
        text: "The probe now scores the price after BetInAsia's 1.5% commission, so the +1% floor, the sizer and every re-check judge the bet that actually goes on. Before, a bet could clear +1% on the full price and be sized as the under-1% it really was. The Discord EV line says \"after commission\".",
      },
      {
        heading: 'Max stake back to $200',
        text: 'The stake ceiling is $200 again, with the sizing behind it restored to match (an average stake of about $97).',
      },
      {
        heading: 'First soccer limit rule',
        text: "The bot reads Pinnacle's limit on each soccer alert from pdropper and skips the thinnest markets. Its first version halved the stake at middling limits; replaced on 2026-10-06 by the higher-EV rule above. Other sports are not affected.",
      },
      {
        heading: 'On this site',
        bullets: [
          'A Limit column in Pending and Graded.',
          'Pending shows when each bet was placed, newest first, instead of kickoff.',
          'BetInAsian times are in Costa Rica time.',
          'The Account column only shows on a book with more than one account.',
          'Overview, Split by "Pinnacle limit", plus Avg CLV and Beat close columns on every split.',
        ],
      },
    ],
  },
]
