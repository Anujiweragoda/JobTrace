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

export interface ApplicationRow {
  id: number;
  company: string;
  position: string;
  location: string | null;
  status: Status;
  job_description: string | null;
  requirements: string | null; // JSON string array
  skills: string | null; // JSON string array
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
}

export interface TimelineEventRow {
  id: number;
  application_id: number;
  event_type: string;
  description: string | null;
  event_date: string;
}

export interface ReminderRow {
  id: number;
  application_id: number;
  message: string;
  due_date: string;
  completed: number;
  created_at: string;
}

export interface CvVersionRow {
  id: number;
  name: string;
  tag: string | null;
  file_name: string | null;
  created_at: string;
}
