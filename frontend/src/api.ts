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

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const api = {
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

  // Analytics
  getDashboardStats: () => request<DashboardStats>(`/analytics/dashboard`),
  getAnalytics: () => request<AnalyticsData>(`/analytics`),
  getHealthSummary: () => request<Record<string, number>>(`/analytics/health-summary`),
};
