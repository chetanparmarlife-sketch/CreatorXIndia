import { createHash, randomInt, randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Profile, UserRole } from "@creatorx/schema";
import { audit_log, db, otp_codes, profiles, refresh_tokens } from "@creatorx/schema";

export type AccessTokenRole =
  | "creator"
  | "brand"
  | "admin_ops"
  | "admin_support"
  | "admin_finance"
  | "admin_readonly";

export interface AccessTokenClaims {
  userId: string;
  role: AccessTokenRole;
}

interface RefreshTokenClaims {
  userId: string;
}

export class AuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";
const OTP_TTL_MS = 10 * 60 * 1000;

const JWT_SECRET = process.env.JWT_SECRET ?? "";
const OTP_SECRET = process.env.OTP_SECRET ?? "";
if (!JWT_SECRET || !OTP_SECRET) {
  throw new Error("JWT_SECRET and OTP_SECRET must be set in environment");
}

function nowIso(): string {
  return new Date().toISOString();
}

function toIsoAfter(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(`${token}:${OTP_SECRET}`).digest("hex");
}

function normalizeRole(role: UserRole): AccessTokenRole {
  if (role === "creator" || role === "brand") return role;
  if (role === "admin") return "admin_ops";
  if (role === "admin_ops") return "admin_ops";
  if (role === "admin_support") return "admin_support";
  if (role === "admin_finance") return "admin_finance";
  if (role === "admin_readonly") return "admin_readonly";
  throw new AuthError(403, "Unsupported user role");
}

function redactAuthDiff(diff: unknown): Record<string, unknown> | null {
  const redact = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === "object") {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        obj[k] = /(email|phone|pan)/i.test(k) ? "[REDACTED]" : redact(v);
      }
      return obj;
    }
    return value;
  };

  if (diff === undefined || diff === null) return null;
  const redacted = redact(diff);
  if (redacted && typeof redacted === "object" && !Array.isArray(redacted)) {
    return redacted as Record<string, unknown>;
  }
  return { value: redacted };
}

async function logAuthEvent(
  actorUserId: string,
  action: string,
  targetId: string,
  diff?: unknown,
): Promise<void> {
  const created_at = nowIso();
  const diff_json = redactAuthDiff(diff);
  const details = diff_json ? JSON.stringify(diff_json) : null;

  await db.insert(audit_log).values({
    id: randomUUID(),
    actor_user_id: actorUserId,
    admin_id: actorUserId,
    action,
    target_type: "auth",
    target_id: targetId,
    diff_json,
    entity_kind: "auth",
    entity_id: targetId,
    details,
    created_at,
  });
}

function parseAccessTokenPayload(decoded: string | jwt.JwtPayload): AccessTokenClaims {
  if (!decoded || typeof decoded === "string") {
    throw new AuthError(401, "Invalid access token");
  }

  const sub = decoded.sub;
  const role = decoded.role;
  const type = decoded.type;

  if (typeof sub !== "string" || typeof role !== "string" || type !== "access") {
    throw new AuthError(401, "Invalid access token");
  }

  const allowed: ReadonlySet<string> = new Set([
    "creator",
    "brand",
    "admin_ops",
    "admin_support",
    "admin_finance",
    "admin_readonly",
  ]);

  if (!allowed.has(role)) {
    throw new AuthError(401, "Invalid access token");
  }

  return { userId: sub, role: role as AccessTokenRole };
}

function parseRefreshTokenPayload(decoded: string | jwt.JwtPayload): RefreshTokenClaims {
  if (!decoded || typeof decoded === "string") {
    throw new AuthError(401, "Invalid refresh token");
  }

  const sub = decoded.sub;
  const type = decoded.type;

  if (typeof sub !== "string" || type !== "refresh") {
    throw new AuthError(401, "Invalid refresh token");
  }

  return { userId: sub };
}

export async function generateOtp(email: string): Promise<string> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new AuthError(400, "Valid email is required");
  }

  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const hash = await bcrypt.hash(`${otp}:${OTP_SECRET}`, 10);
  const createdAt = nowIso();
  const expiresAt = toIsoAfter(OTP_TTL_MS);

  await db
    .update(otp_codes)
    .set({ used_at: createdAt })
    .where(and(eq(otp_codes.email, normalizedEmail), isNull(otp_codes.used_at)));

  const rowId = randomUUID();
  await db.insert(otp_codes).values({
    id: rowId,
    email: normalizedEmail,
    hash,
    expires_at: expiresAt,
    used_at: null,
    created_at: createdAt,
  });

  await logAuthEvent("system", "otp_requested", rowId, { email: normalizedEmail });
  return otp;
}

export async function verifyOtp(email: string, otp: string): Promise<Profile> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !/^\d{6}$/.test(otp)) {
    throw new AuthError(401, "Invalid or expired OTP");
  }

  const candidates = await db
    .select()
    .from(otp_codes)
    .where(and(eq(otp_codes.email, normalizedEmail), isNull(otp_codes.used_at)))
    .orderBy(desc(otp_codes.created_at));

  const nowMs = Date.now();

  for (const row of candidates) {
    if (Date.parse(row.expires_at) <= nowMs) continue;

    const ok = await bcrypt.compare(`${otp}:${OTP_SECRET}`, row.hash);
    if (!ok) continue;

    await db
      .update(otp_codes)
      .set({ used_at: nowIso() })
      .where(eq(otp_codes.id, row.id));

    const [user] = await db
      .select()
      .from(profiles)
      .where(sql`lower(${profiles.email}) = lower(${normalizedEmail})`)
      .limit(1);

    if (!user) {
      throw new AuthError(401, "No account for that email");
    }

    await logAuthEvent(user.id, "otp_verified", row.id, { email: normalizedEmail, user_id: user.id });
    return user;
  }

  throw new AuthError(401, "Invalid or expired OTP");
}

export function signAccessToken(userId: string, role: UserRole): string {
  const normalizedRole = normalizeRole(role);
  return jwt.sign(
    {
      sub: userId,
      role: normalizedRole,
      type: "access",
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

export async function signRefreshToken(userId: string): Promise<string> {
  const token = jwt.sign(
    {
      sub: userId,
      type: "refresh",
      jti: randomUUID(),
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL },
  );

  await db.insert(refresh_tokens).values({
    id: randomUUID(),
    user_id: userId,
    token_hash: hashRefreshToken(token),
    expires_at: toIsoAfter(30 * 24 * 60 * 60 * 1000),
    revoked_at: null,
    created_at: nowIso(),
  });

  return token;
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return parseAccessTokenPayload(decoded);
  } catch {
    throw new AuthError(401, "Invalid access token");
  }
}

export async function verifyRefreshToken(token: string): Promise<string> {
  let claims: RefreshTokenClaims;
  try {
    claims = parseRefreshTokenPayload(jwt.verify(token, JWT_SECRET));
  } catch {
    throw new AuthError(401, "Invalid refresh token");
  }

  const [row] = await db
    .select()
    .from(refresh_tokens)
    .where(
      and(
        eq(refresh_tokens.user_id, claims.userId),
        eq(refresh_tokens.token_hash, hashRefreshToken(token)),
        isNull(refresh_tokens.revoked_at),
      ),
    )
    .limit(1);

  if (!row) {
    throw new AuthError(401, "Invalid refresh token");
  }

  if (Date.parse(row.expires_at) <= Date.now()) {
    throw new AuthError(401, "Refresh token expired");
  }

  return row.user_id;
}

export async function revokeRefreshToken(token: string, actorUserId: string): Promise<void> {
  const userId = await verifyRefreshToken(token);
  const revokedAt = nowIso();

  const [row] = await db
    .update(refresh_tokens)
    .set({ revoked_at: revokedAt })
    .where(
      and(
        eq(refresh_tokens.user_id, userId),
        eq(refresh_tokens.token_hash, hashRefreshToken(token)),
        isNull(refresh_tokens.revoked_at),
      ),
    )
    .returning({ id: refresh_tokens.id, user_id: refresh_tokens.user_id });

  if (!row) {
    throw new AuthError(401, "Invalid refresh token");
  }

  await logAuthEvent(actorUserId, "logout", row.id, { user_id: row.user_id });
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await db
    .update(refresh_tokens)
    .set({ revoked_at: nowIso() })
    .where(and(eq(refresh_tokens.user_id, userId), isNull(refresh_tokens.revoked_at)));

  await logAuthEvent(userId, "logout", userId, { revoked_all: true });
}
