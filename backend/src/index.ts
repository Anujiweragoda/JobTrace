import express from "express";
import cors from "cors";
import applicationsRouter from "./routes/applications";
import remindersRouter from "./routes/reminders";
import cvVersionsRouter from "./routes/cvVersions";
import analyticsRouter from "./routes/analytics";
import authRouter from "./routes/auth";
import profileRouter from "./routes/profile";
import { requireAuth } from "./auth";

// eslint-disable-next-line no-console
console.log("Express app module loaded");

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4001;

// Log every incoming Express request early to verify routing reaches the app.
app.use((req, res, next) => {
  try {
    // eslint-disable-next-line no-console
    console.log("Express incoming request:", req.method, req.path, "headers:", JSON.stringify(req.headers || {}));
  } catch {}
  return next();
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/api/auth", authRouter);
app.use("/api/profile", requireAuth, profileRouter);
// Temporary production fallback: when deployed and the DB is unreachable
// some routes (notably /api/applications) can hang and cause Vercel to
// timeout. To allow the frontend to load for demos while the DB is fixed,
// return a minimal empty result for GET /api/applications and handle
// OPTIONS preflight. This is a short-term safety shim — remove when the
// underlying DB/connectivity issue is resolved.
if (process.env.NODE_ENV === "production") {
  app.options("/api/applications", (_req, res) => res.status(204).end());
  app.get("/api/applications", (_req, res) => res.json([]));
  app.post("/api/applications", (_req, res) => res.status(201).json({ error: "temporarily unavailable" }));
  app.get("/api/applications/:id", (_req, res) => res.status(404).json({ error: "temporarily unavailable" }));
  // mount the rest of the applications router behind the same path so other
  // methods still work if needed (they will still hit the DB).
  app.use("/api/applications", requireAuth, applicationsRouter);
} else {
  app.use("/api/applications", requireAuth, applicationsRouter);
}
app.use("/api/reminders", requireAuth, remindersRouter);
app.use("/api/cv-versions", requireAuth, cvVersionsRouter);
app.use("/api/analytics", requireAuth, analyticsRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Job Tracker API listening on http://localhost:${PORT}`);
  });
}

export default app;
