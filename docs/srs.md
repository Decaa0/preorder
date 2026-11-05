# SRS — CampusBites Pre-Order (CPE 334, Theme 4: E-Commerce / Ordering)

## 1. Stakeholder problem and context
Small food stalls in a university canteen lose time to queues at lunch. Students want to pre-order food before they arrive; stall staff want a clear list of incoming orders to accept and prepare. Context chosen: **food pre-orders for a campus canteen with two stalls**. Real payments are excluded; payment is a simulated status.

## 2. Actors
| Actor | Responsibility |
|---|---|
| Customer | Browses menu, places orders, views own orders, (later) cancels |
| Operator | Works for exactly one stall; views and accepts incoming orders for that stall, (later) fulfils orders, edits that stall's catalog |
| System | Computes prices, enforces rules, persists data |

## 3. Scope and exclusions
In scope: menu browsing, order placement with multiple line items, order lifecycle, simulated payment status, per-stall operator scope, sales summaries.
Excluded: real payments, delivery, self-registration, password recovery, email/SMS, multiple roles per account, multi-stall orders.

## 4. Functional requirements
| ID | Requirement | Sprint |
|---|---|---|
| FR-01 | A user logs in with email+password and receives a session token; invalid credentials are rejected | 1 |
| FR-02 | A logged-in user can retrieve their own identity (id, name, role, stall) | 1 |
| FR-03 | A user can log out; the token is then unusable | 1 |
| FR-04 | A customer can view the menu (available items, price, stall) | 1 |
| FR-05 | A customer can submit an order of 1+ line items (menu item + quantity) | 1 |
| FR-06 | A customer can list their orders and open the detail of one of their orders | 1 |
| FR-07 | An operator can list incoming orders of their own stall | 1 |
| FR-08 | An operator can accept a PLACED order of their stall | 1 |
| FR-09 | An operator can move an accepted order to PREPARING, READY, COMPLETED | 2 |
| FR-10 | A customer can cancel an order while it is still PLACED | 2 |
| FR-11 | An operator can create/edit menu items and toggle availability for their stall | 2 |
| FR-12 | Simulated payment: order has paymentStatus PENDING/PAID/REFUNDED; operator marks PAID | 2 |
| FR-13 | Operator sees sales summary (orders per status, revenue of completed orders, top items) | 3 |
| FR-14 | Customer can filter their order history by status/date | 3 |
| FR-15 | Operator can filter/search incoming orders | 3 |

## 5. Business rules
| ID | Rule | Sprint |
|---|---|---|
| BR-01 | Order total is computed on the server from authoritative menu prices; client-supplied prices/totals are ignored | 1 |
| BR-02 | Each line quantity must be an integer from 1 to 10 | 1 |
| BR-03 | An order must contain 1 to 10 lines; a menu item may appear at most once per order | 1 |
| BR-04 | An unavailable or unknown menu item cannot be ordered | 1 |
| BR-05 | All lines of one order must belong to the same stall | 1 |
| BR-06 | Unit price and item name are copied into the order line at order time; later menu price changes do not alter existing orders | 1 |
| BR-07 | Customers can access only their own orders | 1 |
| BR-08 | Operators can access/accept only orders of their own stall | 1 |
| BR-09 | Only a PLACED order can be accepted (PLACED → ACCEPTED); any other state is a conflict | 1 |
| BR-10 | Only customers place orders; only operators accept orders | 1 |
| BR-11 | Allowed lifecycle: PLACED→ACCEPTED→PREPARING→READY→COMPLETED; PLACED→CANCELLED; no other transitions | 2 |
| BR-12 | Cancellation after acceptance is not allowed | 2 |
| BR-13 | Price changes require operator of that stall; price must be > 0 | 2 |

## 6. Non-functional requirements
| ID | Requirement (measurable) | Verification | Sprint |
|---|---|---|---|
| NFR-01 | Unauthenticated request to any protected endpoint returns 401 and no private data | API test | 1 |
| NFR-02 | Passwords stored only as bcrypt hashes (cost ≥ 10); no plaintext in DB | DB integration test | 1 |
| NFR-03 | Session tokens expire after 8 hours and are revoked on logout | API test (logout) / unit test (expiry) | 1 |
| NFR-04 | Order placement and order listing respond in < 500 ms for seeded data on a dev laptop | Manual timing + test timing assertion | 3 |
| NFR-05 | All API errors use the shape `{ "error": { "code", "message" } }` with no stack traces | API test | 1 |
| NFR-06 | Application is configurable only by environment variables; no secrets in Git | Review + README check | 1 |
| NFR-07 | UI works at 360 px and 1280 px width | Manual check | 3 |
| NFR-08 | Order creation is atomic: header and all lines are saved together or not at all | DB integration test | 1 |

## 7. Assumptions, decisions, questions
| ID | Item | Resolution |
|---|---|---|
| D-01 | Context | Food pre-orders, 2 stalls; Sprint 1 theme example allows merchandise/food |
| D-02 | Money | Integer satang/cents (`priceCents`) to avoid float errors; displayed as ฿ |
| D-03 | Operator scope | One stall per operator (`stallId`), matches "operators within specified scope" |
| D-04 | Cross-user access | Return 404 (not 403) for another customer's order so existence is not leaked |
| D-05 | Session | JWT with `jti`; server keeps Session row; logout sets `revokedAt`; every request checks the row |
| D-06 | Stack | React + Vite, Express, Prisma, SQLite (local), same as TokTickIT; Postgres-capable by changing the Prisma provider for Cloud deployment |
| D-07 | Order edit after submit | Not allowed; cancel instead (Sprint 2) |
| Q-01 | Is quantity limit 10 per line okay? | Assumed yes (food pre-order); recorded as BR-02 |
| Q-02 | Concurrent stock | No stock count; availability is a boolean toggle (stock tracking out of scope) |
