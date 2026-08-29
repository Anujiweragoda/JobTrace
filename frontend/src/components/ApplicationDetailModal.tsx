import { useEffect, useState } from "react";
import { api } from "../api";
import type { ApplicationDetail, CvVersion } from "../types";
import { HealthBadge, StatusPill } from "./Badges";

interface Props {
  applicationId: number;
  cvVersions: CvVersion[];
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  onChanged: () => void;
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ApplicationDetailModal({
  applicationId,
  cvVersions,
  onClose,
  onEdit,
  onDeleted,
  onChanged,
}: Props) {
  const [data, setData] = useState<ApplicationDetail | null>(null);
  const [tab, setTab] = useState<"overview" | "description" | "timeline">("overview");
  const [noteEvent, setNoteEvent] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await api.getApplication(applicationId);
    setData(res);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleAddEvent() {
    if (!noteEvent.trim()) return;
    await api.addTimelineEvent(applicationId, "note", noteEvent.trim());
    setNoteEvent("");
    load();
  }

  async function handleDelete() {
    if (!confirm("Delete this application permanently?")) return;
    await api.deleteApplication(applicationId);
    onDeleted();
  }

  const cvName = data?.cv_version_id
    ? cvVersions.find((c) => c.id === data.cv_version_id)?.name
    : null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        {loading || !data ? (
          <p>Loading…</p>
        ) : (
          <>
            <div className="modal-header">
              <div>
                <h2>{data.position}</h2>
                <p className="page-subtitle">{data.company}</p>
                <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
                  <StatusPill status={data.status} />
                  <HealthBadge health={data.health} />
                </div>
              </div>
              <button className="modal-close" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>

            <div className="detail-tabs">
              <button
                className={`detail-tab ${tab === "overview" ? "active" : ""}`}
                onClick={() => setTab("overview")}
              >
                Overview
              </button>
              <button
                className={`detail-tab ${tab === "description" ? "active" : ""}`}
                onClick={() => setTab("description")}
              >
                Job description
              </button>
              <button
                className={`detail-tab ${tab === "timeline" ? "active" : ""}`}
                onClick={() => setTab("timeline")}
              >
                Timeline
              </button>
            </div>

            {tab === "overview" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                <div>
                  <p className="detail-section-title">Location</p>
                  <p style={{ marginBottom: 14, fontSize: 13.5 }}>{data.location || "—"}</p>

                  <p className="detail-section-title">Salary</p>
                  <p style={{ marginBottom: 14, fontSize: 13.5 }}>{data.salary || "—"}</p>

                  <p className="detail-section-title">Employment type</p>
                  <p style={{ marginBottom: 14, fontSize: 13.5 }}>{data.employment_type || "—"}</p>

                  <p className="detail-section-title">Source</p>
                  <p style={{ marginBottom: 14, fontSize: 13.5 }}>{data.source || "—"}</p>
                </div>
                <div>
                  <p className="detail-section-title">Applied</p>
                  <p style={{ marginBottom: 14, fontSize: 13.5 }}>{fmtDate(data.applied_date)}</p>

                  <p className="detail-section-title">Interview date</p>
                  <p style={{ marginBottom: 14, fontSize: 13.5 }}>{fmtDate(data.interview_date)}</p>

                  <p className="detail-section-title">Application deadline</p>
                  <p style={{ marginBottom: 14, fontSize: 13.5 }}>
                    {fmtDate(data.application_deadline)}
                  </p>

                  <p className="detail-section-title">CV submitted</p>
                  <p style={{ marginBottom: 14, fontSize: 13.5 }}>{cvName || "—"}</p>
                </div>

                {data.skills.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <p className="detail-section-title">Skills</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                      {data.skills.map((s) => (
                        <span key={s} className="tag">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {data.requirements.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <p className="detail-section-title">Requirements</p>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
                      {data.requirements.map((r) => (
                        <li key={r} style={{ marginBottom: 4 }}>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.notes && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <p className="detail-section-title">Notes</p>
                    <p style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{data.notes}</p>
                  </div>
                )}

                {data.job_url && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <a href={data.job_url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                      Open original job posting →
                    </a>
                  </div>
                )}
              </div>
            )}

            {tab === "description" && (
              <div>
                <p className="detail-section-title">Full job description</p>
                <div className="jd-block">
                  {data.job_description || "No job description saved for this application."}
                </div>
              </div>
            )}

            {tab === "timeline" && (
              <div>
                <div className="timeline">
                  {data.timeline.map((ev) => (
                    <div className="timeline-item" key={ev.id}>
                      <p className="timeline-date">{fmtDate(ev.event_date)}</p>
                      <p className="timeline-desc">
                        <strong style={{ textTransform: "capitalize" }}>
                          {ev.event_type.replace(/_/g, " ")}
                        </strong>
                        {ev.description ? ` — ${ev.description}` : ""}
                      </p>
                    </div>
                  ))}
                  {data.timeline.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>No events yet.</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <input
                    className="text-input"
                    style={{ flex: 1 }}
                    placeholder="Log an event, e.g. 'Recruiter called'"
                    value={noteEvent}
                    onChange={(e) => setNoteEvent(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddEvent()}
                  />
                  <button className="btn btn-secondary" onClick={handleAddEvent}>
                    Add
                  </button>
                </div>
              </div>
            )}

            <div className="form-actions" style={{ justifyContent: "space-between" }}>
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    onChanged();
                    onClose();
                  }}
                >
                  Close
                </button>
                <button className="btn btn-primary" onClick={onEdit}>
                  Edit
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
