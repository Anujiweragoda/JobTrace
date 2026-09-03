import { useEffect, useState } from "react";
import { api } from "../api";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.getProfile();
        setUsername(res.user.username);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    setError("");
    setSuccess("");
    try {
      await api.updateProfile({ username: username || undefined, password: password || undefined });
      setSuccess("Profile updated");
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  if (loading) return <p>Loading profile…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Profile</h1>
          <p className="page-subtitle">Update your username or change your password.</p>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 560 }}>
        {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
        {success && <div style={{ color: "var(--success)" }}>{success}</div>}

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Username</label>
          <input className="text-input" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>New password (leave blank to keep)</label>
          <input className="text-input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={handleSave}>Save changes</button>
        </div>
      </div>
    </div>
  );
}
