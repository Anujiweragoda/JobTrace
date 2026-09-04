import { verifyToken } from "../../src/auth";
import prisma from "../../src/prismaClient";
import { disconnectPrisma } from "../../src/prismaClient";

function setCorsHeaders(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: any, res: any) {
  try {
    // eslint-disable-next-line no-console
    console.log("native auth/me invoked", req.method);
  } catch {}

  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET,OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token provided." });

  const username = verifyToken(token);
  if (!username) return res.status(401).json({ error: "Invalid or expired token." });

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "Invalid user." });
    return res.json({ user: { username: user.username, id: user.id, email: user.email ?? null } });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("native auth/me failed:", e);
    return res.status(500).json({ error: "Failed to fetch user." });
  } finally {
    try {
      await disconnectPrisma();
      // eslint-disable-next-line no-console
      console.log("native auth/me: prisma disconnected");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("native auth/me: prisma disconnect failed:", err);
    }
  }
}
