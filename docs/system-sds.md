# System-Level SDS

## 1. Architecture and stack
React 18 + Vite (UI) → REST/JSON over HTTP → Express + TypeScript (API/application layer) → Prisma ORM → SQLite (local; Postgres on GCP by changing the Prisma provider). Modular monolith.
- **UI** (`client/`): screens, form validation hints, token held in memory/localStorage, sends `Authorization: Bearer`. Never computes prices that are trusted.
- **API** (`server/src`): routes → services. **All business rules live in the service layer** (`orderService`), not in the UI. Auth middleware checks token + Session row. 
- **DB**: constraints (FKs, unique email, NOT NULL) as a second line of defence.

## 2. Data model
```
Store 1──* MenuItem
Store 1──* User(operator)         (User.storeId nullable; set only for OPERATOR)
User(customer) 1──* Order *──1 Store
Order 1──* OrderItem *──1 MenuItem
User 1──* Session
```
| Entity | Fields / constraints |
|---|---|
| User | id uuid PK, email unique, passwordHash (bcrypt), fullName, role CUSTOMER\|OPERATOR, storeId? FK, active bool |
| Session | id (= jti) PK, userId FK, expiresAt, revokedAt? |
| Store | id PK, name unique |
| MenuItem | id PK, storeId FK, name, priceCents int > 0, available bool |
| Order | id PK, customerId FK, storeId FK, status (PLACED, ACCEPTED, …), paymentStatus (PENDING), totalCents int, createdAt, acceptedAt?, acceptedById? FK |
| OrderItem | id PK, orderId FK (cascade), menuItemId FK, itemName (snapshot), unitPriceCents (snapshot), quantity int, lineTotalCents; unique(orderId, menuItemId) |
Setup: `npm run db:push` (Prisma schema push, as in TokTickIT); seed: `npm run seed` (idempotent upserts, synthetic data).

## 3. UI conventions
Screens: Login · Menu & cart (customer) · My Orders · Order Detail · Incoming Orders (operator). Shared behaviour: every request shows a loading state; empty lists show a message ("No orders yet"); API errors are shown in a red banner using `error.message`; client-side checks (qty 1–10) are hints only — the server re-validates. Operators never see cart UI; customers never see accept buttons (but the backend enforces it).

## 4. API conventions
JSON only, base `/api`, nouns, plural. Success returns the resource (`200/201`). Errors: `{ "error": { "code": "VALIDATION_ERROR", "message": "…" } }` with status 400 validation · 401 unauthenticated · 403 forbidden role · 404 not found/not yours · 409 state conflict. No stack traces or SQL in messages. Detailed endpoints: see Sprint 1 contracts.

## 5. Role / permission matrix
| Operation | Anonymous | Customer | Operator |
|---|---|---|---|
| POST /api/auth/login | ✔ | ✔ | ✔ |
| GET /api/auth/me, POST /api/auth/logout | ✘ 401 | ✔ | ✔ |
| GET /api/menu | ✘ 401 | ✔ | ✔ |
| POST /api/orders | ✘ 401 | ✔ | ✘ 403 |
| GET /api/orders | ✘ 401 | own orders | own store's orders |
| GET /api/orders/:id | ✘ 401 | own only (else 404) | own store only (else 404) |
| POST /api/orders/:id/accept | ✘ 401 | ✘ 403 | own store, PLACED only |

## 6. Authentication
Local credentials; bcryptjs hash cost 10. Login verifies hash, creates a Session row and signs a JWT `{sub, role, jti}` valid 8 h. Each request: verify JWT signature/expiry → load Session (not revoked, not expired) → load user (active) → attach `req.user`. Role is always read from the DB user, never from the client. Logout sets `revokedAt`; the same token then returns 401. Invalid login returns the same message for unknown email and wrong password.

## 7. Configuration and deployment plan
Env vars (`server/.env.example`): `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`. Real `.env` is git-ignored. For Lab 5: Dockerfile (multi-stage), GitHub Actions CI, GCP Cloud Run + Cloud SQL (Postgres) with `JWT_SECRET` in Secret Manager. The app is stateless besides the DB, so it containerises directly.
