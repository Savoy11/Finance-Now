# Finance Now MCP Server

A standalone [Model Context Protocol](https://modelcontextprotocol.io) server exposing
Finance Now's data tools to Claude and any MCP-compatible agent. It calls the running
frontend's `/api/v1/*` endpoints — **Finance Now must be running** (default
`http://localhost:3000`).

This README existed only as a dangling reference until 2026-08-16 (review finding A7);
the canonical, always-current documentation is the **"MCP Server" section of the repo
root `CLAUDE.md`** — if this file and that section disagree, trust CLAUDE.md.

## Setup

```bash
npm install
npm run build
```

## Configuration

One environment variable:

| Variable | Meaning | Default |
|---|---|---|
| `FN_BASE_URL` | Base URL of the running Finance Now frontend (legacy `CAEP_BASE_URL` still honored) | `http://localhost:3000` |

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "finance-now": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": { "FN_BASE_URL": "http://localhost:3000" }
    }
  }
}
```

### Claude Code

```bash
claude mcp add finance-now node /absolute/path/to/mcp-server/dist/index.js
```

## Tools (9)

Market data — crypto: `get_coin_prices`, `list_exchanges`,
`get_network_fees`, `get_staking_opportunities`,
`get_crypto_news`. Securities & macro: `get_security_quotes`, `get_security_history`,
`get_yield_curve`, `get_fx_rates`.

⚠ **`score_options_trade` is withheld** (2026-10-04, owner decision D64). Every
risk rating the app shows is off until the risk engine is rebuilt and the compliance
research on whether and how risk can be rated is done, so the tool is commented out
in `src/index.ts` and `/api/v1/options/score` answers 503. Kept, not deleted:
un-comment the tool block to restore, together with the app's switch in
`frontend/src/lib/risk/visibility.ts`.

⚠ **`compare_staking_risk` was REMOVED** (2026-09-14, owner decision D14) — deleted,
not withheld like `find_transfer_routes` below. It printed a side-by-side table of
composite Safety Scores across providers, which is a leaderboard delivered through
MCP: the surface RP-3 rejected in the app, reaching the same reader by another route.
Its upstream (`/api/v1/staking/opportunities`) no longer serves `safetyScore`, `band`,
`riskScore` or `riskLevel` at all, so there is nothing to restore it to. An agent asked
to compare providers can still read the facts from `get_staking_opportunities`
(APY, lock-up, custody model, TVL) and explain the differences — without this server
publishing a ranking. (The six risk dimensions this sentence once pointed to went
too, under D26 on 2026-09-25.)

⚠ **`find_transfer_routes` is withheld** (2026-08-22, owner decision): the Transfer
Fee Calculator is kept but held out of the initial rollout while its fee table
completes verification, so the tool is commented out in `src/index.ts` and
`/api/v1/transfer/routes` answers 503. An agent relaying a 447-day-old withdrawal
fee to a user is the same harm as the app's own page showing it. Un-comment the
tool block to restore.

⚠ **`run_audit` was REMOVED** (2026-10-04, owner decision D68). It was a maintenance
tool, not market data: it ran the TypeScript checker on the machine hosting this
server, called eight live-data routes and read the frontend's code files. Where
TypeScript is not installed, `npx` downloads a package and runs it without asking,
because this server has no terminal to ask in, so anything that could get an agent to
call the tool could set that off. It also worked only inside a full checkout of the
repository, and one of its eight checks had been wrong since 2026-09-30 (the
funding-rates route lost its only source under D40). Its jobs are done elsewhere: CI
type-checks and lints every pull request, and `npm run audit` in `frontend/` tests the
live-data routes and tells real data from fallback.

This server is now **data-only**: every tool reads Finance Now's `/api/v1` and nothing
else, and `frontend/src/lib/server/__tests__/mcpDataOnly.test.ts` fails if a tool that
runs a program or touches files appears. That settles the P3 review's D5, which kept
this server on the development machine because of `run_audit`. Offering the server to
other people is still its own decision (T-094 in the ledger).

## Conventions the tools follow

- Staking results carry **no risk score, rating or dimension** of any kind: D14
  removed the composite scores and D26 the six per-provider risk dimensions. Each row
  gives APY, lock-up, custody model, receipt token, TVL and audit count, and rows are
  ordered by APY. They are facts, not a recommendation.
- `aprSource` distinguishes `live` (provider-published feed), `derived` (our estimate
  anchored to the Lido feed), and `estimate` (curated catalog).
- Reference (non-live) security quotes are flagged, never silently mixed with live.
