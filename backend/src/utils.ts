import { ApplicationRow } from "./types";

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return null;
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return null;
  const now = Date.now();
  return Math.ceil((then - now) / (1000 * 60 * 60 * 24));
}

export type Health = "active" | "follow_up" | "stale" | "interview_soon";

export function computeHealth(app: ApplicationRow): Health {
  if (app.status === "rejected" || app.status === "offer") return "active";

  const untilInterview = daysUntil(app.interview_date);
  if (untilInterview !== null && untilInterview >= 0 && untilInterview <= 7) {
    return "interview_soon";
  }

  const lastActivity = app.applied_date || app.created_at;
  const since = daysSince(lastActivity);

  if (since !== null) {
    if (since >= 14) return "stale";
    if (since >= 7 && (app.status === "applied" || app.status === "saved")) {
      return "follow_up";
    }
  }

  return "active";
}

export function toJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function fromJsonArray(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "string") {
    return JSON.stringify(
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }
  return JSON.stringify([]);
}

export function serializeApplication(row: ApplicationRow) {
  return {
    ...row,
    requirements: toJsonArray(row.requirements),
    skills: toJsonArray(row.skills),
    health: computeHealth(row),
  };
}
