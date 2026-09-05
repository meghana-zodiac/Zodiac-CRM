import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  MessageSquareText,
  Search,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/crm/status-pill";
import { currency, formatDate, formatDateTime } from "@/lib/crm";
import { reviewDailyEod, teamEodQuery, type DailyEodMetrics, type TeamEodRow } from "@/lib/eod";

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function metricsOf(row: TeamEodRow): Partial<DailyEodMetrics> {
  const value = row.report?.metrics_snapshot;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<DailyEodMetrics>)
    : {};
}

function submissionTone(row: TeamEodRow) {
  if (row.report?.status === "submitted") return "success" as const;
  if (row.report?.status === "draft") return "warning" as const;
  return "danger" as const;
}

function reviewLabel(value: string) {
  if (value === "coaching_required") return "Coaching required";
  if (value === "reviewed") return "Reviewed";
  return "Pending review";
}

export function EodReviewModule() {
  const queryClient = useQueryClient();
  const [reportDate, setReportDate] = useState(today);
  const [search, setSearch] = useState("");
  const team = useQuery(teamEodQuery(reportDate));
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (team.data ?? []).filter(
      (row) => !term || row.employeeName.toLowerCase().includes(term) || row.email.includes(term),
    );
  }, [search, team.data]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selected = rows.find((row) => row.userId === selectedUserId) ?? rows[0] ?? null;
  const [comments, setComments] = useState("");

  useEffect(() => {
    setComments(selected?.report?.manager_comments ?? "");
  }, [selected?.report?.id, selected?.report?.manager_comments]);

  const review = useMutation({
    mutationFn: (status: "reviewed" | "coaching_required") => {
      if (!selected?.report) throw new Error("This employee has not submitted an EOD.");
      return reviewDailyEod({ reportId: selected.report.id, review: status, comments });
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["team-eod", reportDate] });
      toast.success(status === "reviewed" ? "EOD marked as reviewed" : "Coaching follow-up added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (team.isLoading) {
    return (
      <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 inline size-4 animate-spin" /> Loading team EODs…
      </div>
    );
  }
  if (team.error) {
    return (
      <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {team.error.message}
      </div>
    );
  }

  const submitted = (team.data ?? []).filter((row) => row.report?.status === "submitted").length;
  const drafts = (team.data ?? []).filter((row) => row.report?.status === "draft").length;
  const pending = (team.data ?? []).length - submitted - drafts;
  const reviewPending = (team.data ?? []).filter(
    (row) => row.report?.status === "submitted" && row.report.manager_review === "pending",
  ).length;
  const metrics = selected ? metricsOf(selected) : {};
  const metricItems: Array<[string, string | number]> = [
    ["Prospects", metrics.prospectsAdded ?? 0],
    ["Contacts", metrics.contactsAdded ?? 0],
    ["Calls", metrics.outboundCalls ?? 0],
    ["Meetings", metrics.meetingsBooked ?? 0],
    ["Opportunities", metrics.opportunitiesCreated ?? 0],
    ["Pipeline", currency(metrics.activePipelineValue ?? 0)],
  ];

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UsersRound className="size-5 text-primary" />
            <h1 className="text-lg font-semibold">Team EOD Review</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Review daily outcomes, blockers and priorities across the approved CRM team.
          </p>
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="review-date" className="sr-only">
            Report date
          </Label>
          <Input
            id="review-date"
            type="date"
            value={reportDate}
            max={today()}
            onChange={(event) => {
              setReportDate(event.target.value);
              setSelectedUserId(null);
            }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Submitted", submitted, "text-success"],
          ["Drafts", drafts, "text-warning-foreground"],
          ["Not started", pending, "text-destructive"],
          ["Awaiting review", reviewPending, "text-primary"],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-lg border border-border bg-surface p-4 shadow-panel">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,2fr)]">
        <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-panel">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search team members"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search team"
                className="pl-9"
              />
            </div>
          </div>
          <ul className="max-h-[62vh] divide-y divide-border overflow-y-auto">
            {rows.map((row) => (
              <li key={row.userId}>
                <button
                  type="button"
                  onClick={() => setSelectedUserId(row.userId)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/60 ${selected?.userId === row.userId ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.employeeName}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                    </div>
                    <StatusPill tone={submissionTone(row)}>
                      {row.report?.status === "submitted"
                        ? "Submitted"
                        : row.report?.status === "draft"
                          ? "Draft"
                          : "Pending"}
                    </StatusPill>
                  </div>
                  {row.report?.status === "submitted" ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {reviewLabel(row.report.manager_review)}
                    </p>
                  ) : null}
                </button>
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="p-6 text-center text-sm text-muted-foreground">
                No team members found
              </li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
          {!selected ? (
            <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">
              Select a team member
            </div>
          ) : !selected.report ? (
            <div className="grid min-h-72 place-items-center text-center">
              <div>
                <AlertTriangle className="mx-auto size-7 text-warning-foreground" />
                <h2 className="mt-3 text-sm font-semibold">EOD not submitted</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.employeeName} has not started an EOD for {formatDate(reportDate)}.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{selected.employeeName}</h2>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(reportDate)} ·{" "}
                    {selected.report.submitted_at
                      ? `Submitted ${formatDateTime(selected.report.submitted_at)}`
                      : "Draft not submitted"}
                  </p>
                </div>
                <StatusPill
                  tone={
                    selected.report.manager_review === "reviewed"
                      ? "success"
                      : selected.report.manager_review === "coaching_required"
                        ? "warning"
                        : "info"
                  }
                >
                  {reviewLabel(selected.report.manager_review)}
                </StatusPill>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {metricItems.map(([label, value]) => (
                  <div key={label} className="rounded-md bg-muted/60 p-3">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Best outcome</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {selected.report.best_outcome || "—"}
                  </p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Support needed</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {selected.report.support_needed || "No support requested"}
                  </p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Tomorrow's priorities</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {selected.report.next_day_priorities || "—"}
                  </p>
                </div>
              </div>

              {selected.report.status !== "submitted" ? (
                <div className="rounded-md bg-warning/10 p-3 text-sm text-warning-foreground">
                  This report is still a draft. Review actions become available after submission.
                </div>
              ) : (
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="size-4 text-primary" />
                    <Label htmlFor="manager-comments">Manager comments</Label>
                  </div>
                  <Textarea
                    id="manager-comments"
                    value={comments}
                    onChange={(event) => setComments(event.target.value)}
                    className="mt-2 min-h-24"
                    placeholder="Add feedback, coaching notes or the support action agreed"
                  />
                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      disabled={review.isPending}
                      onClick={() => review.mutate("coaching_required")}
                    >
                      <ClipboardList className="size-4" /> Coaching required
                    </Button>
                    <Button disabled={review.isPending} onClick={() => review.mutate("reviewed")}>
                      {review.isPending ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      Mark reviewed
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
