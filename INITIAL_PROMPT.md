# PROBLEM STATEMENT

Create a full stack application to create a **Trader Daily Snapshot** that updates in real time and it must show:
- Open positions
- Day profit & loss (P&L)
- Simple risk indicator

# TECH STACK

- Frontend: Next.js 15+ (App Router), TypeScript, Tailwind CSS, TanStack Query
- Backend: NestJS (Hexagonal / Clean Architecture preferred), Prisma ORM, PostgreSQL
- Real-time: WebSockets (Socket.IO or native ws is fine)
- Caching/Sessions: Redis (optional)
- Use docker to create containers to handle the Backend and the Frontend

The whole system should be loadable with a single command

# BUSINESS SCENARIO

- There are two types of users:
    - Retail traders
    - Prop firms

- The broker_id is the tenant key
- Cross-broker access is a P0 bug
# DATA

For the data, use the files in the dataset folder. For details read the @dataset/README.md file

# TASKS

## TASK 1: Backend Snapshot Service (NestJS + Prisma)

### TASK STATEMENT
Build a NestJS endpoint that returns a trader's daily snapshot for today:
- Open positions (instrument, net qty, avg price, current market price if you choose to mock it)
- Day realized + unrealized P&L (Profit & Loss)
- A simple risk indicator. Use min(100, abs(positions_notional) / account_balance × 100) as the formula.

### TASK SPECIFIC REQUIREMENTS
- Endpoint scoped to the authenticated trader and their tenant (cross-tenant access must fail)
- A Prisma schema (or SQL DDL) with at least one index you can explain
- At least one test for the snapshot logic.

### TASK DELIVERABLES
- service/controller code
- Prisma schema
- Basic tests

## TASK 2: Frontend Snapshot Widget (Next.js + Tailwind)

### TASK STATEMENT
Build a Next.js page that renders the snapshot for the logged-in trader.


### TASK SPECIFIC REQUIREMENTS
- Fetch initial data from the Task 1 endpoint
- Receive live updates via WebSocket. Minimal viable is fine - the WS connection just needs to be tenant-scoped at auth time and push new fill events to the client. Visual polish around the updates is optional. See dataset/simulate-fills.md for how to fake fills.
- Reconnect behavior - answer in the README, you do not have to build it. Our feeds drop. When the socket disconnects and comes back, how does the client know whether it missed fills while it was gone, and what does it do about it? A few sentences on your approach is enough. If your implementation would silently show stale numbers, say so.
- Dark mode, professional trading-UI feel
- Surface high-risk state clearly. A >75 risk score should be visually unmissable.
- Handle loading, error, and empty states without crashing

### TASK DELIVERABLES
- page component
- hooks/utilities
- WebSocket client logic

## TASK 3: Security & PII Writeup

### TASK STATEMENT
Add a SECURITY.md file to the root of the project and answer the following questions:

1. **Auth model**:
    1. How does the frontend authenticate to your REST endpoint?
    1. What stops a logged-in trader from one tenant from subscribing to another tenant's stream?

1. **Tenant isolation**:
    1. Where in your code is tenant isolation enforced?
    1. If someone on your team forgets a ```WHERE broker_id = ?``` six months from now, what catches it?

1. **PII handling**:
    - Some of the dataset is PII. Tell us what you considered sensitive, what you logged vs. redacted, and what would change if this were stored in your DB vs. flowing through your WebSocket.

1. **One vulnerability you didn't introduce**:
    - Pick a specific class of bug (IDOR, log injection, XSS, JWT downgrade, whatever) and show the line of code or design choice that prevented it.Active threat modeling, not a checklist.

1. **What you'd do in production but didn't**.
    -  One paragraph - rate limiting, audit logging, structured PII redaction in logs, KMS-encrypted columns, etc. Be specific.


### TASK SPECIFIC REQUIREMENTS
Roughly 1-2 pages of markdown total.

### TASK DELIVERABLES
SECURITY.md file with answers to the questions

## TASK 4: Architecture & Handoff Reflection

    This role leads a team - we want to see how you'd set someone else up to work in code you wrote.
### TASK STATEMENT
Write three short paragraphs at the bottom of the README.md file with the following information:

1. The decision you're most proud of, and the tradeoff it cost you.
1. The one thing you'd change with a second day.
1. If you handed this repo to two engineers tomorrow, what would you tell them first, and what would you not let them change? 

### TASK SPECIFIC REQUIREMENTS

### TASK DELIVERABLES

The answers to the questions at the bottom of the README.md file