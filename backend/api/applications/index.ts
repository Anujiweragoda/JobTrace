import prisma from "../../src/prismaClient";
import { serializeApplication, fromJsonArray } from "../../src/utils";
import { verifyToken } from "../../src/auth";

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "GET") {
      const { search, status, source } = req.query ?? {};

      const authHeader = req.headers?.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      const username = token ? verifyToken(token) : null;
      if (!username) return res.status(401).json({ error: "Authentication required" });

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) return res.status(401).json({ error: "Invalid user." });
      const userId = user.id;

      const where: any = { userId };
      if (status) where.status = status;
      if (source) where.source = source;
      if (search) {
        where.OR = [
          { company: { contains: search, mode: "insensitive" } },
          { position: { contains: search, mode: "insensitive" } },
          { jobDescription: { contains: search, mode: "insensitive" } },
          { notes: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
          { skills: { has: search } },
        ];
      }

      const apps = await prisma.application.findMany({ where, orderBy: { updatedAt: "desc" } });

      const rows = apps.map((app: any) => ({
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
      }));

      return res.json(rows.map(serializeApplication));
    }

    if (req.method === "POST") {
      const b = req.body ?? {};

      const authHeader = req.headers?.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      const username = token ? verifyToken(token) : null;
      if (!username) return res.status(401).json({ error: "Authentication required" });

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) return res.status(401).json({ error: "Invalid user." });

      const jobUrl = typeof b.job_url === "string" ? b.job_url.trim() : "";

      if (!b.company || !b.position) {
        if (jobUrl) {
          b.company = b.company || "Unknown company";
          b.position = b.position || "Job application";
        } else {
          return res.status(400).json({ error: "company and position are required" });
        }
      }

      const status = b.status && Array.isArray(["saved"]) ? b.status : b.status ?? "saved";

      try {
        const created = await prisma.application.create({
          data: {
            company: b.company,
            position: b.position,
            location: b.location ?? null,
            status,
            jobDescription: b.job_description ?? null,
            requirements: fromJsonArray(b.requirements),
            skills: fromJsonArray(b.skills),
            salary: b.salary ?? null,
            employmentType: b.employment_type ?? null,
            applicationDeadline: b.application_deadline ? new Date(b.application_deadline) : null,
            source: b.source ?? null,
            jobUrl: b.job_url ?? null,
            cvVersionId: b.cv_version_id ?? null,
            coverLetter: b.cover_letter ?? null,
            notes: b.notes ?? null,
            appliedDate: b.applied_date ? new Date(b.applied_date) : status !== "saved" ? new Date() : null,
            interviewDate: b.interview_date ? new Date(b.interview_date) : null,
            userId: user.id,
          },
        });

        const createdRow = await prisma.application.findUnique({ where: { id: created.id } });
        if (!createdRow) return res.status(500).json({ error: "Created application not found" });

        return res.status(201).json(
          serializeApplication({
            id: createdRow.id,
            company: createdRow.company,
            position: createdRow.position,
            location: createdRow.location ?? null,
            status: createdRow.status,
            job_description: createdRow.jobDescription ?? null,
            requirements: Array.isArray(createdRow.requirements) ? JSON.stringify(createdRow.requirements) : createdRow.requirements ?? null,
            skills: Array.isArray(createdRow.skills) ? JSON.stringify(createdRow.skills) : createdRow.skills ?? null,
            salary: createdRow.salary ?? null,
            employment_type: createdRow.employmentType ?? null,
            application_deadline: createdRow.applicationDeadline ? new Date(createdRow.applicationDeadline).toISOString() : null,
            source: createdRow.source ?? null,
            job_url: createdRow.jobUrl ?? null,
            cv_version_id: createdRow.cvVersionId ?? null,
            cover_letter: createdRow.coverLetter ?? null,
            notes: createdRow.notes ?? null,
            applied_date: createdRow.appliedDate ? new Date(createdRow.appliedDate).toISOString() : null,
            interview_date: createdRow.interviewDate ? new Date(createdRow.interviewDate).toISOString() : null,
            created_at: createdRow.createdAt.toISOString(),
            updated_at: createdRow.updatedAt.toISOString(),
          } as any)
        );
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error("Create application failed:", e);
        const message = e instanceof Error ? e.message : "Create failed";
        return res.status(500).json({ error: `Failed to create application: ${message}` });
      }
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("applications handler error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
