import { useEffect, useState } from "react";
import { api } from "./api";
import type { Application, CvVersion, Status } from "./types";
import Sidebar, { type Tab } from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import ApplicationsList from "./components/ApplicationsList";
import FollowUps from "./components/FollowUps";
import Analytics from "./components/Analytics";
import CvVersions from "./components/CvVersions";
import Profile from "./components/Profile";
import ApplicationModal from "./components/ApplicationModal";
import ApplicationDetailModal from "./components/ApplicationDetailModal";
import LoginPage from "./components/LoginPage";

const TOKEN_KEY = "job-tracker-token";

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState<string>("admin");
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
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

  async function handleLogin(usernameValue: string, passwordValue: string) {
    setAuthError("");
    try {
      const response = await api.login(usernameValue, passwordValue);
      try {
        // debug: log response and stored token
        // eslint-disable-next-line no-console
        console.log("login response:", response);
      } catch {}
      localStorage.setItem(TOKEN_KEY, response.token);
      // debug: verify saved
      try {
        // eslint-disable-next-line no-console
        console.log("stored token after setItem:", localStorage.getItem(TOKEN_KEY));
      } catch {}
      setToken(response.token);
      setUsername(response.user.username);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  async function handleGoogleLogin(credential: string) {
    setAuthError("");
    try {
      const response = await api.googleLogin(credential);
      localStorage.setItem(TOKEN_KEY, response.token);
      setToken(response.token);
      setUsername(response.user.username);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Google login failed.");
    }
  }

  async function handleSignup(usernameValue: string, passwordValue: string, email?: string) {
    setAuthError("");
    try {
      const response = await api.signup(usernameValue, passwordValue, email);
      try {
        // eslint-disable-next-line no-console
        console.log("signup response:", response);
      } catch {}
      localStorage.setItem(TOKEN_KEY, response.token);
      try {
        // eslint-disable-next-line no-console
        console.log("stored token after signup setItem:", localStorage.getItem(TOKEN_KEY));
      } catch {}
      setToken(response.token);
      setUsername(response.user.username);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Signup failed.");
    }
  }

  async function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAuthError("");
  }

  useEffect(() => {
    const local = localStorage.getItem(TOKEN_KEY);
    if (!local) {
      setAuthLoading(false);
      return;
    }

    async function validateToken() {
      try {
        const response = await api.getCurrentUser();
        setUsername(response.user.username);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      } finally {
        setAuthLoading(false);
      }
    }

    validateToken();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadAll();
  }, [token]);

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

  if (!token && !authLoading) {
    return (
      <LoginPage
        onLogin={handleLogin}
        onGoogleLogin={handleGoogleLogin}
        onSignup={handleSignup}
        loading={false}
        error={authError}
      />
    );
  }

  if (authLoading) {
    return <div className="auth-screen"><div className="auth-card"><p className="auth-subtitle">Checking session...</p></div></div>;
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
        <div className="page-header">
          <div>
            <h1>Welcome, {username}</h1>
            <p className="page-subtitle">Your job tracker dashboard</p>
          </div>
          <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
        </div>

        <>
          {loading && <p style={{ color: "var(--ink-muted)" }}>Loading…</p>}

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
          {tab === "profile" && <Profile />}
        </>
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
