import express from "express";
import cors from "cors";
import applicationsRouter from "./routes/applications";
import remindersRouter from "./routes/reminders";
import cvVersionsRouter from "./routes/cvVersions";
import analyticsRouter from "./routes/analytics";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/api/applications", applicationsRouter);
app.use("/api/reminders", remindersRouter);
app.use("/api/cv-versions", cvVersionsRouter);
app.use("/api/analytics", analyticsRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Job Tracker API listening on http://localhost:${PORT}`);
});
