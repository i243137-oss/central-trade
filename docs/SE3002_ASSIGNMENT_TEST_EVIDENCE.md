# SE3002: Software Quality Engineering — Assignment #01
## Formal Test Case Sheet & Evidence Template

**Academic Project:** Central Trading System (CTS)
**Specification:** CTS Software Requirements Specification (SRS Version 1.0, 2007)
**Evaluation Scope:** Requirements R01 – R10

---

## How to use this document

This is a **template**, not a finished report. Every "Actual Result" field below
is intentionally blank. To complete it:

1. Start the backend against a real MongoDB (`npm start`), and the frontend if a
   test case needs it (`npm run dev`).
2. Run the case (via the automated scripts below, Postman/curl, or the UI) and
   paste the **real** response body / HTTP status / screenshot into the blank.
3. Only then mark a **Verdict** (PASS / FAIL / BLOCKED).

**Do not fill in a result you did not actually observe.** An examiner can run
any of these cases themselves in seconds; a plausible-sounding but unverified
result is worse than an empty template, because it reads as fabricated
evidence rather than an honest gap.

Two automated scripts already exist and can be used as regression aids
alongside your manual verification — they are not a substitute for the manual
BVA/ECP cases below, since they only assert a fixed set of scenarios:

```bash
npm run test        # server/test/systemVerification.js — R01–R07, R10 smoke scenarios
npm run test:deep   # server/test/r03_r06_deepVerification.js — R03 priority + R06 concurrency
```

Every error code, HTTP status, and message referenced below was checked
directly against the current source (`server/controllers/`,
`server/services/`) as of this document's last edit — not guessed. If you
change the code afterward, re-check before relying on this sheet.

---

## 1. Requirements Traceability Matrix (RTM)

Fill in the **Verdict** column only after you've actually run the assigned
test cases.

| Req ID | SRS Description | Assigned Test Cases | Verdict |
| :--- | :--- | :--- | :--- |
| **R01** | Buy/Sell Stock Instruction Submission | `TC-BVA-01`, `TC-BVA-02`, `TC-ERR-01`, `TC-SYS-01` | |
| **R02** | Cancel Instruction with Fund Release & Exception Handling | `TC-ERR-02`, `TC-ERR-03`, `TC-SYS-01` | |
| **R03** | Continuous Double-Auction Matching (Price-Time Priority) | `TC-SYS-02` | |
| **R04** | Price Limits Validation (Rising/Falling Limits) | `TC-BVA-01`, `TC-BVA-02` | |
| **R05** | 24-Hour Outdated Instruction Sweep | `TC-BVA-04`, `TC-SYS-03` | |
| **R06** | Atomic Buyer Fund Freezing & Settlement | `TC-BVA-03`, `TC-SYS-04` | |
| **R07** | Structured Query Interfaces (User & Stock) | `TC-SYS-01`, `TC-SYS-03` | |
| **R08** | Capacity-Conscious Implementation | Runtime/load evaluation (Section 3) | |
| **R09** | Modularity & Maintainability (CRC Card Alignment) | Static inspection / SonarQube (Section 4) | |
| **R10** | Role-Based Access Control (`USER` vs `SYSTEM_MANAGER`) | `TC-ERR-02`, `TC-SYS-03` | |

---

## 2. Formal Functional Test Cases

### Category A: Boundary Value Analysis (BVA)

#### TC-BVA-01: Rising Limit Boundary
- **Requirement:** R01, R04
- **Objective:** An order at exactly the rising limit is accepted; one cent above is rejected.
- **Pre-conditions:** Stock `AAPL` — rising limit $105.00.
- **Input Data:**
  - Case 1.1: `stockId: 'AAPL'`, `type: 'BUY'`, `quantity: 10`, `respectedPrice: 105.00`
  - Case 1.2: `stockId: 'AAPL'`, `type: 'BUY'`, `quantity: 10`, `respectedPrice: 105.01`
- **Expected Result:**
  - Case 1.1: HTTP 201; instruction status `PENDING`.
  - Case 1.2: HTTP 400; `errorCode: "RISING_LIMIT_EXCEEDED"`.
- **Actual Result:** _(paste real response here)_
- **Verdict:** _(PASS / FAIL)_

#### TC-BVA-02: Falling Limit Boundary
- **Requirement:** R01, R04
- **Objective:** An order at exactly the falling limit is accepted; one cent below is rejected.
- **Pre-conditions:** Stock `AAPL` — falling limit $95.00.
- **Input Data:**
  - Case 2.1: `stockId: 'AAPL'`, `type: 'SELL'`, `quantity: 10`, `respectedPrice: 95.00`
  - Case 2.2: `stockId: 'AAPL'`, `type: 'SELL'`, `quantity: 10`, `respectedPrice: 94.99`
- **Expected Result:**
  - Case 2.1: HTTP 201.
  - Case 2.2: HTTP 400; `errorCode: "FALLING_LIMIT_EXCEEDED"`.
- **Actual Result:** _(paste real response here)_
- **Verdict:** _(PASS / FAIL)_

#### TC-BVA-03: Exact Available Balance Exhaustion
- **Requirement:** R01, R06
- **Objective:** A BUY order requiring the exact available balance succeeds and leaves `availableBalance = 0.00`; a further order of any amount is rejected.
- **Pre-conditions:** Trader available balance set to a known value (use `POST /api/manager/set-balance` as `SYSTEM_MANAGER`, or seeded demo balance).
- **Input Data:**
  - Case 3.1: BUY quantity × price = exactly the available balance.
  - Case 3.2: Immediate follow-up BUY of any positive amount.
- **Expected Result:**
  - Case 3.1: HTTP 201; `availableBalance` becomes `0.00`, `frozenBalance` increases by the same amount.
  - Case 3.2: HTTP 400; `errorCode: "INSUFFICIENT_FUNDS"`.
- **Actual Result:** _(paste real response here)_
- **Verdict:** _(PASS / FAIL)_

#### TC-BVA-04: 24-Hour Outdated Expiration Threshold
- **Requirement:** R05
- **Objective:** An instruction older than 24 hours is swept to `EXPIRED`; one under 24 hours is not.
- **Pre-conditions:**
  - Instruction A: created with a `timestamp` more than 24 hours in the past (the frontend's "Override Timestamp" helper on the Trade page, or a direct `timestamp` field in the request body, can set this).
  - Instruction B: created with a `timestamp` less than 24 hours in the past.
- **Execution:** `POST /api/manager/outdated-sweep` (as `SYSTEM_MANAGER`; body `{ "maxAgeHours": 24 }` or omit for the default).
- **Expected Result:**
  - Instruction A: status becomes `EXPIRED`, `remainingQuantity` set to 0, any frozen BUY funds released back to `availableBalance`. A `INSTRUCTION_EXPIRED` log entry is written (with an `ageHours` field, not a fixed "reason" string).
  - Instruction B: remains `PENDING`/`PARTIALLY_FINISHED`, unaffected.
- **Actual Result:** _(paste real response + `GET /api/instructions/:id` for both instructions here)_
- **Verdict:** _(PASS / FAIL)_

---

### Category B: Invalid Input & Exception Handling

#### TC-ERR-01: Non-Positive / Non-Integer Quantity
- **Requirement:** R01
- **Objective:** Zero, negative, and non-numeric quantities are all rejected before any database write.
- **Input Data:**
  - Case 5.1: `quantity: 0`
  - Case 5.2: `quantity: -50`
  - Case 5.3: `quantity: "abc"`
- **Expected Result:** All three: HTTP 400; `errorCode: "INVALID_QUANTITY"`. No instruction created, no funds frozen.
- **Actual Result:** _(paste real response for each case here)_
- **Verdict:** _(PASS / FAIL)_

#### TC-ERR-02: Unauthorized Cross-User Cancellation
- **Requirement:** R02, R10
- **Objective:** A user cannot cancel another user's instruction.
- **Pre-conditions:** Trader A owns a `PENDING` instruction. Trader B is authenticated separately.
- **Execution:** Trader B calls `PATCH /api/instructions/:id/cancel` on Trader A's instruction ID.
- **Expected Result:** HTTP 400 (not 403 — this endpoint returns all business-rule failures as 400); `errorCode: "UNAUTHORIZED_CANCELLATION"`. Trader A's instruction status and frozen funds are unchanged.
- **Actual Result:** _(paste real response here)_
- **Verdict:** _(PASS / FAIL)_

#### TC-ERR-03: Cancellation of an Already-Finished Instruction
- **Requirement:** R02
- **Objective:** An instruction that already reached `TOTALLY_FINISHED` cannot be cancelled.
- **Pre-conditions:** An instruction that has fully matched (e.g. via `TC-SYS-02` below).
- **Execution:** `PATCH /api/instructions/:id/cancel` on that instruction.
- **Expected Result:** HTTP 400; `errorCode: "ALREADY_IMPLEMENTED"`.
- **Actual Result:** _(paste real response here)_
- **Verdict:** _(PASS / FAIL)_

#### TC-ERR-04: Order Submission During Suspended Operations
- **Requirement:** SRS 2.2.2 exception flow
- **Objective:** While the system manager has suspended operations, new order submissions (and cancellations) are blocked.
- **Pre-conditions:** `POST /api/manager/suspend` with `{ "suspended": true }` (as `SYSTEM_MANAGER`).
- **Execution:** A trader submits a valid, in-limits BUY order.
- **Expected Result:** HTTP 400 (not 503); `errorCode: "OPERATIONS_SUSPENDED"`.
- **Actual Result:** _(paste real response here — remember to resume operations afterward with `{ "suspended": false }`)_
- **Verdict:** _(PASS / FAIL)_

Other error codes you may want to exercise in additional cases you write
yourself (all verified present in the current code, exact codes to assert
against): `STOCK_NOT_FOUND`, `MISSING_STOCK_ID`, `ACCOUNT_NOT_FOUND`,
`INVALID_AMOUNT`, `MISSING_FIELDS`, `INVALID_LIMITS`, `USER_ALREADY_EXISTS`,
`INVALID_CREDENTIALS`, `UNAUTHORIZED_QUERY`, `ALREADY_CANCELLED`,
`ALREADY_EXPIRED`, `ACCESS_DENIED_ROLE` (403, from `requireRole`),
`UNAUTHORIZED`/`FORBIDDEN_TOKEN` (401/403, from `authenticateToken`).

---

### Category C: System-Level User Journeys

#### TC-SYS-01: End-to-End Order → Freeze → Cancel → Release
- **Requirement:** R01, R02, R06, R07
- **Objective:** Full lifecycle through the UI: log in, note available balance, place a BUY order, confirm the balance dropped by exactly the order value and frozen balance rose by the same amount, cancel the order, confirm balance is fully restored.
- **Execution Environment:** React frontend (`npm run dev`, port 5173) + backend (port 3000).
- **Expected Result:** Balance card updates after each action; cancelled order shows status `CANCELLED` with `remainingQuantity: 0`; `availableBalance` returns to its pre-order value exactly.
- **Actual Result:** _(paste before/after balance values and a screenshot reference here)_
- **Verdict:** _(PASS / FAIL)_

#### TC-SYS-02: Price-Time Priority Matching
- **Requirement:** R03
- **Objective:** Verify price-first, then time-first matching, using a dedicated stock so no other pending orders interfere.
- **Execution:** This exact scenario (plus the sell-side and time-priority variants) is already implemented as an automated script: `npm run test:deep` (`server/test/r03_r06_deepVerification.js`, Test Suites 1–2b). Run it and record the console output.
- **Expected Result:** Higher-priced BUY matches first regardless of submission order; equal-priced orders match in submission-time order; lower-priced SELL matches first.
- **Actual Result:** _(paste the console output of `npm run test:deep` here, or run the scenario manually and paste that instead)_
- **Verdict:** _(PASS / FAIL)_

#### TC-SYS-03: Manager Terminal & Outdated Sweep
- **Requirement:** R05, R07, R10
- **Objective:** Manager overview (`GET /api/manager/overview`) returns global stats; outdated sweep marks expired orders and releases frozen funds; a normal `USER` is rejected from these endpoints.
- **Execution:** As `SYSTEM_MANAGER`: call `/api/manager/overview`, `/api/manager/outdated-sweep`. As `USER`: repeat the same calls.
- **Expected Result:** Manager calls return HTTP 200 with data; `USER` calls return HTTP 403; `errorCode: "ACCESS_DENIED_ROLE"`.
- **Actual Result:** _(paste real responses for both roles here)_
- **Verdict:** _(PASS / FAIL)_

#### TC-SYS-04: Concurrent Fund-Freezing Race Condition
- **Requirement:** R06
- **Objective:** Two simultaneous BUY orders that together exceed the available balance must not both succeed, and the balance must never go negative.
- **Execution:** Already implemented as an automated script: `npm run test:deep`, Test Suite 3. It uses `POST /api/manager/set-balance` (manager-only helper endpoint, not part of R01–R10 itself — used only to set up a known starting balance for this test) to fix the account at $10,000, then fires two concurrent $7,000 BUY orders via `Promise.all`.
- **Expected Result:** Exactly one order accepted (HTTP 201), one rejected (HTTP 400, `errorCode: "INSUFFICIENT_FUNDS"`). Final state: `availableBalance = 3000.00`, `frozenBalance = 7000.00`, `totalBalance = 10000.00` — never negative.
- **Actual Result:** _(paste the console output of `npm run test:deep` here)_
- **Verdict:** _(PASS / FAIL)_

> **Note on R06 concurrency:** the fund-freeze itself is a single atomic MongoDB
> `findOneAndUpdate` with a `$gte` guard (no application-level mutex/lock —
> there isn't one in this codebase, despite what an earlier draft of this
> document claimed). Trade settlement (`executeTradeSettlement`) is wrapped in
> a MongoDB session transaction that only actually runs on a replica-set /
> Atlas deployment; on a standalone `mongod` it falls back to sequential
> writes with a logged warning. If you want to test the transactional path
> specifically, run MongoDB as a single-node replica set (see the README's
> "Trade settlement transaction" section) — otherwise TC-SYS-04 above is still
> valid evidence for the freeze itself, just not for the transaction fallback
> boundary.

---

## 3. R08 — Capacity / Runtime Evaluation

The SRS does not specify a numerical capacity threshold, so this section
records what you actually measured, not an invented target.

**Suggested tool:** `autocannon` (`npm install -g autocannon`) or `k6`/`artillery`.

**Suggested commands** (run against a live backend on a real MongoDB):
```bash
autocannon -c 20 -d 15 -m GET -H "Authorization: Bearer <token>" http://localhost:3000/api/queries/user?queryContent=ALL
autocannon -c 20 -d 15 -m POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -b '{"stockId":"AAPL","type":"BUY","quantity":1,"respectedPrice":100}' http://localhost:3000/api/instructions
```

| Endpoint | Concurrency | Duration | Req/sec (avg) | Latency p99 | Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /api/queries/user` | | | | | |
| `POST /api/instructions` | | | | | |

**Machine specs used for the above:** _(CPU, RAM, OS — results are only meaningful with context)_

**Conclusion:** _(state plainly: this is indicative of a development machine,
not a production capacity guarantee)_

---

## 4. R09 — Static Inspection / SonarQube

No SonarQube scan has been run against this codebase as part of this
document. Run one yourself (SonarCloud is free for public/GitHub repos, or
SonarQube Community Edition via Docker), then fill in the table below with
the real dashboard values.

| Quality Metric | Actual Value | Source |
| :--- | :--- | :--- |
| Security Rating | | |
| Reliability Rating | | |
| Maintainability Rating | | |
| Duplicated Lines % | | |
| Code Smells (count) | | |
| Bugs (count) | | |
| Vulnerabilities (count) | | |

Link to the SonarCloud/SonarQube dashboard or attach a screenshot here:
_(paste link/screenshot)_

---

## 5. Defect Log

Log only defects you actually observed while executing the cases above.
Leave this table empty if you found none — an empty table is honest; an
invented row is not.

| Issue ID | Summary | Requirement | Severity | Status |
| :--- | :--- | :--- | :--- | :--- |
| | | | | |

If you use a real issue tracker (Jira, GitHub Issues, etc.), link the actual
issue here instead of duplicating its content.
