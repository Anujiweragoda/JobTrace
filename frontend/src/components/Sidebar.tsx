export type Tab = "dashboard" | "applications" | "followups" | "analytics" | "cv" | "profile";

const LINKS: { id: Tab; label: string; icon: JSX.Element }[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3L21 12L12 21L3 12L12 3Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "applications",
    label: "Applications",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 6H20V8H4V6ZM4 11H20V13H4V11ZM4 16H14V18H4V16Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "followups",
    label: "Follow-ups",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 7V12L15 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 12H7V19H5V12Z" fill="currentColor" />
        <path d="M10 8H12V19H10V8Z" fill="currentColor" />
        <path d="M15 4H17V19H15V4Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "cv",
    label: "CV Versions",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 2H14L20 8V22H6V2Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2V8H20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "profile" as Tab,
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" fill="currentColor" />
        <path d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
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
            <span className="sidebar-icon" aria-hidden>{link.icon}</span>
            {link.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">v1.0 · local data</div>
    </aside>
  );
}
