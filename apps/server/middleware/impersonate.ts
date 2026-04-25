import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";
import type { AccessTokenRole } from "../auth";

const ADMIN_ROLES: ReadonlySet<AccessTokenRole> = new Set<AccessTokenRole>([
  "admin_ops",
  "admin_support",
  "admin_finance",
  "admin_readonly",
]);

type AuditContext = {
  actorUserId: string | null;
  actingAsBrandId: string | null;
};

const auditContext = new AsyncLocalStorage<AuditContext>();

declare global {
  namespace Express {
    interface Request {
      actingAsBrandId?: string;
      originalUser?: {
        id: string;
        role: AccessTokenRole;
      };
    }
  }
}

export function getAuditContext(): AuditContext {
  return auditContext.getStore() ?? { actorUserId: null, actingAsBrandId: null };
}

export function impersonate(req: Request, res: Response, next: NextFunction): void {
  const actorUser = req.user ?? null;
  const header = req.headers["x-acting-as-brand"];
  const brandId = Array.isArray(header) ? header[0] : header;

  if (brandId) {
    if (!actorUser || !ADMIN_ROLES.has(actorUser.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    req.actingAsBrandId = brandId;
    req.originalUser = actorUser;
    if (req.originalUrl.startsWith("/api/brand")) {
      req.user = { id: brandId, role: "brand" };
    }
  }

  auditContext.run(
    {
      actorUserId: actorUser?.id ?? null,
      actingAsBrandId: req.actingAsBrandId ?? null,
    },
    next,
  );
}
