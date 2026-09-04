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

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/api/auth", authRouter);
app.use("/api/profile", requireAuth, profileRouter);
app.use("/api/applications", requireAuth, applicationsRouter);
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
