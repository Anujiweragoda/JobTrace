import { createUser, createAuthToken } from "../../src/auth";
import { disconnectPrisma } from "../../src/prismaClient";

function setCorsHeaders(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: any, res: any) {
  try {
    // eslint-disable-next-line no-console
    console.log("native auth/signup invoked", req.method);
  } catch {}

  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST,OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password, email } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "username and password are required" });
  }

  try {
    const user = await createUser(username, password, typeof email === "string" ? email : undefined);
    const token = createAuthToken(user.username);
    return res.status(201).json({ token, user });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("native auth/signup failed:", err);
    return res.status(400).json({ error: err instanceof Error ? err.message : "Signup failed" });
  } finally {
    try {
      await disconnectPrisma();
      // eslint-disable-next-line no-console
      console.log("native auth/signup: prisma disconnected");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("native auth/signup: prisma disconnect failed:", e);
    }
  }
}
