import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import prisma from "./prismaClient";

let OAuth2Client: any = null;

try {
  ({ OAuth2Client } = require("google-auth-library"));
} catch {
  OAuth2Client = null;
}

declare global {
  namespace Express {
    interface Request {
      user?: { username: string; id?: number };
    }
  }
}

const SESSION_SECRET = process.env.JWT_SECRET || "job-tracker-local-secret";
// Default admin account no longer hard-coded. Provide via env vars to enable seeding in CI/dev only.
const DEFAULT_USER = process.env.DEFAULT_USER || "";
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = GOOGLE_CLIENT_ID && OAuth2Client ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export type AuthUser = {
  username: string;
};

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 100000;
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  return `${iterations}:${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string) {
  const parts = storedHash.split(":");
  if (parts.length !== 3) return false;

  const [iterationsText, salt, hash] = parts;
  const iterations = Number.parseInt(iterationsText, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const derived = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(derived, "hex");

  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

let _defaultUserEnsured = false;
// Seeding disabled: no auto-creation of default users in any environment.
async function ensureDefaultUserOnce() {
  if (_defaultUserEnsured) return;
  _defaultUserEnsured = true;
  return;
}

export function validateCredentials(username: string, password: string) {
  return (async () => {
    await ensureDefaultUserOnce();
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.passwordHash) return false;
    return verifyPassword(password, user.passwordHash);
  })();
}

export async function createUser(username: string, password: string, email?: string) {
  await ensureDefaultUserOnce();
  const safeUsername = (username || "").trim();
  if (!safeUsername || typeof password !== "string" || password.length < 6) {
    throw new Error("Invalid username or password (min 6 chars)");
  }

  const existing = await prisma.user.findFirst({ where: { OR: [{ username: safeUsername }, { email }] } });
  if (existing) {
    throw new Error("User with that username or email already exists");
  }

  const passwordHash = hashPassword(password);
  const created = await prisma.user.create({ data: { username: safeUsername, passwordHash, email: email ?? null } });
  return { username: created.username, email: created.email };
}

export function upsertGoogleUser(email: string, name: string, googleId: string) {
  const safeUsername = (name || email.split("@")[0] || "user").trim();
  return (async () => {
    await ensureDefaultUserOnce();
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { googleId }] } });
    if (existing) {
      const username = existing.username || safeUsername;
      await prisma.user.update({ where: { id: existing.id }, data: { email, googleId, username } });
      return { username, email };
    }

    const username = safeUsername;
    await prisma.user.create({ data: { username, email, googleId } });
    return { username, email };
  })();
}

export function createAuthToken(username: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: username, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");

  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    try {
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      return typeof decoded.sub === "string" ? decoded.sub : null;
    } catch {
      return null;
    }
  }

  return null;
}

export async function verifyGoogleCredential(credential: string) {
  if (!googleClient) {
    throw new Error("Google login is not configured on the server.");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error("Google account could not be verified.");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split("@")[0],
    picture: payload.picture || null,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || "";
  try {
    // eslint-disable-next-line no-console
    console.log(
      "requireAuth incoming:",
      req.method,
      req.path,
      "Authorization:",
      authHeader ? authHeader.slice(0, 32) + "..." : "(none)"
    );
  } catch {}

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const username = verifyToken(token);
  try {
    // eslint-disable-next-line no-console
    console.log("verifyToken result for token startsWith:", token ? token.slice(0, 8) : null, "->", username ? "OK" : "INVALID");
  } catch {}
  if (!username) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  try {
    // Ensure default user exists on-demand rather than at module import time
    await ensureDefaultUserOnce();

    // Protect against long DB hangs in serverless by racing the DB call
    // against a short timeout so the function returns quickly with a
    // clear error instead of hitting the platform invocation timeout.
    const dbPromise = prisma.user.findUnique({ where: { username } });
    const timeoutMs = 7000;
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));

    const user = (await Promise.race([dbPromise, timeoutPromise])) as any;
    if (!user) {
      // If user wasn't found due to DB timeout or missing user, return 503 for timeout,
      // or 401 for an explicitly missing user. Distinguish by checking whether the
      // DB promise resolved yet is impossible here, so prefer 503 when timed out.
      // Provide a helpful message for diagnostics.
      return res.status(503).json({ error: "Database unavailable or timed out (please check DATABASE_URL and network)" });
    }

    req.user = { username, id: user.id };
    return next();
  } catch (e) {
    return res.status(500).json({ error: "Failed to verify user." });
  }
}

export function getDefaultUser(): AuthUser {
  return { username: DEFAULT_USER };
}

export async function updateUser(userId: number, newUsername?: string, newPassword?: string) {
  const data: any = {};
  if (typeof newUsername === "string" && newUsername.trim()) {
    const safe = newUsername.trim();
    // ensure uniqueness
    const existing = await prisma.user.findFirst({ where: { username: safe } });
    if (existing && existing.id !== userId) throw new Error("Username already taken");
    data.username = safe;
  }

  if (typeof newPassword === "string" && newPassword.length > 0) {
    if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
    data.passwordHash = hashPassword(newPassword);
  }

  if (Object.keys(data).length === 0) throw new Error("No changes provided");

  const updated = await prisma.user.update({ where: { id: userId }, data });
  return { username: updated.username, email: updated.email ?? null };
}
