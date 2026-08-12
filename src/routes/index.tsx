import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  CheckSquare,
  FileSignature,
  GraduationCap,
  Sparkles,
  Trophy,
} from "lucide-react";

import {
  BD_STAGES,
  TRAINING_STATUSES,
  activitiesQuery,
  currency,
  dealsQuery,
  dueBadge,
  formatDateTime,
  isThisMonth,
  isToday,
  leadsQuery,
  trainingBatchesQuery,
  trainingRequestsQuery,
} from "@/lib/crm";
import { StatusPill, activityTone, bdTone } from "@/components/crm/status-pill";
import { BD_OWNERS } from "@/components/crm/nav-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zodiac CRM" },
      {
        name: "description",
        content:
          "A modern Sales CRM application for managing leads, contacts, accounts, deals, and activities.",
      },
      { property: "og:title", content: "Zodiac CRM" },
      {
        property: "og:description",
        content:
          "A modern Sales CRM application for managing leads, contacts, accounts, deals, and activities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const openBdStages = BD_STAGES.filter((stage) => stage !== "SLA Signed");
const openTrainingStages = TRAINING_STATUSES.filter(
  (status) => status !== "Completed & Invoiced",
);

function HomePage() {
  const leads = useQuery(leadsQuery());
  const deals = useQuery(dealsQuery());
  const activities = useQuery(activitiesQuery());
  const trainingRequests = useQuery(trainingRequestsQuery());
  const trainingBatches = useQuery(trainingBatchesQuery());

  const leadList = leads.data ?? [];
  const dealList = deals.data ?? [];
  const activityList = activities.data ?? [];
  const requestList = trainingRequests.data ?? [];
  const batchList = trainingBatches.data ?? [];

  const newLeads = leadList.filter((lead) => lead.status === "New" || lead.status === "Contacted");
  const pendingSlas = dealList.filter((deal) => deal.stage !== "SLA Signed");
  const pendingSlaValue = pendingSlas.reduce((sum, deal) => sum + (deal.amount ?? 0), 0);
  const pendingTraining = requestList.filter(
    (request) => request.status !== "Completed & Invoiced",
  );
  const meetingsToday = activityList.filter(
    (activity) => activity.activity_type === "Meeting" && isToday(activity.due_date),
  );
  const ownerSummary = BD_OWNERS.map((owner) => {
    const isOwner = (value: string | null | undefined) =>
      (value ?? "").trim().toLowerCase() === owner.toLowerCase();
    const openDeals = dealList.filter((deal) => deal.stage !== "SLA Signed" && isOwner(deal.owner_name));
    const meetings = activityList.filter(
      (activity) =>
        activity.activity_type === "Meeting" &&
        activity.status !== "Completed" &&
        isOwner(activity.owner_name),
    );
    return {
      owner,
      openDeals: openDeals.length,
      pipelineValue: openDeals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0),
      meetings: meetings.length,
      meetingsToday: meetings.filter((activity) => isToday(activity.due_date)).length,
      trainingRequests: requestList.filter(
        (request) => request.status !== "Completed & Invoiced" && isOwner(request.owner_name),
      ).length,
    };
  });
  const signedThisMonth = dealList.filter(
    (deal) => deal.stage === "SLA Signed" && isThisMonth(deal.sla_signed_date ?? deal.created_at),
  );
  const confirmedBatchesThisMonth = batchList.filter((batch) => isThisMonth(batch.start_date));

  const maxBdCount = Math.max(
    1,
    ...openBdStages.map((stage) => dealList.filter((deal) => deal.stage === stage).length),
  );
  const maxTrainingCount = Math.max(
    1,
    ...openTrainingStages.map(
      (status) => requestList.filter((request) => request.status === status).length,
    ),
  );

  const upcoming = activityList.filter((activity) => activity.status !== "Completed").slice(0, 6);

  const stats = [
    {
      label: "New corporate leads",
      value: String(newLeads.length),
      sub: `${leadList.length} in database`,
      icon: Sparkles,
      to: "/leads",
    },
    {
      label: "Active SLAs pending",
      value: String(pendingSlas.length),
      sub: currency(pendingSlaValue),
      icon: FileSignature,
      to: "/deals",
    },
    {
      label: "Pending training requests",
      value: String(pendingTraining.length),
      sub: "Inquiry to batch scheduled",
      icon: GraduationCap,
      to: "/training-requests",
    },
    {
      label: "Client meetings today",
      value: String(meetingsToday.length),
      sub: "Scheduled",
      icon: CalendarCheck,
      to: "/meetings",
    },
    {
      label: "Signed & confirmed this month",
      value: String(signedThisMonth.length + confirmedBatchesThisMonth.length),
      sub: `${signedThisMonth.length} SLAs · ${confirmedBatchesThisMonth.length} batches`,
      icon: Trophy,
      to: "/training-batches",
    },
  ] as const;

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Good morning, team</h1>
        <p className="text-sm text-muted-foreground">
          Here's what's moving across business development and L&D delivery today.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="group rounded-lg border border-border bg-surface p-4 shadow-panel transition-shadow hover:shadow-raised"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
              <stat.icon className="size-4 shrink-0 text-primary" />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">BD team split — Nuzhat vs Edward</h2>
          <Link to="/deals" className="text-xs font-medium text-primary hover:underline">
            Open pipeline
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {ownerSummary.map((entry) => (
            <div key={entry.owner} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{entry.owner}</p>
                <StatusPill tone="info">{entry.openDeals} active deals</StatusPill>
              </div>
              <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                {currency(entry.pipelineValue)}
              </p>
              <p className="text-xs text-muted-foreground">Open pipeline value</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-muted/60 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Meetings</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">{entry.meetings}</dd>
                </div>
                <div className="rounded-md bg-muted/60 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Today</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {entry.meetingsToday}
                  </dd>
                </div>
                <div className="rounded-md bg-muted/60 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Training</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {entry.trainingRequests}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Staffing & consulting SLA pipeline</h2>
            <Link to="/deals" className="text-xs font-medium text-primary hover:underline">
              Open board
            </Link>
          </div>
          <ul className="space-y-3">
            {openBdStages.map((stage) => {
              const stageDeals = dealList.filter((deal) => deal.stage === stage);
              const value = stageDeals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0);
              return (
                <li key={stage}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-foreground">{stage}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {stageDeals.length} proposals · {currency(value)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary/80"
                      style={{ width: `${Math.max(4, (stageDeals.length / maxBdCount) * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">L&D training pipeline</h2>
            <Link to="/training-requests" className="text-xs font-medium text-primary hover:underline">
              Open board
            </Link>
          </div>
          <ul className="space-y-3">
            {openTrainingStages.map((status) => {
              const stageRequests = requestList.filter((request) => request.status === status);
              const participants = stageRequests.reduce(
                (sum, request) => sum + (request.participants ?? 0),
                0,
              );
              return (
                <li key={status}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-foreground">{status}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {stageRequests.length} requests · {participants} participants
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-accent-foreground/70"
                      style={{
                        width: `${Math.max(4, (stageRequests.length / maxTrainingCount) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Upcoming activities</h2>
            <CheckSquare className="size-4 text-muted-foreground" />
          </div>
          <ul className="divide-y divide-border">
            {upcoming.map((activity) => {
              const badge = dueBadge(activity.due_date);
              return (
                <li key={activity.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.activity_type} · {formatDateTime(activity.due_date)}
                      </p>
                    </div>
                    <StatusPill
                      tone={badge.tone === "neutral" ? activityTone(activity.status) : badge.tone}
                    >
                      {badge.label}
                    </StatusPill>
                  </div>
                </li>
              );
            })}
            {upcoming.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">Nothing scheduled</li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-surface shadow-panel lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Latest BD proposals</h2>
            <Link to="/deals" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {dealList.slice(0, 5).map((deal) => (
              <li key={deal.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{deal.deal_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {deal.accounts?.name ?? "—"} · {deal.service_line ?? "—"} ·{" "}
                    {currency(deal.amount)}
                  </p>
                </div>
                <StatusPill tone={bdTone(deal.stage)}>{deal.stage}</StatusPill>
              </li>
            ))}
            {dealList.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                No proposals yet
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
