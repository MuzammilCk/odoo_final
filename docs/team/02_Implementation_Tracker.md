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
| A2.1 | LEARN | Read §6.6, §5 — quotation data model | [x] |
| A2.2 | BUILD | Create quotation service (status=DRAFT, version=1) | [x] |
| A2.3 | BUILD | Quotation endpoints (create, list, detail) | [x] |
| A2.4 | LEARN | Read §6.7–6.8, §6.24 — line pricing + total formulas | [x] |
| A2.5 | BUILD | Quotation calculator service (recalculate totals/margin) | [x] |
| A2.6 | BUILD | Add line endpoint (resolve price, calculate, recalculate) | [x] |
| A2.7 | BUILD | Edit + delete line endpoints | [x] |
| A2.8 | BUILD | Material edit → version increment (§6.4) | [x] |
| A2.9 | BUILD | Quotation List page UI (Screen 3) | [x] |
| A2.10 | BUILD | Quotation Detail page UI (Screen 4 — basic) | [x] |

### Step A3 — Discount Governance + Risk
| # | Type | Task | Status |
|---|---|---|---|
| A3.1 | LEARN | Read §6.9–6.11 — effective ceiling + overage | [x] |
| A3.2 | BUILD | Effective ceiling calculation: MIN(tier, category) | [x] |
| A3.3 | BUILD | Line overage calculation: MAX(0, discount - ceiling) | [x] |
| A3.4 | BUILD | Blended risk score: SUM(overages) | [x] |
| A3.5 | BUILD | Risk level determination (LOW/MEDIUM/HIGH) | [x] |
| A3.6 | BUILD | evaluateAndRoute() — Contract 1 endpoint | [x] |
| A3.7 | BUILD | Risk badge + overage indicators on UI | [x] |

### Step A4 — Approval Workflow
| # | Type | Task | Status |
|---|---|---|---|
| A4.1 | LEARN | Read §6.14–6.18 — approval state machine | [x] |
| A4.2 | BUILD | ApprovalRequest + steps creation service | [x] |
| A4.3 | VERIFY | Test: create request for MEDIUM risk → 1 step | [x] |
| A4.4 | BUILD | Submit quotation endpoint (risk eval → approval) | [x] |
| A4.5 | BUILD | Approve step logic (single step) | [x] |
| A4.6 | BUILD | Reject step logic | [x] |
| A4.7 | BUILD | Return for revision logic | [x] |
| A4.8 | BUILD | Multi-step sequencing (Manager → Finance) | [x] |
| A4.9 | BUILD | Approval validity guard (version check) | [x] |
| A4.10 | BUILD | Approval decision endpoint | [x] |
| A4.11 | BUILD | Approvals list + detail endpoints | [x] |
| A4.12 | BUILD | Approval List page UI (Screen 5) | [x] |
| A4.13 | BUILD | Approval Detail page UI (Screen 6) | [x] |

### Step A5 — Recommendations
| # | Type | Task | Status |
|---|---|---|---|
| A5.1 | LEARN | Read §6.22–6.23 — recommendation rules | [x] |
| A5.2 | BUILD | Candidate filtering (exclude in-quote, below margin) | [x] |
| A5.3 | BUILD | Scoring + ranking (co-purchase + promo boost) | [x] |
| A5.4 | BUILD | Margin delta calculation | [x] |
| A5.5 | BUILD | Recommendation endpoint | [x] |
| A5.6 | BUILD | Upsell panel UI on quotation builder | [x] |

### Step A6 — Dashboard + Config
| # | Type | Task | Status |
|---|---|---|---|
| A6.1 | BUILD | Dashboard aggregation endpoint | [x] |
| A6.2 | BUILD | Dashboard page UI (Screen 2) | [x] |
| A6.3 | BUILD | Discount tier CRUD endpoints | [x] |
| A6.4 | BUILD | Category ceiling CRUD endpoints | [x] |
| A6.5 | BUILD | Approval threshold config | [x] |
| A6.6 | BUILD | Config page UI (Screen 18) | [x] |

**Lane A total: 44 micro-steps — 100% COMPLETE ✅**

---

## Phase 1 — Lane B: Fulfillment & Customer Loop

### Step B1 — Portal Auth + Shell
| # | Type | Task | Status |
|---|---|---|---|
| B1.1 | LEARN | Read §8.21 — portal isolation rules | [x] |
| B1.2 | BUILD | Portal middleware (role check + ownership check) | [x] |
| B1.3 | BUILD | Portal routes + controller shell | [x] |
| B1.4 | BUILD | Portal frontend shell (scaffolded in F4 — `PortalLayout.tsx`) | [x] |

### Step B2 — Portal Quotation View
| # | Type | Task | Status |
|---|---|---|---|
| B2.1 | BUILD | Portal quotation list endpoint (customer-only) | [x] |
| B2.2 | BUILD | Portal quotation detail endpoint (filtered fields) | [x] |
| B2.3 | BUILD | Portal quotation list UI | [x] |
| B2.4 | BUILD | Portal quotation detail UI (no margin/cost) | [x] |

### Step B3 — Negotiation Engine
| # | Type | Task | Status |
|---|---|---|---|
| B3.1 | LEARN | Read §6.21, UC-12, UC-13 — negotiation flow | [x] |
| B3.2 | BUILD | Negotiation request service (create request) | [x] |
| B3.3 | BUILD | Customer negotiation endpoint | [x] |
| B3.4 | BUILD | Internal negotiation view endpoint | [x] |
| B3.5 | BUILD | Sales rep response service (resolve, version++) | [x] |
| B3.6 | BUILD | Re-approval trigger (Contract 1 call / stub) | [x] |
| B3.7 | BUILD | Sales rep response endpoint | [x] |
| B3.8 | BUILD | Negotiation UI — customer side | [x] |
| B3.9 | BUILD | Negotiation UI — internal side | [x] |

### Step B4 — Confirmation
| # | Type | Task | Status |
|---|---|---|---|
| B4.1 | LEARN | Read §6.20, §6.18 — confirmation rules | [x] |
| B4.2 | BUILD | Confirmation validation service (5 preconditions) | [x] |
| B4.3 | BUILD | Confirm endpoint (+ Contract 3 TODO) | [x] |
| B4.4 | BUILD | Confirm button UI | [x] |

### Step B5 — Warehouse Allocation
| # | Type | Task | Status |
|---|---|---|---|
| B5.1 | LEARN | Read §6.28, §8.16 — row-level locking | [x] |
| B5.2 | LEARN | Read §6.2 rules 11–13 — available stock formula | [x] |
| B5.3 | BUILD | Available stock query service | [x] |
| B5.4 | BUILD | Warehouse ranking logic | [x] |
| B5.5 | BUILD | Greedy allocation algorithm (recommendation only) | [x] |
| B5.6 | BUILD | Allocation recommendation endpoint | [x] |
| B5.7 | BUILD | Transactional stock reservation (SELECT FOR UPDATE) | [x] |
| B5.8 | BUILD | Accept split endpoint | [x] |
| B5.9 | BUILD | Manual override endpoint | [x] |
| B5.10 | BUILD | Backorder creation (remaining qty) | [x] |
| B5.11 | BUILD | Fulfillment list endpoint | [x] |
| B5.12 | BUILD | Fulfillment List UI (Screen 7) | [x] |
| B5.13 | BUILD | Fulfillment Detail UI (Screen 8) | [x] |

### Step B6 — Backorder + Inventory
| # | Type | Task | Status |
|---|---|---|---|
| B6.1 | LEARN | Read §6.32 — backorder consolidation | [x] |
| B6.2 | BUILD | Backorder list + consolidation endpoint | [x] |
| B6.3 | BUILD | Inventory release (cancel allocation) | [x] |
| B6.4 | BUILD | Warehouse management endpoints | [x] |

### Concurrency Test
| # | Type | Task | Status |
|---|---|---|---|
| B-TEST | VERIFY | Two concurrent allocations don't over-reserve | [x] |

**Lane B total: 35 micro-steps — ALL COMPLETE ✅**

---

## Phase 1 — Lane C: Money & Monitoring

### Step C1 — Products & Categories
| # | Type | Task | Status |
|---|---|---|---|
| C1.1 | LEARN | Read §5 product tables, UC-02 | [x] |
| C1.2 | BUILD | Category CRUD service | [x] ✅ `apps/api/src/modules/products/product.service.ts` |
| C1.3 | BUILD | Product CRUD service | [x] ✅ `apps/api/src/modules/products/product.service.ts` |
| C1.4 | BUILD | Product endpoints | [x] ✅ `apps/api/src/modules/products/product.controller.ts` |
| C1.5 | BUILD | Product variant CRUD | [x] ✅ `apps/api/src/modules/products/product.controller.ts` |
| C1.6 | BUILD | Product Dashboard UI (Screen 16) | [x] ✅ `apps/web/src/features/admin/products/ProductDashboardPage.tsx` |
| C1.7 | BUILD | Product Details UI (Screen 17) | [x] ✅ `apps/web/src/features/admin/products/ProductDetailPage.tsx` |

### Step C2 — Price Lists
| # | Type | Task | Status |
|---|---|---|---|
| C2.1 | LEARN | Read §6.8 — price resolution logic | [x] |
| C2.2 | BUILD | Price list entry CRUD | [x] ✅ `apps/api/src/modules/products/product.service.ts` |
| C2.3 | BUILD | resolvePrice() — Contract 2 implementation | [x] ✅ `apps/api/src/modules/products/services/price-list.service.ts` |
| C2.4 | BUILD | Price list endpoints | [x] ✅ `apps/api/src/modules/products/product.controller.ts` |
| C2.5 | BUILD | Price list section on Product Detail UI | [x] ✅ `apps/web/src/features/admin/products/ProductDetailPage.tsx` |

### Step C3 — Subscription Creation
| # | Type | Task | Status |
|---|---|---|---|
| C3.1 | LEARN | Read §6.34 — subscription from confirmed quotation | [x] |
| C3.2 | BUILD | Subscription plan config CRUD | [x] ✅ `apps/api/src/modules/subscriptions/subscription.service.ts` |
| C3.3 | BUILD | createFromConfirmedQuotation() — Contract 3 | [x] ✅ `apps/api/src/modules/subscriptions/subscription.service.ts` |
| C3.4 | BUILD | Subscription list endpoint + UI (Screen 9) | [x] ✅ `apps/web/src/features/subscriptions/SubscriptionListPage.tsx` |

### Step C4 — Subscription Lifecycle
| # | Type | Task | Status |
|---|---|---|---|
| C4.1 | LEARN | Read §6.35 — proration formula | [x] |
| C4.2 | BUILD | Subscription modification with proration | [x] ✅ `apps/api/src/modules/subscriptions/subscription.service.ts::modifySubscription` |
| C4.3 | BUILD | Subscription cancellation + credit note | [x] ✅ `apps/api/src/modules/subscriptions/subscription.service.ts::cancelSubscription` |
| C4.4 | BUILD | Modification/cancel endpoints | [x] ✅ `apps/api/src/modules/subscriptions/subscription.controller.ts` |
| C4.5 | BUILD | Subscription detail UI | [x] ✅ `apps/web/src/features/subscriptions/SubscriptionDetailPage.tsx` |

### Step C5 — Invoices
| # | Type | Task | Status |
|---|---|---|---|
| C5.1 | LEARN | Read §6.37–6.38 — hybrid billing model | [x] |
| C5.2 | BUILD | One-time invoice generation (from fulfilled) | [x] ✅ `apps/api/src/modules/billing/services/invoice-generator.service.ts` |
| C5.3 | BUILD | Recurring invoice generation (from subscriptions) | [x] ✅ `apps/api/src/modules/billing/services/invoice-generator.service.ts` |
| C5.4 | BUILD | Invoice endpoints (list, detail, send, void) | [x] ✅ `apps/api/src/modules/billing/billing.controller.ts` |
| C5.5 | BUILD | Invoice List UI (Screen 12) | [x] ✅ `apps/web/src/features/invoices/InvoiceListPage.tsx` |
| C5.6 | BUILD | Invoice Detail UI (Screen 13) | [x] ✅ `apps/web/src/features/invoices/InvoiceDetailPage.tsx` |

### Step C6 — Payments & Credit Notes
| # | Type | Task | Status |
|---|---|---|---|
| C6.1 | LEARN | Read §6.39 — payment balance mechanics | [x] |
| C6.2 | BUILD | Payment recording service (balance + status auto-update) | [x] ✅ `apps/api/src/modules/payments/payment.service.ts` |
| C6.3 | BUILD | Payment endpoint | [x] ✅ `apps/api/src/modules/payments/payment.controller.ts` |
| C6.4 | BUILD | Credit note service (create + apply) | [x] ✅ `apps/api/src/modules/payments/credit-note.service.ts` |
| C6.5 | BUILD | Credit note endpoints | [x] ✅ `apps/api/src/modules/payments/payment.controller.ts` |
| C6.6 | BUILD | Billing Detail UI (Screen 10) | [x] ✅ `apps/web/src/features/billing/BillingDetailPage.tsx` |
| C6.7 | BUILD | Record Payment modal + history | [x] ✅ `apps/web/src/features/invoices/InvoiceDetailPage.tsx` |

### Step C7 — Deal Health
| # | Type | Task | Status |
|---|---|---|---|
| C7.1 | LEARN | Read §6.41–6.43 — detection rules | [x] |
| C7.2 | BUILD | STALLED detection | [x] ✅ `apps/api/src/modules/deal-health/deal-health.service.ts::detectStalled` |
| C7.3 | BUILD | DISCOUNT_ANOMALY detection | [x] ✅ `apps/api/src/modules/deal-health/deal-health.service.ts::detectDiscountAnomalies` |
| C7.4 | BUILD | DELIVERY_SLIPPAGE detection | [x] ✅ `apps/api/src/modules/deal-health/deal-health.service.ts::detectDeliverySlippage` |
| C7.5 | BUILD | Deal Health evaluate orchestrator | [x] ✅ `apps/api/src/modules/deal-health/deal-health.service.ts::evaluate` |
| C7.6 | BUILD | Deal Health endpoints | [x] ✅ `apps/api/src/modules/deal-health/deal-health.controller.ts` |
| C7.7 | BUILD | Deal Health background worker | [x] ✅ `apps/api/src/modules/deal-health/deal-health.worker.ts` |
| C7.8 | BUILD | Deal Health Dashboard UI (Screen 14) | [x] ✅ `apps/web/src/features/deal-health/DealHealthDashboardPage.tsx` |

### Step C8 — Reporting
| # | Type | Task | Status |
|---|---|---|---|
| C8.1 | LEARN | Read §A7, UC-21–22 — reporting requirements | [x] |
| C8.2 | BUILD | Sales performance query | [x] ✅ `apps/api/src/modules/reporting/reporting.service.ts` |
| C8.3 | BUILD | Product + approval reports | [x] ✅ `apps/api/src/modules/reporting/reporting.service.ts` |
| C8.4 | BUILD | Reporting endpoints | [x] ✅ `apps/api/src/modules/reporting/reporting.controller.ts` |
| C8.5 | BUILD | Report export (CSV/JSON) | [x] ✅ `apps/api/src/modules/reporting/reporting.controller.ts::export` |
| C8.6 | BUILD | Reporting page UI (Screen 15) | [x] ✅ `apps/web/src/features/reporting/ReportingPage.tsx` |

**Lane C total: 46 micro-steps (ALL 46 COMPLETED ✅)**

---

## Phase 2 — Integration

| # | Task | Status | Owner pair |
|---|---|---|---|
| I1 | Wire Contract 1 — Lane B calls Lane A's `evaluateAndRoute()` | [x] ✅ | A + B |
| I2 | Wire Contract 2 — Lane A calls Lane C's `resolvePrice()` | [x] ✅ | A + C |
| I3 | Wire Contract 3 — Lane B's confirm calls Lane C's `createFromConfirmedQuotation()` | [x] ✅ | B + C |
| I4 | Full flow: Login → Quote → Discount → Approval → Portal → Negotiate → Re-approve → Confirm → Fulfill → Invoice → Pay | [x] ✅ | All |
| I5 | Cross-lane auth test | [x] ✅ | All |

---

## Phase 3 — Polish & Demo

| # | Task | Status | Owner |
|---|---|---|---|
| P1 | Error states + toast notifications | [x] ✅ | All |
| P2 | Loading states + skeleton screens | [x] ✅ | All |
| P3 | Seed data hardening for demo | [x] ✅ | All |
| P4 | Demo script — exact 5-minute walkthrough | [ ] | All |
| P5 | Architecture diagram (deliverable) | [x] ✅ | First done |
| P6 | "What we'd build next" write-up | [ ] | All |
| P7 | Final smoke test on clean DB | [x] ✅ | All |

---

## Quick Test Flow Verification (§9)

- [x] 1. Sign up / log in, configure discount tier + warehouse + subscription
- [x] 2. Create quotation, add product with discount above ceiling
- [x] 3. Confirm → auto-routes for approval
- [x] 4. Accept upsell → total + margin update immediately
- [x] 5. Approve → stock pulled from correct warehouse, splits if needed
- [x] 6. One-time + recurring billed correctly and separately
- [x] 7. Customer portal → request bigger discount → re-enters approval
- [x] 8. Confirm order, record payment, invoice status updates

---

## Totals

| Lane | Micro-steps | Completed | Remaining | Estimated time remaining |
|---|---|---|---|---|
| **Foundation (Phase 0)** | 10 | 10 | 0 | **0 hrs (COMPLETE ✅)** |
| **Lane A** | 44 | 44 | 0 | **0 hrs (COMPLETE ✅)** |
| **Lane B** | 35 | 35 | 0 | **0 hrs (COMPLETE ✅)** |
| **Lane C** | 46 | 46 | 0 | **0 hrs (COMPLETE ✅)** |
| **Integration** | 5 | 5 | 0 | **0 hrs (COMPLETE ✅)** |
| **Polish & Verification** | 7 | 5 | 2 | ~0.5 hrs |

> **Note:** Lane A and Lane C have more micro-steps than available solo hours. Prioritize: core flows first (A1–A4, C1–C5 are critical), nice-to-haves last (A5 recommendations, C8 reporting). If running short, recommendations and export can be simplified.
