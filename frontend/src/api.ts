import type {
  Application,
  ApplicationDetail,
  AnalyticsData,
  CvVersion,
  DashboardStats,
  Reminder,
  Status,
  TimelineEvent,
} from "./types";

// Use direct backend URL in dev to avoid dev-proxy header issues;
// in production the frontend is served together so use the relative `/api` path.
const BASE = import.meta.env.DEV ? "http://localhost:4001/api" : "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("job-tracker-token") : null;
  const headers = new Headers({ "Content-Type": "application/json" });

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // DEBUG: log token and path to help diagnose auth issues (remove in production)
  try {
    // eslint-disable-next-line no-console
    console.log("API request:", path, "localToken:", token ? `${token.slice(0, 8)}...` : null, "finalHeaders:", Object.fromEntries(headers.entries()));
  } catch {}

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...Object.fromEntries(headers.entries()),
      ...((options?.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: { username: string } }>(`/auth/login`, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  googleLogin: (credential: string) =>
    request<{ token: string; user: { username: string; email?: string; picture?: string | null } }>(`/auth/google`, {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
  signup: (username: string, password: string, email?: string) =>
    request<{ token: string; user: { username: string; email?: string | null } }>(`/auth/signup`, {
      method: "POST",
      body: JSON.stringify({ username, password, email }),
    }),
  getCurrentUser: () => request<{ user: { username: string } }>(`/auth/me`),

  // Applications
  listApplications: (params?: { search?: string; status?: string; source?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.status) qs.set("status", params.status);
    if (params?.source) qs.set("source", params.source);
    const q = qs.toString();
    return request<Application[]>(`/applications${q ? `?${q}` : ""}`);
  },
  getApplication: (id: number) => request<ApplicationDetail>(`/applications/${id}`),
  previewJobUrl: (url: string) =>
    request<Partial<Application> & { company?: string | null; position?: string | null; location?: string | null; job_description?: string | null; requirements?: string[]; skills?: string[]; salary?: string | null; employment_type?: string | null; source?: string | null }>(`/applications/preview`, {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  createApplication: (data: Partial<Application>) =>
    request<Application>(`/applications`, { method: "POST", body: JSON.stringify(data) }),
  updateApplication: (id: number, data: Partial<Application>) =>
    request<Application>(`/applications/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateStatus: (id: number, status: Status) =>
    request<Application>(`/applications/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  addTimelineEvent: (id: number, event_type: string, description?: string) =>
    request<TimelineEvent[]>(`/applications/${id}/timeline`, {
      method: "POST",
      body: JSON.stringify({ event_type, description }),
    }),
  deleteApplication: (id: number) =>
    request<void>(`/applications/${id}`, { method: "DELETE" }),

  // Reminders
  listReminders: (includeCompleted = false) =>
    request<Reminder[]>(`/reminders${includeCompleted ? "?includeCompleted=true" : ""}`),
  createReminder: (data: { application_id: number; message: string; due_date: string }) =>
    request<Reminder>(`/reminders`, { method: "POST", body: JSON.stringify(data) }),
  completeReminder: (id: number) =>
    request<Reminder>(`/reminders/${id}/complete`, { method: "PATCH" }),
  deleteReminder: (id: number) => request<void>(`/reminders/${id}`, { method: "DELETE" }),

  // CV versions
  listCvVersions: () => request<CvVersion[]>(`/cv-versions`),
  createCvVersion: (data: { name: string; tag?: string; file_name?: string }) =>
    request<CvVersion>(`/cv-versions`, { method: "POST", body: JSON.stringify(data) }),
  deleteCvVersion: (id: number) => request<void>(`/cv-versions/${id}`, { method: "DELETE" }),

  // Profile
  getProfile: () => request<{ user: { id: number; username: string; email?: string | null } }>(`/profile`),
  updateProfile: (data: { username?: string; password?: string }) => request<{ user: { username: string; email?: string | null } }>(`/profile`, { method: "PUT", body: JSON.stringify(data) }),

  // Analytics
  getDashboardStats: () => request<DashboardStats>(`/analytics/dashboard`),
  getAnalytics: () => request<AnalyticsData>(`/analytics`),
  getHealthSummary: () => request<Record<string, number>>(`/analytics/health-summary`),
};
