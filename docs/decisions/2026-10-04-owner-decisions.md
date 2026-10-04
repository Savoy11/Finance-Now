# Owner decisions — 2026-10-04

Recorded from the owner's answers while working through the blocked list, starting at its top:
T-119, then T-005, then the four sources D54 left out (D55), then T-065 and T-066 (D56), then
T-192 (D57), then Reddit sign-in, raised with T-246 (D58). Same form as
`2026-10-03-owner-decisions.md`: one row per ruling, what it cascades to, and what was
actually done.

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D54 | Which 2026-09-26 source-terms readings to mark `verified` (T-005), held under D46 on 2026-09-30 with "Not yet" | **Option 1, "All 17 fully read and settled"**, in reply to the same three options D46 offered: *"Close t-119 and go with option 1 for t-005."* The 17 are the set as offered on 2026-09-30: the eleven clean readings (sec.gov, home.treasury.gov, frankfurter.dev, wikipedia.org, cdn.jsdelivr.net, alternative.me, mempool.space, lunarcrush.com, lido.fi, marinade.finance, and yahoo.com, which stays prohibited), plus the six ruled on in that session's first batch of questions (okx.com, nasdaqtrader.com, kucoin.com, alphavantage.co, messari.io, santiment.net). → APPLIED | Each entry in `sourceTerms.ts` goes `review: 'seeded'` → `'verified'`, with `reviewedAt` set to 2026-09-26, the day the document was read. The registry goes from 26 to 43 verified of 56, and from 30 to 13 seeded. Each `finding` now says what the document says, in place of text written before anyone had read it. The only verdict that moves is alternative.me's (see the notes). T-005 closes |
| D55 | The four 2026-09-26 readings D54 left out: CoinMarketCap, Jito, Rocket Pool and Pendle, read and then ruled on later on 2026-09-30 (D44, D45) | **Mark them verified too.** *"yes and you can move on,"* in reply to the session asking whether to mark these four as well, or move on to the next blocked item. → APPLIED | Each goes `seeded` → `verified`, dated 2026-09-26, with a finding that quotes its document. CoinMarketCap's `termsUrl` now names the Personal API agreement that D44 applies; it was found by web search and is marked to confirm. The registry goes from 43 to 47 verified of 56, and from 13 to 9 seeded |
| D56 | T-065 (plan history) and T-066 (printable rebalance notes), the next two items on the blocked list. Both waited on the owner switching on S5, the Portfolio Builder build-out charter in `docs/TASK-QUEUE.md` | **Option 1, "Start just these two now":** *"merge and go with option 1,"* in reply to three options: start just these two now, park them until after launch, or leave them blocked until S5 is switched on as a whole. → APPLIED | Both are built (see the notes), and T-065 and T-066 close. S5 is started for its items (1) and (2) only. The other S5 work keeps its blockers: contribution modeling (T-067) waits on the scope boundary (T-064), asset location (T-068) on T-064 and D4's legal review, and the federal sale-tax estimator (T-058) on D4. Rebalance reminders (T-116) keep their own two questions: in-app or email, and the legality flag |
| D57 | T-192 (plan-based rate limits on the public API), the next item on the blocked list | **Option 1, "Park it with its siblings":** *"go with option 1 and move on to T-246,"* in reply to three options: park it with its siblings, close it as part of the old platform's checklist, or leave it blocked. → APPLIED | T-192 moves from blocked to parked, beside T-188 (usage metering for billing) and T-191 (per-key IP allowlists) from the same Enterprise Sales Readiness list. It comes back when the launch is planned, after the owner reassesses pricing (D29, parked under D21) and decides whether `/api/v1` gets API keys (T-087). No code change |
| D58 | Reddit sign-in (T-245, parked under D8 until the launch vendor pass), raised by the owner while T-246 (Reddit vote counts) waited on its options: *"can we add a way to sign into reddit from the app?"* | **Revisit as a post-launch project.** *"No lets revisit this as a post launch project. I would like them to see how it will be used in a live setting, they may offer a better way to use access the data we need."* Given in reply to three options: apply for Reddit's approval first and build after, build now behind a switch, or keep waiting until launch. → APPLIED | Refines D8: Reddit access moves out of the launch vendor pass to after launch, when the owner applies to Reddit with the live app to show. T-245 stays parked on that trigger. T-246 moves from blocked to parked beside it, since vote counts only come through that access (its option 1). Reddit stays off, and the app now says so: the two Reddit rows on the Integrations page said "Public API — no key needed", and both Social routes told the reader to configure `REDDIT_CLIENT_ID` |

## Notes

**What "verified" means here.** The registry keeps two separate facts about each source.
`review` says whether someone has read the source's terms. The verdict is what we concluded
from them. Marking an entry verified records the first fact. It does not say the permission
is enough for a public launch. Four of the 17 are for personal use only (KuCoin under D42;
Alpha Vantage, Messari and Santiment under D43). OKX is prohibited (D40). Nasdaq Trader's
question is still open under T-407 (D41). Of the four D55 added, CoinMarketCap is for personal use
only too (D44), and Jito, Rocket Pool and Pendle keep D45's narrow reading, recorded as a
judgement. Each entry keeps those conditions as they were.

**Why these 17 and not the four ruled on later that day.** On 2026-09-30 the sign-off
question came in the same batch as the CoinMarketCap question (D44) and the Jito, Rocket
Pool and Pendle question (D45). So option 1 named the six sources already ruled on and left
out "the four with an open question". Those four were ruled on later that day, and D55
marked them verified once the owner gave that separate yes. Eight more stay seeded for
reasons neither decision touches:

- CryptoPanic: its API terms page would not open.
- Binance.com, HTX and XT.com: they could not be read.
- DefiLlama, Blockchain.com, Stride and Beefy: they publish no terms document.

Yearn is no longer fetched at all.

**alternative.me's verdict moved from approved to conditional.** Its terms allow commercial
use "as long as the attribution is given right next to the display of the data". The
registry uses `conditional` for exactly that: a use that is allowed while a condition holds.
`approved` means no condition. The app fetches nothing differently. The Cycle Context card
already named alternative.me in the caption under the figure. The Market Structure panel
named it only in its header badge, and now also credits it beside the figure. A test checks
both places, and it fails if either credit is removed or the verdict is set back.

**Addresses.** Four `termsUrl` fields now point at the document that was actually read,
instead of an API documentation page:

- **Treasury:** the live policy page the reading found.
- **OKX:** the API Agreement, which the T-005 note asked to have recorded.
- **Nasdaq Trader:** its Copyright & Disclaimer page.
- **KuCoin:** its Terms of Use.

The last three were found by web search on 2026-10-04. This cloud session cannot open those
sites, so each entry says how its address was found and asks for it to be confirmed at the
next reading. A search did not turn up mempool.space's Terms of Service. Its entry still
links the API docs, and its finding names the Terms of Service as the document read.

**Two tests changed with the facts.** Two registry tests measured the Treasury entry's age
from a fixed test date, 2026-08-06. The entry is now dated 2026-09-26, after that date, so
both tests count from the entry's own date instead. The provenance test already worked that
way.

**T-119, closed the same day.** This was a status change on a ledger item, not a new
ruling. T-119 was waiting for the owner's wording for four blank sections on the old How We
Make Money page. That page was replaced when the How we make money section of `/about` was
built (D50, T-293). With no paid links at launch (D49), there are no referral programs to
list or to name a paid entity for. The owner's Draft v1 text covers the rest: who runs the
sites, a complaints route, and a statement that the sites are for people in the United
States. Two things remain, and each already has an item. T-291 tracks the remaining blanks
(company name, contact email) and the owner's approval of the text. T-125 tracks the UK rules
on financial promotions and other countries' rules, parked until paid links are considered
after launch.

**D56: why these two could start alone.** Neither needs the scope boundary or the legal
review. Both work only with the user's own plan, and both show figures the drift check
already puts on screen: how far each holding is from its target, and the dollar trade that
would bring it back. Saving those figures, or printing them, adds no new calculation.

**D56: plan history (T-065).** The drift check now has a **Save this check** button. A
saved check keeps what the plan was compared with, the value used, and each holding's
target, actual weight, drift and trade. The History table under the check lists saved
checks newest first, with the largest drift and its change since the check before, and
whether a rebalance was due. A check that finds the plan inside its bands, after one that
did not, says **Back within bands**. It describes one plan over time and ranks nothing.
The S5 charter calls it the honest version of NT10, the risk-score history RP-4 rejected:
the user's own plan, not market scores.

- **Saving is a button, never automatic.** The ledger proposed saving a check on each
  review. Opening the panel would then save one every time, including checks on
  hand-entered weights that do not add up to 100%. And Mark reviewed, on the plans list,
  can be pressed without any check being run. So a check is kept only when the user
  chooses to keep it, and saving does not mark the plan reviewed.
- **The server stores only what it checks.** Every number is range-checked, unknown fields
  are dropped, and the summaries (largest drift, rebalance due, turnover) are recomputed
  from the rows instead of taken from the browser.
- **Nothing is removed to make room.** One plan keeps up to 500 saved checks. Past that,
  saving is refused with a message, and no older check is deleted, in line with the
  owner's no-deletion rule. Deleting a plan deletes its saved checks with it, as part of
  that plan.
- **It needs a database update on the owner's machine:** `npm run db:migrate` in
  `frontend/` applies migration 0004, which adds the `builder_plan_snapshots` table. Until
  then the History section says to run it, instead of failing.
- **Tested against a real database.** The session installed a temporary Postgres 16,
  applied main's four migrations, and ran the app against it. Before 0004 the saved-checks
  request answered with the `db:migrate` message. `scripts/db-migrate.mjs` then applied
  0004 cleanly on top. A check saved and listed; one with false summaries was stored with
  the true ones; a plan belonging to another user answered "Plan not found"; the 501st save
  was refused with the 500 rows untouched; and deleting the plan removed its saved checks.
  In a browser, both buttons stayed off until the entered weights totalled 100%, a save
  added a row at the top of History, and each click on Print opened the print dialog once.

**D56: printable rebalance notes (T-066).** A **Print rebalance notes** button opens the
browser's print dialog with a one-page sheet: the plan's name, the date, what it was
compared with, the value used, the band, and the drift table. A holding outside its band
shows the trade back to target; the rest show "within band". The sheet ends by saying the
figures are arithmetic, not a recommendation to buy or sell anything, and that they leave
out trading costs and tax. No file is made; the print dialog offers paper or PDF. Both
buttons stay off while hand-entered weights do not total 100%, since a drift check on those
numbers means nothing. The sheet was checked in print mode: only the sheet prints, and the
rest of the app is hidden.

**D57: why parked rather than blocked.** A blocked item waits on a decision that is due; a
parked one waits on a decision the owner has chosen to put off. T-192 waits on two of the
second kind. Per-plan limits need the plans (D29 recorded the August model as a working
plan to be reassessed, and D21 defers pricing), and they need to know which customer is
calling, which needs API keys on `/api/v1` (T-087, parked for the launch-planning session).
Its siblings from the same list, T-188 and T-191, were already parked; T-192 was the odd
one out.

**D57: what the record said, and what is true.** T-192's summary said "Single global limit
today." Measured on 2026-10-04, `/api/v1` has no rate limit and no API keys at all: none
of its 13 routes calls the guards in `lib/server/apiGuard.ts`, whose per-visitor limits
cover other routes, such as the AI agents, provider settings, video search and Pump Report.
That exposes nothing today,
since D22 recorded on 2026-09-23 that no deployed instance exists. The summary now says
this. Two references in the blocker were also unclear. Its "D2" is the P3 production
review's D2 (public API exposure, now T-087), not the 2026-09-14 D2 that froze the
backend. Its "ROADMAP.md:487" now sits at line 728. The old blocker is kept, word for word,
in the parked line.

**D58: what Reddit requires now.** Search results on 2026-10-04 agree that Reddit's
Responsible Builder Policy (updated November 2025, and again June 5, 2026) requires every
developer to request access and get Reddit's explicit approval before reading any Reddit
data through its API, personal projects included. Commercial use needs separate written
approval. This environment cannot open Reddit's own pages, so the owner should confirm it
when the project is picked up. It changes what T-245 asks. The step is no longer "register
an app and set `REDDIT_CLIENT_ID`". It is "apply, describe the live app, and use whatever
route Reddit offers". The owner's reason for waiting follows from that: Reddit can judge an
application better when it can see the app working, and it may offer a better way to reach
the data than the one this app would ask for.

**D58: the trap the old message set.** Until today, both Social routes told the reader to
"Configure REDDIT_CLIENT_ID (OAuth) to read it through the supported path." Setting that
variable alone lifts the robots gate in `pinnedFetch`, but both routes still read Reddit's
anonymous `.rss` feeds, so following the message would have resumed exactly the reads the
gate exists to stop. The messages now say Reddit is not read and why. T-245's next step
already said to build the OAuth reader before setting the variable; its note now also
records that `assertRobotsPermits` reads the credential from the environment only, so a key
saved on the Integrations page would not lift the gate unless that check reads it too.

**D58: what stays as it is.** Reddit is not read, and no code path changes. The crypto and
stock Social pages run without it: StockTwits, plus LunarCrush and Santiment when their keys
are set.
