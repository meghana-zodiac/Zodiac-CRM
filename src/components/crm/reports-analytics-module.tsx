import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
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

function monthBounds(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) return null;
  return {
    start: new Date(year, monthIndex - 1, 1),
    end: new Date(year, monthIndex, 1),
  };
}

function previousMonth(month: string) {
  const bounds = monthBounds(month);
  if (!bounds) return "";
  const previous = new Date(bounds.start.getFullYear(), bounds.start.getMonth() - 1, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
}

function inPeriod(value: string | null | undefined, range: Range, month: string) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (month) {
    const bounds = monthBounds(month);
    return Boolean(
      bounds && timestamp >= bounds.start.getTime() && timestamp < bounds.end.getTime(),
    );
  }
  const cutoff = dateCutoff(range);
  return !cutoff || timestamp >= cutoff.getTime();
}

function monthLabel(month: string) {
  const bounds = monthBounds(month);
  return bounds
    ? bounds.start.toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : month;
}

function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
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
  change,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Sparkles;
  change?: number;
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
          {change !== undefined ? (
            <p
              className={cn(
                "mt-2 text-xs font-medium tabular-nums",
                change > 0
                  ? "text-success"
                  : change < 0
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {change > 0 ? "+" : ""}
              {change}% vs previous month
            </p>
          ) : null}
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
  const [selectedMonth, setSelectedMonth] = useState("");
  const [owner, setOwner] = useState("all");

  const loading = [leads, accounts, deals, activities, poa, targets, bdMembers].some(
    (query) => query.isLoading,
  );
  const firstError = [leads, accounts, deals, activities, poa, targets, bdMembers].find(
    (query) => query.error,
  )?.error;

  const data = useMemo(() => {
    const leadRows = (leads.data ?? []).filter(
      (lead) =>
        inPeriod(lead.created_at, range, selectedMonth) && ownerMatches(lead.owner_name, owner),
    );
    const accountRows = (accounts.data ?? []).filter(
      (account) =>
        inPeriod(account.created_at, range, selectedMonth) &&
        ownerMatches(account.owner_name, owner),
    );
    const dealRows = (deals.data ?? []).filter(
      (deal) =>
        inPeriod(deal.created_at, range, selectedMonth) && ownerMatches(deal.owner_name, owner),
    );
    const activityRows = (activities.data ?? []).filter(
      (activity) =>
        inPeriod(activity.due_date ?? activity.created_at, range, selectedMonth) &&
        ownerMatches(activity.owner_name, owner),
    );
    const poaRows = (poa.data ?? []).filter(
      (entry) =>
        inPeriod(entry.date, range, selectedMonth) && ownerMatches(entry.team_member, owner),
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
          ownerMatches(target.team_member, name) &&
          inPeriod(targetMonthDate(target.month), range, selectedMonth),
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
    selectedMonth,
    targets.data,
  ]);

  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 24 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { value, label: monthLabel(value) };
    });
  }, []);

  const monthly = useMemo(() => {
    const anchor = selectedMonth || monthOptions[0]?.value || "";
    const previous = previousMonth(anchor);
    const ownerLeadRows = (leads.data ?? []).filter((row) => ownerMatches(row.owner_name, owner));
    const ownerAccountRows = (accounts.data ?? []).filter((row) =>
      ownerMatches(row.owner_name, owner),
    );
    const ownerDealRows = (deals.data ?? []).filter((row) => ownerMatches(row.owner_name, owner));
    const ownerActivityRows = (activities.data ?? []).filter((row) =>
      ownerMatches(row.owner_name, owner),
    );
    const ownerPoaRows = (poa.data ?? []).filter((row) => ownerMatches(row.team_member, owner));
    const ownerTargetRows = (targets.data ?? []).filter((row) =>
      ownerMatches(row.team_member, owner),
    );

    const totalsFor = (month: string) => {
      const monthLeads = ownerLeadRows.filter((row) => inPeriod(row.created_at, "all", month));
      const monthAccounts = ownerAccountRows.filter((row) =>
        inPeriod(row.created_at, "all", month),
      );
      const monthDeals = ownerDealRows.filter((row) => inPeriod(row.created_at, "all", month));
      const monthActivities = ownerActivityRows.filter((row) =>
        inPeriod(row.due_date ?? row.created_at, "all", month),
      );
      const monthPoa = ownerPoaRows.filter((row) => inPeriod(row.date, "all", month));
      const monthTargets = ownerTargetRows.filter((row) =>
        inPeriod(targetMonthDate(row.month), "all", month),
      );
      const converted = monthLeads.filter((row) => funnelStage(row.status) === "Converted").length;
      return {
        leads: monthLeads.length,
        clients: monthAccounts.length,
        converted,
        conversion: monthLeads.length ? Math.round((converted / monthLeads.length) * 100) : 0,
        proposals: monthDeals.length,
        calls: monthPoa.reduce((sum, row) => sum + Number(row.calls_made ?? 0), 0),
        meetings: monthActivities.filter(
          (row) => row.activity_type === "Meeting" && row.status === "Completed",
        ).length,
        revenue: monthPoa.reduce((sum, row) => sum + Number(row.actual_revenue ?? 0), 0),
        target: monthTargets.reduce((sum, row) => sum + Number(row.target_revenue ?? 0), 0),
      };
    };

    const trendMonths = Array.from({ length: 12 }, (_, index) => {
      const bounds = monthBounds(anchor);
      const date = bounds
        ? new Date(bounds.start.getFullYear(), bounds.start.getMonth() - (11 - index), 1)
        : new Date();
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    });

    return {
      current: totalsFor(anchor),
      previous: totalsFor(previous),
      previousLabel: monthLabel(previous),
      trend: trendMonths.map((month) => ({
        month: monthLabel(month),
        ...totalsFor(month),
      })),
    };
  }, [
    accounts.data,
    activities.data,
    deals.data,
    leads.data,
    monthOptions,
    owner,
    poa.data,
    selectedMonth,
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:items-center">
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5">
              <Filter className="size-3.5 text-muted-foreground" />
              <select
                value={range}
                onChange={(event) => {
                  setRange(event.target.value as Range);
                  setSelectedMonth("");
                }}
                aria-label="Report date range"
                className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
              >
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="year">This year</option>
                <option value="all">All time</option>
              </select>
            </div>
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              aria-label="Select calendar month"
              className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Select month</option>
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
            <select
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              aria-label="Filter by BD member"
              className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="all">All BD members</option>
              {ownerOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              className="w-full lg:w-auto"
              onClick={exportCurrentView}
            >
              <Download className="size-4" /> Export CSV
            </Button>
          </div>
        </div>

        <nav className="mt-4 flex gap-1 overflow-x-auto" aria-label="Reports and analytics">
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
                change={
                  selectedMonth
                    ? percentChange(monthly.current.leads, monthly.previous.leads)
                    : undefined
                }
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
                change={
                  selectedMonth
                    ? percentChange(monthly.current.converted, monthly.previous.converted)
                    : undefined
                }
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
                change={
                  selectedMonth
                    ? percentChange(monthly.current.calls, monthly.previous.calls)
                    : undefined
                }
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
                change={
                  selectedMonth
                    ? percentChange(monthly.current.clients, monthly.previous.clients)
                    : undefined
                }
              />
            </div>

            {selectedMonth ? (
              <Section
                title="Monthly comparison"
                description={`${monthLabel(selectedMonth)} compared with ${monthly.previousLabel}`}
              >
                <div className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ["Leads", monthly.current.leads, monthly.previous.leads],
                    ["Clients", monthly.current.clients, monthly.previous.clients],
                    ["Calls", monthly.current.calls, monthly.previous.calls],
                    ["Proposals", monthly.current.proposals, monthly.previous.proposals],
                    ["Converted", monthly.current.converted, monthly.previous.converted],
                    ["Revenue", monthly.current.revenue, monthly.previous.revenue],
                  ].map(([label, current, previous]) => {
                    const change = percentChange(Number(current), Number(previous));
                    return (
                      <div
                        key={String(label)}
                        className="rounded-lg border border-border bg-muted/25 p-3"
                      >
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {label === "Revenue" ? currency(Number(current)) : current}
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-xs font-medium tabular-nums",
                            change > 0
                              ? "text-success"
                              : change < 0
                                ? "text-destructive"
                                : "text-muted-foreground",
                          )}
                        >
                          {change > 0 ? "+" : ""}
                          {change}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Section>
            ) : null}

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
                <>
                  <div className="space-y-2.5 p-3 md:hidden">
                    {data.team.map((row) => {
                      const achievement = row.target
                        ? Math.round((row.revenue / row.target) * 100)
                        : 0;
                      return (
                        <article
                          key={row.name}
                          className="rounded-xl border border-border bg-background p-3.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold">{row.name}</p>
                            <span className="text-sm font-semibold text-primary">
                              {currency(row.pipeline)}
                            </span>
                          </div>
                          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg bg-muted/50 p-2">
                              <dt className="text-[10px] uppercase text-muted-foreground">Leads</dt>
                              <dd className="font-semibold">{row.leads}</dd>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-2">
                              <dt className="text-[10px] uppercase text-muted-foreground">Calls</dt>
                              <dd className="font-semibold">{row.calls}</dd>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-2">
                              <dt className="text-[10px] uppercase text-muted-foreground">
                                Proposals
                              </dt>
                              <dd className="font-semibold">{row.proposals}</dd>
                            </div>
                          </dl>
                          <div className="mt-3 flex justify-between text-xs">
                            <span>{currency(row.revenue)} revenue</span>
                            <span className="text-muted-foreground">
                              {row.target ? `${achievement}% of target` : "No target"}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-brand-gradient"
                              style={{ width: `${Math.min(achievement, 100)}%` }}
                            />
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="crm-table-scroll hidden overflow-x-auto overscroll-x-contain md:block">
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
                </>
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

            <Section
              title="Monthly trends"
              description={`12-month performance ending ${monthLabel(selectedMonth || monthOptions[0]?.value || "")}`}
            >
              <div className="grid gap-4 p-4 xl:grid-cols-2">
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthly.trend} margin={{ left: 4, right: 18, bottom: 18 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--color-border)"
                      />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="leads"
                        name="Leads"
                        stroke="#002b66"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="clients"
                        name="Clients"
                        stroke="#d1197e"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="calls"
                        name="Calls"
                        stroke="#4b2c86"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="proposals"
                        name="Proposals"
                        stroke="#16a34a"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="meetings"
                        name="Meetings"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthly.trend} margin={{ left: 4, right: 18, bottom: 18 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--color-border)"
                      />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis
                        yAxisId="money"
                        tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        yAxisId="percent"
                        orientation="right"
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip
                        formatter={(value, name) =>
                          name === "Conversion %" ? `${value}%` : currency(Number(value))
                        }
                      />
                      <Legend />
                      <Bar
                        yAxisId="money"
                        dataKey="revenue"
                        name="Revenue"
                        fill="#4b2c86"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        yAxisId="money"
                        dataKey="target"
                        name="Target"
                        fill="#d1197e"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="percent"
                        type="monotone"
                        dataKey="conversion"
                        name="Conversion %"
                        stroke="#16a34a"
                        strokeWidth={2}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Section>

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
