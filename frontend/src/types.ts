export type Status =
  | "saved"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected";

export const STATUSES: Status[] = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
];

export const STATUS_LABELS: Record<Status, string> = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export type Health = "active" | "follow_up" | "stale" | "interview_soon";

export const HEALTH_META: Record<Health, { label: string; dot: string }> = {
  active: { label: "Active", dot: "#22C55E" },
  follow_up: { label: "Needs follow-up", dot: "#F59E0B" },
  stale: { label: "No response 14+ days", dot: "#EF4444" },
  interview_soon: { label: "Interview coming up", dot: "#3B82F6" },
};

export interface Application {
  id: number;
  company: string;
  position: string;
  location: string | null;
  status: Status;
  job_description: string | null;
  requirements: string[];
  skills: string[];
  salary: string | null;
  employment_type: string | null;
  application_deadline: string | null;
  source: string | null;
  job_url: string | null;
  cv_version_id: number | null;
  cover_letter: string | null;
  notes: string | null;
  applied_date: string | null;
  interview_date: string | null;
  created_at: string;
  updated_at: string;
  health: Health;
}

export interface TimelineEvent {
  id: number;
  application_id: number;
  event_type: string;
  description: string | null;
  event_date: string;
}

export interface Reminder {
  id: number;
  application_id: number;
  message: string;
  due_date: string;
  completed: number;
  company?: string;
  position?: string;
}

export interface CvVersion {
  id: number;
  name: string;
  tag: string | null;
  file_name: string | null;
  created_at: string;
}

export interface ApplicationDetail extends Application {
  timeline: TimelineEvent[];
  reminders: Reminder[];
}

export interface DashboardStats {
  total: number;
  applied: number;
  interviews: number;
  rejected: number;
  offers: number;
  byStatus: Record<Status, number>;
}

export interface AnalyticsData {
  totalApplications: number;
  interviews: number;
  offers: number;
  responseRate: number;
  bySource: { source: string; count: number }[];
  byEmploymentType: { employment_type: string; count: number }[];
  byStatus: { status: Status; count: number }[];
}
