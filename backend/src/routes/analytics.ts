import { Router } from "express";
import prisma from "../prismaClient";
import { ApplicationRow, STATUSES } from "../types";
import { computeHealth } from "../utils";

const router = Router();

// GET /api/analytics/dashboard  -> stats cards + kanban column counts
router.get("/dashboard", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const counts: Record<string, number> = {};
  for (const s of STATUSES) {
    counts[s] = await prisma.application.count({ where: { status: s, userId } });
  }

  const total = await prisma.application.count({ where: { userId } });

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
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  try {
    // Run independent aggregates together. This avoids making a serverless request
    // wait on several sequential database round trips, especially on a cold pool.
    const [totalApplicationsCount, interviewEvents, offersCount, sourceGroups, employmentGroups, statusGroups] =
      await Promise.all([
        prisma.application.count({ where: { NOT: { status: "saved" }, userId } }),
        prisma.timelineEvent.groupBy({
          by: ["applicationId"],
          where: { eventType: "interview", application: { userId } },
        }),
        prisma.application.count({ where: { status: "offer", userId } }),
        prisma.application.groupBy({
          by: ["source"],
          where: { userId },
          _count: { _all: true },
          orderBy: { _count: { source: "desc" } },
        }),
        prisma.application.groupBy({
          by: ["employmentType"],
          where: { userId },
          _count: { _all: true },
          orderBy: { _count: { employmentType: "desc" } },
        }),
        prisma.application.groupBy({
          by: ["status"],
          where: { userId },
          _count: { _all: true },
          orderBy: { _count: { status: "desc" } },
        }),
      ]);

    const responseRate = totalApplicationsCount > 0
      ? Math.round((interviewEvents.length / totalApplicationsCount) * 100)
      : 0;

    res.json({
      totalApplications: totalApplicationsCount,
      interviews: interviewEvents.length,
      offers: offersCount,
      responseRate,
      bySource: sourceGroups.map((row) => ({
        source: row.source ?? "Unspecified",
        count: row._count._all,
      })),
      byEmploymentType: employmentGroups.map((row) => ({
        employment_type: row.employmentType ?? "Unspecified",
        count: row._count._all,
      })),
      byStatus: statusGroups.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
    });
  } catch (error) {
    console.error("Analytics query failed", error);
    res.status(503).json({ error: "Analytics is temporarily unavailable. Please try again." });
  }
});

// GET /api/analytics/health-summary -> counts per health bucket, for follow-ups page
router.get("/health-summary", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const rows = (await prisma.$queryRaw`SELECT * FROM applications WHERE status NOT IN ('rejected','offer') AND user_id = ${userId}`) as unknown as ApplicationRow[];

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
