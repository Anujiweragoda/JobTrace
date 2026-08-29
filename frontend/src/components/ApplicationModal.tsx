import { useEffect, useState } from "react";
import type { Application, CvVersion, Status } from "../types";
import { STATUSES, STATUS_LABELS } from "../types";

interface Props {
  initial?: Application | null;
  cvVersions: CvVersion[];
  onClose: () => void;
  onSave: (data: Partial<Application>) => Promise<void>;
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function ApplicationModal({ initial, cvVersions, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    company: initial?.company ?? "",
    position: initial?.position ?? "",
    location: initial?.location ?? "",
    status: (initial?.status ?? "saved") as Status,
    job_description: initial?.job_description ?? "",
    requirements: initial?.requirements?.join(", ") ?? "",
    skills: initial?.skills?.join(", ") ?? "",
    salary: initial?.salary ?? "",
    employment_type: initial?.employment_type ?? "",
    application_deadline: toDateInput(initial?.application_deadline ?? null),
    source: initial?.source ?? "",
    job_url: initial?.job_url ?? "",
    cv_version_id: initial?.cv_version_id ?? "",
    notes: initial?.notes ?? "",
    interview_date: toDateInput(initial?.interview_date ?? null),
  });
  const [saving, setSaving] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [error, setError] = useState("");
  const [urlFetchError, setUrlFetchError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleFetchFromUrl() {
    const url = form.job_url.trim();
    if (!url) {
      setUrlFetchError("Add the job posting URL first.");
      return;
    }

    try {
      setFetchingUrl(true);
      setUrlFetchError("");
      const preview = await fetch(`/api/applications/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not fetch the job posting.");
        return body;
      });

      if (preview.company) set("company", preview.company);
      if (preview.position) set("position", preview.position);
      if (preview.location) set("location", preview.location);
      if (preview.job_description) set("job_description", preview.job_description);
      if (preview.requirements && Array.isArray(preview.requirements)) {
        set("requirements", preview.requirements.join(", "));
      }
      if (preview.skills && Array.isArray(preview.skills)) {
        set("skills", preview.skills.join(", "));
      }
      if (preview.salary) set("salary", preview.salary);
      if (preview.employment_type) set("employment_type", preview.employment_type);
      if (preview.source) set("source", preview.source);
      setUrlFetchError(preview.warning || "");
    } catch (err) {
      setUrlFetchError(
        err instanceof Error
          ? `${err.message} You can still save the link and fill the details manually.`
          : "Could not fetch the job posting automatically. You can still save the link and fill the details manually."
      );
    } finally {
      setFetchingUrl(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim() || !form.position.trim()) {
      setError("Company and position are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        company: form.company.trim(),
        position: form.position.trim(),
        location: form.location.trim() || null,
        status: form.status,
        job_description: form.job_description.trim() || null,
        requirements: form.requirements
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean) as unknown as string[],
        skills: form.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean) as unknown as string[],
        salary: form.salary.trim() || null,
        employment_type: form.employment_type.trim() || null,
        application_deadline: form.application_deadline || null,
        source: form.source.trim() || null,
        job_url: form.job_url.trim() || null,
        cv_version_id: form.cv_version_id ? Number(form.cv_version_id) : null,
        notes: form.notes.trim() || null,
        interview_date: form.interview_date || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{initial ? "Edit application" : "Add application"}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label>Company *</label>
              <input
                className="text-input"
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-field">
              <label>Position *</label>
              <input
                className="text-input"
                value={form.position}
                onChange={(e) => set("position", e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Location</label>
              <input
                className="text-input"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Status</label>
              <select
                className="select-input"
                value={form.status}
                onChange={(e) => set("status", e.target.value as Status)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Salary</label>
              <input
                className="text-input"
                value={form.salary}
                onChange={(e) => set("salary", e.target.value)}
                placeholder="e.g. LKR 150,000"
              />
            </div>
            <div className="form-field">
              <label>Employment type</label>
              <input
                className="text-input"
                value={form.employment_type}
                onChange={(e) => set("employment_type", e.target.value)}
                placeholder="Full-time, Internship..."
              />
            </div>

            <div className="form-field">
              <label>Source</label>
              <input
                className="text-input"
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
                placeholder="LinkedIn, Referral..."
              />
            </div>
            <div className="form-field">
              <label>Job posting URL</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="text-input"
                  value={form.job_url}
                  onChange={(e) => set("job_url", e.target.value)}
                  onBlur={handleFetchFromUrl}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleFetchFromUrl}
                  disabled={fetchingUrl || !form.job_url.trim()}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {fetchingUrl ? "Fetching..." : "Fetch details"}
                </button>
              </div>
              {urlFetchError && (
                <p style={{ color: "var(--status-rejected)", fontSize: 12, marginTop: 6 }}>
                  {urlFetchError}
                </p>
              )}
            </div>

            <div className="form-field">
              <label>Application deadline</label>
              <input
                type="date"
                className="text-input"
                value={form.application_deadline}
                onChange={(e) => set("application_deadline", e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Interview date</label>
              <input
                type="date"
                className="text-input"
                value={form.interview_date}
                onChange={(e) => set("interview_date", e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>CV version used</label>
              <select
                className="select-input"
                value={form.cv_version_id}
                onChange={(e) => set("cv_version_id", e.target.value as any)}
              >
                <option value="">— none —</option>
                {cvVersions.map((cv) => (
                  <option key={cv.id} value={cv.id}>
                    {cv.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Skills (comma separated)</label>
              <input
                className="text-input"
                value={form.skills}
                onChange={(e) => set("skills", e.target.value)}
                placeholder="Python, SQL, React"
              />
            </div>

            <div className="form-field full">
              <label>Requirements (comma separated)</label>
              <input
                className="text-input"
                value={form.requirements}
                onChange={(e) => set("requirements", e.target.value)}
              />
            </div>

            <div className="form-field full">
              <label>Full job description</label>
              <textarea
                className="textarea-input"
                rows={6}
                value={form.job_description}
                onChange={(e) => set("job_description", e.target.value)}
                placeholder="Paste the full job ad here so you can find it again later."
              />
            </div>

            <div className="form-field full">
              <label>Notes</label>
              <textarea
                className="textarea-input"
                rows={3}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: "var(--status-rejected)", fontSize: 13, marginTop: 12 }}>
              {error}
            </p>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : initial ? "Save changes" : "Add application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
