import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

export const menuRouter = Router();
menuRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const items = await prisma.menuItem.findMany({ where: { available: true }, include: { store: true }, orderBy: [{ storeId: "asc" }, { name: "asc" }] });
    res.json(items.map((m) => ({ id: m.id, name: m.name, priceCents: m.priceCents, store: { id: m.store.id, name: m.store.name } })));
  } catch (e) { next(e); }
});
