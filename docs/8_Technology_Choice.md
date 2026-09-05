# DealFlow360 — Section 8: Technology Choice

> **Status:** OFFICIAL / LOCKED
>
> **Purpose:** Final control file for the implementation stack. The technology is selected **after** the problem, actors, use cases, domain model, database schema, business rules, and API surface have been defined.
>
> **Derived from:** Sections 1–7 + DealFlow360 problem statement + DealFlow360 End-to-End Product Flow (Excalidraw).
>
> **Core principle:** Technology must serve the business model. We do not change the domain model merely to fit a framework.

---

# 8.1 Technology Decision

## Recommended stack

```text
Frontend
    React + TypeScript
    Vite
    Tailwind CSS

Backend
    Node.js
    TypeScript
    Express

Database
    PostgreSQL

ORM / Data Access
    Prisma
    + targeted raw SQL where PostgreSQL locking/transaction behaviour
      requires explicit control

Authentication
    JWT-based authentication for internal/customer sessions
    bcrypt/Argon2-style password hashing
```

## Supporting implementation

```text
Validation
    Zod

API documentation
    OpenAPI / Swagger

Background jobs
    Node.js worker / scheduled jobs

Testing
    Vitest or Jest
    Supertest for API integration tests

Formatting / linting
    Prettier
    ESLint

Version control
    Git + GitHub

Deployment
    Containerized application where practical
    PostgreSQL managed/containerized depending on environment
```

This stack is intentionally conventional and TypeScript-based so the same language can be used across frontend, backend, domain services, validation, and tests.

---

# 8.2 Why This Stack Fits DealFlow360

The problem statement explicitly says the team can use any programming language, framework, or database technology and that the real focus is business logic, data modelling, and end-to-end workflow.

Therefore, the technology choice should optimize for:

1. Fast implementation.
2. Strong transactional database support.
3. Clear business-logic boundaries.
4. Reliable authorization.
5. Good relational modelling.
6. Easy frontend/backend integration.
7. Strong testing support.
8. Ability to demonstrate the complete workflow within the hackathon.

The selected stack meets those goals without introducing unnecessary infrastructure.

---

# 8.3 Frontend — React + TypeScript

## Choice

```text
React
+
TypeScript
```

## Why

DealFlow360 has several interactive stateful screens:

```text
Quotation Builder
Approval Detail
Customer Negotiation
Fulfillment Split
Billing
Deal Health
Reporting
```

These screens depend on live domain state.

React is appropriate for:

- component-based UI
- interactive forms
- dynamic quotation calculations
- approval state rendering
- portal/internal workspace separation
- reusable data-driven components

TypeScript adds compile-time checking across:

```text
API request types
API response types
domain DTOs
UI models
form models
```

This is particularly valuable because the project contains many related state objects.

---

# 8.4 Frontend Build Tool — Vite

Use:

```text
Vite
```

for the React application.

Reasons:

- fast development server
- simple setup
- fast TypeScript builds
- suitable for hackathon iteration

There is no need for a heavier frontend framework unless another requirement emerges.

---

# 8.5 Styling — Tailwind CSS

Use:

```text
Tailwind CSS
```

for the application styling system.

Reasons:

- rapid implementation of the Excalidraw-derived layouts
- consistent spacing/typography
- responsive internal workspace
- separate customer portal styling
- less time spent maintaining custom CSS architecture

Tailwind is a presentation choice and must not contain domain/business rules.

---

# 8.6 Frontend Architecture

Recommended frontend structure:

```text
src/
  app/
  routes/
  features/
    auth/
    dashboard/
    quotations/
    approvals/
    recommendations/
    fulfillment/
    subscriptions/
    billing/
    portal/
    deal-health/
    reporting/
    admin/
  components/
  hooks/
  lib/
  api/
  types/
```

Feature modules should correspond broadly to business capabilities, not database tables.

For example:

```text
features/quotations/
```

may contain:

```text
quotation list
quotation builder
quotation state
quotation API hooks
quotation presentation components
```

but business calculations remain server-side.

---

# 8.7 State Management

Do not immediately introduce a large global client state system for everything.

Recommended approach:

```text
Server state
    ↓
API query/cache layer

Local UI state
    ↓
React state/hooks
```

A query/cache library such as TanStack Query may be used for server-state management.

The frontend must not become the source of truth for:

```text
quote totals
risk score
approval status
stock availability
invoice status
payment balance
```

Those values come from the backend.

---

# 8.8 Backend — Node.js + TypeScript + Express

## Choice

```text
Node.js
+
TypeScript
+
Express
```

## Why

The system has:

- many REST-like business operations
- transactional database operations
- background tasks
- role-based authorization
- JSON API communication
- relatively small hackathon-scale deployment requirements

Node.js is a good fit for this workflow-oriented API.

TypeScript allows the same language and type system to be used across frontend/backend boundaries.

Express keeps the HTTP layer simple and thin.

---

# 8.9 Backend Layering

The coding agent must use a layered structure:

```text
HTTP Controller
      ↓
Application Service
      ↓
Domain Rules
      ↓
Repository / Data Access
      ↓
PostgreSQL
```

Example:

```text
POST /quotations/:id/submit
        ↓
QuotationController
        ↓
SubmitQuotationService
        ↓
DiscountRiskEngine
        ↓
ApprovalRoutingService
        ↓
Transaction
        ↓
Prisma / SQL
```

Controllers should not directly implement business logic.

---

# 8.10 Domain Services

Core domain services should include at least:

```text
QuotationService
DiscountRiskService
ApprovalService
RecommendationService
NegotiationService
FulfillmentService
InventoryService
SubscriptionService
BillingService
PaymentService
DealHealthService
ReportingService
AuditService
```

Not every service needs to be a separate package. The important requirement is separation of responsibility.

---

# 8.11 Validation — Zod

Use a schema validator such as:

```text
Zod
```

for API input validation.

Example:

```text
POST /quotations
```

validates:

```text
customerId
currencyCode
lines
productId
quantity
discountPercent
```

However:

> Input validation is not business-rule validation.

For example:

```text
discountPercent = 18
```

may be syntactically valid but commercially invalid.

Therefore:

```text
Zod
    ↓
shape/type validation

Domain service
    ↓
business validation
```

---

# 8.12 Database — PostgreSQL

## Choice

```text
PostgreSQL
```

This is the most important infrastructure choice.

DealFlow360 requires:

- relational data
- foreign keys
- uniqueness constraints
- transactional updates
- precise monetary values
- concurrent inventory allocation
- ordered approval steps
- historical records
- JSON snapshots
- indexes for dashboards/queues

PostgreSQL fits these requirements directly.

---

# 8.13 Why Not a Document Database for the MVP?

The domain has strong relationships:

```text
Customer
   ↓
Quotation
   ↓
QuotationLine
   ↓
Product

Quotation
   ↓
ApprovalRequest
   ↓
ApprovalStep
   ↓
User
```

and:

```text
Product + Warehouse
   ↓
StockLevel
```

and:

```text
Quotation
   ↓
Fulfillment
   ↓
Invoice
   ↓
Payment
```

The system also needs transactional integrity across multiple related records.

A relational model is therefore the natural fit for the current requirements.

---

# 8.14 ORM — Prisma

## Choice

```text
Prisma
```

Use Prisma for:

- schema representation
- migrations
- standard CRUD/query operations
- typed database access
- relation handling

## Important exception

Prisma should not be forced to hide database-specific transactional/concurrency behaviour.

For inventory operations requiring:

```sql
SELECT ... FOR UPDATE
```

or other PostgreSQL-specific functionality:

```text
Prisma transaction
+
Prisma raw SQL
```

may be used.

The coding agent must document raw SQL rather than scattering arbitrary SQL through controllers.

---

# 8.15 Transaction Strategy

Use database transactions for multi-step business operations.

Examples:

```text
Quote submission
Approval decision
Negotiation term change
Warehouse allocation
Backorder consolidation
Payment recording
Subscription modification
```

Pattern:

```text
BEGIN
  validate
  lock where required
  calculate
  persist domain changes
  write audit
COMMIT
```

Rollback the complete operation on failure.

---

# 8.16 Inventory Concurrency

Inventory is the most concurrency-sensitive part of DealFlow360.

Required strategy:

```text
BEGIN TRANSACTION
    ↓
SELECT affected stock rows FOR UPDATE
    ↓
calculate current available stock
    ↓
validate allocation
    ↓
update reservation
    ↓
create allocation
    ↓
create backorder if required
    ↓
audit
COMMIT
```

Never rely on a stock value cached in the frontend.

Never perform:

```text
read stock
...
later write reservation
```

outside an appropriate transactional boundary.

---

# 8.17 Authentication

## Internal authentication

Recommended:

```text
Email + Password
```

for:

```text
ADMIN
SALES_REP
MANAGER
FINANCE_OPS
```

## Customer authentication

MVP:

```text
Email + Password
```

for:

```text
CUSTOMER
```

This follows our locked Section 2 decision.

Magic-link authentication is a future enhancement, not an MVP dependency.

---

# 8.18 Password Security

Never store plaintext passwords.

Store:

```text
password_hash
```

using a modern password hashing algorithm such as:

```text
Argon2id
```

or an appropriately configured bcrypt implementation.

Authentication responses must not expose password hashes.

---

# 8.19 Token / Session Strategy

For the MVP, use:

```text
short-lived access token
+
secure authentication flow
```

JWT is acceptable for the internal/customer API.

The implementation should avoid storing sensitive authentication material in unsafe browser storage when a more secure cookie-based strategy is practical.

The exact deployment/session strategy may depend on whether frontend and backend share an origin.

---

# 8.20 Authorization

Use the locked RBAC model:

```text
ADMIN
SALES_REP
MANAGER
FINANCE_OPS
CUSTOMER
```

But authorization must use:

```text
role
+
operation
+
resource ownership/scope
+
current state
```

Example:

```text
CUSTOMER
+
GET quotation
+
quotation.customer_id = authenticated customer
+
quotation is customer-visible
```

Another:

```text
SALES_REP
+
edit quotation
+
quotation.sales_rep_id = current user
+
quotation editable
```

Authorization belongs on the server.

---

# 8.21 Customer Portal Isolation

Use separate frontend routes:

```text
/app/*
/portal/*
```

and separate authorization paths:

```text
/api/v1/internal/*
/api/v1/portal/*
```

This is a security boundary, not just a visual distinction.

Customer APIs must never return:

```text
internal margin
internal cost
approval notes
internal risk calculation
Deal Health flags
warehouse operational data
```

unless a future explicit requirement changes the policy.

---

# 8.22 Business Rule Location

The following must live in application/domain logic:

```text
effective discount ceiling
discount overage
blended risk
approval routing
approval validity
quotation versioning
recommendation ranking
margin calculation
warehouse allocation
inventory reservation
backorder calculation
subscription proration
invoice balance
payment state
Deal Health detection
```

Do not implement these as:

```text
React-only logic
```

or:

```text
hardcoded controller branches
```

or:

```text
magic frontend constants
```

that bypass the domain layer.

---

# 8.23 Background Jobs

DealFlow360 needs some work that can happen independently of a user request.

Recommended:

```text
Deal Health evaluation
Recurring billing generation
Delivery-risk evaluation
Backorder monitoring
Subscription period processing
```

For MVP, this can be a Node.js worker using a scheduler/queue appropriate to the deployment environment.

A lightweight scheduled process is sufficient unless scale requires a dedicated queue system.

---

# 8.24 Recommended MVP Background Scheduling

A simple implementation may start with:

```text
scheduled worker
```

executing domain operations periodically.

Examples:

```text
Every 15–60 minutes:
    evaluate Deal Health

Daily / according to billing cadence:
    generate recurring billing records
```

The exact frequency is an implementation decision.

The important rule is:

> Background jobs must call the same domain services as API-triggered operations.

---

# 8.25 Testing Strategy

Testing must prioritize business logic over UI snapshots.

## Unit tests

Test:

```text
discount calculation
effective ceiling
risk calculation
approval routing
margin calculation
recommendation scoring
warehouse allocation
backorder calculation
proration
invoice balance
Deal Health detection
```

## Integration tests

Test:

```text
quotation → approval
negotiation → reapproval
quotation → fulfillment
fulfillment → invoice
invoice → payment
subscription → recurring billing
```

## Authorization tests

Test:

```text
customer accessing another customer quote → denied
sales rep approving own quote → denied
finance editing discount configuration → denied
```

## Concurrency tests

At minimum:

```text
two fulfillment requests competing for same stock
```

must not over-reserve stock.

---

# 8.26 End-to-End Test Strategy

The application should automatically verify the hackathon's critical flow.

Recommended end-to-end scenario:

```text
Login
 ↓
Configure discount tier
 ↓
Configure warehouse
 ↓
Configure subscription
 ↓
Create quote
 ↓
Apply excessive discount
 ↓
Automatic approval
 ↓
Accept upsell
 ↓
Margin updates
 ↓
Approve quote
 ↓
Warehouse split
 ↓
Backorder if required
 ↓
Customer negotiation
 ↓
Re-approval
 ↓
Customer confirmation
 ↓
Billing
 ↓
Payment
 ↓
Invoice status
```

This directly aligns implementation testing with the problem's intended quick test flow.

---

# 8.27 API Documentation

Use OpenAPI/Swagger for the internal API.

Document:

```text
endpoint
method
request
response
authentication
authorization
error codes
```

The documentation should describe business operations such as:

```text
submit quotation
approve step
return for revision
confirm quotation
accept warehouse split
consolidate backorder
record payment
```

not merely database CRUD.

---

# 8.28 Logging

Use structured server-side logging.

Each request should have a:

```text
requestId
```

Useful fields:

```text
requestId
userId
role
operation
entityId
quotationId
duration
result
errorCode
```

Never log:

```text
passwords
password hashes
access tokens
sensitive customer credentials
```

---

# 8.29 Observability for the Hackathon

Full production observability is not required.

Minimum useful level:

```text
request logging
error logging
business-operation logging
database error visibility
```

For critical flows, log:

```text
quotation id
approval id
allocation id
invoice id
```

so demo failures can be diagnosed quickly.

---

# 8.30 Deployment Architecture

Recommended MVP deployment:

```text
                 Browser
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
     React Frontend       Customer Portal
          │                   │
          └─────────┬─────────┘
                    ▼
             Node/Express API
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
      Domain Services     Background Worker
          │
          ▼
       PostgreSQL
```

The internal and customer experiences may share the same frontend deployment, but they must remain separate route/authorization surfaces.

---

# 8.31 Environment Configuration

Use environment variables for:

```text
DATABASE_URL
JWT_SECRET / authentication configuration
APP_BASE_URL
API_BASE_URL
CORS_ALLOWED_ORIGINS
```

Never commit secrets into Git.

Example:

```text
.env
.env.example
```

The repository contains only:

```text
.env.example
```

with placeholder values.

---

# 8.32 Repository Structure

Recommended monorepo:

```text
dealflow360/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── shared/
│   └── config/
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── docs/
│   ├── Section_1_Problem_Restatement.md
│   ├── Section_2_Actors_and_Roles.md
│   ├── Section_3_Core_Use_Cases.md
│   ├── Section_4_Entities_and_Relationships.md
│   ├── Section_5_Database_Schema.md
│   ├── Section_6_Business_Rules_and_State_Transitions.md
│   ├── Section_7_API_Surface_and_Operations.md
│   └── Section_8_Technology_Choice.md
│
├── package.json
├── README.md
└── .env.example
```

A monorepo is recommended for the hackathon because frontend/backend/shared types remain together.

---

# 8.33 Shared Types

Shared TypeScript packages may contain:

```text
role enums
API response types
common validation schemas where appropriate
error codes
quotation status types
```

Do not put authoritative business calculations in a shared frontend package.

For example:

```text
GOOD:
QuotationStatus type

NOT GOOD:
calculateApprovalRisk() used only by frontend
```

The server remains authoritative.

---

# 8.34 Recommended Dependency Philosophy

Prefer a small number of well-understood dependencies.

Core:

```text
react
typescript
vite
tailwindcss
node
express
prisma
zod
bcrypt/argon2
jwt/session library
testing framework
```

Add libraries only when they solve a real problem.

Do not build a complicated microservice architecture for a hackathon-sized application.

---

# 8.35 Architecture Style

Recommended architecture:

> **Modular monolith**

Not:

```text
microservice-per-domain
```

The application can internally separate modules:

```text
Quotation
Approval
Inventory
Fulfillment
Billing
Subscription
Deal Health
Reporting
```

but deploy them as one backend application.

This gives us:

- simpler local development
- simpler transactions
- simpler deployment
- simpler debugging
- fewer network failure modes
- faster hackathon delivery

The domain boundaries remain explicit so individual modules can later be extracted if necessary.

---

# 8.36 Why Not Microservices?

DealFlow360 has several operations requiring atomic cross-domain transactions.

Example:

```text
Confirm allocation
+
reserve stock
+
create backorder
+
audit
```

or:

```text
Negotiation
+
new quotation version
+
risk evaluation
+
approval request
+
audit
```

A modular monolith keeps these transactions straightforward.

Microservices would introduce:

```text
distributed transactions
eventual consistency
service discovery
network failures
deployment complexity
```

without providing enough benefit for the MVP.

---

# 8.37 Technology-to-Requirement Traceability

| Requirement | Technology decision |
|---|---|
| Rich interactive quotation UI | React + TypeScript |
| Internal + customer portal | React route/app separation |
| Business API | Node.js + Express + TypeScript |
| Relational domain | PostgreSQL |
| Financial precision | PostgreSQL NUMERIC |
| Inventory concurrency | PostgreSQL transactions + row locks |
| Typed DB access | Prisma |
| PostgreSQL-specific locking | Prisma + targeted raw SQL |
| API input validation | Zod |
| Role authorization | Server-side RBAC |
| Customer isolation | API boundary + ownership checks |
| Background Deal Health | Node worker/scheduler |
| Recurring billing jobs | Node worker/scheduler |
| Business logic testing | Vitest/Jest + integration tests |
| API contract | OpenAPI |
| Fast development | TypeScript monorepo + Vite |
| Hackathon deployment | Modular monolith |

---

# 8.38 Technology Non-Goals

The MVP does **not** need:

```text
microservices
Kubernetes
event-driven distributed architecture
Kafka
multiple databases
complex ML infrastructure
dedicated recommendation model training
real payment gateway integration
enterprise IAM
multi-region deployment
```

These can be future enhancements.

The problem statement is focused on business logic, data modelling, and end-to-end workflow, not infrastructure complexity.

---

# 8.39 Optional Future Enhancements

After the core flow is stable:

```text
Magic-link customer authentication
Advanced recommendation ML
Predictive delivery-risk model
Advanced anomaly detection
Dedicated job queue
Redis caching
real payment gateway
multi-company support
multi-currency enhancements
full event-driven architecture
dedicated search/indexing
fine-grained permission framework
```

These must not be introduced at the expense of the core business flow.

---

# 8.40 Final Build Architecture

The official MVP architecture is:

```text
                        DEALFLOW360

 ┌──────────────────────────────────────────────────────────┐
 │                        FRONTEND                          │
 │                                                          │
 │  Internal Workspace                 Customer Portal      │
 │  /app/*                              /portal/*            │
 │                                                          │
 │  React + TypeScript + Tailwind                          │
 └───────────────────────────┬──────────────────────────────┘
                             │
                             ▼
 ┌──────────────────────────────────────────────────────────┐
 │                         API LAYER                         │
 │                 Node.js + Express + TS                   │
 │                                                          │
 │  Auth / RBAC / Validation / Controllers                  │
 └───────────────────────────┬──────────────────────────────┘
                             │
                             ▼
 ┌──────────────────────────────────────────────────────────┐
 │                    APPLICATION / DOMAIN                  │
 │                                                          │
 │  Quotation       Discount/Risk       Approval             │
 │  Recommendation  Negotiation        Fulfillment          │
 │  Inventory       Subscription       Billing              │
 │  Payment         Deal Health         Reporting            │
 │  Audit                                                     │
 └───────────────────────────┬──────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
       ┌─────────────────┐       ┌──────────────────┐
       │   PostgreSQL    │       │ Background Worker│
       │                 │       │                  │
       │ Domain source   │       │ Deal Health      │
       │ of truth        │       │ Recurring billing│
       │                 │       │ Backorders       │
       └─────────────────┘       └──────────────────┘
```

---

# 8.41 Coding-Agent Build Order

The coding agent should build in this order:

```text
1. Repository / monorepo setup
2. PostgreSQL + Prisma
3. Database migrations
4. Seed data
5. Authentication
6. RBAC / authorization
7. Domain/service layer
8. Quotation + pricing
9. Discount/risk engine
10. Approval workflow
11. Customer portal
12. Negotiation + re-approval
13. Inventory + fulfillment
14. Backorders
15. Billing + subscriptions
16. Payments
17. Deal Health
18. Reporting
19. Frontend refinement
20. End-to-end tests
21. Demo hardening
```

This order deliberately establishes the domain/business logic before polishing all screens.

---

# 8.42 Vertical-Slice Development Rule

Do not build all frontend screens first.

The recommended implementation strategy is:

> **Build one complete business slice from database → domain → API → UI → test before moving to the next major slice.**

Suggested slices:

### Slice 1

```text
Login
→ Create Quote
→ Quote Lines
→ Totals
```

### Slice 2

```text
Discount Governance
→ Risk
→ Approval
→ Audit
```

### Slice 3

```text
Recommendations
→ Margin Update
```

### Slice 4

```text
Customer Portal
→ Negotiation
→ Re-approval
```

### Slice 5

```text
Confirmation
→ Warehouse Split
→ Backorder
```

### Slice 6

```text
Subscription
→ Billing
→ Payment
```

### Slice 7

```text
Deal Health
→ Reporting
```

This minimizes integration surprises.

---

# 8.43 Definition of Done for the Technology Layer

The technology choice is considered successfully implemented when:

```text
Frontend and backend run locally
        ↓
Database migrations work from clean state
        ↓
Seed data loads deterministically
        ↓
Internal authentication works
        ↓
Customer portal authentication works
        ↓
RBAC is enforced server-side
        ↓
Core use cases execute through API
        ↓
Transactions preserve domain invariants
        ↓
Concurrency-sensitive inventory is safe
        ↓
Audit trail is generated
        ↓
Background jobs execute domain services
        ↓
End-to-end demo flow passes
```

---

# 8.44 Final Technology Decision

> **DealFlow360 will be implemented as a TypeScript modular monolith using React + Vite + Tailwind on the frontend, Node.js + Express + TypeScript on the backend, and PostgreSQL with Prisma for persistence, with targeted raw SQL for PostgreSQL-specific concurrency operations.**

The architecture will use:

```text
RBAC
+
server-side business rules
+
application/domain services
+
PostgreSQL transactions
+
background workers
+
automated tests
```

rather than complex distributed infrastructure.

---

# 8.45 Complete Control-File Chain

The project specification is now:

```text
01 Problem Restatement
        ↓
02 Actors / Roles
        ↓
03 Core Use Cases
        ↓
04 Entities / Relationships
        ↓
05 Database Schema
        ↓
06 Business Rules / State Transitions
        ↓
07 API Surface / Operations
        ↓
08 Technology Choice
        ↓
IMPLEMENTATION
```

The implementation must follow this chain.

**Do not start from the UI and invent the backend around it.**

Start from:

```text
Problem
→ Actors
→ Use Cases
→ Domain
→ Schema
→ Rules
→ APIs
→ Technology
→ Code
```

---

# 8.46 Coding-Agent Guardrails

1. Use a modular monolith for MVP.
2. Use TypeScript across frontend and backend.
3. Use React + Vite + Tailwind for the frontend.
4. Use Node.js + Express for the backend.
5. Use PostgreSQL as the transactional source of truth.
6. Use Prisma for normal database access.
7. Use targeted raw SQL only when PostgreSQL-specific transaction/locking behaviour requires it.
8. Keep controllers thin.
9. Keep business rules in domain/application services.
10. Keep authorization server-side.
11. Use RBAC with exactly one primary role per account.
12. Maintain separate internal and customer portal authorization boundaries.
13. Customer MVP authentication is email/password.
14. Do not make magic links an MVP dependency.
15. Never trust frontend financial calculations.
16. Never trust frontend inventory availability.
17. Use transactions for cross-table business operations.
18. Lock inventory rows during authoritative allocation/reservation.
19. Use background workers for recurring and monitoring jobs.
20. Background jobs must call the same domain services as API operations.
21. Test business rules independently of the UI.
22. Test authorization and data isolation.
23. Test concurrency-sensitive inventory operations.
24. Prefer business-operation APIs over unrestricted CRUD.
25. Do not introduce microservices, Kafka, Kubernetes, or other infrastructure complexity without a demonstrated requirement.
26. Do not introduce ML infrastructure unless the deterministic core system is complete.
27. Add dependencies only for a concrete engineering need.
28. Keep secrets in environment configuration, never source code.
29. Preserve the eight control-file documents in version control.
30. When implementation conflicts with a locked control file, stop and resolve the specification conflict rather than silently changing the code or the document.
31. Build vertical business slices end-to-end.
32. Prioritize core workflow correctness over visual polish.
33. Keep the final demo path continuously executable during development.
34. Do not optimize for theoretical scale before the transactional business flow is correct.
35. The final implementation must demonstrate the business problem described in Section 1, not merely reproduce the Excalidraw screens.

---

# 8.47 Official Status

**SECTION 8 — TECHNOLOGY CHOICE: LOCKED**

The eight-section DealFlow360 control specification is now complete.

The implementation should proceed from these control files rather than from ad-hoc feature decisions.
