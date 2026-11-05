# Three-Sprint Plan

| Sprint | Goal | Features | Depends on | Completion outcome | Checkpoint |
|---|---|---|---|---|---|
| 1 | Small working ordering slice with auth, roles, persistence | F-01, F-02, F-03, F-04, F-05 | none | Customer logs in, orders, views order; operator of the stall accepts it; rules + access tested | D1, 8 Nov |
| 2 | Core expansion | F-06, F-07, F-08, F-09 | Sprint 1 release | Full lifecycle, cancellation, catalog editing, simulated payment | D2, 29 Nov |
| 3 | Reporting, hardening | F-10, F-11, F-12 | Sprint 2 | Sales summary, filters, responsive UI, regression/defect fixes | Progress 29 Nov, done 13 Dec |

**Why Sprint 1 is feasible:** five small features sharing one schema; no lifecycle beyond PLACED→ACCEPTED; auth reuses the pattern from TokTickIT.
