# DealFlow360 — Implementation Tracker

> **Living document.** Mark items `[x]` when done, `[/]` when in progress. Each row is ~15–30 minutes of work.
> **Foundation owner:** Solo Foundation — **PHASE 0 COMPLETE & PUSHED** (commit `1471dc0` on `main`).
> **Started:** 2026-09-05 ~18:48 IST | **Foundation finished:** 2026-09-05 ~19:25 IST

---

## Timeline (16 hours remaining)

| Phase | Hours | What happens |
|---|---|---|
| **Foundation** | T+0 → T+2 | Monorepo, Prisma schema, seed, auth shell — **COMPLETE ✅ (pushed to main)** |
| **Parallel Build** | T+2 → T+12 | Each lane builds independently via micro-steps |
| **Checkpoint 1** | T+6 | Quick sync: each lane's core happy path works solo? |
| **Integration** | T+12 → T+14 | Wire contracts 1–3, run full flow |
| **Checkpoint 2** | T+13 | Full end-to-end demo path works |
| **Polish + Demo** | T+14 → T+16 | Edge cases, UI cleanup, demo rehearsal, freeze |

---

## Phase 0 — Foundation (1 person builds → everyone pulls)

- [x] **F1** — Monorepo scaffold — `apps/web`, `apps/api`, `packages/shared`, `prisma/` ✅ (API health ✓, web build ✓)
- [x] **F2** — Prisma schema — all 16 models / 25 tables from §5.5–§5.28 (locked spec) ✅
- [x] **F2** — Migration `20260905133716_init` applied — 25 tables verified in DB ✅
- [x] **F3** — Seed script — 6 users, 3 tiers, 2 customers, 3 categories, 6 products, 2 warehouses, 5 quotations (DRAFT/PENDING/NEGOT/CONFIRMED/STALLED), backorder + subscription ✅
- [x] **F4** — Auth boilerplate — JWT, bcrypt, login/signup, middleware ✅
- [x] **F4** — RBAC middleware — `requireRole()` factory, portal isolation (/app/* vs /portal/*) ✅
- [x] **F4** — Shared types — enums + JwtPayload in shared package ✅
- [x] **F4** — Frontend shell — AuthContext, ProtectedRoute, AppLayout, PortalLayout, LoginPage, all route slots ✅
- [x] **F4** — `.env.example` — environment template with DB, JWT, port, base URLs ✅
- [x] Verify: both apps run, seed loads, login works, RBAC blocks ✅
- [x] **GIT PUSH** — pushed to `main` (`1471dc0`) → teammates pull + `npm install` + `npx prisma migrate dev` + `npx prisma db seed` ✅

---

## Phase 1 — Lane A: Commercial Core

### Step A1 — Auth (Completed in Foundation Phase F4)
| # | Type | Task | Status |
|---|---|---|---|
| A1.1 | LEARN | Read §8.17–8.20 — auth architecture | [x] |
| A1.2 | BUILD | Password hashing + user creation service (`auth.service.ts`) | [x] |
| A1.3 | BUILD | Login service (find user, compare hash, generate JWT) | [x] |
| A1.4 | BUILD | Auth endpoints (signup, login, me in `auth.controller.ts`) | [x] |
| A1.5 | BUILD | JWT middleware (extract + verify token in `auth.middleware.ts`) | [x] |
| A1.6 | BUILD | RBAC middleware (requireRole in `rbac.middleware.ts`) | [x] |
| A1.7 | BUILD | Login page UI (Screen 1 in `LoginPage.tsx`) | [x] |
| A1.8 | BUILD | Route guards (`ProtectedRoute.tsx` component + route tree) | [x] |

### Step A2 — Quotation CRUD
| # | Type | Task | Status |
|---|---|---|---|
| A2.1 | LEARN | Read §6.6, §5 — quotation data model | [ ] |
| A2.2 | BUILD | Create quotation service (status=DRAFT, version=1) | [ ] |
| A2.3 | BUILD | Quotation endpoints (create, list, detail) | [ ] |
| A2.4 | LEARN | Read §6.7–6.8, §6.24 — line pricing + total formulas | [ ] |
| A2.5 | BUILD | Quotation calculator service (recalculate totals/margin) | [ ] |
| A2.6 | BUILD | Add line endpoint (resolve price, calculate, recalculate) | [ ] |
| A2.7 | BUILD | Edit + delete line endpoints | [ ] |
| A2.8 | BUILD | Material edit → version increment (§6.4) | [ ] |
| A2.9 | BUILD | Quotation List page UI (Screen 3) | [ ] |
| A2.10 | BUILD | Quotation Detail page UI (Screen 4 — basic) | [ ] |

### Step A3 — Discount Governance + Risk
| # | Type | Task | Status |
|---|---|---|---|
| A3.1 | LEARN | Read §6.9–6.11 — effective ceiling + overage | [ ] |
| A3.2 | BUILD | Effective ceiling calculation: MIN(tier, category) | [ ] |
| A3.3 | BUILD | Line overage calculation: MAX(0, discount - ceiling) | [ ] |
| A3.4 | BUILD | Blended risk score: SUM(overages) | [ ] |
| A3.5 | BUILD | Risk level determination (LOW/MEDIUM/HIGH) | [ ] |
| A3.6 | BUILD | evaluateAndRoute() — Contract 1 endpoint | [ ] |
| A3.7 | BUILD | Risk badge + overage indicators on UI | [ ] |

### Step A4 — Approval Workflow
| # | Type | Task | Status |
|---|---|---|---|
| A4.1 | LEARN | Read §6.14–6.18 — approval state machine | [ ] |
| A4.2 | BUILD | ApprovalRequest + steps creation service | [ ] |
| A4.3 | VERIFY | Test: create request for MEDIUM risk → 1 step | [ ] |
| A4.4 | BUILD | Submit quotation endpoint (risk eval → approval) | [ ] |
| A4.5 | BUILD | Approve step logic (single step) | [ ] |
| A4.6 | BUILD | Reject step logic | [ ] |
| A4.7 | BUILD | Return for revision logic | [ ] |
| A4.8 | BUILD | Multi-step sequencing (Manager → Finance) | [ ] |
| A4.9 | BUILD | Approval validity guard (version check) | [ ] |
| A4.10 | BUILD | Approval decision endpoint | [ ] |
| A4.11 | BUILD | Approvals list + detail endpoints | [ ] |
| A4.12 | BUILD | Approval List page UI (Screen 5) | [ ] |
| A4.13 | BUILD | Approval Detail page UI (Screen 6) | [ ] |

### Step A5 — Recommendations
| # | Type | Task | Status |
|---|---|---|---|
| A5.1 | LEARN | Read §6.22–6.23 — recommendation rules | [ ] |
| A5.2 | BUILD | Candidate filtering (exclude in-quote, below margin) | [ ] |
| A5.3 | BUILD | Scoring + ranking (co-purchase + promo boost) | [ ] |
| A5.4 | BUILD | Margin delta calculation | [ ] |
| A5.5 | BUILD | Recommendation endpoint | [ ] |
| A5.6 | BUILD | Upsell panel UI on quotation builder | [ ] |

### Step A6 — Dashboard + Config
| # | Type | Task | Status |
|---|---|---|---|
| A6.1 | BUILD | Dashboard aggregation endpoint | [ ] |
| A6.2 | BUILD | Dashboard page UI (Screen 2) | [ ] |
| A6.3 | BUILD | Discount tier CRUD endpoints | [ ] |
| A6.4 | BUILD | Category ceiling CRUD endpoints | [ ] |
| A6.5 | BUILD | Approval threshold config | [ ] |
| A6.6 | BUILD | Config page UI (Screen 18) | [ ] |

**Lane A total: 44 micro-steps**

---

## Phase 1 — Lane B: Fulfillment & Customer Loop

### Step B1 — Portal Auth + Shell
| # | Type | Task | Status |
|---|---|---|---|
| B1.1 | LEARN | Read §8.21 — portal isolation rules | [ ] |
| B1.2 | BUILD | Portal middleware (role check + ownership check) | [ ] |
| B1.3 | BUILD | Portal routes + controller shell | [ ] |
| B1.4 | BUILD | Portal frontend shell (scaffolded in F4 — `PortalLayout.tsx`) | [x] |

### Step B2 — Portal Quotation View
| # | Type | Task | Status |
|---|---|---|---|
| B2.1 | BUILD | Portal quotation list endpoint (customer-only) | [ ] |
| B2.2 | BUILD | Portal quotation detail endpoint (filtered fields) | [ ] |
| B2.3 | BUILD | Portal quotation list UI | [ ] |
| B2.4 | BUILD | Portal quotation detail UI (no margin/cost) | [ ] |

### Step B3 — Negotiation Engine
| # | Type | Task | Status |
|---|---|---|---|
| B3.1 | LEARN | Read §6.21, UC-12, UC-13 — negotiation flow | [ ] |
| B3.2 | BUILD | Negotiation request service (create request) | [ ] |
| B3.3 | BUILD | Customer negotiation endpoint | [ ] |
| B3.4 | BUILD | Internal negotiation view endpoint | [ ] |
| B3.5 | BUILD | Sales rep response service (resolve, version++) | [ ] |
| B3.6 | BUILD | Re-approval trigger (Contract 1 call / stub) | [ ] |
| B3.7 | BUILD | Sales rep response endpoint | [ ] |
| B3.8 | BUILD | Negotiation UI — customer side | [ ] |
| B3.9 | BUILD | Negotiation UI — internal side | [ ] |

### Step B4 — Confirmation
| # | Type | Task | Status |
|---|---|---|---|
| B4.1 | LEARN | Read §6.20, §6.18 — confirmation rules | [ ] |
| B4.2 | BUILD | Confirmation validation service (5 preconditions) | [ ] |
| B4.3 | BUILD | Confirm endpoint (+ Contract 3 TODO) | [ ] |
| B4.4 | BUILD | Confirm button UI | [ ] |

### Step B5 — Warehouse Allocation
| # | Type | Task | Status |
|---|---|---|---|
| B5.1 | LEARN | Read §6.28, §8.16 — row-level locking | [ ] |
| B5.2 | LEARN | Read §6.2 rules 11–13 — available stock formula | [ ] |
| B5.3 | BUILD | Available stock query service | [ ] |
| B5.4 | BUILD | Warehouse ranking logic | [ ] |
| B5.5 | BUILD | Greedy allocation algorithm (recommendation only) | [ ] |
| B5.6 | BUILD | Allocation recommendation endpoint | [ ] |
| B5.7 | BUILD | Transactional stock reservation (SELECT FOR UPDATE) | [ ] |
| B5.8 | BUILD | Accept split endpoint | [ ] |
| B5.9 | BUILD | Manual override endpoint | [ ] |
| B5.10 | BUILD | Backorder creation (remaining qty) | [ ] |
| B5.11 | BUILD | Fulfillment list endpoint | [ ] |
| B5.12 | BUILD | Fulfillment List UI (Screen 7) | [ ] |
| B5.13 | BUILD | Fulfillment Detail UI (Screen 8) | [ ] |

### Step B6 — Backorder + Inventory
| # | Type | Task | Status |
|---|---|---|---|
| B6.1 | LEARN | Read §6.32 — backorder consolidation | [ ] |
| B6.2 | BUILD | Backorder list + consolidation endpoint | [ ] |
| B6.3 | BUILD | Inventory release (cancel allocation) | [ ] |
| B6.4 | BUILD | Warehouse management endpoints | [ ] |

### Concurrency Test
| # | Type | Task | Status |
|---|---|---|---|
| B-TEST | VERIFY | Two concurrent allocations don't over-reserve | [ ] |

**Lane B total: 35 micro-steps**

---

## Phase 1 — Lane C: Money & Monitoring

### Step C1 — Products & Categories
| # | Type | Task | Status |
|---|---|---|---|
| C1.1 | LEARN | Read §5 product tables, UC-02 | [ ] |
| C1.2 | BUILD | Category CRUD service | [ ] |
| C1.3 | BUILD | Product CRUD service | [ ] |
| C1.4 | BUILD | Product endpoints | [ ] |
| C1.5 | BUILD | Product variant CRUD | [ ] |
| C1.6 | BUILD | Product Dashboard UI (Screen 16) | [ ] |
| C1.7 | BUILD | Product Details UI (Screen 17) | [ ] |

### Step C2 — Price Lists
| # | Type | Task | Status |
|---|---|---|---|
| C2.1 | LEARN | Read §6.8 — price resolution logic | [ ] |
| C2.2 | BUILD | Price list entry CRUD | [ ] |
| C2.3 | BUILD | resolvePrice() — Contract 2 implementation | [ ] |
| C2.4 | BUILD | Price list endpoints | [ ] |
| C2.5 | BUILD | Price list section on Product Detail UI | [ ] |

### Step C3 — Subscription Creation
| # | Type | Task | Status |
|---|---|---|---|
| C3.1 | LEARN | Read §6.34 — subscription from confirmed quotation | [ ] |
| C3.2 | BUILD | Subscription plan config CRUD | [ ] |
| C3.3 | BUILD | createFromConfirmedQuotation() — Contract 3 | [ ] |
| C3.4 | BUILD | Subscription list endpoint + UI (Screen 9) | [ ] |

### Step C4 — Subscription Lifecycle
| # | Type | Task | Status |
|---|---|---|---|
| C4.1 | LEARN | Read §6.35 — proration formula | [ ] |
| C4.2 | BUILD | Subscription modification with proration | [ ] |
| C4.3 | BUILD | Subscription cancellation + credit note | [ ] |
| C4.4 | BUILD | Modification/cancel endpoints | [ ] |
| C4.5 | BUILD | Subscription detail UI | [ ] |

### Step C5 — Invoices
| # | Type | Task | Status |
|---|---|---|---|
| C5.1 | LEARN | Read §6.37–6.38 — hybrid billing model | [ ] |
| C5.2 | BUILD | One-time invoice generation (from fulfilled) | [ ] |
| C5.3 | BUILD | Recurring invoice generation (from subscriptions) | [ ] |
| C5.4 | BUILD | Invoice endpoints (list, detail, send, void) | [ ] |
| C5.5 | BUILD | Invoice List UI (Screen 12) | [ ] |
| C5.6 | BUILD | Invoice Detail UI (Screen 13) | [ ] |

### Step C6 — Payments & Credit Notes
| # | Type | Task | Status |
|---|---|---|---|
| C6.1 | LEARN | Read §6.39 — payment balance mechanics | [ ] |
| C6.2 | BUILD | Payment recording service (balance + status auto-update) | [ ] |
| C6.3 | BUILD | Payment endpoint | [ ] |
| C6.4 | BUILD | Credit note service (create + apply) | [ ] |
| C6.5 | BUILD | Credit note endpoints | [ ] |
| C6.6 | BUILD | Billing Detail UI (Screen 10) | [ ] |
| C6.7 | BUILD | Record Payment modal + history | [ ] |

### Step C7 — Deal Health
| # | Type | Task | Status |
|---|---|---|---|
| C7.1 | LEARN | Read §6.41–6.43 — detection rules | [ ] |
| C7.2 | BUILD | STALLED detection | [ ] |
| C7.3 | BUILD | DISCOUNT_ANOMALY detection | [ ] |
| C7.4 | BUILD | DELIVERY_SLIPPAGE detection | [ ] |
| C7.5 | BUILD | Deal Health evaluate orchestrator | [ ] |
| C7.6 | BUILD | Deal Health endpoints | [ ] |
| C7.7 | BUILD | Deal Health background worker | [ ] |
| C7.8 | BUILD | Deal Health Dashboard UI (Screen 14) | [ ] |

### Step C8 — Reporting
| # | Type | Task | Status |
|---|---|---|---|
| C8.1 | LEARN | Read §A7, UC-21–22 — reporting requirements | [ ] |
| C8.2 | BUILD | Sales performance query | [ ] |
| C8.3 | BUILD | Product + approval reports | [ ] |
| C8.4 | BUILD | Reporting endpoints | [ ] |
| C8.5 | BUILD | Report export (PDF/XLS) | [ ] |
| C8.6 | BUILD | Reporting page UI (Screen 15) | [ ] |

**Lane C total: 46 micro-steps**

---

## Phase 2 — Integration

| # | Task | Status | Owner pair |
|---|---|---|---|
| I1 | Wire Contract 1 — Lane B calls Lane A's `evaluateAndRoute()` | [ ] | A + B |
| I2 | Wire Contract 2 — Lane A calls Lane C's `resolvePrice()` | [ ] | A + C |
| I3 | Wire Contract 3 — Lane B's confirm calls Lane C's `createFromConfirmedQuotation()` | [ ] | B + C |
| I4 | Full flow: Login → Quote → Discount → Approval → Portal → Negotiate → Re-approve → Confirm → Fulfill → Invoice → Pay | [ ] | All |
| I5 | Cross-lane auth test | [ ] | All |

---

## Phase 3 — Polish & Demo

| # | Task | Status | Owner |
|---|---|---|---|
| P1 | Error states + toast notifications | [ ] | All |
| P2 | Loading states + skeleton screens | [ ] | All |
| P3 | Seed data hardening for demo | [ ] | All |
| P4 | Demo script — exact 5-minute walkthrough | [ ] | All |
| P5 | Architecture diagram (deliverable) | [ ] | First done |
| P6 | "What we'd build next" write-up | [ ] | All |
| P7 | Final smoke test on clean DB | [ ] | All |

---

## Quick Test Flow Verification (§9)

- [ ] 1. Sign up / log in, configure discount tier + warehouse + subscription
- [ ] 2. Create quotation, add product with discount above ceiling
- [ ] 3. Confirm → auto-routes for approval
- [ ] 4. Accept upsell → total + margin update immediately
- [ ] 5. Approve → stock pulled from correct warehouse, splits if needed
- [ ] 6. One-time + recurring billed correctly and separately
- [ ] 7. Customer portal → request bigger discount → re-enters approval
- [ ] 8. Confirm order, record payment, invoice status updates

---

## Totals

| Lane | Micro-steps | Completed | Remaining | Estimated time remaining |
|---|---|---|---|---|
| **Foundation (Phase 0)** | 10 | 10 | 0 | **0 hrs (COMPLETE ✅)** |
| **Lane A** | 44 | 8 (A1.1–A1.8) | 36 | ~12 hrs |
| **Lane B** | 35 | 1 (B1.4 shell) | 34 | ~11 hrs |
| **Lane C** | 46 | 0 | 46 | ~15 hrs |
| **Integration** | 5 | 0 | 5 | ~1.5 hrs |
| **Polish** | 7 | 0 | 7 | ~1.5 hrs |

> **Note:** Lane A and Lane C have more micro-steps than available solo hours. Prioritize: core flows first (A1–A4, C1–C5 are critical), nice-to-haves last (A5 recommendations, C8 reporting). If running short, recommendations and export can be simplified.
