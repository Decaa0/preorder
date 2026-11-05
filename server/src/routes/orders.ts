import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import * as svc from "../services/orderService";

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

ordersRouter.post("/", requireRole("CUSTOMER"), async (req, res, next) => {
  try { res.status(201).json(await svc.placeOrder(req.user!, req.body)); } catch (e) { next(e); }
});
ordersRouter.get("/", async (req, res, next) => {
  try { res.json(await svc.listOrders(req.user!)); } catch (e) { next(e); }
});
ordersRouter.get("/:id", async (req, res, next) => {
  try { res.json(await svc.getOrder(req.user!, req.params.id)); } catch (e) { next(e); }
});
ordersRouter.post("/:id/accept", requireRole("OPERATOR"), async (req, res, next) => {
  try { res.json(await svc.acceptOrder(req.user!, req.params.id)); } catch (e) { next(e); }
});
