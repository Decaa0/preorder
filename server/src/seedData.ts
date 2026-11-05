import bcrypt from "bcryptjs";
import { prisma } from "./db";

export const DEMO_PASSWORD = "Demo#1234";

/** Idempotent synthetic seed data (upserts only). */
export async function seed() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const noodle = await prisma.stall.upsert({ where: { name: "Noodle Corner" }, update: {}, create: { name: "Noodle Corner" } });
  const drinks = await prisma.stall.upsert({ where: { name: "Drinks Bar" }, update: {}, create: { name: "Drinks Bar" } });

  const users = [
    { email: "alice@demo.test", fullName: "Alice Customer", role: "CUSTOMER", stallId: null },
    { email: "bob@demo.test", fullName: "Bob Customer", role: "CUSTOMER", stallId: null },
    { email: "noodle@demo.test", fullName: "Noodle Operator", role: "OPERATOR", stallId: noodle.id },
    { email: "drinks@demo.test", fullName: "Drinks Operator", role: "OPERATOR", stallId: drinks.id },
  ];
  for (const u of users) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, passwordHash: hash } });
  }

  const items = [
    { stallId: noodle.id, name: "Pad Thai", priceCents: 6000, available: true },
    { stallId: noodle.id, name: "Tom Yum", priceCents: 7000, available: true },
    { stallId: noodle.id, name: "Sold-out Soup", priceCents: 5000, available: false },
    { stallId: drinks.id, name: "Thai Tea", priceCents: 3500, available: true },
    { stallId: drinks.id, name: "Iced Coffee", priceCents: 4500, available: true },
  ];
  for (const i of items) {
    const existing = await prisma.menuItem.findFirst({ where: { stallId: i.stallId, name: i.name } });
    if (!existing) await prisma.menuItem.create({ data: i });
  }
}
