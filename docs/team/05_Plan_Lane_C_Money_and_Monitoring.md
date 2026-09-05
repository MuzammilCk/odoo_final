# DealFlow360 — Lane C: Money & Monitoring — Full Implementation Plan

> **Owner:** Lane C team member
> **Use cases:** UC-02, UC-04, UC-17–UC-22
> **Screens:** 9 (Subscriptions), 10 (Billing Detail), 12 (Invoices List), 13 (Invoice Detail), 14 (Deal Health), 15 (Admin Reporting), 16 (Product Dashboard), 17 (Product Details)
> **Micro-steps:** 46 total — each one produces ~30–80 lines of code you can explain

---

## Your domain in one paragraph

You own the product catalog (the source of truth everyone else reads from), the pricing engine, subscription lifecycle, billing + invoicing, payments, credit notes, Deal Health monitoring, and reporting. You have the most screens (8) but also the most self-contained logic — most of your work only reads from other lanes' tables and never writes to them. When you're done, an admin can manage products and price lists, subscriptions bill correctly on schedule, invoices are generated for both one-time and recurring charges, payments are recorded with correct balance tracking, Deal Health catches stalled/anomalous deals, and management has filtered reports with export.

---

## What you DON'T own (and how you interact)

- **Quotations / Approvals / Auth** → Lane A owns. You provide `PriceListService.resolvePrice()` (Contract 2) that Lane A calls when building quotation lines.
- **Customer Portal / Negotiation / Fulfillment** → Lane B owns. Lane B calls your `SubscriptionService.createFromConfirmedQuotation()` (Contract 3) when a quotation is confirmed.
- **Fulfillment allocations** → Lane B writes them. You read `fulfillment_allocations.status` directly (Contract 4) to know what's shipped before invoicing.
- **Quotations table** → Lane A writes it. You read `quotations` directly for Deal Health and reporting.

---

## Step C1 — Product & Category Management

### C1.1 — LEARN: Product data model
- **Read:** §5 product/product_variant/category table definitions, UC-02
- **Understand:** What fields does a product have? What's `is_subscription_capable` for? What's `estimated_cost`?
- **Explain check:** *"What's the difference between `base_price` and the price from a price list entry?"* (Answer: base_price is the default selling price; a price list entry overrides it for specific customer tiers and currencies)

### C1.2 — BUILD: Category CRUD
- Create `apps/api/src/modules/products/product.service.ts`
- Functions: `createCategory(name, description)`, `listCategories()`, `updateCategory(id, data)`
- **~25 lines.**
- **Verify:** Create "Hardware", "Services", "Subscriptions" categories → list → see all three
- **Explain check:** *"Why do we need categories separate from products?"* (Answer: categories drive category-specific discount ceilings — Lane A uses them to determine how much discount is allowed per product type)

### C1.3 — BUILD: Product CRUD service
- Add to product.service.ts:
- `createProduct(data)` — name, categoryId, basePrice, unit, taxRate, description, estimatedCost, isSubscriptionCapable, isActive
- `listProducts(filters?)` — filter by category, search by name, active only
- `getProduct(id)` — detail with variants + price list entries
- `updateProduct(id, data)`, `deleteProduct(id)` (soft delete — set is_active = false)
- **~50 lines.**
- **Explain check:** *"Why soft delete instead of hard delete?"* (Answer: existing quotation lines reference this product — hard delete would break foreign key integrity)

### C1.4 — BUILD: Product endpoints
- Create `apps/api/src/modules/products/product.controller.ts`
- `POST/GET/PATCH/DELETE /api/v1/internal/products`
- `GET /api/v1/internal/products/:id`
- `POST/GET/PATCH /api/v1/internal/categories`
- Auth: ADMIN only for mutations
- **~45 lines.**
- **Verify:** `curl -X POST .../products -d '{"name":"Laptop","categoryId":"...","basePrice":1200}'` → product created

### C1.5 — BUILD: Product variant CRUD
- Add to service + controller:
- `POST /api/v1/internal/products/:id/variants` — add variant (attributeName, attributeValue, priceAdjustment, sku)
- `PATCH /api/v1/internal/products/:id/variants/:vid` — update
- `DELETE /api/v1/internal/products/:id/variants/:vid` — remove
- **~35 lines.**
- **Verify:** Add variant "16GB RAM" with +$200 adjustment to Laptop → list variants → see it
- **Explain check:** *"If a Laptop costs $1200 and has a '16GB RAM' variant with +$200 adjustment, what's the variant's effective price?"* (Answer: $1400)

### C1.6 — BUILD: Product Dashboard UI (Screen 16)
- Create `apps/web/src/features/admin/products/ProductDashboardPage.tsx`
- Product grid/table: name, category, base_price, status badge, variant count
- Filter by category, search bar
- "Add Product" button
- Quick stats: total products, by category
- **~60 lines.**
- **Verify:** Open product dashboard → see seeded products in grid

### C1.7 — BUILD: Product Details UI (Screen 17)
- Create `apps/web/src/features/admin/products/ProductDetailPage.tsx`
- General info form (editable fields)
- Variants section — table with add/edit/remove
- Placeholder for Price List section (built in next step)
- **~65 lines.**
- **Verify:** Open a product → edit its base price → save → price updates
- **Explain check:** *"Who can access this page? Can a SALES_REP edit products?"* (Answer: ADMIN only for mutations. Rep can view but not edit.)

---

## Step C2 — Price List Management

### C2.1 — LEARN: Price resolution logic
- **Read:** §6.8 (price resolution rule)
- Understand the resolution chain:
  ```
  Product + Customer Tier + Currency
    ↓
  Find matching price list entry (active, date-valid)
    ↓
  Found? → use entry price (source: 'PRICE_LIST')
  Not found? → use product.base_price (source: 'BASE')
  ```
- **Explain check:** *"A Gold customer buying a Laptop in EUR — but we only have a price list entry for Gold+USD. What price do they get?"* (Answer: no matching entry, falls back to product.base_price)

### C2.2 — BUILD: Price list entry CRUD
- Add to product.service.ts or new file:
- `createPriceListEntry({ productId, discountTierId, currencyCode, unitPrice, validFrom?, validTo? })`
- `listPriceListEntries(filters?)`, `updatePriceListEntry(id, data)`, `deletePriceListEntry(id)`
- **~35 lines.**
- **Verify:** Create entry: Laptop + Gold + USD = $1100 → list entries → see it

### C2.3 — BUILD: resolvePrice() — Contract 2 implementation
- Create `apps/api/src/modules/products/services/price-list.service.ts`
- ```ts
  async resolvePrice(productId: string, discountTierId: string, currencyCode: string):
    Promise<{ unitPrice: number; source: 'PRICE_LIST' | 'BASE' }>
  ```
- Query: find active price_list_entry matching all three + NOW() within valid dates
- If found → return entry price. If not → return product.base_price
- **~30 lines.**
- **Verify:** resolvePrice(Laptop, Gold, USD) → $1100, source: PRICE_LIST. resolvePrice(Laptop, Bronze, USD) → $1200, source: BASE.
- **Explain check:** *"Lane A calls this function when a rep adds a product to a quote. What determines which price the rep sees?"* (Answer: the customer's discount tier + the quotation's currency → matched against price list entries)

### C2.4 — BUILD: Price list endpoints
- `GET/POST/PATCH/DELETE /api/v1/internal/price-lists`
- **~25 lines.**
- **Verify:** CRUD entries via API

### C2.5 — BUILD: Price list section on Product Detail UI
- Add to ProductDetailPage: price list entries table
- Table: tier name, currency, unit price, valid period
- Add/edit/remove entries inline
- **~40 lines.**
- **Verify:** On product detail page → see price list entries → add new one → shows up

---

## Step C3 — Subscription Configuration + Creation

### C3.1 — LEARN: Subscription model
- **Read:** §6.34 (subscription creation from confirmed quotation), UC-04
- **Understand:** How does a quotation line become a subscription? What's `line_type = 'RECURRING'`?
- **Explain check:** *"Can every product be a subscription? What determines if a line is recurring?"* (Answer: only products with `is_subscription_capable = true`, and the quotation line must have `line_type = 'RECURRING'`)

### C3.2 — BUILD: Subscription plan config CRUD
- Create `apps/api/src/modules/subscriptions/subscription.service.ts`
- Plan template CRUD: name, billingInterval ('MONTHLY' | 'QUARTERLY' | 'YEARLY'), prorationRule, cancellationRule
- `GET/POST/PATCH /api/v1/internal/subscription-config`
- **~35 lines.**
- **Verify:** Create "Monthly Cloud License" plan → list plans → see it
- **Explain check:** *"What's a proration rule?"* (Answer: when a subscription changes mid-billing-cycle, proration calculates how much of the old period was used and adjusts charges for the remaining days)

### C3.3 — BUILD: createFromConfirmedQuotation() — Contract 3
- Add: `createFromConfirmedQuotation(quotationId)` →
  1. Load quotation + lines where `line_type = 'RECURRING'`
  2. For each recurring line:
     - Find matching subscription plan config
     - Create SubscriptionInstance:
       - quotation_id, quotation_line_id, product_id
       - billing_interval (from plan config)
       - unit_price, quantity (from quotation line)
       - status = 'ACTIVE'
       - current_period_start = quotation.confirmed_at
       - current_period_end = confirmed_at + billing_interval
       - next_billing_date = current_period_end
  3. Audit: SUBSCRIPTION_CREATED
- **~45 lines.**
- **Verify:** Call on seeded confirmed quotation with a "Cloud License" recurring line → subscription instance created with correct dates
- **Explain check:** *"Lane B calls this when a customer confirms a quotation. What happens if the quotation has no recurring lines?"* (Answer: nothing — the function finds zero recurring lines and returns without creating subscriptions)

### C3.4 — BUILD: Subscription list endpoint + UI (Screen 9)
- `GET /api/v1/internal/subscriptions` — list all (filter by status, customer)
- `GET /api/v1/internal/subscriptions/:id` — detail
- Create `apps/web/src/features/subscriptions/SubscriptionListPage.tsx`
- Table: customer, product, plan, status badge, interval, next billing date, amount
- **~55 lines** (endpoint + UI).
- **Verify:** See seeded subscription(s) in list with correct billing dates

---

## Step C4 — Subscription Lifecycle

### C4.1 — LEARN: Proration formula
- **Read:** §6.35 (proration rules)
- Write out the formula:
  ```
  days_used = today - current_period_start
  days_in_period = current_period_end - current_period_start
  used_fraction = days_used / days_in_period

  credit_for_old = old_amount × (1 - used_fraction)
  charge_for_new = new_amount × (1 - used_fraction)
  proration_adjustment = charge_for_new - credit_for_old
  ```
- **Example:** 30-day month, change on day 10. Used 10/30 = 33%. Credit 67% of old, charge 67% of new.
- **Explain check:** *"A $90/month subscription upgrades to $150/month on day 20 of a 30-day period. What's the proration adjustment?"* (Answer: used_fraction = 20/30 = 0.667. Credit = $90 × 0.333 = $30. New charge = $150 × 0.333 = $50. Adjustment = $50 - $30 = $20)

### C4.2 — BUILD: Subscription modification with proration
- Add: `modifySubscription(subscriptionId, { newQuantity?, newPlanId? })` →
  - Calculate proration using the formula
  - Create prorated invoice line or adjustment record
  - Update subscription: new quantity/plan, adjusted dates
  - Audit: SUBSCRIPTION_MODIFIED
- **~45 lines.**
- **Verify:** Modify a subscription's quantity → see proration adjustment calculated correctly
- **Explain check:** *"Why prorate instead of just charging the new amount immediately?"* (Answer: the customer already paid for the current period at the old rate — charging full new rate would double-bill for the remaining days)

### C4.3 — BUILD: Subscription cancellation
- Add: `cancelSubscription(subscriptionId)` →
  - Calculate remaining fraction: `1 - used_fraction`
  - Refund amount = current_period_amount × remaining_fraction
  - If refund > 0 → create credit note
  - Status → CANCELLED, cancelled_at = now()
  - Audit: SUBSCRIPTION_CANCELLED
- **~30 lines.**
- **Verify:** Cancel a subscription mid-period → credit note created with correct refund amount
- **Explain check:** *"If a customer cancels on day 25 of a 30-day period for a $90/month plan, how much credit do they get?"* (Answer: 5/30 = 16.7% remaining, credit = $90 × 0.167 = $15)

### C4.4 — BUILD: Subscription modification/cancel endpoints
- `PATCH /api/v1/internal/subscriptions/:id` — modify
- `POST /api/v1/internal/subscriptions/:id/cancel` — cancel
- **~25 lines.**
- **Verify:** Modify + cancel via API → correct proration and credit notes

### C4.5 — BUILD: Subscription detail UI
- Create `apps/web/src/features/subscriptions/SubscriptionDetailPage.tsx`
- Current plan info, billing schedule, modify form (qty/plan change), cancel button with refund preview
- **~55 lines.**
- **Verify:** Open subscription → see billing schedule → modify → see proration preview → cancel → see credit note

---

## Step C5 — Invoice Generation

### C5.1 — LEARN: Hybrid billing model
- **Read:** §6.37–6.38 (invoice generation, billing precondition)
- **Key rule: "Nothing is billed before it ships"** (§6.38)
- Two invoice types:
  ```
  ONE_TIME:  generated from fulfilled allocations (after Lane B ships)
  RECURRING: generated from subscription instances (when next_billing_date arrives)
  ```
- **Explain check:** *"A quotation has 3 lines — 2 hardware (one-time) and 1 cloud license (recurring). How many invoices are generated?"* (Answer: at least 2 — one for the fulfilled hardware lines, one on each billing cycle for the recurring line)

### C5.2 — BUILD: One-time invoice generation
- Create `apps/api/src/modules/billing/services/invoice-generator.service.ts`
- Function: `generateOneTimeInvoice(quotationId)` →
  - Read fulfillment_allocations with status = FULFILLED (Contract 4)
  - If none → error: nothing shipped yet
  - For each fulfilled allocation → get quotation line pricing
  - Create Invoice (type ONE_TIME) + InvoiceLines
  - Calculate totals: subtotal, tax, grand_total, balance_due = grand_total
  - Status = DRAFT
  - Audit: INVOICE_GENERATED
- **~50 lines.**
- **Verify:** Call on seeded quotation with FULFILLED allocation → invoice created with correct line totals
- **Explain check:** *"Why do we check fulfillment_allocations.status instead of just invoicing after confirmation?"* (Answer: §6.38 — confirmation means the deal is agreed, but the goods haven't shipped yet. Billing before shipment means invoicing for something the customer hasn't received)

### C5.3 — BUILD: Recurring invoice generation
- Add: `generateRecurringInvoices()` →
  - Find subscription instances where `next_billing_date <= today` and status = ACTIVE
  - For each: create Invoice (type RECURRING) + InvoiceLines for current billing period
  - Advance dates: period_start = old period_end, period_end += interval, next_billing_date = new period_end
  - Audit: INVOICE_GENERATED
- **~45 lines.**
- **Verify:** Set a subscription's next_billing_date to yesterday → call → invoice created → dates advanced
- **Explain check:** *"What happens if the recurring job runs twice? Could it double-bill?"* (Answer: after the first run, next_billing_date is advanced past today, so the second run finds nothing to bill)

### C5.4 — BUILD: Invoice endpoints
- `GET /api/v1/internal/invoices` — list (filter by status, type, customer, date range)
- `GET /api/v1/internal/invoices/:id` — detail with lines + payment history
- `POST /api/v1/internal/invoices/generate-from-fulfillment` — trigger one-time invoice
- `POST /api/v1/internal/invoices/generate-recurring` — trigger recurring batch
- `POST /api/v1/internal/invoices/:id/send` — mark as SENT
- `POST /api/v1/internal/invoices/:id/void` — void with reason
- **~50 lines.**
- **Verify:** Generate invoice → list → see it with DRAFT status → send → SENT

### C5.5 — BUILD: Invoice List UI (Screen 12)
- Create `apps/web/src/features/invoices/InvoiceListPage.tsx`
- Table: invoice_number, customer, type badge (ONE_TIME/RECURRING), grand_total, balance_due, status, date
- Filters: status, type, customer, date range
- **~50 lines.**
- **Verify:** See generated invoices in list with correct type badges

### C5.6 — BUILD: Invoice Detail UI (Screen 13)
- Create `apps/web/src/features/invoices/InvoiceDetailPage.tsx`
- Header: invoice number, customer, dates, status badge
- Line items table
- Payment history section (empty for now — built in next step)
- Summary: grand_total, amount_paid, balance_due
- Actions: Send, Void, Record Payment button
- **~60 lines.**
- **Verify:** Open invoice → see all line details + correct totals

---

## Step C6 — Payments & Credit Notes

### C6.1 — LEARN: Payment balance mechanics
- **Read:** §6.39 (payment recording)
- **Understand:**
  ```
  On each payment:
    amount_paid += payment.amount
    balance_due = grand_total - amount_paid

  Status auto-update:
    balance_due = 0    → PAID
    balance_due > 0    → PARTIALLY_PAID
  ```
- **Explain check:** *"An invoice for $1000 has two payments: $600 and $400. What's the status after each?"* (Answer: after $600 → PARTIALLY_PAID (balance $400). After $400 → PAID (balance $0))

### C6.2 — BUILD: Payment recording service
- Create `apps/api/src/modules/payments/payment.service.ts`
- Function: `recordPayment(invoiceId, amount, method, reference?)` →
  - Validate: amount > 0, amount ≤ invoice.balance_due
  - Create Payment record
  - Update invoice: amount_paid += amount, recalculate balance_due
  - Update status: balance_due = 0 → PAID, > 0 → PARTIALLY_PAID
  - Audit: PAYMENT_RECORDED
- **~35 lines.**
- **Verify:** Record $600 on $1000 invoice → balance = $400, status = PARTIALLY_PAID. Record $400 more → balance = $0, status = PAID.
- **Explain check:** *"What happens if someone tries to pay more than the balance due?"* (Answer: validation rejects it — amount must be ≤ balance_due)

### C6.3 — BUILD: Payment endpoint
- `POST /api/v1/internal/payments`
- Body: `{ invoiceId, amount, method: 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK', reference? }`
- `GET /api/v1/internal/invoices/:id/payments` — payment history
- **~25 lines.**
- **Verify:** Record payment via curl → invoice status updates

### C6.4 — BUILD: Credit note service
- Create `apps/api/src/modules/payments/credit-note.service.ts`
- `createCreditNote({ invoiceId?, subscriptionId?, amount, reason })` — created automatically by subscription cancel, or manually by FINANCE_OPS
- `applyCreditNote(creditNoteId, invoiceId)` — reduce balance_due on invoice
- **~30 lines.**
- **Verify:** Create credit note from subscription cancellation → apply to invoice → balance decreases
- **Explain check:** *"Where do credit notes come from? Name two scenarios."* (Answer: 1) subscription cancellation mid-period → partial refund. 2) subscription modification proration → adjustment credit)

### C6.5 — BUILD: Credit note endpoints
- `POST /api/v1/internal/credit-notes` — create manually
- `GET /api/v1/internal/credit-notes` — list
- `POST /api/v1/internal/credit-notes/:id/apply` — apply to invoice
- **~25 lines.**

### C6.6 — BUILD: Billing Detail UI (Screen 10)
- Create `apps/web/src/features/billing/BillingDetailPage.tsx`
- Unified view for a quotation:
  - One-time charges section
  - Recurring charges section
  - Upcoming billing schedule
  - Payment summary
  - Credit notes applied
- **~60 lines.**
- **Verify:** Open billing for confirmed quotation → see both one-time and recurring sections

### C6.7 — BUILD: Record Payment modal + payment history
- Add to InvoiceDetailPage: "Record Payment" modal with amount, method, reference
- Payment history table on invoice detail
- **~40 lines.**
- **Verify:** Open invoice → record payment → see it in history → balance updates live

---

## Step C7 — Deal Health Engine

### C7.1 — LEARN: Deal Health detection rules
- **Read:** §6.41–6.43 (stalled, discount anomaly, delivery slippage)
- Understand the three flags:
  ```
  STALLED: quotation inactive > N days
  DISCOUNT_ANOMALY: discount >> rep's historical average × threshold
  DELIVERY_SLIPPAGE: fulfillment pending > N days
  ```
- **Explain check:** *"Why is Deal Health a 'smart platform differentiator' and not just a filter on the quotations table?"* (Answer: it proactively detects problems by analyzing patterns — discount anomalies compare against historical averages, not just thresholds)

### C7.2 — BUILD: STALLED detection
- Create `apps/api/src/modules/deal-health/deal-health.service.ts`
- Function: `detectStalled(stalledDays: number)` →
  - Query: quotations where status IN (DRAFT, PENDING_APPROVAL, UNDER_NEGOTIATION) AND updated_at < NOW() - stalledDays
  - For each → create DealHealthFlag { type: 'STALLED', quotation_id, severity, description }
  - Skip if flag already exists for this quotation + type
- **~30 lines.**
- **Verify:** Seeded stalled quotation (updated_at 30 days ago) → detected → flag created
- **Explain check:** *"What statuses do we check for staleness? Why not CONFIRMED?"* (Answer: CONFIRMED means the deal is done — it can't be stalled anymore)

### C7.3 — BUILD: DISCOUNT_ANOMALY detection
- Add: `detectDiscountAnomalies(anomalyThreshold: number)` →
  - For each sales rep: calculate avg_discount over their last N quotations
  - For each current quotation: calculate average discount
  - If current_avg > rep_historical_avg × anomalyThreshold → create flag
- **~35 lines.**
- **Verify:** Seeded rep with anomaly data → detected → flag created
- **Explain check:** *"A rep's historical average discount is 8%. Their current quote is at 14%. With a threshold of 1.5×, is this flagged?"* (Answer: threshold = 8% × 1.5 = 12%. Current 14% > 12% → YES, flagged)

### C7.4 — BUILD: DELIVERY_SLIPPAGE detection
- Add: `detectDeliverySlippage(slippageDays: number)` →
  - Query: fulfillment_allocations where status IN (SPLIT_PENDING, PARTIAL) AND created_at < NOW() - slippageDays
  - Create flag for each
- **~25 lines.**
- **Verify:** If any allocation has been pending for too long → flagged

### C7.5 — BUILD: Deal Health evaluate orchestrator
- Add: `evaluate()` → calls all three detection functions → returns summary of new flags created
- **~15 lines** (orchestrator).
- **Verify:** Call evaluate() → see flags created for seeded stalled + anomaly data

### C7.6 — BUILD: Deal Health endpoints
- `GET /api/v1/internal/deal-health` — list active flags (filter by type, severity)
- `GET /api/v1/internal/deal-health/:id` — flag detail
- `POST /api/v1/internal/deal-health/:id/acknowledge` — mark reviewed
- `POST /api/v1/internal/deal-health/:id/nudge` — trigger escalation action + audit
- `POST /api/v1/internal/deal-health/evaluate` — manual trigger
- **~40 lines.**
- **Verify:** List flags → acknowledge one → it's marked. Nudge one → audit log created.

### C7.7 — BUILD: Deal Health background worker
- Create `apps/api/src/modules/deal-health/deal-health.worker.ts`
- Scheduled job: run `DealHealthService.evaluate()` every 15–60 minutes
- **Must call the same domain service as the API endpoint** (§8.46 rule 20)
- **~20 lines.**
- **Explain check:** *"Why must the background worker call the same service as the API?"* (Answer: so the detection logic is in one place, not duplicated — same rules whether triggered manually or by schedule)

### C7.8 — BUILD: Deal Health Dashboard UI (Screen 14)
- Create `apps/web/src/features/deal-health/DealHealthDashboardPage.tsx`
- Alert cards grouped by type (Stalled / Discount Anomaly / Delivery Slippage)
- Each card: quotation number, customer, age, severity, description
- Click → navigates to related quotation
- "Nudge" button, "Acknowledge" button
- Summary stats bar: total active flags by type
- **~70 lines.**
- **Verify:** See stalled + anomaly flags from seed data → click one → navigates to quotation → nudge → audit logged

---

## Step C8 — Reporting

### C8.1 — LEARN: Reporting requirements
- **Read:** Problem statement §A7, UC-21–22
- **Filters:** period, sales rep, approval status, product/category
- **Reports:** sales performance, product performance, approval summary
- **Explain check:** *"What's the difference between the Deal Health dashboard and the Admin Reporting?"* (Answer: Deal Health is real-time exception monitoring. Reporting is historical analysis with filters and aggregations)

### C8.2 — BUILD: Sales performance query
- Create `apps/api/src/modules/reporting/reporting.service.ts`
- Function: `getSalesPerformance({ startDate, endDate, salesRepId?, status?, categoryId? })` →
  - Query quotations with filters → aggregate: count, total revenue, avg discount, approval rate
- **~35 lines.**
- **Verify:** Call with date range → get correct aggregates from seeded data

### C8.3 — BUILD: Product + approval reports
- Add: `getProductPerformance(filters)` → best-selling, most-discounted, revenue by category
- Add: `getApprovalSummary(filters)` → approval counts by status, avg approval time, rejection rate
- **~40 lines.**
- **Verify:** Correct product rankings from seeded data

### C8.4 — BUILD: Reporting endpoints
- `GET /api/v1/internal/reports/sales-performance`
- `GET /api/v1/internal/reports/product-performance`
- `GET /api/v1/internal/reports/approval-summary`
- Auth: ADMIN + MANAGER only
- **~30 lines.**

### C8.5 — BUILD: Report export
- `GET /api/v1/internal/reports/export?reportType=...&format=PDF|XLS`
- Use a simple library for PDF/XLS generation
- **~40 lines.**
- **Verify:** Export sales report as PDF → file downloads

### C8.6 — BUILD: Reporting page UI (Screen 15)
- Create `apps/web/src/features/reporting/ReportingPage.tsx`
- Filter bar: date range picker, rep selector, status dropdown, category selector
- Summary stat cards (total revenue, quote count, approval rate, avg discount)
- Charts: revenue over time, quotations by status, top products
- Export buttons: "Export PDF" / "Export XLS"
- **~75 lines.** (Largest UI micro-step — but straightforward chart + filter layout)
- **Verify:** Open reporting → apply filter → numbers update → export → file downloads
- **Explain check:** *"Who can access reporting? Can a SALES_REP see company-wide numbers?"* (Answer: ADMIN + MANAGER only. Rep gets limited access per §3.3)

---

## Your key tables (from Section 5)

| Table | Key columns you care about |
|---|---|
| `products` | id, name, category_id, base_price, unit, tax_rate, description, estimated_cost, is_subscription_capable, is_promoted, is_active |
| `product_variants` | id, product_id, attribute_name, attribute_value, price_adjustment, sku |
| `categories` | id, name, description |
| `price_list_entries` | id, product_id, discount_tier_id, currency_code, unit_price, valid_from, valid_to |
| `subscription_instances` | id, quotation_id, quotation_line_id, product_id, billing_interval, unit_price, quantity, status, current_period_start, current_period_end, next_billing_date, cancelled_at |
| `invoices` | id, invoice_number, quotation_id, customer_id, type, subtotal, tax_total, grand_total, amount_paid, balance_due, status, due_date, issued_at |
| `payments` | id, invoice_id, amount, method, reference, recorded_at |
| `credit_notes` | id, invoice_id, subscription_id, amount, reason, status, applied_at |
| `deal_health_flags` | id, quotation_id, flag_type, severity, description, is_acknowledged, detected_at, acknowledged_at |

---

## Files you create

```
apps/api/src/modules/
  products/
    product.controller.ts
    product.service.ts
    services/
      price-list.service.ts
  subscriptions/
    subscription.controller.ts
    subscription.service.ts
  billing/
    billing.controller.ts
    billing.service.ts
    services/
      invoice-generator.service.ts
  payments/
    payment.controller.ts
    payment.service.ts
    credit-note.service.ts
  deal-health/
    deal-health.controller.ts
    deal-health.service.ts
    deal-health.worker.ts
  reporting/
    reporting.controller.ts
    reporting.service.ts
    export.service.ts

apps/web/src/features/
  admin/
    products/
      ProductDashboardPage.tsx
      ProductDetailPage.tsx
  subscriptions/
    SubscriptionListPage.tsx
    SubscriptionDetailPage.tsx
  billing/
    BillingDetailPage.tsx
  invoices/
    InvoiceListPage.tsx
    InvoiceDetailPage.tsx
  deal-health/
    DealHealthDashboardPage.tsx
  reporting/
    ReportingPage.tsx
```

---

## Integration touchpoints

| When | What | With whom |
|---|---|---|
| **Checkpoint 1 (T+7)** | Products + price lists + subscription creation work standalone with seed data | Just you |
| **Integration (T+14)** | Lane A calls your `resolvePrice()` — verify it returns correct tier-based pricing | Lane A |
| **Integration (T+14)** | Lane B calls your `createFromConfirmedQuotation()` — verify subscriptions get created | Lane B |
| **Demo prep** | Deal Health + Reporting are judge-impressive "smart platform" features — polish them | You |
