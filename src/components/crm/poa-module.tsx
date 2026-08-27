import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Save, Target, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BD_OWNERS } from "@/components/crm/nav-data";
import { currency, formatDate } from "@/lib/crm";
import {
  bdTeamMembersQuery,
  cagMonthlySummaryQuery,
  currentUserEmailQuery,
  DAILY_FIELDS,
  defaultMonth,
  emptyPoaEntry,
  fiscalYearStart,
  kraTargetsQuery,
  monthBounds,
  monthDates,
  monthLabelFromDate,
  monthOptions,
  pct,
  poaEntriesQuery,
  toPoaEntryInput,
  upsertKraTarget,
  upsertPoaEntry,
  type DailyNumberField,
  type CagMonthlySummary,
  type KraTargetInput,
  type PoaEntry,
  type PoaEntryInput,
} from "@/lib/poa";

type Metric = { field: DailyNumberField; label: string; short: string };

const TARGETS: Metric[] = [
  { field: "target_leads", label: "Target Leads", short: "Leads" },
  { field: "target_follow_up_calls", label: "Follow-up Calls", short: "Follow-ups" },
  { field: "target_calls_connected", label: "Target Calls Connected", short: "Connected" },
  { field: "target_proposals_shared", label: "Target Proposals Shared", short: "Proposals" },
  { field: "target_vc_meetings", label: "VC Meeting Target", short: "VC Meet" },
  { field: "target_f2f_meetings", label: "F2F Meeting Target", short: "F2F Meet" },
  { field: "target_clients_onboarded", label: "Target Clients Onboarded", short: "Onboarded" },
];

const ACTUALS: Metric[] = [
  { field: "actual_leads", label: "Actual Leads", short: "Leads" },
  { field: "follow_up_calls_connected", label: "Follow-up Calls Connected", short: "Follow-ups" },
  { field: "clients_called", label: "Clients Called", short: "Called" },
  { field: "proposals_shared", label: "Proposals Shared", short: "Proposals" },
  { field: "vc_meetings", label: "VC Meetings", short: "VC Meet" },
  { field: "f2f_meetings", label: "F2F Meetings", short: "F2F Meet" },
  { field: "clients_onboarded", label: "New Clients Onboarded", short: "Onboarded" },
];

const PERCENTAGES = TARGETS.map((target, index) => ({
  label: target.short,
  target: target.field,
  actual: ACTUALS[index].field,
}));

const EXTRA_METRICS: Metric[] = [
  { field: "clients_billed", label: "Clients Billed", short: "Clients Billed" },
  { field: "deals_closed_value", label: "Bookings", short: "Bookings" },
  { field: "recruitment_revenue", label: "Recruitment Revenue", short: "Recruitment" },
  { field: "learning_development_revenue", label: "L&D Revenue", short: "L&D" },
  { field: "other_services_revenue", label: "Other Services Revenue", short: "Other Services" },
];

const moneyFields = new Set<DailyNumberField>([
  "deals_closed_value",
  "recruitment_revenue",
  "learning_development_revenue",
  "other_services_revenue",
]);

function memberNames(
  entries: PoaEntry[],
  profiles: { display_name: string }[],
  targetNames: string[],
) {
  const names = new Set<string>([
    ...profiles.map((item) => item.display_name),
    ...entries.map((item) => item.team_member),
    ...targetNames,
  ]);
  if (!names.size) BD_OWNERS.forEach((name) => names.add(name));
  return [...names].sort((a, b) => a.localeCompare(b));
}

function aggregate(rows: PoaEntry[]) {
  const totals = Object.fromEntries(DAILY_FIELDS.map((field) => [field, 0])) as Record<
    DailyNumberField,
    number
  >;
  for (const row of rows)
    for (const field of DAILY_FIELDS) totals[field] += Number(row[field] ?? 0);
  return totals;
}

function SpreadsheetCell({
  value,
  onChange,
  money = false,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  money?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      min={0}
      step={money ? 1000 : 1}
      value={value || ""}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
      className="h-9 w-full min-w-20 border-0 bg-transparent px-2 text-center text-xs tabular-nums outline-none focus:bg-primary/5 focus:ring-2 focus:ring-inset focus:ring-primary disabled:cursor-default disabled:opacity-70"
    />
  );
}

function DailyGrid({
  month,
  member,
  entries,
  editable,
}: {
  month: string;
  member: string;
  entries: PoaEntry[];
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const dates = useMemo(() => monthDates(month), [month]);
  const existing = useMemo(
    () =>
      new Map(entries.filter((row) => row.team_member === member).map((row) => [row.date, row])),
    [entries, member],
  );
  const [drafts, setDrafts] = useState<Record<string, PoaEntryInput>>({});
  useEffect(() => setDrafts({}), [month, member]);

  const rowValue = (date: string) =>
    drafts[date] ??
    (existing.get(date) ? toPoaEntryInput(existing.get(date)!) : emptyPoaEntry(date, member));
  const update = (date: string, field: DailyNumberField, value: number) =>
    setDrafts((current) => ({ ...current, [date]: { ...rowValue(date), [field]: value } }));
  const save = useMutation({
    mutationFn: upsertPoaEntry,
    onSuccess: (_, values) => {
      queryClient.invalidateQueries({ queryKey: ["poa_entries"] });
      setDrafts((current) => {
        const next = { ...current };
        delete next[values.date];
        return next;
      });
      toast.success(`Saved ${formatDate(values.date)}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{member} · Daily POA</h2>
          <p className="text-xs text-muted-foreground">
            Enter targets and achievements directly into the grid. Save each completed row.
          </p>
        </div>
        <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {editable ? `${Object.keys(drafts).length} unsaved` : "View only"}
        </span>
      </div>
      <div className="max-h-[68vh] overflow-auto">
        <table className="w-max min-w-full border-collapse text-xs">
          <thead className="sticky top-0 z-20 shadow-sm">
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-30 w-28 min-w-28 border border-border bg-slate-100 px-2 dark:bg-slate-900"
              >
                Date
              </th>
              <th
                colSpan={TARGETS.length}
                className="border border-amber-300 bg-amber-300 px-2 py-2 text-center font-bold text-slate-950"
              >
                TARGET
              </th>
              <th
                colSpan={ACTUALS.length}
                className="border border-emerald-400 bg-emerald-400 px-2 py-2 text-center font-bold text-slate-950"
              >
                ACHIEVEMENT
              </th>
              <th
                colSpan={PERCENTAGES.length}
                className="border border-orange-300 bg-orange-300 px-2 py-2 text-center font-bold text-slate-950"
              >
                PERCENTAGE ACHIEVEMENT (%)
              </th>
              <th
                colSpan={EXTRA_METRICS.length}
                className="border border-violet-300 bg-violet-300 px-2 py-2 text-center font-bold text-slate-950"
              >
                BOOKINGS & REVENUE
              </th>
              <th
                rowSpan={2}
                className="sticky right-0 z-30 min-w-20 border border-border bg-slate-100 px-2 dark:bg-slate-900"
              >
                Save
              </th>
            </tr>
            <tr>
              {TARGETS.map((column) => (
                <th
                  key={column.field}
                  title={column.label}
                  className="h-20 w-24 min-w-24 border border-amber-300 bg-amber-100 px-2 text-center font-semibold text-slate-900"
                >
                  {column.label}
                </th>
              ))}
              {ACTUALS.map((column) => (
                <th
                  key={column.field}
                  title={column.label}
                  className="h-20 w-24 min-w-24 border border-emerald-300 bg-emerald-100 px-2 text-center font-semibold text-slate-900"
                >
                  {column.label}
                </th>
              ))}
              {PERCENTAGES.map((column) => (
                <th
                  key={column.label}
                  className="h-20 w-24 min-w-24 border border-orange-300 bg-orange-100 px-2 text-center font-semibold text-slate-900"
                >
                  {column.label}
                </th>
              ))}
              {EXTRA_METRICS.map((column) => (
                <th
                  key={column.field}
                  title={column.label}
                  className="h-20 w-28 min-w-28 border border-violet-300 bg-violet-100 px-2 text-center font-semibold text-slate-900"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => {
              const row = rowValue(date);
              const day = new Date(`${date}T12:00:00`).getDay();
              const weekend = day === 0 || day === 6;
              return (
                <tr key={date} className={cn(weekend && "bg-amber-50/70 dark:bg-amber-950/20")}>
                  <td
                    className={cn(
                      "sticky left-0 z-10 border border-border px-2 py-1 font-medium",
                      weekend ? "bg-amber-100 dark:bg-amber-950" : "bg-surface",
                    )}
                  >
                    {formatDate(date)}
                  </td>
                  {TARGETS.map(({ field }) => (
                    <td key={field} className="border border-border">
                      <SpreadsheetCell
                        value={row[field]}
                        disabled={!editable}
                        onChange={(value) => update(date, field, value)}
                      />
                    </td>
                  ))}
                  {ACTUALS.map(({ field }) => (
                    <td key={field} className="border border-border">
                      <SpreadsheetCell
                        value={row[field]}
                        disabled={!editable}
                        onChange={(value) => update(date, field, value)}
                      />
                    </td>
                  ))}
                  {PERCENTAGES.map((column) => {
                    const percent = pct(row[column.actual], row[column.target]);
                    return (
                      <td
                        key={column.label}
                        className={cn(
                          "border border-border px-2 text-center font-semibold tabular-nums",
                          percent >= 100
                            ? "text-emerald-600"
                            : percent >= 75
                              ? "text-amber-600"
                              : "text-muted-foreground",
                        )}
                      >
                        {percent}%
                      </td>
                    );
                  })}
                  {EXTRA_METRICS.map(({ field }) => (
                    <td key={field} className="border border-border">
                      <SpreadsheetCell
                        money={moneyFields.has(field)}
                        value={row[field]}
                        disabled={!editable}
                        onChange={(value) => update(date, field, value)}
                      />
                    </td>
                  ))}
                  <td className="sticky right-0 border border-border bg-surface px-2 text-center">
                    <Button
                      size="icon"
                      variant={drafts[date] ? "default" : "ghost"}
                      className="size-7"
                      disabled={!editable || !drafts[date] || save.isPending}
                      onClick={() => save.mutate(row)}
                      aria-label={`Save ${date}`}
                    >
                      <Save className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type SummaryRow = { label: string; target: number; actual: number; money?: boolean };
function SummaryTable({ title, rows }: { title: string; rows: SummaryRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2">Measure</th>
              <th className="px-4 py-2 text-right">Target</th>
              <th className="px-4 py-2 text-right">Actual</th>
              <th className="px-4 py-2 text-right">Achievement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const percent = pct(row.actual, row.target);
              const show = (value: number) =>
                row.money ? currency(value) : value.toLocaleString("en-IN");
              return (
                <tr key={row.label} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{show(row.target)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{show(row.actual)}</td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-semibold tabular-nums",
                      percent >= 100
                        ? "text-emerald-600"
                        : percent >= 75
                          ? "text-amber-600"
                          : "text-red-600",
                    )}
                  >
                    {percent}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CagSummaryView({ rows }: { rows: CagMonthlySummary[] }) {
  const names = useMemo(() => {
    const available = new Set(rows.map((row) => row.team_member));
    return ["Total CAG", ...[...available].filter((name) => name !== "Total CAG")];
  }, [rows]);
  const [selected, setSelected] = useState("Total CAG");
  const selectedRows = rows.filter((row) => row.team_member === selected);
  const number = (value: number) => Number(value ?? 0).toLocaleString("en-IN");
  const percentClass = (actual: number, target: number) => {
    const value = pct(actual, target);
    return value >= 100 ? "text-emerald-600" : value >= 75 ? "text-amber-600" : "text-red-600";
  };

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <Users className="size-4 text-primary" />
        <div>
          <h2 className="text-sm font-semibold">CAG monthly summary · FY 2026–27</h2>
          <p className="text-xs text-muted-foreground">Imported monthly targets and actuals.</p>
        </div>
        <div className="ml-auto flex max-w-full items-center overflow-x-auto rounded-md border border-input bg-background p-0.5">
          {names.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setSelected(name)}
              className={cn(
                "whitespace-nowrap rounded px-3 py-1 text-xs font-medium",
                selected === name
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[68vh] overflow-auto">
        <table className="w-full min-w-[1250px] border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="text-center font-semibold text-white">
              <th rowSpan={2} className="border border-border bg-slate-700 px-3 py-2 text-left">
                Month
              </th>
              <th colSpan={3} className="border border-border bg-violet-700 px-3 py-2">
                Clients acquired
              </th>
              <th colSpan={3} className="border border-border bg-fuchsia-700 px-3 py-2">
                Bookings
              </th>
              <th rowSpan={2} className="border border-border bg-slate-700 px-3 py-2">
                Clients billed
              </th>
              <th colSpan={3} className="border border-border bg-emerald-700 px-3 py-2">
                Recruitment revenue
              </th>
              <th rowSpan={2} className="border border-border bg-emerald-700 px-3 py-2">
                Other services actual
              </th>
              <th rowSpan={2} className="border border-border bg-emerald-700 px-3 py-2">
                Total revenue actual
              </th>
            </tr>
            <tr className="bg-muted text-center font-semibold">
              {Array.from({ length: 3 }, (_, index) => ["Target", "Actual", "%"][index]).map(
                (label, index) => (
                  <th key={`clients-${index}`} className="border border-border px-3 py-2">
                    {label}
                  </th>
                ),
              )}
              {Array.from({ length: 3 }, (_, index) => ["Target", "Actual", "%"][index]).map(
                (label, index) => (
                  <th key={`bookings-${index}`} className="border border-border px-3 py-2">
                    {label}
                  </th>
                ),
              )}
              {Array.from({ length: 3 }, (_, index) => ["Target", "Actual", "%"][index]).map(
                (label, index) => (
                  <th key={`revenue-${index}`} className="border border-border px-3 py-2">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {selectedRows.map((row) => {
              const clientsTarget = Number(row.clients_acquired_target);
              const clientsActual = Number(row.clients_acquired_actual);
              const bookingsTarget = Number(row.bookings_target);
              const bookingsActual = Number(row.bookings_actual);
              const revenueTarget = Number(row.recruitment_revenue_target);
              const revenueActual = Number(row.recruitment_revenue_actual);
              return (
                <tr key={row.id} className="border-t border-border hover:bg-muted/30">
                  <td className="border border-border px-3 py-2 font-medium">
                    {monthLabelFromDate(row.month)}
                  </td>
                  <td className="border border-border px-3 py-2 text-right tabular-nums">
                    {number(clientsTarget)}
                  </td>
                  <td className="border border-border px-3 py-2 text-right tabular-nums">
                    {number(clientsActual)}
                  </td>
                  <td
                    className={cn(
                      "border border-border px-3 py-2 text-right font-semibold",
                      percentClass(clientsActual, clientsTarget),
                    )}
                  >
                    {pct(clientsActual, clientsTarget)}%
                  </td>
                  <td className="border border-border px-3 py-2 text-right tabular-nums">
                    {currency(bookingsTarget)}
                  </td>
                  <td className="border border-border px-3 py-2 text-right tabular-nums">
                    {currency(bookingsActual)}
                  </td>
                  <td
                    className={cn(
                      "border border-border px-3 py-2 text-right font-semibold",
                      percentClass(bookingsActual, bookingsTarget),
                    )}
                  >
                    {pct(bookingsActual, bookingsTarget)}%
                  </td>
                  <td className="border border-border px-3 py-2 text-right tabular-nums">
                    {number(row.clients_billed_actual)}
                  </td>
                  <td className="border border-border px-3 py-2 text-right tabular-nums">
                    {currency(revenueTarget)}
                  </td>
                  <td className="border border-border px-3 py-2 text-right tabular-nums">
                    {currency(revenueActual)}
                  </td>
                  <td
                    className={cn(
                      "border border-border px-3 py-2 text-right font-semibold",
                      percentClass(revenueActual, revenueTarget),
                    )}
                  >
                    {pct(revenueActual, revenueTarget)}%
                  </td>
                  <td className="border border-border px-3 py-2 text-right tabular-nums">
                    {currency(Number(row.other_services_revenue_actual))}
                  </td>
                  <td className="border border-border px-3 py-2 text-right font-medium tabular-nums">
                    {currency(Number(row.total_revenue_actual))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TargetEditor({
  month,
  member,
  target,
  editable,
}: {
  month: string;
  member: string;
  target: KraTargetInput | undefined;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<KraTargetInput>(
    () =>
      target ?? {
        month,
        team_member: member,
        target_bookings: 0,
        acquired_clients_target: 0,
        target_clients_billed: 0,
        target_recruitment_revenue: 0,
        target_learning_development_revenue: 0,
        target_other_services_revenue: 0,
      },
  );
  useEffect(
    () =>
      setForm(
        target ?? {
          month,
          team_member: member,
          target_bookings: 0,
          acquired_clients_target: 0,
          target_clients_billed: 0,
          target_recruitment_revenue: 0,
          target_learning_development_revenue: 0,
          target_other_services_revenue: 0,
        },
      ),
    [month, member, target],
  );
  const save = useMutation({
    mutationFn: upsertKraTarget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kra_targets"] });
      toast.success("Monthly KRA targets saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const fields: { key: keyof KraTargetInput; label: string; money?: boolean }[] = [
    { key: "acquired_clients_target", label: "Clients acquired target" },
    { key: "target_clients_billed", label: "Clients billed target" },
    { key: "target_bookings", label: "Bookings target", money: true },
    { key: "target_recruitment_revenue", label: "Recruitment revenue target", money: true },
    { key: "target_learning_development_revenue", label: "L&D revenue target", money: true },
    { key: "target_other_services_revenue", label: "Other services revenue target", money: true },
  ];
  return (
    <section className="max-w-4xl rounded-lg border border-border bg-surface p-5">
      <div className="mb-5 flex items-start gap-3">
        <Target className="mt-0.5 size-5 text-primary" />
        <div>
          <h2 className="font-semibold">
            {member} · {month}
          </h2>
          <p className="text-sm text-muted-foreground">
            These targets power the monthly, YTD and team achievement calculations.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ key, label, money }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={String(key)}>{label}</Label>
            <Input
              id={String(key)}
              type="number"
              min={0}
              step={money ? 1000 : 1}
              value={Number(form[key]) || ""}
              disabled={!editable}
              onChange={(event) =>
                setForm((current) => ({ ...current, [key]: Number(event.target.value) || 0 }))
              }
            />
          </div>
        ))}
      </div>
      <Button
        className="mt-5"
        onClick={() => save.mutate(form)}
        disabled={!editable || save.isPending}
      >
        <Save className="size-4" />
        Save KRA targets
      </Button>
    </section>
  );
}

async function exportWorkbook(
  month: string,
  member: string,
  rows: PoaEntry[],
  summaries: SummaryRow[],
) {
  const XLSX = await import("xlsx");
  const daily = rows.map((row) => {
    const output: Record<string, string | number> = {
      Date: row.date,
      "Team Member": row.team_member,
    };
    for (const column of [...TARGETS, ...ACTUALS, ...EXTRA_METRICS])
      output[column.label] = Number(row[column.field] ?? 0);
    for (const column of PERCENTAGES)
      output[`${column.label} %`] = pct(Number(row[column.actual]), Number(row[column.target]));
    output.Notes = row.notes ?? "";
    return output;
  });
  const wb = XLSX.utils.book_new();
  const dailySheet = XLSX.utils.json_to_sheet(daily);
  dailySheet["!freeze"] = { xSplit: 2, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, dailySheet, "Daily POA");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      summaries.map((row) => ({
        Measure: row.label,
        Target: row.target,
        Actual: row.actual,
        "Achievement %": pct(row.actual, row.target),
      })),
    ),
    "KRA Summary",
  );
  XLSX.writeFile(wb, `POA-KRA-${member}-${month.replace(" ", "-")}.xlsx`);
}

export function PoaModule() {
  const [month, setMonth] = useState(defaultMonth());
  const options = useMemo(() => monthOptions(), []);
  const entriesQuery = useQuery(poaEntriesQuery());
  const targetsQuery = useQuery(kraTargetsQuery());
  const profilesQuery = useQuery(bdTeamMembersQuery());
  const currentUserEmail = useQuery(currentUserEmailQuery());
  const cagSummaryQuery = useQuery(cagMonthlySummaryQuery());
  const members = useMemo(
    () =>
      memberNames(
        entriesQuery.data ?? [],
        profilesQuery.data ?? [],
        (targetsQuery.data ?? []).map((item) => item.team_member),
      ),
    [entriesQuery.data, profilesQuery.data, targetsQuery.data],
  );
  const [member, setMember] = useState("");
  const ownMember = (profilesQuery.data ?? []).find(
    (profile) => profile.email.toLowerCase() === currentUserEmail.data,
  )?.display_name;
  const selectedInitialDataMonth = useRef(new Set<string>());
  useEffect(() => {
    if (!member && members[0]) setMember(members[0]);
  }, [member, members]);
  useEffect(() => {
    if (!member || selectedInitialDataMonth.current.has(member) || !entriesQuery.data) {
      return;
    }
    selectedInitialDataMonth.current.add(member);
    const monthCounts = new Map<string, number>();
    for (const row of entriesQuery.data.filter((item) => item.team_member === member)) {
      const label = monthLabelFromDate(row.date);
      monthCounts.set(label, (monthCounts.get(label) ?? 0) + 1);
    }
    const bestMonth = [...monthCounts.entries()].sort(
      ([leftMonth, leftCount], [rightMonth, rightCount]) =>
        rightCount - leftCount ||
        monthBounds(rightMonth).start.localeCompare(monthBounds(leftMonth).start),
    )[0]?.[0];
    if (bestMonth) setMonth(bestMonth);
  }, [entriesQuery.data, member]);
  const bounds = monthBounds(month);
  const monthRows = useMemo(
    () =>
      (entriesQuery.data ?? []).filter((row) => row.date >= bounds.start && row.date <= bounds.end),
    [entriesQuery.data, bounds.start, bounds.end],
  );
  const memberRows = useMemo(
    () => monthRows.filter((row) => row.team_member === member),
    [monthRows, member],
  );
  const memberTarget = (targetsQuery.data ?? []).find(
    (row) => row.month === month && row.team_member === member,
  );
  const targetInput: KraTargetInput | undefined = memberTarget
    ? {
        month,
        team_member: member,
        target_bookings: Number(memberTarget.target_bookings),
        acquired_clients_target: Number(memberTarget.acquired_clients_target),
        target_clients_billed: Number(memberTarget.target_clients_billed),
        target_recruitment_revenue: Number(memberTarget.target_recruitment_revenue),
        target_learning_development_revenue: Number(
          memberTarget.target_learning_development_revenue,
        ),
        target_other_services_revenue: Number(memberTarget.target_other_services_revenue),
      }
    : undefined;
  const actual = aggregate(memberRows);
  const summaryRows: SummaryRow[] = [
    {
      label: "Clients acquired",
      target: Number(memberTarget?.acquired_clients_target ?? 0),
      actual: actual.clients_onboarded,
    },
    {
      label: "Clients billed",
      target: Number(memberTarget?.target_clients_billed ?? 0),
      actual: actual.clients_billed,
    },
    {
      label: "Bookings",
      target: Number(memberTarget?.target_bookings ?? 0),
      actual: actual.deals_closed_value,
      money: true,
    },
    {
      label: "Recruitment revenue",
      target: Number(memberTarget?.target_recruitment_revenue ?? 0),
      actual: actual.recruitment_revenue,
      money: true,
    },
    {
      label: "L&D revenue",
      target: Number(memberTarget?.target_learning_development_revenue ?? 0),
      actual: actual.learning_development_revenue,
      money: true,
    },
    {
      label: "Other services revenue",
      target: Number(memberTarget?.target_other_services_revenue ?? 0),
      actual: actual.other_services_revenue,
      money: true,
    },
  ];
  const fiscalStart = fiscalYearStart(month);
  const ytdRows = useMemo(
    () =>
      (entriesQuery.data ?? []).filter(
        (row) => row.team_member === member && row.date >= fiscalStart && row.date <= bounds.end,
      ),
    [entriesQuery.data, member, fiscalStart, bounds.end],
  );
  const ytd = aggregate(ytdRows);
  const ytdTargets = (targetsQuery.data ?? []).filter(
    (row) =>
      row.team_member === member &&
      monthBounds(row.month).start >= fiscalStart &&
      monthBounds(row.month).end <= bounds.end,
  );
  const ytdSummary: SummaryRow[] = [
    {
      label: "Clients acquired",
      target: ytdTargets.reduce((sum, row) => sum + Number(row.acquired_clients_target), 0),
      actual: ytd.clients_onboarded,
    },
    {
      label: "Bookings",
      target: ytdTargets.reduce((sum, row) => sum + Number(row.target_bookings), 0),
      actual: ytd.deals_closed_value,
      money: true,
    },
    {
      label: "Total revenue",
      target: ytdTargets.reduce((sum, row) => sum + Number(row.target_revenue), 0),
      actual:
        ytd.recruitment_revenue + ytd.learning_development_revenue + ytd.other_services_revenue,
      money: true,
    },
  ];
  const monthIndex = options.indexOf(month);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={monthIndex <= 0}
            onClick={() => setMonth(options[monthIndex - 1])}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="h-8 rounded-md border border-input bg-background px-3 text-sm font-medium"
          >
            {options.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={monthIndex >= options.length - 1}
            onClick={() => setMonth(options[monthIndex + 1])}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex max-w-full items-center overflow-x-auto rounded-md border border-input bg-background p-0.5">
          {members.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setMember(name)}
              className={cn(
                "whitespace-nowrap rounded px-3 py-1 text-xs font-medium",
                member === name
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={!memberRows.length}
          onClick={() =>
            exportWorkbook(month, member, memberRows, summaryRows).catch((error: Error) =>
              toast.error(error.message),
            )
          }
        >
          <Download className="size-4" />
          Export Excel
        </Button>
      </div>
      <Tabs defaultValue="daily" className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
        <TabsList className="mb-4 w-fit">
          <TabsTrigger value="daily">Daily POA</TabsTrigger>
          <TabsTrigger value="individual">Individual Summary</TabsTrigger>
          <TabsTrigger value="team">CAG Summary</TabsTrigger>
          <TabsTrigger value="targets">KRA Targets</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="mt-0 min-h-0">
          {member ? (
            <DailyGrid
              month={month}
              member={member}
              entries={monthRows}
              editable={member === ownMember}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No active team members found.</p>
          )}
        </TabsContent>
        <TabsContent value="individual" className="mt-0 space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <SummaryTable title={`${month} performance`} rows={summaryRows} />
            <SummaryTable title="Financial-year-to-date performance" rows={ytdSummary} />
          </div>
        </TabsContent>
        <TabsContent value="team" className="mt-0">
          <CagSummaryView rows={cagSummaryQuery.data ?? []} />
        </TabsContent>
        <TabsContent value="targets" className="mt-0">
          {member ? (
            <TargetEditor
              month={month}
              member={member}
              target={targetInput}
              editable={member === ownMember}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
