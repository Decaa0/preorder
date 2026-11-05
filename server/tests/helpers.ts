import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { seed, DEMO_PASSWORD } from "../src/seedData";

export const app = createApp();
export const api = () => request(app);

export async function resetDb() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.session.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.store.deleteMany();
  await seed();
}

export async function login(email: string) {
  const res = await api().post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
  return res.body.token as string;
}

export async function menuId(name: string) {
  const m = await prisma.menuItem.findFirstOrThrow({ where: { name } });
  return m.id;
}

export const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
export { prisma, DEMO_PASSWORD };
