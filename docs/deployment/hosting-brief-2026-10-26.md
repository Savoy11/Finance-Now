# Hosting brief — where to run Finance Now (T-112)

**Status:** draft, 2026-10-26, for the owner's planning session. Nothing is chosen, provisioned
or spent. Prices were read from each provider's own pricing page on 2026-10-26 unless marked as
an estimate. They change often, so re-read them before signing up.

**Why this exists.** Choosing a host is the gate behind more parked work than any other. 46
ledger items wait on it: 14 need only the host chosen, 26 need the host and something else
(a paid plan, counsel, an email provider, or the rollout ruling, D1), and 6 are about locking the
public API. The roadmap names three paths (Vercel with a hosted database, a rented server, or
the AWS setup already in `infrastructure/`; D78), but nothing compared them. This brief does, and
it lists what the app needs on any host first.

## 1. The short version

- **The app as built is a single, long-running Node process with a disk.** It writes three files
  as it runs, keeps rate limits in memory, and runs AI requests of up to two minutes. A host
  that runs one container with a persistent disk fits it unchanged. A serverless host (Vercel)
  fits it after a small amount of work.
- **The AWS setup in the repository is not a ready option.** It was written for the backend that
  D2 retired, its routing sends the app's own `/api` routes to that backend, and it costs about
  **$1,350 a month per copy** before a $3,000-a-month add-on it switches on but does not count.
- **Recommendation: Railway's Pro plan**, about **$20–35 a month** for the app and its database
  (estimate). It runs the app's existing Dockerfile with a persistent disk and a hosted
  Postgres. Moving to a rented server later is the same container. A rented server (option C)
  is the cheaper choice for an owner who is happy to look after one.
- **Before any host:** a test copy anyone else can open counts as launch under D22, and it puts
  the app outside four providers' licences at once. A test copy must be locked to the owner
  until launch. There is also a short list of work that every host needs (section 4).

## 2. What the app needs from a host

Each line was checked in the code on 2026-10-26.

| Need | Where | What it means for a host |
|---|---|---|
| **A disk that keeps what is written** | `frontend/src/lib/api/live/providers.ts` writes `.provider-config.json` (provider keys saved on the Integrations page, and each provider's last fetch, on every data request); `lib/agents/config.ts` writes `.agent-prompts.json`; `lib/server/affiliateClicks.ts` writes `.affiliate-clicks.json` | On a serverless host these writes vanish between requests. Keys can come from environment variables instead, but saving them on the Integrations page, prompt overrides and click counts would not stick |
| **One long-lived process** | Rate limits and the daily YouTube budget in `lib/server/apiGuard.ts`; caches in `staking-discovery` and `lib/server/assetRatingRoute.ts` | With several copies of the app running, each keeps its own limits, so a limit of 6 a minute becomes 6 per copy |
| **Requests of up to two minutes** | `/api/agents/research` allows 120 s; measured runs reach 96 s (equity diligence). The Pump Report's investigate route streams for about 85 s | Fine on a container. On Vercel's Pro plan the limit is 300 s by default |
| **Node, not an edge runtime** | `pinnedFetch` pins DNS through undici and `node:dns`; AES and bcrypt through `node:crypto`; Node 24 or later | Every option here runs Node |
| **Postgres** | `lib/db/index.ts`: one connection string, a pool of 10, plain Postgres, 10 migrations | Any hosted Postgres works. Behind a connection pooler (Neon's or Supabase's pooled address) the driver needs `prepare: false`, and `ssl` should be required (T-189) |
| **No scheduled jobs** | None in the app; every schedule runs in GitHub Actions | Nothing to set up |
| **Outbound requests to ~50 data sources** | LunarCrush blocks datacenter addresses; Reddit refuses them without OAuth (and is off by the app's own robots check anyway) | Every option here sends from a datacenter address. Expect LunarCrush to stay off on any host. No source has been measured from a hosting provider's address yet: run `npm run audit` from the test copy first |
| **The MCP server** | `mcp-server/` runs on the user's own machine and calls `/api/v1` | Needs no hosting |

## 3. The options

| | A. Vercel Pro + Neon | B. Railway Pro (recommended) | C. A rented server | D. AWS (`infrastructure/`) |
|---|---|---|---|---|
| **What it is** | Vercel runs the app as serverless functions; Neon is a hosted Postgres | One container from the app's Dockerfile, a persistent volume, and Railway's Postgres, in one account | A server (for example DigitalOcean) running the container and Postgres with Docker Compose, with Caddy for HTTPS | Kubernetes (EKS), Aurora Postgres and Redis, from the repository's Terraform |
| **Monthly cost** | Vercel $20 (includes $20 of usage) + Neon from $0, usage-based ($0.106 per compute-hour, $0.35 per GB-month, sleeps when idle). **About $25–45** (estimate) | $20 (includes $20 of usage); about $20 per vCPU-month and $10 per GB of memory beyond that. **About $20–35** (estimate) | Server $12 (2 GB) or $24 (4 GB), backups $2.40–4.80; Postgres on the same server, or DigitalOcean's managed Postgres from about $15. **About $15–45** | **About $1,350 per copy** at the committed settings (`docs/deployment/aws-provisioning.md`), double for a test copy and the live site. Plus Shield Advanced, which `ingress.yaml` switches on: $3,000 a month, one-year commitment |
| **Free plan usable?** | No: Vercel's free Hobby plan is "non-commercial, personal use only" | No: Railway treats Hobby as personal, non-commercial | — | — |
| **Fits the app as built** | No. The three file stores and the in-memory limits need moving to the database first (a few days' work, estimate) | **Yes.** The volume keeps the three files; one instance keeps the limits | **Yes**, the same way | No. Its ingress and nginx send `/api` to the retired backend, it checks a health route that does not exist, and its read-only filesystem blocks the three files |
| **Work for the owner** | Least: deploys on every merge, renews certificates, has a firewall and deployment protection | Little: deploys from GitHub, renews certificates, backs up Postgres | Most: operating-system updates, the firewall, HTTPS, backups (a scheduled `pg_dump`) and restarts are the owner's | Most, and the Terraform has never been applied or validated |
| **Locking a test copy to the owner** | Built in (Vercel Authentication, on every plan) | No built-in login: use the app's own admin token, or keep the service off a public address | A password or an address allowlist in Caddy | The WAF, or an internal load balancer |
| **Database backups (T-341, 7 days)** | Neon: up to a 7-day restore window on Launch | Railway's volume backups; not checked for this brief, so confirm the retention on the Pro plan, or add a scheduled `pg_dump` | A scheduled `pg_dump` to separate storage | Aurora: `rds_backup_retention_days = 7`, already set |
| **Leaving it later** | Code moves from the database-backed stores back to any host | Same container runs on C or D | Same container runs on B or D | — |

**Why B over A.** A is the least upkeep, but it is the only option that needs the app changed
first, and it splits the app and the database across two companies. **Why B over C.** C is the
cheapest and the most portable, but a solo owner then looks after a server: updates, backups,
restarts. B costs a few dollars more and takes that away. **Why not D now.** It is sized for the
retired backend and for scale the app does not have. Its Redis, about $451 of the $1,350, serves
only that backend: the frontend has no Redis client. It stays the path for later, "if scale
demands" (the roadmap).

**On D21 (no paid decision before late production, no provider load-bearing).** Every option is
paid, so the choice itself is the owner's at planning. B and C keep the app portable: the same
container moves between them, or to D, with no code change. A is portable too once the file
stores are in the database.

## 4. Work every host needs first

These are app changes, not host settings, and they are the same whichever host is chosen. None
is started.

1. **Lock any test copy to the owner until launch.** Under D22 the first page load by anyone else
   is launch, and a reachable test copy counts. That takes the app outside the free licences of
   FMP, Finnhub and Twelve Data (D164 for FMP), and NewsAPI's free plan cannot be used "in a
   staging or production environment" at all (D106). Locked to the owner, a test copy stays
   personal use (D96).
2. **Make the owner's tools work off localhost.** Without `FN_ADMIN_TOKEN`, the AI agents, the
   Pump Report, the Integrations page, prompt editing and video answers answer 403 on any host
   but localhost. With it set they answer 401, because no page in the app sends the token
   (`lib/server/apiGuard.ts`). The fix is either a way for the owner's browser to send it, or
   tying those routes to a signed-in owner once sign-in is on (T-131).
3. **Decide who the user is.** A production build turns off the shared local account
   (`lib/auth/session.ts`), and sign-in is switched off (`REQUIRE_AUTH = false`,
   `LOGIN_DISABLED = true`). So on a host, portfolios and watchlists have no user unless
   `FN_ALLOW_LOCAL_USER=true`, which gives every visitor one shared account. For a test copy
   locked to the owner that is acceptable. For launch it is T-131 and T-132.
4. **Set what Auth.js needs off Vercel:** `AUTH_TRUST_HOST` or `AUTH_URL`, plus `AUTH_SECRET`
   (T-339).
5. **Require SSL to the database (T-189).** Add `prepare: false` if a pooled address is used.
6. **Add a health route** for the host's checks and the outside uptime check (D74). The app has
   none: the Kubernetes files probe `/api/health`, which does not exist.
7. **Decide the public API's exposure before launch (T-087).** `/api/v1` has no key and no rate
   limit, with CORS open to every site, and it runs on the owner's provider keys.

## 5. What choosing a host releases

Once the host is chosen, these 14 parked items can proceed with no other decision:

| Item | What it is |
|---|---|
| T-112 | Set up the host, rate limiting and monitoring, with an outside uptime check (D74) |
| T-363, T-368 | Set up the locked test copy, and check an automatic deploy reaches it |
| T-366 | Decide whether to stop at a test copy or add the live site |
| T-367 | The deploy-notification secrets |
| T-378 | Replace the `financenow.example.com` placeholders once a domain is bought |
| T-204 | A web firewall in front of the site |
| T-205 | An activity log on the hosting account, with alerts |
| T-339, T-340 | Fresh `AUTH_SECRET` and `FN_ADMIN_TOKEN`, and the provider keys, in the host's secret store |
| T-341 | Database backups, 7 days at least |
| T-342 | Certificate renewal |
| T-189 | SSL to the database |
| T-260 | Trusting the right forwarding header behind the host's proxy |

Then, with something else as well:
- **The spending level (T-365).**
- **Insurance (T-427),** which must be in place before the first outside visitor.
- **An email provider (T-133, T-435).**
- **A penetration test and MFA on every admin account (T-206, T-209),** after the security items
  D73 lists.
- **The rollout ruling's items (D1).**

The SOC 2 and business-tier items stay parked until the first paying customer (D5).

## 6. Decisions for the planning session

1. **Which host:** A, B, C or D.
2. **A test copy only, or the live site too (T-366).** A test copy locked to the owner can run
   now without crossing D22.
3. **A domain name (T-378):** about $10–15 a year at any registrar (estimate).
4. **The spending cap:** Vercel and Railway both let you set a limit; Vercel's default is $200.
5. **Whether to clean up the AWS files.** Its Terraform, Kubernetes files, monitoring and both
   deploy workflows still describe the retired backend, and `ingress.yaml` switches on Shield
   Advanced. If D is not chosen, mark them as not in use, so nobody applies them by mistake.
   The no-deletion rule stands: mark them, never remove them.

## Sources

- In the repository: `docs/deployment/aws-provisioning.md` (the $1,350); the files `infrastructure/terraform/`,
  `infrastructure/kubernetes/ingress.yaml`, `infrastructure/kubernetes/frontend/deployment.yaml`,
  `infrastructure/docker/`, `frontend/Dockerfile`, `.github/workflows/cd-staging.yml` and
  `cd-production.yml`; D1, D2, D21, D22, D73, D74, D78, D82, D88, D96, D106, D164; the ledger items
  named above.
- Prices, read 2026-10-26:
  - [Vercel pricing](https://vercel.com/pricing), [Vercel Hobby plan](https://vercel.com/docs/plans/hobby) and [Vercel function limits](https://vercel.com/docs/functions/limitations).
  - [Neon pricing](https://neon.com/pricing).
  - [Railway pricing](https://railway.com/pricing) and Railway's [answer on Hobby and commercial use](https://station.railway.com/questions/commercial-usage-using-hobby-plan-7fd8cf69).
  - [DigitalOcean droplet pricing](https://www.digitalocean.com/pricing/droplets) and [AWS Shield pricing](https://aws.amazon.com/shield/pricing/).
