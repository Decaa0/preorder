# Feature Inventory

| ID | Feature | Description | Requirements | Depends on | Sprint |
|---|---|---|---|---|---|
| F-01 | Authentication & session | Login, logout, current user, server-side revocation | FR-01, FR-02, FR-03, NFR-01, NFR-02, NFR-03, NFR-05 | — | 1 |
| F-02 | Browse menu | Customer lists available items with prices per stall | FR-04, BR-04 | F-01 | 1 |
| F-03 | Place order | Submit multi-line order, server-side totals, price snapshot, atomic save | FR-05, BR-01..BR-06, BR-10, NFR-08 | F-01, F-02 | 1 |
| F-04 | My orders & detail | Customer lists/opens own orders | FR-06, BR-07 | F-03 | 1 |
| F-05 | Incoming orders & accept | Operator lists stall orders and accepts PLACED order | FR-07, FR-08, BR-08, BR-09, BR-10 | F-03 | 1 |
| F-06 | Order fulfilment lifecycle | PREPARING/READY/COMPLETED transitions | FR-09, BR-11 | F-05 | 2 |
| F-07 | Cancel order | Customer cancels PLACED order | FR-10, BR-11, BR-12 | F-03 | 2 |
| F-08 | Catalog management | Operator edits menu and availability | FR-11, BR-13 | F-01 | 2 |
| F-09 | Simulated payment status | PENDING→PAID→REFUNDED | FR-12 | F-05 | 2 |
| F-10 | Sales summary | Per-stall order counts, revenue, top items | FR-13, NFR-04 | F-06, F-09 | 3 |
| F-11 | History filter & search | Filter orders by status/date | FR-14, FR-15 | F-04, F-05 | 3 |
| F-12 | Responsive UI hardening | 360 px / 1280 px layouts, empty/error states | NFR-07 | F-02..F-05 | 3 |
