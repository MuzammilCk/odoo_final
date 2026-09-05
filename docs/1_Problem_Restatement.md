# DealFlow360 — Section 1: Problem Restatement

> **Status:** OFFICIAL / LOCKED
>
> **Purpose:** Control/source file for the coding agent and the remaining system-design sections.
>
> **Source basis:** DealFlow360 problem statement + DealFlow360 End-to-End Product Flow (Excalidraw).
>
> **Change policy:** Do not change this section during implementation unless the team explicitly revisits and re-agrees on the problem understanding. Implementation details must adapt to this section.

---

## 1.1 The Problem

Traditional sales systems handle a basic:

> **Quote → Order → Invoice**

flow well, but real B2B sales deals contain several interconnected decisions that this simple flow does not handle effectively.

A real deal may involve:

- different discount limits for customer tiers and product categories
- multiple approval levels
- inventory distributed across multiple warehouses
- one-time products combined with recurring subscriptions
- customer negotiation after the quotation has been sent
- stalled, unusually discounted, or delivery-risky deals that managers need to identify early

When these activities are handled independently, the deal becomes fragmented.

A typical fragmented experience is:

```text
Sales Rep gives discount
        ↓
Approval handled separately / manually
        ↓
Inventory checked separately
        ↓
Customer negotiates through email
        ↓
One-time and recurring billing handled differently
        ↓
Manager discovers stalled/risky deal late
```

This creates business problems such as margin leakage, approval delays, poor customer collaboration, fulfillment uncertainty, billing complexity, and poor visibility across the deal lifecycle.

The problem statement therefore calls for a sales platform that goes beyond a basic quote-to-invoice form and instead acts as a self-governing deal engine.

---

## 1.2 Primary User

The **Sales Representative** is the primary day-to-day user at the center of the product.

The Sales Rep:

- creates quotations
- adds products and quantities
- applies discounts
- reviews upsell/cross-sell suggestions
- tracks approval status
- responds to customer negotiation requests
- tracks fulfillment progress

The broader system also supports Sales Managers, Finance/Operations, Customers, and Admins, but the **Sales Rep is the central actor driving the quotation lifecycle**.

---

## 1.3 Core Understanding

The most important design understanding is:

> **The quotation is a live business object, not a static document.**

Changes to the quotation can change other parts of the workflow.

For example:

```text
Quotation
    ↓
Discount changes
    ↓
Risk changes
    ↓
Approval requirement changes
```

Later:

```text
Customer negotiates
    ↓
Quotation changes
    ↓
Risk is recalculated
    ↓
Approval may be required again
    ↓
Final valid quotation
    ↓
Order confirmation
    ↓
Fulfillment
    ↓
Billing
```

Therefore, approval is not permanently valid regardless of later changes. The current commercial terms of the quotation determine whether approval is still valid.

---

## 1.4 Core Business Pains

### 1. Discount / Margin Leakage

Discounts can exceed the appropriate limits for a customer tier or product category, reducing margin.

### 2. Approval Delays

The correct approval chain should be derived automatically from configured business rules instead of being manually coordinated by the Sales Rep.

### 3. Customer Negotiation Through Email

Email-based negotiation fragments the deal and makes it harder to maintain a reliable version of the quotation.

### 4. Inventory Distributed Across Warehouses

Required quantities may be spread across warehouses, requiring stock-aware fulfillment splitting.

### 5. Backorders / Fulfillment Uncertainty

A commercially approved order may still lack enough physical stock for immediate full fulfillment.

### 6. One-Time + Subscription Billing Complexity

A single order can combine one-time products and recurring subscription lines, which require different billing behaviour.

### 7. Managers Discovering Stalled Deals Too Late

Managers need early visibility into stalled, unusually discounted, or delivery-risky deals.

### 8. Lack of Lifecycle Visibility

The organization needs visibility across:

> **Quotation → Approval → Customer Negotiation → Confirmation → Fulfillment → Billing**

with **Deal Health monitoring the lifecycle in parallel** and **Reporting providing management visibility**.

---

## 1.5 What We Are Trying to Solve

DealFlow360 is not simply a quotation CRUD application.

The intended experience is:

```text
Sales Rep creates quotation
        ↓
System applies configured business rules
        ↓
Discount / risk evaluated
        ↓
Approval automatically routed when required
        ↓
Upsell / cross-sell opportunities surfaced
        ↓
Customer negotiates through portal
        ↓
Quotation re-evaluated when terms change
        ↓
Final valid terms confirmed
        ↓
Order confirmed
        ↓
Inventory intelligently allocated
        ↓
Backorders handled when required
        ↓
One-time + recurring billing processed
        ↓
Deal Health continues monitoring
        ↓
Management reporting
```

The platform should provide a complete quotation-to-cash experience while keeping the quotation connected to the business rules and operational consequences around it.

---

## 1.6 Meaning of “Self-Governing”

Our official interpretation of **self-governing** is:

> **The system automatically applies configured business rules and routes the deal to humans when human approval or intervention is required.**

For example:

```text
Rep enters discount
       ↓
Check customer-tier rule
       ↓
Check product-category rule
       ↓
Evaluate quotation risk
       ↓
Within configured limit?
   ┌───────────┴───────────┐
  Yes                      No
   ↓                        ↓
Continue            Determine approval chain
                            ↓
                  Manager / Manager + Finance
```

This does **not** mean that AI independently makes financial decisions.

It means the workflow automatically enforces the organization's configured policies.

---

## 1.7 Core Feedback Loops

### Commercial Governance Loop

```text
Quotation
    ↓
Discount / Risk Evaluation
    ↓
Approval
    ↓
Customer Negotiation
    ↓
Terms Change
    ↓
Re-evaluate
    ↓
Approval Again if Required
    ↓
Final Confirmation
```

### Inventory / Fulfillment Loop

```text
Confirmed Order
    ↓
Live Warehouse Stock
    ↓
Recommended Split
    ↓
Partial Availability?
    ↓
Backorder Remaining Quantity
    ↓
Stock Arrives
    ↓
Consolidate Remaining Backorder
```

### Opportunity / Margin Loop

```text
Current Quote
    ↓
Recommendation Engine
    ↓
Upsell / Cross-sell Suggestion
    ↓
Sales Rep Accepts / Dismisses
    ↓
Quote Total + Margin Update
    ↓
Risk May Change
```

---

## 1.8 What Makes DealFlow360 Different

A basic sales system may behave like:

```text
Create Quote
    ↓
Save Quote
    ↓
Approve Quote
    ↓
Invoice
```

Our understanding of DealFlow360 is:

```text
Create Quote
    ↓
Evaluate
    ↓
Recommend
    ↓
Govern
    ↓
Approve
    ↓
Negotiate
    ↓
Re-evaluate
    ↓
Confirm
    ↓
Fulfill
    ↓
Bill
    ↓
Monitor
    ↓
Report
```

The value is **not the number of screens**.

The value is in the **business rules, state changes, and feedback loops connecting the modules around the quotation**.

---

## 1.9 Mentor-Ready Problem Restatement

> **“The problem we understood is that traditional sales systems handle the basic quote-to-invoice flow, but real B2B deals involve much more complex and interconnected decisions. A sales representative may need to apply different discounts to different products, which can require multiple levels of approval. Inventory may be distributed across warehouses, creating split fulfillment and backorders. A single order may also contain both one-time products and recurring subscriptions, which have different billing requirements. After the quote is sent, customers may negotiate changes, which means the quotation and its approval status can change again. At the same time, managers need visibility into stalled deals, abnormal discounts, and delivery risks before those problems become serious. We therefore understand DealFlow360 as a self-governing sales operations platform where the quotation is a live business object that is continuously evaluated, approved, negotiated, fulfilled, billed, and monitored through its lifecycle.”**

---

## 1.10 One-Sentence Problem Statement

> **Traditional sales systems treat a quotation as a static transaction, while real B2B deals require continuous discount governance, approval, negotiation, inventory coordination, hybrid billing, and risk monitoring around a changing quotation.**

---

## 1.11 One-Line Product Understanding

> **DealFlow360 is a B2B sales operating system where the quotation is a live business object surrounded by automated governance, recommendations, customer negotiation, fulfillment, billing, and continuous deal-health monitoring.**

---

## 1.12 Coding-Agent Guardrails

The coding agent must preserve these problem-level truths:

1. **Quotation is the central live business object.**
2. **Sales Rep is the primary day-to-day user.**
3. **Business rules are configuration-driven and implemented in application logic.**
4. **Discount governance and approval routing are automatic.**
5. **Customer negotiation happens through a separate restricted customer-facing portal.**
6. **Negotiated changes can trigger re-evaluation and re-approval.**
7. **Commercial approval and physical fulfillment are separate concerns.**
8. **Inventory can be distributed across multiple warehouses and can result in backorders.**
9. **One order can contain both one-time and recurring lines.**
10. **Deal Health is a parallel monitoring/control layer, not a mandatory stage in the sales lifecycle.**
11. **Reporting provides management visibility and is not a replacement for the operational workflow.**
12. **The implementation must not become disconnected CRUD screens.**
13. **Core business rules must not be faked or hardcoded only for the demo.**
14. **Implementation choices may extend the requirements but must not silently contradict them.**
15. **Where the source does not prescribe an exact formula or algorithm, the team may choose and document a deterministic implementation without claiming the source mandates that exact implementation.**

---

## 1.13 Official Status

**SECTION 1 — PROBLEM RESTATEMENT: LOCKED**

All future sections must remain consistent with this problem understanding.

The next control sections are:

> **2. Actors / Roles**  
> **3. Core Use Cases**  
> **4. Entities and Relationships**  
> **5. Database Schema**  
> **6. Business Rules and State Transitions**  
> **7. API Surface / Operations**  
> **8. Technology Choice**
