# DealFlow360 — Section 6: Business Rules and State Transitions

> **Status:** OFFICIAL / LOCKED
>
> **Purpose:** Control file for the coding agent. Defines the deterministic business rules, lifecycle states, transition guards, calculations, invariants, and side effects that make DealFlow360 a real business system rather than a collection of CRUD screens.
>
> **Derived from:** Section 1 — Problem Restatement; Section 2 — Actors / Roles; Section 3 — Core Use Cases; Section 4 — Entities and Relationships; Section 5 — Database Schema; DealFlow360 problem statement; DealFlow360 End-to-End Product Flow (Excalidraw).
>
> **Critical distinction:** The problem statement defines the required business outcomes, but it does not define every exact mathematical formula, cutoff, algorithm, or persistence strategy. Wherever this section introduces a concrete implementation rule not explicitly fixed by the source, it is marked as an **implementation decision**. Such a decision is part of our build contract, not a claim that the source prescribed that exact formula.

---

# 6.1 Rule Design Principle

DealFlow360 must behave as a **rule-driven state machine**.

For a business operation:

```text
Input
  ↓
Validate actor permission
  ↓
Validate current state
  ↓
Load authoritative data
  ↓
Apply deterministic business rules
  ↓
Calculate new values
  ↓
Determine state transition
  ↓
Persist atomically
  ↓
Write audit event
  ↓
Return resulting state
```

The frontend may display and request an operation, but the **server/domain layer owns the business decision**.

---

# 6.2 Global Invariants

The following are non-negotiable system rules.

## Identity

1. Every account has exactly one primary role.
2. Allowed roles:
   - `ADMIN`
   - `SALES_REP`
   - `MANAGER`
   - `FINANCE_OPS`
   - `CUSTOMER`

## Ownership

3. A quotation belongs to exactly one customer.
4. A quotation has one responsible Sales Rep in the MVP.
5. A customer portal user can access only data belonging to that customer.
6. A Sales Rep can perform quote-edit operations only within their permitted quotation scope.

## Commercial integrity

7. Quotation totals are derived by the server.
8. Discount governance is evaluated by the server.
9. Approval state is derived from approval records and the current quotation version.
10. An old approval cannot silently authorize a changed quotation version.

## Inventory integrity

11. Available stock is:

```text
quantity_on_hand - quantity_reserved
```

12. Stock allocation is transactional.
13. The same available units cannot be reserved twice.

## Billing integrity

14. Invoice totals are server-calculated.
15. Payment changes invoice state only through valid balance calculations.
16. Recurring and one-time billing remain distinguishable.

## Auditability

17. Important state-changing business actions produce audit records.
18. Audit history is append-only from the application's perspective.

---

# 6.3 Quotation State Machine

## States

```text
DRAFT
PENDING_APPROVAL
APPROVED
UNDER_NEGOTIATION
CONFIRMED
REJECTED
```

## High-level lifecycle

```text
DRAFT
  │
  ├── submit → PENDING_APPROVAL
  │
  └── confirm-without-approval → customer-visible / confirmation path

PENDING_APPROVAL
  ├── approve → APPROVED
  ├── return → DRAFT
  └── reject → REJECTED

APPROVED
  ├── send → customer-visible quotation
  ├── negotiate → UNDER_NEGOTIATION
  └── confirm when customer acceptance is valid → CONFIRMED

UNDER_NEGOTIATION
  ├── continue negotiation → UNDER_NEGOTIATION
  ├── terms valid / no approval required → customer confirmation path
  ├── terms exceed threshold → PENDING_APPROVAL
  └── customer confirms valid terms → CONFIRMED

REJECTED
  └── new revision / resubmission → DRAFT or a new governed version,
      depending on the implementation workflow

CONFIRMED
  └── quotation commercial lifecycle is complete
```

### Important clarification

The **customer-visible status** shown in the portal may be:

```text
SENT
UNDER_NEGOTIATION
CONFIRMED
```

These are presentation/business statuses for the portal and do not need to be identical to the internal quotation workflow enum.

---

# 6.4 Material vs Non-Material Quotation Changes

A quotation edit is **material** if it can affect:

- commercial value
- margin
- discount governance
- approval requirement
- fulfillment requirement
- billing obligation
- customer-requested commercial terms

Examples of material edits:

```text
Product added/removed
Quantity changed
Price changed
Line discount changed
Order discount changed
Customer changed
Delivery commitment changed
Subscription quantity/plan changed
Customer counter-discount accepted
```

A material edit must:

```text
increment quotation.current_version
recalculate totals
recalculate margin
recalculate risk
invalidate prior approval for the new version
```

A non-material UI-only change must not create a new commercial version.

---

# 6.5 Quote Versioning Rule

`quotations.current_version` represents the current commercial version.

Example:

```text
Q-1042 v1
   ↓
submitted for approval

Customer negotiation
   ↓
Q-1042 v2

New commercial change
   ↓
Q-1042 v3
```

Each approval cycle references exactly one version:

```text
ApprovalRequest
    quotation_id = Q-1042
    quotation_version = 3
```

The approved terms must therefore be understood as:

> “These exact terms at this exact quotation version were reviewed.”

---

# 6.6 Quotation Creation Rules

## Preconditions

Sales Rep is authenticated and authorized.

Customer exists and is active.

All selected products are active and sellable.

## On creation

Create:

```text
Quotation
Quotation Lines
```

with:

```text
status = DRAFT
current_version = 1
```

Calculate:

```text
subtotal
discount_total
tax_total
grand_total
margin_amount
margin_percent
```

Generate:

```text
quote_number
```

Record:

```text
AuditLog(QUOTATION_CREATED)
```

---

# 6.7 Quotation Line Rules

Each line must have:

```text
product
quantity
unit price
discount
tax inputs
line total
estimated cost/margin inputs
```

## Quantity

```text
quantity > 0
```

## Price

```text
unit_price >= 0
```

## Discount

```text
0 <= discount_percent <= 100
```

The server must recalculate the monetary discount instead of trusting a client-submitted `discount_amount`.

---

# 6.8 Price Resolution Rule

When a quotation line is created:

```text
Product
+
Customer Discount Tier
+
Quotation Currency
+
Applicable Price List Entry
```

determine the base selling price.

Conceptually:

```text
base unit price
    ↓
price-list resolution
    ↓
quotation unit price
    ↓
rep discount
    ↓
net line price
```

The exact precedence between a generic product base price and a matching price-list entry is:

> **Implementation decision:** use the most specific valid active price-list entry for the customer's tier and quotation currency; otherwise fall back to the product base price if allowed by product configuration.

The selected price should be snapshotted onto the quotation line.

---

# 6.9 Discount Governance Rule

The effective discount limit is evaluated for every quotation line.

Required inputs:

```text
Customer discount tier
Product category
Category discount ceiling
Requested discount
```

The system checks:

```text
requested_discount
        vs
applicable_allowed_discount
```

### Source example

```text
Gold customer → normally 15%

Hardware → 15% allowed
Services → 10% allowed

Laptop → 12%
    → within limit

Setup Service → 18%
    → 8 percentage points over limit
```

The whole quotation is therefore flagged for approval.

---

# 6.10 Effective Discount Ceiling

There may be two configured ceilings:

```text
Customer-tier ceiling
Category ceiling
```

### Implementation decision

For a line, use the stricter applicable ceiling:

```text
effective_allowed_discount =
MIN(
    customer_tier_ceiling,
    category_discount_ceiling
)
```

Example:

```text
Gold = 15%
Services = 10%

effective = MIN(15%, 10%)
          = 10%
```

This is the safest deterministic interpretation of the source's example.

---

# 6.11 Line Discount Overage

For each quotation line:

```text
overage =
MAX(
    0,
    requested_discount - effective_allowed_discount
)
```

Examples:

```text
12% requested
15% allowed
→ overage = 0%

18% requested
10% allowed
→ overage = 8%
```

Persist:

```text
discount_overage_percent
```

for explainability.

---

# 6.12 Blended Risk Score

The problem statement requires a blended risk score for mixed-category quotations and explains why multiple small overages can collectively represent significant margin leakage.

It does **not** prescribe one exact mathematical formula.

Therefore the following is our **implementation decision**.

## Recommended MVP formula

For each quotation line:

```text
line_overage =
MAX(0, requested_discount - effective_allowed_discount)
```

Then:

```text
blended_risk_score =
SUM(line_overage)
```

Optionally weight by line commercial value for a more realistic implementation:

```text
weighted_line_overage =
line_overage
×
(line_net_value / quotation_net_value)
```

and:

```text
weighted_blended_risk_score =
SUM(weighted_line_overage)
```

### MVP recommendation

Use the **simple sum** initially because it is transparent and easy to demonstrate.

If the team chooses the weighted model, document it as the production-oriented enhancement.

---

# 6.13 Risk Level

The source requires the risk score to determine the appropriate approval level but does not prescribe exact numerical thresholds.

Therefore the threshold values are an **implementation decision**.

Recommended configurable policy:

```text
LOW
    score = 0
    → no approval

MEDIUM
    score > 0 and <= configured medium threshold
    → Manager approval

HIGH
    score > configured medium threshold
    → Manager + Finance approval
```

The actual medium threshold must live in configuration or a policy table, not inside controller code.

### Example seed policy

```text
LOW    = 0
MEDIUM = >0 to 5
HIGH   = >5
```

This is a seed/default choice, not a requirement from the source.

---

# 6.14 Approval Routing Rule

After risk evaluation:

```text
LOW
 ↓
No approval required

MEDIUM
 ↓
Manager

HIGH
 ↓
Manager
 ↓
Finance
```

The system creates an `ApprovalRequest` for the current quotation version.

For HIGH risk:

```text
ApprovalRequest
 ├── Step 1 → MANAGER
 └── Step 2 → FINANCE
```

---

# 6.15 Approval Request Creation

When approval is required:

```text
Quotation
   ↓
Create ApprovalRequest
   ↓
Capture quotation_version
   ↓
Capture risk_score
   ↓
Capture risk_level
   ↓
Capture terms_snapshot
   ↓
Create ordered ApprovalSteps
   ↓
Quotation.status = PENDING_APPROVAL
```

This must occur atomically.

---

# 6.16 Approval Step Ordering

For HIGH risk:

```text
Manager = sequence 1
Finance = sequence 2
```

Finance cannot act until:

```text
Manager step = APPROVED
```

A rejected or returned Manager step stops the downstream Finance step.

---

# 6.17 Approval Actions

## Approve

Valid only when:

```text
step.status = PENDING
correct approver
current quotation version = approval quotation version
previous required steps complete
```

Then:

```text
step.status = APPROVED
acted_at = now
```

If another step remains:

```text
next step = PENDING
```

Otherwise:

```text
approval_request.status = APPROVED
quotation.status = APPROVED
```

Create:

```text
AuditLog(APPROVAL_APPROVED)
```

---

## Reject

```text
step.status = REJECTED
approval_request.status = REJECTED
quotation.status = REJECTED
```

Create:

```text
AuditLog(APPROVAL_REJECTED)
```

The rejected commercial version remains historical.

---

## Return for Revision

```text
step.status = RETURNED
approval_request.status = RETURNED
quotation.status = DRAFT
```

Create:

```text
AuditLog(APPROVAL_RETURNED)
```

When the Sales Rep edits the quote, create a new quotation version and re-evaluate governance.

---

# 6.18 Approval Validity Rule

An approval request is valid only for the quotation version it reviewed.

Therefore:

```text
approval_request.quotation_version
==
quotation.current_version
```

must be true before confirmation.

If:

```text
quotation.current_version >
approval_request.quotation_version
```

then:

> The approval is stale and cannot authorize the current quotation.

The system must re-evaluate the current version and create a new approval request when required.

---

# 6.19 Re-Approval Rule After Customer Negotiation

This is a core DealFlow360 rule.

```text
Customer changes terms
        ↓
New quotation version
        ↓
Recalculate totals
        ↓
Recalculate discount/risk
        ↓
Determine approval requirement
```

### If within valid rules

```text
No new approval required
→ continue negotiation/confirmation
```

### If approval is required

```text
New ApprovalRequest
        ↓
Manager / Finance as required
        ↓
Customer receives updated valid quotation
```

Never reuse an old approval request for changed commercial terms.

---

# 6.20 Customer Confirmation Rule

Customer confirmation is allowed only when:

```text
customer is authorized for quotation
AND
quotation is customer-visible
AND
quotation is not rejected
AND
all required approval is complete
AND
current quotation version has valid approval
AND
quotation can still be confirmed
```

On confirmation:

```text
quotation.status = CONFIRMED
confirmed_at = now
```

Create:

```text
AuditLog(QUOTATION_CONFIRMED)
```

Then start downstream fulfillment/billing processing.

---

# 6.21 Negotiation Rules

A customer may request:

```text
Line comment
Change request
Counter discount
Delivery-date request
```

A negotiation request must:

```text
belong to the quotation
belong to the same customer as the quotation
be created by an authorized CUSTOMER user
```

Customer negotiation does not directly modify hidden internal fields.

Instead:

```text
Customer Request
   ↓
Sales Rep / system resolves request
   ↓
Quotation terms change
   ↓
New version
   ↓
Re-evaluation
```

---

# 6.22 Recommendation Rules

Recommendations are generated while a quote is being built.

Candidate sources:

```text
Historical co-purchase relationships
Active promotions
Minimum margin thresholds
```

The system returns ranked candidates.

The recommendation engine may display:

```text
suggested product
margin delta
promotion tag
```

The system does not automatically add a product.

Only:

```text
Sales Rep → Add to Quote
```

changes quotation content.

---

# 6.23 Recommendation Ranking

The source does not require a specific scoring formula.

Recommended deterministic MVP ranking:

```text
candidate eligibility
    ↓
remove products already in quote
    ↓
remove products failing minimum margin
    ↓
calculate association score
    ↓
promotion boost if active
    ↓
sort descending
```

Example conceptual score:

```text
recommendation_score =
co_purchase_score
+
promotion_boost
```

The exact numerical weights are implementation decisions.

---

# 6.24 Margin Calculation

For each quote line:

```text
net_line_value =
quantity × unit_price
- discount_amount
```

For margin:

```text
line_margin =
net_line_value
- estimated_cost
```

Quotation-level:

```text
margin_amount =
SUM(line_margin)
```

and:

```text
margin_percent =
margin_amount / grand_total × 100
```

Guard against division by zero.

### Important

The customer must not receive internal cost or margin information unless the product later explicitly requires it.

---

# 6.25 Fulfillment Trigger

Fulfillment begins only after the commercial side is confirmed.

```text
Quotation.status = CONFIRMED
        ↓
Fulfillment process starts
```

Commercial approval does not mean stock is reserved automatically unless the implementation explicitly chooses to reserve earlier.

For the current MVP:

> **Recommended rule:** reserve stock when a fulfillment allocation is accepted, not merely when a quotation is approved.

This reduces stock being blocked by deals that may never be confirmed.

---

# 6.26 Warehouse Allocation Inputs

The allocation engine uses:

```text
Confirmed quotation lines
+
Live stock levels
+
Warehouse shipping-cost weighting
```

For each line:

```text
available_stock =
quantity_on_hand - quantity_reserved
```

The allocation engine aims to:

1. satisfy as much quantity as possible
2. use available stock
3. minimize unnecessary shipment count
4. consider shipping-cost weighting

---

# 6.27 Warehouse Allocation Algorithm

The source requires the outcome, not one exact algorithm.

Recommended MVP implementation:

### Step 1

Find warehouses with:

```text
available_stock > 0
```

for the product.

### Step 2

Rank candidate warehouses using:

```text
stock usefulness
+
shipping cost weighting
```

### Step 3

Allocate the largest useful quantity from the best candidate first.

### Step 4

Continue until:

```text
requested quantity fulfilled
```

or:

```text
all available stock exhausted
```

### Step 5

If requested quantity remains:

```text
create backorder
```

This is a deterministic greedy algorithm suitable for the MVP.

---

# 6.28 Inventory Reservation Transaction

Allocation must execute inside one database transaction.

```text
BEGIN

lock relevant stock rows

read current available quantities

validate requested allocation

increment quantity_reserved

create FulfillmentAllocation records

create Backorder if necessary

write audit record

COMMIT
```

Use row-level locking for the affected stock rows.

Never trust a stock quantity previously loaded in the frontend.

---

# 6.29 Inventory Release Rule

If an accepted fulfillment allocation is cancelled, reduced, or invalidated before shipment:

```text
release corresponding reserved quantity
```

Therefore:

```text
quantity_reserved
```

must decrease by the exact released quantity.

This prevents abandoned deals from permanently consuming stock.

---

# 6.30 Fulfillment State Rules

Recommended allocation states:

```text
SPLIT_PENDING
PARTIAL
BACKORDER
FULFILLED
```

### SPLIT_PENDING

Allocation recommendation exists but fulfillment has not been completed.

### PARTIAL

Some allocated quantity has been fulfilled but some remains.

### BACKORDER

Remaining quantity cannot currently be fulfilled.

### FULFILLED

All allocated quantity has been fulfilled.

These are **operational states**, not quotation states.

---

# 6.31 Backorder Rules

Given:

```text
required = R
available = A
```

If:

```text
A >= R
```

then:

```text
fulfill = R
backorder = 0
```

Otherwise:

```text
fulfill = A
backorder = R - A
```

The backorder must preserve:

```text
quotation
quotation line
remaining quantity
```

It must not create a new commercial quotation.

---

# 6.32 Backorder Consolidation

When new stock arrives:

```text
new stock
   ↓
find open backorders
   ↓
allocate newly available stock
   ↓
reduce remaining backorder quantity
   ↓
update fulfillment state
```

If all remaining quantity is fulfilled:

```text
backorder = resolved
fulfillment = FULFILLED
```

The wireframe's:

> **Consolidate Remaining Backorder**

action is the UI representation of this operation.

---

# 6.33 Subscription Rules

A recurring product must have:

```text
is_subscription = TRUE
recurring_interval != NULL
```

When a confirmed order contains a recurring line:

```text
QuotationLine
      ↓
SubscriptionInstance
```

with:

```text
status = ACTIVE
```

and:

```text
billing_interval
current_period_start
current_period_end
next_billing_date
```

---

# 6.34 Subscription Billing Rule

A recurring subscription produces a recurring billing schedule.

Conceptually:

```text
SubscriptionInstance
        ↓
Billing period
        ↓
Charge
        ↓
Invoice
```

The exact billing scheduler implementation is a technology/runtime decision, but the resulting billing record must be persisted.

---

# 6.35 Subscription Proration Rule

The problem statement requires proration for mid-cycle quantity or plan changes but does not prescribe a precise formula.

## Recommended implementation decision

For a quantity/price change:

```text
daily_rate =
period_price / number_of_days_in_period
```

Then calculate the unused/used-period adjustment according to the direction of change.

For an upgrade:

```text
proration_charge =
new_daily_rate - old_daily_rate
× remaining_days
```

For a downgrade:

```text
proration_credit =
old_daily_rate - new_daily_rate
× remaining_days
```

Round monetary result to currency precision.

The exact handling of billing date boundaries must be deterministic and tested.

---

# 6.36 Subscription Cancellation Rule

When a subscription is cancelled:

```text
status = CANCELLED
cancelled_at = now
```

Then apply configured cancellation policy.

Possible consequence:

```text
no refund
partial refund
credit note
```

The system must not automatically assume one outcome for every plan.

The cancellation/refund policy belongs to configuration.

---

# 6.37 Invoice Creation Rules

An invoice may originate from:

```text
One-time fulfillment
OR
Recurring subscription billing
```

Invoice must store enough linkage to identify its origin.

For recurring billing:

```text
subscription_instance_id != NULL
```

For a pure one-time invoice:

```text
subscription_instance_id = NULL
```

The same quotation may therefore have multiple invoices.

---

# 6.38 One-Time Billing Rule

For the wireframe's operational model:

```text
Confirmed
   ↓
Fulfilled/shipped
   ↓
One-time billing
```

The current implementation design is:

> **Do not bill one-time shipped goods before the corresponding fulfillment condition is satisfied.**

The exact “invoice per shipment” behaviour shown in the wireframe is an implementation choice, not a universal rule mandated by the source.

---

# 6.39 Invoice Total Rule

Server calculates:

```text
invoice subtotal
+
tax
=
invoice total
```

The client cannot choose the authoritative total.

---

# 6.40 Payment Rule

When payment is recorded:

```text
payment.amount > 0
```

Calculate:

```text
effective_paid =
SUM(valid payments)
```

Then:

```text
effective_paid = 0
    → UNPAID

0 < effective_paid < invoice.total
    → PARTIALLY_PAID

effective_paid >= invoice.total
    → PAID
```

A payment cannot be duplicated using the same payment reference.

---

# 6.41 Payment Reversal

If a recorded payment is reversed:

```text
payment.status = REVERSED
```

The invoice balance is recalculated from non-reversed payments.

Example:

```text
Invoice = 1000
Payment = 1000
Status = PAID

Payment reversed
     ↓
Effective paid = 0
     ↓
Invoice = UNPAID
```

Every reversal creates an audit record.

---

# 6.42 Deal Health Rule: Stalled Deal

The source defines a stalled deal as a quotation inactive for more than a configured number of days.

Implementation:

```text
days_since_activity =
NOW - quotation.updated_at
```

If:

```text
days_since_activity > configured_stall_threshold
```

then create or refresh:

```text
DealHealthFlag(type = STALLED)
```

The threshold must be configurable.

---

# 6.43 Deal Health Rule: Discount Anomaly

The source defines a discount anomaly as a discount well above a Sales Rep's historical average.

Recommended implementation:

```text
current_discount
    vs
rep historical average discount
```

Create:

```text
DealHealthFlag(type = DISCOUNT_ANOMALY)
```

when the configured anomaly threshold is exceeded.

### Example implementation decision

```text
anomaly when:
current average discount
>
historical average discount + configured margin
```

The actual threshold is configurable.

Avoid building the rule around a hardcoded rep-specific value.

---

# 6.44 Deal Health Rule: Delivery Slippage

If the quotation/order has an expected delivery date and the fulfillment state indicates the promise is at risk:

```text
expected delivery
        ↓
compare current fulfillment progress
        ↓
risk condition
        ↓
DealHealthFlag(DELIVERY_SLIPPAGE)
```

The exact predictive method can be simple in MVP.

For example:

> If remaining required quantity cannot reasonably be fulfilled before the promised delivery date based on current stock and replenishment information, flag the deal.

This is an implementation interpretation; the source requires the alerting outcome, not a specific forecasting algorithm.

---

# 6.45 Deal Health Deduplication

The system should avoid creating an identical alert every time the monitoring job runs.

Recommended identity:

```text
quotation_id
+
health_type
+
active status
```

If an identical open flag already exists:

```text
update existing flag
```

rather than creating duplicates.

---

# 6.46 Deal Health Resolution

When the underlying condition is corrected:

```text
DealHealthFlag.status = RESOLVED
```

or:

```text
DISMISSED
```

depending on user action.

Example:

```text
Stalled quote
   ↓
Sales Rep updates quote
   ↓
activity refreshed
   ↓
stall condition no longer true
   ↓
flag resolved
```

The dashboard is a view over persisted flags; it is not the source of truth.

---

# 6.47 Nudge and Escalation Rules

When a Deal Health alert is actionable:

```text
Open alert
   ↓
Nudge Rep
OR
Escalate
OR
Open quotation
```

Nudge/escalation should create an audit event:

```text
NUDGE_SENT
ESCALATION_TRIGGERED
```

Do not treat sending a nudge as resolving the underlying problem automatically.

---

# 6.48 Audit Rules

Audit logging is mandatory for high-value business events.

Minimum audited actions:

```text
Quotation created
Quotation edited
Discount changed
Approval request created
Approval approved
Approval rejected
Approval returned
Negotiation created
Quotation confirmed
Fulfillment allocation created/changed
Backorder created
Backorder consolidated
Subscription created/changed
Invoice created
Payment recorded
Payment reversed
Credit note created
Deal Health created/updated
Nudge sent
Escalation triggered
```

Every audit entry must contain:

```text
actor
action
entity type
entity id
timestamp
optional quotation
reason when applicable
metadata
```

---

# 6.49 Transactional Operations

The following business operations must be atomic.

## Quote submission

```text
Validate quote
+
calculate totals/risk
+
create approval request if needed
+
change quotation state
+
audit
```

## Approval action

```text
validate step
+
record decision
+
update approval request
+
update quotation state
+
audit
```

## Customer negotiation update

```text
validate customer ownership
+
record negotiation
+
change quotation version
+
recalculate
+
determine approval
+
create approval if required
+
audit
```

## Warehouse allocation

```text
lock stock
+
validate availability
+
reserve
+
create allocation
+
create backorder if needed
+
audit
```

## Payment

```text
record payment
+
recalculate invoice balance
+
update invoice status
+
audit
```

---

# 6.50 State Transition Guards

A state transition must never happen solely because a frontend button was clicked.

## DRAFT → PENDING_APPROVAL

Require:

```text
quote is valid
quote has required lines
risk requires approval
current actor is authorized Sales Rep
```

## DRAFT → Customer-visible confirmation path

Require:

```text
quote is valid
risk does not require approval
current actor is authorized
```

## PENDING_APPROVAL → APPROVED

Require:

```text
all required steps approved
quotation version unchanged
```

## PENDING_APPROVAL → REJECTED

Require:

```text
authorized current reviewer
step is pending
```

## PENDING_APPROVAL → DRAFT

Require:

```text
authorized reviewer
return action
```

## APPROVED → UNDER_NEGOTIATION

Require:

```text
customer-visible quotation
customer initiates negotiation
```

## APPROVED/UNDER_NEGOTIATION → PENDING_APPROVAL

Require:

```text
current commercial terms require approval
```

## UNDER_NEGOTIATION → CONFIRMED

Require:

```text
customer confirms
current terms are valid
approval is not stale
all required approvals complete
```

## CONFIRMED

No ordinary edit back into a draft state.

Post-confirmation changes must use explicitly defined downstream change operations.

---

# 6.51 Post-Confirmation Rule

A confirmed quotation is commercially finalized.

Therefore:

```text
ordinary quote editing = forbidden
```

Any post-confirmation change should be modeled as a specific operation such as:

```text
subscription modification
fulfillment change
billing adjustment
credit note
future amendment flow
```

Do not reopen a confirmed quote through a generic update endpoint.

This protects downstream billing and fulfillment integrity.

---

# 6.52 Approval + Negotiation Interaction

The complete commercial governance cycle is:

```text
DRAFT
  ↓
Evaluate
  ↓
Approval if needed
  ↓
Approved
  ↓
Customer negotiation
  ↓
Terms changed
  ↓
New quotation version
  ↓
Evaluate again
  ↓
Approval again if needed
  ↓
Customer confirms
  ↓
CONFIRMED
```

This is one of the defining business loops of DealFlow360.

---

# 6.53 Approval + Fulfillment Interaction

Do not treat:

```text
APPROVED
```

as:

```text
IN STOCK
```

The correct relationship is:

```text
Approved / commercially valid
       ↓
Customer confirmed
       ↓
Confirmed order
       ↓
Live stock evaluation
       ↓
Warehouse allocation
       ↓
Fulfillment / backorder
```

---

# 6.54 Fulfillment + Billing Interaction

For the current wireframe-aligned MVP:

```text
Fulfillment status
        ↓
Billing eligibility
```

One-time billing should not be generated merely because an approval exists.

Recurring billing follows subscription schedule rules.

Therefore the system must support a state where:

```text
Quotation = CONFIRMED
Fulfillment = BACKORDER
One-time invoice = not yet fully generated
Subscription = ACTIVE
Recurring schedule = active
```

---

# 6.55 Quotation Total Recalculation

Whenever a material quotation edit occurs:

```text
for each line:
    resolve applicable commercial inputs
    calculate discount
    calculate tax
    calculate line total
    calculate estimated margin

then:
    subtotal
    discount_total
    tax_total
    grand_total
    margin_amount
    margin_percent
    blended_risk_score
    risk_level
```

The result becomes the authoritative current quote state.

---

# 6.56 Idempotency Rules

Operations likely to be retried must be idempotent where practical.

Examples:

```text
customer confirms quote
payment recorded
backorder consolidation
approval action
invoice creation
```

Use one of:

```text
idempotency key
unique business key
state guard
```

to prevent duplicate side effects.

Example:

```text
Payment reference UNIQUE
```

prevents duplicate payment records.

---

# 6.57 Concurrency Rules

The most important concurrency-sensitive resource is inventory.

Two simultaneous requests must never both believe:

```text
available_stock = 10
```

and reserve all 10 each.

Use:

```text
database transaction
+
SELECT ... FOR UPDATE
```

on relevant `stock_levels` rows.

Quotation version updates should also use optimistic concurrency protection where useful.

Recommended:

```text
quotation.current_version
```

or a separate row/version check.

---

# 6.58 Source Requirement vs Implementation Decision

## Explicit source requirement

The problem statement explicitly requires:

- discount governance
- automated approval routing
- blended risk for mixed categories
- audit history
- live recommendations
- margin impact
- warehouse split
- manual override
- backorders
- hybrid billing
- recurring schedules
- proration
- cancellation/refund handling
- separate customer portal
- automatic re-entry into approval when thresholds are crossed
- Deal Health alerts
- reporting

## Implementation decisions in this section

The following are our selected deterministic implementations:

- effective discount = stricter of tier/category ceilings
- simple blended score = sum of line overages
- configurable LOW/MEDIUM/HIGH thresholds
- recommendation scoring formula
- greedy warehouse allocation algorithm
- reserve stock when fulfillment allocation is accepted
- quotation version increment strategy
- approval terms snapshots
- proration formula
- invoice/shipment timing rule
- exact Deal Health anomaly thresholds
- Deal Health deduplication key
- payment status calculation

These choices must not be presented as though the problem statement dictated the exact numerical implementation.

---

# 6.59 Coding-Agent Guardrails

1. All authoritative business decisions run server-side.
2. Frontend values are inputs, never the final source of truth.
3. Validate role and resource scope before business operations.
4. Validate current state before every state transition.
5. Recalculate financial totals on the server.
6. Recalculate discount/risk whenever material quote terms change.
7. Never reuse stale approval for a changed quotation version.
8. Every approval cycle references a specific quotation version.
9. Approval terms must be snapshotted.
10. Customer negotiation must create traceable negotiation activity.
11. Negotiated commercial changes must re-enter governance evaluation.
12. Customer confirmation must verify current approval validity.
13. A confirmed quotation cannot be edited through generic quote CRUD.
14. Fulfillment must use live stock.
15. Inventory allocation must be transactional and lock affected stock rows.
16. Available stock is on-hand minus reserved.
17. Reservations must be released when their corresponding allocation is legitimately cancelled/reduced.
18. Backorders store unmet quantity; they do not create a new quotation.
19. One-time and recurring billing paths remain distinguishable.
20. Proration is deterministic and tested.
21. Payment updates invoice status from authoritative payment records.
22. Deal Health is a parallel monitoring layer, never a quotation stage.
23. Deal Health alerts must be persisted and deduplicated.
24. Audit logs are append-only.
25. Do not bury business workflow inside database triggers unless explicitly approved; domain/service logic owns transitions.
26. Background monitoring jobs must call the same domain rules rather than reimplementing them.
27. All implementation-specific thresholds must be configurable where the source leaves them open.
28. Exact formulas chosen by the team must be documented and covered by tests.
29. API endpoints must expose business operations rather than unrestricted table mutation.
30. Unit tests must cover happy paths, rejection paths, stale approvals, concurrent inventory allocation, partial fulfillment, backorders, negotiation re-approval, proration, payment status, and Deal Health detection.

---

# 6.60 Minimum Business-Rule Test Matrix

The build is not considered functionally complete until these scenarios work.

| Scenario | Expected result |
|---|---|
| Gold + Hardware 12% discount | No line overage |
| Gold + Service 18% discount | Service overage detected |
| High-risk quote | Manager then Finance approval |
| Manager returns quote | Quote becomes editable and must be re-evaluated |
| Customer increases discount during negotiation | New version; approval re-evaluated |
| Customer confirms with stale approval | Confirmation rejected; approval required again |
| Upsell accepted | Quote total and margin update |
| Recommendation below minimum margin | Not shown |
| Stock available in one warehouse | Single allocation where optimal |
| Stock split across warehouses | Multiple allocations |
| Insufficient stock | Partial fulfillment + backorder |
| Backorder stock arrives | Consolidation reduces remaining backorder |
| Mixed one-time + subscription order | Separate billing behaviour |
| Mid-cycle subscription upgrade | Proration calculated |
| Subscription cancellation | Configured refund/credit behaviour |
| Partial invoice payment | Invoice becomes PARTIALLY_PAID |
| Full payment | Invoice becomes PAID |
| Inactive quotation exceeds threshold | STALLED health flag |
| Rep discount materially above history | DISCOUNT_ANOMALY flag |
| Delivery at risk | DELIVERY_SLIPPAGE flag |
| Repeated health scan | No duplicate active flag |
| Customer accesses another customer's quote | Denied |
| Sales Rep tries to approve own quote | Denied |
| Finance tries to edit discount policy | Denied |
| Concurrent warehouse allocation | No over-reservation |

---

# 6.61 Official Status

**SECTION 6 — BUSINESS RULES AND STATE TRANSITIONS: LOCKED**

This section is the operational rule contract for DealFlow360.

The next section:

> **7. API Surface / Operations**

must expose these business operations through authenticated, authorized APIs without bypassing the rules, state transitions, concurrency controls, versioning, or audit requirements defined here.
