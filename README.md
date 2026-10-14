# BACKGROUND

## STACK RATINGS

- TypeScript 3
- Next.js 2
- NestJS 2
- Prisma 1
- PostgreSQL 3
- WebSockets 2
- Tailwind 2
- JWT/auth 3
- multi-tenant data isolation 2

## FIVE SHORT ANSWERS

**1. What part of our stack are you strongest with?**
<br>Javascript which is what lies below Typescript

**2. What part would be the steepest learning curve?**
<br>Prisma and multi-tenant data isolation

**3. Any tech not in our stack you consider a core strength?**
<br>C#, CLient-Server architecture

**4. What kind of work do you most want to do day-to-day?**
<br>Assist the team, clarify requirements and doubts, help with research, remove blockers, solve problems

**5. What do you most want to avoid?**
<br>Repeated meetings about the same topic

## LLM Usage

Claude was used to create the application based on the INITIAL_PROMPT.md file, using the Opus 5.5 model with Medium effort. It drove the development with manual review and validation from human side. The INITIAL_PROMPT.md file was written manually referencing the provided document

---

# Trader Daily Snapshot

A real-time daily snapshot for futures traders: open positions, day P&L and a risk score, scoped to the trader and their broker (tenant).

## Run it

```bash
docker compose up --build
```

| | |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend | http://localhost:4000 |
| Tests (unit + Postgres RLS + socket isolation) | `docker compose --profile test run --rm backend-test` |

On first start the backend applies migrations, loads `dataset/` and starts serving. Nothing else is required. Postgres is not published to the host.

### Demo logins

Every seeded trader uses the password `demo-password`. Some useful ones:

| Email | Broker | What you'll see |
| --- | --- | --- |
| `elena.vasquez@summitprop.example` | Summit (prop) | Two accounts. SMT-200001 is at **94 risk** with the high-risk banner. |
| `d.ferrer@meridianfg.example` | Meridian (prop) | Zero balance with an open MNQ position, so risk is pinned at 100. |
| `sarah.chen@gmail.com` | ArrowFin Retail | Funded and demo accounts, an open MCL position, a busy session. |
| `h.whitfield@meridianfg.example` | Meridian (prop) | A funded account plus a **closed** account. |
| `a.karim@meridianfg.example` | Meridian (prop) | Funded and never traded, so the page shows its empty state. |
| `r.boedecker@summitprop.example` | Summit (prop) | KYC suspended, so login is refused. |

### Fake live fills

With the page open, post a fill to the dev-only endpoint:

```bash
curl -X POST http://localhost:4000/dev/fills -H 'content-type: application/json' \
  -d '{"account_id":"ACC-1006","instrument_symbol":"MES","side":"BUY","quantity":2,"price":5643.25,"commission_usd":1.40}'
```

You can also run `./scripts/simulate-fills.sh ACC-1006` (bash) or `.\scripts\simulate-fills.ps1 -Account ACC-1006` (PowerShell) for a fill every 2 seconds. Post a fill for another broker's account (for example `ACC-1001`) and Elena's page does not move. To see the reconnect handling, run `docker compose stop backend` with the page open: it goes **STALE** and dims. Run `docker compose start backend` and it re-syncs, including any fills that landed while it was down.

## Layout

```
backend/                       NestJS, hexagonal
  src/domain/                  pure TS, no framework: P&L fold, session window, risk formula
  src/application/             use cases + ports (SnapshotReadPort, FillWritePort, FillEventPublisher, Clock)
  src/infrastructure/          adapters: Prisma repos + RLS transaction, Socket.IO gateway, JWT, clock
  src/interface/http/          controllers: GET /api/snapshot, POST /auth/login|logout, POST /dev/fills (dev only)
  prisma/schema.prisma         schema + index rationale
  prisma/migrations/0002_*     Row-Level Security policies, least-privilege grants
  prisma/seed.ts               CSV loader (drops the PII columns it doesn't need)
  test/                        28 tests
frontend/                      Next.js 15 App Router, Tailwind 4, TanStack Query
  app/page.tsx                 snapshot page (loading / error / empty / stale states)
  hooks/useLiveSnapshot.ts     REST query + socket lifecycle + reconnect re-sync
  lib/socket.ts, lib/merge.ts  socket client, seq-guarded merge of pushed updates
docker-compose.yml             db + backend + frontend (+ test profile)
SECURITY.md                    Task 3
```

## How the numbers are computed

These choices are in `backend/src/domain/snapshot-calculator.ts` and pinned by `test/snapshot-calculator.spec.ts`:

- **"Now" is 2026-08-25T14:30:00Z**, the dataset cut. The clock starts there when the backend boots and then runs in real time, so simulated fills get increasing timestamps (`SNAPSHOT_NOW` in compose).
- **"Today" is the CME Globex session**: 17:00 to 16:00 America/Chicago, computed with the time zone so it follows DST. For the dataset cut, that is `2026-08-24T22:00Z` to `2026-08-25T21:00Z`. It is not a UTC calendar day.
- **Positions** use weighted-average cost over all fills up to now, so a position carried in from a prior session still shows. Partial fills of one order are separate executions and fold correctly one by one. A flip through zero realizes the closed part and reopens the rest at the fill price.
- **Day P&L** = realized P&L from closes inside today's session + unrealized P&L on open positions at the mark − today's commissions. Every USD figure is multiplied by `point_value_usd`, so 1 point of ES is $50 and of MES is $5. `commission_usd` is already the per-fill total. Money math uses `decimal.js`, not floats.
- **Risk** = `min(100, |gross notional| / balance × 100)`, computed **per account**. Gross means `Σ |qty| × mark × point value`, so a long ES against a short NQ can't net to "no risk". A zero balance with an open position scores 100 rather than dividing by zero. A score above 75 is the high-risk state.
- Closed, restricted and demo accounts are shown, labeled, and never mixed into another account's numbers.
- Known limitation: the dataset has no prior-session settlement price, so a carried-in position's unrealized P&L is measured from its cost, not from yesterday's settle. The seed data has no carried-in positions at the session open, so the numbers shown are exact for this dataset.

**The index.** `fills(broker_id, account_id, filled_at)`. The snapshot query is `broker_id = ? AND account_id IN (…) AND filled_at <= now ORDER BY filled_at`. `broker_id` leads because RLS adds that predicate to every query on the table. `account_id` narrows the scan to this trader's accounts. `filled_at` turns the session window into a range scan that is already in the order the P&L fold needs, so there is no sort and no touching other tenants' rows.

## Reconnect behavior

The client never trusts that the stream was continuous. The server emits `ready` **after** it has joined the socket to its tenant room. On every `ready`, both the first connect and each reconnect, the client re-fetches `GET /api/snapshot`. Anything committed before the join is in that response; anything after it arrives on the stream. Every pushed event carries the fill's database `seq`, and each account in the snapshot carries `lastFillSeq`. The client applies a pushed update only if its `seq` is newer than what it holds, and re-applies newer pushed state on top of a slower refetch, so a refetch that races an event can't roll numbers backwards. While the socket is down, the page shows **STALE**, an amber "may be stale" banner, and dims the figures. During the re-fetch it shows **RESYNCING**. It returns to **LIVE** only once the re-fetch succeeds.

Where it can still be stale, honestly: (1) a half-open connection, where the network dies without a TCP close, is only noticed when Socket.IO's ping times out, which takes up to about 45s with the defaults. During that window the page says LIVE while missing fills. (2) Fills missed while offline are reflected in the numbers after the re-sync, but not replayed into the "Live fills" tape. (3) `seq` is a global sequence, not a per-trader one, so the client can't detect a gap mid-stream from `seq` alone. With a second day I'd add a per-trader sequence, an app-level heartbeat carrying the server's latest seq, and a `GET /api/fills?sinceSeq=` replay endpoint.

---

## Architecture & handoff reflection

**The decision I'm most proud of, and what it cost.** I enforced tenant isolation in Postgres itself, not only in application code. The app connects as a role that is neither owner nor superuser. Every request runs in a transaction that sets `app.broker_id` from the verified JWT, and FORCE'd Row-Level Security policies filter every tenant table on it. Composite foreign keys stop a fill or account from claiming a different broker than its parent. The result is that a forgotten `WHERE broker_id = ?` returns the right rows anyway, and bypassing the tenant helper returns *no* rows instead of everyone's. There is a test for both against the real database. The cost is real: every read is an interactive transaction with an extra round trip and holds a pooled connection for its whole duration. There are two database roles and two connection strings to manage. Login and the dev simulator need `SECURITY DEFINER` escape hatches. And debugging "why is this query empty?" is less obvious to someone who doesn't know RLS is there.

**What I'd change with a second day.** I would stop recomputing positions by folding a trader's whole fill history on every request and every pushed fill. That is fine for 687 rows and wrong for a real book. I'd add a `positions` projection plus a per-session opening snapshot with settlement prices, updated incrementally in the same transaction that inserts a fill. That makes the snapshot O(open positions), fixes day P&L for positions carried overnight (the known limitation above), and gives each trader a gap-free sequence, which makes reconnect replay exact instead of "re-fetch and trust".

**If I handed this to two engineers tomorrow.** First I'd tell them to read `SECURITY.md` section 2 and run `docker compose --profile test run --rm backend-test` before touching anything. Then I'd tell them the shape: all trading math lives in `backend/src/domain/` as pure functions with tests, and controllers, Prisma and Socket.IO are adapters around it, so a P&L change should come with a domain test and no framework code. What I would not let them change without a review from me: the tenant path. That means `PrismaService.withTenant()` as the only way to reach tenant tables, the app running as the RLS-restricted `snapshot_app` role (never the owner URL, never a superuser), no new tenant table without an RLS policy in the same migration, and the socket design where rooms come only from the verified token and there are no client-initiated subscribe messages. Those are the guarantees that make cross-broker leakage a database error instead of a code-review miss, and each one is a single line to undo.
