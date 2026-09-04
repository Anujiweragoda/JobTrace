import prisma from "../src/prismaClient";

export default async function handler(_req: any, res: any) {
  try {
    // CORS
    const origin = _req.headers?.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (_req.method === "OPTIONS") return res.status(204).end();

    // Run a fast user count with a short timeout to detect DB hangs.
    const dbPromise = prisma.user.count();
    const timeoutMs = 5000;
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));

    const result = await Promise.race([dbPromise, timeoutPromise]);

    if (result === null) {
      return res.status(503).json({ ok: false, error: "DB query timed out" });
    }

    return res.json({ ok: true, users: result });
  } catch (e: any) {
    console.error("db-check failed:", e);
    return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
}
