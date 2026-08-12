import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PoaEntry = Tables<"poa_entries">;
export type KraTarget = Tables<"kra_targets">;

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
    queryFn: async () =>
      unwrap<KraTarget[]>(await supabase.from("kra_targets").select("*")),
  });

export type PoaEntryInput = {
  date: string;
  team_member: string;
  calls_made: number;
  proposals_sent: number;
  deals_closed_value: number;
  actual_revenue: number;
  notes: string | null;
};

export async function createPoaEntry(values: PoaEntryInput): Promise<void> {
  const { error } = await supabase.from("poa_entries").insert(values);
  if (error) throw new Error(error.message);
}

export async function updatePoaEntry(id: string, values: PoaEntryInput): Promise<void> {
  const { error } = await supabase.from("poa_entries").update(values).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePoaEntry(id: string): Promise<void> {
  const { error } = await supabase.from("poa_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function upsertKraTarget(values: {
  month: string;
  team_member: string;
  target_bookings: number;
  target_revenue: number;
  acquired_clients_target: number;
}): Promise<void> {
  const { error } = await supabase
    .from("kra_targets")
    .upsert(values, { onConflict: "month,team_member" });
  if (error) throw new Error(error.message);
}

/* ------------------------------ month helpers ----------------------------- */

/** Months tracked in the CAG pipeline sheet. */
export const POA_MONTHS = [
  "April 2026",
  "May 2026",
  "June 2026",
  "July 2026",
  "August 2026",
  "September 2026",
] as const;

export type PoaMonth = (typeof POA_MONTHS)[number];

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
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function todayKey() {
  return toDateKey(new Date());
}

/** "2026-04-17" -> "April 2026" */
export function monthLabelFromDate(value: string | null | undefined) {
  if (!value) return "";
  const [year, month] = value.split("-");
  const index = Number(month) - 1;
  if (!year || index < 0 || index > 11) return "";
  return `${MONTH_NAMES[index]} ${year}`;
}

/** "April 2026" -> { start: "2026-04-01", end: "2026-04-30", days: 30 } */
export function monthBounds(label: string) {
  const [name, yearText] = label.split(" ");
  const monthIndex = MONTH_NAMES.indexOf(name ?? "");
  const year = Number(yearText);
  if (monthIndex < 0 || !year) return { start: "", end: "", days: 30 };
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const mm = String(monthIndex + 1).padStart(2, "0");
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${days}`, days };
}

export function defaultMonth(): PoaMonth {
  const current = monthLabelFromDate(todayKey());
  return (POA_MONTHS as readonly string[]).includes(current)
    ? (current as PoaMonth)
    : "August 2026";
}

export function pct(actual: number, target: number) {
  if (!target) return 0;
  return Math.round((actual / target) * 100);
}

export function varianceTone(percent: number): "success" | "warning" | "danger" {
  if (percent >= 100) return "success";
  if (percent >= 80) return "warning";
  return "danger";
}
