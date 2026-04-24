import type { NextFunction, Request, Response } from "express";
import { AuthError, type AccessTokenRole, verifyAccessToken } from "../auth";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: AccessTokenRole;
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const claims = verifyAccessToken(token);
    req.user = { id: claims.userId, role: claims.role };
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(401).json({ error: error.message });
      return;
    }
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireRole(...roles: AccessTokenRole[]) {
  const allowed = new Set(roles);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!allowed.has(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}
