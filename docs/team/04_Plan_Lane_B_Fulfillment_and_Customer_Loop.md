# DealFlow360 — Lane B: Fulfillment & Customer Loop — Full Implementation Plan

> **Owner:** Lane B team member
> **Use cases:** UC-12–UC-16
> **Screens:** 7 (Fulfillment List), 8 (Fulfillment Detail), 11 (Customer Portal)
> **Micro-steps:** 35 total — each one produces ~30–80 lines of code you can explain
> **Foundation status:** ✅ Phase 0 Foundation is COMPLETE & PUSHED (`1471dc0`). Pull `main` before starting!
> **Ready fixtures in DB:**
> - `customer@acme.com` / `demo123` (Acme Corp, customerId linked in JWT)
> - Quotation `quote-3-negotiating` (UNDER_NEGOTIATION) for testing negotiation flow
> - Quotation `quote-4-confirmed` (CONFIRMED) for testing confirmation & allocations
> - Widget Pro split across North Warehouse (10 units) and South Warehouse (5 units), 5 units backorder

---

## Your domain in one paragraph

You own the two hardest systems in DealFlow360: the customer-facing portal with live negotiation, and the concurrent-inventory warehouse allocation engine. Your screens are few (3), but your problems are deep — row-level locking for stock, the re-approval feedback loop during negotiation, and the split-fulfillment + backorder lifecycle. When you're done, a customer can view their quotation in a restricted portal, negotiate terms, confirm the deal (triggering re-approval if needed), and an operations user can accept a warehouse split, handle partial fulfillment, and manage backorders — all transactionally safe.

---

## What you DON'T own (and how you interact)

- **Quotation creation / discount governance / approval** → Lane A owns. After negotiation changes terms, you call Lane A's `DiscountRiskService.evaluateAndRoute()` (Contract 1). Until Lane A builds it, stub it to return `{ requiresApproval: false, riskLevel: 'LOW' }`.
- **Subscription creation from confirmed quotation** → Lane C owns the implementation. Your confirmation handler calls `SubscriptionService.createFromConfirmedQuotation()` (Contract 3). Until Lane C builds it, leave a `// TODO` comment.
- **Products / Billing / Invoices** → Lane C owns. You don't touch these.
- **Auth** → Built in Foundation. You reuse JWT middleware (`authenticateToken` in [auth.middleware.ts](file:///d:/projects/dreamflow/apps/api/src/modules/auth/auth.middleware.ts)) and RBAC guards (`requireRole` in [rbac.middleware.ts](file:///d:/projects/dreamflow/apps/api/src/modules/auth/rbac.middleware.ts)). Frontend portal shell layout already created in [PortalLayout.tsx](file:///d:/projects/dreamflow/apps/web/src/layouts/PortalLayout.tsx).

---

## Step B1 — Customer Portal Auth + Shell

### B1.1 — LEARN: Portal isolation rules
- **Read:** §8.21 (customer portal isolation), §7.2 (API namespace)
- **Understand:** Why separate `/api/v1/portal/*` from `/api/v1/internal/*`? What data must NEVER reach the portal?
- Make a list:
  ```
  NEVER expose to customers:
  ❌ internal margin
  ❌ estimated cost
  ❌ risk score / blended risk
  ❌ approval notes / reviewer comments
  ❌ Deal Health flags
  ❌ warehouse operational data
  ```
- **Explain check:** *"Why is this a security boundary and not just a visual distinction?"* (Answer: if the API itself doesn't filter, a tech-savvy customer could see internal margins by inspecting network requests)

### B1.2 — BUILD: Portal middleware
- Create `apps/api/src/modules/portal/portal.middleware.ts`
- `requirePortalAccess()` — verify user.role === 'CUSTOMER'
- `requireQuotationOwnership(req)` — verify `quotation.customer_id === req.user.customerId`
- **~25 lines.**
- **Verify:** Call as SALES_REP → 403. Call as CUSTOMER on another customer's quote → 403.
- **Explain check:** *"Can a Customer A see Customer B's quotation? What stops them?"*

### B1.3 — BUILD: Portal routes + controller shell
- Create `apps/api/src/modules/portal/portal.controller.ts`
- Register under `/api/v1/portal/*` — completely separate from internal routes
- Apply `authenticateToken` + `requirePortalAccess` middleware
- **~20 lines** (just the route registration, no handlers yet).
- **Verify:** Hit `/api/v1/portal/quotations` as internal user → 403. As CUSTOMER → 200 (empty for now).

### B1.4 — BUILD: Portal frontend shell
- Create `apps/web/src/features/portal/PortalLayout.tsx`
- Different nav from internal (no admin links, no dashboard, no approvals)
- Different color scheme / branding to make it visually distinct
- Portal login at `/portal/login`
- **~50 lines.**
- **Verify:** Open `/portal` → see portal-branded layout, not internal app
- **Explain check:** *"How can a judge tell this is a real separate portal and not the internal app with a different CSS class?"* (Answer: separate routes, separate API namespace, separate auth middleware, different navigation)

---

## Step B2 — Customer Portal Quotation View

### B2.1 — BUILD: Portal quotation list endpoint
- Add to `portal.controller.ts`:
- `GET /api/v1/portal/quotations` — list quotations for this customer ONLY
  - Filter: only customer-visible statuses (APPROVED, UNDER_NEGOTIATION, CONFIRMED)
  - Always filter by `quotation.customer_id === currentUser.customerId`
- **~25 lines.**
- **Verify:** Log in as customer@acme.com → see only Acme Corp's quotations. Log in as another customer → see different quotes.
- **Explain check:** *"What statuses are visible to customers? Can they see a DRAFT quotation?"* (Answer: no — DRAFT is internal-only. Customers see APPROVED/sent, UNDER_NEGOTIATION, CONFIRMED)

### B2.2 — BUILD: Portal quotation detail endpoint
- `GET /api/v1/portal/quotations/:id` — quotation detail, customer-safe fields ONLY
- Return: lines (product name, qty, unit_price, discount %, line_total), totals (subtotal, discount, tax, grand_total), status
- **Explicitly exclude:** margin_amount, margin_percent, estimated_cost, risk_score, discount_overage_percent, internal notes
- **~35 lines.**
- **Verify:** Compare output of portal endpoint vs internal endpoint for same quote — portal should be missing ~6 fields
- **Explain check:** *"If we forgot to filter `margin_percent` from the portal response, what could a customer learn?"* (Answer: they'd see our profit margin and could negotiate more aggressively)

### B2.3 — BUILD: Portal quotation list UI
- Create `apps/web/src/features/portal/PortalQuotationListPage.tsx`
- Simple table: quote number, status badge, grand total, date
- Click → navigate to detail
- **~40 lines.**
- **Verify:** Log in as customer → see their quotation list

### B2.4 — BUILD: Portal quotation detail UI
- Create `apps/web/src/features/portal/PortalQuotationDetailPage.tsx`
- Product lines table (no margin/cost columns), totals summary, status indicator
- Placeholder for negotiation panel (built next)
- **~50 lines.**
- **Verify:** Open a quotation → see all lines with correct totals, NO margin or cost visible
- **Explain check:** *"Can you show me where in the UI the customer would see internal cost? They shouldn't be able to."*

---

## Step B3 — Negotiation Engine

### B3.1 — LEARN: Negotiation flow
- **Read:** §6.21 (negotiation rules), UC-12 (negotiate quotation), UC-13 (re-evaluate terms)
- Draw the flow:
  ```
  Customer submits request → Sales Rep sees it → Rep resolves →
  If terms change → new version → re-evaluate risk →
  If risk requires approval → PENDING_APPROVAL (customer waits) →
  After approval → back to customer-visible
  ```
- **Explain check:** *"Why can't the customer directly edit the quotation? Why does it go through a 'request → resolve' flow?"* (Answer: §6.21 — customer doesn't directly modify internal fields like cost, margin. The request is a proposal; the rep decides what actually changes)

### B3.2 — BUILD: Negotiation request model + service
- Create `apps/api/src/modules/negotiations/negotiation.service.ts`
- Function: `createNegotiationRequest(quotationId, customerId, request)` →
  - Validate: quotation belongs to this customer, quotation is in negotiable state
  - Create NegotiationRequest record (type, content, proposedDiscount, lineId)
  - Set quotation status → UNDER_NEGOTIATION
  - Audit: NEGOTIATION_REQUESTED
- **~40 lines.**
- **Explain check:** *"What request types can a customer submit?"* (Answer: COMMENT, CHANGE_REQUEST, COUNTER_DISCOUNT, DELIVERY_DATE)

### B3.3 — BUILD: Negotiation request endpoint (customer-facing)
- Add to portal controller:
- `POST /api/v1/portal/quotations/:id/negotiate`
  - Body: `{ type, lineId?, content, proposedDiscount? }`
  - Ownership check, call service
- `GET /api/v1/portal/quotations/:id/negotiations` — list requests for this quotation
- **~30 lines.**
- **Verify:** As customer, submit a counter-discount request → quotation status changes to UNDER_NEGOTIATION
- **Explain check:** *"What stops a customer from submitting a negotiation on a CONFIRMED quotation?"* (Answer: validation check — quotation must be in a negotiable state)

### B3.4 — BUILD: Internal negotiation view endpoint
- `GET /api/v1/internal/quotations/:id/negotiations` — same data, but for sales rep
- **~15 lines.**
- **Verify:** Log in as rep → see incoming negotiation requests from customer

### B3.5 — BUILD: Sales rep response service
- Add: `resolveNegotiation(negotiationId, repId, accepted, adjustedDiscount?, comment)` →
  - If accepted with changes → update quotation line(s)
  - Increment `current_version` (material edit per §6.4)
  - Recalculate totals + margin using Lane A's calculator
  - Mark negotiation as resolved
  - Audit: NEGOTIATION_RESOLVED
- **~45 lines.**
- **Explain check:** *"Why does accepting a negotiation increment the quotation version?"* (Answer: the discount change is a material edit — it affects commercial value, margin, and potentially approval requirements)

### B3.6 — BUILD: Re-approval trigger (Contract 1 call)
- Add to `resolveNegotiation()`: after recalculating, call `DiscountRiskService.evaluateAndRoute(quotationId)`
- STUB for now: `return { requiresApproval: false, riskLevel: 'LOW' }`
- If `requiresApproval` → set quotation status → PENDING_APPROVAL
- If not → quotation stays customer-visible
- **~20 lines** (added to existing function).
- **Verify:** With stub, resolved negotiation keeps quotation customer-visible (no re-approval since stub always returns LOW)
- **Explain check:** *"When Lane A's real implementation is ready, what changes here?"* (Answer: just replace the stub import with the real service — the logic stays the same)

### B3.7 — BUILD: Sales rep response endpoint
- `POST /api/v1/internal/quotations/:id/negotiations/:nId/respond`
- Body: `{ accepted, adjustedDiscount?, comment }`
- Auth: SALES_REP or MANAGER
- **~25 lines.**
- **Verify:** Respond to a customer request → see quotation version increment, totals update

### B3.8 — BUILD: Negotiation UI — customer side
- Add to PortalQuotationDetailPage: negotiation panel
- Line-level comment input, counter-discount field, change request textarea
- "Submit Request" button, history of requests + responses
- **~60 lines.**
- **Verify:** As customer, submit a counter-discount → see it appear in history → rep responds → customer sees response

### B3.9 — BUILD: Negotiation UI — internal side
- Add to internal quotation view (or separate page `/app/quotations/:id/negotiations`)
- Incoming requests list, accept/reject/counter controls, response comment field
- **~50 lines.**
- **Verify:** Log in as rep → see customer's request → respond → customer sees updated quotation

---

## Step B4 — Quotation Confirmation

### B4.1 — LEARN: Confirmation rules
- **Read:** §6.20 (customer confirmation rule), §6.18 (approval validity)
- List the preconditions:
  ```
  ✓ customer is authorized for this quotation
  ✓ quotation is customer-visible (not rejected, not draft)
  ✓ all required approvals are complete
  ✓ approval_request.quotation_version === quotation.current_version
  ✓ quotation is not already confirmed
  ```
- **Explain check:** *"What happens if a customer tries to confirm a quotation where the approval was for version 1 but the quote is now version 2?"* (Answer: blocked — approval is stale, must re-evaluate)

### B4.2 — BUILD: Confirmation validation service
- Add to `portal.service.ts` or new file:
- Function: `validateConfirmation(quotationId, customerId)` → check all 5 preconditions, return `{ valid: boolean, reason?: string }`
- **~35 lines.**
- **Verify:** Call on approved quote at correct version → valid. Call on quote with stale approval → invalid with reason.
- **Explain check:** *"Walk me through each of the 5 confirmation preconditions."*

### B4.3 — BUILD: Confirm endpoint
- `POST /api/v1/portal/quotations/:id/confirm`
- Call validation → if valid: status = CONFIRMED, confirmed_at = now(), audit log
- Call Contract 3: `SubscriptionService.createFromConfirmedQuotation(quotationId)` → `// TODO` for now
- If stale approval → return error explaining why
- **~35 lines.**
- **Verify:** Confirm an approved, version-matching quotation → status = CONFIRMED
- **Explain check:** *"What downstream processes start after confirmation?"* (Answer: fulfillment allocation + subscription creation for recurring lines)

### B4.4 — BUILD: Confirm button UI
- Add to PortalQuotationDetailPage: "Confirm Quotation" button
- Only visible when quotation is confirmable (not draft, not already confirmed)
- Show error message if validation fails
- **~25 lines.**
- **Verify:** As customer, click Confirm → quotation status updates to CONFIRMED

---

## Step B5 — Warehouse Allocation Engine

### B5.1 — LEARN: Why row-level locking matters
- **Read:** §6.28 (inventory reservation transaction), §8.16 (inventory concurrency), §6.2 rules 11–13
- **Understand the problem:** Two users simultaneously allocating the same stock. Without locking:
  ```
  User1 reads: 10 available    User2 reads: 10 available
  User1 reserves 8             User2 reserves 7
  Result: 15 reserved out of 10 on hand ← BROKEN
  ```
  With SELECT FOR UPDATE:
  ```
  User1 locks row, reads 10, reserves 8, commits → 2 available
  User2 waits for lock, reads 2, can only reserve 2
  ```
- **Explain check:** *"What does SELECT FOR UPDATE do that a normal SELECT doesn't?"* (Answer: it locks the row so no other transaction can read-and-modify it until this transaction commits or rolls back)

### B5.2 — LEARN: Available stock formula
- **Read:** §6.2 rule 11, §6.26 (allocation inputs)
- Formula: `available_stock = quantity_on_hand - quantity_reserved`
- **Explain check:** *"If a warehouse has 100 units on hand but 60 are reserved, how many are available for a new order?"* (Answer: 40)

### B5.3 — BUILD: Available stock query
- Create `apps/api/src/modules/inventory/inventory.service.ts`
- Function: `getAvailableStock(productId)` → query all warehouses, calculate `available = on_hand - reserved` for each
- Return: `[{ warehouseId, warehouseName, available, shippingCostWeight }]`
- **~25 lines.**
- **Verify:** Call for seeded product with split stock → see correct available per warehouse
- **Explain check:** *"Can available stock ever be negative? What would that mean?"*

### B5.4 — BUILD: Warehouse ranking
- Add: `rankWarehouses(candidates)` → sort by:
  1. Can it satisfy the full quantity? (prefer full satisfaction from one warehouse to minimize shipments)
  2. Lower shipping_cost_weight is better
- **~20 lines.**
- **Explain check:** *"Why do we prefer one warehouse that can satisfy everything over two with lower shipping cost?"* (Answer: §6.27 — minimize unnecessary shipment count first, then consider cost)

### B5.5 — BUILD: Greedy allocation algorithm
- Create `apps/api/src/modules/fulfillment/services/allocation-engine.service.ts`
- Function: `calculateAllocation(quotationId)` →
  - For each quotation line: get available stock, rank warehouses, greedy-allocate
  - Return: `[{ lineId, warehouseId, allocatedQty }]` + backorder qty if any
- **~50 lines.** No stock changes yet — just the recommendation.
- **Verify:** Call on seeded confirmed quotation where stock is split → see split allocation + backorder for short product
- **Explain check:** *"Walk me through the greedy loop: what happens when the best warehouse can only fulfill 60 out of 100 needed?"* (Answer: allocate 60 from that warehouse, move to next warehouse with remaining 40, if no warehouse has enough → backorder the rest)

### B5.6 — BUILD: Allocation recommendation endpoint
- `POST /api/v1/internal/fulfillment/quotations/:id/allocate`
- Returns the recommendation (does NOT reserve stock yet)
- **~25 lines.**
- **Verify:** Call on confirmed quote → see split recommendation

### B5.7 — BUILD: Transactional stock reservation (THE CRITICAL PIECE)
- Add: `acceptAllocation(quotationId, allocations)` →
  ```ts
  await prisma.$transaction(async (tx) => {
    // Lock stock rows
    await tx.$queryRaw`
      SELECT * FROM stock_levels
      WHERE product_id = ${productId} AND warehouse_id = ANY(${warehouseIds}::uuid[])
      FOR UPDATE
    `;
    // Re-read current available (inside the lock!)
    // Validate: still enough stock?
    // UPDATE stock_levels SET quantity_reserved = quantity_reserved + allocated
    // INSERT fulfillment_allocations
    // INSERT backorders (if remaining)
    // INSERT audit_logs
  });
  ```
- **~60 lines.** This is the most complex micro-step — read every line carefully.
- **Verify:** Accept an allocation → check stock_levels.quantity_reserved increased by exact allocated amount
- **Explain check:** *"Why do we re-read the available stock INSIDE the transaction after locking, instead of trusting the recommendation?"* (Answer: between the recommendation and the accept, another user could have reserved stock. The locked re-read gives us the true current state.)

### B5.8 — BUILD: Accept split endpoint
- `POST /api/v1/internal/fulfillment/quotations/:id/accept-split`
- Calls `acceptAllocation()` with the recommended allocations
- **~20 lines.**
- **Verify:** Accept split → stock reserved → allocation records created

### B5.9 — BUILD: Manual override endpoint
- `POST /api/v1/internal/fulfillment/quotations/:id/override-split`
- Body: `{ allocations: [{ warehouseId, productId, quantity }] }`
- Validate: total override qty ≤ total available
- Same transactional reservation pattern
- **~30 lines.**
- **Verify:** Override with different warehouse allocation → stock reserved correctly

### B5.10 — BUILD: Backorder creation
- Inside `acceptAllocation()`, when `requested > available`:
  - `fulfill = available`, `backorder_qty = requested - available`
  - Create Backorder record with remaining quantity
- **~20 lines** (added to existing transaction).
- **Verify:** Accept split for product where stock < needed → allocation created for available + backorder for remainder
- **Explain check:** *"Does a backorder create a new quotation?"* (Answer: §6.31 — No. It preserves the original quotation + line, just tracks remaining quantity)

### B5.11 — BUILD: Fulfillment list endpoint
- `GET /api/v1/internal/fulfillment/quotations` — list confirmed quotations with allocation status
- **~25 lines.**
- **Verify:** See confirmed quotation with SPLIT_PENDING / FULFILLED status

### B5.12 — BUILD: Fulfillment List UI (Screen 7)
- Create `apps/web/src/features/fulfillment/FulfillmentListPage.tsx`
- Table: quote_number, customer, confirmed date, allocation status badge
- Filter: awaiting, in progress, fulfilled
- **~45 lines.**
- **Verify:** See confirmed orders in list with correct status

### B5.13 — BUILD: Fulfillment Detail UI (Screen 8)
- Create `apps/web/src/features/fulfillment/FulfillmentDetailPage.tsx`
- Quotation lines with quantities needed
- Recommended warehouse split table (warehouse name, qty, shipping cost)
- "Accept Suggested Split" button, "Manual Override" toggle
- Backorder section
- **~70 lines.**
- **Verify:** Open fulfillment detail → see split recommendation → accept → status updates

---

## Step B6 — Backorder + Inventory Management

### B6.1 — LEARN: Backorder consolidation
- **Read:** §6.32 (backorder consolidation)
- Flow: new stock arrives → find open backorders → allocate newly available stock → reduce remaining backorder
- **Explain check:** *"If a backorder has remaining qty of 20, and 12 new units arrive, what happens?"* (Answer: allocate 12, backorder remaining drops to 8, fulfillment status stays PARTIAL until fully resolved)

### B6.2 — BUILD: Backorder list + consolidation endpoint
- `GET /api/v1/internal/backorders` — list open backorders
- `POST /api/v1/internal/backorders/:id/consolidate` — attempt to fulfill from new stock
  - Same transactional pattern (lock → read → validate → reserve → update backorder)
  - If fully satisfied → backorder RESOLVED, allocation FULFILLED
  - Audit: BACKORDER_CONSOLIDATED
- **~45 lines.**
- **Verify:** Add stock to warehouse → consolidate backorder → remaining qty decreases
- **Explain check:** *"What triggers backorder consolidation — is it automatic or manual?"* (Answer: could be either — manual trigger via endpoint, or detected when stock is updated. The wireframe shows a "Consolidate Remaining Backorder" prompt when stock arrives)

### B6.3 — BUILD: Inventory release
- Function: `releaseReservation(allocationId)` →
  - If allocation cancelled before shipment → decrease `quantity_reserved` by allocated amount
  - Audit: FULFILLMENT_CANCELLED
- **~25 lines.**
- **Verify:** Cancel an allocation → quantity_reserved decreases, available stock goes back up
- **Explain check:** *"Why do we need inventory release?"* (Answer: §6.29 — prevents abandoned deals from permanently consuming stock)

### B6.4 — BUILD: Warehouse management endpoints
- `GET /api/v1/internal/warehouses` — list warehouses
- `GET /api/v1/internal/warehouses/:id` — detail with stock levels
- `PATCH /api/v1/internal/stock/:stockLevelId` — update stock (simulate new stock arrival)
  - After update, check for open backorders → return list of consolidatable backorders
- **~35 lines.**
- **Verify:** Update stock → get notified of open backorders that can now be consolidated

---

## Concurrency Test (MANDATORY before integration)

### B-TEST — VERIFY: Two concurrent allocations
- Write a test that sends two simultaneous `POST /accept-split` requests for the same product
- Expected: total `quantity_reserved` across both NEVER exceeds total `quantity_on_hand`
- If both succeed, run:
  ```sql
  SELECT SUM(quantity_reserved) FROM stock_levels WHERE product_id = $1;
  ```
  Must be ≤ original `quantity_on_hand`
- **Explain check:** *"If we removed the SELECT FOR UPDATE, what would happen with two simultaneous allocations?"* (Answer: race condition — both read 10 available, both reserve 8, total reserved = 16 but only 10 on hand)

---

## Your key tables (from Section 5)

| Table | Key columns you care about |
|---|---|
| `negotiation_requests` | id, quotation_id, quotation_line_id, customer_id, request_type, proposed_discount_percent, content, status, resolved_by, resolved_at |
| `warehouses` | id, name, code, shipping_cost_weight, is_active |
| `stock_levels` | id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, reorder_quantity |
| `fulfillment_allocations` | id, quotation_id, quotation_line_id, warehouse_id, allocated_quantity, status, accepted_at, fulfilled_at |
| `backorders` | id, quotation_id, quotation_line_id, remaining_quantity, status, resolved_at |

---

## Files you create

```
apps/api/src/modules/
  portal/
    portal.controller.ts
    portal.service.ts
    portal.middleware.ts
  negotiations/
    negotiation.controller.ts
    negotiation.service.ts
  fulfillment/
    fulfillment.controller.ts
    fulfillment.service.ts
    services/
      allocation-engine.service.ts
  inventory/
    inventory.controller.ts
    inventory.service.ts
  backorders/
    backorder.controller.ts
    backorder.service.ts

apps/web/src/features/
  portal/
    PortalLayout.tsx
    PortalLoginPage.tsx
    PortalQuotationListPage.tsx
    PortalQuotationDetailPage.tsx
    components/
      NegotiationPanel.tsx
      ConfirmButton.tsx
  fulfillment/
    FulfillmentListPage.tsx
    FulfillmentDetailPage.tsx
    components/
      AllocationTable.tsx
      BackorderSection.tsx
```

---

## Integration touchpoints

| When | What | With whom |
|---|---|---|
| **Checkpoint 1 (T+7)** | Portal + negotiation works with stubbed re-approval | Just you |
| **Integration (T+14)** | Wire Contract 1 — call Lane A's real `evaluateAndRoute()` | Lane A |
| **Integration (T+14)** | Wire Contract 3 — call Lane C's real `createFromConfirmedQuotation()` | Lane C |
| **Demo prep** | Customer portal is a judge-impressive differentiator — make it look distinct | You |
