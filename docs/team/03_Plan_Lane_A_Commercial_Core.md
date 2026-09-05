# DealFlow360 — Lane A: Commercial Core — Full Implementation Plan

> **Owner:** Lane A team member
> **Use cases:** UC-01, UC-03, UC-05–UC-11
> **Screens:** 1 (Login), 2 (Dashboard), 3 (Quotations List), 4 (Quotation Detail), 5 (Approvals List), 6 (Approval Detail), 18 (Discount/Approval Config)
> **Micro-steps:** 44 total — each one produces ~30–80 lines of code you can explain

---

## Your domain in one paragraph

You own the heart of DealFlow360 — the quotation lifecycle from creation through discount governance to approval routing. Every quotation that enters the system passes through your code. You also own auth (the front door for everyone) and the recommendation engine (the upsell/cross-sell panel). When you're done, a sales rep can log in, build a quote, see live margin + risk, get automatic approval routing, and have reviewers approve/reject/return — all with a full audit trail.

---

## What you DON'T own (and how you interact)

- **Products / Price Lists** → Lane C owns. You consume `PriceListService.resolvePrice()` (Contract 2). Until Lane C's implementation is ready, use a stub that returns the product's `base_price`.
- **Customer Portal / Negotiation** → Lane B owns. But when a negotiation changes terms, Lane B calls YOUR `DiscountRiskService.evaluateAndRoute()` (Contract 1). Build this endpoint early.
- **Fulfillment / Billing** → Lanes B and C. You don't touch these.
- **Products/Categories tables** → Lane C writes them. You read them freely (Contract 5) for the recommendation engine.

---

## Step A1 — Authentication (✅ COMPLETED in Foundation Phase F4)

> **Status:** Fully implemented, verified, and pushed to `main` (commit `1471dc0`).
> - **Backend:** [auth.service.ts](file:///d:/projects/dreamflow/apps/api/src/modules/auth/auth.service.ts), [auth.controller.ts](file:///d:/projects/dreamflow/apps/api/src/modules/auth/auth.controller.ts), [auth.middleware.ts](file:///d:/projects/dreamflow/apps/api/src/modules/auth/auth.middleware.ts), [rbac.middleware.ts](file:///d:/projects/dreamflow/apps/api/src/modules/auth/rbac.middleware.ts)
> - **Frontend:** [AuthContext.tsx](file:///d:/projects/dreamflow/apps/web/src/context/AuthContext.tsx), [LoginPage.tsx](file:///d:/projects/dreamflow/apps/web/src/features/auth/LoginPage.tsx), [ProtectedRoute.tsx](file:///d:/projects/dreamflow/apps/web/src/features/auth/ProtectedRoute.tsx)
> - **Endpoints:** `POST /api/v1/auth/signup`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
> **Lane A owner:** You can proceed directly to **Step A2 — Quotation CRUD**!

### A1.1 — LEARN: Auth architecture [✅ COMPLETED in F4]
- **Read:** §8.17–8.20 (authentication + password security + tokens + authorization)
- **Understand:** Why JWT? Why bcrypt/argon2? What goes in the token payload?
- **Explain check:** *"Why do we hash passwords instead of encrypting them? What's the difference?"*

### A1.2 — BUILD: Password hashing + user creation service
- Create `apps/api/src/modules/auth/auth.service.ts`
- One function: `signup(email, password, fullName, role)` → hash password with bcrypt, create user via Prisma, return user (without password_hash)
- **~30 lines.** No endpoint yet — just the service function.
- **Explain check:** *"What does the `salt rounds` parameter in bcrypt do?"*

### A1.3 — BUILD: Login service
- Add to `auth.service.ts`: `login(email, password)` → find user, compare hash with bcrypt, generate JWT with `{ userId, role }`, return token
- **~25 lines.** Still no endpoint.
- **Explain check:** *"What's inside our JWT payload? Why do we include `role` in the token?"*

### A1.4 — BUILD: Auth endpoints
- Create `apps/api/src/modules/auth/auth.controller.ts`
- `POST /api/v1/auth/signup` → validate with Zod, call `signup()`, return user + token
- `POST /api/v1/auth/login` → validate with Zod, call `login()`, return token
- `GET /api/v1/auth/me` → extract user from token, return profile
- **~50 lines.**
- **Verify:** `curl -X POST http://localhost:3001/api/v1/auth/signup -H "Content-Type: application/json" -d '{"email":"test@demo.com","password":"test123","fullName":"Test User","role":"SALES_REP"}'`
- **Explain check:** *"What HTTP status do we return for invalid credentials? Why not 404?"*

### A1.5 — BUILD: JWT middleware
- Create `apps/api/src/modules/auth/auth.middleware.ts`
- `authenticateToken(req, res, next)` → extract Bearer token from header, verify JWT, attach `req.user = { userId, role }`
- **~20 lines.**
- **Verify:** Add middleware to `GET /api/v1/auth/me`, call without token → 401, call with token → user data
- **Explain check:** *"What happens if someone sends an expired or tampered JWT?"*

### A1.6 — BUILD: RBAC middleware
- Create `apps/api/src/modules/auth/rbac.middleware.ts`
- `requireRole(...roles)` → returns middleware that checks `req.user.role` is in allowed list, returns 403 if not
- **~15 lines.**
- **Verify:** Create a test endpoint that requires `ADMIN` role, call as `SALES_REP` → 403, call as `ADMIN` → 200
- **Explain check:** *"Why is authorization checked on the server, not just the frontend?"*

### A1.7 — BUILD: Login page UI
- Create `apps/web/src/features/auth/LoginPage.tsx`
- Email + password form, submit → `POST /api/v1/auth/login`, store JWT in memory/state, redirect based on role
- **~60 lines.**
- **Verify:** Open browser, log in as rep@demo.com → redirects to `/app/dashboard`
- **Explain check:** *"Why do we store the JWT in memory instead of localStorage? What's the security tradeoff?"*

### A1.8 — BUILD: Route guards
- Create `apps/web/src/components/ProtectedRoute.tsx`
- Check token exists + role matches, redirect to login if not
- Wire: `/app/*` requires internal roles, `/portal/*` requires CUSTOMER
- **~30 lines.**
- **Verify:** Try navigating to `/app/dashboard` without logging in → redirected to login
- **Explain check:** *"Can a CUSTOMER access /app/dashboard? What stops them?"*

---

## Step A2 — Quotation CRUD

### A2.1 — LEARN: Quotation data model
- **Read:** §6.6 (quotation creation rules), §5 quotation/quotation_lines table definitions
- **Understand:** What fields does a quotation have? What's `current_version` for? Why `quote_number`?
- **Explain check:** *"What's the difference between `subtotal`, `grand_total`, and `discount_total` on a quotation?"*

### A2.2 — BUILD: Create quotation service
- Create `apps/api/src/modules/quotations/quotation.service.ts`
- Function: `createQuotation(salesRepId, customerId, currencyCode)` → create quotation with status=DRAFT, version=1, generate quote_number, write audit log
- **~35 lines.**
- **Explain check:** *"Why does every new quotation start at version 1?"*

### A2.3 — BUILD: Create quotation endpoint
- Create `apps/api/src/modules/quotations/quotation.controller.ts`
- `POST /api/v1/internal/quotations` → Zod validation, auth (SALES_REP/ADMIN), call service, return quotation
- `GET /api/v1/internal/quotations` → list with optional filters (status, salesRepId)
- `GET /api/v1/internal/quotations/:id` → detail with lines
- **~50 lines.**
- **Verify:** `curl -X POST .../quotations -d '{"customerId":"...","currencyCode":"USD"}'` → get back a DRAFT quotation with quote_number
- **Explain check:** *"Can a MANAGER create a quotation? Should they be able to? Check Section 3.8."*

### A2.4 — LEARN: Line pricing + total calculation
- **Read:** §6.7 (line rules), §6.8 (price resolution), §6.24 (margin calculation)
- Write out the formulas on paper:
  ```
  discount_amount = unit_price × quantity × (discount_percent / 100)
  net_line_value  = (unit_price × quantity) - discount_amount
  tax_amount      = net_line_value × (tax_rate / 100)
  line_total      = net_line_value + tax_amount
  line_margin     = net_line_value - estimated_cost
  ```
- **Explain check:** *"If a product costs $100, quantity is 5, discount is 10%, tax is 8% — what's the line_total?"* (Answer: $100×5 = $500, discount = $50, net = $450, tax = $36, total = $486)

### A2.5 — BUILD: Quotation calculator service
- Create `apps/api/src/modules/quotations/services/quotation-calculator.service.ts`
- Function: `recalculateQuotation(quotationId)` → load all lines, calculate each line's amounts, sum to quotation totals (subtotal, discount_total, tax_total, grand_total, margin_amount, margin_percent)
- Guard against division by zero on margin_percent
- **~50 lines.**
- **Explain check:** *"Why do we recalculate on the server instead of trusting the frontend's math?"*

### A2.6 — BUILD: Add line endpoint
- Add to controller: `POST /api/v1/internal/quotations/:id/lines`
- Body: `{ productId, variantId?, quantity, discountPercent }`
- Resolve price (stub: use product.base_price for now — Contract 2)
- Calculate line amounts using the formulas
- Save line, call `recalculateQuotation()`
- **~45 lines.**
- **Verify:** Add a line with product "Laptop" ($1200), qty 2, discount 10% → check line_total = ($1200×2 - $240) × 1.08 = $2073.60 (assuming 8% tax)
- **Explain check:** *"What does the stub for PriceListService.resolvePrice() return? When will we replace it?"*

### A2.7 — BUILD: Edit + delete line
- Add to controller:
  - `PATCH /api/v1/internal/quotations/:id/lines/:lineId` — edit qty/discount
  - `DELETE /api/v1/internal/quotations/:id/lines/:lineId` — remove line
- Both call `recalculateQuotation()` after
- **~40 lines.**
- **Verify:** Edit a line's discount from 10% to 15% → totals update. Delete a line → totals update.
- **Explain check:** *"After editing a line, which quotation-level fields need recalculation?"*

### A2.8 — BUILD: Material edit + version increment
- **Read:** §6.4 (material vs non-material changes), §6.5 (versioning)
- Add to edit-line logic: if the edit changes price/qty/discount → `current_version++`
- **~15 lines** (small addition to existing code).
- **Verify:** Edit a line's quantity → check `current_version` incremented from 1 to 2
- **Explain check:** *"Why does changing a discount count as a 'material edit' but changing an internal note doesn't?"*

### A2.9 — BUILD: Quotation List page UI
- Create `apps/web/src/features/quotations/QuotationListPage.tsx`
- Fetch `GET /api/v1/internal/quotations`, display table: quote_number, customer name, status badge, grand_total, date
- Filter dropdown by status, search by customer
- "New Quotation" button
- **~70 lines.**
- **Verify:** Open browser → see seeded quotations in the list with correct status badges

### A2.10 — BUILD: Quotation Detail page UI (basic)
- Create `apps/web/src/features/quotations/QuotationDetailPage.tsx`
- Fetch quotation + lines, show:
  - Customer name, quote number, status
  - Line items table: product, qty (+/-), unit_price, discount %, line_total
  - Summary panel: subtotal, discount, tax, grand_total, margin %
- Product picker to add new lines
- **~80 lines.** (This is the biggest micro-step — but it's all UI, easy to read)
- **Verify:** Open a seeded DRAFT quotation → see all lines with correct totals
- **Explain check:** *"Where do the totals on screen come from — frontend calculation or API response?"* (Answer: API response. Server is authoritative.)

---

## Step A3 — Discount Governance + Risk Engine

### A3.1 — LEARN: Effective discount ceiling
- **Read:** §6.9 (governance rule), §6.10 (effective ceiling), §6.11 (line overage)
- Understand the two ceilings and why we use MIN:
  ```
  Gold customer = 15% tier ceiling
  Services category = 10% category ceiling
  effective = MIN(15%, 10%) = 10%
  ```
- **Explain check:** *"Why MIN and not MAX? What business risk does MIN protect against?"* (Answer: MIN means we take the stricter limit. If services have thin margins, we don't let a Gold customer discount them as much as hardware, even though Gold normally allows 15%.)

### A3.2 — BUILD: Effective ceiling calculation
- Create `apps/api/src/modules/quotations/services/discount-risk.service.ts`
- Function: `getEffectiveCeiling(discountTierId, categoryId)` → query discount_tiers + category_discount_ceilings, return `MIN(tier_ceiling, category_ceiling)`
- Handle case where no category ceiling exists (fall back to tier ceiling only)
- **~25 lines.**
- **Verify:** Call with Gold tier + Services category → returns 10%. Gold + Hardware → returns 15%.
- **Explain check:** *"What if there's no category ceiling configured for a product's category? What do we use?"*

### A3.3 — BUILD: Line overage calculation
- Add to `discount-risk.service.ts`:
- Function: `calculateLineOverage(discountPercent, effectiveCeiling)` → `MAX(0, discountPercent - effectiveCeiling)`
- **~5 lines.** Tiny, but it's a named concept worth understanding.
- **Verify:** 12% discount, 15% ceiling → overage = 0. 18% discount, 10% ceiling → overage = 8.
- **Explain check:** *"What does overage = 0 mean for this line? Does it need approval?"*

### A3.4 — BUILD: Blended risk score
- Add: `calculateBlendedRisk(quotationId)` → for each line, get effective ceiling, calculate overage, sum all overages
- Store `discount_overage_percent` on each line for explainability
- Return `{ riskScore, lineDetails: [{ lineId, effectiveCeiling, overage }] }`
- **~35 lines.**
- **Verify:** Quote with Laptop at 12% (ceiling 15%, overage 0) + Setup Service at 18% (ceiling 10%, overage 8) → blended_risk_score = 8
- **Explain check:** *"Why is it called 'blended'? What does it catch that checking each line alone doesn't?"* (Answer: many small overages on different lines can add up to significant margin leakage even if no single line looks alarming)

### A3.5 — BUILD: Risk level determination
- Add: `determineRiskLevel(riskScore)` → LOW (score=0), MEDIUM (0 < score ≤ 5), HIGH (score > 5)
- Read thresholds from config (or hardcode with comment "move to config table")
- **~15 lines.**
- **Verify:** score=0 → LOW. score=3 → MEDIUM. score=8 → HIGH.
- **Explain check:** *"Who approves a MEDIUM risk quote? Who approves HIGH? Where is that decided?"* (Answer: §6.14 — MEDIUM = Manager only, HIGH = Manager + Finance)

### A3.6 — BUILD: evaluateAndRoute() — Contract 1
- Add the full evaluation pipeline:
  ```ts
  async evaluateAndRoute(quotationId: string): Promise<{
    requiresApproval: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    riskScore: number;
  }>
  ```
- Calls: `calculateBlendedRisk()` → `determineRiskLevel()` → returns result
- **~20 lines** (orchestrator — calls the functions you already built).
- **Verify:** Call on the seeded quote that has a high-discount service line → returns `{ requiresApproval: true, riskLevel: 'HIGH', riskScore: 8 }`
- **Explain check:** *"Lane B will call this function after customer negotiation. What happens if the negotiation lowers the discount to within limits?"* (Answer: riskScore drops to 0, requiresApproval = false, no new approval needed)

### A3.7 — BUILD: Risk badge UI
- Add to Quotation Detail page: risk score badge (green/yellow/red), per-line overage indicators
- Call `evaluateAndRoute()` on the backend when quotation loads, include result in API response
- **~30 lines** UI additions.
- **Verify:** Open the seeded quote with high-discount lines → see red risk badge, overage indicators on service lines

---

## Step A4 — Approval Workflow

### A4.1 — LEARN: Approval state machine
- **Read:** §6.14–6.18 (approval routing, creation, step ordering, actions, validity)
- Draw the state machine on paper:
  ```
  DRAFT → submit → PENDING_APPROVAL
  PENDING_APPROVAL → approve all steps → APPROVED
  PENDING_APPROVAL → reject → REJECTED
  PENDING_APPROVAL → return → DRAFT (re-edit → re-evaluate)
  ```
- **Explain check:** *"Can Finance approve before Manager? Why not?"* (Answer: §6.16 — steps are ordered, Finance is sequence 2 and can't act until Manager step = APPROVED)

### A4.2 — BUILD: ApprovalRequest creation service
- Create `apps/api/src/modules/approvals/approval.service.ts`
- Function: `createApprovalRequest(quotationId, riskLevel, riskScore)` →
  - Snapshot the quotation version + terms (JSON)
  - Create ApprovalRequest record
  - Create ApprovalStep(s): MEDIUM = 1 step (MANAGER, seq=1), HIGH = 2 steps (MANAGER seq=1, FINANCE seq=2)
  - Return the created request with steps
- **~45 lines.**
- **Explain check:** *"What is `terms_snapshot` and why do we store it?"* (Answer: it captures the exact commercial terms the approver is reviewing, so if the quote changes later we can prove the approval was for different terms)

### A4.3 — VERIFY: Unit test for approval creation
- Write a simple test (or use curl):
  - Create a quotation, set its risk to MEDIUM
  - Call `createApprovalRequest(quotationId, 'MEDIUM', 3)`
  - Assert: 1 ApprovalStep exists with approver_role = 'MANAGER', status = 'PENDING'
  - Repeat for HIGH risk → assert 2 steps
- **Explain check:** *"How many approval steps does a LOW risk quote get?"* (Answer: zero — no approval request is created at all)

### A4.4 — BUILD: Submit quotation endpoint
- Add to quotation controller: `POST /api/v1/internal/quotations/:id/submit`
- Logic: evaluate risk → if LOW, skip approval (mark customer-visible) → if MEDIUM/HIGH, create approval request → set quotation status = PENDING_APPROVAL → audit log
- **~40 lines.**
- **Verify:** `curl -X POST .../quotations/{id}/submit` on a quote with overage=3 → quotation status = PENDING_APPROVAL, 1 approval step created
- **Explain check:** *"What status does a LOW-risk quotation go to after submit? Not PENDING_APPROVAL — what then?"*

### A4.5 — BUILD: Approve step — single step
- Add to `approval.service.ts`: `decideStep(stepId, approverId, decision, comment)`
- For now, implement APPROVE only:
  - Validate: step is PENDING, approver has correct role, quotation version matches
  - Mark step APPROVED, set `acted_at`
  - If no more steps → approval_request.status = APPROVED, quotation.status = APPROVED
  - Audit: APPROVAL_APPROVED
- **~40 lines.**
- **Verify:** Submit a MEDIUM-risk quote → 1 Manager step → approve as Manager → quotation status = APPROVED
- **Explain check:** *"What do we check about the quotation version before allowing approval?"* (Answer: §6.18 — approval_request.quotation_version must match quotation.current_version)

### A4.6 — BUILD: Reject step
- Add REJECT branch to `decideStep()`:
  - Mark step REJECTED → request REJECTED → quotation REJECTED
  - Audit: APPROVAL_REJECTED
- **~15 lines** (added to existing function).
- **Verify:** Submit quote → reject as Manager → quotation = REJECTED
- **Explain check:** *"After rejection, can the Sales Rep resubmit? What status does the quote go to?"*

### A4.7 — BUILD: Return for revision
- Add RETURN branch to `decideStep()`:
  - Mark step RETURNED → request RETURNED → quotation → DRAFT
  - Audit: APPROVAL_RETURNED
  - When rep edits the quote → material edit → version++ → old approval is stale → must re-evaluate
- **~15 lines.**
- **Verify:** Submit → return → quotation = DRAFT. Edit a line → version increments. Try to submit again → new approval request created with new version.
- **Explain check:** *"Why does returning a quotation set it back to DRAFT instead of creating a new status?"*

### A4.8 — BUILD: Multi-step approval (Manager → Finance)
- Extend `decideStep()`: after Manager approves, check if next step exists → keep request PENDING, next step activates
- **~15 lines** (mostly an `if` check in existing code).
- **Verify:** Submit HIGH-risk quote → Manager approves → Finance step still PENDING, quotation still PENDING_APPROVAL → Finance approves → quotation = APPROVED
- **Explain check:** *"What happens if Manager rejects a HIGH-risk quote? Does Finance ever see it?"* (Answer: no — rejection stops the entire chain)

### A4.9 — BUILD: Approval validity guard
- Add to confirmation/approval check: `isApprovalValid(quotationId)` → compare `approval_request.quotation_version === quotation.current_version`
- **~15 lines.**
- **Verify:** Approve a quote → edit a line (version goes 1→2) → call `isApprovalValid()` → returns false (stale)
- **Explain check:** *"A customer negotiates after approval, changing the discount. The old approval was for version 1, the quote is now version 2. What must happen?"* (Answer: old approval is stale, system must re-evaluate and potentially create a new approval request)

### A4.10 — BUILD: Approval decision endpoint
- Add to controller: `POST /api/v1/internal/approvals/:id/steps/:stepId/decide`
- Body: `{ decision: 'APPROVE' | 'REJECT' | 'RETURN', comment }`
- Auth: MANAGER for first step, FINANCE_OPS for second
- **~30 lines.**
- **Verify:** Full end-to-end via curl: create quote → add lines with discount → submit → approve → check statuses

### A4.11 — BUILD: Approvals list + detail endpoints
- `GET /api/v1/internal/approvals` — list pending approvals for current user's role
- `GET /api/v1/internal/approvals/:id` — detail with steps + terms snapshot
- **~35 lines.**
- **Verify:** Log in as Manager → GET approvals → see pending items. Log in as Sales Rep → empty list.

### A4.12 — BUILD: Approval List page UI (Screen 5)
- Create `apps/web/src/features/approvals/ApprovalListPage.tsx`
- Table: quote_number, customer, risk level badge, submitted date, status
- Filter: pending only / all
- **~50 lines.**
- **Verify:** Log in as Manager → see pending approvals list

### A4.13 — BUILD: Approval Detail page UI (Screen 6)
- Create `apps/web/src/features/approvals/ApprovalDetailPage.tsx`
- Terms snapshot view, steps list with status indicators
- Approve / Reject / Return buttons (only for active step's approver)
- Comment field (required)
- Audit trail at bottom
- **~70 lines.**
- **Verify:** Open a pending approval → approve as Manager → status updates live

---

## Step A5 — Recommendation Engine

### A5.1 — LEARN: Recommendation rules
- **Read:** §6.22–6.23 (recommendation rules + ranking)
- **Understand:** What makes a product a candidate? What excludes it? How do we rank?
- **Explain check:** *"Why do we filter out products below minimum margin threshold?"* (Answer: suggesting a low-margin product could hurt the deal's profitability)

### A5.2 — BUILD: Candidate filtering
- Create `apps/api/src/modules/recommendations/recommendation.service.ts`
- Function: `getCandidates(quotationId)` → get all active products, remove products already in quote, remove products below minimum margin
- **~30 lines.**
- **Explain check:** *"If a quote already has 'Laptop', should we suggest 'Laptop' again?"* (Answer: no — already in quote, filtered out)

### A5.3 — BUILD: Scoring + ranking
- Add: `scoreAndRank(candidates, quotationLines)` →
  - co_purchase_score = count of times this product appeared alongside existing quote products in past orders
  - promotion_boost = +N if product.is_promoted
  - recommendation_score = co_purchase_score + promotion_boost
  - Sort descending, return top N
- **~35 lines.**
- **Explain check:** *"How does the system know which products are commonly bought together?"* (Answer: it queries historical quotation_lines for co-occurrence)

### A5.4 — BUILD: Margin delta calculation
- Add: for each candidate, calculate what adding it would do to the quote's margin
  - margin_delta = (candidate.base_price - candidate.estimated_cost) / new_grand_total
- **~20 lines.**
- **Verify:** Recommendation for a high-margin product → positive margin_delta. Low-margin → small or negative delta.
- **Explain check:** *"Why show margin delta on the recommendation card?"* (Answer: so the rep can make informed decisions about which suggestions actually help the deal)

### A5.5 — BUILD: Recommendation endpoint
- `GET /api/v1/internal/quotations/:id/recommendations`
- Returns: `[{ product, recommendationScore, marginDelta, isPromoted }]`
- **~20 lines.**
- **Verify:** Call on a quote with hardware products → get suggestions with scores

### A5.6 — BUILD: Upsell panel UI
- Add to QuotationDetailPage: collapsible side panel showing recommendation cards
- Each card: product name, price, margin delta (green/red arrow), promo badge
- "Add to Quote" button → calls add-line endpoint → recalculates totals → refreshes recommendations
- "Dismiss" button → hides card
- **~60 lines.**
- **Verify:** Open quotation builder → see recommendations panel → add one → totals update → recommendation disappears from list

---

## Step A6 — Dashboard + Config

### A6.1 — BUILD: Dashboard aggregation endpoint
- `GET /api/v1/internal/dashboard`
- Returns: quotation counts by status, recent 10 quotations, pending approval count
- **~30 lines.**
- **Verify:** Call endpoint → get correct counts matching seeded data

### A6.2 — BUILD: Dashboard page UI (Screen 2)
- Create `apps/web/src/features/dashboard/DashboardPage.tsx`
- Stat cards (total quotes, pending approvals, etc.), recent quotations list, quick action buttons
- **~60 lines.**
- **Verify:** Log in → see dashboard with correct numbers from seed data

### A6.3 — BUILD: Discount tier CRUD endpoints
- `GET/POST/PATCH/DELETE /api/v1/internal/discount-tiers/*`
- CRUD for: name (Bronze/Silver/Gold/Platinum), discount_ceiling_percent
- Auth: ADMIN or MANAGER only
- **~40 lines.**
- **Verify:** Create a new "Platinum" tier with 20% ceiling → list tiers → see 4 tiers

### A6.4 — BUILD: Category ceiling CRUD endpoints
- `GET/POST/PATCH/DELETE /api/v1/internal/discount-rules/*`
- CRUD for: category_id, discount_ceiling_percent per tier
- **~40 lines.**
- **Verify:** Set Services ceiling to 8% → re-evaluate a quote with 10% service discount → overage increases

### A6.5 — BUILD: Approval threshold config
- `GET/PUT /api/v1/internal/approval-config`
- Configure: medium_threshold (default 5), high_threshold
- **~20 lines.**

### A6.6 — BUILD: Config page UI (Screen 18)
- Create `apps/web/src/features/admin/discount-config/DiscountConfigPage.tsx`
- Two tables: discount tiers, category ceilings. Inline edit/add/delete.
- Threshold config form
- **~70 lines.**
- **Verify:** Open config page → edit a tier ceiling → re-submit a quote → approval routing changes
- **Explain check:** *"If we lower the Services ceiling from 10% to 5%, what happens to existing quotes?"* (Answer: existing approved quotes aren't affected, but any new submission or re-evaluation will use the new ceiling)

---

## Your key tables (from Section 5)

| Table | Key columns you care about |
|---|---|
| `users` | id, email, password_hash, role, full_name, is_active |
| `quotations` | id, quote_number, customer_id, sales_rep_id, status, current_version, currency_code, subtotal, discount_total, tax_total, grand_total, margin_amount, margin_percent |
| `quotation_lines` | id, quotation_id, product_id, variant_id, quantity, unit_price, discount_percent, discount_amount, tax_rate, tax_amount, line_total, estimated_cost, margin_amount, discount_overage_percent, line_type |
| `approval_requests` | id, quotation_id, quotation_version, risk_score, risk_level, terms_snapshot, status |
| `approval_steps` | id, approval_request_id, step_sequence, approver_role, approver_id, status, comment, acted_at |
| `discount_tiers` | id, name, discount_ceiling_percent |
| `category_discount_ceilings` | id, category_id, discount_tier_id, discount_ceiling_percent |

---

## Files you create

```
apps/api/src/modules/
  auth/
    auth.controller.ts
    auth.service.ts
    auth.middleware.ts
    rbac.middleware.ts
  quotations/
    quotation.controller.ts
    quotation.service.ts
    services/
      discount-risk.service.ts
      quotation-calculator.service.ts
  approvals/
    approval.controller.ts
    approval.service.ts
  recommendations/
    recommendation.controller.ts
    recommendation.service.ts
  discount-config/
    discount-config.controller.ts
    discount-config.service.ts

apps/web/src/features/
  auth/
    LoginPage.tsx
    SignupPage.tsx
  dashboard/
    DashboardPage.tsx
  quotations/
    QuotationListPage.tsx
    QuotationDetailPage.tsx
    components/
      QuotationLineTable.tsx
      UpsellPanel.tsx
      RiskBadge.tsx
  approvals/
    ApprovalListPage.tsx
    ApprovalDetailPage.tsx
  admin/
    discount-config/
      DiscountConfigPage.tsx
```

---

## Integration touchpoints

| When | What | With whom |
|---|---|---|
| **Checkpoint 1 (T+7)** | Your approve flow works end-to-end solo with seed data | Just you |
| **Integration (T+14)** | Wire `resolvePrice()` to Lane C's real implementation | Lane C |
| **Integration (T+14)** | Confirm Lane B can call your `evaluateAndRoute()` | Lane B |
| **Demo prep** | Your screens are the first thing judges see — polish Login + Dashboard + Quote Builder | You |
