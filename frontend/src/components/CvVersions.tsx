import { useState } from "react";
import { api } from "../api";
import type { CvVersion } from "../types";

interface Props {
  cvVersions: CvVersion[];
  onChanged: () => void;
}

export default function CvVersions({ cvVersions, onChanged }: Props) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");

  async function add() {
    if (!name.trim()) return;
    await api.createCvVersion({ name: name.trim(), tag: tag.trim() || undefined });
    setName("");
    setTag("");
    onChanged();
  }

  async function remove(id: number) {
    if (!confirm("Remove this CV version? Applications that used it will keep their record.")) return;
    await api.deleteCvVersion(id);
    onChanged();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>CV versions</h1>
          <p className="page-subtitle">
            Keep track of which CV you tailored for which kind of role, so you always know what
            you submitted.
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <h3>Add a CV version</h3>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="text-input"
            style={{ flex: 1 }}
            placeholder="Name, e.g. AI_Research_CV_v3.pdf"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="text-input"
            style={{ width: 200 }}
            placeholder="Tag, e.g. AI Research"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <button className="btn btn-primary" onClick={add}>
            Add
          </button>
        </div>
      </div>

      <div className="cv-list">
        {cvVersions.map((cv) => (
          <div className="cv-row" key={cv.id}>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600 }}>{cv.name}</p>
              {cv.tag && <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>{cv.tag}</p>}
            </div>
            <button className="btn btn-ghost" onClick={() => remove(cv.id)}>
              Remove
            </button>
          </div>
        ))}
        {cvVersions.length === 0 && (
          <div className="empty-state">
            <h3>No CV versions yet</h3>
            <p>Add the different tailored CVs you use, then attach them to applications.</p>
          </div>
        )}
      </div>
    </div>
  );
}
