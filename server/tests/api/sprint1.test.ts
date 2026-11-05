import { describe, it, expect, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { api, auth, login, menuId, prisma, resetDb, DEMO_PASSWORD } from "../helpers";

const ALICE = "alice@demo.test", BOB = "bob@demo.test", NOODLE = "noodle@demo.test", DRINKS = "drinks@demo.test";

async function placeOrder(token: string, lines: { name: string; quantity: number }[]) {
  const items = [];
  for (const l of lines) items.push({ menuItemId: await menuId(l.name), quantity: l.quantity });
  return api().post("/api/orders").set(auth(token)).send({ items });
}
const orderCount = () => prisma.order.count();

beforeEach(resetDb);

describe("F-01 authentication", () => {
  it("TEST-01 / AC-01 valid login returns token and user without hash", async () => {
    const res = await api().post("/api/auth/login").send({ email: ALICE, password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.email).toBe(ALICE);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("TEST-02 / AC-02 wrong password and unknown email give identical 401", async () => {
    const a = await api().post("/api/auth/login").send({ email: ALICE, password: "wrong" });
    const b = await api().post("/api/auth/login").send({ email: "nobody@demo.test", password: "wrong" });
    expect(a.status).toBe(401); expect(b.status).toBe(401);
    expect(a.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it("TEST-03 / AC-03 /me returns current user", async () => {
    const t = await login(ALICE);
    const res = await api().get("/api/auth/me").set(auth(t));
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("CUSTOMER");
    expect(res.body.email).toBe(ALICE);
  });

  it("TEST-04 / AC-04 token is unusable after logout", async () => {
    const t = await login(ALICE);
    expect((await api().post("/api/auth/logout").set(auth(t))).status).toBe(204);
    expect((await api().get("/api/auth/me").set(auth(t))).status).toBe(401);
  });

  it("TEST-23 / AC-23 anonymous requests to protected endpoints get 401 with no data", async () => {
    const t = await login(ALICE);
    const o = await placeOrder(t, [{ name: "Pad Thai", quantity: 1 }]);
    const id = o.body.id;
    const calls = [
      api().get("/api/auth/me"), api().post("/api/auth/logout"), api().get("/api/menu"),
      api().get("/api/orders"), api().post("/api/orders").send({ items: [] }),
      api().get(`/api/orders/${id}`), api().post(`/api/orders/${id}/accept`),
    ];
    for (const c of calls) {
      const r = await c;
      expect(r.status).toBe(401);
      expect(JSON.stringify(r.body)).not.toContain("Pad Thai");
      expect(r.body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("TEST-24 / AC-24 passwords are stored as bcrypt hashes", async () => {
    const users = await prisma.user.findMany();
    expect(users.length).toBeGreaterThan(0);
    for (const u of users) {
      expect(u.passwordHash.startsWith("$2")).toBe(true);
      expect(u.passwordHash).not.toBe(DEMO_PASSWORD);
    }
  });

  it("TEST-25 / AC-25 expired token is rejected", async () => {
    const alice = await prisma.user.findFirstOrThrow({ where: { email: ALICE } });
    await prisma.session.create({ data: { id: "expired-jti", userId: alice.id, expiresAt: new Date(Date.now() - 1000) } });
    const t = jwt.sign({ sub: alice.id, role: "CUSTOMER", jti: "expired-jti" }, "test-secret", { expiresIn: -10 });
    expect((await api().get("/api/auth/me").set(auth(t))).status).toBe(401);
  });

  it("TEST-26 / AC-26 errors use the standard shape without stack traces", async () => {
    const t = await login(ALICE);
    const responses = [
      await api().get("/api/menu"),
      await api().post("/api/orders").set(auth(t)).send({ items: [] }),
      await api().get("/api/orders/does-not-exist").set(auth(t)),
      await api().post("/api/auth/login").send({}),
    ];
    for (const r of responses) {
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(typeof r.body.error.code).toBe("string");
      expect(typeof r.body.error.message).toBe("string");
      expect(JSON.stringify(r.body)).not.toMatch(/\sat\s|node_modules|prisma/i);
    }
    const accept = await api().post("/api/orders/x/accept").set(auth(t));
    expect(accept.body.error.code).toBe("FORBIDDEN");
  });
});

describe("F-02 menu", () => {
  it("TEST-05 / AC-05 menu lists available items with price and stall", async () => {
    const t = await login(ALICE);
    const res = await api().get("/api/menu").set(auth(t));
    expect(res.status).toBe(200);
    const pad = res.body.find((m: any) => m.name === "Pad Thai");
    expect(pad.priceCents).toBe(6000);
    expect(pad.stall.name).toBe("Noodle Corner");
  });

  it("TEST-06 / AC-06 menu hides unavailable items", async () => {
    const t = await login(ALICE);
    const res = await api().get("/api/menu").set(auth(t));
    expect(res.body.map((m: any) => m.name)).not.toContain("Sold-out Soup");
  });
});

describe("F-03 place order", () => {
  it("TEST-07 / AC-07 valid order is saved and retrievable", async () => {
    const t = await login(ALICE);
    const res = await placeOrder(t, [{ name: "Pad Thai", quantity: 2 }, { name: "Tom Yum", quantity: 1 }]);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PLACED");
    expect(res.body.paymentStatus).toBe("PENDING");
    expect(res.body.totalCents).toBe(19000);
    const detail = await api().get(`/api/orders/${res.body.id}`).set(auth(t));
    expect(detail.status).toBe(200);
    expect(detail.body.totalCents).toBe(19000);
    expect(detail.body.items).toHaveLength(2);
    expect(await orderCount()).toBe(1);
  });

  it("TEST-08 / AC-08 client supplied price and total are ignored", async () => {
    const t = await login(ALICE);
    const id = await menuId("Pad Thai");
    const res = await api().post("/api/orders").set(auth(t))
      .send({ total: 1, totalCents: 1, items: [{ menuItemId: id, quantity: 2, price: 1, unitPriceCents: 1 }] });
    expect(res.status).toBe(201);
    expect(res.body.totalCents).toBe(12000);
    expect(res.body.items[0].unitPriceCents).toBe(6000);
  });

  it("TEST-09 / AC-09 invalid quantities are rejected and nothing is stored", async () => {
    const t = await login(ALICE);
    const id = await menuId("Pad Thai");
    for (const q of [0, 11, 1.5, "2", -1, null]) {
      const r = await api().post("/api/orders").set(auth(t)).send({ items: [{ menuItemId: id, quantity: q }] });
      expect(r.status, `quantity ${JSON.stringify(q)}`).toBe(400);
      expect(r.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await orderCount()).toBe(0);
  });

  it("TEST-10 / AC-10 empty, too many lines and duplicate lines are rejected", async () => {
    const t = await login(ALICE);
    const id = await menuId("Pad Thai");
    const many = Array.from({ length: 11 }, (_, i) => ({ menuItemId: id + i, quantity: 1 }));
    for (const items of [[], many, [{ menuItemId: id, quantity: 1 }, { menuItemId: id, quantity: 1 }]]) {
      const r = await api().post("/api/orders").set(auth(t)).send({ items });
      expect(r.status).toBe(400);
    }
    expect(await orderCount()).toBe(0);
  });

  it("TEST-11 / AC-11 unavailable and unknown items are rejected", async () => {
    const t = await login(ALICE);
    const sold = await api().post("/api/orders").set(auth(t)).send({ items: [{ menuItemId: await menuId("Sold-out Soup"), quantity: 1 }] });
    expect(sold.status).toBe(400);
    expect(sold.body.error.code).toBe("ITEM_UNAVAILABLE");
    const unknown = await api().post("/api/orders").set(auth(t)).send({ items: [{ menuItemId: "nope", quantity: 1 }] });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe("ITEM_UNAVAILABLE");
    expect(await orderCount()).toBe(0);
  });

  it("TEST-12 / AC-12 mixing stalls in one order is rejected", async () => {
    const t = await login(ALICE);
    const r = await placeOrder(t, [{ name: "Pad Thai", quantity: 1 }, { name: "Thai Tea", quantity: 1 }]);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("MIXED_STALLS");
    expect(await orderCount()).toBe(0);
  });

  it("TEST-13 / AC-13 later price changes do not alter an existing order", async () => {
    const t = await login(ALICE);
    const o = await placeOrder(t, [{ name: "Pad Thai", quantity: 2 }]);
    await prisma.menuItem.updateMany({ where: { name: "Pad Thai" }, data: { priceCents: 9900 } });
    const d = await api().get(`/api/orders/${o.body.id}`).set(auth(t));
    expect(d.body.items[0].unitPriceCents).toBe(6000);
    expect(d.body.totalCents).toBe(12000);
  });

  it("TEST-21 / AC-21 operator cannot place orders", async () => {
    const t = await login(NOODLE);
    const r = await placeOrder(t, [{ name: "Pad Thai", quantity: 1 }]);
    expect(r.status).toBe(403);
    expect(await orderCount()).toBe(0);
  });

  it("TEST-27 / AC-27 a rejected order leaves nothing behind (atomic)", async () => {
    const t = await login(ALICE);
    const good = await menuId("Pad Thai");
    const r = await api().post("/api/orders").set(auth(t)).send({ items: [{ menuItemId: good, quantity: 1 }, { menuItemId: "bad-id", quantity: 1 }] });
    expect(r.status).toBe(400);
    expect(await orderCount()).toBe(0);
    expect(await prisma.orderItem.count()).toBe(0);
  });
});

describe("F-04 customer orders", () => {
  it("TEST-14 / AC-14 customer list contains only own orders", async () => {
    const a = await login(ALICE), b = await login(BOB);
    const ao = await placeOrder(a, [{ name: "Pad Thai", quantity: 1 }]);
    await placeOrder(b, [{ name: "Tom Yum", quantity: 1 }]);
    const res = await api().get("/api/orders").set(auth(a));
    expect(res.status).toBe(200);
    expect(res.body.map((o: any) => o.id)).toEqual([ao.body.id]);
  });

  it("TEST-15 / AC-15 order detail has lines, total, status, stall", async () => {
    const a = await login(ALICE);
    const o = await placeOrder(a, [{ name: "Tom Yum", quantity: 3 }]);
    const d = await api().get(`/api/orders/${o.body.id}`).set(auth(a));
    expect(d.body).toMatchObject({ status: "PLACED", totalCents: 21000, stall: { name: "Noodle Corner" } });
    expect(d.body.items[0]).toMatchObject({ itemName: "Tom Yum", quantity: 3, lineTotalCents: 21000 });
  });

  it("TEST-16 / AC-16 another customer gets 404 and no data", async () => {
    const a = await login(ALICE), b = await login(BOB);
    const o = await placeOrder(a, [{ name: "Pad Thai", quantity: 1 }]);
    const r = await api().get(`/api/orders/${o.body.id}`).set(auth(b));
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.body)).not.toContain("Pad Thai");
  });
});

describe("F-05 operator", () => {
  it("TEST-17 / AC-17 operator sees only their stall's orders", async () => {
    const a = await login(ALICE);
    const n = await placeOrder(a, [{ name: "Pad Thai", quantity: 1 }]);
    await placeOrder(a, [{ name: "Thai Tea", quantity: 1 }]);
    const res = await api().get("/api/orders").set(auth(await login(NOODLE)));
    expect(res.status).toBe(200);
    expect(res.body.map((o: any) => o.id)).toEqual([n.body.id]);
  });

  it("TEST-18 / AC-18 operator accepts a PLACED order and it persists", async () => {
    const o = await placeOrder(await login(ALICE), [{ name: "Pad Thai", quantity: 1 }]);
    const res = await api().post(`/api/orders/${o.body.id}/accept`).set(auth(await login(NOODLE)));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ACCEPTED");
    const row = await prisma.order.findUniqueOrThrow({ where: { id: o.body.id } });
    const op = await prisma.user.findFirstOrThrow({ where: { email: NOODLE } });
    expect(row.status).toBe("ACCEPTED");
    expect(row.acceptedById).toBe(op.id);
    expect(row.acceptedAt).not.toBeNull();
  });

  it("TEST-19 / AC-19 operator of another stall cannot view or accept", async () => {
    const o = await placeOrder(await login(ALICE), [{ name: "Pad Thai", quantity: 1 }]);
    const d = await login(DRINKS);
    expect((await api().get(`/api/orders/${o.body.id}`).set(auth(d))).status).toBe(404);
    expect((await api().post(`/api/orders/${o.body.id}/accept`).set(auth(d))).status).toBe(404);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.body.id } })).status).toBe("PLACED");
  });

  it("TEST-20 / AC-20 accepting twice returns 409 and changes nothing", async () => {
    const o = await placeOrder(await login(ALICE), [{ name: "Pad Thai", quantity: 1 }]);
    const op = await login(NOODLE);
    await api().post(`/api/orders/${o.body.id}/accept`).set(auth(op));
    const first = await prisma.order.findUniqueOrThrow({ where: { id: o.body.id } });
    const r = await api().post(`/api/orders/${o.body.id}/accept`).set(auth(op));
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("INVALID_TRANSITION");
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.body.id } });
    expect(after.acceptedAt?.getTime()).toBe(first.acceptedAt?.getTime());
  });

  it("TEST-22 / AC-22 customer cannot accept orders", async () => {
    const a = await login(ALICE);
    const o = await placeOrder(a, [{ name: "Pad Thai", quantity: 1 }]);
    const r = await api().post(`/api/orders/${o.body.id}/accept`).set(auth(a));
    expect(r.status).toBe(403);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.body.id } })).status).toBe("PLACED");
  });
});
