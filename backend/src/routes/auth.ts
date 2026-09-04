import { Router } from "express";
import { createAuthToken, upsertGoogleUser, validateCredentials, verifyGoogleCredential, verifyToken, createUser } from "../auth";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    // eslint-disable-next-line no-console
    console.log("auth/login handler start: bodyKeys=", Object.keys(req.body || {}));
  } catch {}
  const { username, password } = req.body ?? {};

  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Username and password are required." });
  }

  if (!(await validateCredentials(username, password))) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const token = createAuthToken(username);
  return res.json({ token, user: { username } });
});

router.post("/google", async (req, res) => {
  try {
    // eslint-disable-next-line no-console
    console.log("auth/google handler start: hasCredential=", !!(req.body && req.body.credential));
  } catch {}
  const { credential } = req.body ?? {};

  if (typeof credential !== "string" || !credential.trim()) {
    return res.status(400).json({ error: "Google credential is required." });
  }

  try {
    const payload = await verifyGoogleCredential(credential);
    const user = await upsertGoogleUser(payload.email, payload.name, payload.sub ?? payload.email);
    const token = createAuthToken(user.username);
    return res.json({
      token,
      user: { username: user.username, email: payload.email, picture: payload.picture },
    });
  } catch (error) {
    return res.status(401).json({
      error: error instanceof Error ? error.message : "Google login failed.",
    });
  }
});

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    // eslint-disable-next-line no-console
    console.log("auth/signup handler start: bodyKeys=", Object.keys(req.body || {}));
  } catch {}
  const { username, password, email } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "username and password are required" });
  }

  try {
    const user = await createUser(username, password, typeof email === "string" ? email : undefined);
    const token = createAuthToken(user.username);
    return res.status(201).json({ token, user });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Signup failed" });
  }
});

router.get("/me", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  try {
    // eslint-disable-next-line no-console
    console.log("/me authHeader:", authHeader ? authHeader.slice(0, 64) + "..." : "(none)");
  } catch {}

  if (!token) {
    return res.status(401).json({ error: "No token provided." });
  }

  const username = verifyToken(token);
  try {
    // eslint-disable-next-line no-console
    const parts = token ? token.split('.') : [];
    let payload = null;
    try {
      if (parts.length === 3) payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch (e) {
      payload = null;
    }
    console.log("/me verifyToken result:", username ? "OK -> " + username : "INVALID", "tokenLen:", token?.length ?? 0, "parts:", parts.length, "payload:", payload);
  } catch {}

  if (!username) {
    return res.status(401).json({ error: "Token is invalid or expired." });
  }

  return res.json({ user: { username } });
});

export default router;
