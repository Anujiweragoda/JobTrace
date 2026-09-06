import { useEffect, useState } from "react";
import { api } from "../api";
import type { AnalyticsData } from "../types";

function BarList({
  rows,
  labelKey,
  countKey,
}: {
  rows: Record<string, any>[];
  labelKey: string;
  countKey: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r[countKey]));
  return (
    <div>
      {rows.map((r) => (
        <div className="bar-row" key={r[labelKey]}>
          <span className="bar-label">{r[labelKey]}</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: `${(r[countKey] / max) * 100}%` }}
            />
          </span>
          <span className="bar-value">{r[countKey]}</span>
        </div>
      ))}
      {rows.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>No data yet.</p>
      )}
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    api.getAnalytics()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load analytics.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>Analytics</h1>
            <p className="page-subtitle">Preparing your job search snapshot…</p>
          </div>
        </div>
        <div className="stat-grid" aria-label="Loading analytics" aria-busy="true">
          {['Applications', 'Interviews', 'Offers', 'Interview rate'].map((label) => (
            <div className="stat-card" key={label}>
              <p className="value">—</p>
              <p className="label">{label}</p>
            </div>
          ))}
        </div>
        <div className="panel" style={{ marginTop: 20 }}>
          <h3>Loading your insights</h3>
          <p style={{ color: "var(--ink-muted)" }}>
            We&apos;re calculating your application trends. This will update automatically.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>Analytics</h1>
            <p className="page-subtitle">Your job search snapshot.</p>
          </div>
        </div>
        <div className="panel">
          <h3>Analytics unavailable</h3>
          <p style={{ color: "var(--ink-muted)" }}>{error}</p>
          <p style={{ color: "var(--ink-muted)", marginTop: 12 }}>
            Your applications are still safe. Add or review applications while analytics reconnects.
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel">
        <h1>Analytics</h1>
        <h3 style={{ marginTop: 20 }}>Your insights will appear here</h3>
        <p style={{ color: "var(--ink-muted)" }}>
          Start tracking applications to see response rates, sources, and status trends.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <p className="page-subtitle">Where you're actually getting traction.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <p className="value">{data.totalApplications}</p>
          <p className="label">Applications</p>
        </div>
        <div className="stat-card">
          <p className="value">{data.interviews}</p>
          <p className="label">Interviews</p>
        </div>
        <div className="stat-card">
          <p className="value">{data.offers}</p>
          <p className="label">Offers</p>
        </div>
        <div className="stat-card">
          <p className="value">{data.responseRate}%</p>
          <p className="label">Interview rate</p>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="panel">
          <h3>By source</h3>
          <BarList rows={data.bySource} labelKey="source" countKey="count" />
        </div>
        <div className="panel">
          <h3>By employment type</h3>
          <BarList rows={data.byEmploymentType} labelKey="employment_type" countKey="count" />
        </div>
        <div className="panel" style={{ gridColumn: "1 / -1" }}>
          <h3>By status</h3>
          <BarList rows={data.byStatus} labelKey="status" countKey="count" />
        </div>
      </div>
    </div>
  );
}
