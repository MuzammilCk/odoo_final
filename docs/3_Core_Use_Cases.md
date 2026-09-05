# DealFlow360 — Section 3: Core Use Cases

> **Status:** OFFICIAL / LOCKED
>
> **Purpose:** Control file for the coding agent. Defines what the system must allow each actor to accomplish and the business outcome each use case must produce.
>
> **Derived from:** Section 1 — Problem Restatement; Section 2 — Actors / Roles; DealFlow360 problem statement; DealFlow360 End-to-End Product Flow (Excalidraw).
>
> **Change policy:** Future database entities, business rules, APIs, screens, and technology decisions must support these use cases. Do not introduce implementation that changes the intended business meaning of a use case without explicitly revisiting this section.

---

# 3.1 What Is a Use Case?

A use case describes a meaningful business operation that an actor performs through DealFlow360.

For this project, a use case is not merely:

> "Open page"

or:

> "Click button"

It must represent a real business outcome.

For example:

```text
Weak:
Click Approve

Strong:
Approve a quotation after verifying its current commercial terms
and create an auditable approval decision.
```

The coding agent should implement **business outcomes**, not just UI interactions.

---

# 3.2 Use Case Groups

DealFlow360 use cases are grouped into nine areas:

1. Authentication and access
2. Backend configuration
3. Quotation management
4. Discount governance and approval
5. Upsell / cross-sell
6. Customer negotiation
7. Fulfillment and warehouse management
8. Hybrid billing and payment
9. Deal Health and reporting

---

# 3.3 Actor-to-Use-Case Overview

| Use Case Area | Admin | Sales Rep | Manager | Finance/Ops | Customer |
|---|:---:|:---:|:---:|:---:|:---:|
| Authenticate | ✓ | ✓ | ✓ | ✓ | ✓ |
| Configure products | ✓ | ✗ | ✗ | ✗ | ✗ |
| Configure price lists | ✓ | ✗ | ✗ | ✗ | ✗ |
| Configure discount rules | ✓ | ✗ | ✓ | ✗ | ✗ |
| Configure approval chains | ✓ | ✗ | ✓ | ✗ | ✗ |
| Configure warehouses | ✓ | ✗ | ✗ | ✗ | ✗ |
| Configure subscriptions | ✓ | ✗ | ✗ | ✗ | ✗ |
| Create quotation | ✗ | ✓ | ✗ | ✗ | ✗ |
| Build/edit quotation | ✓* | ✓ | ✗ | ✗ | ✗ |
| Apply discount | ✓* | ✓ | ✗ | ✗ | ✗ |
| View live margin | ✓* | ✓ | ✓ | ✓ | ✗ |
| Receive recommendations | ✓* | ✓ | ✗ | ✗ | ✗ |
| Review approval | ✗ | ✗ | ✓ | ✓** | ✗ |
| Approve/reject/return | ✗ | ✗ | ✓ | ✓** | ✗ |
| Track own quotation | ✓* | ✓ | ✓ | ✓ | ✗ |
| Negotiate quotation | ✗ | Respond | Monitor | ✗ | ✓ |
| Confirm quotation | ✗ | ✗ | ✗ | ✗ | ✓ |
| View fulfillment status | ✓* | ✓ | ✓ | ✓ | ✗ |
| Allocate warehouse stock | ✗ | ✗ | ✗ | ✓ | ✗ |
| Override split | ✗ | ✗ | ✗ | ✓ | ✗ |
| Manage backorder | ✗ | ✗ | ✗ | ✓ | ✗ |
| Reconcile recurring billing | ✗ | ✗ | ✗ | ✓ | ✗ |
| View Deal Health | ✓ | ✗ | ✓ | ✗ | ✗ |
| Trigger nudge/escalation | ✓ | ✗ | ✓ | ✗ | ✗ |
| View reporting | ✓ | Limited | ✓ | Operational | ✗ |
| Export reports | ✓ | As permitted | ✓ | As permitted | ✗ |

`*` = administrative/support capability, not the actor's primary workflow.

`**` = only when the quotation is routed to that approval level.

---

# 3.4 UC-01 — Authenticate

## Actors

All five roles.

## Goal

Gain access to the correct application surface for the authenticated role.

## Main Flow

```text
User enters credentials
        ↓
Authentication succeeds
        ↓
System identifies role
        ↓
System creates authenticated session
        ↓
User is sent to the correct application boundary
```

Internal users:

```text
ADMIN / SALES_REP / MANAGER / FINANCE_OPS
        ↓
Internal Application
```

Customer:

```text
CUSTOMER
   ↓
Customer Portal
```

## Business Rules

- Every account has exactly one primary role.
- Customer accounts cannot enter the internal application.
- Internal users cannot use customer authentication to gain customer permissions.
- Authentication does not automatically imply authorization.

---

# 3.5 UC-02 — Configure Products and Price Lists

## Primary Actor

Admin

## Goal

Create the commercial catalogue that Sales Reps will use when building quotations.

## Main Flow

```text
Admin creates product
        ↓
Set name/category/price/unit/tax/description
        ↓
Configure variants if needed
        ↓
Configure price-list entries
        ↓
Associate customer-tier/currency rules
        ↓
Product becomes available to quoting
```

## Business Outcome

The Sales Rep has a reliable source of product and pricing data when creating a quotation.

## Related Source Requirements

Products include general information and variants, while price lists can contain customer-tier and currency-specific rules.

---

# 3.6 UC-03 — Configure Discount Governance

## Actors

Admin, Sales Manager

## Goal

Define the rules that determine how much discount can be granted and when approval is required.

## Main Flow

```text
Configure customer-tier ceiling
        +
Configure category ceiling
        +
Configure approval ranges
        ↓
Governance rules become active
```

Example:

```text
Customer Tier:
Gold → 15%

Category:
Hardware → 15%
Services → 10%
```

## Business Outcome

Quotation discounts can be evaluated automatically against configured company policy.

## Important

The Sales Rep **uses** these rules but cannot modify the governing policy.

---

# 3.7 UC-04 — Configure Warehouses and Subscription Rules

## Actors

Admin

## Goal

Prepare operational rules used after a quotation is commercially approved.

## Warehouse configuration includes

- warehouse identity
- stock levels
- replenishment rules
- shipping-cost weighting

## Subscription configuration includes

- monthly / quarterly / yearly plans
- proration rules
- cancellation rules
- partial refund rules

## Business Outcome

The fulfillment and billing engines have configuration they can apply without hardcoded business assumptions.

---

# 3.8 UC-05 — Create a Quotation

## Primary Actor

Sales Rep

## Goal

Create a live quotation for a customer.

## Main Flow

```text
Sales Rep selects customer
        ↓
Creates quotation
        ↓
Selects products
        ↓
Sets quantities
        ↓
Applies pricing / discounts
        ↓
System recalculates totals and margin
```

The quotation may contain:

```text
Hardware
+
Services
+
Subscriptions
```

## Business Outcome

A live quotation exists with enough information to begin commercial evaluation.

---

# 3.9 UC-06 — Edit a Quotation

## Primary Actor

Sales Rep

## Goal

Modify an editable quotation while preserving the correct business calculations.

## Editable information can include

- products
- quantities
- applicable price
- line-level discounts
- order-level discounts

## Every relevant edit can cause

```text
Quote data change
        ↓
Recalculate totals
        ↓
Recalculate margin
        ↓
Refresh recommendations
        ↓
Re-evaluate risk
        ↓
Determine whether approval state is still valid
```

This is one reason the quotation must be a live business object.

---

# 3.10 UC-07 — Evaluate Discount and Risk

## Actor

System

## Goal

Determine whether the current quotation complies with configured commercial policy.

This is an automated business use case, not a manual user action.

## Main Flow

```text
Quotation
   ↓
Determine customer tier
   ↓
Determine category limits
   ↓
Evaluate each quote line
   ↓
Calculate blended risk
   ↓
Determine required approval level
```

## Example

```text
Gold customer → 15% normal tier ceiling

Hardware → 15% category ceiling
Services → 10% category ceiling

Laptop → 12% discount
      → within hardware limit

Setup Service → 18% discount
             → 8 points above service limit

Result → quotation requires approval
```

The problem statement requires the system to consider the individual line limits and the overall blended pattern.

### Formula rule

The problem statement defines the concept of blended risk but does not prescribe one exact mathematical formula.

Therefore:

> The implementation must choose a deterministic formula and document it in Section 6. It must not pretend that the source specifies an exact formula.

---

# 3.11 UC-08 — Automatically Route Approval

## Primary Actors

Sales Manager, Finance/Ops

## Trigger

Discount/risk evaluation determines that approval is required.

## Main Flow

```text
Risk evaluated
    ↓
Determine approval chain
    ↓
Create approval step(s)
    ↓
Assign appropriate reviewer
    ↓
Quotation enters pending-approval state
```

Possible routing:

```text
No approval
    ↓
Continue

Manager
    ↓
Manager review

Manager + Finance
    ↓
Manager review
    ↓
Finance review
```

## Business Outcome

The correct approval chain is generated automatically.

The Sales Rep does not manually choose the reviewer.

---

# 3.12 UC-09 — Approve, Reject, or Return Quotation

## Primary Actors

Sales Manager, Finance/Ops

## Goal

Make a decision on a quotation routed to the current approval step.

## Actions

### Approve

```text
Reviewer approves
      ↓
Record decision + timestamp + reason
      ↓
Move to next approval step or approved state
```

### Reject

```text
Reviewer rejects
      ↓
Record decision + timestamp + reason
      ↓
Quotation becomes rejected
```

### Return for Revision

```text
Reviewer requests revision
      ↓
Record decision + timestamp + reason
      ↓
Sales Rep revises quotation
      ↓
Quotation is re-evaluated
```

A quotation that changes after being returned must go through the applicable governance process again.

---

# 3.13 UC-10 — Accept or Dismiss Upsell / Cross-sell Recommendation

## Primary Actor

Sales Rep

## Goal

Increase deal value while understanding the margin impact.

## Main Flow

```text
Current quote
      ↓
Recommendation engine
      ↓
Rank candidate products
      ↓
Display suggestion + margin delta
      ↓
Rep chooses:
   ├── Add to Quote
   └── Dismiss
```

The source allows recommendations to use:

- historical co-purchase relationships
- active promotions
- minimum margin thresholds

## If accepted

```text
Suggested product added
      ↓
Quote total changes
      ↓
Margin changes
      ↓
Risk can change
```

The recommendation engine recommends; it does not autonomously modify the quotation.

---

# 3.14 UC-11 — Send Quotation to Customer Portal

## Primary Actor

Sales Rep / System

## Goal

Make the current valid quotation available to the customer through the restricted portal.

## Main Flow

```text
Quote reaches customer-visible stage
        ↓
Customer receives portal access
        ↓
Customer authenticates
        ↓
Customer views quotation
```

The customer portal is a separate restricted surface.

---

# 3.15 UC-12 — Negotiate Quotation

## Primary Actor

Customer

## Supporting Actor

Sales Rep

## Goal

Allow customer and sales rep to collaborate on quotation terms without email-based fragmentation.

## Customer actions

- comment on individual lines
- request changes
- counter the discount
- request delivery-date changes
- submit negotiation request
- confirm quotation

## Main Flow

```text
Customer opens portal
        ↓
Reviews quotation
        ↓
Requests change / counter-offer
        ↓
Quotation enters negotiation state
        ↓
System recalculates quote
        ↓
Business rules are re-evaluated
```

Sales Rep responds to the request from the internal workspace.

---

# 3.16 UC-13 — Re-evaluate Negotiated Terms

## Primary Actor

System

## Goal

Prevent customer negotiation from bypassing commercial governance.

## Main Flow

```text
Customer changes terms
        ↓
Recalculate quotation
        ↓
Recalculate discount/risk
        ↓
Check approval threshold
```

### Branch

```text
Threshold not crossed
        ↓
Continue negotiation / confirmation

Threshold crossed
        ↓
Re-enter approval
        ↓
Manager / Finance as required
        ↓
Return to customer portal
```

This is a mandatory feedback loop in the product design.

---

# 3.17 UC-14 — Confirm Final Quotation

## Primary Actor

Customer

## Goal

Accept the final quotation.

## Preconditions

- quotation is customer-visible
- final terms are valid
- required approvals are complete
- quotation has not become invalid due to later changes

## Main Flow

```text
Customer clicks Confirm
        ↓
Final terms validation
        ↓
Check approval validity
        ↓
If valid:
    Confirm order
```

If approval is no longer valid:

```text
Confirm attempt
      ↓
Final validation fails
      ↓
Return to approval
```

## Business Outcome

A commercially valid confirmed order is created.

---

# 3.18 UC-15 — Allocate Fulfillment Across Warehouses

## Primary Actor

Finance/Ops

## Supporting Actor

Sales Rep

## Goal

Fulfill the confirmed order using available inventory across warehouses.

## Main Flow

```text
Confirmed order
       ↓
Check live stock
       ↓
Evaluate warehouses
       ↓
Generate recommended split
       ↓
Show quantity / shipment count / cost
```

The Sales Rep can **view fulfillment progress** but does not perform warehouse allocation operations.

Finance/Ops can:

- accept the recommendation
- manually override the split

The system should use the configured shipping-cost weighting to reduce unnecessary shipments.

---

# 3.19 UC-16 — Handle Partial Fulfillment and Backorder

## Primary Actor

Finance/Ops

## Goal

Handle an order when available inventory cannot satisfy the complete quantity.

## Main Flow

```text
Required quantity
        ↓
Compare with available stock
        ↓
Fulfill available quantity
        ↓
Remaining quantity → backorder
```

When inventory becomes available:

```text
New stock arrives
        ↓
Remaining backorder identified
        ↓
Consolidate remaining backorder
        ↓
Complete fulfillment
```

The Sales Rep can observe fulfillment progress.

---

# 3.20 UC-17 — Generate Hybrid Billing

## Primary Actor

Finance/Ops / System

## Goal

Correctly process one-time and recurring lines from the same order.

## Main Flow

```text
Confirmed order
        ↓
Separate line types
        ├── One-time
        └── Recurring
```

One-time:

```text
One-time line
    ↓
Invoice / payment flow
```

Recurring:

```text
Subscription line
    ↓
Recurring billing schedule
```

Both remain linked to the same commercial order.

---

# 3.21 UC-18 — Modify Subscription and Apply Proration

## Primary Actor

Finance/Ops

## Goal

Correctly account for mid-cycle changes.

## Main Flow

```text
Existing subscription
        ↓
Quantity / plan change
        ↓
Determine remaining billing period
        ↓
Apply configured proration rule
        ↓
Create updated billing consequence
```

Applicable cancellation/refund/credit-note rules must also be respected.

The exact proration formula is a Section 6 business-rule decision and must be deterministic.

---

# 3.22 UC-19 — Record Payment and Update Invoice Status

## Primary Actor

Finance/Ops / System

## Goal

Record payment against a one-time invoice and maintain invoice status.

Possible invoice states in the implementation may include:

```text
UNPAID
PARTIALLY_PAID
PAID
```

The payment mechanism may be simulated for the hackathon, but the resulting state transition must be real application logic.

---

# 3.23 UC-20 — Monitor Deal Health

## Primary Actors

Sales Manager, Admin

## Goal

Identify risky deals early instead of discovering them after momentum is lost.

Deal Health monitors the lifecycle **in parallel**.

It can identify:

- stalled quotations
- discount anomalies
- delivery promise slippage

Example:

```text
Quotation inactive > configured threshold
        ↓
Stalled Deal Alert
```

Or:

```text
Rep discount materially above historical average
        ↓
Discount Anomaly Alert
```

Or:

```text
Expected delivery at risk
        ↓
Delivery Slippage Alert
```

---

# 3.24 UC-21 — Act on Deal Health Alert

## Primary Actor

Sales Manager / Admin

## Goal

Turn a detected risk into an actionable intervention.

Possible actions:

```text
Alert
  ├── Open related quotation
  ├── Nudge Sales Rep
  └── Escalate
```

Deal Health does not replace the quotation workflow. It points the responsible user back to the affected deal or triggers an operational action.

---

# 3.25 UC-22 — View Reporting and Analytics

## Primary Actors

Admin, Sales Manager, permitted internal users

## Goal

Understand sales activity and operational outcomes.

Required filters include:

- Period
- Sales Team / Rep
- Approval Status
- Product / Category

Reporting should support the problem statement's intended visibility into areas such as:

```text
Sales activity
      ↓
Approval behaviour
      ↓
Discount behaviour
      ↓
Fulfillment outcomes
      ↓
Billing / payment outcomes
```

Reports must be exportable in the supported formats required by the implementation.

---

# 3.26 Main Business Use-Case Sequence

The most important normal path is:

```text
UC-01 Authenticate
      ↓
UC-05 Create Quotation
      ↓
UC-06 Edit Quotation
      ↓
UC-07 Evaluate Discount / Risk
      ↓
UC-10 Upsell / Cross-sell
      ↓
UC-08 Automatic Approval Routing
      ↓
UC-09 Approval
      ↓
UC-11 Customer Portal
      ↓
UC-12 Customer Negotiation
      ↓
UC-13 Re-evaluate Negotiated Terms
      ↓
UC-14 Confirm Final Quotation
      ↓
UC-15 Warehouse Allocation
      ↓
UC-16 Fulfillment / Backorder
      ↓
UC-17 Hybrid Billing
      ↓
UC-18 Subscription Changes / Proration
      ↓
UC-19 Payment / Invoice Status
```

But some use cases occur in parallel:

```text
                 ┌── UC-20 Deal Health Monitoring ──┐
                 │                                   │
                 ▼                                   ▼
        quotation lifecycle                    billing lifecycle
```

and:

```text
UC-22 Reporting
```

provides management visibility over the results.

---

# 3.27 Critical Exception Paths

## Exception A — Discount too high

```text
Quote
 ↓
Discount evaluation
 ↓
Approval required
 ↓
Manager / Finance
 ↓
Approve
 ↓
Continue
```

## Exception B — Approval rejected

```text
Approval
 ↓
Reject
 ↓
Quotation rejected
```

## Exception C — Approval returned

```text
Approval
 ↓
Return for revision
 ↓
Sales Rep edits
 ↓
Re-evaluate
 ↓
Approval again if required
```

## Exception D — Customer negotiates beyond limit

```text
Customer counter-offer
 ↓
Recalculate
 ↓
Risk increases
 ↓
Approval required
 ↓
Manager / Finance
 ↓
Customer receives updated valid quotation
```

## Exception E — Insufficient stock

```text
Confirmed order
 ↓
Warehouse check
 ↓
Insufficient stock
 ↓
Partial fulfillment
 ↓
Backorder
 ↓
Stock arrives
 ↓
Consolidate
```

## Exception F — Deal becomes stalled

```text
Deal Health
 ↓
Stalled threshold reached
 ↓
Alert
 ↓
Manager / Admin intervention
```

---

# 3.28 Use-Case Dependency Map

```text
Configuration
    │
    ├── Product / Pricing
    ├── Discount Governance
    ├── Approval Chain
    ├── Warehouse Rules
    └── Subscription Rules
             │
             ▼
       Create Quotation
             │
             ├── Discount / Risk
             │        ↓
             │    Approval
             │
             └── Recommendations
                      │
                      ▼
                Customer Portal
                      │
                      ▼
                 Negotiation
                      │
                      ▼
                Re-evaluation
                      │
                 ┌────┴────┐
                 │         │
              Approval     Valid
                 │         │
                 └────┬────┘
                      ▼
                  Confirmation
                      │
             ┌────────┴────────┐
             ▼                 ▼
        Fulfillment          Billing
             │                 │
       Warehouse /          One-time +
       Backorder            Recurring
             │                 │
             └────────┬────────┘
                      ▼
                Operational Data

Deal Health observes the lifecycle in parallel.
Reporting observes the resulting data.
```

---

# 3.29 What Is NOT a Core Use Case

The following are UI interactions, not business use cases by themselves:

- opening a dashboard
- clicking a tab
- refreshing data
- opening a modal
- sorting a table
- searching a list
- opening a quotation detail screen

These can support use cases but should not drive the domain design.

For the coding agent:

> **Do not design the database or API around screens first. Design them around business use cases and their state-changing operations.**

---

# 3.30 Coding-Agent Guardrails

1. Every implemented feature must trace to one or more core use cases in this section.
2. Every core use case must have a defined actor and business outcome.
3. UI actions must call business operations; UI-only state must not become the source of truth for domain state.
4. Discount evaluation must be automatic.
5. Approval routing must be automatic.
6. Approval actions must be auditable.
7. Customer negotiation must be isolated through the customer portal.
8. Negotiated quotation changes must re-enter business-rule evaluation.
9. Customer confirmation must validate that required approval is still valid.
10. Fulfillment must operate from current stock data, not from stale quotation assumptions.
11. Warehouse allocation and manual override belong to Finance/Ops, not Sales Rep.
12. Backorder must be represented as an actual operational outcome.
13. One-time and recurring billing must remain distinct while linked to the same order.
14. Proration must be implemented as real business logic.
15. Deal Health must remain a parallel monitoring capability, not a mandatory workflow stage.
16. Reporting must read operational/domain data rather than become a separate source of truth.
17. Any asynchronous or background process added later must preserve the same business outcomes and authorization rules.
18. Use cases must be testable independently at the service/domain layer without relying on frontend clicks.
19. Future API operations must map to these use cases rather than expose unrestricted database CRUD.
20. Future database entities must exist because a use case needs them, not merely because a screen displays them.

---

# 3.31 Official Status

**SECTION 3 — CORE USE CASES: LOCKED**

All future sections must derive from these use cases.

Next:

> **4. Entities and Relationships**

Section 4 must identify the domain entities required to support the actors and use cases defined here.
