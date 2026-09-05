import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  FileSignature,
  LoaderCircle,
  PhoneCall,
  Save,
  Sparkles,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/crm/status-pill";
import { currency, formatDate, formatDateTime } from "@/lib/crm";
import { dailyEodQuery, saveDailyEod } from "@/lib/eod";

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function EodModule() {
  const queryClient = useQueryClient();
  const [reportDate, setReportDate] = useState(today);
  const eod = useQuery(dailyEodQuery(reportDate));
  const [bestOutcome, setBestOutcome] = useState("");
  const [supportNeeded, setSupportNeeded] = useState("");
  const [nextDayPriorities, setNextDayPriorities] = useState("");

  useEffect(() => {
    setBestOutcome(eod.data?.report?.best_outcome ?? "");
    setSupportNeeded(eod.data?.report?.support_needed ?? "");
    setNextDayPriorities(eod.data?.report?.next_day_priorities ?? "");
  }, [eod.data?.report]);

  const save = useMutation({
    mutationFn: (submit: boolean) => {
      if (!eod.data) throw new Error("Your EOD information is still loading.");
      if (submit && (!bestOutcome.trim() || !nextDayPriorities.trim())) {
        throw new Error("Add your best outcome and tomorrow's priorities before submitting.");
      }
      return saveDailyEod({
        userId: eod.data.userId,
        employeeName: eod.data.employeeName,
        reportDate,
        bestOutcome,
        supportNeeded,
        nextDayPriorities,
        metrics: eod.data.metrics,
        submit,
      });
    },
    onSuccess: (_, submitted) => {
      queryClient.invalidateQueries({ queryKey: ["daily-eod", reportDate] });
      toast.success(submitted ? "EOD submitted successfully" : "Draft saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (eod.isLoading) {
    return (
      <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 inline size-4 animate-spin" /> Preparing your EOD…
      </div>
    );
  }

  if (eod.error || !eod.data) {
    return (
      <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {eod.error?.message ?? "Your EOD could not be loaded."}
      </div>
    );
  }

  const { metrics, employeeName, report } = eod.data;
  const cards = [
    {
      label: "Prospects added",
      value: metrics.prospectsAdded,
      detail: "From Corporate Leads",
      icon: Sparkles,
    },
    {
      label: "Contacts added",
      value: metrics.contactsAdded,
      detail: "From Client Contacts",
      icon: UserRoundPlus,
    },
    {
      label: "Calls logged",
      value: metrics.outboundCalls,
      detail: "From Call Logs",
      icon: PhoneCall,
    },
    {
      label: "Meetings booked",
      value: metrics.meetingsBooked,
      detail: `${metrics.meetingsHeld} held`,
      icon: CalendarCheck,
    },
    {
      label: "Opportunities",
      value: metrics.opportunitiesCreated,
      detail: "Created today",
      icon: FileSignature,
    },
    {
      label: "Clients added",
      value: metrics.clientsAdded,
      detail: "From Corporate Clients",
      icon: Building2,
    },
  ];

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">My Daily EOD</h1>
            <StatusPill tone={report?.status === "submitted" ? "success" : "warning"}>
              {report?.status === "submitted" ? "Submitted" : report ? "Draft" : "Not started"}
            </StatusPill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {employeeName} · Activity figures are prepared automatically from CRM records.
          </p>
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="eod-date" className="sr-only">
            Report date
          </Label>
          <Input
            id="eod-date"
            type="date"
            value={reportDate}
            max={today()}
            onChange={(event) => setReportDate(event.target.value)}
          />
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">CRM activity for {formatDate(reportDate)}</h2>
            <p className="text-xs text-muted-foreground">No duplicate entry required</p>
          </div>
          <CheckCircle2 className="size-4 text-emerald-600" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-border bg-surface p-4 shadow-panel"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                <card.icon className="size-4 text-primary" />
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums">{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
          <div className="flex items-center gap-2">
            <UsersRound className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Live pipeline snapshot</h2>
          </div>
          <p className="mt-4 text-3xl font-semibold tabular-nums">
            {currency(metrics.activePipelineValue)}
          </p>
          <p className="text-xs text-muted-foreground">
            Across {metrics.proposalsActive} active proposals
          </p>
          <div className="mt-5 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
            This snapshot is stored with your EOD so the submitted report remains auditable.
          </div>
          {report?.submitted_at ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Last submitted {formatDateTime(report.submitted_at)}
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 shadow-panel lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Complete your daily context</h2>
            <p className="text-xs text-muted-foreground">
              Only these details need to be entered manually.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="best-outcome">
                Best outcome today <span className="text-destructive">*</span>
              </Label>
              <Input
                id="best-outcome"
                className="mt-1.5"
                value={bestOutcome}
                onChange={(event) => setBestOutcome(event.target.value)}
                placeholder="Example: Decision-maker agreed to review the proposal"
              />
            </div>
            <div>
              <Label htmlFor="support-needed">Bottleneck or support needed</Label>
              <Textarea
                id="support-needed"
                className="mt-1.5 min-h-20"
                value={supportNeeded}
                onChange={(event) => setSupportNeeded(event.target.value)}
                placeholder="Mention the account, blocker and decision or support required"
              />
            </div>
            <div>
              <Label htmlFor="next-priorities">
                Tomorrow's top three priorities <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="next-priorities"
                className="mt-1.5 min-h-24"
                value={nextDayPriorities}
                onChange={(event) => setNextDayPriorities(event.target.value)}
                placeholder={
                  "1. Account + action + expected outcome\n2. Account + action + expected outcome\n3. Account + action + expected outcome"
                }
              />
            </div>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate(false)}>
              <Save className="size-4" />
              Save draft
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate(true)}>
              {save.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Submit EOD
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
