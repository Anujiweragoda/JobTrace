export type Tab = "dashboard" | "applications" | "followups" | "analytics" | "cv";

const LINKS: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "◆" },
  { id: "applications", label: "Applications", icon: "☰" },
  { id: "followups", label: "Follow-ups", icon: "◔" },
  { id: "analytics", label: "Analytics", icon: "▤" },
  { id: "cv", label: "CV Versions", icon: "▣" },
];

export default function Sidebar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        Job<span>Trace</span>
      </div>
      <nav className="sidebar-nav">
        {LINKS.map((link) => (
          <button
            key={link.id}
            className={`sidebar-link ${active === link.id ? "active" : ""}`}
            onClick={() => onChange(link.id)}
          >
            <span aria-hidden>{link.icon}</span>
            {link.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">v1.0 · local data</div>
    </aside>
  );
}
