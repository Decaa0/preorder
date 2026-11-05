import bcrypt from "bcryptjs";
import { prisma } from "./db";

export const DEMO_PASSWORD = "Demo#1234";

/** Idempotent synthetic seed data (upserts only). */
export async function seed() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const siam = await prisma.store.upsert({ where: { name: "Siam Branch" }, update: {}, create: { name: "Siam Branch" } });
  const ladprao = await prisma.store.upsert({ where: { name: "Ladprao Branch" }, update: {}, create: { name: "Ladprao Branch" } });

  const users = [
    { email: "alice@demo.test", fullName: "Alice Customer", role: "CUSTOMER", storeId: null },
    { email: "bob@demo.test", fullName: "Bob Customer", role: "CUSTOMER", storeId: null },
    { email: "siam@demo.test", fullName: "Siam Operator", role: "OPERATOR", storeId: siam.id },
    { email: "ladprao@demo.test", fullName: "Ladprao Operator", role: "OPERATOR", storeId: ladprao.id },
  ];
  for (const u of users) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, passwordHash: hash } });
  }

  const items = [
    { storeId: siam.id, name: "Jasmine Milk Tea", priceCents: 6000, available: true },
    { storeId: siam.id, name: "Cheese Berry Tea", priceCents: 7000, available: true },
    { storeId: siam.id, name: "Sold-out Mango Tea", priceCents: 5000, available: false },
    { storeId: ladprao.id, name: "Thai Milk Tea", priceCents: 3500, available: true },
    { storeId: ladprao.id, name: "Iced Americano", priceCents: 4500, available: true },
  ];
  for (const i of items) {
    const existing = await prisma.menuItem.findFirst({ where: { storeId: i.storeId, name: i.name } });
    if (!existing) await prisma.menuItem.create({ data: i });
  }
}
