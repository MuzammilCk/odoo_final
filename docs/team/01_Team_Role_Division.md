# DealFlow360 — Team Role Division

> **CURRENT STATUS (2026-09-05): ✅ PHASE 0 FOUNDATION COMPLETE & PUSHED TO MAIN**
> Commit `1471dc0` on branch `main` contains the complete monorepo, 25-table Prisma schema, migration, seed fixtures, auth/RBAC shell, and frontend layouts.
> **Teammates:** Pull `main` (`git pull origin main`), follow the 7-step bootstrap in [00_How_To_Use_Control_Files.md](file:///d:/projects/dreamflow/docs/team/00_How_To_Use_Control_Files.md), create your feature branch, and build!

## The split, and why

Three people, one business flow that reads sequentially on paper (quote → approve → negotiate → confirm → fulfill → bill). Splitting by "who does frontend / who does backend" leaves two people blocked most of the day waiting on the third. Splitting by **business domain** — where each person owns a vertical slice from database to UI — is what actually lets three people work at once, because Sections 5–7 already hand you the exact schema and API contract for your slice. You're not designing together under time pressure; you're each implementing independently from a blueprint that's already been agreed on.

Screen count below looks uneven (7 / 3 / 8) — that is not a workload gap. Lane B has the fewest screens and the hardest problem in the entire system: concurrent inventory locking and the negotiation re-approval loop. Weigh lanes by difficulty, not screen count.

---

## Lane A — Commercial Core
*Use cases UC-01, UC-03, UC-05–UC-11*

The engine that makes this a "self-governing deal engine" instead of a quote form: quotation building, discount/risk evaluation, automatic approval routing, and recommendations.

| | |
|---|---|
| **Screens** | 1 (Login), 2 (Dashboard), 3 (Quotations List), 4 (Quotation Detail), 5 (Approvals List), 6 (Approval Detail), 18 (Discount/Approval Config) |
| **Tables (primary)** | `users`, `quotations`, `quotation_lines`, `approval_requests`, `approval_steps`, `discount_tiers`, `category_discount_ceilings` |
| **API namespace** | `/api/v1/auth/*`, `/api/v1/internal/quotations/*`, `/api/v1/internal/approvals/*`, `/api/v1/internal/discount-tiers/*`, `/api/v1/internal/discount-rules/*`, `/api/v1/internal/approval-config`, `/api/v1/internal/dashboard` |
| **Domain services** | `AuthService`, `QuotationService`, `DiscountRiskService`, `ApprovalService`, `RecommendationService` |
| **Backend folder** | `apps/api/src/modules/{auth,quotations,approvals,recommendations,discount-config}/` |
| **Frontend folder** | `apps/web/src/features/{auth,dashboard,quotations,approvals,admin/discount-config}/` |

## Lane B — Fulfillment & Customer Loop
*Use cases UC-12–UC-16*

Everything that happens once a quote leaves the internal team: the customer portal, negotiation, confirmation, and the warehouse/backorder engine.

| | |
|---|---|
| **Screens** | 7 (Fulfillment List), 8 (Fulfillment Detail), 11 (Customer Portal) |
| **Tables (primary)** | `negotiation_requests`, `warehouses`, `stock_levels`, `fulfillment_allocations`, `backorders` |
| **API namespace** | `/api/v1/portal/*`, `/api/v1/internal/fulfillment/*`, `/api/v1/internal/backorders/*`, `/api/v1/internal/warehouses/*`, `/api/v1/internal/stock/*` |
| **Domain services** | `NegotiationService`, `FulfillmentService`, `InventoryService` |
| **Backend folder** | `apps/api/src/modules/{portal,negotiations,fulfillment,inventory,backorders}/` |
| **Frontend folder** | `apps/web/src/features/{portal,fulfillment}/` |

## Lane C — Money & Monitoring
*Use cases UC-02, UC-04, UC-17–UC-22*

Everything downstream of a confirmed, fulfilled order — billing, subscriptions, payments — plus the two "smart platform" differentiators: Deal Health and reporting. Product/pricing admin lives here too, since the wireframe bundles price-list entries directly onto the Product Details screen.

| | |
|---|---|
| **Screens** | 9 (Subscriptions), 10 (Billing Detail), 12 (Invoices List), 13 (Invoice Detail), 14 (Deal Health), 15 (Admin Reporting), 16 (Product Dashboard), 17 (Product Details) |
| **Tables (primary)** | `products`, `product_variants`, `categories`, `price_list_entries`, `subscription_instances`, `invoices`, `payments`, `credit_notes`, `deal_health_flags` |
| **API namespace** | `/api/v1/internal/products/*`, `/api/v1/internal/price-lists/*`, `/api/v1/internal/subscription-config`, `/api/v1/internal/subscriptions/*`, `/api/v1/internal/invoices/*`, `/api/v1/internal/payments/*`, `/api/v1/internal/credit-notes/*`, `/api/v1/internal/deal-health/*`, `/api/v1/internal/reports/*` |
| **Domain services** | `ProductService`, `PriceListService`, `SubscriptionService`, `BillingService`, `PaymentService`, `DealHealthService`, `ReportingService` |
| **Backend folder** | `apps/api/src/modules/{products,subscriptions,billing,payments,deal-health,reporting}/` |
| **Frontend folder** | `apps/web/src/features/{subscriptions,billing,invoices,deal-health,reporting,admin/products}/` |

---

## The one shared file: `prisma/schema.prisma`

Section 5 already specifies every table, column, and constraint — there's nothing left to *design*, only to *transcribe*. Transcribe it **once, together, in the Foundation phase** (see the tracker), run the migration, then treat the file as closed. If someone genuinely needs a new field mid-hack, say so in the team channel before editing — a two-line heads-up beats a merge conflict at hour 20.

Every other table — `users`, `quotations`, `products`, etc. — is a live Postgres row set, not a source file. All three of you can freely `SELECT` from any table at any time. "Ownership" above means *who writes the business logic that changes that table's state*, not who's allowed to query it. Reading across lanes is normal and expected; writing another lane's domain logic is not.

---

## The 5 integration contracts

The business flow is sequential, but you don't have to build it in that order or wait on each other — as long as you agree on these five shapes *now* and build against a stub until the real thing exists.

**Contract 1 — Lane A provides, Lane B consumes.**
After a negotiation changes quotation terms, governance has to re-run:
```ts
DiscountRiskService.evaluateAndRoute(quotationId: string):
  Promise<{ requiresApproval: boolean; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' }>
```
Until Lane A's real version exists, Lane B stubs it to always return `{ requiresApproval: false, riskLevel: 'LOW' }` and keeps building the negotiation flow.

**Contract 2 — Lane C provides, Lane A consumes.**
Lane A needs the resolved price for a quotation line:
```ts
PriceListService.resolvePrice(productId: string, discountTierId: string, currencyCode: string):
  Promise<{ unitPrice: number; source: 'PRICE_LIST' | 'BASE' }>
```
Stub: return the product's `base_price` with `source: 'BASE'` until Lane C's real pricing rules land.

**Contract 3 — Lane B provides (at confirmation), Lane C consumes.**
When a quotation is confirmed, any recurring lines need to become subscriptions:
```ts
SubscriptionService.createFromConfirmedQuotation(quotationId: string): Promise<void>
```
Lane C builds this; Lane B's confirm-quotation handler calls it. Lane B can leave `// TODO: call SubscriptionService.createFromConfirmedQuotation — wire at Checkpoint 2` and move on — it doesn't block anything.

**Contract 4 — read-only, no function needed.**
Lane C's billing logic needs to know what's actually shipped before invoicing (Section 6.38 — "nothing is billed before it ships"). Lane C reads `fulfillment_allocations.status` directly. A plain query, not a call into Lane B's code.

**Contract 5 — read-only, no function needed.**
Lane A's recommendation engine reads `products` / `categories` directly for candidates. No call into Lane C's service required.

Contracts 1–3 are the ones to actually agree on out loud before splitting up. 4–5 just need everyone to know the tables are open for reading.

---

## Seed fixtures every lane needs (Loaded & Verified in `prisma/seed.ts` ✅)

This is what makes real parallel work possible — nobody should ever be blocked waiting for another lane's flow to reach a particular state, because the fixture already puts them there:

- [x] **Quotation states:** One quotation in `DRAFT` (`quote-1-draft`), one in `PENDING_APPROVAL` (`quote-2-pending`), one in `UNDER_NEGOTIATION` (`quote-3-negotiating`), and **one already `CONFIRMED`** (`quote-4-confirmed`) with real lines — Lane A and Lane B can test transitions immediately.
- [x] **Hybrid billing fixture:** The confirmed quotation includes **both** a hardware line (Widget Pro) and a subscription-capable recurring line (Enterprise Cloud Suite), so Lane C can build hybrid billing against it on day one.
- [x] **Fulfilled allocation:** At least one `FulfillmentAllocation` already `FULFILLED` — so Lane C can build one-time invoicing without waiting on Lane B's allocation engine.
- [x] **Deal Health fixtures:** One quotation with `updated_at` set 4 days in the past (`quote-5-stalled` triggering `STALLED`), and one sales rep (`rep2@demo.com`) whose historical quotes have high discount overage triggering `DISCOUNT_ANOMALY` — Lane C can test Deal Health immediately.
- [x] **Warehouse split & backorder:** Widget Pro stock split across North Warehouse (10 units) and South Warehouse (5 units), with total quantity (15) lower than the confirmed order (20) — gives Lane B a guaranteed split-fulfillment-plus-backorder (5 units) scenario immediately.
- [x] **Active subscription instance:** Seeded with 30-day active period for Lane C's subscription lifecycle and recurring invoice tests.

All fixtures loaded and verified via `npx prisma db seed`.

---

## Suggested assignment (flexible — reassign to actual strengths)

Whoever is strongest at end-to-end state-machine thinking should take **Lane A** — it's the highest-visibility lane for the demo, and probably worth pairing with whoever's narrating the pitch. **Lane B** rewards someone comfortable with transactions and locking. **Lane C** has the most screens but the most self-contained logic — a good fit for whoever wants to move fast without waiting on anyone else early on.
