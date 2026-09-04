import { validateCredentials, createAuthToken } from "../../src/auth";
import { disconnectPrisma } from "../../src/prismaClient";

export default async function handler(req: any, res: any) {
  try {
    // eslint-disable-next-line no-console
    console.log("native auth/login invoked", req.method);
  } catch {}

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "username and password required" });
  }

  try {
    const ok = await validateCredentials(username, password);
    if (!ok) return res.status(401).json({ error: "Invalid username or password." });

    const token = createAuthToken(username);
    res.status(200).json({ token, user: { username } });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("native auth/login failed:", e);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    try {
      await disconnectPrisma();
      // eslint-disable-next-line no-console
      console.log("native auth/login: prisma disconnected");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("native auth/login: prisma disconnect failed:", err);
    }
  }
}
