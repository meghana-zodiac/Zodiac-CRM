import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Gauge,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BD_OWNERS } from "@/components/crm/nav-data";
import { currency, formatDate } from "@/lib/crm";
import {
  POA_MONTHS,
  bdTeamMembersQuery,
  createPoaEntry,
  defaultMonth,
  deletePoaEntry,
  kraTargetsQuery,
  monthBounds,
  monthLabelFromDate,
  pct,
  poaEntriesQuery,
  todayKey,
  updatePoaEntry,
  varianceTone,
  type PoaEntry,
  type PoaEntryInput,
} from "@/lib/poa";

type TeamFilter = "all" | string;
type SortKey = keyof Pick<
  PoaEntry,
  "date" | "team_member" | "calls_made" | "proposals_sent" | "deals_closed_value" | "actual_revenue"
>;

const toneClasses: Record<"success" | "warning" | "danger", string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

const toneBar: Record<"success" | "warning" | "danger", string> = {
  success: "[&>div]:bg-emerald-500",
  warning: "[&>div]:bg-amber-500",
  danger: "[&>div]:bg-red-500",
};

function emptyForm(defaultMember: string): PoaEntryInput {
  return {
    date: todayKey(),
    team_member: defaultMember,
    calls_made: 0,
    proposals_sent: 0,
    deals_closed_value: 0,
    actual_revenue: 0,
    notes: null,
  };
}

/* --------------------------------- KPI card -------------------------------- */

function KpiCard({
  icon: Icon,
  label,
  actual,
  target,
  formatter = (value: number) => String(value),
  footer,
  tone,
}: {
  icon: typeof Target;
  label: string;
  actual: number;
  target: number;
  formatter?: (value: number) => string;
  footer?: React.ReactNode;
  tone?: "success" | "warning" | "danger";
}) {
  const percent = pct(actual, target);
  const resolved = tone ?? varianceTone(percent);
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
        {formatter(actual)}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          / {formatter(target)}
        </span>
      </p>
      <Progress value={Math.min(percent, 100)} className={cn("mt-3 h-2", toneBar[resolved])} />
      <p className={cn("mt-1.5 text-xs font-medium tabular-nums", toneClasses[resolved])}>
        {percent}% of target
      </p>
      {footer ? <div className="mt-1 text-[11px] text-muted-foreground">{footer}</div> : null}
    </section>
  );
}

/* ------------------------------- entry dialog ------------------------------ */

function EntryDialog({
  open,
  onOpenChange,
  editing,
  teamMembers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: PoaEntry | null;
  teamMembers: string[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PoaEntryInput>(() =>
    editing
      ? {
          date: editing.date,
          team_member: editing.team_member,
          calls_made: editing.calls_made,
          proposals_sent: editing.proposals_sent,
          deals_closed_value: Number(editing.deals_closed_value),
          actual_revenue: Number(editing.actual_revenue),
          notes: editing.notes,
        }
      : emptyForm(teamMembers[0] ?? BD_OWNERS[0]),
  );

  const save = useMutation({
    mutationFn: async () => (editing ? updatePoaEntry(editing.id, form) : createPoaEntry(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["poa_entries"] });
      toast.success(
        `${editing ? "Updated" : "Logged"} POA for ${form.team_member} — ${formatDate(form.date)}`,
      );
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const num = (field: keyof PoaEntryInput) => (value: number) =>
    setForm((prev) => ({ ...prev, [field]: Number.isFinite(value) ? value : 0 }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit daily entry" : "Log daily POA / KRA"}</DialogTitle>
          <DialogDescription>
            Capture the day's BD activity and closures for one team member.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="entry-date">Date</Label>
            <Input
              id="entry-date"
              type="date"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Team member</Label>
            <div className="flex rounded-md border border-input bg-background p-0.5">
              {teamMembers.map((owner) => (
                <button
                  key={owner}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, team_member: owner }))}
                  className={cn(
                    "flex-1 rounded px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                    form.team_member === owner && "bg-accent font-medium text-accent-foreground",
                  )}
                >
                  {owner}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-calls">Calls made</Label>
            <Input
              id="entry-calls"
              type="number"
              min={0}
              value={form.calls_made}
              onChange={(event) => num("calls_made")(event.target.valueAsNumber)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-proposals">Proposals sent</Label>
            <Input
              id="entry-proposals"
              type="number"
              min={0}
              value={form.proposals_sent}
              onChange={(event) => num("proposals_sent")(event.target.valueAsNumber)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-bookings">Deals closed value (₹)</Label>
            <Input
              id="entry-bookings"
              type="number"
              min={0}
              value={form.deals_closed_value}
              onChange={(event) => num("deals_closed_value")(event.target.valueAsNumber)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-revenue">Revenue generated (₹)</Label>
            <Input
              id="entry-revenue"
              type="number"
              min={0}
              value={form.actual_revenue}
              onChange={(event) => num("actual_revenue")(event.target.valueAsNumber)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="entry-notes">Notes</Label>
            <Textarea
              id="entry-notes"
              value={form.notes ?? ""}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, notes: event.target.value || null }))
              }
              className="min-h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {editing ? "Save changes" : "Log entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- module --------------------------------- */

export function PoaModule() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState<string>(defaultMonth());
  const [range, setRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [team, setTeam] = useState<TeamFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "date",
    dir: "desc",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PoaEntry | null>(null);

  const entries = useQuery(poaEntriesQuery());
  const targets = useQuery(kraTargetsQuery());
  const memberProfiles = useQuery(bdTeamMembersQuery());

  const teamMembers = useMemo(() => {
    const names = new Set<string>();
    for (const profile of memberProfiles.data ?? []) names.add(profile.display_name);
    for (const row of entries.data ?? []) names.add(row.team_member);
    for (const row of targets.data ?? []) names.add(row.team_member);
    if (names.size === 0) BD_OWNERS.forEach((owner) => names.add(owner));
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [memberProfiles.data, entries.data, targets.data]);

  const usingRange = Boolean(range.from && range.to);
  const bounds = monthBounds(month);

  const filtered = useMemo(() => {
    const rows = (entries.data ?? []).filter((row) => {
      if (team !== "all" && row.team_member !== team) return false;
      if (usingRange) return row.date >= range.from && row.date <= range.to;
      return monthLabelFromDate(row.date) === month;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      if (typeof left === "number" || typeof right === "number") {
        return (Number(left) - Number(right)) * dir;
      }
      return String(left).localeCompare(String(right)) * dir;
    });
  }, [entries.data, team, month, range, usingRange, sort]);

  const monthTargets = useMemo(() => {
    const rows = (targets.data ?? []).filter((row) => {
      if (usingRange) return true;
      return row.month === month;
    });
    const scoped = team === "all" ? rows : rows.filter((row) => row.team_member === team);
    return {
      bookings: scoped.reduce((total, row) => total + Number(row.target_bookings), 0),
      revenue: scoped.reduce((total, row) => total + Number(row.target_revenue), 0),
      clients: scoped.reduce((total, row) => total + Number(row.acquired_clients_target), 0),
    };
  }, [targets.data, month, team, usingRange]);

  const actuals = useMemo(
    () => ({
      bookings: filtered.reduce((total, row) => total + Number(row.deals_closed_value), 0),
      revenue: filtered.reduce((total, row) => total + Number(row.actual_revenue), 0),
      clients: filtered.filter((row) => Number(row.deals_closed_value) > 0).length,
      calls: filtered.reduce((total, row) => total + row.calls_made, 0),
      proposals: filtered.reduce((total, row) => total + row.proposals_sent, 0),
    }),
    [filtered],
  );

  /* Run-rate pacing: project the month's revenue from elapsed days. */
  const pacing = useMemo(() => {
    const days = bounds.days;
    const today = todayKey();
    let elapsed = days;
    if (bounds.start && today < bounds.start) elapsed = 0;
    else if (bounds.end && today < bounds.end) elapsed = Number(today.slice(8, 10));
    // Never pace on fewer days than the log already covers.
    const loggedDays = filtered.reduce(
      (max, row) => Math.max(max, Number(row.date.slice(8, 10))),
      0,
    );
    elapsed = Math.min(days, Math.max(elapsed, loggedDays));
    const projected = elapsed > 0 ? (actuals.revenue / elapsed) * days : 0;
    return {
      elapsed,
      days,
      projected,
      percent: pct(projected, monthTargets.revenue),
    };
  }, [bounds, actuals.revenue, monthTargets.revenue, filtered]);

  const remove = useMutation({
    mutationFn: deletePoaEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["poa_entries"] });
      toast.success("Entry deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const monthIndex = POA_MONTHS.indexOf(month as (typeof POA_MONTHS)[number]);
  const shiftMonth = (delta: number) => {
    const next = POA_MONTHS[monthIndex + delta];
    if (next) {
      setMonth(next);
      setRange({ from: "", to: "" });
    }
  };

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );

  const exportCsv = () => {
    const header = [
      "Date",
      "Team Member",
      "Calls Made",
      "Proposals Sent",
      "Deals Closed Value",
      "Revenue Generated",
      "Notes",
    ];
    const lines = filtered.map((row) =>
      [
        row.date,
        row.team_member,
        row.calls_made,
        row.proposals_sent,
        row.deals_closed_value,
        row.actual_revenue,
        `"${(row.notes ?? "").replace(/"/g, '""')}"`,
      ].join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `poa-kra-${usingRange ? `${range.from}_${range.to}` : month.replace(" ", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sortIcon = (key: SortKey) =>
    sort.key !== key ? null : sort.dir === "asc" ? (
      <ArrowUp className="ml-1 inline size-3" />
    ) : (
      <ArrowDown className="ml-1 inline size-3" />
    );

  const revenuePercent = pct(actuals.revenue, monthTargets.revenue);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* top bar: month selector + range + team tabs */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => shiftMonth(-1)}
            disabled={monthIndex <= 0}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex items-center overflow-x-auto rounded-md border border-input bg-background p-0.5">
            {POA_MONTHS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setMonth(option);
                  setRange({ from: "", to: "" });
                }}
                className={cn(
                  "whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  !usingRange && month === option
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.replace(" 2026", "")}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => shiftMonth(1)}
            disabled={monthIndex < 0 || monthIndex >= POA_MONTHS.length - 1}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label="Range from"
            value={range.from}
            onChange={(event) => setRange((prev) => ({ ...prev, from: event.target.value }))}
            className="h-8 w-36"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="Range to"
            value={range.to}
            onChange={(event) => setRange((prev) => ({ ...prev, to: event.target.value }))}
            className="h-8 w-36"
          />
          {usingRange ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => setRange({ from: "", to: "" })}
            >
              Clear
            </Button>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-md border border-input bg-background p-0.5">
            {(["all", ...teamMembers] as TeamFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTeam(option)}
                className={cn(
                  "whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  team === option
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "all" ? "All BD Team" : option}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Log Daily POA / KRA
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-4 sm:p-6">
        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={Users}
            label="Acquired clients"
            actual={actuals.clients}
            target={monthTargets.clients}
            footer={`${actuals.calls} calls · ${actuals.proposals} proposals logged`}
          />
          <KpiCard
            icon={Target}
            label="Bookings"
            actual={actuals.bookings}
            target={monthTargets.bookings}
            formatter={currency}
          />
          <KpiCard
            icon={TrendingUp}
            label="Revenue"
            actual={actuals.revenue}
            target={monthTargets.revenue}
            formatter={currency}
            footer={
              revenuePercent >= 100
                ? "On or above target"
                : revenuePercent >= 80
                  ? "Close to target — push closures"
                  : "Below target — needs attention"
            }
          />
          <KpiCard
            icon={Gauge}
            label="Run rate pacing"
            actual={pacing.projected}
            target={monthTargets.revenue}
            formatter={currency}
            tone={varianceTone(pacing.percent)}
            footer={`Projected from ${pacing.elapsed} of ${pacing.days} days${usingRange ? " (range mode)" : ""}`}
          />
        </div>

        {/* history table */}
        <section className="rounded-lg border border-border bg-surface">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-foreground">Daily log history</h2>
              <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              <Download className="size-4" />
              Export to CSV
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {(
                    [
                      { key: "date", label: "Date" },
                      { key: "team_member", label: "Team member" },
                      { key: "calls_made", label: "Calls" },
                      { key: "proposals_sent", label: "Proposals" },
                      { key: "deals_closed_value", label: "Deals closed" },
                      { key: "actual_revenue", label: "Revenue" },
                    ] as { key: SortKey; label: string }[]
                  ).map((column) => (
                    <TableHead key={column.key}>
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="font-medium transition-colors hover:text-foreground"
                      >
                        {column.label}
                        {sortIcon(column.key)}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No entries for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(row.date)}</TableCell>
                      <TableCell>{row.team_member}</TableCell>
                      <TableCell className="tabular-nums">{row.calls_made}</TableCell>
                      <TableCell className="tabular-nums">{row.proposals_sent}</TableCell>
                      <TableCell className="tabular-nums">
                        {currency(Number(row.deals_closed_value))}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {currency(Number(row.actual_revenue))}
                      </TableCell>
                      <TableCell className="max-w-64 truncate text-muted-foreground">
                        {row.notes ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label="Edit entry"
                            onClick={() => {
                              setEditing(row);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label="Delete entry"
                            onClick={() => remove.mutate(row.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      {dialogOpen ? (
        <EntryDialog
          key={editing?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          teamMembers={teamMembers}
        />
      ) : null}
    </div>
  );
}
