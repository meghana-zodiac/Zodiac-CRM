import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  Download,
  FileSignature,
  Filter,
  PhoneCall,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  accountsQuery,
  activitiesQuery,
  BD_STAGES,
  currency,
  dealsQuery,
  leadsQuery,
} from "@/lib/crm";
import { bdTeamMembersQuery, kraTargetsQuery, poaEntriesQuery } from "@/lib/poa";
import { cn } from "@/lib/utils";

type View = "reports" | "analytics";
type Range = "30" | "90" | "year" | "all";

const CHART_COLORS = ["#002b66", "#4b2c86", "#d1197e", "#8b5cf6", "#64748b", "#16a34a"];

function dateCutoff(range: Range) {
  const now = new Date();
  if (range === "all") return null;
  if (range === "year") return new Date(now.getFullYear(), 0, 1);
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - Number(range));
  return cutoff;
}

function inRange(value: string | null | undefined, range: Range) {
  if (!value) return false;
  const cutoff = dateCutoff(range);
  return !cutoff || new Date(value).getTime() >= cutoff.getTime();
}

function targetMonthDate(value: string) {
  const date = new Date(`1 ${value}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function ownerMatches(value: string | null | undefined, owner: string) {
  return owner === "all" || (value ?? "").trim().toLowerCase() === owner.toLowerCase();
}

function funnelStage(status: string | null | undefined) {
  const value = (status ?? "").toLowerCase();
  if (/convert|won|signed|client/.test(value)) return "Converted";
  if (/lost|not interested|disqual|reject|closed/.test(value)) return "Lost";
  if (/negotiat/.test(value)) return "Negotiation";
  if (/proposal|quote|sla/.test(value)) return "Proposal";
  if (/interest|qualif|meeting/.test(value)) return "Interested";
  if (/contact|call|follow|discussion|unanswered|busy/.test(value)) return "Contacted";
  return "New / Prospecting";
}

function downloadCsv(rows: Array<Record<string, string | number>>, fileName: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]!);
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((key) => escape(row[key] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Sparkles;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-panel">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-gradient" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface shadow-panel">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function ReportsAnalyticsModule({ view }: { view: View }) {
  const leads = useQuery(leadsQuery());
  const accounts = useQuery(accountsQuery());
  const deals = useQuery(dealsQuery());
  const activities = useQuery(activitiesQuery());
  const poa = useQuery(poaEntriesQuery());
  const targets = useQuery(kraTargetsQuery());
  const bdMembers = useQuery(bdTeamMembersQuery());
  const [range, setRange] = useState<Range>("30");
  const [owner, setOwner] = useState("all");

  const loading = [leads, accounts, deals, activities, poa, targets, bdMembers].some(
    (query) => query.isLoading,
  );
  const firstError = [leads, accounts, deals, activities, poa, targets, bdMembers].find(
    (query) => query.error,
  )?.error;

  const data = useMemo(() => {
    const leadRows = (leads.data ?? []).filter(
      (lead) => inRange(lead.created_at, range) && ownerMatches(lead.owner_name, owner),
    );
    const accountRows = (accounts.data ?? []).filter(
      (account) => inRange(account.created_at, range) && ownerMatches(account.owner_name, owner),
    );
    const dealRows = (deals.data ?? []).filter(
      (deal) => inRange(deal.created_at, range) && ownerMatches(deal.owner_name, owner),
    );
    const activityRows = (activities.data ?? []).filter(
      (activity) =>
        inRange(activity.due_date ?? activity.created_at, range) &&
        ownerMatches(activity.owner_name, owner),
    );
    const poaRows = (poa.data ?? []).filter(
      (entry) => inRange(entry.date, range) && ownerMatches(entry.team_member, owner),
    );

    const owners = new Set<string>();
    (bdMembers.data ?? []).forEach((member) => owners.add(member.display_name));
    [...leadRows, ...dealRows, ...activityRows].forEach((row) => {
      if (row.owner_name) owners.add(row.owner_name);
    });
    poaRows.forEach((entry) => owners.add(entry.team_member));

    const now = Date.now();
    const openDeals = dealRows.filter((deal) => deal.stage !== "SLA Signed");
    const signedDeals = dealRows.filter((deal) => deal.stage === "SLA Signed");
    const convertedLeads = leadRows.filter((lead) => funnelStage(lead.status) === "Converted");
    const followUps = activityRows.filter((activity) => activity.due_date);
    const overdue = followUps.filter(
      (activity) => activity.status !== "Completed" && new Date(activity.due_date!).getTime() < now,
    );
    const upcoming = followUps.filter(
      (activity) =>
        activity.status !== "Completed" && new Date(activity.due_date!).getTime() >= now,
    );
    const completedFollowUps = followUps.filter((activity) => activity.status === "Completed");

    const funnelOrder = [
      "New / Prospecting",
      "Contacted",
      "Interested",
      "Proposal",
      "Negotiation",
      "Converted",
      "Lost",
    ];
    const funnel = funnelOrder.map((stage) => ({
      stage,
      count: leadRows.filter((lead) => funnelStage(lead.status) === stage).length,
    }));
    const pipeline = BD_STAGES.map((stage) => {
      const stageDeals = dealRows.filter((deal) => deal.stage === stage);
      return {
        stage: stage === "New Lead" ? "New Opportunity" : stage,
        count: stageDeals.length,
        value: stageDeals.reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0),
      };
    });

    const team = [...owners].sort().map((name) => {
      const ownedLeads = leadRows.filter((lead) => ownerMatches(lead.owner_name, name));
      const ownedDeals = dealRows.filter((deal) => ownerMatches(deal.owner_name, name));
      const ownedActivities = activityRows.filter((activity) =>
        ownerMatches(activity.owner_name, name),
      );
      const ownedPoa = poaRows.filter((entry) => ownerMatches(entry.team_member, name));
      const ownerTargets = (targets.data ?? []).filter(
        (target) =>
          ownerMatches(target.team_member, name) && inRange(targetMonthDate(target.month), range),
      );
      return {
        name,
        leads: ownedLeads.length,
        calls: ownedPoa.reduce((sum, entry) => sum + Number(entry.calls_made ?? 0), 0),
        meetings: ownedActivities.filter(
          (activity) => activity.activity_type === "Meeting" && activity.status === "Completed",
        ).length,
        proposals: ownedPoa.reduce((sum, entry) => sum + Number(entry.proposals_sent ?? 0), 0),
        won: ownedDeals.filter((deal) => deal.stage === "SLA Signed").length,
        pipeline: ownedDeals
          .filter((deal) => deal.stage !== "SLA Signed")
          .reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0),
        revenue: ownedPoa.reduce((sum, entry) => sum + Number(entry.actual_revenue ?? 0), 0),
        target: ownerTargets.reduce((sum, target) => sum + Number(target.target_revenue ?? 0), 0),
      };
    });

    return {
      leadRows,
      accountRows,
      dealRows,
      activityRows,
      poaRows,
      openDeals,
      signedDeals,
      convertedLeads,
      overdue,
      upcoming,
      completedFollowUps,
      funnel,
      pipeline,
      team,
    };
  }, [
    accounts.data,
    activities.data,
    bdMembers.data,
    deals.data,
    leads.data,
    owner,
    poa.data,
    range,
    targets.data,
  ]);

  const ownerOptions = useMemo(() => {
    const names = new Set((bdMembers.data ?? []).map((member) => member.display_name));
    (leads.data ?? []).forEach((lead) => lead.owner_name && names.add(lead.owner_name));
    (deals.data ?? []).forEach((deal) => deal.owner_name && names.add(deal.owner_name));
    return [...names].sort();
  }, [bdMembers.data, deals.data, leads.data]);

  const pipelineValue = data.openDeals.reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0);
  const conversion = data.leadRows.length
    ? Math.round((data.convertedLeads.length / data.leadRows.length) * 100)
    : 0;
  const callTotal = data.poaRows.reduce((sum, entry) => sum + Number(entry.calls_made ?? 0), 0);
  const meetingsCompleted = data.activityRows.filter(
    (activity) => activity.activity_type === "Meeting" && activity.status === "Completed",
  ).length;

  const exportCurrentView = () => {
    if (view === "reports") {
      downloadCsv(
        data.team.map((row) => ({
          "BD member": row.name,
          Leads: row.leads,
          Calls: row.calls,
          "Meetings completed": row.meetings,
          "Proposals sent": row.proposals,
          "Deals won": row.won,
          "Open pipeline": row.pipeline,
          Revenue: row.revenue,
          "Revenue target": row.target,
        })),
        "zodiac-crm-team-report.csv",
      );
    } else {
      downloadCsv(
        data.pipeline.map((row) => ({
          Stage: row.stage,
          Deals: row.count,
          "Pipeline value": row.value,
        })),
        "zodiac-crm-pipeline-analytics.csv",
      );
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <header className="border-b border-border bg-surface px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-lg bg-brand-gradient text-primary-foreground shadow-panel">
                {view === "reports" ? (
                  <BarChart3 className="size-4" />
                ) : (
                  <TrendingUp className="size-4" />
                )}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  {view === "reports" ? "Reports" : "Analytics"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {view === "reports"
                    ? "Management overview and BD team performance"
                    : "Lead conversion and proposal pipeline insights"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5">
              <Filter className="size-3.5 text-muted-foreground" />
              <select
                value={range}
                onChange={(event) => setRange(event.target.value as Range)}
                aria-label="Report date range"
                className="h-9 bg-transparent text-sm outline-none"
              >
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="year">This year</option>
                <option value="all">All time</option>
              </select>
            </div>
            <select
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              aria-label="Filter by BD member"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="all">All BD members</option>
              {ownerOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={exportCurrentView}>
              <Download className="size-4" /> Export CSV
            </Button>
          </div>
        </div>

        <nav className="mt-4 flex gap-1" aria-label="Reports and analytics">
          <Link
            to="/modules/$module"
            params={{ module: "reports" }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "reports"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            Reports
          </Link>
          <Link
            to="/modules/$module"
            params={{ module: "analytics" }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "analytics"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            Analytics
          </Link>
        </nav>
      </header>

      <div className="space-y-4 p-4 sm:p-6">
        {firstError ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Reports could not be loaded: {firstError.message}
          </div>
        ) : loading ? (
          <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-border bg-surface text-sm text-muted-foreground">
            Preparing reports…
          </div>
        ) : view === "reports" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="New leads"
                value={String(data.leadRows.length)}
                detail={`${data.accountRows.length} clients added`}
                icon={Sparkles}
              />
              <StatCard
                label="Open pipeline"
                value={currency(pipelineValue)}
                detail={`${data.openDeals.length} active proposals`}
                icon={BriefcaseBusiness}
              />
              <StatCard
                label="Conversion rate"
                value={`${conversion}%`}
                detail={`${data.convertedLeads.length} converted leads`}
                icon={Target}
              />
              <StatCard
                label="Overdue follow-ups"
                value={String(data.overdue.length)}
                detail={`${data.upcoming.length} upcoming`}
                icon={CalendarClock}
              />
              <StatCard
                label="Calls recorded"
                value={String(callTotal)}
                detail="From Daily POA entries"
                icon={PhoneCall}
              />
              <StatCard
                label="Meetings completed"
                value={String(meetingsCompleted)}
                detail={`${data.activityRows.length} total activities`}
                icon={CheckCircle2}
              />
              <StatCard
                label="Deals won"
                value={String(data.signedDeals.length)}
                detail="SLA signed"
                icon={FileSignature}
              />
              <StatCard
                label="Clients"
                value={String(data.accountRows.length)}
                detail="Added in selected period"
                icon={Building2}
              />
            </div>

            <Section
              title="BD team performance"
              description="Activity and commercial outcomes for the selected period"
              action={
                <span className="text-xs text-muted-foreground">
                  {data.team.length} team members
                </span>
              }
            >
              {data.team.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="bg-muted/45 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">BD member</th>
                        <th className="px-3 py-3 text-right">Leads</th>
                        <th className="px-3 py-3 text-right">Calls</th>
                        <th className="px-3 py-3 text-right">Meetings</th>
                        <th className="px-3 py-3 text-right">Proposals</th>
                        <th className="px-3 py-3 text-right">Won</th>
                        <th className="px-3 py-3 text-right">Pipeline</th>
                        <th className="px-4 py-3 text-right">Revenue / Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.team.map((row) => {
                        const achievement = row.target
                          ? Math.round((row.revenue / row.target) * 100)
                          : 0;
                        return (
                          <tr key={row.name} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{row.leads}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{row.calls}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{row.meetings}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{row.proposals}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{row.won}</td>
                            <td className="px-3 py-3 text-right font-medium tabular-nums">
                              {currency(row.pipeline)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="ml-auto w-40">
                                <div className="flex justify-between text-xs">
                                  <span>{currency(row.revenue)}</span>
                                  <span className="text-muted-foreground">
                                    {row.target ? `${achievement}%` : "No target"}
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-brand-gradient"
                                    style={{ width: `${Math.min(achievement, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No team activity is available for this period.
                </p>
              )}
            </Section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section
                title="Follow-up summary"
                description="Open and completed CRM activities with due dates"
              >
                <div className="grid grid-cols-3 divide-x divide-border py-5 text-center">
                  <div>
                    <p className="text-2xl font-semibold tabular-nums text-destructive">
                      {data.overdue.length}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Overdue</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tabular-nums text-warning">
                      {data.upcoming.length}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Upcoming</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tabular-nums text-success">
                      {data.completedFollowUps.length}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
                <div className="border-t border-border px-4 py-3">
                  <Link
                    to="/tasks"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Open activities <ArrowRight className="size-3" />
                  </Link>
                </div>
              </Section>
              <Section
                title="Commercial snapshot"
                description="Proposal outcomes in the selected period"
              >
                <div className="grid grid-cols-3 divide-x divide-border py-5 text-center">
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">{data.dealRows.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Total proposals</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tabular-nums text-brand-accent">
                      {data.openDeals.length}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Active</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tabular-nums text-success">
                      {data.signedDeals.length}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Signed</p>
                  </div>
                </div>
                <div className="border-t border-border px-4 py-3">
                  <Link
                    to="/deals"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Open proposal pipeline <ArrowRight className="size-3" />
                  </Link>
                </div>
              </Section>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Leads analysed"
                value={String(data.leadRows.length)}
                detail="Selected period"
                icon={UsersRound}
              />
              <StatCard
                label="Converted"
                value={String(data.convertedLeads.length)}
                detail={`${conversion}% conversion rate`}
                icon={Target}
              />
              <StatCard
                label="Pipeline value"
                value={currency(pipelineValue)}
                detail={`${data.openDeals.length} open proposals`}
                icon={TrendingUp}
              />
              <StatCard
                label="Signed SLAs"
                value={String(data.signedDeals.length)}
                detail="Successful proposals"
                icon={FileSignature}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Section
                title="Lead funnel"
                description="CRM and CEIPAL statuses grouped into commercial stages"
              >
                <div className="h-[340px] px-3 py-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.funnel} layout="vertical" margin={{ left: 18, right: 24 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="var(--color-border)"
                      />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="stage" width={108} tick={{ fontSize: 11 }} />
                      <Tooltip cursor={{ fill: "var(--color-muted)" }} />
                      <Bar dataKey="count" radius={[0, 5, 5, 0]}>
                        {data.funnel.map((entry, index) => (
                          <Cell
                            key={entry.stage}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section
                title="Proposal pipeline value"
                description="Value distribution across BD proposal stages"
              >
                <div className="h-[340px] px-3 py-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.pipeline} margin={{ left: 4, right: 16, bottom: 48 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--color-border)"
                      />
                      <XAxis
                        dataKey="stage"
                        angle={-25}
                        textAnchor="end"
                        interval={0}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip formatter={(value) => currency(Number(value))} />
                      <Bar dataKey="value" fill="#4b2c86" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Section title="Lead outcomes" description="Converted, lost, and active lead share">
                <div className="h-[300px] px-3 py-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Converted", value: data.convertedLeads.length },
                          {
                            name: "Lost",
                            value: data.funnel.find((row) => row.stage === "Lost")?.count ?? 0,
                          },
                          {
                            name: "Active",
                            value: data.funnel
                              .filter((row) => !["Converted", "Lost"].includes(row.stage))
                              .reduce((sum, row) => sum + row.count, 0),
                          },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={96}
                        paddingAngle={3}
                      >
                        <Cell fill="#16a34a" />
                        <Cell fill="#64748b" />
                        <Cell fill="#d1197e" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section title="Pipeline stage detail" description="Deal count and value by stage">
                <div className="divide-y divide-border">
                  {data.pipeline.map((row, index) => (
                    <div key={row.stage} className="flex items-center gap-3 px-4 py-3">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                        {row.stage}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {row.count} deals
                      </span>
                      <span className="w-28 text-right text-sm font-semibold tabular-nums text-foreground">
                        {currency(row.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
