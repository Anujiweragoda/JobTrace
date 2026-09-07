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
  const [file, setFile] = useState<File | undefined>();
  const [error, setError] = useState("");

  async function add() {
    if (!name.trim()) return;
    setError("");
    try {
      await api.createCvVersion({ name: name.trim(), tag: tag.trim() || undefined, file });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save the CV version");
      return;
    }
    setName("");
    setTag("");
    setFile(undefined);
    const input = document.getElementById("cv-pdf") as HTMLInputElement | null;
    if (input) input.value = "";
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
          <label className="btn btn-ghost" htmlFor="cv-pdf">
            {file ? file.name : "Attach PDF"}
          </label>
          <input
            id="cv-pdf"
            type="file"
            accept="application/pdf,.pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected && selected.type !== "application/pdf") {
                setError("Please choose a PDF file.");
                return;
              }
              setError("");
              setFile(selected);
            }}
          />
          <button className="btn btn-primary" onClick={add}>
            Add
          </button>
        </div>
        {error && <p style={{ color: "var(--danger)", marginTop: 10 }}>{error}</p>}
      </div>

      <div className="cv-list">
        {cvVersions.map((cv) => (
          <div className="cv-row" key={cv.id}>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600 }}>{cv.name}</p>
              {cv.tag && <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>{cv.tag}</p>}
              {cv.file_path && (
                <a
                  className="btn btn-ghost"
                  href={api.cvFileUrl(cv.id)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-block", marginTop: 8 }}
                >
                  View PDF
                </a>
              )}
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
