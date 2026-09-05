# DealFlow360 — Section 5: Database Schema

> **Status:** OFFICIAL / LOCKED
>
> **Purpose:** Control file for the coding agent. Defines the concrete relational persistence model derived from Sections 1–4.
>
> **Database target:** PostgreSQL-style relational schema.
>
> **Source basis:** Section 1 — Problem Restatement; Section 2 — Actors / Roles; Section 3 — Core Use Cases; Section 4 — Entities and Relationships; DealFlow360 problem statement; DealFlow360 End-to-End Product Flow (Excalidraw).
>
> **Change policy:** The implementation must preserve the entities, relationships, invariants, ownership boundaries, and lifecycle semantics defined here. Any schema change must be justified against the use cases and explicitly revisited.

---

# 5.1 Database Design Goals

The schema must support:

1. One authenticated account with exactly one primary role.
2. Customers and their portal users.
3. Product catalog, variants, categories, pricing, and customer-tier rules.
4. Customer-tier and category-specific discount governance.
5. Quotations as the central live commercial object.
6. Multiple quotation approval cycles.
7. Line-level quotation pricing/discount information.
8. Customer negotiation requests.
9. Multi-warehouse stock and reservation/allocation.
10. Backorders.
11. Subscription instances and recurring billing.
12. One-time invoices, payments, and credit notes.
13. Deal Health alerts as persistent exceptions.
14. Audit history for important business events.
15. Resource ownership and role-based authorization.
16. Safe concurrent inventory allocation.
17. Historical approval context so later quotation edits cannot silently change what an approver previously reviewed.

---

# 5.2 Database Principles

## 5.2.1 Relational source of truth

PostgreSQL is the transactional source of truth for business state.

The frontend must never be considered authoritative for:

- quotation status
- approval status
- discount validity
- inventory availability
- fulfillment state
- billing state
- payment state
- Deal Health state

---

## 5.2.2 IDs

All primary keys should use UUIDs.

Recommended PostgreSQL type:

```sql
UUID
```

Use application-generated or database-generated UUIDs consistently.

---

## 5.2.3 Timestamps

All mutable business tables should contain:

```text
created_at
updated_at
```

Where historical event time matters, store the event timestamp explicitly rather than relying only on `updated_at`.

Use UTC timestamps:

```sql
TIMESTAMPTZ
```

---

## 5.2.4 Money

Do not use floating-point database types for financial values.

Use:

```sql
NUMERIC(18,2)
```

for monetary amounts.

For percentages:

```sql
NUMERIC(7,4)
```

is recommended when precision beyond whole percentages is useful.

---

## 5.2.5 Quantities

Use:

```sql
NUMERIC(18,4)
```

for product quantities so the schema can support both whole-unit hardware and fractional service quantities where needed.

The UI may restrict some products to integer quantities, but the storage layer should not unnecessarily force every product to be integer-only.

---

# 5.3 Enumerations

Recommended application/database enums:

```text
UserRole
    ADMIN
    SALES_REP
    MANAGER
    FINANCE_OPS
    CUSTOMER

QuotationStatus
    DRAFT
    PENDING_APPROVAL
    APPROVED
    UNDER_NEGOTIATION
    CONFIRMED
    REJECTED

ApprovalLevel
    MANAGER
    FINANCE

ApprovalStepStatus
    PENDING
    APPROVED
    REJECTED
    RETURNED
    SKIPPED

ApprovalRequestStatus
    PENDING
    APPROVED
    REJECTED
    RETURNED
    SUPERSEDED

NegotiationStatus
    OPEN
    ACCEPTED
    REJECTED
    WITHDRAWN
    RESOLVED

NegotiationType
    LINE_COMMENT
    CHANGE_REQUEST
    COUNTER_DISCOUNT
    DELIVERY_DATE_REQUEST

FulfillmentStatus
    SPLIT_PENDING
    PARTIAL
    BACKORDER
    FULFILLED

SubscriptionStatus
    ACTIVE
    PAUSED
    CANCELLED

InvoiceStatus
    UNPAID
    PARTIALLY_PAID
    PAID
    VOID

PaymentStatus
    RECORDED
    REVERSED

CreditNoteStatus
    DRAFT
    ISSUED
    CANCELLED

DealHealthType
    STALLED
    DISCOUNT_ANOMALY
    DELIVERY_SLIPPAGE

DealHealthStatus
    OPEN
    ACKNOWLEDGED
    RESOLVED
    DISMISSED

AuditAction
    USER_CREATED
    USER_ROLE_CHANGED
    PRODUCT_CREATED
    PRODUCT_UPDATED
    PRICE_LIST_UPDATED
    DISCOUNT_RULE_UPDATED
    APPROVAL_CHAIN_UPDATED
    WAREHOUSE_UPDATED
    QUOTATION_CREATED
    QUOTATION_UPDATED
    QUOTATION_SUBMITTED
    DISCOUNT_CHANGED
    APPROVAL_CREATED
    APPROVAL_APPROVED
    APPROVAL_REJECTED
    APPROVAL_RETURNED
    NEGOTIATION_CREATED
    NEGOTIATION_RESOLVED
    QUOTATION_CONFIRMED
    FULFILLMENT_CREATED
    FULFILLMENT_UPDATED
    BACKORDER_CREATED
    BACKORDER_CONSOLIDATED
    SUBSCRIPTION_CREATED
    SUBSCRIPTION_UPDATED
    INVOICE_CREATED
    PAYMENT_RECORDED
    PAYMENT_REVERSED
    CREDIT_NOTE_CREATED
    DEAL_HEALTH_CREATED
    DEAL_HEALTH_UPDATED
    NUDGE_SENT
    ESCALATION_TRIGGERED
```

Additional enum values may be added only when required by a concrete business rule.

---

# 5.4 Table Overview

## Identity / access

```text
users
customers
```

## Catalog / commercial configuration

```text
categories
products
product_variants
discount_tiers
category_discount_ceilings
price_list_entries
```

## Operational configuration

```text
warehouses
replenishment_rules
```

## Sales / quotation

```text
quotations
quotation_lines
approval_requests
approval_steps
negotiation_requests
```

## Fulfillment

```text
stock_levels
fulfillment_allocations
backorders
```

## Billing

```text
subscription_instances
invoices
payments
credit_notes
```

## Monitoring / audit

```text
deal_health_flags
audit_logs
```

---

# 5.5 `users`

## Purpose

Stores every authenticated account.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `email` | CITEXT / VARCHAR(320) | UNIQUE, NOT NULL |
| `password_hash` | TEXT | NOT NULL |
| `role` | `UserRole` | NOT NULL |
| `first_name` | VARCHAR(100) | NOT NULL |
| `last_name` | VARCHAR(100) | NOT NULL |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `last_login_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Constraints

```text
One user = one primary role.
```

Do not create a many-to-many user-role table for MVP.

## Indexes

```text
UNIQUE(email)
INDEX(role)
INDEX(is_active)
```

---

# 5.6 `customers`

## Purpose

Represents the B2B customer organization.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `name` | VARCHAR(200) | NOT NULL |
| `discount_tier_id` | UUID | FK → discount_tiers.id, NOT NULL |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Customer portal identity

Customer users are represented in `users` with:

```text
users.role = CUSTOMER
```

The database must associate a customer portal account with its customer organization.

Recommended MVP rule:

```text
Customer
   1 ─── 1
User(role = CUSTOMER)
```

If future requirements allow multiple customer contacts per organization, this relationship can become:

```text
Customer
   1 ─── *
Customer Users
```

but that should be an explicit future schema change.

### Implementation note

If one-to-one is used, enforce it with:

```sql
UNIQUE(customer_id)
```

on the customer-user relationship representation.

If the implementation attaches `customer_id` directly to `users`, use:

```text
users.customer_id NULLABLE
```

with:

```text
CHECK(
    (role = CUSTOMER AND customer_id IS NOT NULL)
    OR
    (role <> CUSTOMER AND customer_id IS NULL)
)
```

This is the recommended MVP implementation because it keeps authorization checks simple.

---

# 5.7 `categories`

## Purpose

Product category used for catalog organization and discount governance.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `name` | VARCHAR(120) | UNIQUE, NOT NULL |
| `description` | TEXT | NULL |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

---

# 5.8 `products`

## Purpose

Sellable product, service, or subscription-capable item.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `sku` | VARCHAR(100) | UNIQUE, NOT NULL |
| `name` | VARCHAR(200) | NOT NULL |
| `category_id` | UUID | FK → categories.id, NOT NULL |
| `description` | TEXT | NULL |
| `unit` | VARCHAR(50) | NOT NULL |
| `base_price` | NUMERIC(18,2) | NOT NULL |
| `tax_rate` | NUMERIC(7,4) | NOT NULL DEFAULT 0 |
| `is_subscription` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `recurring_interval` | VARCHAR(20) | NULL |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Constraints

```text
base_price >= 0
tax_rate >= 0
```

If:

```text
is_subscription = TRUE
```

then:

```text
recurring_interval IS NOT NULL
```

Otherwise:

```text
recurring_interval IS NULL
```

Recommended interval values:

```text
MONTHLY
QUARTERLY
YEARLY
```

Use an enum in application code or a database check if desired.

---

# 5.9 `product_variants`

## Purpose

Stores optional product attribute/value variants with price adjustments.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `product_id` | UUID | FK → products.id, NOT NULL |
| `attribute_name` | VARCHAR(100) | NOT NULL |
| `attribute_value` | VARCHAR(100) | NOT NULL |
| `extra_price` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Uniqueness

```text
(product_id, attribute_name, attribute_value)
```

must be unique.

---

# 5.10 `discount_tiers`

## Purpose

Defines customer-level discount ceilings.

Example:

```text
Bronze → 5%
Silver → 10%
Gold   → 15%
```

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `name` | VARCHAR(80) | UNIQUE, NOT NULL |
| `default_discount_ceiling` | NUMERIC(7,4) | NOT NULL |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Constraint

```text
0 <= default_discount_ceiling <= 100
```

---

# 5.11 `category_discount_ceilings`

## Purpose

Defines category-specific discount ceilings.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `category_id` | UUID | FK → categories.id, NOT NULL |
| `max_discount` | NUMERIC(7,4) | NOT NULL |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Uniqueness

```text
(category_id)
```

if only one active policy per category is supported.

If the implementation later needs effective dates/versioning, add a policy-version model explicitly.

---

# 5.12 `price_list_entries`

## Purpose

Stores tier/currency/product pricing rules.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `product_id` | UUID | FK → products.id, NOT NULL |
| `discount_tier_id` | UUID | FK → discount_tiers.id, NOT NULL |
| `currency_code` | CHAR(3) | NOT NULL |
| `price` | NUMERIC(18,2) | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Uniqueness

```text
(product_id, discount_tier_id, currency_code)
```

must be unique.

## Constraint

```text
price >= 0
```

---

# 5.13 `warehouses`

## Purpose

Represents a physical fulfillment location.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `name` | VARCHAR(160) | UNIQUE, NOT NULL |
| `address` | TEXT | NULL |
| `shipping_cost_weight` | NUMERIC(12,4) | NOT NULL DEFAULT 1 |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Constraint

```text
shipping_cost_weight > 0
```

This value is used by the warehouse allocation logic to balance stock availability and shipment cost.

---

# 5.14 `replenishment_rules`

## Purpose

Optional warehouse/product replenishment configuration.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `warehouse_id` | UUID | FK → warehouses.id, NOT NULL |
| `product_id` | UUID | FK → products.id, NOT NULL |
| `reorder_point` | NUMERIC(18,4) | NOT NULL |
| `reorder_quantity` | NUMERIC(18,4) | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Uniqueness

```text
(warehouse_id, product_id)
```

This table is not required to complete the core quote-to-cash flow and can be postponed if time is limited.

---

# 5.15 `quotations`

## Purpose

**Central live commercial business object.**

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `quote_number` | VARCHAR(50) | UNIQUE, NOT NULL |
| `customer_id` | UUID | FK → customers.id, NOT NULL |
| `sales_rep_id` | UUID | FK → users.id, NOT NULL |
| `status` | `QuotationStatus` | NOT NULL |
| `currency_code` | CHAR(3) | NOT NULL |
| `subtotal` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `discount_total` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `tax_total` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `grand_total` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `margin_amount` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `margin_percent` | NUMERIC(7,4) | NOT NULL DEFAULT 0 |
| `blended_risk_score` | NUMERIC(12,4) | NULL |
| `risk_level` | VARCHAR(20) | NULL |
| `current_version` | INTEGER | NOT NULL DEFAULT 1 |
| `customer_visible_at` | TIMESTAMPTZ | NULL |
| `confirmed_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Ownership

```text
sales_rep_id → users.role must be SALES_REP
```

Enforce through application service logic and authorization checks. A plain FK cannot enforce role membership.

## Constraints

```text
current_version >= 1
subtotal >= 0
discount_total >= 0
tax_total >= 0
grand_total >= 0
```

## Important design rule

`blended_risk_score` is a **current calculated result**.

It is not the permanent historical truth of every past approval.

Historical approval context is preserved through `approval_requests` snapshots.

---

# 5.16 `quotation_lines`

## Purpose

Stores the current line-level commercial content of a quotation.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `quotation_id` | UUID | FK → quotations.id, NOT NULL |
| `product_id` | UUID | FK → products.id, NOT NULL |
| `product_variant_id` | UUID | FK → product_variants.id, NULL |
| `description_snapshot` | TEXT | NOT NULL |
| `sku_snapshot` | VARCHAR(100) | NOT NULL |
| `quantity` | NUMERIC(18,4) | NOT NULL |
| `unit_price` | NUMERIC(18,2) | NOT NULL |
| `discount_percent` | NUMERIC(7,4) | NOT NULL DEFAULT 0 |
| `discount_amount` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `tax_amount` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `line_total` | NUMERIC(18,2) | NOT NULL |
| `estimated_unit_cost` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `estimated_margin_amount` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `estimated_margin_percent` | NUMERIC(7,4) | NOT NULL DEFAULT 0 |
| `allowed_discount_percent` | NUMERIC(7,4) | NOT NULL |
| `discount_overage_percent` | NUMERIC(7,4) | NOT NULL DEFAULT 0 |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Why snapshot product information?

The product catalogue may change after a quotation is created.

The quotation must preserve the commercial terms shown to the customer.

Therefore store:

```text
description_snapshot
sku_snapshot
unit_price
tax inputs
allowed discount at evaluation time
```

The canonical product record remains the source for future quotes, but an existing quote must not silently change because an Admin edits the catalogue.

## Constraints

```text
quantity > 0
unit_price >= 0
0 <= discount_percent <= 100
discount_amount >= 0
line_total >= 0
0 <= allowed_discount_percent <= 100
discount_overage_percent >= 0
```

---

# 5.17 `approval_requests`

## Purpose

Represents **one approval cycle** for one quotation version.

This is critical because a quotation can require approval more than once.

Example:

```text
Quotation v3
   ↓
Approval Request #1
   ↓
Customer negotiates
   ↓
Quotation v4
   ↓
Approval Request #2
```

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `quotation_id` | UUID | FK → quotations.id, NOT NULL |
| `quotation_version` | INTEGER | NOT NULL |
| `status` | `ApprovalRequestStatus` | NOT NULL |
| `risk_score` | NUMERIC(12,4) | NOT NULL |
| `risk_level` | VARCHAR(20) | NOT NULL |
| `required_approval_count` | INTEGER | NOT NULL |
| `terms_snapshot` | JSONB | NOT NULL |
| `submitted_at` | TIMESTAMPTZ | NOT NULL |
| `completed_at` | TIMESTAMPTZ | NULL |
| `created_by` | UUID | FK → users.id, NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Why `terms_snapshot`?

The approver must review a stable representation of the commercial terms that triggered that approval request.

The snapshot should contain at least:

```text
quotation version
customer
currency
lines
quantities
unit prices
discounts
discount limits
risk score
risk level
totals
margin
```

This prevents later edits from rewriting history.

## Uniqueness

Recommended:

```text
(quotation_id, quotation_version)
```

must be unique.

---

# 5.18 `approval_steps`

## Purpose

Represents individual ordered reviewer steps within an approval request.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `approval_request_id` | UUID | FK → approval_requests.id, NOT NULL |
| `sequence_no` | INTEGER | NOT NULL |
| `approval_level` | `ApprovalLevel` | NOT NULL |
| `approver_user_id` | UUID | FK → users.id, NOT NULL |
| `status` | `ApprovalStepStatus` | NOT NULL |
| `decision_reason` | TEXT | NULL |
| `acted_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Uniqueness

```text
(approval_request_id, sequence_no)
```

and preferably:

```text
(approval_request_id, approval_level)
```

when each approval level occurs at most once per cycle.

## Workflow example

```text
Approval Request
    Step 1 → MANAGER
    Step 2 → FINANCE
```

Finance should not be actionable before Manager approval.

---

# 5.19 `negotiation_requests`

## Purpose

Stores customer-initiated quotation negotiation/change requests.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `quotation_id` | UUID | FK → quotations.id, NOT NULL |
| `customer_id` | UUID | FK → customers.id, NOT NULL |
| `requested_by_user_id` | UUID | FK → users.id, NOT NULL |
| `negotiation_type` | `NegotiationType` | NOT NULL |
| `quotation_line_id` | UUID | FK → quotation_lines.id, NULL |
| `message` | TEXT | NULL |
| `requested_discount_percent` | NUMERIC(7,4) | NULL |
| `requested_delivery_date` | DATE | NULL |
| `status` | `NegotiationStatus` | NOT NULL DEFAULT OPEN |
| `resolved_by_user_id` | UUID | FK → users.id, NULL |
| `resolved_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Security invariant

```text
requested_by_user_id
```

must belong to:

```text
users.role = CUSTOMER
```

and:

```text
users.customer_id = negotiation_requests.customer_id
```

must be true.

Also:

```text
negotiation_requests.quotation.customer_id
=
negotiation_requests.customer_id
```

This must be checked in the service layer because the database FK alone cannot express the full ownership rule.

---

# 5.20 `stock_levels`

## Purpose

Current inventory position for one product in one warehouse.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `warehouse_id` | UUID | FK → warehouses.id, NOT NULL |
| `product_id` | UUID | FK → products.id, NOT NULL |
| `quantity_on_hand` | NUMERIC(18,4) | NOT NULL DEFAULT 0 |
| `quantity_reserved` | NUMERIC(18,4) | NOT NULL DEFAULT 0 |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Computed value

Do not store `available` as an independently mutable number.

```text
available = quantity_on_hand - quantity_reserved
```

Use a generated expression/view/application calculation.

## Constraints

```text
quantity_on_hand >= 0
quantity_reserved >= 0
quantity_reserved <= quantity_on_hand
```

## Uniqueness

```text
(warehouse_id, product_id)
```

must be unique.

## Concurrency

Allocation must lock the relevant stock rows in a transaction.

Recommended pattern:

```sql
SELECT ...
FROM stock_levels
WHERE warehouse_id = ?
  AND product_id = ?
FOR UPDATE;
```

Then recalculate available stock and reserve the requested quantity.

---

# 5.21 `fulfillment_allocations`

## Purpose

Records the quantity assigned to a warehouse for a quotation line.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `quotation_id` | UUID | FK → quotations.id, NOT NULL |
| `quotation_line_id` | UUID | FK → quotation_lines.id, NOT NULL |
| `warehouse_id` | UUID | FK → warehouses.id, NOT NULL |
| `quantity_allocated` | NUMERIC(18,4) | NOT NULL |
| `quantity_fulfilled` | NUMERIC(18,4) | NOT NULL DEFAULT 0 |
| `status` | `FulfillmentStatus` | NOT NULL |
| `estimated_shipment_cost` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Constraints

```text
quantity_allocated > 0
0 <= quantity_fulfilled <= quantity_allocated
estimated_shipment_cost >= 0
```

## Relationship

```text
QuotationLine
      ↓
FulfillmentAllocation
      ↓
Warehouse
```

This preserves line-level fulfillment traceability.

---

# 5.22 `backorders`

## Purpose

Stores unfulfilled quantity that remains after an allocation attempt.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `quotation_id` | UUID | FK → quotations.id, NOT NULL |
| `quotation_line_id` | UUID | FK → quotation_lines.id, NOT NULL |
| `fulfillment_allocation_id` | UUID | FK → fulfillment_allocations.id, NULL |
| `quantity_backordered` | NUMERIC(18,4) | NOT NULL |
| `quantity_fulfilled_later` | NUMERIC(18,4) | NOT NULL DEFAULT 0 |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Constraints

```text
quantity_backordered > 0
0 <= quantity_fulfilled_later <= quantity_backordered
```

The remaining quantity is:

```text
remaining_backorder =
    quantity_backordered - quantity_fulfilled_later
```

Do not create a new quotation for the backorder.

---

# 5.23 `subscription_instances`

## Purpose

Represents the customer's actual recurring subscription created from a recurring quotation line.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `quotation_id` | UUID | FK → quotations.id, NOT NULL |
| `quotation_line_id` | UUID | FK → quotation_lines.id, UNIQUE, NOT NULL |
| `customer_id` | UUID | FK → customers.id, NOT NULL |
| `product_id` | UUID | FK → products.id, NOT NULL |
| `status` | `SubscriptionStatus` | NOT NULL |
| `quantity` | NUMERIC(18,4) | NOT NULL |
| `unit_price` | NUMERIC(18,2) | NOT NULL |
| `currency_code` | CHAR(3) | NOT NULL |
| `billing_interval` | VARCHAR(20) | NOT NULL |
| `current_period_start` | DATE | NOT NULL |
| `current_period_end` | DATE | NOT NULL |
| `next_billing_date` | DATE | NOT NULL |
| `cancelled_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Relationship

One subscription quotation line can create at most one subscription instance.

```text
QuotationLine 1 ─── 0..1 SubscriptionInstance
```

## Constraints

```text
quantity > 0
unit_price >= 0
current_period_start < current_period_end
```

---

# 5.24 `invoices`

## Purpose

Billing records generated from fulfilled one-time amounts and recurring billing events.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `invoice_number` | VARCHAR(50) | UNIQUE, NOT NULL |
| `quotation_id` | UUID | FK → quotations.id, NOT NULL |
| `subscription_instance_id` | UUID | FK → subscription_instances.id, NULL |
| `currency_code` | CHAR(3) | NOT NULL |
| `status` | `InvoiceStatus` | NOT NULL |
| `subtotal` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `tax_total` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `total_amount` | NUMERIC(18,2) | NOT NULL DEFAULT 0 |
| `issued_at` | TIMESTAMPTZ | NULL |
| `due_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Relationships

One quotation can have multiple invoices:

```text
Quotation 1 ──── * Invoice
```

A recurring invoice may additionally reference:

```text
SubscriptionInstance
```

A one-time invoice has:

```text
subscription_instance_id = NULL
```

The implementation can additionally associate invoices to fulfillment allocations where shipment/invoice reconciliation is used.

---

# 5.25 `payments`

## Purpose

Stores payments against invoices.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `invoice_id` | UUID | FK → invoices.id, NOT NULL |
| `amount` | NUMERIC(18,2) | NOT NULL |
| `currency_code` | CHAR(3) | NOT NULL |
| `status` | `PaymentStatus` | NOT NULL DEFAULT RECORDED |
| `payment_reference` | VARCHAR(120) | UNIQUE, NOT NULL |
| `paid_at` | TIMESTAMPTZ | NOT NULL |
| `created_by` | UUID | FK → users.id, NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Constraints

```text
amount > 0
```

The total effective payment amount cannot exceed the invoice balance unless an explicit overpayment policy is later introduced.

---

# 5.26 `credit_notes`

## Purpose

Represents billing adjustments resulting from applicable refunds, cancellations, or subscription changes.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `credit_note_number` | VARCHAR(50) | UNIQUE, NOT NULL |
| `invoice_id` | UUID | FK → invoices.id, NOT NULL |
| `subscription_instance_id` | UUID | FK → subscription_instances.id, NULL |
| `amount` | NUMERIC(18,2) | NOT NULL |
| `currency_code` | CHAR(3) | NOT NULL |
| `reason` | TEXT | NOT NULL |
| `status` | `CreditNoteStatus` | NOT NULL |
| `issued_at` | TIMESTAMPTZ | NULL |
| `created_by` | UUID | FK → users.id, NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Constraint

```text
amount > 0
```

---

# 5.27 `deal_health_flags`

## Purpose

Persistent representation of exceptions detected by the Deal Health layer.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `quotation_id` | UUID | FK → quotations.id, NOT NULL |
| `type` | `DealHealthType` | NOT NULL |
| `status` | `DealHealthStatus` | NOT NULL DEFAULT OPEN |
| `severity` | VARCHAR(20) | NOT NULL |
| `message` | TEXT | NOT NULL |
| `detected_value` | NUMERIC(18,4) | NULL |
| `expected_value` | NUMERIC(18,4) | NULL |
| `detected_at` | TIMESTAMPTZ | NOT NULL |
| `acknowledged_by` | UUID | FK → users.id, NULL |
| `acknowledged_at` | TIMESTAMPTZ | NULL |
| `resolved_by` | UUID | FK → users.id, NULL |
| `resolved_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

## Required types

```text
STALLED
DISCOUNT_ANOMALY
DELIVERY_SLIPPAGE
```

## Important architecture rule

This table is the monitoring data source.

The Deal Health dashboard is only a view over this data.

---

# 5.28 `audit_logs`

## Purpose

Immutable record of important business actions.

## Columns

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `actor_user_id` | UUID | FK → users.id, NOT NULL |
| `action` | `AuditAction` | NOT NULL |
| `entity_type` | VARCHAR(80) | NOT NULL |
| `entity_id` | UUID | NOT NULL |
| `quotation_id` | UUID | FK → quotations.id, NULL |
| `reason` | TEXT | NULL |
| `metadata` | JSONB | NOT NULL DEFAULT '{}' |
| `created_at` | TIMESTAMPTZ | NOT NULL |

## Why `quotation_id`?

Many important business events ultimately concern a quotation.

Keeping a direct optional quotation reference makes it efficient to retrieve a deal's audit trail without needing entity-specific joins for every action.

## Immutability

Application code must not expose ordinary update/delete operations for audit entries.

Audit logs are append-only.

---

# 5.29 Foreign-Key Relationship Map

```text
users
 ├── sales_rep_id → quotations
 ├── approver_user_id → approval_steps
 ├── requested_by_user_id → negotiation_requests
 ├── created_by → approval_requests
 ├── created_by → payments
 ├── created_by → credit_notes
 └── actor_user_id → audit_logs

discount_tiers
 ├── customers
 └── price_list_entries

customers
 ├── quotations
 ├── negotiation_requests
 ├── subscription_instances
 └── user.customer_id

categories
 ├── products
 └── category_discount_ceilings

products
 ├── product_variants
 ├── price_list_entries
 ├── quotation_lines
 ├── stock_levels
 └── subscription_instances

quotations
 ├── quotation_lines
 ├── approval_requests
 ├── negotiation_requests
 ├── fulfillment_allocations
 ├── subscription_instances
 ├── invoices
 ├── deal_health_flags
 └── audit_logs

approval_requests
 └── approval_steps

quotation_lines
 ├── negotiation_requests
 ├── fulfillment_allocations
 ├── backorders
 └── subscription_instances

warehouses
 ├── stock_levels
 ├── fulfillment_allocations
 └── replenishment_rules

fulfillment_allocations
 └── backorders

subscription_instances
 ├── invoices
 └── credit_notes

invoices
 ├── payments
 └── credit_notes
```

---

# 5.30 Full Relational ER Structure

```text
USERS
  │
  ├───────────────< QUOTATIONS >────────────── CUSTOMERS
  │                     │                          │
  │                     │                          └── DISCOUNT_TIERS
  │                     │
  │                     ├──< QUOTATION_LINES >── PRODUCTS ──< PRODUCT_VARIANTS
  │                     │                         │
  │                     │                         ├── STOCK_LEVELS >── WAREHOUSES
  │                     │                         ├── PRICE_LIST_ENTRIES
  │                     │                         └── CATEGORY
  │                     │
  │                     ├──< APPROVAL_REQUESTS
  │                     │          │
  │                     │          └──< APPROVAL_STEPS >── USERS
  │                     │
  │                     ├──< NEGOTIATION_REQUESTS >── USERS/CUSTOMERS
  │                     │
  │                     ├──< FULFILLMENT_ALLOCATIONS >── WAREHOUSES
  │                     │                │
  │                     │                └──< BACKORDERS
  │                     │
  │                     ├──< SUBSCRIPTION_INSTANCES
  │                     │          │
  │                     │          ├──< INVOICES
  │                     │          │       ├──< PAYMENTS
  │                     │          │       └──< CREDIT_NOTES
  │                     │          │
  │                     │          └──< CREDIT_NOTES
  │                     │
  │                     ├──< INVOICES
  │                     │
  │                     ├──< DEAL_HEALTH_FLAGS
  │                     │
  │                     └──< AUDIT_LOGS
  │
  └── CUSTOMER users → CUSTOMERS
```

---

# 5.31 Critical Uniqueness Constraints

The following uniqueness rules are mandatory:

```text
users.email

customers.name             [or use a future external customer code]
categories.name
products.sku
product_variants(product_id, attribute_name, attribute_value)
discount_tiers.name

price_list_entries(
    product_id,
    discount_tier_id,
    currency_code
)

category_discount_ceilings.category_id

warehouses.name

replenishment_rules(
    warehouse_id,
    product_id
)

quotations.quote_number

approval_requests(
    quotation_id,
    quotation_version
)

approval_steps(
    approval_request_id,
    sequence_no
)

stock_levels(
    warehouse_id,
    product_id
)

subscription_instances.quotation_line_id

invoices.invoice_number
payments.payment_reference
credit_notes.credit_note_number
```

---

# 5.32 Critical Check Constraints

The database/application must enforce:

```text
discount percentage between 0 and 100

quantity > 0

prices >= 0

tax >= 0

margin calculations use monetary precision

stock:
    quantity_on_hand >= 0
    quantity_reserved >= 0
    quantity_reserved <= quantity_on_hand

fulfillment:
    quantity_allocated > 0
    0 <= quantity_fulfilled <= quantity_allocated

backorder:
    quantity_backordered > 0
    0 <= quantity_fulfilled_later <= quantity_backordered

subscription:
    quantity > 0
    current_period_start < current_period_end

payment:
    amount > 0

credit note:
    amount > 0

warehouse:
    shipping_cost_weight > 0
```

---

# 5.33 Required Indexes

At minimum:

## Users

```text
users(email) UNIQUE
users(role)
users(customer_id)
```

## Customers

```text
customers(discount_tier_id)
```

## Products

```text
products(category_id)
products(is_active)
products(is_subscription)
```

## Price / discount

```text
price_list_entries(product_id, discount_tier_id, currency_code) UNIQUE
category_discount_ceilings(category_id) UNIQUE
```

## Quotations

```text
quotations(customer_id)
quotations(sales_rep_id)
quotations(status)
quotations(updated_at)
quotations(created_at)
```

A composite index is useful for dashboard queries:

```text
quotations(sales_rep_id, status, updated_at)
```

## Quotation lines

```text
quotation_lines(quotation_id)
quotation_lines(product_id)
```

## Approvals

```text
approval_requests(quotation_id, status)
approval_requests(quotation_id, quotation_version)
approval_steps(approval_request_id, status)
approval_steps(approver_user_id, status)
```

## Negotiations

```text
negotiation_requests(quotation_id, status)
negotiation_requests(customer_id, status)
```

## Inventory

```text
stock_levels(warehouse_id, product_id) UNIQUE
stock_levels(product_id, warehouse_id)
```

The unique index already serves the common lookup, so do not create redundant indexes unless query analysis proves necessary.

## Fulfillment

```text
fulfillment_allocations(quotation_id, status)
fulfillment_allocations(quotation_line_id)
fulfillment_allocations(warehouse_id)
```

## Backorders

```text
backorders(quotation_id)
backorders(quotation_line_id)
```

## Billing

```text
subscription_instances(customer_id, status)
subscription_instances(next_billing_date, status)

invoices(quotation_id, status)
invoices(subscription_instance_id)
payments(invoice_id)
credit_notes(invoice_id)
```

## Deal Health

```text
deal_health_flags(quotation_id, status)
deal_health_flags(type, status)
deal_health_flags(detected_at)
```

## Audit

```text
audit_logs(entity_type, entity_id)
audit_logs(quotation_id, created_at)
audit_logs(actor_user_id, created_at)
```

---

# 5.34 Quotation Versioning Strategy

A critical problem is preserving the terms that were actually reviewed.

For MVP:

```text
quotations.current_version
```

is incremented whenever a material quotation edit occurs.

Material edits include at least:

- product changes
- quantity changes
- price changes
- line discount changes
- order discount changes
- customer negotiation changes affecting terms
- delivery terms that affect the commercial deal

When a quote enters approval:

```text
approval_requests.quotation_version
approval_requests.terms_snapshot
```

capture the exact version being reviewed.

Example:

```text
Quotation Q-1042
current_version = 3

Approval Request A1
quotation_version = 3
terms_snapshot = snapshot(v3)
```

Customer negotiates:

```text
Q-1042
current_version = 4

Approval Request A2
quotation_version = 4
terms_snapshot = snapshot(v4)
```

This avoids the dangerous situation where an old approval silently applies to new commercial terms.

---

# 5.35 State Storage Strategy

Do not collapse all business states into one giant `status` column.

Use separate lifecycle states:

```text
Quotation.status
ApprovalRequest.status
ApprovalStep.status
FulfillmentAllocation.status
SubscriptionInstance.status
Invoice.status
Payment.status
DealHealthFlag.status
```

This allows:

```text
Quotation = CONFIRMED
Fulfillment = BACKORDER
Invoice = PARTIALLY_PAID
Subscription = ACTIVE
```

to coexist correctly.

---

# 5.36 Financial Calculation Strategy

The schema stores the current calculated quotation totals because they are needed frequently:

```text
subtotal
discount_total
tax_total
grand_total
margin_amount
margin_percent
```

However:

> These values are derived business values, not independently editable user fields.

The service/domain layer recalculates them when quotation lines or pricing inputs change.

The client must not be allowed to arbitrarily submit:

```text
grand_total = 100
```

and have the database accept it as authoritative.

---

# 5.37 Discount Calculation Persistence

For every quotation line, persist enough information to explain why the system made its current decision:

```text
discount_percent
allowed_discount_percent
discount_overage_percent
```

The current quotation additionally stores:

```text
blended_risk_score
risk_level
```

This makes the approval UI and audit trail explainable.

The exact blended-risk formula belongs to Section 6 and is intentionally not hardcoded into the schema.

---

# 5.38 Inventory Reservation Model

The core inventory invariant is:

```text
available =
    quantity_on_hand - quantity_reserved
```

When a fulfillment allocation reserves stock:

```text
BEGIN TRANSACTION

SELECT stock row FOR UPDATE

verify available >= requested

increment quantity_reserved

create fulfillment allocation

COMMIT
```

When a reservation is released because an allocation is cancelled or edited:

```text
decrement quantity_reserved
```

When inventory ships:

```text
decrement quantity_on_hand
decrement quantity_reserved
increment quantity_fulfilled
```

This prevents two concurrent fulfillment operations from allocating the same stock.

---

# 5.39 Delete Policy

Business records should generally use **soft deactivation**, not hard deletion.

Examples:

```text
users.is_active
products.is_active
categories.is_active
warehouses.is_active
discount_tiers.is_active
```

Historical transactional records must not disappear because a configuration object is deactivated.

Do not cascade-delete:

```text
Quotation
ApprovalRequest
ApprovalStep
NegotiationRequest
FulfillmentAllocation
Backorder
Invoice
Payment
CreditNote
AuditLog
DealHealthFlag
```

when a related configuration record is later deactivated.

---

# 5.40 Referential Integrity Policy

Recommended FK behaviour:

## Configuration records

Prefer:

```text
ON DELETE RESTRICT
```

for records referenced by transactional data.

Example:

```text
products → quotation_lines
warehouses → fulfillment_allocations
discount_tiers → customers
```

A product that appears in historical quotations should not be deleted.

Deactivate it instead.

## Transactional records

Prefer:

```text
ON DELETE RESTRICT
```

or carefully controlled soft-delete behaviour.

The business application should own lifecycle transitions rather than relying on destructive FK cascades.

---

# 5.41 Authorization-Critical Relationships

The schema must support these checks:

### Sales Rep

```text
quotation.sales_rep_id = authenticated_user.id
```

for operations restricted to own quotations.

### Customer

```text
authenticated_user.role = CUSTOMER

authenticated_user.customer_id = quotation.customer_id
```

for portal access.

### Manager

Approval action is allowed only when:

```text
approval_step.approver_user_id = authenticated_user.id
AND
approval_step.approval_level = MANAGER
AND
approval_step.status = PENDING
```

### Finance/Ops

Same principle for:

```text
approval_level = FINANCE
```

and operational fulfillment operations.

---

# 5.42 Transaction Boundaries

The following operations must be transactional.

## Create/submit quotation

```text
Create/update quote
+
calculate totals
+
calculate risk
+
create approval request if required
```

must not partially commit.

## Approval decision

```text
approve/reject/return step
+
update approval request
+
update quotation status
+
audit log
```

must commit atomically.

## Customer negotiation

```text
create negotiation request
+
update quotation/version
+
recalculate totals/risk
+
create approval request if required
+
audit log
```

must be treated as one business transaction where practical.

## Warehouse allocation

```text
lock stock
+
reserve stock
+
create allocations
+
create backorder if necessary
+
audit
```

must be transactional.

## Payment

```text
create payment
+
recalculate effective invoice balance
+
update invoice status
+
audit
```

must be atomic.

---

# 5.43 Recommended PostgreSQL Table Creation Order

For migrations, create tables in dependency order:

```text
1. users
2. discount_tiers
3. customers
4. categories
5. products
6. product_variants
7. category_discount_ceilings
8. price_list_entries
9. warehouses
10. replenishment_rules
11. quotations
12. quotation_lines
13. approval_requests
14. approval_steps
15. negotiation_requests
16. stock_levels
17. fulfillment_allocations
18. backorders
19. subscription_instances
20. invoices
21. payments
22. credit_notes
23. deal_health_flags
24. audit_logs
```

Circular FK relationships should be avoided unless there is a compelling reason.

---

# 5.44 Simplified SQL Skeleton

This is a structural reference, not the final migration file.

```sql
CREATE TABLE users (...);

CREATE TABLE discount_tiers (...);

CREATE TABLE customers (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    discount_tier_id UUID NOT NULL
        REFERENCES discount_tiers(id)
        ON DELETE RESTRICT,
    ...
);

CREATE TABLE categories (...);

CREATE TABLE products (
    id UUID PRIMARY KEY,
    category_id UUID NOT NULL
        REFERENCES categories(id)
        ON DELETE RESTRICT,
    ...
);

CREATE TABLE quotations (
    id UUID PRIMARY KEY,
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL
        REFERENCES customers(id)
        ON DELETE RESTRICT,
    sales_rep_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,
    status quotation_status NOT NULL,
    current_version INTEGER NOT NULL DEFAULT 1,
    ...
);

CREATE TABLE quotation_lines (
    id UUID PRIMARY KEY,
    quotation_id UUID NOT NULL
        REFERENCES quotations(id)
        ON DELETE RESTRICT,
    product_id UUID NOT NULL
        REFERENCES products(id)
        ON DELETE RESTRICT,
    ...
);

CREATE TABLE approval_requests (
    id UUID PRIMARY KEY,
    quotation_id UUID NOT NULL
        REFERENCES quotations(id)
        ON DELETE RESTRICT,
    quotation_version INTEGER NOT NULL,
    terms_snapshot JSONB NOT NULL,
    ...
);

CREATE TABLE approval_steps (
    id UUID PRIMARY KEY,
    approval_request_id UUID NOT NULL
        REFERENCES approval_requests(id)
        ON DELETE RESTRICT,
    ...
);

CREATE TABLE warehouses (...);

CREATE TABLE stock_levels (
    id UUID PRIMARY KEY,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity_on_hand NUMERIC(18,4) NOT NULL DEFAULT 0,
    quantity_reserved NUMERIC(18,4) NOT NULL DEFAULT 0,
    UNIQUE (warehouse_id, product_id)
);

CREATE TABLE fulfillment_allocations (...);

CREATE TABLE backorders (...);

CREATE TABLE subscription_instances (...);

CREATE TABLE invoices (...);

CREATE TABLE payments (...);

CREATE TABLE credit_notes (...);

CREATE TABLE deal_health_flags (...);

CREATE TABLE audit_logs (...);
```

The coding agent must turn this logical schema into the actual migration/ORM schema and then run migrations against PostgreSQL.

---

# 5.45 Seed Data Requirements

The database should ship with deterministic seed data sufficient to exercise the complete use-case flow.

Minimum configuration:

```text
Users:
    1 Admin
    1 Sales Rep
    1 Sales Manager
    1 Finance/Ops
    1 Customer portal user

Customer:
    Gold tier customer

Discount tiers:
    Bronze = 5%
    Silver = 10%
    Gold = 15%

Categories:
    Hardware
    Services
    Subscriptions

Category ceilings:
    Hardware = 15%
    Services = 10%

Products:
    Laptop
    Setup Service
    Docking Station
    Care Plan / Subscription

Warehouses:
    Main Warehouse
    East Depot
```

Minimum demonstration data should allow:

```text
Setup Service:
    18% requested discount
    10% allowed
    → approval

Laptop:
    12% requested discount
    15% allowed
    → within limit

Warehouse stock:
    distributed across Main + East
    → split fulfillment
    → backorder scenario

Subscription:
    recurring
    → recurring billing schedule
```

The exact sample prices and quantities remain seed-data decisions.

---

# 5.46 Data Integrity Scenarios the Schema Must Support

## Scenario A — Sales Rep edits discount

```text
quotation_lines.discount_percent changes
        ↓
quotation.current_version increments
        ↓
totals/risk recalculated
```

## Scenario B — Approval exists, then customer negotiates

```text
ApprovalRequest(v3)
        ↓
Customer negotiates
        ↓
Quotation(v4)
        ↓
New ApprovalRequest(v4)
```

The old request remains historical.

## Scenario C — Stock shortage

```text
Requested = 30
Available = 24

FulfillmentAllocation = 24
Backorder = 6
```

## Scenario D — Subscription modification

```text
SubscriptionInstance
        ↓
mid-cycle quantity/plan change
        ↓
proration calculation
        ↓
Invoice / CreditNote as applicable
```

## Scenario E — Deal Health alert

```text
Quotation
        ↓
DealHealthFlag(STALLED)
        ↓
Manager opens related quotation
        ↓
flag acknowledged/resolved
```

---

# 5.47 What the Database Must NOT Do

The database must not become the place where arbitrary business logic is hidden.

Do not:

- encode the entire approval workflow as dozens of database triggers
- let the frontend write final financial totals directly
- let users bypass role checks through direct API calls
- store manually entered approval state without an approval-step record
- maintain independent mutable `available_stock` that can drift from reservations
- delete historical approval or billing records
- overwrite past approval context when quotation terms change
- make Deal Health a single boolean field such as `quotation.is_at_risk`

Complex business rules belong in the application/domain layer, with the database enforcing integrity and concurrency.

---

# 5.48 Section 4 → Section 5 Traceability

| Section 4 Entity | Section 5 Table |
|---|---|
| User | `users` |
| Customer | `customers` |
| Category | `categories` |
| Product | `products` |
| ProductVariant | `product_variants` |
| DiscountTier | `discount_tiers` |
| CategoryDiscountCeiling | `category_discount_ceilings` |
| PriceListEntry | `price_list_entries` |
| Warehouse | `warehouses` |
| ReplenishmentRule | `replenishment_rules` |
| Quotation | `quotations` |
| QuotationLine | `quotation_lines` |
| ApprovalRequest | `approval_requests` |
| ApprovalStep | `approval_steps` |
| NegotiationRequest | `negotiation_requests` |
| StockLevel | `stock_levels` |
| FulfillmentAllocation | `fulfillment_allocations` |
| Backorder | `backorders` |
| SubscriptionInstance | `subscription_instances` |
| Invoice | `invoices` |
| Payment | `payments` |
| CreditNote | `credit_notes` |
| DealHealthFlag | `deal_health_flags` |
| AuditLog | `audit_logs` |

---

# 5.49 Coding-Agent Guardrails

1. PostgreSQL is the transactional source of truth.
2. Use UUID primary keys.
3. Use UTC `TIMESTAMPTZ` values.
4. Use fixed-precision numeric types for money; never floating-point.
5. Use separate state fields for quotation, approval, fulfillment, subscription, invoice, payment, and Deal Health.
6. Keep quotation as the central commercial aggregate.
7. Store current quotation totals as derived values maintained by application logic.
8. Preserve quotation version information.
9. Every approval cycle must reference the quotation version it evaluated.
10. Store an approval terms snapshot so historical approval context cannot be rewritten by later edits.
11. Do not let the frontend directly determine authoritative totals, risk, approval state, inventory, or payment status.
12. Use transactional inventory reservation with row-level locking.
13. Compute stock availability from on-hand minus reserved rather than maintaining a second mutable availability value.
14. Preserve line-level traceability from quotation → fulfillment → billing.
15. Do not hard-delete historical transactional data.
16. Use soft deactivation for configuration records where practical.
17. Enforce customer data isolation through both database relationships and service-layer authorization.
18. Enforce one primary role per user.
19. Do not create a many-to-many role model for MVP.
20. Do not use a separate Order table in MVP; confirmed quotation remains the commercial order representation.
21. Do not model Deal Health as one boolean or as a quotation status.
22. Use `deal_health_flags` as persistent exception data.
23. Audit important state-changing operations through append-only `audit_logs`.
24. Do not rely on database cascades to perform business workflows.
25. Use service-layer transactions for multi-table business operations.
26. Add indexes for ownership, state, queue, and dashboard access patterns.
27. Avoid unnecessary indexes until query patterns justify them.
28. Any schema addition must have a documented domain/use-case reason.
29. Section 6 will define the exact business calculations and state-transition rules; do not hardcode those rules into schema defaults or triggers.
30. Section 7 will define the API surface; APIs must operate on domain operations, not unrestricted CRUD over these tables.

---

# 5.50 Official Status

**SECTION 5 — DATABASE SCHEMA: LOCKED**

This schema is the persistence contract for DealFlow360.

Next:

> **6. Business Rules and State Transitions**

Section 6 must define the exact deterministic rules that operate on this schema, including discount calculation, blended-risk evaluation, automatic approval routing, quotation state transitions, negotiation re-approval, warehouse allocation, backorder behaviour, subscription proration, invoice/payment transitions, Deal Health detection, and audit requirements.
