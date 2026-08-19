import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Account = Tables<"accounts">;
export type Contact = Tables<"contacts">;
export type Deal = Tables<"deals">;
export type Activity = Tables<"activities">;
export type Lead = Tables<"leads">;
export type Trainer = Tables<"trainers">;
export type TrainingRequest = Tables<"training_requests">;
export type TrainingBatch = Tables<"training_batches">;

export type ContactWithAccount = Contact & { accounts: { name: string } | null };
export type DealWithRefs = Deal & {
  accounts: { name: string } | null;
  contacts: { first_name: string | null; last_name: string } | null;
};
export type TrainingRequestWithRefs = TrainingRequest & {
  accounts: { name: string } | null;
  trainers: { full_name: string } | null;
};
export type TrainingBatchWithRefs = TrainingBatch & {
  trainers: { full_name: string } | null;
  training_requests: { course_topic: string; accounts: { name: string } | null } | null;
};

/* ---------------------------------- enums --------------------------------- */

/** Staffing / Consulting SLA pipeline */
export const BD_STAGES = [
  "New Lead",
  "Pitch Scheduled",
  "Proposal Sent",
  "SLA Negotiation",
  "SLA Signed",
] as const;

export function bdStageLabel(stage: string) {
  return stage === "New Lead" ? "New Opportunity" : stage;
}

/** L&D training pipeline */
export const TRAINING_STATUSES = [
  "Inquiry Received",
  "Curriculum & Quote Sent",
  "Trainer Assigned",
  "Batch Scheduled",
  "Completed & Invoiced",
] as const;

export const SERVICE_LINES = [
  "Recruitment & Staffing",
  "Executive Search",
  "RPO",
  "HR Consulting",
  "Technical Training",
  "Soft Skills / Leadership Training",
  "Background Verification (BGV)",
  "OD Interventions & Change Management",
  "Salary Benchmarking & Comp Structure",
] as const;

/** Service lines that unlock extra tracking fields on proposals & activities. */
export const BGV_SERVICE_LINE = "Background Verification (BGV)";
export const OD_SERVICE_LINE = "OD Interventions & Change Management";
export const COMP_SERVICE_LINE = "Salary Benchmarking & Comp Structure";

export const BGV_CHECK_TYPES = ["Employment", "Academic", "Criminal", "Address", "CIBIL"] as const;
export const BGV_VERIFICATION_STATUSES = [
  "Pending Docs",
  "In Progress",
  "Verified - Green",
  "Flagged - Red",
] as const;
export const OD_SCOPES = [
  "Leadership",
  "Performance Management",
  "Culture",
  "Restructuring",
] as const;
export const OD_DELIVERABLES = ["SOPs", "Diagnostic Report", "Policy Framework"] as const;
export const BENCHMARK_METRICS = ["Base Salary", "Variable", "ESOPs", "Benefits"] as const;
export const BENCHMARK_PERCENTILES = ["50th Percentile", "75th Percentile"] as const;

export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Qualified",
  "Converted",
  "Disqualified",
] as const;

export const LEAD_SOURCES = [
  "Inbound Website",
  "Referral",
  "LinkedIn Outreach",
  "Cold Call",
  "Event",
] as const;

export const TRAINING_TYPES = ["Technical", "Soft Skills"] as const;
export const BATCH_STATUSES = ["Scheduled", "In Progress", "Completed", "Cancelled"] as const;
export const ACTIVITY_STATUSES = ["Pending", "In Progress", "Completed"] as const;
export const ACTIVITY_TYPES = ["Task", "Meeting", "Call"] as const;
export const CLIENT_TYPES = [
  "Recruitment",
  "HR Consulting",
  "Training",
  "Multi-service",
  "Background Verification (BGV)",
  "OD Interventions & Change Management",
  "Salary Benchmarking & Comp Structure",
] as const;
export const DELIVERY_MODES = ["Onsite", "Virtual", "Hybrid"] as const;

export const TECHNICAL_COURSES = [
  "Advanced Excel",
  "Power BI",
  "Java Programming",
  "AI & Automation",
  "Data Analytics",
] as const;
export const SOFT_SKILL_COURSES = [
  "Leadership Development",
  "Sales Negotiation",
  "Communication Skills",
  "Business Etiquette",
  "Team Collaboration",
] as const;
export const ALL_COURSES = [...TECHNICAL_COURSES, ...SOFT_SKILL_COURSES] as const;

export type BdStage = (typeof BD_STAGES)[number];
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/* --------------------------------- queries -------------------------------- */

function unwrap<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const accountsQuery = () =>
  queryOptions({
    queryKey: ["accounts"],
    queryFn: async () =>
      unwrap<Account[]>(
        await supabase.from("accounts").select("*").order("created_at", { ascending: true }),
      ),
  });

export const contactsQuery = () =>
  queryOptions({
    queryKey: ["contacts"],
    queryFn: async () =>
      unwrap<ContactWithAccount[]>(
        await supabase
          .from("contacts")
          .select("*, accounts(name)")
          .order("created_at", { ascending: true }),
      ),
  });

const LEADS_PAGE_SIZE = 1000;

async function fetchAllLeads() {
  const leads: Lead[] = [];

  for (let from = 0; ; from += LEADS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + LEADS_PAGE_SIZE - 1);

    const page = unwrap<Lead[]>({ data, error });
    leads.push(...page);

    if (page.length < LEADS_PAGE_SIZE) break;
  }

  return leads;
}

export const leadsQuery = () =>
  queryOptions({
    queryKey: ["leads"],
    queryFn: fetchAllLeads,
  });

export const leadDashboardCountsQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "lead-counts"],
    queryFn: async () => {
      const [all, active] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .in("status", ["New", "Contacted"]),
      ]);

      if (all.error) throw new Error(all.error.message);
      if (active.error) throw new Error(active.error.message);
      return { total: all.count ?? 0, active: active.count ?? 0 };
    },
  });

export const dealsQuery = () =>
  queryOptions({
    queryKey: ["deals"],
    queryFn: async () =>
      unwrap<DealWithRefs[]>(
        await supabase
          .from("deals")
          .select("*, accounts(name), contacts(first_name, last_name)")
          .order("created_at", { ascending: true }),
      ),
  });

export const activitiesQuery = () =>
  queryOptions({
    queryKey: ["activities"],
    queryFn: async () =>
      unwrap<Activity[]>(
        await supabase.from("activities").select("*").order("due_date", { ascending: true }),
      ),
  });

export const trainersQuery = () =>
  queryOptions({
    queryKey: ["trainers"],
    queryFn: async () =>
      unwrap<Trainer[]>(
        await supabase.from("trainers").select("*").order("created_at", { ascending: true }),
      ),
  });

export const trainingRequestsQuery = () =>
  queryOptions({
    queryKey: ["training_requests"],
    queryFn: async () =>
      unwrap<TrainingRequestWithRefs[]>(
        await supabase
          .from("training_requests")
          .select("*, accounts(name), trainers(full_name)")
          .order("created_at", { ascending: true }),
      ),
  });

export const trainingBatchesQuery = () =>
  queryOptions({
    queryKey: ["training_batches"],
    queryFn: async () =>
      unwrap<TrainingBatchWithRefs[]>(
        await supabase
          .from("training_batches")
          .select("*, trainers(full_name), training_requests(course_topic, accounts(name))")
          .order("start_date", { ascending: true }),
      ),
  });

/* -------------------------------- mutations ------------------------------- */

export type CrmTable =
  | "accounts"
  | "contacts"
  | "leads"
  | "deals"
  | "activities"
  | "trainers"
  | "training_requests"
  | "training_batches";

export async function createRecord(
  table: CrmTable,
  values: Record<string, unknown>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from(table) as any).insert(values);
  if (error) throw new Error(error.message);
}

export async function updateRecord(
  table: CrmTable,
  id: string,
  values: Record<string, unknown>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from(table) as any).update(values).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRecord(table: CrmTable, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* -------------------------------- formatters ------------------------------ */

export function fullName(first: string | null | undefined, last: string | null | undefined) {
  return [first, last].filter(Boolean).join(" ") || "—";
}

export function currency(amount: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isToday(value: string | null | undefined) {
  if (!value) return false;
  return new Date(value).toDateString() === new Date().toDateString();
}

export function isThisMonth(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

export function dueBadge(value: string | null | undefined) {
  if (!value) return { label: "No date", tone: "neutral" as const };
  const due = new Date(value);
  const today = new Date();
  const sameDay = due.toDateString() === today.toDateString();
  if (sameDay) return { label: "Today", tone: "warning" as const };
  if (due.getTime() < today.getTime()) return { label: "Overdue", tone: "danger" as const };
  return { label: "Upcoming", tone: "success" as const };
}
