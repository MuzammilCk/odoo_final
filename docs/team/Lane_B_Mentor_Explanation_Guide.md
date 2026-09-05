# DealFlow360 — Lane B: Fulfillment & Customer Loop
## Mentor & Judge Explanation Guide (Master Study Sheet)

> **Purpose:** This guide walks you through every line of code, architecture decision, security boundary, and concurrency pattern implemented in **Lane B (Fulfillment & Customer Loop)**. Use this to prepare for mentor reviews and judge Q&A.

---

## 1. The 30-Second Elevator Pitch

> *"In DealFlow360, Lane B owns the entire post-commercial lifecycle: the customer-facing portal with interactive negotiations, multi-precondition deal confirmation, and the transactional warehouse allocation engine.*
> 
> *Our biggest engineering challenges were:*
> 1. *Enforcing a zero-trust **security boundary** between internal commercial margins and customer views.*
> 2. *Managing a commercial **version-increment loop** during negotiations that prevents stale approvals.*
> 3. *Solving **multi-depot inventory concurrency** using PostgreSQL row-level locks (`SELECT FOR UPDATE`) so simultaneous orders can never double-reserve physical stock.*
> 
> *We vertical-sliced this completely from PostgreSQL transactions and Express middleware up to responsive React interfaces."*

---

## 2. Lane B File Architecture Overview

All Lane B files live in these modular directories:

```text
apps/api/src/modules/
├── portal/
│   ├── portal.middleware.ts    ← Tenant isolation & CUSTOMER role boundary
│   ├── portal.service.ts       ← 5-precondition confirmation & confirmation logic
│   └── portal.controller.ts    ← Safe GET /quotations, negotiate, and confirm endpoints
├── negotiations/
│   ├── negotiation.service.ts  ← Request creation, rep resolution, version++, Contract 1
│   └── negotiation.controller.ts ← Internal rep negotiation view & resolution endpoints
├── inventory/
│   ├── inventory.service.ts    ← SELECT FOR UPDATE locking, stock queries, ranking, release
│   └── inventory.controller.ts ← Warehouse management, replenishment simulation, release
├── fulfillment/
│   ├── services/
│   │   └── allocation-engine.service.ts ← Greedy multi-depot algorithm & acceptAllocation
│   └── fulfillment.controller.ts        ← List, detail, allocate, accept-split, override
├── backorders/
│   ├── backorder.service.ts    ← Backorder shortfall tracking & consolidation logic
│   └── backorder.controller.ts ← List open backorders, trigger stock consolidation
└── test-lane-b.ts              ← Automated verification & multi-request concurrency test

apps/web/src/features/
├── portal/
│   ├── PortalQuotationListPage.tsx   ← Customer portal quotes table
│   ├── PortalQuotationDetailPage.tsx ← Customer quote detail (0 internal fields)
│   └── components/
│       ├── NegotiationPanel.tsx      ← Counter-discount, change request, and comment UI
│       └── ConfirmButton.tsx         ← Preconditioned confirmation button & modal
└── fulfillment/
    ├── FulfillmentListPage.tsx       ← Screen 7: Operations fulfillment dashboard
    └── FulfillmentDetailPage.tsx     ← Screen 8: Warehouse split table & manual override modal
```

---

## 3. Deep Dive 1: Customer Portal Security Boundary

### Files to show:
- [`apps/api/src/modules/portal/portal.middleware.ts`](file:///d:/projects/dreamflow/apps/api/src/modules/portal/portal.middleware.ts)
- [`apps/api/src/modules/portal/portal.controller.ts`](file:///d:/projects/dreamflow/apps/api/src/modules/portal/portal.controller.ts)

### The Concept:
The customer portal `/portal/*` is not just a different theme; it is a **strict zero-trust security boundary**. If the API simply fetched internal quote rows, a tech-savvy user opening browser DevTools would immediately inspect internal gross margins, vendor costs, and risk ratings.

### Key Code Mechanisms:
1. **`requirePortalAccess`**:
   - Blocks internal roles (`SALES_REP`, `MANAGER`, `FINANCE_OPS`, `ADMIN`) and unauthenticated users with `403 Forbidden ("Portal access denied")`.
2. **`requireQuotationOwnership`**:
   - Prevents **Insecure Direct Object Reference (IDOR)** / cross-tenant leakage.
   - Compares the quotation's `customerId` against the authenticated user's `req.user.customerId`.
   - If Customer A alters the URL parameter to Customer B's quote ID, the database query identifies the mismatch and halts with `403 Forbidden ("Not authorized for this quotation")`.
3. **Customer-Safe Projection**:
   - `portal.controller.ts` uses explicit Prisma `select` blocks to only query customer-visible fields.
   - Only statuses `APPROVED`, `UNDER_NEGOTIATION`, and `CONFIRMED` are accessible. `DRAFT` quotes are blocked.

### The "5 Prohibited Fields" (Mentor Question):
If a mentor asks: *"What 5 fields must never appear in the portal?"*
1. **`margin_amount` & `margin_percent`**: Reveals company profitability, destroying negotiation leverage.
2. **`estimated_cost` / `estimatedUnitCost`**: Proprietary vendor acquisition prices.
3. **`blended_risk_score` & `risk_level`**: Internal sales governance metrics.
4. **`discount_overage_percent` & `allowed_discount_percent`**: Proprietary internal tier discount ceilings.
5. **`approval_requests` / `approval_steps`**: Internal management notes, reviewer identities, and discussion comments.

---

## 4. Deep Dive 2: Negotiation Engine & Stale Approvals

### Files to show:
- [`apps/api/src/modules/negotiations/negotiation.service.ts`](file:///d:/projects/dreamflow/apps/api/src/modules/negotiations/negotiation.service.ts)
- [`apps/api/src/modules/negotiations/negotiation.controller.ts`](file:///d:/projects/dreamflow/apps/api/src/modules/negotiations/negotiation.controller.ts)

### The Lifecycle Flow:
```text
Quotation APPROVED (v1)
        ↓
Customer submits NegotiationRequest (COUNTER_DISCOUNT / CHANGE_REQUEST)
        ↓
Quotation transitions to UNDER_NEGOTIATION (Customer sees live status)
        ↓
Sales Rep reviews in /app/quotations/:id/negotiations
        ↓
Rep accepts with adjusted discount (e.g. 11%)
        ↓
Quotation currentVersion INCREMENTS (v1 → v2) (Material Edit)
        ↓
Recalculate line totals, discounts, taxes, and margins
        ↓
Evaluate Governance (Contract 1: evaluateAndRoute)
        ↓
Requires Approval?
  ├── YES → Quotation status = PENDING_APPROVAL (Customer waits for management)
  └── NO  → Quotation status = UNDER_NEGOTIATION (Ready for customer confirmation)
```

### Key Technical Questions & Answers:

#### Q: "Why can't a customer negotiate a DRAFT quotation?"
**Answer:** A `DRAFT` is an internal working document. The sales rep is still building products, applying initial discounts, and adjusting prices. It has not yet passed internal governance or manager review. Customers shouldn't even know it exists until it is officially `APPROVED` and sent.

#### Q: "Why does accepting a discount increment `current_version`?"
**Answer:** Under commercial rule §6.4, changing discount, price, or quantity is a **material edit**. Incrementing `currentVersion` guarantees auditability and prevents **stale approvals**. An approval granted for Version 1 is legally and commercially bound to Version 1's snapshot (`ApprovalRequest.quotationVersion === 1`). If the terms change in Version 2, the prior approval is voided, preventing unauthorized discount inflation.

---

## 5. Deep Dive 3: Quotation Confirmation (The 5 Preconditions)

### Files to show:
- [`apps/api/src/modules/portal/portal.service.ts`](file:///d:/projects/dreamflow/apps/api/src/modules/portal/portal.service.ts)

### The 5 Preconditions:
Before a deal can transition to `CONFIRMED`, `validateConfirmation(quotationId, customerId)` enforces:
1. **Tenant Authorization:** The quotation's `customerId` matches the customer.
2. **Customer-Visible Status:** Status must be `APPROVED` or `UNDER_NEGOTIATION`. `DRAFT`, `REJECTED`, or `PENDING_APPROVAL` quotes fail.
3. **Not Already Confirmed:** Idempotency guard against double-confirmation.
4. **Completed Approvals:** If approval requests exist, the latest must have status `APPROVED`.
5. **Approval Freshness (Anti-Tampering):** The latest approval's `quotationVersion` must strictly equal `quotation.currentVersion`. If a rep altered terms after approval, confirmation is blocked until re-approved.

When confirmed, `confirmQuotation`:
- Sets `status = CONFIRMED`, records `confirmedAt = new Date()`.
- Records an immutable `AuditLog` entry (`AuditAction.QUOTATION_CONFIRMED`).
- Provides the integration hook for **Contract 3** (`SubscriptionService.createFromConfirmedQuotation`).

---

## 6. Deep Dive 4: Warehouse Allocation & Concurrency (The Deep Tech)

### Files to show:
- [`apps/api/src/modules/inventory/inventory.service.ts`](file:///d:/projects/dreamflow/apps/api/src/modules/inventory/inventory.service.ts)
- [`apps/api/src/modules/fulfillment/services/allocation-engine.service.ts`](file:///d:/projects/dreamflow/apps/api/src/modules/fulfillment/services/allocation-engine.service.ts)
- [`apps/api/test-lane-b.ts`](file:///d:/projects/dreamflow/apps/api/test-lane-b.ts)

This is the most critical code in Lane B.

### 1. Physical Stock Formula (§6.2 Rule 11)
$$\text{Available Stock} = \text{Quantity On Hand} - \text{Quantity Reserved}$$
Available stock is **never** stored as a static column; it is computed dynamically to avoid synchronization drift.

### 2. The Concurrency Problem: TOCTOU (Time-Of-Check to Time-Of-Use)
Suppose Warehouse A has 10 units on hand and 0 reserved (Available = 10).
- Order 1 needs 8 units.
- Order 2 needs 7 units (simultaneous).

**Without Row-Level Locking (Broken):**
1. Transaction 1 reads: 10 available $\ge$ 8. Valid!
2. Transaction 2 reads: 10 available $\ge$ 7. Valid!
3. Transaction 1 reserves 8 $\rightarrow$ Reserved = 8.
4. Transaction 2 reserves 7 $\rightarrow$ Reserved = 15.
5. **Result:** 15 units reserved on 10 units physical inventory $\rightarrow$ **Physical Over-Allocation Disaster**.

**With `SELECT ... FOR UPDATE` (Our Solution):**
```sql
SELECT id, warehouse_id, product_id, quantity_on_hand, quantity_reserved
FROM stock_levels
WHERE (warehouse_id, product_id) IN (VALUES (...))
ORDER BY warehouse_id, product_id
FOR UPDATE;
```
1. Transaction 1 arrives and places an **exclusive row-level write lock** on the stock row.
2. Transaction 2 attempts to select `FOR UPDATE` and is **blocked at the PostgreSQL kernel level**.
3. Transaction 1 re-reads available stock (10), increments `quantity_reserved` to 8, commits, and releases the lock.
4. Transaction 2 immediately unblocks, reads the fresh committed state (10 on hand, 8 reserved $\rightarrow$ **2 available**).
5. Transaction 2's validation check fails: `Insufficient stock: 2 available, 7 requested`.
6. **Result:** Zero data corruption. Exact inventory integrity.

### 3. Why `ORDER BY warehouse_id, product_id` Matters (Deadlock Prevention)
If Order 1 locks Laptop then Monitor, while Order 2 locks Monitor then Laptop, PostgreSQL can encounter a circular dependency (**deadlock**), aborting transactions.
By sorting the target keys deterministically before issuing `FOR UPDATE`, all transactions acquire row locks in the **exact same global order**, mathematically eliminating deadlocks.

### 4. Greedy Allocation Algorithm (§6.27)
Located in `allocation-engine.service.ts`:
1. **Single-Depot Preference:** If a warehouse can fulfill 100% of a line's quantity, it is prioritized over smaller depots to minimize multi-box shipping costs.
2. **Shipping Cost Weight:** Depots with lower `shippingCostWeight` (e.g. 1.0x vs 1.5x) are prioritized next.
3. **Split & Backorder:** If the best warehouse only has 60 of 100 needed:
   - Allocate 60 from Warehouse 1.
   - Greedily allocate 40 from Warehouse 2.
   - If network-wide stock is short, remaining units automatically generate a `Backorder` record with status `OPEN`.

### 5. Backorder Consolidation Lifecycle (§6.32)
When replenishment stock arrives:
- `PATCH /api/v1/internal/stock/:id` updates on-hand stock and scans for open backorders.
- `POST /api/v1/internal/backorders/:id/consolidate` locks the newly arrived stock, creates a new `FulfillmentAllocation`, decrements the open backorder, and marks it resolved once the shortfall hits 0.

---

## 7. Deep Dive 5: Frontend Architecture (`apps/web`)

### Separate Layouts for Hard Role Isolation:
1. **Customer Portal (`/portal/*`)**:
   - Wrapped by `PortalLayout.tsx`.
   - Sleek dark theme (`bg-gray-950`).
   - Only navigation is "My Quotations" and Sign Out.
   - Absolutely no admin links, financial margin cards, or internal metrics.
2. **Internal App (`/app/*`)**:
   - Wrapped by `AppLayout.tsx`.
   - Operations sidebar including "Fulfillment Operations" (`/app/fulfillment`).

### Key User Features:
- **`PortalQuotationListPage`**: High-level table of customer's active commercial offers.
- **`PortalQuotationDetailPage`**: Line-by-line commercial terms, totals, plus interactive `NegotiationPanel` (counter-offers & history) and `ConfirmButton` (modal confirmation).
- **`FulfillmentListPage`**: Operations view filtering by `All`, `Awaiting Allocation`, `Backorders / Partial`, and `Allocated`.
- **`FulfillmentDetailPage`**: Suggested warehouse split table with shipping cost indicators, an **"Accept Suggested Split"** action button, and an interactive **"Manual Override"** modal.

---

## 8. Mentor / Judge Q&A Cheat Sheet

| Question | Short, Impressive Answer |
|---|---|
| **"Why raw SQL for stock reservation instead of plain Prisma?"** | *"Prisma does not support `SELECT ... FOR UPDATE` natively. Plain Prisma queries use optimistic concurrency or non-locking reads which suffer from TOCTOU race conditions under load. We used raw SQL within an interactive transaction to get true PostgreSQL row-level locks."* |
| **"What happens if two users checkout the last item simultaneously?"** | *"The first transaction locks the stock row. The second transaction waits at the DB level. When the first commits, the second transaction reads the updated `quantity_reserved`, detects 0 available, and cleanly throws an Insufficient Stock exception."* |
| **"Why do you sort the keys in `reserveStock`?"** | *"To prevent database deadlocks. If two transactions try to lock multiple stock rows in opposing orders, they can deadlock. Sorting by `(warehouse_id, product_id)` ensures a deterministic global locking order across all connections."* |
| **"What prevents Customer A from modifying another customer's quote?"** | *"Our `requireQuotationOwnership` middleware. It extracts the customer's organization from their verified JWT and ensures the requested quotation record belongs to that exact tenant before executing any controller logic."* |
| **"Why not just let customers edit the quote lines directly?"** | *"Because a quotation is a binding commercial document. Customers propose counter-offers through negotiation requests. If the rep accepts, `currentVersion` increments, invalidating prior management approvals and forcing re-evaluation if discount ceilings are exceeded."* |
| **"Does a backorder create a new quotation?"** | *"No, per spec §6.31, backorders preserve the original quotation and line item identity. They track unfulfilled quantity and consolidate onto the original deal once inventory arrives."* |

---

## 9. Live Demo Walkthrough Script

When presenting to your mentor or judges:

1. **Show the Security Boundary**:
   - Log in as `customer@acme.com` / `demo123`.
   - You land on `/portal/quotations`.
   - Click into a quote. Show that margins, cost of goods, and risk scores are **completely absent** from the UI and Network tab.
2. **Demonstrate Negotiation & Stale Approval Prevention**:
   - Submit a counter-discount request for 11%.
   - Notice the status immediately updates to `UNDER_NEGOTIATION`.
   - Switch users or demonstrate the rep endpoint resolving it. Show that `currentVersion` increments from `v1` $\rightarrow$ `v2`.
3. **Show Confirmation Preconditions**:
   - Click "Accept & Confirm Quotation". Show the confirmation modal.
   - Explain how the backend validates all 5 preconditions (including the version match check).
4. **Demonstrate Warehouse Allocation Engine**:
   - Log in as `finance@demo.com` or `admin@demo.com` and go to `/app/fulfillment`.
   - Open quotation `Q-1004` (requires 60 laptops when only 55 exist across all warehouses).
   - Show how the greedy allocation engine splits 40 units to Main Warehouse, 15 units to East Depot, and automatically designates 5 units as an open **Backorder**.
5. **Run the Automated Concurrency Test**:
   - In terminal, run: `npx tsx test-lane-b.ts`.
   - Show the mentor the simultaneous 8-unit and 7-unit reservation race test: one succeeds, one safely fails, and total reserved stock strictly equals physical stock.
