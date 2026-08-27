import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PoaEntry = Tables<"poa_entries">;
export type KraTarget = Tables<"kra_targets">;
export type BdTeamMember = Tables<"bd_team_members">;

function unwrap<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const poaEntriesQuery = () =>
  queryOptions({
    queryKey: ["poa_entries"],
    queryFn: async () =>
      unwrap<PoaEntry[]>(
        await supabase.from("poa_entries").select("*").order("date", { ascending: false }),
      ),
  });

export const kraTargetsQuery = () =>
  queryOptions({
    queryKey: ["kra_targets"],
    queryFn: async () => unwrap<KraTarget[]>(await supabase.from("kra_targets").select("*")),
  });

export const bdTeamMembersQuery = () =>
  queryOptions({
    queryKey: ["bd_team_members"],
    queryFn: async () =>
      unwrap<BdTeamMember[]>(
        await supabase.from("bd_team_members").select("*").eq("active", true).order("display_name"),
      ),
  });

export type DailyNumberField =
  | "target_leads"
  | "target_follow_up_calls"
  | "target_calls_connected"
  | "target_proposals_shared"
  | "target_vc_meetings"
  | "target_f2f_meetings"
  | "target_clients_onboarded"
  | "actual_leads"
  | "follow_up_calls_connected"
  | "clients_called"
  | "proposals_shared"
  | "vc_meetings"
  | "f2f_meetings"
  | "clients_onboarded"
  | "clients_billed"
  | "deals_closed_value"
  | "recruitment_revenue"
  | "learning_development_revenue"
  | "other_services_revenue";

export type PoaEntryInput = Pick<PoaEntry, "date" | "team_member" | "notes"> &
  Record<DailyNumberField, number>;

export const DAILY_FIELDS: DailyNumberField[] = [
  "target_leads",
  "target_follow_up_calls",
  "target_calls_connected",
  "target_proposals_shared",
  "target_vc_meetings",
  "target_f2f_meetings",
  "target_clients_onboarded",
  "actual_leads",
  "follow_up_calls_connected",
  "clients_called",
  "proposals_shared",
  "vc_meetings",
  "f2f_meetings",
  "clients_onboarded",
  "clients_billed",
  "deals_closed_value",
  "recruitment_revenue",
  "learning_development_revenue",
  "other_services_revenue",
];

export function emptyPoaEntry(date: string, teamMember: string): PoaEntryInput {
  return Object.assign(
    { date, team_member: teamMember, notes: null },
    Object.fromEntries(DAILY_FIELDS.map((field) => [field, 0])),
  ) as PoaEntryInput;
}

export function toPoaEntryInput(row: PoaEntry): PoaEntryInput {
  const value = emptyPoaEntry(row.date, row.team_member);
  for (const field of DAILY_FIELDS) value[field] = Number(row[field] ?? 0);
  value.notes = row.notes;
  return value;
}

export async function upsertPoaEntry(values: PoaEntryInput): Promise<void> {
  const actualRevenue =
    values.recruitment_revenue +
    values.learning_development_revenue +
    values.other_services_revenue;
  const { error } = await supabase.from("poa_entries").upsert(
    {
      ...values,
      calls_made: values.clients_called,
      proposals_sent: values.proposals_shared,
      actual_revenue: actualRevenue,
    },
    { onConflict: "date,team_member" },
  );
  if (error) throw new Error(error.message);
}

export type KraTargetInput = Pick<KraTarget, "month" | "team_member"> & {
  target_bookings: number;
  acquired_clients_target: number;
  target_clients_billed: number;
  target_recruitment_revenue: number;
  target_learning_development_revenue: number;
  target_other_services_revenue: number;
};

export async function upsertKraTarget(values: KraTargetInput): Promise<void> {
  const targetRevenue =
    values.target_recruitment_revenue +
    values.target_learning_development_revenue +
    values.target_other_services_revenue;
  const { error } = await supabase
    .from("kra_targets")
    .upsert({ ...values, target_revenue: targetRevenue }, { onConflict: "month,team_member" });
  if (error) throw new Error(error.message);
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function toDateKey(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T12:00:00`) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function todayKey() {
  return toDateKey(new Date());
}

export function monthLabelFromDate(value: string | null | undefined) {
  if (!value) return "";
  const [year, month] = value.split("-");
  const index = Number(month) - 1;
  return year && index >= 0 && index <= 11 ? `${MONTH_NAMES[index]} ${year}` : "";
}

export function monthBounds(label: string) {
  const [name, yearText] = label.split(" ");
  const monthIndex = MONTH_NAMES.indexOf(name ?? "");
  const year = Number(yearText);
  if (monthIndex < 0 || !year) return { start: "", end: "", days: 30 };
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const mm = String(monthIndex + 1).padStart(2, "0");
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(days).padStart(2, "0")}`, days };
}

export function monthOptions(center = new Date()) {
  return Array.from({ length: 18 }, (_, index) => {
    const date = new Date(center.getFullYear(), center.getMonth() + index - 9, 1);
    return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  });
}

export function defaultMonth() {
  return monthLabelFromDate(todayKey());
}

export function monthDates(label: string) {
  const bounds = monthBounds(label);
  return Array.from(
    { length: bounds.days },
    (_, index) => `${bounds.start.slice(0, 8)}${String(index + 1).padStart(2, "0")}`,
  );
}

export function fiscalYearStart(label: string) {
  const start = monthBounds(label).start;
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7));
  return `${month >= 4 ? year : year - 1}-04-01`;
}

export function pct(actual: number, target: number) {
  return target ? Math.round((actual / target) * 100) : 0;
}
