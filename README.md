# Finance Now — Multi-Asset Financial Analytics

[![CI](https://github.com/Savoy11/Finance-Now/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Savoy11/Finance-Now/actions/workflows/ci.yml?query=branch%3Amain)

**An AI-enhanced investment evaluator, and the flagship module of a growing suite of financial analysis tools.**

Finance Now evaluates crypto assets — stablecoins, Layer 1s, tokenized assets, and CBDCs — by combining live multi-provider market data, reserve transparency monitoring, regulatory news intelligence, and a configurable AI agent layer into a single Bloomberg-terminal-style workspace. It is built on a strict data-honesty principle: **every number is attributed to its source, estimates are labeled as estimates, and derived metrics with no reliable data source show "not available" rather than fabricated values.**

Finance Now is one module in a larger suite. The same shell hosts entitlement-gated modules for Equities, Macro Markets, ETFs & Funds, and a Portfolio Builder — one application, one auth layer, individually licensable modules. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## The Suite

| Module | Scope | Status |
|---|---|---|
| **Crypto (Finance Now)** | 108 catalogued assets: reserves, peg tracking, fees, staking, TA, news, scanner | 🟢 Active — flagship |
| **Equities** | 79 large-caps across 11 sectors: live quotes, breadth, screener, TA, news, calendar | 🟢 Active |
| **ETFs & Funds** | Fund registry (126: 114 ETFs + 12 mutual funds) and per-symbol detail | 🟢 Active |
| **Macro Markets** | Commodities, currencies, bonds/rates: 45 instruments, official yield curve, two-tier FX converter | 🟢 Active |
| **Portfolio Builder** | Cross-module portfolio construction | 🟡 Early |
| ~~Budgeting & Planning~~ | Accounts, budgets, net worth, goals | ⚪ **Moved to a separate product, 2026-08-20.** Owner decision — personal-finance tooling is being built elsewhere. The pages, routes and `lib/budget/` are deleted; the DB tables are deliberately RETAINED so no migration drops imported bank history. Reverses RP-2 via its recorded reopen trigger |

Modules are declared in `src/lib/modules/registry.ts`; the sidebar renders from the registry and modules toggle in **Integrations → Suite Modules**.

---

## The AI Layer

Finance Now is agent-native, in two directions:

**AI working for you inside the app.** Eleven configurable agents (Settings → AI Agents / the AI Agents tab), each with an editable system prompt, model, and temperature — shared assistant, crypto research/scraper/pump-report pair, four equity agents, and two macro agents:

- **App Assistant** — platform-wide helper that navigates and interprets data
- **Research & Analysis** — deep dives on assets and markets
- **Data Scraper** — structured data gathering
- **Pump Report** — anomaly and momentum reporting

Plus a **Daily Brief** generated from your holdings, live prices, and headlines. All agents are **BYOK** (bring your own key) across 10 LLM providers — Anthropic, OpenAI, Google, Mistral, Groq, xAI, DeepSeek, Perplexity, Together, Cohere. Keys go in `frontend/.env.local`; nothing is proxied through third parties.

**The app working for AI.** The platform exposes a clean REST `/api/v1` surface with OpenAPI documentation and an **MCP server** (`mcp-server/`), so external AI agents — Claude, or anything MCP-capable — can query Finance Now's data directly. If you use AI to manage your research, Finance Now is built to be one of its tools.

---

## Feature Status (honest)

Verified against the running application, July 2026. **Rows corrected 2026-09-08** against `CLAUDE.md`'s feature inventory and `DATA-AVAILABILITY.md` — the July table had gone stale on six of them, three in ways that overstated what ships.

| Feature | State |
|---|---|
| Live market data | 🟢 108 crypto assets via CoinGecko + CoinMarketCap + Binance, 3-way fallback |
| Reserve Transparency Monitor | 🟢 Live DefiLlama supply + attestation metadata for 9 stablecoins |
| Transfer Fee Calculator | ⚪ **Hidden from the initial rollout (2026-08-22)** — kept, not deleted; `/transfer-fees` redirects. 30 exchanges × 22 coins × 18 networks from a staleness-labelled static table, plus a live withdrawal-fee overlay and live BTC/EVM-L1 gas |
| Staking Explorer | 🟡 55 providers with a custody-risk taxonomy, plus a live on-chain pools tab. Live-APR **wiring** covers 33 distinct rate keys — native endpoints (Lido, Rocket Pool, Marinade, Jito, Stride, and per-chain natives) plus a keyless DeFiLlama Yields rung mapping 25 more. That audit has now been run (2026-09-10): **27 of 51 rates are live**, up from 4 of 51. The old ratio was not stale docs and not dead upstreams — four dead hosts were hanging DNS for ~10s each and starving the route's shared budget, so healthy sources aborted before they could answer. Removing them fixed it. The remaining 24 have no upstream publishing a rate at all; each is labelled a static estimate and now says WHY on hover |
| Technical Analysis | 🟢 Live OHLCV, 62 indicators (shared registry), patterns, drawing tools, and a separate Scanner page per section. **The backtester is hidden** (2026-08-20, owner: "I may revisit back testing") — every engine and panel is retained in place |
| News & Analysis | 🟢 7 providers with sentiment + asset tagging, incl. US Congress bill tracker |
| Equities & Funds | 🟡 **Key-gated since the Yahoo removal (2026-08-06).** Every live quote rung needs an API key; with none configured, stocks and funds show catalog reference prices behind an amber `ref` tag rather than a fabricated number. Screener fundamentals are reference data; P/E is backfilled free from SEC XBRL |
| AI agents + Daily Brief | 🟢 Working with any configured provider key |
| Safety Score (per-coin composite risk) | ⚪ **Removed 2026-08-29 (RP-6).** No per-coin risk score is published anywhere: a risk figure on an asset the reader is viewing may be read as a recommendation, which is a regulated activity. The scoring framework in `lib/risk/` remains and still powers the options Trade Risk Scorer, staking-provider risk and the macro/equity profiles — see `docs/architecture/risk-scale-spec.md` |
| Authentication / multi-tenancy | 🟡 Login scaffolded, deliberately disabled during single-user development |

---

## Running the Application

The frontend runs **live-only** against public data providers through its own server-side `/live-data/*` proxy routes (no API keys exposed to the browser, no mock/demo mode). Surfaces with no free real-time source say so explicitly.

### Frontend (recommended)

```bash
cd frontend
npm install
npm run dev
```

**No configuration is required to run it.** The app is live-only against keyless
public providers; every surface with no reachable source says so rather than
inventing a figure. To unlock the key-gated ones:

```bash
cp .env.example .env.local   # every variable annotated with what it unlocks
```

The ones worth setting first:

```
# AI agents & Daily Brief (any one provider is enough)
ANTHROPIC_API_KEY=...

# Live stock / fund / macro quotes — all rungs are key-gated since the
# Yahoo Finance removal (2026-08-06, terms grounds). Without one of these,
# stocks and funds show catalog reference prices behind an amber `ref` tag.
FMP_API_KEY=...
```

`NEXT_PUBLIC_WS_URL` was listed here and no longer exists — the app opens no
socket (removed in M8). `NEXT_PUBLIC_API_URL` is optional and points at the
dormant legacy backend; set the **origin only**, with no `/api` suffix.

Open [http://localhost:3000](http://localhost:3000). Windows users: `start.bat` at the repo root.

### ⚠ If data is missing, check your VPN first

**A VPN or proxy can block some data sources, and the app cannot tell that apart from
a source being down.** Several providers refuse traffic from VPN, proxy and datacenter
IP ranges — it is a common anti-scraping measure, and Bitcoin infrastructure in
particular does it aggressively. The block is usually silent: the connection is dropped
rather than refused with an error, so the app waits out a timeout and falls back to a
labelled estimate exactly as it would if the provider were offline.

This is not hypothetical. On 2026-09-10, with a commercial VPN active:

| | VPN on | VPN off |
|---|---|---|
| Bitcoin network fee (mempool.space) | fell back to an estimate | **live** |
| Time to load the fee page | **~11 seconds** (waiting out a timeout) | **0.13 seconds** |

⚠ **It can also cut the other way.** Turning that VPN off fixed Bitcoin fees and cost
us a different provider, which rate-limits per IP and had been absorbing our requests
across the VPN's shared address pool. There is no single setting that is right for
every source — only a trade-off worth knowing about.

**Check what the internet sees:**

```bash
curl -s https://api.ipify.org
curl -s "http://ip-api.com/json/<that-ip>?fields=isp,org,proxy,hosting"
```

If `proxy` or `hosting` reads `true`, you are not being seen as a residential user, and
some sources will treat you accordingly. Turning the VPN off, or excluding these hosts
from it (split tunnelling), restores them.

None of this fabricates a number: a blocked source shows a labelled estimate or an
explicit "not available", the same as any other unreachable provider. It just means
**"not available" may be about your network rather than the data.**

### Full stack with Docker (optional backend)

The FastAPI + TimescaleDB + Redis backend supports auth and agent persistence; it is not required for the live dashboards.

```bash
cp backend/.env.example backend/.env   # backend secrets; edit before starting
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

The compose file supplies its own defaults for every variable it reads
(`${VAR:-default}`), so it starts without an env file. There is deliberately no
`infrastructure/docker/.env.example` — this line used to tell you to copy one
that has never existed. Set `COINGECKO_API_KEY` and friends in your shell if you
want the container to pick them up.


| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API + Swagger | http://localhost:8000 · /docs |
| TimescaleDB | localhost:5432 |
| Redis | localhost:6379 |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript strict, Tailwind CSS, Recharts + lightweight-charts, Zustand, TanStack Query v5 |
| AI layer | Multi-provider LLM (BYOK), agent prompts in `src/lib/agents/prompts.ts`, MCP server in `mcp-server/` |
| Backend (optional) | FastAPI, SQLAlchemy async, Pydantic v2, TimescaleDB, Redis |
| Data providers | CoinGecko, CoinMarketCap, Binance, DefiLlama, mempool.space, NewsAPI, GNews, CoinDesk, Cointelegraph, Decrypt, Bitcoin.com, US Congress |
| Infrastructure | Docker Compose; Kubernetes/Terraform scaffolding for later scale |

---

## Data Honesty Principles

1. Every metric displays its source; provider utilization is inspectable in Integrations.
2. Estimates and reference values are labeled (`estimate`, `reference`) — never passed off as live.
3. Derived analytics without a trustworthy source display **N/A**, not simulated values.
4. Stale curated datasets carry dated low-confidence warnings.
5. Failed providers degrade honestly: hard failures return explicit `ok:false`/5xx envelopes, and routes with a reference catalog fall back to it **with provenance labeling** (`source` fields, amber `ref` tags, the REAL-vs-FALLBACK audit harness) rather than pretending to be live.
6. **Availability is partly a property of your network, and the app says so rather than
   guessing.** A source blocked by a VPN, a proxy or a corporate firewall is
   indistinguishable from a source that is down — both drop the connection. So a missing
   figure is never presented as "this data does not exist"; it is presented as "we could
   not get this", with the reason where we know it. See "If data is missing" above.

---

## Disclaimer

Finance Now is an information and research tool. Nothing it displays or generates — including AI agent output and risk evaluations — is financial, investment, or legal advice. Verify all fees, rates, and reserve claims with primary sources before transacting.
