# DealFlow360 — Section 7: API Surface / Operations

> **Status:** OFFICIAL / LOCKED
>
> **Purpose:** Control file for the coding agent. Defines the HTTP/API operation surface that exposes the locked use cases and business rules without bypassing authorization, state transitions, versioning, concurrency, or audit requirements.
>
> **Derived from:** Sections 1–6 + DealFlow360 problem statement + DealFlow360 End-to-End Product Flow (Excalidraw).
>
> **Core principle:** APIs expose **business operations**, not unrestricted database CRUD.
>
> **Change policy:** Any new endpoint must map to a defined use case or explicitly justified supporting operation. Endpoint implementation must call the domain/service layer rather than duplicating business logic inside controllers.

---

# 7.1 API Design Principles

DealFlow360 uses an API-first internal architecture:

```text
Client
  ↓
HTTP API
  ↓
Authentication / Authorization
  ↓
Application Service / Domain Operation
  ↓
Transaction
  ↓
PostgreSQL
  ↓
Audit / Side Effects
```

The API layer is responsible for:

- parsing input
- authentication
- authorization
- request validation
- calling the correct application/domain operation
- returning the resulting state

The API layer is **not** responsible for independently implementing:

- discount calculations
- blended risk scoring
- approval routing
- warehouse allocation
- proration
- Deal Health detection

Those belong to the service/domain layer defined in Section 6.

---

# 7.2 API Namespace

Recommended REST namespace:

```text
/api/v1
```

Public application boundaries:

```text
/api/v1/auth/*
/api/v1/internal/*
/api/v1/portal/*
```

The exact frontend route is separate from the API route.

Example:

```text
Internal UI:
 /app/*

Customer UI:
 /portal/*
```

API:

```text
/api/v1/internal/*
/api/v1/portal/*
```

---

# 7.3 Authentication APIs

## 7.3.1 Login

```http
POST /api/v1/auth/login
```

### Request

```json
{
  "email": "rep@example.com",
  "password": "..."
}
```

### Response

```json
{
  "user": {
    "id": "uuid",
    "email": "rep@example.com",
    "role": "SALES_REP"
  },
  "accessToken": "..."
}
```

### Rules

- Authenticate credentials.
- Return exactly one primary role.
- Create authenticated session/token.
- Do not return internal-sensitive data for CUSTOMER users.
- Log successful/failed authentication only according to the application's security logging policy.

---

# 7.4 Current User

```http
GET /api/v1/auth/me
```

Returns:

```json
{
  "id": "uuid",
  "email": "rep@example.com",
  "role": "SALES_REP",
  "customerId": null
}
```

For a customer:

```json
{
  "id": "uuid",
  "email": "buyer@example.com",
  "role": "CUSTOMER",
  "customerId": "uuid"
}
```

---

# 7.5 Logout

```http
POST /api/v1/auth/logout
```

The exact implementation depends on whether access tokens are stateless or backed by server sessions/refresh tokens.

The endpoint must invalidate the authenticated session where the chosen authentication strategy requires server-side invalidation.

---

# 7.6 Internal Dashboard APIs

## Sales Dashboard

```http
GET /api/v1/internal/dashboard
```

Returns summary data such as:

```text
pending approvals
open quotations
at-risk deals
recent activity
```

This endpoint is a **read-model/dashboard operation**, not the source of truth for those domains.

## Important navigation relationship

The Sales Dashboard may expose:

```text
At-Risk Deals
      ↓
Deal Health Dashboard
```

This is a navigation relationship.

It must not create a business transition:

```text
Sales Rep → Deal Health
```

---

# 7.7 Product APIs

## List products

```http
GET /api/v1/internal/products
```

Supported filters:

```text
category
isActive
isSubscription
search
```

## Get product

```http
GET /api/v1/internal/products/:productId
```

## Create product

```http
POST /api/v1/internal/products
```

### Allowed role

```text
ADMIN
```

## Update product

```http
PATCH /api/v1/internal/products/:productId
```

### Allowed role

```text
ADMIN
```

### Rule

Do not allow product updates to rewrite historical quotation line snapshots.

---

# 7.8 Product Variant APIs

```http
POST  /api/v1/internal/products/:productId/variants
GET   /api/v1/internal/products/:productId/variants
PATCH /api/v1/internal/products/:productId/variants/:variantId
```

### Allowed role

```text
ADMIN
```

---

# 7.9 Price List APIs

## List prices

```http
GET /api/v1/internal/price-lists/entries
```

Filters:

```text
product
discountTier
currency
```

## Create price rule

```http
POST /api/v1/internal/price-lists/entries
```

## Update price rule

```http
PATCH /api/v1/internal/price-lists/entries/:entryId
```

### Allowed role

```text
ADMIN
```

The API must enforce uniqueness for:

```text
product + discount tier + currency
```

---

# 7.10 Discount Tier APIs

## List tiers

```http
GET /api/v1/internal/discount-tiers
```

## Create tier

```http
POST /api/v1/internal/discount-tiers
```

### Allowed

```text
ADMIN
MANAGER
```

## Update tier

```http
PATCH /api/v1/internal/discount-tiers/:tierId
```

### Allowed

```text
ADMIN
MANAGER
```

---

# 7.11 Category Discount Ceiling APIs

```http
GET  /api/v1/internal/discount-rules/categories
POST /api/v1/internal/discount-rules/categories
PATCH /api/v1/internal/discount-rules/categories/:ruleId
```

### Allowed roles

```text
ADMIN
MANAGER
```

---

# 7.12 Approval Configuration APIs

## View approval configuration

```http
GET /api/v1/internal/approval-config
```

## Update approval configuration

```http
PUT /api/v1/internal/approval-config
```

### Allowed roles

```text
ADMIN
MANAGER
```

The API must not permit SALES_REP to change the rules that evaluate their quotations.

---

# 7.13 Warehouse APIs

## List warehouses

```http
GET /api/v1/internal/warehouses
```

## Create warehouse

```http
POST /api/v1/internal/warehouses
```

## Update warehouse

```http
PATCH /api/v1/internal/warehouses/:warehouseId
```

### Allowed role

```text
ADMIN
```

---

# 7.14 Stock APIs

## View stock

```http
GET /api/v1/internal/stock
```

Filters:

```text
productId
warehouseId
```

## Get product stock across warehouses

```http
GET /api/v1/internal/products/:productId/stock
```

Response should expose operational values such as:

```json
{
  "productId": "uuid",
  "warehouses": [
    {
      "warehouseId": "uuid",
      "quantityOnHand": 20,
      "quantityReserved": 5,
      "available": 15
    }
  ]
}
```

`available` is derived:

```text
available = onHand - reserved
```

The API must not accept client-provided `available` as authoritative.

---

# 7.15 Subscription Configuration APIs

```http
GET /api/v1/internal/subscription-config
PUT /api/v1/internal/subscription-config
```

### Allowed role

```text
ADMIN
```

The configuration includes supported recurring plans/rules and applicable proration/cancellation behavior.

---

# 7.16 Quotation APIs

Quotation APIs are the most important part of DealFlow360.

---

## 7.16.1 List quotations

```http
GET /api/v1/internal/quotations
```

Filters:

```text
status
salesRepId
customerId
dateFrom
dateTo
search
```

### Authorization

```text
SALES_REP
→ quotations in permitted scope, normally own quotations

MANAGER
→ quotations needed for approval/oversight

FINANCE_OPS
→ quotations needed for assigned operational work

ADMIN
→ platform-wide scope
```

The service layer must enforce the actual data scope.

---

# 7.17 Create quotation

```http
POST /api/v1/internal/quotations
```

### Request

```json
{
  "customerId": "uuid",
  "currencyCode": "USD",
  "lines": [
    {
      "productId": "uuid",
      "productVariantId": null,
      "quantity": 10,
      "discountPercent": 5
    }
  ]
}
```

### Server responsibilities

```text
validate customer
validate products
resolve price list
calculate prices
calculate discounts
calculate taxes
calculate margin
calculate risk
set initial version
create quotation
create lines
audit creation
```

The client cannot submit authoritative:

```text
grandTotal
margin
riskScore
approvalStatus
```

---

# 7.18 Get quotation

```http
GET /api/v1/internal/quotations/:quotationId
```

Response should include:

```text
quotation metadata
customer
sales rep
current version
lines
totals
margin
risk
approval summary
negotiation summary
fulfillment summary
billing summary where relevant
```

This is an aggregate/detail endpoint.

---

# 7.19 Add quotation line

```http
POST /api/v1/internal/quotations/:quotationId/lines
```

### Allowed

```text
SALES_REP
```

subject to quotation state and ownership.

### Server process

```text
load quotation
check editable state
resolve product/pricing
add line
increment quotation version
recalculate totals/margin/risk
refresh recommendation state
audit
```

---

# 7.20 Update quotation line

```http
PATCH /api/v1/internal/quotations/:quotationId/lines/:lineId
```

Supported changes:

```text
quantity
discount
variant
```

The server must:

```text
validate state
recalculate all affected values
increment version for material changes
re-evaluate approval
```

---

# 7.21 Remove quotation line

```http
DELETE /api/v1/internal/quotations/:quotationId/lines/:lineId
```

Only while the quotation is editable.

This is a business operation even though it uses HTTP DELETE.

The system must not physically destroy useful historical information once a quotation has entered an auditable lifecycle. For a submitted quotation, use a controlled revision/version approach rather than destroying the historical commercial version.

---

# 7.22 Recalculate quotation

```http
POST /api/v1/internal/quotations/:quotationId/recalculate
```

This can be used when the frontend requests an explicit authoritative refresh.

The server recomputes:

```text
prices
discount amounts
tax
totals
margin
risk
```

The operation must not trust frontend calculations.

---

# 7.23 Submit quotation

```http
POST /api/v1/internal/quotations/:quotationId/submit
```

### Server flow

```text
validate quotation
      ↓
calculate current totals/risk
      ↓
determine approval requirement
      ↓
if approval required:
    create ApprovalRequest
    create ApprovalSteps
    quotation = PENDING_APPROVAL
else:
    quotation can proceed toward customer visibility
```

Everything must happen atomically.

---

# 7.24 Send quotation to customer

```http
POST /api/v1/internal/quotations/:quotationId/send
```

### Preconditions

```text
quotation valid
approval complete when required
customer-visible terms exist
```

Then:

```text
customer_visible_at = now
```

The customer can now access the quotation through the portal.

---

# 7.25 Approval APIs

## List approval queue

```http
GET /api/v1/internal/approvals
```

Filters:

```text
status
approvalLevel
assignee
quotation
```

## Get approval request

```http
GET /api/v1/internal/approvals/:approvalRequestId
```

Returns:

```text
quotation version
risk score
risk level
terms snapshot
approval steps
audit information
```

---

# 7.26 Approve Step

```http
POST /api/v1/internal/approvals/:approvalRequestId/steps/:stepId/approve
```

### Server validates

```text
authenticated role
assigned approver
step pending
quotation version still matches
previous approval steps complete
```

Then:

```text
step = APPROVED

if another step exists:
    next step becomes actionable

else:
    approval request = APPROVED
    quotation = APPROVED
```

Write:

```text
AuditLog(APPROVAL_APPROVED)
```

All changes occur in one transaction.

---

# 7.27 Reject Step

```http
POST /api/v1/internal/approvals/:approvalRequestId/steps/:stepId/reject
```

Request:

```json
{
  "reason": "Discount exceeds acceptable service margin."
}
```

Result:

```text
step = REJECTED
approval request = REJECTED
quotation = REJECTED
```

Audit required.

---

# 7.28 Return Quotation for Revision

```http
POST /api/v1/internal/approvals/:approvalRequestId/steps/:stepId/return
```

Request:

```json
{
  "reason": "Reduce service discount and resubmit."
}
```

Result:

```text
step = RETURNED
approval request = RETURNED
quotation becomes editable
```

The next material revision must receive a new version and new governance evaluation.

---

# 7.29 Recommendation APIs

## Get recommendations for quotation

```http
GET /api/v1/internal/quotations/:quotationId/recommendations
```

The service evaluates:

```text
current quote
co-purchase relationships
promotions
minimum margin
```

and returns ranked candidates.

## Accept recommendation

```http
POST /api/v1/internal/quotations/:quotationId/recommendations/:productId/accept
```

Result:

```text
add product as quote line
recalculate quote
recalculate margin
recalculate risk
increment version
audit
```

## Dismiss recommendation

```http
POST /api/v1/internal/quotations/:quotationId/recommendations/:productId/dismiss
```

Dismissal does not modify the quotation commercial terms.

---

# 7.30 Customer Portal APIs

Customer APIs must be isolated under:

```text
/api/v1/portal/*
```

A CUSTOMER token must not be able to invoke internal endpoints.

---

# 7.31 Customer Quotation List

```http
GET /api/v1/portal/quotations
```

Returns only quotations belonging to:

```text
authenticated_user.customer_id
```

Never accept:

```text
customerId
```

as an authorization override from the client.

---

# 7.32 Customer Quotation Detail

```http
GET /api/v1/portal/quotations/:quotationId
```

Server verifies:

```text
quotation.customer_id
=
authenticated_user.customer_id
```

Response must expose only customer-safe information.

Do not expose:

```text
internal margin
estimated cost
internal risk formula
internal approval notes
internal anomaly information
warehouse internal operational data
```

---

# 7.33 Customer Negotiation Request

```http
POST /api/v1/portal/quotations/:quotationId/negotiations
```

Request example:

```json
{
  "type": "COUNTER_DISCOUNT",
  "quotationLineId": "uuid",
  "requestedDiscountPercent": 20,
  "message": "Can you improve the discount for the support package?"
}
```

Other types:

```text
LINE_COMMENT
CHANGE_REQUEST
DELIVERY_DATE_REQUEST
```

The server must verify:

```text
customer owns quotation
line belongs to quotation
customer is authorized
```

The negotiation itself does not bypass approval.

---

# 7.34 Customer Confirm Quotation

```http
POST /api/v1/portal/quotations/:quotationId/confirm
```

Server performs:

```text
authenticate customer
verify ownership
verify customer-visible quotation
verify current quotation state
verify current approval validity
verify no stale approval
```

If valid:

```text
quotation = CONFIRMED
```

If approval is stale:

```text
confirmation rejected
re-evaluation required
```

Create audit event.

---

# 7.35 Fulfillment APIs

## List fulfillment work

```http
GET /api/v1/internal/fulfillment
```

## Get fulfillment detail

```http
GET /api/v1/internal/fulfillment/:quotationId
```

These are operational views over allocations/backorders.

---

# 7.36 Generate Warehouse Recommendation

```http
POST /api/v1/internal/fulfillment/:quotationId/recommend
```

### Allowed role

```text
FINANCE_OPS
```

The service:

```text
load confirmed quotation
load current stock
lock relevant stock rows during final allocation/reservation transaction
calculate recommended split
estimate shipments/cost
```

A pure recommendation preview may run without reservation, but the authoritative acceptance/reservation step must be transactional.

---

# 7.37 Accept Warehouse Split

```http
POST /api/v1/internal/fulfillment/:quotationId/accept
```

### Allowed role

```text
FINANCE_OPS
```

Server transaction:

```text
BEGIN
  lock stock rows
  recompute availability
  create allocations
  reserve stock
  create backorders if required
  audit
COMMIT
```

Never reserve based on a frontend-provided quantity without rechecking current stock.

---

# 7.38 Manual Warehouse Override

```http
POST /api/v1/internal/fulfillment/:quotationId/override
```

Request:

```json
{
  "allocations": [
    {
      "quotationLineId": "uuid",
      "warehouseId": "uuid",
      "quantity": 12
    }
  ]
}
```

The server validates:

```text
allocation quantity
stock availability
quotation state
warehouse validity
```

Then executes the same transactional reservation logic.

---

# 7.39 Consolidate Backorder

```http
POST /api/v1/internal/backorders/:backorderId/consolidate
```

### Allowed role

```text
FINANCE_OPS
```

Server:

```text
lock stock
check new availability
allocate newly available quantity
reduce remaining backorder
update fulfillment state
audit
```

---

# 7.40 Subscription APIs

## List subscriptions

```http
GET /api/v1/internal/subscriptions
```

## Get subscription

```http
GET /api/v1/internal/subscriptions/:subscriptionId
```

## Pause subscription

```http
POST /api/v1/internal/subscriptions/:subscriptionId/pause
```

## Resume subscription

```http
POST /api/v1/internal/subscriptions/:subscriptionId/resume
```

## Cancel subscription

```http
POST /api/v1/internal/subscriptions/:subscriptionId/cancel
```

### Allowed role

```text
FINANCE_OPS
```

The exact allowed roles can be expanded later, but must be explicitly authorized.

---

# 7.41 Modify Subscription

```http
POST /api/v1/internal/subscriptions/:subscriptionId/modify
```

Request:

```json
{
  "quantity": 15,
  "plan": "MONTHLY"
}
```

Server calculates:

```text
remaining period
old rate
new rate
proration
```

Then creates the correct billing consequence.

---

# 7.42 Invoice APIs

## List invoices

```http
GET /api/v1/internal/invoices
```

Filters:

```text
status
quotationId
subscriptionId
customerId
dateFrom
dateTo
```

## Get invoice

```http
GET /api/v1/internal/invoices/:invoiceId
```

## Create invoice

```http
POST /api/v1/internal/invoices
```

This operation must normally be called by a billing domain service rather than manually by arbitrary users.

Where exposed as an endpoint, authorization should be restricted to the appropriate Finance/Ops/system role.

The endpoint must recalculate authoritative invoice values.

---

# 7.43 Payment APIs

## Record payment

```http
POST /api/v1/internal/invoices/:invoiceId/payments
```

Request:

```json
{
  "amount": 1000,
  "currencyCode": "USD",
  "paymentReference": "PAY-10021"
}
```

Server:

```text
validate amount
validate currency
validate invoice
ensure payment reference is unique
create payment
recalculate balance
update invoice status
audit
```

---

# 7.44 Reverse Payment

```http
POST /api/v1/internal/payments/:paymentId/reverse
```

Server:

```text
payment = REVERSED
recalculate invoice balance
recalculate invoice status
audit
```

Do not delete the payment row.

---

# 7.45 Credit Note APIs

```http
GET  /api/v1/internal/credit-notes
POST /api/v1/internal/credit-notes
GET  /api/v1/internal/credit-notes/:creditNoteId
POST /api/v1/internal/credit-notes/:creditNoteId/issue
```

These are operationally restricted to Finance/Ops or other explicitly authorized internal actors.

---

# 7.46 Deal Health APIs

Deal Health is a monitoring layer.

## Dashboard

```http
GET /api/v1/internal/deal-health
```

Filters:

```text
type
status
severity
salesRepId
dateFrom
dateTo
```

## Get flag

```http
GET /api/v1/internal/deal-health/:flagId
```

---

# 7.47 Run Deal Health Evaluation

```http
POST /api/v1/internal/deal-health/evaluate
```

This operation may be called:

- manually by an authorized manager/admin
- by a scheduled background job

It evaluates:

```text
stalled deals
discount anomalies
delivery slippage
```

The service must use the same domain rules regardless of invocation method.

The operation must deduplicate active identical flags.

---

# 7.48 Deal Health Actions

## Nudge

```http
POST /api/v1/internal/deal-health/:flagId/nudge
```

## Escalate

```http
POST /api/v1/internal/deal-health/:flagId/escalate
```

## Resolve

```http
POST /api/v1/internal/deal-health/:flagId/resolve
```

## Dismiss

```http
POST /api/v1/internal/deal-health/:flagId/dismiss
```

The action must be authorized and audited.

---

# 7.49 Reporting APIs

## Summary report

```http
GET /api/v1/internal/reports/sales-summary
```

Filters:

```text
period
salesTeam
salesRep
approvalStatus
product
category
```

## Approval report

```http
GET /api/v1/internal/reports/approvals
```

## Product report

```http
GET /api/v1/internal/reports/products
```

## Deal Health report

```http
GET /api/v1/internal/reports/deal-health
```

## Export

```http
GET /api/v1/internal/reports/export
```

Query parameters:

```text
format=pdf
format=xls
```

The exact export implementation is a technology choice, but the API must produce data from the operational source of truth.

---

# 7.50 Audit APIs

Audit records should normally be **read-only**.

## Quotation audit trail

```http
GET /api/v1/internal/quotations/:quotationId/audit-log
```

## Entity audit trail

```http
GET /api/v1/internal/audit-logs
```

Filters:

```text
actor
action
entityType
entityId
quotationId
dateFrom
dateTo
```

No public create/update/delete endpoint should exist for arbitrary audit entries.

Audit entries are generated by domain operations.

---

# 7.51 API Error Model

Use a consistent error response:

```json
{
  "error": {
    "code": "QUOTATION_APPROVAL_STALE",
    "message": "The quotation has changed since the last approval.",
    "details": {
      "quotationId": "uuid",
      "currentVersion": 4,
      "approvedVersion": 3
    },
    "requestId": "uuid"
  }
}
```

Recommended error classes:

```text
AUTHENTICATION_REQUIRED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
INVALID_STATE
STALE_VERSION
BUSINESS_RULE_VIOLATION
APPROVAL_REQUIRED
APPROVAL_STALE
INSUFFICIENT_STOCK
DUPLICATE_OPERATION
CONCURRENCY_CONFLICT
```

Do not return internal stack traces to clients.

---

# 7.52 HTTP Status Guidance

```text
200 OK
    successful read/action

201 CREATED
    new business resource created

202 ACCEPTED
    optional for asynchronous operations

204 NO CONTENT
    successful operation with no response body

400 BAD REQUEST
    malformed request

401 UNAUTHORIZED
    no valid authentication

403 FORBIDDEN
    authenticated but not authorized

404 NOT FOUND
    resource does not exist or is intentionally hidden

409 CONFLICT
    state/concurrency/idempotency conflict

422 UNPROCESSABLE ENTITY
    domain validation failure

500 INTERNAL SERVER ERROR
    unexpected server failure
```

Do not use `200` for failed business operations just because the HTTP request itself was syntactically valid.

---

# 7.53 Optimistic Concurrency

For mutable quotation operations, support a version check.

Example request:

```http
PATCH /api/v1/internal/quotations/{id}/lines/{lineId}
If-Match: "4"
```

or:

```json
{
  "expectedVersion": 4,
  "quantity": 12
}
```

Server:

```text
expectedVersion == quotation.current_version
```

If not:

```text
409 CONFLICT
```

This prevents two editing clients from silently overwriting one another.

---

# 7.54 Idempotency

For operations with irreversible or financial side effects, support an idempotency key.

Example:

```http
POST /api/v1/internal/invoices/:invoiceId/payments
Idempotency-Key: 5d1...
```

Recommended for:

```text
payment recording
customer confirmation
invoice creation
warehouse allocation acceptance
backorder consolidation
approval actions
```

The implementation can use either:

```text
dedicated idempotency table
```

or another reliable persistence strategy.

---

# 7.55 API Authorization Matrix

| Endpoint family | Admin | Sales Rep | Manager | Finance/Ops | Customer |
|---|:---:|:---:|:---:|:---:|:---:|
| `/auth/*` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/internal/products/*` | ✓ | Read* | Read* | Read* | ✗ |
| `/internal/price-lists/*` | ✓ | Read* | Read* | Read* | ✗ |
| `/internal/discount-tiers/*` | ✓ | ✗ | ✓ | ✗ | ✗ |
| `/internal/approval-config/*` | ✓ | ✗ | ✓ | ✗ | ✗ |
| `/internal/warehouses/*` | ✓ | Read* | Read* | Read | ✗ |
| `/internal/stock/*` | ✓ | Read | Read | ✓ | ✗ |
| `/internal/quotations/*` | ✓* | ✓** | Read/Review | Operational | ✗ |
| `/internal/approvals/*` | Read* | ✗ | ✓ | ✓ when Finance step | ✗ |
| `/internal/recommendations/*` | Read* | ✓ | ✗ | ✗ | ✗ |
| `/internal/fulfillment/*` | Read* | Read | Read | ✓ | ✗ |
| `/internal/subscriptions/*` | Read* | Read | Read | ✓ | ✗ |
| `/internal/invoices/*` | Read* | Read | Read | ✓ | ✗ |
| `/internal/payments/*` | Read* | ✗ | ✗ | ✓ | ✗ |
| `/internal/deal-health/*` | ✓ | Own-deal read only if later enabled | ✓ | ✗ | ✗ |
| `/internal/reports/*` | ✓ | Limited | ✓ | Operational | ✗ |
| `/internal/audit-logs/*` | ✓ | Own-scope where permitted | ✓ | Relevant scope | ✗ |
| `/portal/quotations/*` | ✗ | ✗ | ✗ | ✗ | Own customer only |
| `/portal/negotiations/*` | ✗ | ✗ | ✗ | ✗ | Own customer only |
| `/portal/confirm/*` | ✗ | ✗ | ✗ | ✗ | Own customer only |

`*` = read/support capability, subject to final scope rules.

`**` = own quotation scope.

This matrix is a baseline; the service layer remains the final authorization authority.

---

# 7.56 Business Operations vs CRUD

The following are intentionally business operations:

```text
POST /quotations/:id/submit
POST /quotations/:id/recalculate
POST /approvals/:id/steps/:id/approve
POST /approvals/:id/steps/:id/return
POST /portal/quotations/:id/confirm
POST /fulfillment/:id/accept
POST /backorders/:id/consolidate
POST /subscriptions/:id/modify
POST /invoices/:id/payments
POST /deal-health/:id/escalate
```

Avoid exposing dangerous generic endpoints such as:

```text
PATCH /quotations/:id
PATCH /approval_requests/:id
PATCH /stock_levels/:id
PATCH /invoices/:id
```

to arbitrary clients.

Generic CRUD can bypass domain invariants.

---

# 7.57 API → Use Case Traceability

| Use Case | API Operation |
|---|---|
| UC-01 Authenticate | `POST /auth/login` |
| UC-02 Configure Products/Pricing | product + price-list APIs |
| UC-03 Configure Discount Governance | discount-tier/category-rule APIs |
| UC-04 Configure Warehouse/Subscription | warehouse/subscription config APIs |
| UC-05 Create Quotation | `POST /quotations` |
| UC-06 Edit Quotation | quotation line operations |
| UC-07 Evaluate Discount/Risk | `recalculate`, submit |
| UC-08 Route Approval | `submit` |
| UC-09 Approve/Reject/Return | approval action APIs |
| UC-10 Upsell/Cross-sell | recommendation APIs |
| UC-11 Send Quote | `POST /quotations/:id/send` |
| UC-12 Negotiate | portal negotiation API |
| UC-13 Re-evaluate Negotiated Terms | domain service invoked by negotiation update |
| UC-14 Confirm Quote | portal confirm API |
| UC-15 Warehouse Allocation | fulfillment recommendation/accept/override |
| UC-16 Backorder | allocation + backorder consolidation |
| UC-17 Hybrid Billing | billing service + invoice APIs |
| UC-18 Subscription Modification | subscription modify API |
| UC-19 Payment | payment API |
| UC-20 Deal Health | deal-health evaluation/dashboard |
| UC-21 Alert Action | nudge/escalate/resolve APIs |
| UC-22 Reporting | report APIs |

---

# 7.58 API Flow — Core Sales Path

```text
POST /auth/login
      ↓
POST /quotations
      ↓
POST /quotations/:id/lines
      ↓
GET /quotations/:id/recommendations
      ↓
POST /quotations/:id/recommendations/:productId/accept
      ↓
POST /quotations/:id/submit
      ↓
IF approval required
      ↓
GET /approvals
      ↓
POST /approvals/:id/steps/:stepId/approve
      ↓
POST /quotations/:id/send
      ↓
Customer Portal
      ↓
POST /portal/quotations/:id/negotiations
      ↓
re-evaluate
      ↓
approval again if required
      ↓
POST /portal/quotations/:id/confirm
      ↓
Fulfillment APIs
      ↓
Billing APIs
```

---

# 7.59 API Flow — Customer Negotiation Loop

```text
Customer
  ↓
GET /portal/quotations/:id
  ↓
POST /portal/quotations/:id/negotiations
  ↓
Server updates current quotation version
  ↓
Recalculate totals/risk
  ↓
Threshold crossed?
  ├── No → continue
  └── Yes
        ↓
     ApprovalRequest
        ↓
     Manager / Finance
        ↓
     Updated customer-visible quotation
        ↓
     Customer confirms
```

---

# 7.60 API Flow — Fulfillment Loop

```text
Confirmed quotation
      ↓
POST /fulfillment/:id/recommend
      ↓
Recommended warehouse split
      ↓
POST /fulfillment/:id/accept
      ↓
Transaction + stock locks
      ↓
Allocation(s)
      +
Backorder if required
      ↓
POST /backorders/:id/consolidate
```

---

# 7.61 API Flow — Billing Loop

```text
Confirmed / fulfilled order
        ↓
Billing service
        ├── One-time invoice
        │       ↓
        │   payment
        │       ↓
        │   invoice status
        │
        └── Subscription
                ↓
          recurring schedule
                ↓
          invoice
                ↓
             payment
```

---

# 7.62 Background Jobs

The following should be implemented as scheduled/background domain operations rather than frontend polling-only logic:

```text
Deal Health evaluation
Recurring billing generation
Subscription period rollover
Potential delivery slippage evaluation
Backorder availability scan
```

Background jobs must call the same domain services as synchronous API calls.

Do not duplicate business rules between:

```text
controller implementation
+
background job implementation
```

---

# 7.63 API Security Rules

1. All internal endpoints require authenticated internal users.
2. All customer portal endpoints require authenticated CUSTOMER users.
3. Customer endpoints enforce customer ownership on every request.
4. Role checks are server-side.
5. Resource ownership checks are server-side.
6. State guards are server-side.
7. Financial values are recomputed server-side.
8. Inventory availability is checked server-side.
9. Audit events are generated server-side.
10. Never accept a client-supplied role as an authorization decision.
11. Never accept a client-supplied `customerId` as proof of ownership.
12. Never accept a client-supplied approval status as authoritative.
13. Never accept client-supplied stock availability as authoritative.
14. Never expose internal margin/cost/risk details through the customer API.
15. Rate-limit authentication and other security-sensitive endpoints as appropriate.
16. Validate and constrain all uploaded/exported parameters.
17. Do not expose stack traces or internal database details.

---

# 7.64 Recommended API Response Shape

For successful business operations:

```json
{
  "data": {
    "...": "..."
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

For list endpoints:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 120,
    "requestId": "uuid"
  }
}
```

Pagination strategy may be offset- or cursor-based. Offset pagination is sufficient for the MVP.

---

# 7.65 Coding-Agent Guardrails

1. API controllers must remain thin.
2. Controllers validate transport input and call application services.
3. Application services own business operations.
4. Domain services own calculations and state transitions.
5. Repositories/data-access code owns persistence only.
6. Do not duplicate business logic across controllers.
7. Do not expose unrestricted table CRUD to the frontend.
8. All authoritative state changes pass through domain/service operations.
9. All state changes validate current state.
10. All permission checks execute server-side.
11. All customer portal operations enforce customer ownership.
12. All quotation financial totals are server-calculated.
13. All discount/risk calculations are server-calculated.
14. Approval actions must verify quotation-version validity.
15. Customer negotiation must create/re-evaluate a new quotation version where terms change.
16. Customer confirmation must validate current approval validity.
17. Inventory acceptance/override/consolidation must use transactions and stock locks.
18. Payments must support idempotency.
19. Financial side effects must be auditable.
20. Audit entries must never be directly writable by arbitrary clients.
21. Background jobs must reuse domain services.
22. API error codes must be stable enough for the frontend to react correctly.
23. `409 CONFLICT` should be used for stale versions/concurrent changes/state conflicts.
24. APIs should expose business operations rather than UI-specific implementation details.
25. Reporting endpoints should query the operational source of truth.
26. Customer responses must never leak internal cost, margin, risk, approval notes, or operational data.
27. Every endpoint must be traceable to a use case or explicitly documented supporting concern.

---

# 7.66 Official Status

**SECTION 7 — API SURFACE / OPERATIONS: LOCKED**

The API is now the external contract over the domain model and business rules defined in Sections 1–6.

Next:

> **8. Technology Choice**

Section 8 must select the implementation stack based on the requirements already locked:
- PostgreSQL transactional integrity
- server-side business logic
- role-based authorization
- customer portal isolation
- quotation versioning
- transactional inventory allocation
- recurring billing/background jobs
- reporting/export
- fast hackathon development without sacrificing domain correctness.
