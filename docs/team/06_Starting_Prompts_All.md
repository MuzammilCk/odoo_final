# DealFlow360 — Starting Prompts (Copy-Paste, One at a Time)

> **How to use:** Each prompt below is ONE micro-step. Copy ONLY the next prompt you need, paste it into your coding agent, read the output, verify it works, then come back for the next one.
>
> **Rule:** Do NOT paste multiple prompts at once. Read and understand each output before moving on.
>
> **After each prompt:** Ask yourself: "Can I explain what this code does to a judge?" If not, read it again.

---

# Foundation Prompts (All 3 Members Together)

## F1 — Monorepo Setup

```
Set up a TypeScript monorepo for DealFlow360 with this structure:

Root package.json with workspaces: ["apps/*", "packages/*"]

apps/web/ — React + Vite + TypeScript + Tailwind CSS
apps/api/ — Node.js + Express + TypeScript (with ts-node or tsx for dev)
packages/shared/ — shared TypeScript types and enums
prisma/ — schema + seed

Add these npm scripts to root:
  "dev:web": runs the frontend dev server
  "dev:api": runs the backend dev server
  "dev": runs both concurrently
  "db:migrate": npx prisma migrate dev
  "db:seed": npx prisma db seed

Create a .env.example with:
  DATABASE_URL=postgresql://user:pass@localhost:5432/dealflow360
  JWT_SECRET=change-me-in-production
  API_PORT=3001
  APP_BASE_URL=http://localhost:5173
  API_BASE_URL=http://localhost:3001

Don't build any features yet — just the scaffold that compiles and runs.
```

## F2 — Prisma Schema

```
Create the Prisma schema in prisma/schema.prisma for DealFlow360. Transcribe ALL these tables:

Enums:
  UserRole: ADMIN, SALES_REP, MANAGER, FINANCE_OPS, CUSTOMER
  QuotationStatus: DRAFT, PENDING_APPROVAL, APPROVED, UNDER_NEGOTIATION, CONFIRMED, REJECTED
  ApprovalStatus: PENDING, APPROVED, REJECTED, RETURNED
  FulfillmentStatus: SPLIT_PENDING, PARTIAL, BACKORDER, FULFILLED
  InvoiceStatus: DRAFT, SENT, PARTIALLY_PAID, PAID, VOID
  InvoiceType: ONE_TIME, RECURRING
  BillingInterval: MONTHLY, QUARTERLY, YEARLY
  SubscriptionStatus: ACTIVE, PAUSED, CANCELLED
  BackorderStatus: OPEN, PARTIALLY_RESOLVED, RESOLVED
  NegotiationRequestType: COMMENT, CHANGE_REQUEST, COUNTER_DISCOUNT, DELIVERY_DATE
  NegotiationStatus: PENDING, ACCEPTED, REJECTED, RESOLVED
  DealHealthFlagType: STALLED, DISCOUNT_ANOMALY, DELIVERY_SLIPPAGE
  LineType: ONE_TIME, RECURRING

Tables (all PKs are UUIDs, all have created_at + updated_at as DateTime):

1. users: id, email (unique), password_hash, role (UserRole), full_name, is_active (default true)
2. customers: id, name, code (unique), discount_tier_id (FK→discount_tiers), contact_email, is_active
3. discount_tiers: id, name (unique), discount_ceiling_percent (Decimal)
4. categories: id, name, description
5. category_discount_ceilings: id, category_id (FK), discount_tier_id (FK), discount_ceiling_percent (Decimal). Unique on (category_id, discount_tier_id)
6. products: id, name, category_id (FK), base_price (Decimal), unit, tax_rate (Decimal), description, estimated_cost (Decimal), is_subscription_capable (default false), is_promoted (default false), is_active (default true)
7. product_variants: id, product_id (FK), attribute_name, attribute_value, price_adjustment (Decimal default 0), sku
8. price_list_entries: id, product_id (FK), discount_tier_id (FK), currency_code, unit_price (Decimal), valid_from (DateTime?), valid_to (DateTime?)
9. quotations: id, quote_number (unique), customer_id (FK), sales_rep_id (FK→users), status (QuotationStatus default DRAFT), current_version (Int default 1), currency_code, subtotal (Decimal default 0), discount_total (Decimal default 0), tax_total (Decimal default 0), grand_total (Decimal default 0), margin_amount (Decimal default 0), margin_percent (Decimal default 0), confirmed_at (DateTime?), is_customer_visible (default false)
10. quotation_lines: id, quotation_id (FK), product_id (FK), variant_id (FK→product_variants?), quantity (Decimal), unit_price (Decimal), discount_percent (Decimal default 0), discount_amount (Decimal default 0), tax_rate (Decimal default 0), tax_amount (Decimal default 0), line_total (Decimal default 0), estimated_cost (Decimal default 0), margin_amount (Decimal default 0), discount_overage_percent (Decimal default 0), line_type (LineType default ONE_TIME)
11. approval_requests: id, quotation_id (FK), quotation_version (Int), risk_score (Decimal), risk_level (String), terms_snapshot (Json), status (ApprovalStatus default PENDING)
12. approval_steps: id, approval_request_id (FK), step_sequence (Int), approver_role (UserRole), approver_id (FK→users?), status (ApprovalStatus default PENDING), comment (String?), acted_at (DateTime?)
13. negotiation_requests: id, quotation_id (FK), quotation_line_id (FK?), customer_id (FK→users), request_type (NegotiationRequestType), proposed_discount_percent (Decimal?), content (String), status (NegotiationStatus default PENDING), resolved_by (FK→users?), resolved_at (DateTime?), resolution_comment (String?)
14. warehouses: id, name, code (unique), shipping_cost_weight (Decimal default 1.0), is_active (default true)
15. stock_levels: id, warehouse_id (FK), product_id (FK), quantity_on_hand (Decimal default 0), quantity_reserved (Decimal default 0), reorder_point (Decimal default 0), reorder_quantity (Decimal default 0). Unique on (warehouse_id, product_id)
16. fulfillment_allocations: id, quotation_id (FK), quotation_line_id (FK), warehouse_id (FK), allocated_quantity (Decimal), status (FulfillmentStatus default SPLIT_PENDING), accepted_at (DateTime?), fulfilled_at (DateTime?)
17. backorders: id, quotation_id (FK), quotation_line_id (FK), remaining_quantity (Decimal), status (BackorderStatus default OPEN), resolved_at (DateTime?)
18. subscription_instances: id, quotation_id (FK), quotation_line_id (FK), product_id (FK), billing_interval (BillingInterval), unit_price (Decimal), quantity (Decimal), status (SubscriptionStatus default ACTIVE), current_period_start (DateTime), current_period_end (DateTime), next_billing_date (DateTime), cancelled_at (DateTime?)
19. invoices: id, invoice_number (unique), quotation_id (FK), customer_id (FK→customers), type (InvoiceType), subtotal (Decimal), tax_total (Decimal), grand_total (Decimal), amount_paid (Decimal default 0), balance_due (Decimal), status (InvoiceStatus default DRAFT), due_date (DateTime), issued_at (DateTime?)
20. invoice_lines: id, invoice_id (FK), description, quantity (Decimal), unit_price (Decimal), discount_amount (Decimal default 0), tax_amount (Decimal default 0), line_total (Decimal), source_quotation_line_id (FK?), source_subscription_id (FK?)
21. payments: id, invoice_id (FK), amount (Decimal), method (String), reference (String?), recorded_at (DateTime default now)
22. credit_notes: id, invoice_id (FK?), subscription_id (FK?), amount (Decimal), reason (String), status (String default 'ISSUED'), applied_at (DateTime?)
23. deal_health_flags: id, quotation_id (FK), flag_type (DealHealthFlagType), severity (String), description (String), is_acknowledged (default false), detected_at (DateTime default now), acknowledged_at (DateTime?)
24. audit_logs: id, user_id (FK→users?), action (String), entity_type (String), entity_id (String), details (Json?), created_at (DateTime default now)

Add proper relations and indexes. Run: npx prisma migrate dev --name init
```

## F3 — Seed Data

```
Create prisma/seed.ts for DealFlow360. Use bcrypt to hash passwords (password: "demo123" for all).

Seed this data:

Users:
  admin@demo.com (ADMIN, "Admin User")
  rep@demo.com (SALES_REP, "Sarah Sales")
  manager@demo.com (MANAGER, "Mike Manager")
  finance@demo.com (FINANCE_OPS, "Fiona Finance")
  customer@acme.com (CUSTOMER, "Alex Acme")
  customer@beta.com (CUSTOMER, "Beth Beta")

Discount Tiers:
  Bronze (5%), Silver (10%), Gold (15%)

Customers:
  Acme Corp (code: ACME, tier: Gold)
  Beta Industries (code: BETA, tier: Silver)

Categories:
  Hardware, Services, Subscriptions

Category Discount Ceilings:
  Hardware + Gold = 15%, Hardware + Silver = 12%, Hardware + Bronze = 8%
  Services + Gold = 10%, Services + Silver = 8%, Services + Bronze = 5%
  Subscriptions + Gold = 12%, Subscriptions + Silver = 10%, Subscriptions + Bronze = 7%

Products:
  Laptop Pro (Hardware, $1200, tax 8%, cost $800, not subscription)
  Monitor 27" (Hardware, $450, tax 8%, cost $250, not subscription)
  Keyboard Wireless (Hardware, $85, tax 8%, cost $35, not subscription, is_promoted)
  Setup Service (Services, $500, tax 0%, cost $350, not subscription)
  Cloud License (Subscriptions, $90, tax 5%, cost $20, is_subscription_capable)
  Premium Support (Subscriptions, $150, tax 5%, cost $60, is_subscription_capable)

Product Variants:
  Laptop Pro: "RAM" / "16GB" (+$200), "RAM" / "32GB" (+$500)
  Monitor 27": "Panel" / "IPS" (+$0), "Panel" / "OLED" (+$150)

Price List Entries:
  Laptop Pro + Gold + USD = $1100
  Laptop Pro + Silver + USD = $1150
  Cloud License + Gold + USD = $80

Warehouses:
  Main Warehouse (code: MAIN, shipping_cost_weight: 1.0)
  East Depot (code: EAST, shipping_cost_weight: 1.5)

Stock Levels:
  Main Warehouse: Laptop Pro (50 on_hand, 10 reserved), Monitor (30/5), Keyboard (100/0)
  East Depot: Laptop Pro (15 on_hand, 0 reserved), Monitor (8/0), Keyboard (25/0)
  — Note: Combined Laptop stock is 55 available (50-10 + 15-0). Seed a confirmed quotation needing 60 Laptops to force a backorder scenario.

Quotations (create with realistic quote_numbers Q-1001 through Q-1004):
  Q-1001: Acme Corp, rep@demo.com, DRAFT, v1
    Lines: Laptop Pro x2 @ $1100 (10% discount), Setup Service x1 @ $500 (5% discount)
  
  Q-1002: Acme Corp, rep@demo.com, PENDING_APPROVAL, v1
    Lines: Laptop Pro x5 @ $1100 (12% discount), Setup Service x3 @ $500 (18% discount — exceeds ceiling!)
    Create an ApprovalRequest with risk_score=8, risk_level=HIGH, 2 steps (Manager PENDING, Finance PENDING)
  
  Q-1003: Beta Industries, rep@demo.com, UNDER_NEGOTIATION, v2
    Lines: Monitor x10 @ $450 (8% discount), Cloud License x10 @ $80 (5% discount, RECURRING)
    Create a NegotiationRequest (COUNTER_DISCOUNT, proposed 12%)
  
  Q-1004: Acme Corp, rep@demo.com, CONFIRMED, v1, confirmed_at = 2 days ago
    Lines: Laptop Pro x60 @ $1100 (5% discount, ONE_TIME), Cloud License x20 @ $80 (0% discount, RECURRING)
    Create FulfillmentAllocation: 40 from Main (FULFILLED), 15 from East (FULFILLED), backorder for 5
    Create SubscriptionInstance for Cloud License line (ACTIVE, MONTHLY)

  Q-1005 (stalled): Acme Corp, rep@demo.com, DRAFT, v1, updated_at = 30 days ago
    Lines: Premium Support x5 @ $150 (15% discount — above Gold subscription ceiling of 12%)

Recalculate all quotation totals (subtotal, discount, tax, grand_total, margin) correctly.

Add to package.json: "prisma": { "seed": "tsx prisma/seed.ts" }
```

## F4 — Auth + RBAC + Frontend Shell

```
Build the auth system for DealFlow360. We already have the Prisma schema and seed data.

Backend (apps/api/src/modules/auth/):

1. auth.service.ts:
   - signup(email, password, fullName, role): hash with bcrypt, create user, return user (no password_hash)
   - login(email, password): find user, bcrypt.compare, generate JWT { userId, role, email }, return { token, user }
   - getMe(userId): return user profile

2. auth.middleware.ts:
   - authenticateToken: extract Bearer token, verify JWT, attach req.user = { userId, role, email }
   - Return 401 if missing/invalid

3. rbac.middleware.ts:
   - requireRole(...roles): check req.user.role is in allowed list, return 403 if not

4. auth.controller.ts:
   - POST /api/v1/auth/signup — validate with Zod { email, password, fullName, role }
   - POST /api/v1/auth/login — validate { email, password }
   - GET /api/v1/auth/me — requires auth

5. Register routes in main Express app with CORS enabled for frontend origin.

Frontend (apps/web/):

1. Set up React Router with routes:
   - /login → LoginPage
   - /app/* → internal app (requires auth, internal roles)
   - /portal/* → customer portal (requires auth, CUSTOMER role)
   - /app/dashboard → DashboardPage (placeholder)

2. Create AuthContext/hook that stores JWT + user in React state.

3. LoginPage.tsx: email + password form, call login API, redirect based on role.

4. ProtectedRoute.tsx: check auth token + role, redirect to /login if unauthorized.

5. AppLayout.tsx: internal layout shell with sidebar nav (Dashboard, Quotations, Approvals, Fulfillment, Products, Subscriptions, Invoices, Deal Health, Reporting, Config).

6. PortalLayout.tsx: separate portal layout (different branding, only: My Quotations).

After building, verify:
- curl POST /api/v1/auth/login with rep@demo.com / demo123 → get JWT
- curl GET /api/v1/auth/me with Bearer token → get user
- Browser: login as rep → see internal layout. Login as customer → see portal layout.
```

---

# Lane A Prompts — Commercial Core

> **Context prompt (paste once at start of your Lane A session):**

```
You are helping me build the Commercial Core of DealFlow360 — a B2B sales operations platform.
I own: quotation CRUD, discount governance, approval routing, and recommendations.
My backend modules go in: apps/api/src/modules/{quotations,approvals,recommendations,discount-config}/
My frontend features go in: apps/web/src/features/{dashboard,quotations,approvals,admin/discount-config}/
Tech: TypeScript, Express, Prisma, Zod, React, Tailwind CSS.
Auth (JWT + RBAC) is already built. Prisma schema is migrated. Seed data is loaded.
I will give you ONE small task at a time. Build ONLY what I ask for. After each task, briefly explain what you built and why each key decision was made.
```

## A2.2 — Create Quotation Service

```
Create apps/api/src/modules/quotations/quotation.service.ts

Add ONE function: createQuotation(salesRepId: string, customerId: string, currencyCode: string)

It should:
1. Verify the customer exists and is active (Prisma query)
2. Generate a quote_number (format: "Q-" + Date.now() or a sequential counter)
3. Create a Quotation via Prisma with: status = DRAFT, current_version = 1, all money fields = 0
4. Create an AuditLog entry: action = "QUOTATION_CREATED", entity_type = "quotation", entity_id = the new ID
5. Return the created quotation

No endpoint yet — just the service function. Keep it under 40 lines.
```

## A2.3 — Quotation Endpoints

```
Create apps/api/src/modules/quotations/quotation.controller.ts

Add three endpoints:

1. POST /api/v1/internal/quotations
   - Auth: requireRole('SALES_REP', 'ADMIN')
   - Validate body with Zod: { customerId: string, currencyCode: string }
   - Call QuotationService.createQuotation(req.user.userId, body.customerId, body.currencyCode)
   - Return 201 with the quotation

2. GET /api/v1/internal/quotations
   - Auth: requireRole('SALES_REP', 'MANAGER', 'ADMIN', 'FINANCE_OPS')
   - Optional query params: status, salesRepId
   - Return quotations with customer name included (Prisma include)

3. GET /api/v1/internal/quotations/:id
   - Same auth
   - Return quotation with lines + customer (Prisma include)
   - Return 404 if not found

Register in Express app under /api/v1/internal/quotations.
```

## A2.5 — Quotation Calculator

```
Create apps/api/src/modules/quotations/services/quotation-calculator.service.ts

Add ONE function: recalculateQuotation(quotationId: string)

It should:
1. Load all quotation_lines for this quotation from DB
2. For EACH line, calculate:
   discount_amount = unit_price * quantity * (discount_percent / 100)
   net_line_value = (unit_price * quantity) - discount_amount
   tax_amount = net_line_value * (tax_rate / 100)
   line_total = net_line_value + tax_amount
   margin_amount = net_line_value - (estimated_cost * quantity)
3. Update each line in DB with the calculated values
4. Sum across all lines:
   subtotal = SUM(net_line_value)
   discount_total = SUM(discount_amount)
   tax_total = SUM(tax_amount)
   grand_total = subtotal + tax_total
   margin_amount = SUM(line_margin_amount)
   margin_percent = grand_total > 0 ? (margin_amount / grand_total * 100) : 0
5. Update the quotation with these totals

Use Prisma transactions to update everything atomically. Explain the margin_percent guard against division by zero.
```

## A2.6 — Add Line Endpoint

```
Add to quotation.controller.ts:

POST /api/v1/internal/quotations/:id/lines
Auth: requireRole('SALES_REP', 'ADMIN')
Validate body with Zod: { productId: string, variantId?: string, quantity: number, discountPercent: number, lineType?: 'ONE_TIME' | 'RECURRING' }

Logic:
1. Verify quotation exists and is in DRAFT or editable state
2. Verify product exists and is active
3. Resolve price: FOR NOW use a stub — just use product.base_price (+ variant price_adjustment if variantId provided). Later Lane C will provide PriceListService.resolvePrice().
4. Get tax_rate and estimated_cost from the product
5. Create a quotation_line with: product_id, variant_id, quantity, unit_price (resolved), discount_percent, tax_rate, estimated_cost, line_type (default ONE_TIME)
6. Call QuotationCalculatorService.recalculateQuotation(quotationId) to compute all totals
7. Return the updated quotation with all lines

Keep under 50 lines in the controller. Business logic goes in the service.
```

## A2.7 — Edit + Delete Line

```
Add two more endpoints to quotation.controller.ts:

1. PATCH /api/v1/internal/quotations/:id/lines/:lineId
   - Body: { quantity?: number, discountPercent?: number }
   - Verify quotation is editable (DRAFT status)
   - Update the line fields
   - Call recalculateQuotation()
   - Return updated quotation with lines

2. DELETE /api/v1/internal/quotations/:id/lines/:lineId
   - Verify quotation is editable
   - Delete the line
   - Call recalculateQuotation()
   - Return updated quotation

After implementing, explain: when we edit a line's discount, why do we need to recalculate the ENTIRE quotation and not just that one line?
```

## A2.8 — Version Increment on Material Edit

```
In the quotation line edit logic (PATCH endpoint), add version increment:

When a material field changes (quantity, discount_percent, or unit_price):
1. Increment quotation.current_version by 1
2. This is a "material edit" per our business rules — it can affect commercial value, margin, and approval requirements

Add this as a small addition to the existing edit handler. After the version increment, also update the quotation's updated_at.

Explain: Why does changing a discount count as a material edit but changing an internal note wouldn't?
```

## A3.2 — Effective Ceiling Calculation

```
Create apps/api/src/modules/quotations/services/discount-risk.service.ts

Add ONE function: getEffectiveCeiling(discountTierId: string, categoryId: string): Promise<number>

Logic:
1. Query discount_tiers to get the tier's discount_ceiling_percent
2. Query category_discount_ceilings to get the ceiling for this category + tier combo
3. If both exist: return MIN(tier_ceiling, category_ceiling)
4. If only tier exists: return tier_ceiling
5. If neither: return 0 (no discount allowed)

This is tiny (~25 lines) but it's the foundation of our entire discount governance system.

After building, explain: Why MIN and not MAX? What business risk does MIN protect against?
```

## A3.4 — Blended Risk Score

```
Add to discount-risk.service.ts:

Function: calculateBlendedRisk(quotationId: string)

Logic:
1. Load all quotation_lines for this quotation (with product → category relation)
2. Load the quotation's customer → discount_tier_id
3. For EACH line:
   a. Call getEffectiveCeiling(discountTierId, line.product.categoryId)
   b. overage = Math.max(0, line.discount_percent - effectiveCeiling)
   c. Store overage as discount_overage_percent on the line (update in DB)
4. blended_risk_score = sum of all overages
5. Return { riskScore, lineDetails: [{ lineId, effectiveCeiling, overage, discountPercent }] }

After building, explain with an example: If a quote has Laptop at 12% (ceiling 15%) and Setup Service at 18% (ceiling 10%), what's the blended risk score? (Answer: 0 + 8 = 8)
```

## A3.6 — evaluateAndRoute (Contract 1)

```
Add to discount-risk.service.ts:

Function: evaluateAndRoute(quotationId: string): Promise<{ requiresApproval: boolean; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; riskScore: number }>

Logic:
1. Call calculateBlendedRisk(quotationId)
2. Determine risk level from score:
   score === 0 → LOW (no approval)
   score > 0 && score <= 5 → MEDIUM (manager only)
   score > 5 → HIGH (manager + finance)
3. Return { requiresApproval: riskLevel !== 'LOW', riskLevel, riskScore }

This is Contract 1 — Lane B will call this function after customer negotiations change quotation terms. Keep it clean and importable.

After building, explain: What happens when Lane B calls this and gets requiresApproval: true? (They set quotation status to PENDING_APPROVAL and create an approval request)
```

## A4.2 — Approval Request Creation

```
Create apps/api/src/modules/approvals/approval.service.ts

Add function: createApprovalRequest(quotationId: string, riskLevel: 'MEDIUM' | 'HIGH', riskScore: number)

Logic:
1. Load the quotation (with lines) to get current_version
2. Create a terms_snapshot: JSON.stringify the current quotation + lines (this captures exactly what the approver is reviewing)
3. Create ApprovalRequest via Prisma:
   - quotation_id, quotation_version = quotation.current_version
   - risk_score, risk_level, terms_snapshot
   - status = PENDING
4. Create ApprovalStep(s):
   If MEDIUM: 1 step → { step_sequence: 1, approver_role: 'MANAGER', status: 'PENDING' }
   If HIGH: 2 steps → { step_sequence: 1, approver_role: 'MANAGER' }, { step_sequence: 2, approver_role: 'FINANCE_OPS' }
5. Update quotation.status = PENDING_APPROVAL
6. Audit: QUOTATION_SUBMITTED
7. Return the approval request with steps

Use a Prisma transaction. After building, explain: Why do we store terms_snapshot? (So if the quote changes later, we can prove the approval was for different terms)
```

## A4.5 — Approve Step

```
Add to approval.service.ts:

Function: decideStep(stepId: string, approverId: string, decision: 'APPROVE' | 'REJECT' | 'RETURN', comment: string)

For now, implement APPROVE only (we'll add REJECT and RETURN next):

1. Load the approval step with its approval_request and the related quotation
2. Validate:
   - step.status must be PENDING
   - approver's role must match step.approver_role
   - approval_request.quotation_version must equal quotation.current_version (stale approval check!)
   - If step_sequence > 1, previous steps must be APPROVED
3. Update step: status = APPROVED, approver_id = approverId, acted_at = now(), comment
4. Check: are there more steps after this one?
   - If yes: do nothing more (next step stays PENDING for its approver)
   - If no: mark approval_request.status = APPROVED, quotation.status = APPROVED
5. Audit: APPROVAL_APPROVED

After building, explain: What's the version check in validation step 2 protecting against?
```

## A4.6+A4.7 — Reject + Return

```
Extend the decideStep function in approval.service.ts to handle REJECT and RETURN:

REJECT branch:
1. Mark step.status = REJECTED, acted_at, comment
2. Mark approval_request.status = REJECTED
3. Mark quotation.status = REJECTED
4. Audit: APPROVAL_REJECTED

RETURN branch:
1. Mark step.status = RETURNED, acted_at, comment
2. Mark approval_request.status = RETURNED
3. Mark quotation.status = DRAFT (goes back to rep for editing)
4. Audit: APPROVAL_RETURNED

After RETURN, when the rep edits the quote → material edit → version increments → old approval becomes stale → must re-evaluate and re-submit.

After building, explain: Why does RETURN set quotation back to DRAFT instead of a separate status?
```

## A4.10 — Approval Decision Endpoint

```
Add to a new file apps/api/src/modules/approvals/approval.controller.ts:

1. GET /api/v1/internal/approvals
   - Auth: requireRole('MANAGER', 'FINANCE_OPS', 'ADMIN')
   - List approval requests that have a PENDING step matching the current user's role
   - Include quotation info (quote_number, customer name, risk_level)

2. GET /api/v1/internal/approvals/:id
   - Same auth
   - Return approval request with all steps and terms_snapshot

3. POST /api/v1/internal/approvals/:id/steps/:stepId/decide
   - Auth: requireRole('MANAGER', 'FINANCE_OPS')
   - Validate body: { decision: 'APPROVE' | 'REJECT' | 'RETURN', comment: string (required) }
   - Call ApprovalService.decideStep()
   - Return updated approval request

Register routes under /api/v1/internal/approvals.
```

---

# Lane B Prompts — Fulfillment & Customer Loop

> **Context prompt (paste once at start of your Lane B session):**

```
You are helping me build the Fulfillment & Customer Loop of DealFlow360 — a B2B sales operations platform.
I own: customer portal, quotation negotiation, quotation confirmation, and warehouse allocation engine.
My backend modules go in: apps/api/src/modules/{portal,negotiations,fulfillment,inventory,backorders}/
My frontend features go in: apps/web/src/features/{portal,fulfillment}/
Tech: TypeScript, Express, Prisma, Zod, React, Tailwind CSS.
Auth (JWT + RBAC) is already built. Prisma schema is migrated. Seed data is loaded.
CRITICAL: The customer portal is a SECURITY BOUNDARY — never expose internal margin, cost, risk, or approval data.
I will give you ONE small task at a time. Build ONLY what I ask for. After each task, briefly explain what you built and why.
```

## B1.2 — Portal Middleware

```
Create apps/api/src/modules/portal/portal.middleware.ts with TWO middleware functions:

1. requirePortalAccess(req, res, next):
   - Check req.user.role === 'CUSTOMER'
   - If not → 403 "Portal access denied"

2. requireQuotationOwnership(req, res, next):
   - Load the quotation by req.params.id
   - Check quotation.customer.users includes req.user.userId (or quotation customer matches user's customer)
   - If not → 403 "Not authorized for this quotation"
   - Attach quotation to req for downstream use

After building, explain: Why do we need ownership checks beyond just role checks? (A CUSTOMER role check alone would let Customer A see Customer B's quotes)
```

## B2.2 — Portal Quotation Detail (Filtered Fields)

```
Create apps/api/src/modules/portal/portal.controller.ts with portal-specific endpoints:

1. GET /api/v1/portal/quotations
   - Middleware: authenticateToken → requirePortalAccess
   - Query quotations where customer's user matches current user
   - Filter: only statuses visible to customers (APPROVED, UNDER_NEGOTIATION, CONFIRMED)
   - Return: id, quote_number, status, grand_total, currency_code, created_at
   - Do NOT return: margin_amount, margin_percent, any internal fields

2. GET /api/v1/portal/quotations/:id
   - Middleware: authenticateToken → requirePortalAccess → requireQuotationOwnership
   - Return quotation with lines, BUT explicitly SELECT only customer-safe fields:
     Quotation: id, quote_number, status, currency_code, subtotal, discount_total, tax_total, grand_total, created_at
     Lines: id, product name, quantity, unit_price, discount_percent, discount_amount, line_total, line_type
   - EXCLUDE: margin_amount, margin_percent, estimated_cost, discount_overage_percent, risk_score

Register under /api/v1/portal — completely separate from /api/v1/internal.

After building, explain: List 5 fields that exist on the internal quotation endpoint but must NOT appear in the portal response.
```

## B3.2 — Negotiation Request Service

```
Create apps/api/src/modules/negotiations/negotiation.service.ts

Add function: createNegotiationRequest(quotationId, customerId, request: { type, lineId?, content, proposedDiscount? })

Logic:
1. Load quotation — verify it belongs to this customer
2. Verify quotation is in a negotiable state (APPROVED or UNDER_NEGOTIATION — not DRAFT, not CONFIRMED, not REJECTED)
3. Create NegotiationRequest record via Prisma:
   - quotation_id, quotation_line_id (if provided), customer_id
   - request_type (COMMENT, CHANGE_REQUEST, COUNTER_DISCOUNT, DELIVERY_DATE)
   - proposed_discount_percent (if COUNTER_DISCOUNT)
   - content, status = PENDING
4. If quotation was APPROVED → change status to UNDER_NEGOTIATION
5. Audit: NEGOTIATION_REQUESTED
6. Return the created request

After building, explain: Why can't a customer negotiate a DRAFT quotation? (They shouldn't even see it — DRAFT is internal-only)
```

## B3.5 — Sales Rep Response + Re-evaluation

```
Add to negotiation.service.ts:

Function: resolveNegotiation(negotiationId, repId, { accepted, adjustedDiscount?, comment })

Logic:
1. Load the negotiation request with its quotation
2. If accepted AND adjustedDiscount provided:
   a. Update the quotation line's discount_percent to adjustedDiscount
   b. Increment quotation.current_version (material edit)
   c. Call QuotationCalculatorService.recalculateQuotation(quotationId) — import from Lane A's module
   d. CALL CONTRACT 1: DiscountRiskService.evaluateAndRoute(quotationId)
      FOR NOW, STUB IT: const riskResult = { requiresApproval: false, riskLevel: 'LOW' as const }
      // TODO: Replace stub with real import when Lane A is ready
   e. If riskResult.requiresApproval → set quotation.status = PENDING_APPROVAL
      If not → quotation stays at UNDER_NEGOTIATION (customer-visible)
3. Mark negotiation: status = accepted ? 'ACCEPTED' : 'REJECTED', resolved_by = repId, resolved_at = now(), resolution_comment = comment
4. Audit: NEGOTIATION_RESOLVED
5. Return updated negotiation + quotation

After building, explain: Why do we increment current_version when accepting a discount change? What does this do to any existing approval? (Makes it stale — approval was for old version)
```

## B5.7 — Transactional Stock Reservation (THE CRITICAL PIECE)

```
Create apps/api/src/modules/inventory/inventory.service.ts

Add function: reserveStock(allocations: Array<{ warehouseId: string, productId: string, quantity: number }>)

This is the most concurrency-critical code in the entire system. Use Prisma's interactive transaction with raw SQL:

await prisma.$transaction(async (tx) => {
  // Step 1: Lock the stock rows to prevent concurrent modifications
  // Use raw SQL because Prisma doesn't support SELECT FOR UPDATE natively
  const lockedStocks = await tx.$queryRaw`
    SELECT id, warehouse_id, product_id, quantity_on_hand, quantity_reserved
    FROM stock_levels
    WHERE (warehouse_id, product_id) IN (VALUES ${...format the pairs...})
    FOR UPDATE
  `;
  
  // Step 2: Validate each allocation against CURRENT available stock (not cached!)
  for (const allocation of allocations) {
    const stock = lockedStocks.find(s => s.warehouse_id === allocation.warehouseId && s.product_id === allocation.productId);
    const available = stock.quantity_on_hand - stock.quantity_reserved;
    if (available < allocation.quantity) {
      throw new Error(`Insufficient stock: ${available} available, ${allocation.quantity} requested`);
    }
  }
  
  // Step 3: Reserve the stock
  for (const allocation of allocations) {
    await tx.stockLevel.update({
      where: { warehouse_id_product_id: { warehouse_id: allocation.warehouseId, product_id: allocation.productId } },
      data: { quantity_reserved: { increment: allocation.quantity } }
    });
  }
  
  // Step 4: Audit
  // ... create audit log entries
});

IMPORTANT: The SELECT FOR UPDATE locks the rows until this transaction commits. Any other transaction trying to read these rows FOR UPDATE will WAIT until we're done. This prevents double-reservation.

After building, explain in detail:
1. What happens if two users call reserveStock for the same product at the same time?
2. Why do we re-read stock INSIDE the transaction instead of trusting a previously loaded value?
3. What does FOR UPDATE do that a normal SELECT doesn't?
```

---

# Lane C Prompts — Money & Monitoring

> **Context prompt (paste once at start of your Lane C session):**

```
You are helping me build the Money & Monitoring layer of DealFlow360 — a B2B sales operations platform.
I own: product catalog, price lists, subscriptions, billing, invoicing, payments, credit notes, Deal Health monitoring, and reporting.
My backend modules go in: apps/api/src/modules/{products,subscriptions,billing,payments,deal-health,reporting}/
My frontend features go in: apps/web/src/features/{admin/products,subscriptions,billing,invoices,deal-health,reporting}/
Tech: TypeScript, Express, Prisma, Zod, React, Tailwind CSS.
Auth (JWT + RBAC) is already built. Prisma schema is migrated. Seed data is loaded.
I will give you ONE small task at a time. Build ONLY what I ask for. After each task, briefly explain what you built and why.
```

## C2.3 — resolvePrice (Contract 2)

```
Create apps/api/src/modules/products/services/price-list.service.ts

Add ONE function: resolvePrice(productId: string, discountTierId: string, currencyCode: string): Promise<{ unitPrice: number; source: 'PRICE_LIST' | 'BASE' }>

Logic:
1. Query price_list_entries where:
   - product_id = productId
   - discount_tier_id = discountTierId
   - currency_code = currencyCode
   - (valid_from IS NULL OR valid_from <= NOW())
   - (valid_to IS NULL OR valid_to >= NOW())
2. If a matching entry exists → return { unitPrice: entry.unit_price, source: 'PRICE_LIST' }
3. If no match → load product.base_price → return { unitPrice: product.base_price, source: 'BASE' }

This is Contract 2 — Lane A will call this function when adding products to quotation lines.

After building, explain with a concrete example: Gold customer buying Laptop Pro in USD. We seeded a price list entry at $1100. What does resolvePrice return? What if they're buying in EUR (no entry exists)?
```

## C3.3 — createFromConfirmedQuotation (Contract 3)

```
Add to apps/api/src/modules/subscriptions/subscription.service.ts:

Function: createFromConfirmedQuotation(quotationId: string): Promise<void>

Logic:
1. Load the quotation with its lines (include product relation)
2. Filter lines where line_type = 'RECURRING'
3. If no recurring lines → return (nothing to do)
4. For each recurring line:
   a. Determine billing interval (check if product has a subscription plan config, default to MONTHLY)
   b. Create SubscriptionInstance:
      - quotation_id, quotation_line_id, product_id
      - billing_interval
      - unit_price = line's unit_price
      - quantity = line's quantity
      - status = ACTIVE
      - current_period_start = quotation.confirmed_at (or now())
      - current_period_end = add interval to period_start (1 month / 3 months / 12 months)
      - next_billing_date = current_period_end
5. Audit: SUBSCRIPTION_CREATED for each

This is Contract 3 — Lane B calls this when a customer confirms a quotation.

After building, explain: If a confirmed quotation has 3 lines — 2 hardware (ONE_TIME) and 1 Cloud License (RECURRING) — how many subscriptions get created? (Answer: 1 — only the RECURRING line)
```

## C4.2 — Subscription Modification with Proration

```
Add to subscription.service.ts:

Function: modifySubscription(subscriptionId: string, { newQuantity?: number, newPlanInterval?: BillingInterval })

Proration logic:
1. Load the subscription
2. Calculate used fraction:
   days_used = differenceInDays(today, current_period_start)
   days_in_period = differenceInDays(current_period_end, current_period_start)
   used_fraction = days_used / days_in_period  (guard against /0)
3. Calculate proration:
   old_period_amount = subscription.unit_price * subscription.quantity
   new_period_amount = subscription.unit_price * (newQuantity ?? subscription.quantity) — adjust for plan changes too
   credit_for_remaining = old_period_amount * (1 - used_fraction)
   charge_for_remaining = new_period_amount * (1 - used_fraction)
   proration_adjustment = charge_for_remaining - credit_for_remaining
4. If proration_adjustment < 0 → create a CreditNote for the difference
5. Update subscription: quantity, billing_interval as needed
6. Audit: SUBSCRIPTION_MODIFIED

After building, explain with numbers: A $90/month subscription (10 units at $9 each) upgrades to 15 units on day 10 of a 30-day period. What's the proration adjustment?
(used = 10/30 = 0.333, remaining = 0.667. Old remaining = $90 * 0.667 = $60. New remaining = $135 * 0.667 = $90. Adjustment = +$30)
```

## C5.2 — One-Time Invoice Generation

```
Create apps/api/src/modules/billing/services/invoice-generator.service.ts

Function: generateOneTimeInvoice(quotationId: string)

Logic:
1. Load quotation with lines
2. Read fulfillment_allocations for this quotation where status = 'FULFILLED' (this is Contract 4 — we read Lane B's table directly)
3. If no FULFILLED allocations → throw error "Cannot invoice: nothing has been shipped yet" (Business rule §6.38: nothing is billed before it ships!)
4. For each fulfilled line:
   a. Get the quotation line pricing
   b. Create InvoiceLine: description = product name, quantity, unit_price, discount_amount, tax_amount, line_total
5. Generate invoice_number (format: "INV-" + timestamp)
6. Create Invoice:
   - type = ONE_TIME, quotation_id, customer_id
   - subtotal = sum of line net values
   - tax_total = sum of tax amounts
   - grand_total = subtotal + tax_total
   - balance_due = grand_total (nothing paid yet)
   - status = DRAFT
   - due_date = 30 days from now
7. Audit: INVOICE_GENERATED

After building, explain: Why do we check fulfillment status instead of just invoicing after confirmation? What would go wrong if we invoiced a product that hasn't shipped?
```

## C7.2 — STALLED Detection

```
Create apps/api/src/modules/deal-health/deal-health.service.ts

Add function: detectStalled(stalledDays: number = 7)

Logic:
1. Query quotations where:
   - status IN ('DRAFT', 'PENDING_APPROVAL', 'UNDER_NEGOTIATION')
   - updated_at < NOW() - stalledDays days
2. For each found quotation:
   a. Check if a DealHealthFlag already exists for this quotation + type='STALLED' + is_acknowledged=false
   b. If not → create DealHealthFlag:
      - quotation_id, flag_type = 'STALLED'
      - severity based on how long it's been stalled (> 14 days = 'HIGH', > 7 = 'MEDIUM')
      - description = "Quotation inactive for X days"
3. Return count of new flags created

After building, explain: 
- Why do we check for existing flags? (To avoid creating duplicate flags every time the detector runs)
- What statuses do we NOT check? Why? (CONFIRMED — deal is done. REJECTED — deal is dead. Neither can be "stalled")
```

## C7.3 — DISCOUNT_ANOMALY Detection

```
Add to deal-health.service.ts:

Function: detectDiscountAnomalies(anomalyThreshold: number = 1.5)

Logic:
1. Get all active sales reps
2. For each rep:
   a. Calculate their historical average discount: AVG(quotation_lines.discount_percent) across their last 20 quotations
   b. Get their current/recent quotations (last 7 days)
   c. For each current quotation: calculate the average discount across its lines
   d. If current_avg_discount > historical_avg * anomalyThreshold → create flag
      - flag_type = 'DISCOUNT_ANOMALY'
      - severity = 'HIGH' if > 2x threshold, else 'MEDIUM'
      - description = "Discount {current_avg}% is significantly above rep's average of {historical_avg}%"

After building, explain with an example: Rep Sarah's historical average is 8%. Her latest quote has an average of 14%. With threshold 1.5x:
- 8% × 1.5 = 12%. Since 14% > 12% → FLAGGED as DISCOUNT_ANOMALY
```

---

# Integration Prompts (All Members)

## I1 — Wire Contract 1 (Lane A + B)

```
Lane B currently has a stub for DiscountRiskService.evaluateAndRoute(). Replace the stub with the real import from Lane A's module.

In apps/api/src/modules/negotiations/negotiation.service.ts, find the stub:
  const riskResult = { requiresApproval: false, riskLevel: 'LOW' as const }

Replace with:
  import { DiscountRiskService } from '../../quotations/services/discount-risk.service';
  const riskResult = await DiscountRiskService.evaluateAndRoute(quotationId);

Test the full flow: customer submits counter-discount → rep accepts with 18% on Services → risk evaluates to HIGH → quotation goes to PENDING_APPROVAL → Manager + Finance must approve.
```

## I2 — Wire Contract 2 (Lane A + C)

```
Lane A currently uses a price stub (product.base_price) when adding quotation lines. Replace with Lane C's real PriceListService.resolvePrice().

In the add-line logic, find where we set unit_price = product.base_price and replace with:
  import { PriceListService } from '../../products/services/price-list.service';
  const priceResult = await PriceListService.resolvePrice(productId, customer.discount_tier_id, quotation.currency_code);
  const unitPrice = priceResult.unitPrice;

Test: Add Laptop Pro to a Gold customer's USD quotation → price should be $1100 (from price list), not $1200 (base price).
```

## I3 — Wire Contract 3 (Lane B + C)

```
Lane B's confirmation handler has a TODO for SubscriptionService.createFromConfirmedQuotation(). Wire it.

In the confirm endpoint, find the TODO comment and replace with:
  import { SubscriptionService } from '../../subscriptions/subscription.service';
  await SubscriptionService.createFromConfirmedQuotation(quotationId);

Test: Confirm a quotation that has a Cloud License (RECURRING) line → verify a SubscriptionInstance is created with correct billing dates.
```
