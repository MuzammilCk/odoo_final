# DealFlow360 — How To Use The Control Files
**For the whole team. Read this one first, before opening anything else.**

---

## What you have

Two kinds of documents now exist for this project:

1. **The locked spec** — Sections 1–8 + the Excalidraw wireframe. What the product *is*. Written and frozen before any code. Nobody edits these mid-hack.
2. **The team execution files** (this folder — `docs/team/`) — *how* the three of you build it in the time you have left, without stepping on each other. These are working documents; update the tracker as you go.

## The locked spec chain

```text
1. Problem Restatement
        ↓
2. Actors / Roles
        ↓
3. Core Use Cases
        ↓
4. Entities / Relationships
        ↓
5. Database Schema
        ↓
6. Business Rules / State Transitions
        ↓
7. API Surface / Operations
        ↓
8. Technology Choice
        ↓
   IMPLEMENTATION  ← you are here
```

Each section exists because the one before it wasn't enough to start coding from. Every section ends with an "**Official Status: LOCKED**" line — if it's locked, it's decided. Implement it as written; don't relitigate it at 2 AM.

## What to actually read, and how deep

Nobody has time to read all ~230 KB of spec today. Be honest about this:

| Everyone reads in full | Skim once | Read only your own slice, as reference |
|---|---|---|
| Section 1 (5 min — you'll need this for judges' Q&A regardless of what you built) | Section 2 (Actors) — role boundaries show up in every lane's auth checks | Section 5 (Database Schema) |
| This file | Section 3 (Use Cases) | Section 6 (Business Rules) |
| `01_Team_Role_Division.md` | Section 8 §8.41–8.42 (build order + slices) | Section 7 (API Surface) |

Sections 5, 6, and 7 are reference material — pull up the exact table, rule, or endpoint for whatever you're building *right now*. Your own `0X_Plan_Lane_X.md` already extracts the parts of each that are yours, so most of the time you won't need to open the Section files at all.

## When something seems wrong or missing

Section 8.46 (rule 30) says it directly: when implementation conflicts with a locked file, **stop and resolve the conflict — don't silently change the code or the doc.** In practice, during a 24-hour build, that means: flag it in your team chat, get a 30-second group decision, then keep moving. Don't quietly reinterpret a rule solo — that's exactly how two lanes end up with incompatible assumptions that only surface at integration.

## The micro-step rule (read this — it affects how you use every other file)

This is a hackathon **final round** — judges will ask you to explain your code. You must own every line. "My AI wrote it" is not an acceptable answer.

Every lane plan is broken into **micro-steps** following a LEARN → BUILD → VERIFY cycle:

- **LEARN:** Read the exact spec section referenced. Understand *why* before building. 2–5 minutes.
- **BUILD:** Implement one small, isolated piece. Tell your coding agent to build *only this piece*. Each micro-step should produce roughly 30–80 lines of new code.
- **VERIFY:** Run it. Test it with curl/Postman/browser. Confirm the output matches your expectation.
- **EXPLAIN CHECK:** Each micro-step includes a question you should be able to answer out loud. If you can't answer it, re-read the code before moving on.

**Do NOT let your coding agent build an entire feature in one prompt.** If a prompt produces 200+ lines you can't explain, you've gone too far. Break it up.

The starting prompts file (`06_Starting_Prompts_All.md`) has individual copy-paste prompts for each micro-step — paste one, read the output, verify, then paste the next.

---

## Where the wireframe fits in

The Excalidraw file is 18 numbered screens (frames). It's the visual truth for what the UI shows; the 8 Sections are the truth for what the system must guarantee. Where they disagree on a small detail — e.g. the wireframe shows "Quantity on hand" as an integer field, but Section 5 stores stock as `NUMERIC(18,4)` — Section 5 already flags this as intentional (storage stays flexible; the UI can restrict input to whole numbers). That's the general pattern: **wireframe = what it looks like, Sections = what it must do. Trust the Section when they conflict.**

Screen list, for quick reference (full field-by-field breakdown of each is inside the owning lane's own plan file):

| # | Screen | Owner |
|---|---|---|
| 1 | Login / Signup | Lane A |
| 2 | Sales Dashboard | Lane A |
| 3 | Quotations List | Lane A |
| 4 | Quotation Detail | Lane A |
| 5 | Approvals List | Lane A |
| 6 | Approval Detail | Lane A |
| 7 | Fulfillment List | Lane B |
| 8 | Fulfillment Detail | Lane B |
| 9 | Subscriptions List | Lane C |
| 10 | Billing Detail | Lane C |
| 11 | Customer Portal | Lane B |
| 12 | Invoices List | Lane C |
| 13 | Invoice Detail | Lane C |
| 14 | Deal Health Dashboard | Lane C |
| 15 | Admin Reporting | Lane C |
| 16 | Product Dashboard | Lane C |
| 17 | Product Details Page | Lane C |
| 18 | Discount Tiers & Approval Chain Setup | Lane A |

## Quick-reference: which document answers which question

| Question | Go to |
|---|---|
| "Who's allowed to do X?" | Section 2 |
| "What's the exact business flow for X?" | Section 3 |
| "What entity/table holds X?" | Section 4, then Section 5 for exact columns |
| "What are the exact column types/constraints?" | Section 5 |
| "What's the exact formula/threshold/algorithm for X?" | Section 6 (marked *implementation decision* wherever the source didn't fix a number) |
| "What's the endpoint, method, request/response shape?" | Section 7 |
| "What library/pattern should I use?" | Section 8 |
| "Who on the team owns this?" | `01_Team_Role_Division.md` |
| "What do I build, in what order, by when?" | `02_Implementation_Tracker.md` or your own `0X_Plan_Lane_X.md` |

## The other team files

- **`01_Team_Role_Division.md`** — the 3-way split, exact ownership boundaries, and the 5 cross-lane contracts that let all three of you build in parallel even though the business flow itself is sequential.
- **`02_Implementation_Tracker.md`** — shared master checklist: foundation setup, timeline, integration checkpoints, judging-criteria cross-check.
- **`03_Plan_Lane_A_Commercial_Core.md`** — fully self-contained plan for Lane A.
- **`04_Plan_Lane_B_Fulfillment_and_Customer_Loop.md`** — fully self-contained plan for Lane B.
- **`05_Plan_Lane_C_Money_and_Monitoring.md`** — fully self-contained plan for Lane C.
- **`06_Starting_Prompts_All.md`** — copy-paste starting prompts for each person's coding agent.

Each lane plan is self-contained — you shouldn't need to open either of the other two.

## One small note

The Excalidraw file has a handful of stray text elements sitting outside any frame that look like an unrelated JavaScript snippet (something about caching a computed style property) — leftover scratch content, not part of the product flow. Safe to ignore or delete from the board; it wasn't used anywhere in these team files.

---

## Teammate Bootstrap (after F1–F4 are pushed to main)

> **Read this when you join after the foundation is pushed.**

1. **Pull main** — foundation is already scaffolded and verified:
   ```bash
   git pull origin main
   ```

2. **Install dependencies** (all workspaces from root):
   ```bash
   npm install
   ```

3. **Copy environment file** and fill in your Postgres connection string:
   ```bash
   cp .env.example .env
   # Edit .env: set DATABASE_URL to your local Postgres
   ```

4. **Apply migrations** (schema already created — just sync your DB):
   ```bash
   npx prisma migrate dev
   ```

5. **Seed the database** (demo users, products, quotations, warehouses):
   ```bash
   npx prisma db seed
   ```

6. **Verify everything boots:**
   ```bash
   npm run dev        # starts both apps/api (port 3001) and apps/web (port 5173)
   ```
   Then:
   - `GET http://localhost:3001/api/v1/health` → `{ "status": "ok" }`
   - `http://localhost:5173` → redirects to `/login`

7. **Cut your branch and start your lane:**
   ```bash
   git checkout -b lane-b   # or lane-c
   ```
   Open your `0X_Plan_Lane_X.md` and start from the first unchecked micro-step.

### Foundation status (updated 2026-09-05)

| Step | Status | Notes |
|---|---|---|
| F1 — Monorepo scaffold | ✅ Done | API health ✓, web build ✓ |
| F2 — Prisma schema | ✅ Done | 25 tables, migration `20260905133716_init` applied |
| F3 — Seed data | ✅ Done | 6 users, 5 quotations, backorder, subscription |
| F4 — Auth + RBAC + Layouts | ✅ Done | JWT login ✓, /me ✓, AppLayout + PortalLayout ✓ |

