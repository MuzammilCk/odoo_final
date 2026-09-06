# DealFlow360 — An Intelligent, Self-Governing Sales Operations Platform

> 🏆 **Odoo Hackathon — Final Round Project** · Built end-to-end in a 24-hour sprint by a 3-person team (Sept 5–6, 2026)

DealFlow360 is a complete **B2B quotation-to-cash platform** that goes beyond a simple quote → order → invoice form. It treats the **quotation as a live business object** surrounded by automated discount governance, approval routing, live upsell/cross-sell recommendations, multi-warehouse fulfillment, hybrid (one-time + recurring) billing, customer portal negotiation, and real-time deal-health monitoring.

---

## Table of Contents

- [Why DealFlow360](#why-dealflow360)
- [Key Features](#key-features)
- [The Blended Discount Risk Score](#the-blended-discount-risk-score)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [User Roles](#user-roles)
- [Getting Started](#getting-started)
- [Demo Credentials](#demo-credentials)
- [End-to-End Demo Flow](#end-to-end-demo-flow)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [What We Would Build Next](#what-we-would-build-next)

---

## Why DealFlow360

Most sales tools handle the basics well: create a quote, confirm an order, invoice it. Real B2B sales teams operate in much messier conditions:

- 🔻 **Multi-tier discount governance** — different discount limits per customer tier *and* per product category, with blended risk detection
- 🔻 **Automated approval routing** — multi-step (Manager → Finance) approval chains derived automatically from discount risk, not manual coordination
- 🔻 **Split inventory** — stock distributed across multiple warehouses, requiring intelligent fulfillment splitting and backorder handling
- 🔻 **Hybrid billing** — one-time hardware mixed with recurring subscription lines on a single order, with correct proration
- 🔻 **Post-quote negotiation** — customers who want to negotiate inside a portal instead of over email
- 🔻 **Blind-spot delays** — managers who only discover a stuck or over-discounted deal after it has lost momentum

**DealFlow360's core thesis: a quotation is not a static PDF — it is a living, self-governing business object** that is continuously evaluated, approved, negotiated, fulfilled, billed, and monitored through its entire lifecycle.

## Key Features

| Module | What it does |
|---|---|
| **CPQ & Quotation Builder** | Build quotes mixing products across categories (Hardware / Services / Subscriptions), adjust quantities, apply line-level discounts, see live totals and margin indicators |
| **Discount Governance & Blended Risk** | Computes effective discount ceilings as `MIN(tier ceiling, category ceiling)`, flags line overages, and derives a blended risk score across the whole order |
| **Automated Approval Routing** | Routes quotations to Sales Manager (and Finance for high risk) automatically — rep never requests approval manually; approvals carry a full audit trail and become invalid when terms change |
| **Upsell / Cross-Sell Recommendations** | Live ranked suggestions while building a quote — co-purchase history + promotion boost + healthy-margin filtering, with instant margin-delta feedback |
| **Multi-Warehouse Fulfillment** | Greedy, freight-cost-weighted warehouse split with transactional `SELECT FOR UPDATE` stock reservation, manual override, and automated backorder consolidation |
| **Hybrid Billing** | One order splits cleanly into a one-time commercial invoice and a recurring subscription schedule, with mid-cycle proration and automated credit notes on cancellation |
| **Customer Portal Negotiation** | A genuine, separate `/portal/*` RBAC boundary where customers view, line-level comment, counter discounts, and confirm — no internal margins, costs, or approvals exposed |
| **Deal Health & Anomaly Engine** | Background worker detecting stalled deals, discount anomalies (rep discounting far above their historical average), and delivery slippage, with nudge/escalation actions |
| **Reporting & Export** | Sales performance dashboards with filters (period / rep / approval status / product) and **PDF + XLS export** |
| **Admin Backend Config** | Products, variants, price lists, discount tiers, category ceilings, approval chains, warehouses, stock, and subscription plans — all configuration-driven, nothing hardcoded for the demo |

## The Blended Discount Risk Score

This is the intellectual core that differentiates DealFlow360 from a CRUD app:

- **Effective ceiling per line** = `MIN(customer tier ceiling, product category ceiling)`
- **Line overage** = `MAX(0, applied discount − effective ceiling)`
- **Blended risk score** = `Σ line overages` across the entire order

Why *blended*? Because small overages spread across many lines can quietly leak more margin than one obvious violation. The score catches the whole pattern, not just the single worst line.

| Score | Risk level | Approval routing |
|---|---|---|
| `0` | LOW | None — moves straight to fulfillment |
| `> 0` and `≤ 5` | MEDIUM | Sales Manager |
| `> 5` | HIGH | Sales Manager → Finance & Ops (sequential, neither skippable) |

If a customer later negotiates terms that change the risk, previous approvals are **invalidated** and the quotation re-enters the approval flow automatically — a full self-governing feedback loop.

## Tech Stack

```text
Frontend     React 19 + TypeScript + Vite + Tailwind CSS + React Router
Backend      Node.js + TypeScript + Express (modular monolith)
Database     PostgreSQL + Prisma ORM (25-table schema, targeted raw SQL for row locking)
Auth         JWT + bcrypt, server-side RBAC (5 roles)
Validation   Zod (input) + domain services (business rules)
Exports      pdfkit (PDF) + exceljs (XLS)
Monorepo     npm workspaces — apps/web · apps/api · packages/shared · prisma
```

The stack is deliberately conventional and TypeScript-first so business logic, data modeling, and end-to-end workflow stay the focus — exactly what the hackathon problem statement demands.

## Architecture

```text
                    ┌──────────────────────────────────────────┐
                    │              DEALFLOW360                 │
                    ├──────────────────────────────────────────┤
                    │   Internal Workspace   Customer Portal   │
                    │      /app/* routes       /portal/*        │
                    │   React + TS + Tailwind                  │
                    └──────────────────┬───────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────────────┐
                    │        Express API  (/api/v1/*)          │
                    │  Auth / RBAC / Zod validation            │
                    ├──────────────────────────────────────────┤
                    │  Commercial Core     Fulfillment & Loop  │
                    │   • CPQ & pricing    • Portal negotiation│
                    │   • Blended risk     • Greedy warehouse  │
                    │   • Approval router    split + locking   │
                    │   • Recommendations • Backorders         │
                    │  Money & Monitoring                      │
                    │   • Hybrid billing   • Subscriptions     │
                    │   • Payments         • Deal Health       │
                    │   • Credit notes     • Reporting/export  │
                    └──────────────────┬───────────────────────┘
                                       │
                    ┌──────────────────┴───────────────────────┐
                    │    PostgreSQL (Prisma)  + Background     │
                    │    Domain source of truth   Worker       │
                    │                          (Deal Health)   │
                    └──────────────────────────────────────────┘
```

Development was split across **three vertical lanes**, each owning a full slice from database → domain → API → UI:

- **Lane A — Commercial Core:** auth, quotations, discount/risk governance, approvals, recommendations, dashboard & config
- **Lane B — Fulfillment & Customer Loop:** customer portal, negotiation + re-approval loop, warehouse allocation & backorders
- **Lane C — Money & Monitoring:** products/pricing, subscriptions, billing, payments, credit notes, Deal Health, reporting

## User Roles

| Role | Purpose |
|---|---|
| **ADMIN** | Backend configuration: products, price lists, discount tiers, warehouses, subscription plans; platform analytics |
| **SALES_REP** | Builds quotations, applies discounts, reviews upsell suggestions, responds to negotiation requests |
| **MANAGER** | First-level approval, configures discount tiers/approval chains, monitors Deal Health |
| **FINANCE_OPS** | Second-level approval, warehouse split / backorder decisions, billing reconciliation |
| **CUSTOMER** | Views, negotiates, and confirms quotations through the restricted customer portal |

Authorization is enforced **server-side** as `role + operation + resource ownership + current state` — a customer can only ever see their own quotations, and a rep can never approve their own deal.

## Getting Started

### Prerequisites

- Node.js 20.19+ (or 22.12+)
- PostgreSQL (local instance)

### Quick Start

```bash
# 1. Install dependencies (all workspaces from root)
npm install

# 2. Configure environment
cp .env.example .env
#   Edit .env → set DATABASE_URL to your local Postgres

# 3. Apply migrations
npx prisma migrate dev

# 4. Seed the database (demo users, tiers, products, warehouses, stock)
npx prisma db seed

# 5. Run both apps
npm run dev
```

- **Web app:** http://localhost:5173
- **API:** http://localhost:3001 — health check at `http://localhost:3001/api/v1/health`

Useful scripts:

```bash
npm run build          # type-check + build web & api
npm run db:reset       # reset DB, re-apply migrations, re-seed
npm run db:studio      # open Prisma Studio
npm run db:seed:catalog# (re)load the master catalog seed
```

## Demo Credentials

All demo accounts use password **`password123`**:

| Persona | Email | Role |
|---|---|---|
| Sarah Sales (Rep) | `rep@demo.com` | `SALES_REP` |
| Mike Manager | `manager@demo.com` | `MANAGER` |
| Fiona Finance | `finance@demo.com` | `FINANCE_OPS` |
| Admin User | `admin@demo.com` | `ADMIN` |
| Alex Acme (Customer) | `customer@acme.com` | `CUSTOMER` (Acme Corp — Gold) |
| Beth Beta (Customer) | `customer@beta.com` | `CUSTOMER` (Beta Industries — Silver) |

> **Tip:** log in to the customer portal in an **incognito window** to demonstrate the separate RBAC boundary.

## End-to-End Demo Flow

The full lifecycle exercised by the demo (and verified by our quick-test checklist):

```text
Login → Configure discount tier / warehouse / subscription
  → Build quotation (hardware + SaaS lines)
  → Accept upsell suggestion → totals & margin update live
  → Apply discount above ceiling → Blended Risk Score → auto-route
  → Manager approves → Finance approves (audit trail)
  → Customer portal: counter-discount request → UNDER_NEGOTIATION
  → Rep accepts → version v2 → old approval invalidated → re-approval
  → Customer confirms → warehouse split (greedy, freight-weighted)
  → Backorder for shortfall → consolidate when stock arrives
  → One-time invoice + recurring subscription schedule
  → Record payment → invoice status → PAID
  → Deal Health flags stalled / anomalous deals → nudge or escalate
  → Reports exported as PDF / XLS
```

## Project Structure

```text
dealflow360/
├── apps/
│   ├── web/                    # React 19 + Vite + Tailwind frontend
│   │   └── src/features/       #  auth, quotations, approvals, portal,
│   │                           #  fulfillment, subscriptions, billing,
│   │                           #  invoices, deal-health, reporting, admin
│   └── api/                    # Express + TypeScript modular monolith
│       └── src/modules/        #  auth, quotations, approvals, recommendations,
│                               #  discount-config, portal, negotiations,
│                               #  fulfillment, inventory, backorders, products,
│                               #  subscriptions, billing, payments, deal-health,
│                               #  reporting, dashboard
├── packages/shared/            # shared enums & types
├── prisma/
│   ├── schema.prisma           # 25-table PostgreSQL schema (locked spec §5)
│   ├── migrations/
│   └── seed.ts                 # master config seed (zero mock transactions)
├── docs/                       # 8 locked control-file sections + team plans
│   └── team/                   # lane plans, tracker, role division
├── scripts/                    # dev/test helper scripts
├── .env.example
└── package.json                # npm workspaces
```

## Documentation

The `docs/` folder contains the full design-and-build control chain used during the hackathon:

- `1_Problem_Restatement.md` → `8_Technology_Choice.md` — eight **locked spec sections** (problem, actors/roles, use cases, entities, database schema, business rules/state transitions, API surface, technology)
- `DEMO_VIDEO_SCRIPT.md` — the official 5-minute demo script with storyboard, narration, and one-page architecture diagram
- `docs/team/` — team execution files: role division, implementation tracker, per-lane micro-step plans
- `DealFlow360.excalidraw` — the 18-screen product wireframe

## What We Would Build Next

1. **AI-powered price elasticity & win-probability guidance** — ML pricing suggestions (win rate vs. margin trade-offs) replacing static thresholds
2. **ERP & 3PL integration hub** — live EDI/REST connectors to SAP, NetSuite, ShipStation for real tracking, carrier rate shopping, and pick lists
3. **Automated supplier PO dropship for backorders** — EDI 850 purchase orders to distributors when stock hits zero
4. **Multi-currency hedging & tax compliance** — real-time FX with forward rate locking, plus automated AvaTax/Stripe Tax calculations

---

Built with ❤️ by **Team DealFlow360** for the **Odoo Hackathon Final Round** — React · Node.js · Prisma · PostgreSQL.