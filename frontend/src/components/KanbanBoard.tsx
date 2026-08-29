import { useState } from "react";
import type { Application, Status } from "../types";
import { STATUSES, STATUS_LABELS } from "../types";
import { HealthBadge, statusColor } from "./Badges";

interface Props {
  applications: Application[];
  onOpen: (id: number) => void;
  onMove: (id: number, status: Status) => void;
}

export default function KanbanBoard({ applications, onOpen, onMove }: Props) {
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);

  const byStatus = (status: Status) => applications.filter((a) => a.status === status);

  return (
    <div className="kanban">
      {STATUSES.map((status) => {
        const cards = byStatus(status);
        return (
          <div
            key={status}
            className={`kanban-column ${dragOverCol === status ? "drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(status);
            }}
            onDragLeave={() => setDragOverCol((c) => (c === status ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              const id = Number(e.dataTransfer.getData("text/application-id"));
              if (id) onMove(id, status);
              setDragOverCol(null);
            }}
          >
            <div className="kanban-column-header">
              <span className="kanban-column-title">
                <span className="status-dot" style={{ background: statusColor(status) }} />
                {STATUS_LABELS[status]}
              </span>
              <span className="kanban-column-count">{cards.length}</span>
            </div>
            <div className="kanban-cards">
              {cards.map((app) => (
                <div
                  key={app.id}
                  className="app-card"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/application-id", String(app.id));
                  }}
                  onClick={() => onOpen(app.id)}
                  style={{ borderLeftColor: statusColor(status) }}
                >
                  <div className="app-card-top">
                    <div>
                      <p className="app-card-position">{app.position}</p>
                      <p className="app-card-company">{app.company}</p>
                    </div>
                  </div>
                  <div className="app-card-meta">
                    <HealthBadge health={app.health} />
                    {app.location && <span>{app.location}</span>}
                  </div>
                </div>
              ))}
              {cards.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--ink-faint)", padding: "8px 4px" }}>
                  Nothing here
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
