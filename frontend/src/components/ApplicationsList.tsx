import { useMemo, useState } from "react";
import type { Application, Status } from "../types";
import { STATUSES, STATUS_LABELS } from "../types";
import { HealthBadge, StatusPill } from "./Badges";

interface Props {
  applications: Application[];
  onOpen: (id: number) => void;
  onAdd: () => void;
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ApplicationsList({ applications, onOpen, onAdd }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");

  const sources = useMemo(
    () => Array.from(new Set(applications.map((a) => a.source).filter(Boolean))) as string[],
    [applications]
  );
  const [source, setSource] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      if (status && a.status !== status) return false;
      if (source && a.source !== source) return false;
      if (!q) return true;
      const haystack = [
        a.company,
        a.position,
        a.location,
        a.job_description,
        a.notes,
        a.skills.join(" "),
        a.status,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [applications, search, status, source]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Applications</h1>
          <p className="page-subtitle">
            Search by company, title, skills, or anything you wrote in notes.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onAdd}>
          + Add application
        </button>
      </div>

      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="Search applications…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s as Status]}
            </option>
          ))}
        </select>
        {sources.length > 0 && (
          <select className="select-input" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No matches</h3>
          <p>Try a different search term or clear your filters.</p>
        </div>
      ) : (
        <table className="app-table">
          <thead>
            <tr>
              <th>Position</th>
              <th>Company</th>
              <th>Status</th>
              <th>Health</th>
              <th>Applied</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} onClick={() => onOpen(a.id)}>
                <td>{a.position}</td>
                <td>{a.company}</td>
                <td>
                  <StatusPill status={a.status} />
                </td>
                <td>
                  <HealthBadge health={a.health} />
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                  {fmtDate(a.applied_date)}
                </td>
                <td>{a.source || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
