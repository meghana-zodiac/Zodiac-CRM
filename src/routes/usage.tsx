import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Clock3,
  Laptop,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UsersRound,
} from "lucide-react";
import { format, formatDistanceToNow, startOfDay, subDays } from "date-fns";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/usage")({
  head: () => ({
    meta: [
      { title: "CRM Usage & Productivity — Zodiac HR Consultants" },
      {
        name: "description",
        content: "Admin-only evidence of desktop and mobile CRM adoption.",
      },
    ],
  }),
  component: CrmUsagePage,
});

type UsageEvent = Database["public"]["Tables"]["crm_usage_events"]["Row"];
type UsageSession = Database["public"]["Tables"]["crm_usage_sessions"]["Row"];
type TeamMember = Pick<
  Database["public"]["Tables"]["bd_team_members"]["Row"],
  "id" | "display_name" | "email"
>;

const periods = [
  { value: "today", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;

function rangeStart(period: string) {
  const now = new Date();
  if (period === "today") return startOfDay(now);
  return startOfDay(subDays(now, Math.max(0, Number(period) - 1)));
}

function readableEntity(value: string | null) {
  if (!value) return "CRM";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function metadataText(metadata: Json, key: string) {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") return null;
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

function DeviceBadge({ device }: { device: string }) {
  const mobile = device === "mobile" || device === "tablet";
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
      {mobile ? <Smartphone className="size-3" /> : <Laptop className="size-3" />}
      {device}
    </span>
  );
}

function CrmUsagePage() {
  const [period, setPeriod] = useState("7");
  const [memberFilter, setMemberFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const since = useMemo(() => rangeStart(period).toISOString(), [period]);

  const access = useQuery({
    queryKey: ["crm-usage-access"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("bd_team_members")
        .select("id,access_role,access_status")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const isAdmin =
    access.data?.access_role === "primary_admin" && access.data?.access_status === "approved";

  const members = useQuery({
    queryKey: ["crm-usage-members"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_team_members")
        .select("id,display_name,email")
        .eq("active", true)
        .eq("access_status", "approved")
        .order("display_name");
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  const events = useQuery({
    queryKey: ["crm-usage-events", since],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_usage_events")
        .select("*")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data as UsageEvent[];
    },
  });

  const sessions = useQuery({
    queryKey: ["crm-usage-sessions"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_usage_sessions")
        .select("*")
        .order("last_seen_at", { ascending: false });
      if (error) throw error;
      return data as UsageSession[];
    },
  });

  const filteredEvents = useMemo(
    () =>
      (events.data ?? []).filter(
        (event) =>
          (memberFilter === "all" || event.user_id === memberFilter) &&
          (deviceFilter === "all" || event.device_type === deviceFilter),
      ),
    [deviceFilter, events.data, memberFilter],
  );

  const visibleMembers = useMemo(
    () =>
      memberFilter === "all"
        ? members.data ?? []
        : (members.data ?? []).filter((member) => member.id === memberFilter),
    [memberFilter, members.data],
  );

  const meaningfulEvents = filteredEvents.filter(
    (event) => !["page_view", "session_started"].includes(event.event_type),
  );
  const verifiedActions = meaningfulEvents.filter((event) => event.source === "database");
  const communicationStarts = meaningfulEvents.filter((event) =>
    ["call_initiated", "whatsapp_opened", "email_opened"].includes(event.event_type),
  );
  const activeUsers = new Set(filteredEvents.map((event) => event.user_id)).size;
  const conversions = filteredEvents.filter((event) => event.event_type === "lead_converted").length;

  const memberRows = visibleMembers.map((member) => {
    const memberEvents = filteredEvents.filter((event) => event.user_id === member.id);
    const memberSessions = (sessions.data ?? []).filter(
      (session) => session.user_id === member.id && session.last_seen_at >= since,
    );
    const firstLogin = memberSessions
      .map((session) => session.first_seen_at)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;
    const latestTimes = [
      ...memberEvents.map((event) => event.occurred_at),
      ...memberSessions.map((session) => session.last_seen_at),
    ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const lastActive = latestTimes[0] ?? null;
    const isOnline = lastActive
      ? Date.now() - new Date(lastActive).getTime() <= 5 * 60 * 1000
      : false;
    const devices = Array.from(
      new Set(
        [...memberEvents.map((event) => event.device_type), ...memberSessions.map((session) => session.device_type)]
          .filter((device) => device && device !== "unknown"),
      ),
    );

    return {
      member,
      firstLogin,
      lastActive,
      isOnline,
      devices,
      leadsAdded: memberEvents.filter(
        (event) => event.entity_type === "leads" && event.event_type === "record_created",
      ).length,
      leadsUpdated: memberEvents.filter(
        (event) =>
          event.entity_type === "leads" &&
          ["record_updated", "lead_status_changed", "call_status_changed"].includes(event.event_type),
      ).length,
      followUps: memberEvents.filter(
        (event) =>
          event.entity_type === "activities" &&
          event.event_type === "record_created" &&
          (/follow[ -]?up/i.test(event.entity_label ?? "") ||
            metadataText(event.metadata, "activity_type") === "Task"),
      ).length,
      completed: memberEvents.filter((event) => event.event_type === "activity_completed").length,
      communication: memberEvents.filter((event) =>
        ["call_initiated", "whatsapp_opened", "email_opened"].includes(event.event_type),
      ).length,
      conversions: memberEvents.filter((event) => event.event_type === "lead_converted").length,
    };
  });

  if (access.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Checking administrator access…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-[70vh] place-items-center p-6">
        <div className="max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-panel">
          <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Administrator access required</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            CRM usage and employee activity evidence is visible only to approved primary administrators.
          </p>
        </div>
      </div>
    );
  }

  const loading = members.isLoading || events.isLoading || sessions.isLoading;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-brand-accent" />
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              CRM Usage &amp; Productivity
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin-only evidence of meaningful CRM activity across desktop and mobile devices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Usage period"
          >
            {periods.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={deviceFilter}
            onChange={(event) => setDeviceFilter(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Device type"
          >
            <option value="all">All devices</option>
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
            <option value="tablet">Tablet</option>
            <option value="unknown">Unknown</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              void members.refetch();
              void events.refetch();
              void sessions.refetch();
            }}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <section aria-label="Filter usage by team member" className="rounded-xl border border-border bg-surface p-2 shadow-card">
        <div className="overflow-x-auto scrollbar-thin">
          <div className="flex min-w-max gap-1">
            <button
              type="button"
              onClick={() => setMemberFilter("all")}
              aria-pressed={memberFilter === "all"}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                memberFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              All Members
            </button>
            {(members.data ?? []).map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setMemberFilter(member.id)}
                aria-pressed={memberFilter === member.id}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  memberFilter === member.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {member.display_name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active members" value={activeUsers} detail="Used CRM in this period" icon={UsersRound} />
        <StatCard label="Verified CRM actions" value={verifiedActions.length} detail="Database-confirmed changes" icon={CheckCircle2} />
        <StatCard label="Communication starts" value={communicationStarts.length} detail="Call, WhatsApp or Gmail opened" icon={MessageCircle} />
        <StatCard label="Conversions" value={conversions} detail="Leads converted to clients" icon={Activity} />
        <StatCard label="Total evidence" value={meaningfulEvents.length} detail="Meaningful tracked actions" icon={Clock3} />
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold text-foreground">Member-wise adoption</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A page visit alone is not counted as productive activity.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">First login</th>
                <th className="px-4 py-3">Last active / logout</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3 text-center">Leads added</th>
                <th className="px-4 py-3 text-center">Leads updated</th>
                <th className="px-4 py-3 text-center">Follow-ups</th>
                <th className="px-4 py-3 text-center">Completed</th>
                <th className="px-4 py-3 text-center">Communication</th>
                <th className="px-4 py-3 text-center">Converted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {memberRows.map((row) => (
                <tr key={row.member.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{row.member.display_name}</p>
                    <p className="text-xs text-muted-foreground">{row.member.email}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {row.firstLogin
                      ? format(new Date(row.firstLogin), "dd MMM, h:mm a")
                      : "No login recorded"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {row.isOnline ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-success">
                        <span className="size-2 rounded-full bg-success" />
                        Online now
                      </span>
                    ) : row.lastActive ? (
                      <div>
                        <p className="text-foreground">{format(new Date(row.lastActive), "dd MMM, h:mm a")}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(row.lastActive), { addSuffix: true })}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No logout recorded</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.devices.length ? row.devices.map((device) => <DeviceBadge key={device} device={device} />) : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">{row.leadsAdded}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{row.leadsUpdated}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{row.followUps}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{row.completed}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{row.communication}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{row.conversions}</td>
                </tr>
              ))}
              {!memberRows.length && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">No approved members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold text-foreground">Activity evidence timeline</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            “Verified” means the CRM database confirmed the record change.
          </p>
        </div>
        <div className="divide-y divide-border">
          {filteredEvents.slice(0, 150).map((event) => {
            const member = (members.data ?? []).find((item) => item.id === event.user_id);
            const fromStatus = metadataText(event.metadata, "from_status");
            const toStatus = metadataText(event.metadata, "to_status");
            return (
              <div key={event.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
                <span className={cn(
                  "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                  event.source === "database" ? "bg-success/10 text-success" : "bg-primary/10 text-primary",
                )}>
                  {event.device_type === "mobile" || event.device_type === "tablet"
                    ? <Smartphone className="size-4" />
                    : <Laptop className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-foreground">{member?.display_name ?? "CRM member"}</span>
                    <span className="text-muted-foreground">{event.action}</span>
                    {event.entity_label ? <span className="font-medium text-foreground">“{event.entity_label}”</span> : null}
                    {fromStatus || toStatus ? <span className="text-xs text-muted-foreground">({fromStatus ?? "—"} → {toStatus ?? "—"})</span> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{format(new Date(event.occurred_at), "dd MMM yyyy, h:mm a")}</span>
                    <span>•</span>
                    <span>{readableEntity(event.entity_type)}</span>
                    <DeviceBadge device={event.device_type} />
                    {event.browser ? <span>{event.browser}{event.operating_system ? ` · ${event.operating_system}` : ""}</span> : null}
                    {event.source === "database" ? (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">Verified</span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {!loading && !filteredEvents.length ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No usage evidence has been recorded for these filters yet.
            </div>
          ) : null}
          {loading ? <div className="px-4 py-12 text-center text-sm text-muted-foreground">Loading CRM usage…</div> : null}
        </div>
      </section>
    </div>
  );
}
