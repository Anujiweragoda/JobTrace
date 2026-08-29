import { useEffect, useState } from "react";
import { api } from "./api";
import type { Application, CvVersion, Status } from "./types";
import Sidebar, { type Tab } from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import ApplicationsList from "./components/ApplicationsList";
import FollowUps from "./components/FollowUps";
import Analytics from "./components/Analytics";
import CvVersions from "./components/CvVersions";
import ApplicationModal from "./components/ApplicationModal";
import ApplicationDetailModal from "./components/ApplicationDetailModal";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [applications, setApplications] = useState<Application[]>([]);
  const [cvVersions, setCvVersions] = useState<CvVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Application | null>(null);

  async function refreshApplications() {
    const rows = await api.listApplications();
    setApplications(rows);
  }

  async function refreshCvVersions() {
    const rows = await api.listCvVersions();
    setCvVersions(rows);
  }

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    try {
      await Promise.all([refreshApplications(), refreshCvVersions()]);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? `Couldn't reach the API: ${err.message}`
          : "Couldn't reach the API."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleMove(id: number, status: Status) {
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    await api.updateStatus(id, status);
    refreshApplications();
  }

  async function handleCreate(data: Partial<Application>) {
    await api.createApplication(data);
    setAddOpen(false);
    refreshApplications();
  }

  async function handleUpdate(data: Partial<Application>) {
    if (!editingId) return;
    await api.updateApplication(editingId, data);
    setEditingId(null);
    setEditForm(null);
    refreshApplications();
  }

  async function openEdit(id: number) {
    const full = await api.getApplication(id);
    setEditForm(full);
    setEditingId(id);
    setDetailId(null);
  }

  if (loadError) {
    return (
      <div style={{ padding: 60, fontFamily: "var(--font-body)" }}>
        <h1 style={{ fontFamily: "var(--font-display)", marginBottom: 10 }}>
          Job Tracker can't reach the backend
        </h1>
        <p style={{ color: "var(--ink-muted)", marginBottom: 6 }}>{loadError}</p>
        <p style={{ color: "var(--ink-muted)" }}>
          Make sure the backend is running (<code>npm run dev</code> inside <code>backend/</code>{" "}
          on port 4000) and reload this page.
        </p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar active={tab} onChange={setTab} />
      <main className="main">
        {loading ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading…</p>
        ) : (
          <>
            {tab === "dashboard" && (
              <Dashboard
                applications={applications}
                onOpen={setDetailId}
                onMove={handleMove}
                onAdd={() => setAddOpen(true)}
              />
            )}
            {tab === "applications" && (
              <ApplicationsList
                applications={applications}
                onOpen={setDetailId}
                onAdd={() => setAddOpen(true)}
              />
            )}
            {tab === "followups" && (
              <FollowUps applications={applications} onOpen={setDetailId} />
            )}
            {tab === "analytics" && <Analytics />}
            {tab === "cv" && (
              <CvVersions cvVersions={cvVersions} onChanged={refreshCvVersions} />
            )}
          </>
        )}
      </main>

      {addOpen && (
        <ApplicationModal
          cvVersions={cvVersions}
          onClose={() => setAddOpen(false)}
          onSave={handleCreate}
        />
      )}

      {editingId && editForm && (
        <ApplicationModal
          initial={editForm}
          cvVersions={cvVersions}
          onClose={() => {
            setEditingId(null);
            setEditForm(null);
          }}
          onSave={handleUpdate}
        />
      )}

      {detailId && !editingId && (
        <ApplicationDetailModal
          applicationId={detailId}
          cvVersions={cvVersions}
          onClose={() => setDetailId(null)}
          onEdit={() => openEdit(detailId)}
          onDeleted={() => {
            setDetailId(null);
            refreshApplications();
          }}
          onChanged={refreshApplications}
        />
      )}
    </div>
  );
}
