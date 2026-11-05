# Sprint 1 Engineering Contracts (v1.0 — written before implementation)

Revision history: see §8. Product: TeaPreorder (HeyTea-style drink pre-order). Linked requirements: see docs/srs.md, docs/traceability.md.

Seed data (synthetic): Stores: *Siam Branch* (S1), *Ladprao Branch* (S2). Users (password for all in README, local only): `alice@demo.test`, `bob@demo.test` (CUSTOMER); `siam@demo.test` (OPERATOR S1); `ladprao@demo.test` (OPERATOR S2). Menu: Jasmine Milk Tea ฿60 (S1), Cheese Berry Tea ฿70 (S1), Sold-out Mango Tea ฿50 unavailable (S1), Thai Milk Tea ฿35 (S2), Iced Americano ฿45 (S2).

## F-01 Authentication and session
**Requirements:** FR-01, FR-02, FR-03, NFR-01, NFR-02, NFR-03, NFR-05.
**Behaviour:** `POST /api/auth/login {email,password}` → 200 `{token, user:{id,fullName,role,storeId}}`; wrong email/password → 401 `INVALID_CREDENTIALS` (same message for both). `GET /api/auth/me` → 200 user. `POST /api/auth/logout` → 204; Session.revokedAt set; later use of the token → 401 `UNAUTHENTICATED`. Missing/invalid/expired/revoked token → 401. Missing body fields → 400.
**Data:** User, Session tables (see System SDS). **UI:** Login form; logout button; role-based landing screen.
**Permissions:** login public; others any authenticated user.

## F-02 Browse menu
**Requirements:** FR-04, BR-04. `GET /api/menu` → 200 `[{id,name,priceCents,store:{id,name}}]` for available items only. Auth required. **UI:** menu grouped by store with Add buttons. **Data:** no change beyond MenuItem.

## F-03 Place order
**Requirements:** FR-05, BR-01..BR-06, BR-10, NFR-08.
`POST /api/orders` body `{items:[{menuItemId, quantity}]}` (any `price`/`total` fields are ignored). Customer only.
Validation order: auth → role → body shape → 1..10 lines (BR-03) → no duplicate menuItemId (BR-03) → quantity integer 1..10 (BR-02) → items exist and available (BR-04) → one store (BR-05). Success → 201 order:
`{id,status:"PLACED",paymentStatus:"PENDING",totalCents,store,createdAt,items:[{menuItemId,itemName,unitPriceCents,quantity,lineTotalCents}]}`.
Total = Σ unitPrice×qty from DB prices (BR-01); name and unit price are copied (BR-06). Order and lines are saved in one DB transaction (NFR-08). Errors: 400 `VALIDATION_ERROR` / `ITEM_UNAVAILABLE` / `MIXED_STORES`; 403 `FORBIDDEN`.
**UI:** cart with quantity inputs, shows an *estimated* total, place button; success shows the order detail.

## F-04 My orders and detail
**Requirements:** FR-06, BR-07. `GET /api/orders` (customer) → own orders newest first. `GET /api/orders/:id` → full order with lines; not owner → 404 `NOT_FOUND`. **UI:** My Orders list (empty state), Order Detail.

## F-05 Incoming orders and accept
**Requirements:** FR-07, FR-08, BR-08, BR-09, BR-10.
`GET /api/orders` (operator) → orders of operator's store only, newest first. `GET /api/orders/:id` for other store → 404. `POST /api/orders/:id/accept` operator only: order of own store (else 404), status must be PLACED (else 409 `INVALID_TRANSITION`); sets status ACCEPTED, acceptedAt, acceptedById; returns order. Customer → 403. **UI:** operator list with Accept button on PLACED rows.

## 6. Acceptance criteria
| AC | Feature | Observable outcome |
|---|---|---|
| AC-01 | F-01 | Valid login returns 200, a token, and user without passwordHash |
| AC-02 | F-01 | Wrong password and unknown email both return 401 INVALID_CREDENTIALS with identical message |
| AC-03 | F-01 | GET /me with valid token returns that user's id/role/storeId |
| AC-04 | F-01 | After logout the same token gets 401 on /me |
| AC-05 | F-02 | Menu returns available items with price and store |
| AC-06 | F-02 | Menu excludes unavailable items |
| AC-07 | F-03 | Customer's valid order returns 201 and is retrievable from GET /orders/:id with identical lines and total |
| AC-08 | F-03 | A client-supplied price/total is ignored; stored total equals server-computed total |
| AC-09 | F-03 | Quantity 0, 11, 1.5, "2" (string), negative → 400, nothing stored |
| AC-10 | F-03 | Empty items, 11 lines, or duplicate menuItemId → 400, nothing stored |
| AC-11 | F-03 | Unavailable or unknown menu item → 400, nothing stored |
| AC-12 | F-03 | Items from two stores in one order → 400 MIXED_STORES |
| AC-13 | F-03 | After a menu price change an existing order keeps its old unit price and total |
| AC-14 | F-04 | Customer's list contains only their own orders |
| AC-15 | F-04 | Order detail returns lines, total, status, store |
| AC-16 | F-04 | Customer requesting another customer's order gets 404 and no order data |
| AC-17 | F-05 | Operator list contains only orders of own store |
| AC-18 | F-05 | Operator accepts PLACED order: status ACCEPTED, acceptedAt and acceptedById set and persisted |
| AC-19 | F-05 | Operator of another store gets 404 on view/accept; order unchanged |
| AC-20 | F-05 | Accepting a non-PLACED order returns 409 and does not change it |
| AC-21 | F-03 | Operator POST /orders → 403, nothing stored |
| AC-22 | F-05 | Customer POST accept → 403, order unchanged |
| AC-23 | F-01 | Anonymous calls to /me, /menu, /orders (GET/POST), /orders/:id, /accept return 401 without private data |
| AC-24 | F-01 | DB passwordHash is a bcrypt hash and never equals plaintext |
| AC-25 | F-01 | An expired token returns 401 |
| AC-26 | F-01 | Error responses have {error:{code,message}} and contain no stack trace |
| AC-27 | F-03 | A rejected order (e.g. second line invalid) leaves the order count unchanged (atomic) |

## 7. Software Test Specification (STS)
Levels: U = unit, I = API+database integration (supertest + real SQLite test DB), E = browser end-to-end.
| Test | AC | Level | Precondition / input | Action | Expected |
|---|---|---|---|---|---|
| TEST-01 | AC-01 | I | seeded alice | POST /auth/login valid | 200, token string, no passwordHash |
| TEST-02 | AC-02 | I | seeded | login wrong pw; login unknown email | both 401 INVALID_CREDENTIALS, equal message |
| TEST-03 | AC-03 | I | alice token | GET /auth/me | 200 role CUSTOMER, id = alice |
| TEST-04 | AC-04 | I | alice token | logout then GET /me | 204 then 401 |
| TEST-05 | AC-05 | I | alice token | GET /menu | contains Jasmine Milk Tea with priceCents 6000 and store |
| TEST-06 | AC-06 | I | alice token | GET /menu | no "Sold-out Mango Tea" |
| TEST-07 | AC-07 | I | alice token | POST order 2×Jasmine Milk Tea + 1×Cheese Berry Tea; GET detail | 201; detail equals; total 19000 |
| TEST-08 | AC-08 | I | alice | POST with items[0].price=1 and total=1 | 201; total 19000 not 1 |
| TEST-09 | AC-09 | I | alice | quantities 0, 11, 1.5, "2", -1 | each 400; order count 0 |
| TEST-10 | AC-10 | I | alice | [], 11 lines, duplicate id | each 400; count 0 |
| TEST-11 | AC-11 | I | alice | unavailable id; random id | each 400; count 0 |
| TEST-12 | AC-12 | I | alice | Jasmine Milk Tea + Thai Milk Tea | 400 MIXED_STORES |
| TEST-13 | AC-13 | I | order exists; DB price of Jasmine Milk Tea changed to 9900 | GET order | unitPriceCents still 6000, total unchanged |
| TEST-14 | AC-14 | I | alice and bob each have an order | GET /orders as alice | only alice's |
| TEST-15 | AC-15 | I | alice order | GET /orders/:id | lines/total/status/store present |
| TEST-16 | AC-16 | I | alice order | bob GET /orders/:id | 404, body has no items |
| TEST-17 | AC-17 | I | orders for S1 and S2 | Siam operator GET /orders | only S1 |
| TEST-18 | AC-18 | I | PLACED S1 order | Siam operator accept; re-read DB | ACCEPTED, acceptedById = operator |
| TEST-19 | AC-19 | I | PLACED S1 order | drinks operator GET and accept | 404 both; status PLACED |
| TEST-20 | AC-20 | I | order already ACCEPTED | accept again | 409 INVALID_TRANSITION; acceptedAt unchanged |
| TEST-21 | AC-21 | I | operator token | POST /orders | 403; count 0 |
| TEST-22 | AC-22 | I | PLACED order, alice token | POST accept | 403; status PLACED |
| TEST-23 | AC-23 | I | no token | call each protected endpoint | each 401, no data |
| TEST-24 | AC-24 | I | seeded DB | read User rows | hash starts `$2`, ≠ password |
| TEST-25 | AC-25 | I | token signed with expiry in the past | GET /me | 401 |
| TEST-26 | AC-26 | I | trigger 400, 401, 404, 409 | inspect bodies | shape ok; no "at " stack |
| TEST-27 | AC-27 | I | valid first line, invalid second line | POST | 400; order count unchanged |
| TEST-U01 | AC-08 | U | lines [{6000,2},{7000,1}] | computeTotal | 19000 |
| TEST-U02 | AC-09,10 | U | various line arrays | validateOrderLines | accepts valid; rejects invalid with code |
| TEST-U03 | AC-18,20 | U | statuses | canAccept | true only for PLACED |
| TEST-E01 | AC-07,15,18 | E | seeded app running | customer logs in, orders, sees detail; operator logs in, accepts; customer sees ACCEPTED | journey passes |
| TEST-E02 | AC-09,22 | E | seeded app | customer sets qty 11 → error shown; customer UI has no accept button | rejection + restriction visible |

## 8. Product Definition of Done
1. Required behaviour for F-01..F-05 implemented on `main` via reviewed PRs from sprint staging.
2. Every Sprint 1 AC mapped to a test (table above) and the test executed; results table with command, commit, counts.
3. All meaningful tests pass; failing/skipped tests disclosed; no test weakened.
4. TDD evidence: failing run before implementation, passing after, for the key rules (BR-01, BR-09, BR-07).
5. Setup/README and docs match the code; seed accounts documented; no secrets in Git.
6. Review and integration complete; release tag recorded.
7. Incomplete work disclosed. Completion is proven by execution output, not by an AI statement.

## 9. Revision history
| Version | Change | Reason |
|---|---|---|
| 1.0 | Initial contracts | Before implementation |
| 1.1 | Domain changed from canteen food to HeyTea-style drink shop with branches; test data renamed only, rules/AC/tests unchanged | Owner chose tea-shop context before any Sprint 1 UI work |
