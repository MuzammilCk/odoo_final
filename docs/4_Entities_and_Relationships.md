# DealFlow360 — Section 4: Entities and Relationships

> **Status:** OFFICIAL / LOCKED
>
> **Purpose:** Control file for the coding agent. Defines the core domain entities, their responsibilities, ownership, and relationships before database schema design.
>
> **Derived from:** Section 1 — Problem Restatement; Section 2 — Actors / Roles; Section 3 — Core Use Cases; DealFlow360 problem statement; DealFlow360 End-to-End Product Flow (Excalidraw).
>
> **Change policy:** Section 5 (Database Schema) must implement this domain model. Do not add/remove domain entities merely to make a UI easier to build. Any structural change must be justified against the use cases and explicitly revisited.

---

# 4.1 Domain Modeling Principle

The domain model is built around one central object:

> **Quotation = the live commercial business object.**

The quotation connects:

```text
Customer
   ↓
Quotation
   ├── Quotation Lines
   │      └── Product
   │             ├── Category
   │             ├── Price List
   │             └── Subscription properties
   │
   ├── Discount / Risk evaluation
   │      └── Approval Request → Approval Steps
   │
   ├── Customer Negotiation
   │      └── Negotiation Requests
   │
   ├── Fulfillment
   │      └── Warehouse → Stock → Fulfillment Allocations
   │
   ├── Recurring Billing
   │      └── Subscription Instance
   │
   ├── One-time / shipment billing
   │      └── Invoice → Payment
   │
   ├── Exceptions
   │      └── Deal Health Flags
   │
   └── Auditability
          └── Audit Log
```

The model intentionally separates the **commercial lifecycle** from downstream **fulfillment and billing lifecycles**, while keeping them linked to the originating quotation.

---

# 4.2 Entity Inventory

## Core entities

These are required to represent the main business model.

| Entity | Purpose |
|---|---|
| `User` | Authenticated internal or customer account with exactly one primary role |
| `Customer` | B2B buyer organization represented in quotations |
| `Category` | Product category used by catalog and discount governance |
| `Product` | Sellable product/service/subscription-capable item |
| `DiscountTier` | Customer-tier discount ceiling |
| `CategoryDiscountCeiling` | Category-specific discount ceiling |
| `Warehouse` | Physical fulfillment location |
| `StockLevel` | Per-warehouse, per-product inventory position |
| `Quotation` | Central live commercial business object |
| `QuotationLine` | Product/quantity/pricing/discount line inside a quotation |
| `ApprovalRequest` | Approval cycle for the current quotation version/terms |
| `ApprovalStep` | Individual Manager/Finance approval action |

## Operational / supporting entities

| Entity | Purpose |
|---|---|
| `PriceListEntry` | Customer-tier/currency-specific pricing rule |
| `ProductVariant` | Optional product attribute/value combinations with extra prices |
| `NegotiationRequest` | Customer-originated negotiation/change request |
| `FulfillmentAllocation` | Quantity allocated from a warehouse for a quotation/order |
| `Backorder` | Remaining quantity that could not be fulfilled immediately |
| `SubscriptionInstance` | Recurring subscription created from a subscription quotation line |
| `Invoice` | Billing record associated with fulfilled one-time quantities or recurring charges |
| `Payment` | Payment recorded against an invoice |
| `CreditNote` | Billing adjustment for applicable refunds/cancellations |
| `DealHealthFlag` | Detected operational/commercial risk or anomaly |
| `AuditLog` | Immutable record of important business actions |

## Configuration/support entity

| Entity | Purpose |
|---|---|
| `ReplenishmentRule` | Optional warehouse/product replenishment configuration |

### Scope note

The problem statement mentions subscription plans and replenishment rules, while the wireframe implements recurring behaviour directly on the Product form and does not provide a dedicated replenishment screen.

Therefore:

- `Product.is_subscription` + `Product.recurring_interval` are the current wireframe-aligned subscription configuration.
- `ReplenishmentRule` remains optional/supporting rather than a core MVP entity.
- Exact schema treatment of these implementation choices belongs in Section 5.

---

# 4.3 User

## Responsibility

Represents every authenticated account.

```text
User
 ├── ADMIN
 ├── SALES_REP
 ├── MANAGER
 ├── FINANCE_OPS
 └── CUSTOMER
```

Exactly one primary role is assigned to each user.

## Important relationships

A User can:

- own/manage quotations as a Sales Rep
- perform approval steps as Manager or Finance/Ops
- act on operational records as Finance/Ops
- be a customer portal account

For customer accounts:

```text
User(role = CUSTOMER)
        ↓
Customer
```

The exact one-to-one/one-to-many customer-account mapping will be finalized in Section 5, but the domain rule is:

> A customer portal identity is linked to a customer organization and cannot access another customer's data.

---

# 4.4 Customer

## Responsibility

Represents the external B2B buying organization.

## Relationships

```text
Customer
   ├── has → Customer Tier / DiscountTier
   ├── owns → Quotations
   └── has → Portal User(s)
```

A Customer may have multiple quotations.

A quotation belongs to exactly one customer.

```text
Customer 1 ──── * Quotation
```

The customer tier participates in discount governance.

---

# 4.5 DiscountTier

## Responsibility

Represents customer-level discount ceilings.

Example:

```text
Bronze → 5%
Silver → 10%
Gold   → 15%
```

## Relationship

```text
DiscountTier 1 ──── * Customer
```

A Customer has one applicable tier in the MVP.

A DiscountTier can be assigned to multiple customers.

---

# 4.6 Category

## Responsibility

Groups products and provides a dimension for category-specific discount governance.

Example:

```text
Hardware
Services
Subscriptions
```

## Relationships

```text
Category 1 ──── * Product

Category 1 ──── * CategoryDiscountCeiling
```

---

# 4.7 CategoryDiscountCeiling

## Responsibility

Defines the maximum additional discount allowed for a category under the configured governance policy.

Example:

```text
Hardware  → 15%
Services  → 10%
```

The effective discount decision considers the customer's tier and the product/category rules.

---

# 4.8 Product

## Responsibility

Represents the sellable catalog item.

The wireframe's Product Details screen includes:

- name
- category
- price
- unit
- tax
- description
- active/inactive status
- subscription yes/no
- recurring interval where applicable
- variants where applicable
- tier/currency price-list rules

## Relationships

```text
Category 1 ──── * Product

Product 1 ──── * QuotationLine

Product 1 ──── * StockLevel

Product 1 ──── * PriceListEntry

Product 1 ──── * ProductVariant
```

## Subscription property

The current wireframe treats recurring capability as a Product property:

```text
Product
  ├── is_subscription
  └── recurring_interval
```

So a separate mandatory `SubscriptionPlan` entity is **not required by the current implementation model**.

A `SubscriptionInstance` is created when a subscription-capable product is actually sold on a quotation.

---

# 4.9 ProductVariant

## Responsibility

Represents product attribute/value combinations that can change the product price.

Wireframe examples include:

```text
Color → Blue / Black
RAM   → 4GB / 8GB
Manufacturer → Dell / HP
```

Each attribute value can have an extra price.

## Relationship

```text
Product 1 ──── * ProductVariant
```

### Scope

This is an **only-if-time / supporting entity** for MVP because the core problem can be demonstrated without a deep variant engine, but the wireframe explicitly includes it.

---

# 4.10 PriceListEntry

## Responsibility

Defines customer-tier and currency-specific pricing rules that determine the base price visible to a customer tier.

Example from the wireframe:

```text
Bronze + USD → price, no adjustment
Gold + USD/EUR → price minus 10% base
```

## Relationship

```text
DiscountTier 1 ──── * PriceListEntry
Product      1 ──── * PriceListEntry
```

### Critical distinction

`PriceListEntry` and discount governance are different concepts.

```text
PriceListEntry
    ↓
Determines base commercial price

DiscountTier / CategoryDiscountCeiling
    ↓
Bounds additional rep-applied discount
```

They compound rather than replace each other.

---

# 4.11 Quotation — Central Entity

## Responsibility

The quotation is the **central live business object**.

It holds the current commercial terms and links the downstream business processes.

## Relationships

```text
Customer 1 ──── * Quotation

User(SALES_REP) 1 ──── * Quotation

Quotation 1 ──── * QuotationLine

Quotation 1 ──── * ApprovalRequest

Quotation 1 ──── * NegotiationRequest

Quotation 1 ──── * FulfillmentAllocation

Quotation 1 ──── * SubscriptionInstance

Quotation 1 ──── * Invoice

Quotation 1 ──── * DealHealthFlag

Quotation 1 ──── * AuditLog
```

## Lifecycle

The main quotation state is:

```text
DRAFT
   ↓
PENDING_APPROVAL   (if required)
   ↓
APPROVED
   ↓
UNDER_NEGOTIATION
   ↓
CONFIRMED
```

Exception:

```text
REJECTED
```

A confirmed quotation represents the commercial order in the current MVP model.

### Important decision: no separate Order entity in MVP

The source uses both “quotation” and “order” language. The wireframe, however, continues from the quotation into fulfillment and billing without a separate Order screen/entity.

Therefore:

> **For the MVP domain model, a CONFIRMED Quotation acts as the order record.**

This avoids duplicating the same commercial data in `Quotation` and `Order`.

If a later production version requires an independent order aggregate, that can be introduced deliberately, but it is not necessary for this build.

---

# 4.12 QuotationLine

## Responsibility

Represents one product/service line within a quotation.

It contains the commercial facts needed for quote evaluation, such as:

- product
- quantity
- price
- discount
- tax/derived totals
- line-level status/risk information

## Relationships

```text
Quotation 1 ──── * QuotationLine

Product 1 ──── * QuotationLine
```

Each quotation line belongs to exactly one quotation.

A product can appear on many quotation lines across many quotations.

## Why it is a separate entity

Discount governance operates **per line**, not only at the quotation level.

Example:

```text
Laptop → 12% → within limit

Setup Service → 18% → over service limit
```

The line therefore needs to preserve the exact commercial state that was evaluated.

---

# 4.13 ApprovalRequest

## Responsibility

Represents one approval cycle for a quotation's current commercial terms.

```text
Quotation
   ↓
ApprovalRequest
```

This is important because a quotation may require multiple approval cycles:

```text
Initial quote
   ↓
ApprovalRequest #1
   ↓
Customer negotiates
   ↓
Terms change
   ↓
ApprovalRequest #2
```

The approval request therefore represents an approval **instance**, not a permanent property of the quotation.

## Relationship

```text
Quotation 1 ──── * ApprovalRequest
```

---

# 4.14 ApprovalStep

## Responsibility

Represents one level inside an approval request.

Possible approver levels:

```text
MANAGER
FINANCE
```

## Relationship

```text
ApprovalRequest 1 ──── * ApprovalStep

ApprovalStep * ──── 1 User
```

The step also needs ordering so that:

```text
Manager
   ↓
Finance
```

can be enforced when required.

## Example

```text
ApprovalRequest #42
    ├── Step 1 → Manager
    └── Step 2 → Finance
```

---

# 4.15 NegotiationRequest

## Responsibility

Represents a customer-originated request to modify or discuss quotation terms.

The wireframe supports:

- line-level comment
- counter discount
- requested delivery date

The request can therefore contain one or more negotiation dimensions.

## Relationship

```text
Quotation 1 ──── * NegotiationRequest

Customer/User 1 ──── * NegotiationRequest
```

The Sales Rep responds to the negotiation from the internal workspace.

## Important rule

A negotiation request is not itself an approval.

Instead:

```text
NegotiationRequest
        ↓
Quotation changes
        ↓
Risk re-evaluation
        ↓
ApprovalRequest created if required
```

---

# 4.16 Warehouse

## Responsibility

Represents a physical stock location.

Examples:

```text
Main Warehouse
East Depot
```

## Relationships

```text
Warehouse 1 ──── * StockLevel

Warehouse 1 ──── * FulfillmentAllocation
```

Warehouse configuration can also carry the shipping-cost weighting used by allocation logic.

---

# 4.17 StockLevel

## Responsibility

Represents inventory for one Product in one Warehouse.

The wireframe explicitly distinguishes:

```text
In Stock
Reserved
Available
```

with:

```text
Available = In Stock - Reserved
```

## Relationship

```text
Warehouse 1 ──── * StockLevel
Product   1 ──── * StockLevel
```

There should be one logical stock position for:

```text
Warehouse × Product
```

## Important concurrency boundary

Stock is a concurrency-sensitive domain object because multiple fulfillment operations can compete for the same available inventory.

The exact locking and transaction strategy belongs to Section 5/6, but the entity must support safe reservation updates.

---

# 4.18 FulfillmentAllocation

## Responsibility

Records how much of a confirmed quotation is allocated to a particular warehouse.

Example:

```text
Q-1042

Main Warehouse → 18 units
East Depot     →  6 units
```

## Relationships

```text
Quotation 1 ──── * FulfillmentAllocation

Warehouse 1 ──── * FulfillmentAllocation

Product / QuotationLine 1 ──── * FulfillmentAllocation
```

The implementation should preserve which quotation line and quantity the allocation fulfills.

## Operational state

The wireframe uses states such as:

```text
SPLIT_PENDING
BACKORDER
FULFILLED
```

This is an operational state, not a quotation state.

---

# 4.19 Backorder

## Responsibility

Represents quantity that cannot currently be fulfilled.

Relationship:

```text
FulfillmentAllocation
        ↓
      Backorder
```

A backorder preserves the remaining quantity so it can be fulfilled later.

Example:

```text
Required = 30
Available = 24
       ↓
Fulfilled = 24
Backorder = 6
```

When stock becomes available:

```text
Backorder
   ↓
Consolidate Remaining Backorder
   ↓
Fulfilled
```

This is an operational entity rather than a new quotation state.

---

# 4.20 SubscriptionInstance

## Responsibility

Represents an actual recurring subscription created from a recurring quotation line.

The Product defines whether an item is subscription-capable; the SubscriptionInstance represents the customer's actual subscription.

## Relationships

```text
QuotationLine 1 ──── 0..1 SubscriptionInstance

Customer 1 ──── * SubscriptionInstance

Product 1 ──── * SubscriptionInstance
```

## Lifecycle

```text
ACTIVE
PAUSED
CANCELLED
```

The current wireframe explicitly includes **Paused**.

## Billing relationship

A SubscriptionInstance produces recurring billing activity, which results in invoices/payment records.

---

# 4.21 Invoice

## Responsibility

Represents a billing record.

The product includes both:

```text
One-time billing
+
Recurring billing
```

The invoice remains linked to the originating quotation/order context.

## Relationships

```text
Quotation 1 ──── * Invoice

Invoice 1 ──── * Payment

Invoice 0..1 ──── * CreditNote
```

### Wireframe-specific fulfillment relationship

The wireframe shows invoice/shipment reconciliation and illustrates one-time billing against what has actually shipped.

Therefore the implementation can associate an Invoice with the relevant fulfillment event/allocation.

This is an implementation choice derived from the wireframe, not an exact invoice cardinality mandated by the source.

---

# 4.22 Payment

## Responsibility

Represents a payment recorded against an invoice.

## Relationship

```text
Invoice 1 ──── * Payment
```

Example:

```text
Invoice = $2,730
Payment = $1,000
Payment = $1,730
```

This allows the invoice to move through:

```text
UNPAID
PARTIALLY_PAID
PAID
```

where required by the implementation.

---

# 4.23 CreditNote

## Responsibility

Represents a billing adjustment associated with applicable cancellations, refunds, or subscription changes.

## Relationships

```text
Invoice 1 ──── * CreditNote
SubscriptionInstance 1 ──── * CreditNote
```

Not every subscription change produces a credit note. The applicable business rule determines whether one is required.

---

# 4.24 DealHealthFlag

## Responsibility

Represents an exception detected by the Deal Health layer.

Required flag categories:

```text
STALLED
DISCOUNT_ANOMALY
DELIVERY_SLIPPAGE
```

## Relationship

```text
Quotation 1 ──── * DealHealthFlag
```

The flag should preserve enough context to identify the affected deal and the detection condition.

## Important architectural rule

DealHealthFlag does not create a new stage in the quotation lifecycle.

```text
Quotation lifecycle
       │
       └──── monitored in parallel
                    ↓
              DealHealthFlag
```

---

# 4.25 AuditLog

## Responsibility

Provides traceability for important business events.

The source specifically requires approval, rejection, and edit history with:

- user
- timestamp
- reason

The audit model should therefore capture important actions such as:

```text
Quotation edited
Discount changed
Approval submitted
Approval approved
Approval rejected
Approval returned
Negotiation submitted
Quotation confirmed
Warehouse allocation changed
Backorder created
Subscription modified
Credit note created
Payment recorded
Deal Health escalation/nudge
```

## Relationships

AuditLog should reference:

```text
Actor/User
+
Affected entity/resource
```

The exact polymorphic/reference strategy belongs to Section 5.

### Important property

Audit entries should be append-only from the application's perspective.

---

# 4.26 ReplenishmentRule

## Responsibility

Optional configuration for deciding when a warehouse/product combination needs replenishment.

The source mentions replenishment rules, but the current wireframe does not provide a dedicated configuration screen.

Therefore:

> This entity is optional and must not block the core quote-to-cash workflow.

---

# 4.27 Complete Domain Relationship Map

```text
                              ┌───────────────┐
                              │     User      │
                              │  one role     │
                              └───────┬───────┘
                                      │
                     ┌────────────────┼──────────────────┐
                     │                │                  │
                     ▼                ▼                  ▼
               Sales Rep          Approver         Customer Portal
                     │                │                  │
                     │                │                  ▼
                     │                │              Customer
                     │                │                  │
                     │                │          ┌───────┴───────┐
                     │                │          ▼               ▼
                     │                │   DiscountTier      Quotations
                     │                │                          │
                     │                │                          ▼
                     │                │                  QuotationLines
                     │                │                     │       │
                     │                │                     │       ▼
                     │                │                     │    Product
                     │                │                     │       │
                     │                │                     ├───────┼──────────┐
                     │                │                     │       │          │
                     │                │                     ▼       ▼          ▼
                     │                │                Category  PriceList  Subscription
                     │                │                     │      Entry      fields
                     │                │                     ▼                   │
                     │                │             Category Discount          ▼
                     │                │                 Ceiling         SubscriptionInstance
                     │                │
                     │                └────────────┐
                     │                             ▼
                     │                     ApprovalRequest
                     │                             │
                     │                             ▼
                     │                       ApprovalStep
                     │
                     └──────────────┐
                                    ▼
                              Quotation
                                    │
             ┌──────────────────────┼──────────────────────────┐
             │                      │                          │
             ▼                      ▼                          ▼
      NegotiationRequest      FulfillmentAllocation       DealHealthFlag
                                      │
                           ┌──────────┴──────────┐
                           ▼                     ▼
                       Warehouse              Backorder
                           │
                        StockLevel
                           │
                        Product

                              Quotation
                                    │
                                    ▼
                                  Invoice
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
                       Payment            CreditNote

                              All important actions
                                      │
                                      ▼
                                  AuditLog
```

---

# 4.28 Cardinality Summary

| Relationship | Cardinality |
|---|---|
| Customer → Quotation | 1 : many |
| Sales Rep/User → Quotation | 1 : many |
| DiscountTier → Customer | 1 : many |
| Category → Product | 1 : many |
| Category → CategoryDiscountCeiling | 1 : many |
| Product → QuotationLine | 1 : many |
| Quotation → QuotationLine | 1 : many |
| Quotation → ApprovalRequest | 1 : many |
| ApprovalRequest → ApprovalStep | 1 : many |
| User → ApprovalStep | 1 : many |
| Quotation → NegotiationRequest | 1 : many |
| Customer/User → NegotiationRequest | 1 : many |
| Warehouse → StockLevel | 1 : many |
| Product → StockLevel | 1 : many |
| Quotation → FulfillmentAllocation | 1 : many |
| Warehouse → FulfillmentAllocation | 1 : many |
| FulfillmentAllocation → Backorder | 0..1 : many/implementation-dependent |
| QuotationLine → SubscriptionInstance | 1 : 0..1 |
| Customer → SubscriptionInstance | 1 : many |
| Quotation → Invoice | 1 : many |
| Invoice → Payment | 1 : many |
| Invoice → CreditNote | 1 : many |
| Quotation → DealHealthFlag | 1 : many |
| User → AuditLog | 1 : many |

---

# 4.29 Deliberate Non-Entities / Concepts

The following are important concepts but **do not need their own entity in the current MVP**:

### Approval status

It belongs to the quotation/approval workflow and is derived from ApprovalRequest + ApprovalStep state.

### Blended risk score

It is a calculated property of the current quotation evaluation, not a standalone business entity.

### Margin

It is calculated from quotation/product/price/discount/cost information rather than being a standalone core entity.

### Deal Health

The dashboard itself is a module/view. The persistent domain object is `DealHealthFlag`.

### Sales Dashboard

A UI/dashboard view, not a domain entity.

### Reports

A reporting/query concern over operational data, not a transactional entity.

### Order

The MVP uses a `CONFIRMED` Quotation as the order representation to avoid duplicate commercial state.

---

# 4.30 Important Domain Invariants

These invariants must remain true when Section 5 is implemented:

1. A quotation belongs to exactly one customer.
2. A quotation has one responsible Sales Rep in the MVP.
3. A quotation contains one or more quotation lines when submitted for approval/confirmation.
4. Every quotation line references one product.
5. Every product belongs to a category.
6. A customer's discount tier participates in discount governance.
7. Category discount ceilings participate in line-level discount evaluation.
8. An approval request belongs to one quotation and represents one approval cycle.
9. An approval request may contain multiple ordered approval steps.
10. An approval step is assigned to an eligible approver.
11. Customer negotiation requests belong to a quotation.
12. Customers may only create/view negotiation activity for their own quotations.
13. Stock is tracked per warehouse and product.
14. Available stock must represent the quantity actually available for allocation.
15. Fulfillment allocations must trace back to the quotation and its relevant lines.
16. Backorders represent unmet fulfillment quantity rather than a new commercial quotation.
17. Subscription instances originate from subscription-capable quotation lines.
18. Invoices trace back to the commercial order/quotation context.
19. Payments belong to invoices.
20. Deal Health flags reference an affected deal and do not change the quotation lifecycle by themselves.
21. Important business actions produce audit records.
22. No entity should duplicate the same business truth in two unrelated places.

---

# 4.31 Coding-Agent Guardrails

1. Model the domain around business objects, not screens.
2. Treat `Quotation` as the central live commercial object.
3. Do not create a separate `Order` table for the MVP unless a future design review explicitly requires it.
4. Keep quotation state separate from fulfillment state and billing state.
5. Keep `ApprovalRequest` separate from `Quotation` because one quotation can undergo multiple approval cycles.
6. Keep `ApprovalStep` separate from `ApprovalRequest` because approval can have Manager and Finance levels.
7. Keep `NegotiationRequest` separate from quotation state.
8. Keep `FulfillmentAllocation` separate from quotation state.
9. Keep inventory at Warehouse × Product through `StockLevel`.
10. Do not calculate fulfillment from raw product-level stock alone.
11. Keep `SubscriptionInstance` separate from the Product's subscription capability.
12. Keep one-time and recurring billing traceable to the same confirmed commercial context.
13. Do not make Deal Health a quotation-state enum.
14. Do not make the Deal Health dashboard the source of truth for risk.
15. Store important decisions/actions through `AuditLog`.
16. Do not duplicate product pricing, customer tier rules, or discount rules inside arbitrary UI records.
17. Preserve ownership relationships required by Section 2 for authorization.
18. Preserve the ability to distinguish the current quotation terms from earlier approval cycles.
19. Preserve line-level traceability from quotation → fulfillment → billing.
20. Every future schema field should have a domain reason documented by an entity/use case, not merely a UI reason.

---

# 4.32 Official Status

**SECTION 4 — ENTITIES AND RELATIONSHIPS: LOCKED**

Section 5 must translate this domain model into a concrete relational database schema.

Next:

> **5. Database Schema**

Section 5 must define tables, columns, data types, primary/foreign keys, constraints, indexes, uniqueness rules, and transaction/concurrency-sensitive fields while preserving every relationship and invariant defined here.
