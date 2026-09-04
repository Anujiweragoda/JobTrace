import prisma from "../../src/prismaClient";
import { serializeApplication } from "../../src/utils";
import { verifyToken } from "../../src/auth";

async function getTimeline(applicationId: number) {
  return await prisma.timelineEvent.findMany({ where: { applicationId }, orderBy: [{ eventDate: "asc" }, { id: "asc" }] });
}

export default async function handler(req: any, res: any) {
  try {
    // CORS
    const origin = req.headers?.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.status(204).end();

    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const authHeader = req.headers?.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const username = token ? verifyToken(token) : null;
    if (!username) return res.status(401).json({ error: "Authentication required" });

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "Invalid user." });

    const idStr = req.query?.id || req.query?.["id"] || req.query?.params?.id;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const app = await prisma.application.findUnique({ where: { id } });
    if (!app || app.userId !== user.id) return res.status(404).json({ error: "Application not found" });

    const row = {
      id: app.id,
      company: app.company,
      position: app.position,
      location: app.location ?? null,
      status: app.status,
      job_description: app.jobDescription ?? null,
      requirements: Array.isArray(app.requirements) ? JSON.stringify(app.requirements) : app.requirements ?? null,
      skills: Array.isArray(app.skills) ? JSON.stringify(app.skills) : app.skills ?? null,
      salary: app.salary ?? null,
      employment_type: app.employmentType ?? null,
      application_deadline: app.applicationDeadline ? new Date(app.applicationDeadline).toISOString() : null,
      source: app.source ?? null,
      job_url: app.jobUrl ?? null,
      cv_version_id: app.cvVersionId ?? null,
      cover_letter: app.coverLetter ?? null,
      notes: app.notes ?? null,
      applied_date: app.appliedDate ? new Date(app.appliedDate).toISOString() : null,
      interview_date: app.interviewDate ? new Date(app.interviewDate).toISOString() : null,
      created_at: app.createdAt.toISOString(),
      updated_at: app.updatedAt.toISOString(),
    } as any;

    const timeline = await getTimeline(id);
    const reminders = await prisma.reminder.findMany({ where: { applicationId: id }, orderBy: { dueDate: "asc" } });

    return res.json({ ...serializeApplication(row), timeline, reminders });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("applications/[id] handler error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
