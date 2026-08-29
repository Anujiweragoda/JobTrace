import type { Health, Status } from "../types";
import { HEALTH_META, STATUS_LABELS } from "../types";

const STATUS_COLORS: Record<Status, string> = {
  saved: "var(--status-saved)",
  applied: "var(--status-applied)",
  screening: "var(--status-screening)",
  interview: "var(--status-interview)",
  offer: "var(--status-offer)",
  rejected: "var(--status-rejected)",
};

export function statusColor(status: Status) {
  return STATUS_COLORS[status];
}

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className="status-pill" style={{ color: statusColor(status) }}>
      <span className="status-dot" style={{ background: statusColor(status) }} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function HealthBadge({ health }: { health: Health }) {
  const meta = HEALTH_META[health];
  return (
    <span className="health-badge" style={{ color: meta.dot }}>
      <span className="status-dot" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}
