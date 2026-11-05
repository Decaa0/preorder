import { prisma } from "../db";
import { ApiError } from "../errors";
import { canAccept, computeTotal, validateOrderLines } from "../domain/orderRules";
import type { AuthUser } from "../middleware/auth";

const include = { items: true, store: true } as const;
type OrderRow = Awaited<ReturnType<typeof prisma.order.findFirstOrThrow<{ include: typeof include }>>>;

export const toDto = (o: OrderRow) => ({
  id: o.id, status: o.status, paymentStatus: o.paymentStatus, totalCents: o.totalCents,
  createdAt: o.createdAt, acceptedAt: o.acceptedAt, customerId: o.customerId,
  store: { id: o.store.id, name: o.store.name },
  items: o.items.map((i) => ({ menuItemId: i.menuItemId, itemName: i.itemName, unitPriceCents: i.unitPriceCents, quantity: i.quantity, lineTotalCents: i.lineTotalCents })),
});

export async function placeOrder(customer: AuthUser, body: unknown) {
  const items = (body as any)?.items;
  const v = validateOrderLines(items);
  if (!v.ok) throw new ApiError(400, v.code, v.message);

  const ids: string[] = items.map((i: any) => i.menuItemId);
  const menu = await prisma.menuItem.findMany({ where: { id: { in: ids } } });
  const byId = new Map(menu.map((m) => [m.id, m]));
  for (const id of ids) {
    const m = byId.get(id);
    if (!m || !m.available) throw new ApiError(400, "ITEM_UNAVAILABLE", "An item is unknown or no longer available");
  }
  if (new Set(menu.map((m) => m.storeId)).size > 1)
    throw new ApiError(400, "MIXED_STORES", "All items in one order must be from the same store");

  // BR-06: snapshot name + authoritative unit price; BR-01: total computed here.
  const lines = items.map((i: any) => {
    const m = byId.get(i.menuItemId)!;
    return { menuItemId: m.id, itemName: m.name, unitPriceCents: m.priceCents, quantity: i.quantity as number, lineTotalCents: m.priceCents * i.quantity };
  });
  const totalCents = computeTotal(lines);

  // NFR-08: header + lines in one transaction.
  const order = await prisma.order.create({
    data: { customerId: customer.id, storeId: menu[0].storeId, totalCents, items: { create: lines } },
    include,
  });
  return toDto(order);
}

export async function listOrders(user: AuthUser) {
  const where = user.role === "CUSTOMER" ? { customerId: user.id } : { storeId: user.storeId ?? "__none__" };
  const rows = await prisma.order.findMany({ where, include, orderBy: { createdAt: "desc" } });
  return rows.map(toDto);
}

async function findVisible(user: AuthUser, id: string) {
  const o = await prisma.order.findUnique({ where: { id }, include });
  const visible = o && (user.role === "CUSTOMER" ? o.customerId === user.id : o.storeId === user.storeId);
  if (!o || !visible) throw new ApiError(404, "NOT_FOUND", "Order not found"); // D-04: do not leak existence
  return o;
}

export async function getOrder(user: AuthUser, id: string) {
  return toDto(await findVisible(user, id));
}

export async function acceptOrder(operator: AuthUser, id: string) {
  const o = await findVisible(operator, id);
  if (!canAccept(o.status)) throw new ApiError(409, "INVALID_TRANSITION", `Order is ${o.status}; only PLACED orders can be accepted`);
  // guarded update: only succeeds if still PLACED (protects against double accept)
  const res = await prisma.order.updateMany({
    where: { id, status: "PLACED" },
    data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: operator.id },
  });
  if (res.count !== 1) throw new ApiError(409, "INVALID_TRANSITION", "Order was already changed");
  return toDto(await findVisible(operator, id));
}
