# DealFlow360 — Official 5-Minute Demo Video Script & Production Guide
> **Platform:** DealFlow360 — An Intelligent, Self-Governing Sales Operations Platform  
> **Source Basis:** `docs/1_Problem_Restatement.md` & `docs/3_Core_Use_Cases.md`  
> **Target Duration:** Exactly 5 Minutes (04:55 – 05:00)  
> **Presenters/Actors:** Single Presenter or Dual Presenter (Sales Rep / Ops & Customer)

---

## 1. Demo Setup & Pre-Flight Checklist

### A. Environment Configuration
- **Frontend URL:** `http://localhost:5173`
- **Backend API:** `http://localhost:3001`
- **Recommended Setup:** 
  - **Browser Window 1 (Left / Main Screen - Light/Dark Standard):** Internal Sales Workspace (`rep@demo.com`, `manager@demo.com`, `finance@demo.com`)
  - **Browser Window 2 (Right / Incognito Window):** Customer Facing Portal (`customer@acme.com`)

### B. User Credentials Cheat-Sheet (All Passwords: `password123`)
| Persona | Email | Role | Core Action in Demo |
|---|---|---|---|
| **Sarah Sales** | `rep@demo.com` | `SALES_REP` | Creates Quote, triggers upsell, applies discount |
| **Mike Manager** | `manager@demo.com` | `MANAGER` | Tier-1 discount approval, Deal Health monitoring |
| **Fiona Finance** | `finance@demo.com` | `FINANCE_OPS` | Tier-2 approval, Warehouse split, Backorders, Payments |
| **Alex Acme** | `customer@acme.com` | `CUSTOMER` (Acme Corp - Gold) | Portal negotiation, counter-discount, order confirmation |
| **Admin User** | `admin@demo.com` | `ADMIN` | System catalog, discount tiers, pricing rules |

### C. Database Reset & Seeding (Pre-Recording)
Run in terminal before recording to ensure a pristine state:
```bash
npx prisma db seed
# Or if resetting:
npx prisma migrate reset --force
```

---

## 2. Master Storyboard & Timeline Breakdown (5 Minutes)

```
0:00 ─── 0:40 │ Segment 1: The Problem & The DealFlow360 Vision
0:40 ─── 1:15 │ Segment 2: Configuration & Self-Governing Rules
1:15 ─── 2:20 │ Segment 3: Flow 1 — CPQ, Real-Time Upsell & Blended Risk Approval
2:20 ─── 3:15 │ Segment 4: Customer Portal Negotiation & Re-Approval Feedback Loop
3:15 ─── 4:00 │ Segment 5: Flow 2 — Multi-Warehouse Split & Backorder Handling
4:00 ─── 4:35 │ Segment 6: Hybrid Billing (Hardware + SaaS Recurring) & Payment
4:35 ─── 5:00 │ Segment 7: Deal Health Anomaly Engine, Reporting & What's Next
```

---

## 3. Full Side-by-Side Video Script

---

### SEGMENT 1: The Problem & The DealFlow360 Vision
**Timestamp:** `0:00 – 0:40` (40 seconds)  
**Core Goal:** Hook the judges using `docs/1_Problem_Restatement.md`. Contrast traditional static quotes with real-world B2B sales complexity.

| Visual / Screen Action | Spoken Voiceover Narration | On-Screen Caption / Callout |
|---|---|---|
| **[0:00 - 0:10]**<br>Display DealFlow360 Title Slide / Splash Screen showing: *"DealFlow360 — An Intelligent, Self-Governing Sales Operations Platform"*. Then transition directly to the DealFlow360 Live Kanban Pipeline (`http://localhost:5173/app/dashboard`). | "Most sales tools handle the basics: create a static quote, email a PDF, and issue an invoice. But real B2B sales teams don't operate in clean, linear conditions." | **DealFlow360**<br>*Self-Governing B2B Sales Operations* |
| **[0:10 - 0:25]**<br>Quick camera cut or screen highlight over messy deal realities: Multi-tier customer discounts, split warehouses, bundled hardware with SaaS subscriptions, and post-quote email negotiations. | "Real deals are messy: reps quietly leak margins across mixed categories; inventory is fragmented across multiple depots; subscriptions clash with one-time hardware; and managers only discover stalled deals after momentum is completely lost." | **The B2B Reality:**<br>• Margin Leakage<br>• Split Inventory<br>• Hybrid Billing<br>• Blindspot Delays |
| **[0:25 - 0:40]**<br>Hover over the DealFlow360 App Shell showing active quotations in real-time. | "We built DealFlow360 around one fundamental principle: **A quotation is not a static document — it is a living, self-governing business object.** Today, we'll demonstrate two complete end-to-end flows showing how DealFlow360 governs pricing, inventory, and billing automatically." | **Core Thesis:**<br>*The Quotation is a Live Business Object, Not a Static PDF* |

---

### SEGMENT 2: Backend Configuration & The Self-Governing Engine
**Timestamp:** `0:40 – 1:15` (35 seconds)  
**Core Goal:** Show that rules are configuration-driven, not hardcoded for the demo.

| Visual / Screen Action | Spoken Voiceover Narration | On-Screen Caption / Callout |
|---|---|---|
| **[0:40 - 0:55]**<br>Navigate to **Discount Config** (`/app/config`) logged in as Admin or Manager.<br>Zoom into the **Discount Tiers** table (Bronze: 5%, Silver: 10%, Gold: 15%) and the **Category Ceilings** table (Hardware: 15%, Services: 10%, Subscriptions: 12%). | "Behind DealFlow360 is a configurable governance matrix. Here in Backend Config, we establish discount ceilings by Customer Tier — Gold gets 15% — but also by Product Category — Services are strictly capped at 10% because of tighter operational margins." | **Automated Governance Matrix**<br>• Gold Tier: 15% Max<br>• Services Category: 10% Stricter Limit<br>• Rule: `MIN(Tier, Category)` |
| **[0:55 - 1:15]**<br>Click over to **Warehouse Setup** showing `Main Warehouse` (Shipping Weight 1.0) and `East Depot` (Shipping Weight 1.5). Then glance at **Recurring Plans** (Monthly SaaS licenses with proration rules). | "We also configure multi-depot shipping weights to minimize split freight costs, alongside recurring subscription plans with automated mid-cycle proration. When a quote changes, this entire policy engine evaluates the transaction in real time." | **Multi-Depot & Hybrid Setup**<br>• Weighted Freight Logic<br>• Native Recurring SaaS Plans |

---

### SEGMENT 3: Flow 1 — CPQ, Live Upsell & Blended Risk Governance
**Timestamp:** `1:15 – 2:20` (65 seconds)  
**Core Goal:** Build an enterprise quote, trigger the live upsell recommendation with instant margin feedback, and demonstrate the Blended Risk formula routing multi-step approvals.

| Visual / Screen Action | Spoken Voiceover Narration | On-Screen Caption / Callout |
|---|---|---|
| **[1:15 - 1:30]**<br>Switch to Sales Rep **Sarah Sales** (`/app/quotations`). Click **+ New Quotation**.<br>Select Customer: **Acme Corp (Gold Tier)**.<br>Add Product 1: **Laptop Pro** (Qty: 2, Unit Price: $1,200).<br>Add Product 2: **Cloud License** (Qty: 5 seats, $90/month). | "Logging in as Sales Rep Sarah, let's build an enterprise quote for Acme Corp, a Gold Tier account. Notice we seamlessly combine one-time hardware with recurring SaaS licenses in a single cart." | **Persona: Sarah Sales (Rep)**<br>Hybrid Bundle: Hardware + Recurring SaaS |
| **[1:30 - 1:50]**<br>Point camera/cursor to the **AI Upsell & Cross-Sell Panel** on the right side of the screen.<br>Highlight recommendation: **Setup Service** with badge *"High Margin Delta (+12.4%)"*.<br>Click **[+ Add to Quote]**.<br>Observe the Quote Total and Margin indicator update instantly. | "While Sarah builds the deal, DealFlow360's recommendation engine evaluates co-purchase history and margin thresholds. It suggests our 'Setup Service'. In one click, Sarah adds it, and our real-time margin indicator recalculates immediately without a page refresh." | **Co-Purchase Engine**<br>• Dynamic Cross-Sell<br>• Instant Margin & Revenue Recalculation |
| **[1:50 - 2:05]**<br>In the quote line items, apply discounts:<br>• Laptop Pro: Enter **12%** discount (Allowed: 15% → 0% overage).<br>• Setup Service: Enter **18%** discount (Allowed: 10% ceiling → **8% overage!**).<br>Instantly, the UI displays: **Blended Risk Score: 8.0 — HIGH RISK**. | "Now watch what happens when Sarah discounts. Acme is Gold, normally allowed 15%. Hardware is fine at 12%. But on Setup Services, she offers 18% — breaking the category's 10% ceiling by 8 points.<br>DealFlow360 doesn't just check overall averages; it calculates the **Blended Risk Score** across individual line overages. Score 8.0 triggers a **HIGH RISK** status." | **Blended Risk Formula:**<br>$\sum \max(0, \text{Discount} - \text{Ceiling})$<br>Score 8.0 > 5.0 $\rightarrow$ **HIGH RISK** |
| **[2:05 - 2:20]**<br>Click **[Submit for Approval]**.<br>Show the modal: Routes to **Step 1: Sales Manager** AND **Step 2: Finance & Ops**.<br>Log in as **Mike Manager** (`/app/approvals`), click **Approve** with reason: *"Approved for Q3 enterprise expansion"*. Status advances to Step 2.<br>Log in as **Fiona Finance** (`/app/approvals`), click **Approve**. Status transitions to **APPROVED**. | "The system automatically routes the quote into a multi-step sequence: Sales Manager first, followed by Finance. Neither rep nor manager can skip steps. Once Mike and Fiona approve with full audit timestamps, the quotation is commercially unlocked." | **Multi-Tier Sequential Approval**<br>✓ Sales Manager Approved<br>✓ Finance & Ops Approved<br>🔒 Tamper-Proof Audit Trail |

---

### SEGMENT 4: Customer Portal Negotiation & The Re-Approval Loop
**Timestamp:** `2:20 – 3:15` (55 seconds)  
**Core Goal:** Showcase the dedicated customer portal, line-level counter-offer, and the critical feedback loop: negotiated changes automatically re-trigger governance.

| Visual / Screen Action | Spoken Voiceover Narration | On-Screen Caption / Callout |
|---|---|---|
| **[2:20 - 2:40]**<br>Switch to Window 2 (Incognito): **Customer Alex Acme** at `/portal/quotations`.<br>Open the quotation.<br>Notice: Internal margins and cost structures are completely stripped out by the RBAC boundary. | "Instead of endless messy email threads, Alex from Acme logs into the dedicated Customer Portal. Notice the strict RBAC boundary: proprietary margins and supplier costs are completely hidden. Alex sees a clean, interactive commercial document." | **Dedicated Customer Portal**<br>• Zero-Trust Isolation<br>• Proprietary Margins Stripped<br>• Real-Time Collaboration |
| **[2:40 - 2:58]**<br>Alex clicks **[Negotiate / Counter-Offer]** on the Setup Service line.<br>Selects **Counter Discount Proposal**: Requests **22% discount** with comment: *"We are onboarding 50 contractors, please match our budget."*<br>Click **[Submit Request]**.<br>Status immediately updates to **UNDER_NEGOTIATION**. | "Alex wants a better deal and submits an in-portal counter-offer requesting a 22% discount on setup services. The document immediately shifts into 'Under Negotiation' state." | **In-Portal Negotiation**<br>• Line-Level Counter Proposals<br>• Instant Status State Machine |
| **[2:58 - 3:15]**<br>Switch to Window 1 (Sales Rep Workspace).<br>Sarah views the negotiation alert, reviews Alex's note, and accepts the revised terms.<br>The version increments from `v1` to `v2`.<br>Because 22% exceeds the 10% ceiling by 12 points, DealFlow360 **instantly invalidates old approvals** and routes back to Manager and Finance!<br>Quickly click Approve as Manager and Finance. | "Here is the critical self-governing loop from Section 1: Customer changes alter commercial risk. The system increments the quote version and immediately flags that previous approvals are void. The deal cannot be confirmed until re-approved. Once re-approved, Alex clicks **Confirm Quotation**." | **Self-Governing Feedback Loop**<br>⚠️ Terms Changed $\rightarrow$ Version `v2`<br>⚠️ Old Approval Invalidated<br>✓ Re-evaluated & Re-Approved<br>✓ Customer Confirmed |

---

### SEGMENT 5: Flow 2 — Multi-Warehouse Greedy Split & Backorders
**Timestamp:** `3:15 – 4:00` (45 seconds)  
**Core Goal:** Demonstrate physical inventory allocation, greedy multi-depot splitting, PostgreSQL concurrency locking, and backorder consolidation.

| Visual / Screen Action | Spoken Voiceover Narration | On-Screen Caption / Callout |
|---|---|---|
| **[3:15 - 3:35]**<br>Navigate to **Fulfillment** (`/app/fulfillment`) as Fiona Finance.<br>Open the confirmed Acme deal.<br>Show stock breakdown: Customer ordered **55 Laptop Pros**.<br>• Main Warehouse has **50** units available.<br>• East Depot has **15** units available.<br>Show DealFlow360's **Recommended Greedy Split**:<br>Shipment 1: 50 from Main Warehouse.<br>Shipment 2: 5 from East Depot. | "Now Flow 2: Commercial approval is done; physical reality begins. Acme ordered 55 Laptop Pros. But our Main Warehouse only has 50 in stock. DealFlow360 runs an intelligent greedy allocation algorithm weighted by freight costs, recommending 50 from Main Depot and 5 from East Depot." | **Multi-Warehouse Allocation**<br>• Main Warehouse: 50 Units<br>• East Depot: 5 Units<br>• PostgreSQL `SELECT FOR UPDATE` |
| **[3:35 - 3:48]**<br>Click **[Accept Recommended Split]**.<br>Show that the stock reservation executes transactionally via row-level locks (`SELECT FOR UPDATE`).<br>Highlight the **Manual Override** option for operations dispatchers. | "With row-level locking, simultaneous orders cannot double-allocate the same shelf stock. Operations can accept the split or manually override allocation targets." | **Transactional Integrity**<br>Zero Double-Reservation Risk |
| **[3:48 - 4:00]**<br>Demonstrate Backorder handling: If quantity demanded exceeds total multi-warehouse stock (e.g., 70 units), 15 units automatically generate a tracked **Backorder** record.<br>When new stock is received, click **[Consolidate Remaining Backorder]** to fulfill in full. | "When total network stock falls short, remaining quantities automatically convert to formal Backorders. As incoming inventory lands, one-click consolidation completes the shipment." | **Automated Backorder Handling**<br>• Network Shortfall Detection<br>• One-Click Backorder Consolidation |

---

### SEGMENT 6: Hybrid Billing (One-Time + SaaS Recurring) & Payment
**Timestamp:** `4:00 – 4:35` (35 seconds)  
**Core Goal:** Show how hardware and recurring SaaS coexist on one order but split cleanly into distinct billing schedules with automated proration.

| Visual / Screen Action | Spoken Voiceover Narration | On-Screen Caption / Callout |
|---|---|---|
| **[4:00 - 4:20]**<br>Navigate to **Invoices & Billing** (`/app/billing` and `/app/invoices`).<br>Display the hybrid billing view for Acme's quotation:<br>1. **One-Time Commercial Invoice:** Laptops + Setup Services ($3,000+ total).<br>2. **Recurring SaaS Subscription:** 5 Cloud Licenses at $90/mo ($450/mo recurring billing schedule). | "Next: Hybrid Billing. One order, two commercial mechanisms. DealFlow360 splits them cleanly: physical hardware and services generate an immediate commercial invoice, while the Cloud Licenses generate an active recurring subscription schedule." | **Hybrid Billing Engine**<br>• Physical Hardware: One-Time Invoice<br>• Cloud Seats: Recurring SaaS Schedule |
| **[4:20 - 4:35]**<br>Open the one-time invoice. Click **[Record Payment]**.<br>Enter Payment: Full amount via Wire Transfer.<br>Invoice status transitions instantly from **UNPAID $\rightarrow$ PAID**.<br>Click into the Subscription to show mid-cycle proration rules and automated credit note support. | "We record payment against the invoice, instantly reconciling the balance to zero. In the subscription tab, mid-cycle seat additions automatically calculate daily proration, while cancellations generate automated credit notes." | **Automated Reconciliation**<br>• Invoice Status $\rightarrow$ **PAID**<br>• Mid-Cycle Daily Proration<br>• Automated Credit Notes |

---

### SEGMENT 7: Deal Health Anomaly Engine, Reporting & Closing Pitch
**Timestamp:** `4:35 – 5:00` (25 seconds)  
**Core Goal:** Conclude with the parallel monitoring layer (Deal Health), management analytics, and the forward-looking vision.

| Visual / Screen Action | Spoken Voiceover Narration | On-Screen Caption / Callout |
|---|---|---|
| **[4:35 - 4:50]**<br>Navigate to **Deal Health Dashboard** (`/app/deal-health`).<br>Show real-time anomaly cards:<br>• **Stalled Deals** (>14 days inactive).<br>• **Discount Anomalies** (Rep discounting 2.5x historical average).<br>• **Delivery Slippage** warnings.<br>Click **[Nudge Rep]** on a stalled deal.<br>Quickly show **Reporting Page** (`/app/reporting`) with PDF/XLS export. | "Throughout this entire lifecycle, our background Deal Health engine runs in parallel — detecting stalled deals, discount anomalies, and delivery slippage before revenue leaks. Managers can trigger automated rep nudges or export filtered reports to Excel and PDF." | **Deal Health & Anomaly Engine**<br>• Stalled Deal Alerts<br>• Rep Discount Outlier Detection<br>• One-Click Nudge & PDF/XLS Export |
| **[4:50 - 5:00]**<br>Return to the main DealFlow360 dashboard or title card.<br>Presenter delivery with high energy and confidence. | "DealFlow360 transforms static quotation forms into a living, self-governing sales operating system. Thank you!" | **DealFlow360**<br>*Built with React, Node.js, Prisma & PostgreSQL*<br>Thank You! |

---

## 4. One-Page System Architecture & Data Model Diagram

```
                              ┌─────────────────────────────────────────────────────────────┐
                              │                    DEALFLOW360 ARCHITECTURE                 │
                              └─────────────────────────────────────────────────────────────┘

       SALES REPS & MANAGERS                                                        CUSTOMERS (PORTAL)
   (Sarah Sales, Mike Manager, Fiona)                                                  (Alex Acme)
                 │                                                                          │
                 ▼                                                                          ▼
      ┌──────────────────────┐                                                   ┌──────────────────────┐
      │  Internal Workspace  │                                                   │   Customer Portal    │
      │   (/app/* Routes)    │                                                   │  (/portal/* Routes)  │
      └──────────┬───────────┘                                                   └──────────┬───────────┘
                 │                                                                          │
                 │              Role-Based Access Control (RBAC) & Tenant Boundary          │
                 └──────────────────────────────┬───────────────────────────────────────────┘
                                                │
                                                ▼
     ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
     │                                EXPRESS API GATEWAY / SERVICES                                │
     ├───────────────────────────────┬───────────────────────────────┬──────────────────────────────┤
     │       COMMERCIAL CORE         │      CUSTOMER & INVENTORY     │      BILLING & ANALYTICS     │
     │ ───────────────────────────── │ ───────────────────────────── │ ──────────────────────────── │
     │ • CPQ & Line Pricing          │ • Portal Negotiation Engine   │ • Hybrid Invoicing (1-time)  │
     │ • Blended Risk Algorithm      │ • Greedy Split Allocation     │ • SaaS Subscription Manager  │
     │ • Multi-Step Approval Router  │ • PostgreSQL Concurrency Lock │ • Mid-Cycle Proration Engine │
     │ • Co-Purchase Upsell Engine   │ • Backorder Consolidation     │ • Deal Health Anomaly Worker │
     │ • Contract 1: evaluateAndRoute│ • Contract 3: createFromConf  │ • Sales & Audit Reporting    │
     └───────────────────────────────┴──────────────┬────────────────┴──────────────────────────────┘
                                                    │
                                                    ▼
     ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
     │                                 PRISMA ORM / POSTGRESQL DATABASE                             │
     ├──────────────────────────────────────────────────────────────────────────────────────────────┤
     │  [Customer] 1───* [Quotation] 1───* [QuotationLine] *───1 [Product] 1───* [ProductVariant]   │
     │       │                │                    │                  │                             │
     │       │                ├── 1──* [Approval]  ├── 1──* [Alloc]   ├── 1──* [StockLevel]         │
     │       │                │                    │                  │            │                │
     │  [DiscountTier]        ├── 1──* [Negotiate] └── 1──* [Backord] └── *───1 [Warehouse]        │
     │       │                │                                                                     │
     │  [CategoryCeiling]     ├── 1──* [Invoice] 1───* [Payment]                                    │
     │                        │                                                                     │
     │                        └── 1──* [Subscription] 1───* [SubscriptionProration]                │
     └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. "What We Would Build Next" (Hackathon Deliverable)

With additional development cycles, the DealFlow360 engineering roadmap targets four high-impact enterprise extensions:

1. **AI-Powered Dynamic Price Elasticity & Win-Probability Guidance:**  
   Replace static discount thresholds with machine-learning pricing guidance trained on win/loss ratios, seasonal buying patterns, and deal size, providing reps with real-time "deal win probability vs margin" trade-off curves.
2. **ERP & 3PL Integration Hub (SAP, NetSuite, ShipStation):**  
   Replace simulated warehouse allocations with bidirectional live EDI/REST connectors to enterprise 3PLs and ERPs, supporting real-time tracking numbers, carrier rate shopping, and warehouse pick-list generation.
3. **Automated Supplier Purchase Order (PO) Dropship for Backorders:**  
   When warehouse stock hits zero and a backorder is created, trigger automated EDI 850 purchase orders to hardware distributors (e.g., Ingram Micro, TD Synnex) for just-in-time dropshipping.
4. **Multi-Currency Hedging & Tax Compliance Automation:**  
   Add real-time currency conversion with forward rate locking for international quotations, paired with automated AvaTax / Stripe Tax calculations across varying state and cross-border jurisdictions.

---

## 6. Quick Presenter Runbook & Troubleshooting

### Smooth Flow Checklist
1. **Pre-populate the browser tabs** before hitting record:
   - Tab 1: Sarah Sales (`rep@demo.com`) on Quotation List
   - Tab 2: Mike Manager (`manager@demo.com`) on Approvals
   - Tab 3: Fiona Finance (`finance@demo.com`) on Approvals / Fulfillment
   - Tab 4 (Incognito): Alex Acme (`customer@acme.com`) on Portal Quotations
2. **Typing & Mouse Movement:**
   - Keep cursor movements smooth and deliberate.
   - Zoom browser to 110% for crisp, legible UI elements on 1080p video.
3. **Pacing Rules:**
   - Don't rush the Blended Risk and Negotiation sections — these are the core intellectual property of DealFlow360 that differentiate it from basic CRUD apps.
