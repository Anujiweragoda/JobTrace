import { useEffect, useState } from "react";
import { api } from "../api";
import type { Application, DashboardStats, Status } from "../types";
import KanbanBoard from "./KanbanBoard";

interface Props {
  applications: Application[];
  onOpen: (id: number) => void;
  onMove: (id: number, status: Status) => void;
  onAdd: () => void;
}

export default function Dashboard({ applications, onOpen, onMove, onAdd }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.getDashboardStats().then(setStats);
  }, [applications]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My job applications</h1>
          <p className="page-subtitle">Your pipeline, at a glance. Drag cards between stages.</p>
        </div>
        <button className="btn btn-primary" onClick={onAdd}>
          + Add application
        </button>
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <p className="value">{stats.total}</p>
            <p className="label">Total</p>
          </div>
          <div className="stat-card">
            <p className="value">{stats.applied}</p>
            <p className="label">Applied</p>
          </div>
          <div className="stat-card">
            <p className="value">{stats.interviews}</p>
            <p className="label">Interviews</p>
          </div>
          <div className="stat-card">
            <p className="value">{stats.rejected}</p>
            <p className="label">Rejected</p>
          </div>
          <div className="stat-card">
            <p className="value">{stats.offers}</p>
            <p className="label">Offers</p>
          </div>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="empty-state">
          <h3>No applications yet</h3>
          <p>Add your first job application to start tracking your pipeline.</p>
        </div>
      ) : (
        <KanbanBoard applications={applications} onOpen={onOpen} onMove={onMove} />
      )}
    </div>
  );
}
