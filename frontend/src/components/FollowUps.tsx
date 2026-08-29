import { useEffect, useState } from "react";
import { api } from "../api";
import type { Application, Reminder } from "../types";
import { HealthBadge, StatusPill } from "./Badges";

interface Props {
  applications: Application[];
  onOpen: (id: number) => void;
}

function daysFromNow(dateStr: string) {
  const then = new Date(dateStr).getTime();
  const diff = Math.round((then - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff}d`;
}

export default function FollowUps({ applications, onOpen }: Props) {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  async function load() {
    const rows = await api.listReminders();
    setReminders(rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function complete(id: number) {
    await api.completeReminder(id);
    load();
  }

  const needsAttention = applications.filter(
    (a) => a.health === "follow_up" || a.health === "stale" || a.health === "interview_soon"
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Follow-ups</h1>
          <p className="page-subtitle">
            Applications that could go stale, plus anything you've scheduled a reminder for.
          </p>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="panel">
          <h3>Scheduled reminders</h3>
          {reminders.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              No open reminders. Moving an application to "Applied" adds one automatically.
            </p>
          ) : (
            reminders.map((r) => {
              const overdue = new Date(r.due_date).getTime() < Date.now();
              return (
                <div
                  key={r.id}
                  className={`reminder-row ${overdue ? "overdue" : "due-soon"}`}
                  onClick={() => onOpen(r.application_id)}
                  style={{ cursor: "pointer" }}
                >
                  <div>
                    <p className="reminder-main">{r.message}</p>
                    <p className="reminder-sub">
                      {r.company} · {r.position}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="reminder-due">{daysFromNow(r.due_date)}</span>
                    <button
                      className="btn btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        complete(r.id);
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="panel">
          <h3>Applications needing attention</h3>
          {needsAttention.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              Everything looks active — nothing stale right now.
            </p>
          ) : (
            needsAttention.map((a) => (
              <div
                key={a.id}
                className="reminder-row"
                onClick={() => onOpen(a.id)}
                style={{ cursor: "pointer" }}
              >
                <div>
                  <p className="reminder-main">
                    {a.position} · {a.company}
                  </p>
                  <div style={{ marginTop: 4 }}>
                    <StatusPill status={a.status} />
                  </div>
                </div>
                <HealthBadge health={a.health} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
