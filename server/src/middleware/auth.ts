import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { ApiError } from "../errors";
import { config } from "../config";

export type AuthUser = { id: string; email: string; fullName: string; role: "CUSTOMER" | "OPERATOR"; storeId: string | null };
declare module "express-serve-static-core" { interface Request { user?: AuthUser; sessionId?: string } }

const unauth = () => new ApiError(401, "UNAUTHENTICATED", "Authentication required");

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw unauth();
    let payload: any;
    try { payload = jwt.verify(header.slice(7), config.jwtSecret()); } catch { throw unauth(); }
    const session = await prisma.session.findUnique({ where: { id: String(payload.jti) } });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) throw unauth();
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !user.active) throw unauth();
    req.user = { id: user.id, email: user.email, fullName: user.fullName, role: user.role as AuthUser["role"], storeId: user.storeId };
    req.sessionId = session.id;
    next();
  } catch (e) { next(e); }
}

export const requireRole = (role: AuthUser["role"]) => (req: Request, _res: Response, next: NextFunction) =>
  req.user?.role === role ? next() : next(new ApiError(403, "FORBIDDEN", "You are not allowed to do this"));
