# DealFlow360 — Section 2: Actors / Roles

> **Status:** OFFICIAL / LOCKED
>
> **Purpose:** Control/source file for authentication, authorization, permissions, use cases, database design, API design, and implementation.
>
> **Derived from:** Official Section 1 + DealFlow360 problem statement + DealFlow360 End-to-End Product Flow (Excalidraw).
>
> **Change policy:** Future sections must respect these role boundaries. A feature must not silently grant a role permissions that are not defined here.

---

# 2.1 Role Model

DealFlow360 has **five primary roles**:

```text
ADMIN
SALES_REP
MANAGER
FINANCE_OPS
CUSTOMER
```

Every account has **exactly one primary role**.

```text
One account
    ↓
One primary role
```

A user must **never** simultaneously hold multiple primary roles.

---

# 2.2 Actor Overview

| Role | Type | Primary Purpose |
|---|---|---|
| Admin | Internal | Configure the platform and view platform-wide analytics |
| Sales Rep | Internal | Create and progress customer quotations |
| Sales Manager | Internal | Approve governed quotations and monitor deal health |
| Finance / Operations | Internal | Handle high-risk approvals, fulfillment, backorders, and recurring billing reconciliation |
| Customer | External / Portal | Review, negotiate, and confirm quotations |

The **Sales Representative is the primary day-to-day business user** at the centre of the quotation lifecycle.

---

# 2.3 Authentication Model

## Internal Users

Internal users authenticate with standard credentials.

Roles:

```text
ADMIN
SALES_REP
MANAGER
FINANCE_OPS
```

---

## Customer / Portal User

Customers are real authenticated users of the separate customer portal.

The problem statement permits either magic-link or email/password access. Our **MVP decision is email/password** because customers may return repeatedly during negotiation and final confirmation.

```text
Customer
   ↓
Email + Password
   ↓
Customer Portal
```

The customer can repeatedly:
- view quotations
- ask line-level questions
- request changes
- counter discounts
- request delivery changes
- confirm final terms

### Magic Link

Magic-link authentication is an **optional future enhancement**, not an MVP dependency.

### Customer security boundary

A customer can access only their own customer-visible data.

```text
Customer A → Customer A quotations only
Customer B → Customer B quotations only
```

Customers must never see internal approval records, internal risk/margin information, warehouse operations, Deal Health data, or administrative configuration.

---

# 2.4 Admin

## Purpose

The Admin owns platform configuration and platform-wide visibility.

## Responsibilities

- products and variants
- price lists
- discount tiers
- approval chains
- warehouses and stock/replenishment rules
- subscription plans
- reporting configuration
- platform-wide analytics

## Primary permissions

```text
Products / Variants       ✓
Price Lists               ✓
Discount Rules            ✓
Approval Chain Config     ✓
Warehouses                ✓
Stock Configuration       ✓
Subscription Plans        ✓
Reporting                 ✓
Platform Analytics        ✓
Deal Health               ✓

Approve quotations        ✗
Customer negotiation      ✗ as customer
```

Admin configuration does not automatically make Admin an approval reviewer.

---

# 2.5 Sales Representative

## Purpose

The Sales Rep is the **primary operational user** driving the quotation lifecycle.

## Responsibilities

- create quotations
- add products and quantities
- apply discounts
- review live margin
- accept or dismiss upsell/cross-sell suggestions
- track approval status
- track fulfillment progress
- respond to customer negotiation requests

## Permissions

```text
Create Quote             ✓
Edit own quotes          ✓
Apply discounts          ✓
View live margin         ✓
Use recommendations      ✓
Track approval           ✓
Respond to negotiation   ✓
View fulfillment status  ✓

Approve quote            ✗
Configure discount rules ✗
Change approval chain    ✗
Allocate warehouse       ✗
Warehouse override      ✗
Backorder decision       ✗
Manage billing rules     ✗
Full Deal Health         ✗
Platform reporting      ✗
```

The Sales Rep can **apply** a discount but does not decide whether the discount is allowed. The system evaluates it and determines the approval path.

---

# 2.6 Sales Manager / Approver

## Purpose

The Sales Manager handles quotation approvals and Deal Health oversight.

## Responsibilities

- review quotations exceeding configured discount thresholds
- approve
- reject
- return for revision
- configure discount tiers
- configure approval chains
- monitor Deal Health
- investigate at-risk deals

## Permissions

```text
View quotations          ✓
Review approval queue    ✓
Approve                  ✓
Reject                   ✓
Return for revision     ✓
Configure discount tiers ✓
Configure approval chain ✓
View Deal Health         ✓
Nudge / escalation       ✓

Warehouse allocation     ✗
Warehouse override       ✗
Backorder operations     ✗
Customer portal          ✗ as customer
```

Approval actions are valid only when the configured workflow routes a pending approval step to the Manager.

---

# 2.7 Finance / Operations

## Purpose

Finance/Ops is one combined role in our implementation, matching the source's combined **Finance / Operations User** role.

## Responsibilities

### Approval

- handle second-level approval for high-risk discounts

### Fulfillment

- manage warehouse fulfillment splits
- perform manual warehouse overrides
- manage backorder decisions
- consolidate remaining backorders

### Billing

- reconcile recurring billing
- handle applicable credit-note/refund consequences

## Permissions

```text
Second-level approval     ✓ when routed
Warehouse allocation      ✓
Warehouse override        ✓
Backorder decisions       ✓
Backorder consolidation   ✓
Recurring billing recon. ✓
Credit/refund handling    ✓

Configure discount rules  ✗
Configure approval chain  ✗
Full Deal Health          ✗
Customer portal           ✗ as customer
```

---

# 2.8 Customer / Portal User

## Purpose

The Customer participates in the deal through a **separate restricted customer portal**.

## Responsibilities

- view quotation online
- view quotation status
- ask line-level questions
- request changes
- counter the proposed discount
- request delivery-date changes
- confirm final terms

## Permissions

```text
Own quotations          ✓
View quote details      ✓
Line comments           ✓
Change requests         ✓
Counter discount        ✓
Delivery request        ✓
Confirm quotation       ✓

Other customers' quotes ✗
Internal approvals      ✗
Internal audit trail    ✗
Deal Health             ✗
Warehouse details       ✗
Internal cost/margin    ✗
Reporting               ✗
Backend configuration   ✗
```

The customer portal is a genuine separate authorization boundary, not just an internal page with different styling.

---

# 2.9 Permission Matrix

| Capability | Admin | Sales Rep | Manager | Finance/Ops | Customer |
|---|:---:|:---:|:---:|:---:|:---:|
| Internal app login | ✓ | ✓ | ✓ | ✓ | ✗ |
| Customer portal login | ✗ | ✗ | ✗ | ✗ | ✓ |
| Create quotation | ✓* | ✓ | ✗ | ✗ | ✗ |
| Edit quotation | ✓* | ✓** | ✗ | ✗ | ✗ |
| Apply discount | ✓* | ✓ | ✗ | ✗ | ✗ |
| View live margin | ✓* | ✓ | ✓ | ✓ | ✗ |
| Use recommendations | ✓* | ✓ | ✗ | ✗ | ✗ |
| Approve quotation | ✗ | ✗ | ✓ | ✓** | ✗ |
| Reject quotation | ✗ | ✗ | ✓ | ✓** | ✗ |
| Return for revision | ✗ | ✗ | ✓ | ✓** | ✗ |
| Configure discount tiers | ✓ | ✗ | ✓ | ✗ | ✗ |
| Configure approval chains | ✓ | ✗ | ✓ | ✗ | ✗ |
| Configure products | ✓ | ✗ | ✗ | ✗ | ✗ |
| Configure price lists | ✓ | ✗ | ✗ | ✗ | ✗ |
| Configure warehouses | ✓ | ✗ | ✗ | ✗ | ✗ |
| Warehouse allocation | ✗ | ✗ | ✗ | ✓ | ✗ |
| Warehouse override | ✗ | ✗ | ✗ | ✓ | ✗ |
| Backorder management | ✗ | View | ✗ | ✓ | ✗ |
| Recurring billing reconciliation | ✗ | View | ✗ | ✓ | ✗ |
| View fulfillment status | ✓* | ✓ | ✓ | ✓ | ✗ |
| Customer negotiation | ✗ | Respond | Monitor | ✗ | ✓ |
| Confirm quotation | ✗ | ✗ | ✗ | ✗ | ✓ |
| Full Deal Health | ✓ | ✗ | ✓ | ✗ | ✗ |
| Platform reporting | ✓ | Limited | ✓ | Operational | ✗ |

`*` = support/administrative capability, not the primary responsibility.

`**` = only when the workflow/state permits it.

---

# 2.10 Non-Negotiable Role Boundaries

## Sales Rep cannot approve their own quotation

```text
Sales Rep
   ↓
Creates quote
   ↓
System determines approval
   ↓
Manager / Finance-Ops
```

## Customer cannot enter the internal application

```text
Customer → Customer Portal
```

## Customer cannot see internal intelligence

Do not expose:
- internal approval chain/history
- internal reviewers
- internal risk calculations
- internal margin/cost
- warehouse operational details
- Deal Health alerts

## Sales Rep cannot modify governing rules

The Sales Rep uses the organization's pricing, discount, recommendation and approval policies but cannot change those policies.

## Deal Health is not a workflow stage

Deal Health is a **parallel monitoring/control layer**.

Correct:

```text
Manager → Deal Health Dashboard → Investigate alert
```

Incorrect:

```text
Sales Rep → Deal Health → next sales stage
```

---

# 2.11 Authorization Model

MVP authorization uses **Role-Based Access Control (RBAC)** with resource/state checks.

```text
user.role ∈ {
  ADMIN,
  SALES_REP,
  MANAGER,
  FINANCE_OPS,
  CUSTOMER
}
```

Authorization is evaluated as:

```text
Role
+
Operation
+
Resource ownership / scope
+
Current business state
```

Examples:

```text
CUSTOMER
+
View Quotation
+
quotation.customer_id == authenticated_customer.id
+
quotation is customer-visible
```

```text
SALES_REP
+
Edit Quotation
+
quotation.sales_rep_id == authenticated_user.id
+
quotation is editable
```

```text
MANAGER
+
Approve Quotation
+
approval step is assigned to Manager
+
approval step is pending
```

Role alone is therefore not enough; ownership and workflow state matter.

---

# 2.12 Authentication vs Authorization

### Authentication

> **Who are you?**

Example:

```text
Email + Password
```

### Authorization

> **What are you allowed to do?**

Examples:

```text
SALES_REP  → edit own quotation
MANAGER    → approve assigned approval step
CUSTOMER   → view own portal quotation
```

Authorization must be enforced **server-side**, not only in the frontend.

---

# 2.13 Actor Interaction Model

```text
                         ┌───────────────┐
                         │     ADMIN     │
                         │ Configuration │
                         └───────┬───────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │    DEALFLOW360 RULES   │
                    └────────────┬───────────┘
                                 │
                                 ▼
┌──────────────┐       ┌─────────────────────┐
│  SALES REP   │──────▶│     QUOTATION       │
└──────────────┘       │  Live Business      │
                       │      Object         │
                       └──────────┬──────────┘
                                  │
                     ┌────────────┼─────────────┐
                     │            │             │
                     ▼            ▼             ▼
                ┌─────────┐ ┌──────────┐ ┌──────────────┐
                │ Manager │ │ Finance/ │ │  Customer    │
                │Approver │ │Operations│ │ Portal User  │
                └─────────┘ └──────────┘ └──────────────┘
                     │            │             │
                  Approval    Fulfillment    Negotiation
                                + Billing
                                                 │
                                                 ▼
                                            Re-evaluation
```

Separately:

```text
                         ┌─────────────────────┐
                         │     DEAL HEALTH      │
                         │ Parallel Monitoring  │
                         └──────────┬──────────┘
                                    │
           ┌────────────────────────┼─────────────────────┐
           ▼                        ▼                     ▼
       Stalled                 Discount              Delivery
        Deals                 Anomalies              Slippage
           │                        │                     │
           └────────────────────────┼─────────────────────┘
                                    ▼
                           Manager / Action
```

---

# 2.14 Coding-Agent Guardrails

The implementation must preserve these rules:

1. Every account has exactly **one primary role**.
2. Allowed roles are exactly `ADMIN`, `SALES_REP`, `MANAGER`, `FINANCE_OPS`, `CUSTOMER`.
3. Customer is a real authenticated portal user.
4. Customer MVP authentication is **email/password**.
5. Magic-link authentication is optional future functionality, not required for MVP.
6. Customer data access must be restricted to that customer's own data.
7. Customer portal and internal workspace are separate authorization boundaries.
8. Sales Rep is the primary day-to-day quotation actor.
9. Sales Rep can apply discounts but cannot change governing policy.
10. Sales Rep cannot approve their own quotation.
11. Approval authority is determined by the configured workflow.
12. Manager owns normal approval review and Deal Health oversight.
13. Finance/Ops is one combined role.
14. Finance/Ops owns routed second-level approvals plus warehouse/backorder and recurring billing reconciliation operations.
15. Admin owns full backend configuration and platform-wide analytics/reporting.
16. Deal Health is a monitoring layer, not a role and not a mandatory workflow stage.
17. Authorization must be enforced server-side.
18. Authorization should consider role + operation + resource scope/ownership + current business state.
19. Future API permissions must be derived from this role model.
20. Future database relationships must preserve actor ownership and responsibility boundaries.

---

# 2.15 Official Status

**SECTION 2 — ACTORS / ROLES: LOCKED**

All future sections must derive from this actor model.

Next:

> **3. Core Use Cases**

The use cases must be derived from these actors and preserve the permission boundaries defined here.
