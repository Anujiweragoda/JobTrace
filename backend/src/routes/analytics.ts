import { Router } from "express";
import prisma from "../prismaClient";
import { ApplicationRow, STATUSES } from "../types";
import { computeHealth } from "../utils";

const router = Router();

// GET /api/analytics/dashboard  -> stats cards + kanban column counts
router.get("/dashboard", async (req, res) => {
  const counts: Record<string, number> = {};
  for (const s of STATUSES) {
    counts[s] = await prisma.application.count({ where: { status: s } });
  }

  const total = await prisma.application.count();

  res.json({
    total,
    applied: counts.applied + counts.screening + counts.interview + counts.offer + counts.rejected,
    interviews: counts.interview + counts.offer,
    rejected: counts.rejected,
    offers: counts.offer,
    byStatus: counts,
  });
});

// GET /api/analytics  -> full analytics page data
router.get("/", async (req, res) => {
  const totalApplicationsCount = await prisma.application.count({ where: { NOT: { status: "saved" } } });

  const interviewCountDistinct = await prisma.timelineEvent.findMany({ where: { eventType: "interview" }, distinct: ["applicationId"], select: { applicationId: true } });

  const offersCount = await prisma.application.count({ where: { status: "offer" } });

  const responseRate = totalApplicationsCount > 0 ? Math.round((interviewCountDistinct.length / totalApplicationsCount) * 100) : 0;

  const bySource = await prisma.$queryRaw`
    SELECT COALESCE(source, 'Unspecified') as source, COUNT(*) as count FROM applications GROUP BY source ORDER BY count DESC
  `;

  const byEmploymentType = await prisma.$queryRaw`
    SELECT COALESCE(employment_type, 'Unspecified') as employment_type, COUNT(*) as count FROM applications GROUP BY employment_type ORDER BY count DESC
  `;

  const byStatus = await prisma.$queryRaw`
    SELECT status, COUNT(*) as count FROM applications GROUP BY status
  `;

  res.json({
    totalApplications: totalApplicationsCount,
    interviews: interviewCountDistinct.length,
    offers: offersCount,
    responseRate,
    bySource,
    byEmploymentType,
    byStatus,
  });
});

// GET /api/analytics/health-summary -> counts per health bucket, for follow-ups page
router.get("/health-summary", async (req, res) => {
  const rows = (await prisma.$queryRaw`SELECT * FROM applications WHERE status NOT IN ('rejected','offer')`) as unknown as ApplicationRow[];

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
