import { Router } from "express";
import db from "../db";
import { ApplicationRow, STATUSES } from "../types";
import { computeHealth } from "../utils";

const router = Router();

// GET /api/analytics/dashboard  -> stats cards + kanban column counts
router.get("/dashboard", (req, res) => {
  const counts: Record<string, number> = {};
  for (const s of STATUSES) {
    const row = db
      .prepare("SELECT COUNT(*) as c FROM applications WHERE status = ?")
      .get(s) as { c: number };
    counts[s] = row.c;
  }

  const total = db.prepare("SELECT COUNT(*) as c FROM applications").get() as { c: number };

  res.json({
    total: total.c,
    applied: counts.applied + counts.screening + counts.interview + counts.offer + counts.rejected,
    interviews: counts.interview + counts.offer,
    rejected: counts.rejected,
    offers: counts.offer,
    byStatus: counts,
  });
});

// GET /api/analytics  -> full analytics page data
router.get("/", (req, res) => {
  const totalApplications = db
    .prepare("SELECT COUNT(*) as c FROM applications WHERE status != 'saved'")
    .get() as { c: number };

  const interviews = db
    .prepare(
      "SELECT COUNT(*) as c FROM applications WHERE status IN ('interview','offer','rejected') AND id IN (SELECT application_id FROM timeline_events WHERE event_type = 'interview')"
    )
    .get() as { c: number };

  const interviewCount = db
    .prepare(
      "SELECT COUNT(DISTINCT application_id) as c FROM timeline_events WHERE event_type = 'interview'"
    )
    .get() as { c: number };

  const offers = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'offer'").get() as {
    c: number;
  };

  const responseRate =
    totalApplications.c > 0
      ? Math.round((interviewCount.c / totalApplications.c) * 100)
      : 0;

  const bySource = db
    .prepare(
      "SELECT COALESCE(source, 'Unspecified') as source, COUNT(*) as count FROM applications GROUP BY source ORDER BY count DESC"
    )
    .all();

  const byEmploymentType = db
    .prepare(
      "SELECT COALESCE(employment_type, 'Unspecified') as employment_type, COUNT(*) as count FROM applications GROUP BY employment_type ORDER BY count DESC"
    )
    .all();

  const byStatus = db
    .prepare("SELECT status, COUNT(*) as count FROM applications GROUP BY status")
    .all();

  res.json({
    totalApplications: totalApplications.c,
    interviews: interviewCount.c,
    offers: offers.c,
    responseRate,
    bySource,
    byEmploymentType,
    byStatus,
  });
});

// GET /api/analytics/health-summary -> counts per health bucket, for follow-ups page
router.get("/health-summary", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM applications WHERE status NOT IN ('rejected','offer')")
    .all() as unknown as ApplicationRow[];

  const summary: Record<string, number> = {
    active: 0,
    follow_up: 0,
    stale: 0,
    interview_soon: 0,
  };

  for (const row of rows) {
    summary[computeHealth(row)]++;
  }

  res.json(summary);
});

export default router;
