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
      user?: { username: string };
    }
  }
}

const SESSION_SECRET = process.env.JWT_SECRET || "job-tracker-local-secret";
const DEFAULT_USER = "admin";
const DEFAULT_PASSWORD = "admin123";
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

function ensureDefaultUser() {
  void (async () => {
    const existing = await prisma.user.findUnique({ where: { username: DEFAULT_USER } });
    if (!existing) {
      const passwordHash = hashPassword(DEFAULT_PASSWORD);
      await prisma.user.create({ data: { username: DEFAULT_USER, passwordHash } });
    }
  })();
}

ensureDefaultUser();

export function validateCredentials(username: string, password: string) {
  return (async () => {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.passwordHash) return false;
    return verifyPassword(password, user.passwordHash);
  })();
}

export async function createUser(username: string, password: string, email?: string) {
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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
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

  req.user = { username };
  return next();
}

export function getDefaultUser(): AuthUser {
  return { username: DEFAULT_USER };
}
