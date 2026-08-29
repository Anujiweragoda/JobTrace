import { Router } from "express";
import db from "../db";
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

function getTimeline(applicationId: number): TimelineEventRow[] {
  return db
    .prepare(
      "SELECT * FROM timeline_events WHERE application_id = ? ORDER BY event_date ASC, id ASC"
    )
    .all(applicationId) as unknown as TimelineEventRow[];
}

function addTimelineEvent(
  applicationId: number,
  eventType: string,
  description?: string
) {
  db.prepare(
    "INSERT INTO timeline_events (application_id, event_type, description) VALUES (?, ?, ?)"
  ).run(applicationId, eventType, description ?? null);
}

function touchUpdatedAt(id: number) {
  db.prepare(
    "UPDATE applications SET updated_at = datetime('now') WHERE id = ?"
  ).run(id);
}

// GET /api/applications?search=&status=&source=
router.get("/", (req, res) => {
  const { search, status, source } = req.query as Record<string, string>;

  let sql = "SELECT * FROM applications WHERE 1=1";
  const params: any[] = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (source) {
    sql += " AND source = ?";
    params.push(source);
  }
  if (search) {
    sql +=
      " AND (company LIKE ? OR position LIKE ? OR job_description LIKE ? OR notes LIKE ? OR location LIKE ? OR skills LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }

  sql += " ORDER BY updated_at DESC";

  const rows = db.prepare(sql).all(...params) as unknown as ApplicationRow[];
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

  throw new Error("The job page is blocking automated fetches, so its details could not be parsed automatically.");
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
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT * FROM applications WHERE id = ?")
    .get(id) as unknown as ApplicationRow | undefined;

  if (!row) return res.status(404).json({ error: "Application not found" });

  const timeline = getTimeline(id);
  const reminders = db
    .prepare(
      "SELECT * FROM reminders WHERE application_id = ? ORDER BY due_date ASC"
    )
    .all(id);

  res.json({ ...serializeApplication(row), timeline, reminders });
});

// POST /api/applications
router.post("/", (req, res) => {
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

  const info = db
    .prepare(
      `INSERT INTO applications
        (company, position, location, status, job_description, requirements, skills,
         salary, employment_type, application_deadline, source, job_url, cv_version_id,
         cover_letter, notes, applied_date, interview_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.company,
      b.position,
      b.location ?? null,
      status,
      b.job_description ?? null,
      fromJsonArray(b.requirements),
      fromJsonArray(b.skills),
      b.salary ?? null,
      b.employment_type ?? null,
      b.application_deadline ?? null,
      b.source ?? null,
      b.job_url ?? null,
      b.cv_version_id ?? null,
      b.cover_letter ?? null,
      b.notes ?? null,
      b.applied_date ?? (status !== "saved" ? new Date().toISOString() : null),
      b.interview_date ?? null
    );

  const id = Number(info.lastInsertRowid);
  addTimelineEvent(id, "saved", `Job saved: ${b.position} at ${b.company}`);
  if (status !== "saved") {
    addTimelineEvent(id, status, `Status set to ${status}`);
  }

  const row = db
    .prepare("SELECT * FROM applications WHERE id = ?")
    .get(id) as unknown as ApplicationRow;
  res.status(201).json(serializeApplication(row));
});

// PUT /api/applications/:id  (full edit)
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare("SELECT * FROM applications WHERE id = ?")
    .get(id) as unknown as ApplicationRow | undefined;
  if (!existing) return res.status(404).json({ error: "Application not found" });

  const b = req.body ?? {};

  db.prepare(
    `UPDATE applications SET
      company = ?, position = ?, location = ?, job_description = ?, requirements = ?,
      skills = ?, salary = ?, employment_type = ?, application_deadline = ?, source = ?,
      job_url = ?, cv_version_id = ?, cover_letter = ?, notes = ?, applied_date = ?,
      interview_date = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    b.company ?? existing.company,
    b.position ?? existing.position,
    b.location ?? existing.location,
    b.job_description ?? existing.job_description,
    b.requirements !== undefined ? fromJsonArray(b.requirements) : existing.requirements,
    b.skills !== undefined ? fromJsonArray(b.skills) : existing.skills,
    b.salary ?? existing.salary,
    b.employment_type ?? existing.employment_type,
    b.application_deadline ?? existing.application_deadline,
    b.source ?? existing.source,
    b.job_url ?? existing.job_url,
    b.cv_version_id ?? existing.cv_version_id,
    b.cover_letter ?? existing.cover_letter,
    b.notes ?? existing.notes,
    b.applied_date ?? existing.applied_date,
    b.interview_date ?? existing.interview_date,
    id
  );

  if (b.interview_date && b.interview_date !== existing.interview_date) {
    addTimelineEvent(id, "interview_scheduled", `Interview set for ${b.interview_date}`);
  }

  const row = db.prepare("SELECT * FROM applications WHERE id = ?").get(id) as unknown as ApplicationRow;
  res.json(serializeApplication(row));
});

// PATCH /api/applications/:id/status  (drag-and-drop kanban move)
router.patch("/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body ?? {};

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
  }

  const existing = db
    .prepare("SELECT * FROM applications WHERE id = ?")
    .get(id) as unknown as ApplicationRow | undefined;
  if (!existing) return res.status(404).json({ error: "Application not found" });

  const updates: string[] = ["status = ?", "updated_at = datetime('now')"];
  const params: any[] = [status];

  if (status === "applied" && !existing.applied_date) {
    updates.push("applied_date = ?");
    params.push(new Date().toISOString());
  }

  params.push(id);
  db.prepare(`UPDATE applications SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  addTimelineEvent(id, status, `Moved to ${status}`);

  // Auto follow-up reminder when moving to "applied"
  if (status === "applied") {
    const due = new Date();
    due.setDate(due.getDate() + 7);
    db.prepare(
      "INSERT INTO reminders (application_id, message, due_date) VALUES (?, ?, ?)"
    ).run(id, `Follow up on ${existing.position} at ${existing.company}`, due.toISOString());
  }

  const row = db.prepare("SELECT * FROM applications WHERE id = ?").get(id) as unknown as ApplicationRow;
  res.json(serializeApplication(row));
});

// POST /api/applications/:id/timeline  (manual event, e.g. recruiter contacted)
router.post("/:id/timeline", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT id FROM applications WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Application not found" });

  const { event_type, description, event_date } = req.body ?? {};
  if (!event_type) return res.status(400).json({ error: "event_type is required" });

  db.prepare(
    "INSERT INTO timeline_events (application_id, event_type, description, event_date) VALUES (?, ?, ?, COALESCE(?, datetime('now')))"
  ).run(id, event_type, description ?? null, event_date ?? null);

  touchUpdatedAt(id);
  res.status(201).json(getTimeline(id));
});

// DELETE /api/applications/:id
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM applications WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ error: "Application not found" });
  res.status(204).send();
});

export default router;
