export default function handler(req: any, res: any) {
  try {
    // Only return presence of sensitive envs, not their values.
    const envInfo = {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV || null,
    };

    // Echo some request metadata to help isolate proxy behavior.
    const info = {
      ok: true,
      method: req.method,
      url: req.url,
      headers: req.headers,
      env: envInfo,
      time: new Date().toISOString(),
    };

    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(JSON.stringify(info, null, 2));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("api/debug failed:", e);
    return res.status(500).json({ ok: false, error: "debug failed" });
  }
}
