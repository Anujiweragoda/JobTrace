import { Router } from "express";
import prisma from "../prismaClient";
import { ApplicationRow, STATUSES, Status, TimelineEventRow } from "../types";
import { fromJsonArray, serializeApplication } from "../utils";
import { extractJobDetailsFromHtml } from "../scrapeJobUrl";

const router = Router();

function deriveCompanyFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host
      .split(".")[0]
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return "Unknown company";
  }
}

function derivePositionFromUrl(): string {
  return "Job application";
}

async function getTimeline(applicationId: number): Promise<TimelineEventRow[]> {
  return (await prisma.timelineEvent.findMany({ where: { applicationId }, orderBy: [{ eventDate: "asc" }, { id: "asc" }] })) as unknown as TimelineEventRow[];
}

function addTimelineEvent(applicationId: number, eventType: string, description?: string) {
  void prisma.timelineEvent.create({ data: { applicationId, eventType, description: description ?? null } });
}

function touchUpdatedAt(id: number) {
  void prisma.application.update({ where: { id }, data: { updatedAt: new Date() } });
}

// GET /api/applications?search=&status=&source=
router.get("/", async (req, res) => {
  const { search, status, source } = req.query as Record<string, string>;

  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

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

  const rows = apps.map((app) => ({
    id: app.id,
    company: app.company,
    position: app.position,
    location: app.location ?? null,
    status: app.status as Status,
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
  })) as ApplicationRow[];

  res.json(rows.map(serializeApplication));
});

async function fetchJobPageHtml(url: string): Promise<string> {
  const candidates = [url, `https://r.jina.ai/http://${url}`];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0; +https://localhost)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) continue;

      const html = await response.text();
      if (html && html.trim()) return html;
    } catch {
      continue;
    }
  }

  // Try a headless browser fetch as a fallback for sites that require JS or block simple fetches.
  try {
    // Dynamically import puppeteer so it's optional.
    // To enable this fallback install puppeteer: `npm install puppeteer` in backend/
    // If not installed, this will throw and we'll fall back to the standard error.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    try {
      const page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36");
      await page.setExtraHTTPHeaders({ Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" });
      const tryTargets = [url, `http://${url.replace(/^https?:\/\//, "")}`];
      for (const t of tryTargets) {
        try {
          await page.goto(t, { waitUntil: "networkidle2", timeout: 20000 });
          const content = await page.content();
          if (content && content.trim()) {
            await page.close();
            await browser.close();
            return content;
          }
        } catch (e) {
          // try next
          continue;
        }
      }
      await browser.close();
    } catch (e) {
      try {
        await browser.close();
      } catch {}
    }
  } catch (e) {
    // puppeteer not available or failed — fall through to error below
  }

  throw new Error("The job page is blocking automated fetches, so its details could not be parsed automatically. To enable a stronger fallback try installing Puppeteer in backend/ (npm install puppeteer) or use the manual entry form.");
}

// POST /api/applications/preview
router.post("/preview", async (req, res) => {
  const { url } = req.body ?? {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "A valid job URL is required." });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "The job URL is not valid." });
  }

  try {
    const html = await fetchJobPageHtml(parsedUrl.toString());
    const details = extractJobDetailsFromHtml(html, parsedUrl.toString());

    res.json({
      ...details,
      warning: !details.company && !details.position && !details.job_description
        ? "The job page blocked auto-fetching, but the link was saved. Please review and complete the remaining details manually."
        : undefined,
    });
  } catch (error) {
    console.error("Job URL preview failed:", error);
    res.json({
      company: null,
      position: null,
      location: null,
      job_description: null,
      requirements: [],
      skills: [],
      salary: null,
      employment_type: null,
      source: "Job posting link",
      warning:
        "This job site blocks automated fetching, but the link was still saved. Please fill in the remaining details manually.",
    });
  }
});

// GET /api/applications/:id
// GET /api/applications/:id
router.get("/:id", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const id = Number(req.params.id);
  const app = await prisma.application.findUnique({ where: { id } });
  if (!app || app.userId !== userId) return res.status(404).json({ error: "Application not found" });

  const row = {
    id: app.id,
    company: app.company,
    position: app.position,
    location: app.location ?? null,
    status: app.status as Status,
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
  } as ApplicationRow;

  const timeline = await getTimeline(id);
  const reminders = await prisma.reminder.findMany({ where: { applicationId: id }, orderBy: { dueDate: "asc" } });

  res.json({ ...serializeApplication(row), timeline, reminders });
});

// POST /api/applications
router.post("/", async (req, res) => {
  const b = req.body ?? {};
  const jobUrl = typeof b.job_url === "string" ? b.job_url.trim() : "";

  if (!b.company || !b.position) {
    if (jobUrl) {
      b.company = b.company || deriveCompanyFromUrl(jobUrl);
      b.position = b.position || derivePositionFromUrl();
    } else {
      return res.status(400).json({ error: "company and position are required" });
    }
  }

  const status: Status = STATUSES.includes(b.status) ? b.status : "saved";

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
        userId: (req as any).user?.id ?? null,
      },
    });

    const id = created.id;
    addTimelineEvent(id, "saved", `Job saved: ${b.position} at ${b.company}`);
    if (status !== "saved") {
      addTimelineEvent(id, status, `Status set to ${status}`);
    }

    const createdRow = await prisma.application.findUnique({ where: { id } });
    if (!createdRow) return res.status(500).json({ error: "Created application not found" });

    res.status(201).json(
      serializeApplication({
        id: createdRow.id,
        company: createdRow.company,
        position: createdRow.position,
        location: createdRow.location ?? null,
        status: createdRow.status as Status,
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
      } as ApplicationRow)
    );
  } catch (e) {
    // Log full error for debugging (Prisma runtime errors can be verbose)
    // eslint-disable-next-line no-console
    console.error("Create application failed:", e);
    const message = e instanceof Error ? e.message : "Create failed";
    res.status(500).json({ error: `Failed to create application: ${message}` });
  }
});

// PUT /api/applications/:id  (full edit)
router.put("/:id", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const id = Number(req.params.id);
  const existing = await prisma.application.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return res.status(404).json({ error: "Application not found" });

  const b = req.body ?? {};

  const updated = await prisma.application.update({
    where: { id },
    data: {
      company: b.company ?? existing.company,
      position: b.position ?? existing.position,
      location: b.location ?? existing.location,
      jobDescription: b.job_description ?? existing.jobDescription,
      requirements: b.requirements !== undefined ? fromJsonArray(b.requirements) : (existing.requirements as any),
      skills: b.skills !== undefined ? fromJsonArray(b.skills) : (existing.skills as any),
      salary: b.salary ?? existing.salary,
      employmentType: b.employmentType ?? existing.employmentType,
      applicationDeadline: b.application_deadline ? new Date(b.application_deadline) : existing.applicationDeadline,
      source: b.source ?? existing.source,
      jobUrl: b.job_url ?? existing.jobUrl,
      cvVersionId: b.cv_version_id ?? existing.cvVersionId,
      coverLetter: b.cover_letter ?? existing.coverLetter,
      notes: b.notes ?? existing.notes,
      appliedDate: b.applied_date ? new Date(b.applied_date) : existing.appliedDate,
      interviewDate: b.interview_date ? new Date(b.interview_date) : existing.interviewDate,
      updatedAt: new Date(),
    },
  });

  if (b.interview_date && b.interview_date !== (existing.interviewDate ? existing.interviewDate.toISOString() : existing.interviewDate)) {
    addTimelineEvent(id, "interview_scheduled", `Interview set for ${b.interview_date}`);
  }

  const updatedApp = await prisma.application.findUnique({ where: { id } });
  if (!updatedApp) return res.status(500).json({ error: "Updated application not found" });

  res.json(
    serializeApplication({
      id: updatedApp.id,
      company: updatedApp.company,
      position: updatedApp.position,
      location: updatedApp.location ?? null,
      status: updatedApp.status as Status,
      job_description: updatedApp.jobDescription ?? null,
      requirements: Array.isArray(updatedApp.requirements) ? JSON.stringify(updatedApp.requirements) : updatedApp.requirements ?? null,
      skills: Array.isArray(updatedApp.skills) ? JSON.stringify(updatedApp.skills) : updatedApp.skills ?? null,
      salary: updatedApp.salary ?? null,
      employment_type: updatedApp.employmentType ?? null,
      application_deadline: updatedApp.applicationDeadline ? new Date(updatedApp.applicationDeadline).toISOString() : null,
      source: updatedApp.source ?? null,
      job_url: updatedApp.jobUrl ?? null,
      cv_version_id: updatedApp.cvVersionId ?? null,
      cover_letter: updatedApp.coverLetter ?? null,
      notes: updatedApp.notes ?? null,
      applied_date: updatedApp.appliedDate ? new Date(updatedApp.appliedDate).toISOString() : null,
      interview_date: updatedApp.interviewDate ? new Date(updatedApp.interviewDate).toISOString() : null,
      created_at: updatedApp.createdAt.toISOString(),
      updated_at: updatedApp.updatedAt.toISOString(),
    } as ApplicationRow)
  );
});

// PATCH /api/applications/:id/status  (drag-and-drop kanban move)
router.patch("/:id/status", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const id = Number(req.params.id);
  const { status } = req.body ?? {};

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
  }

  const existing = await prisma.application.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return res.status(404).json({ error: "Application not found" });

  const data: any = { status, updatedAt: new Date() };
  if (status === "applied" && !existing.appliedDate) {
    data.appliedDate = new Date();
  }

  await prisma.application.update({ where: { id }, data });

  addTimelineEvent(id, status, `Moved to ${status}`);

  // Auto follow-up reminder when moving to "applied"
  if (status === "applied") {
    const due = new Date();
    due.setDate(due.getDate() + 7);
    await prisma.reminder.create({ data: { applicationId: id, message: `Follow up on ${existing.position} at ${existing.company}`, dueDate: due } });
  }

  const patched = await prisma.application.findUnique({ where: { id } });
  if (!patched || patched.userId !== userId) return res.status(500).json({ error: "Application not found after status update" });
  if (!patched) return res.status(500).json({ error: "Application not found after status update" });

  res.json(
    serializeApplication({
      id: patched.id,
      company: patched.company,
      position: patched.position,
      location: patched.location ?? null,
      status: patched.status as Status,
      job_description: patched.jobDescription ?? null,
      requirements: Array.isArray(patched.requirements) ? JSON.stringify(patched.requirements) : patched.requirements ?? null,
      skills: Array.isArray(patched.skills) ? JSON.stringify(patched.skills) : patched.skills ?? null,
      salary: patched.salary ?? null,
      employment_type: patched.employmentType ?? null,
      application_deadline: patched.applicationDeadline ? new Date(patched.applicationDeadline).toISOString() : null,
      source: patched.source ?? null,
      job_url: patched.jobUrl ?? null,
      cv_version_id: patched.cvVersionId ?? null,
      cover_letter: patched.coverLetter ?? null,
      notes: patched.notes ?? null,
      applied_date: patched.appliedDate ? new Date(patched.appliedDate).toISOString() : null,
      interview_date: patched.interviewDate ? new Date(patched.interviewDate).toISOString() : null,
      created_at: patched.createdAt.toISOString(),
      updated_at: patched.updatedAt.toISOString(),
    } as ApplicationRow)
  );
});

// POST /api/applications/:id/timeline  (manual event, e.g. recruiter contacted)
router.post("/:id/timeline", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const id = Number(req.params.id);
  const existing = await prisma.application.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!existing || existing.userId !== userId) return res.status(404).json({ error: "Application not found" });

  const { event_type, description, event_date } = req.body ?? {};
  if (!event_type) return res.status(400).json({ error: "event_type is required" });

  await prisma.timelineEvent.create({ data: { applicationId: id, eventType: event_type, description: description ?? null, eventDate: event_date ? new Date(event_date) : new Date() } });

  touchUpdatedAt(id);
  res.status(201).json(await getTimeline(id));
});

// DELETE /api/applications/:id
router.delete("/:id", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const id = Number(req.params.id);
  const existing = await prisma.application.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!existing || existing.userId !== userId) return res.status(404).json({ error: "Application not found" });

  try {
    await prisma.application.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    res.status(404).json({ error: "Application not found" });
  }
});

export default router;
