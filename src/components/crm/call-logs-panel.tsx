import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDateTime } from "@/lib/crm";
import { bdTeamMembersQuery } from "@/lib/poa";
import {
  callMatchesUser,
  callUpdatesQuery,
  callUserKey,
  detailText,
  type ReviewCall,
} from "@/lib/call-updates";
import { Phone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CallUpdateDialog } from "./call-update-dialog";
import { cn } from "@/lib/utils";

export type CallLog = Tables<"call_logs">;

function duration(log: CallLog) {
  const seconds = log.duration_seconds;
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  const value = minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
  return log.call_type?.includes("Estimated elapsed") ? `Approx. ${value}` : value;
}

export function CallLogsPanel() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [reviewCall, setReviewCall] = useState<ReviewCall | null>(null);
  const members = useQuery(bdTeamMembersQuery());
  const updates = useQuery(callUpdatesQuery());
  const logs = useQuery({
    queryKey: ["call-logs"],
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_logs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as CallLog[];
    },
  });
  const allRows = logs.data ?? [];
  const userTabs = useMemo(() => {
    const users = new Map<string, { name: string; count: number }>();
    for (const member of members.data ?? []) {
      if (member.active && member.access_status === "approved") {
        users.set(callUserKey(member.display_name), { name: member.display_name, count: 0 });
      }
    }
    for (const log of logs.data ?? []) {
      const key = callUserKey(log.rep_name);
      const user = users.get(key) ?? { name: log.rep_name?.trim() || "Unassigned", count: 0 };
      user.count += 1;
      users.set(key, user);
    }
    return [...users.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [logs.data, members.data]);
  const updatesByCall = useMemo(
    () =>
      new Map(
        (updates.data ?? []).map((activity) => [detailText(activity, "call_log_id"), activity]),
      ),
    [updates.data],
  );
  const rows = allRows.filter((log) => callMatchesUser(log.rep_name, selectedUser));
  const filterOptions: [string | null, { name: string; count: number }][] = [
    [null, { name: "All users", count: allRows.length }],
    ...userTabs,
  ];
  const openUpdates = (log: CallLog) => {
    const activity = updatesByCall.get(log.id);
    setReviewCall({
      id: log.id,
      phone: log.phone_number ?? "Unknown number",
      startedAt: new Date(log.created_at).getTime(),
      ...(activity ? { activity } : {}),
    });
  };
  const refresh = () => {
    void logs.refetch();
    void updates.refetch();
    void members.refetch();
  };
  const summary = (id: string) => {
    const activity = updatesByCall.get(id);
    if (!activity) return "No updates yet";
    const followUp = detailText(activity, "follow_up_at");
    return [
      detailText(activity, "outcome"),
      activity.notes,
      followUp ? `Follow-up: ${formatDateTime(followUp)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Phone className="size-4 text-muted-foreground" />
          <h1 className="text-base font-semibold">Automatic call log</h1>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {rows.length}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh}>
          <RefreshCw
            className={`size-4 ${logs.isFetching || updates.isFetching ? "animate-spin" : ""}`}
          />{" "}
          Refresh
        </Button>
      </header>
      <nav
        aria-label="Filter call logs by CRM user"
        className="border-b border-border px-3 py-3 sm:px-4"
      >
        <p className="mb-2 text-xs font-medium text-muted-foreground">CRM users</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filterOptions.map(([key, user]) => {
            const selected = key === selectedUser;
            return (
              <button
                key={key === null ? "all" : `user-${key}`}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedUser(key)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {user.name} <span className="ml-1 opacity-75">{user.count}</span>
              </button>
            );
          })}
        </div>
        {members.error ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Team list unavailable. Users with recorded calls are still shown.
          </p>
        ) : null}
      </nav>
      {updates.error ? (
        <p className="px-4 py-3 text-sm text-destructive">
          Call updates could not load. Refresh to try again.
        </p>
      ) : null}
      {logs.error ? (
        <p className="px-4 py-6 text-sm text-destructive">{logs.error.message}</p>
      ) : logs.isLoading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading call logs…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {selectedUser === null
            ? "No automatic call logs yet. Tap a phone number in the CRM to start."
            : "No calls recorded for this user yet."}
        </p>
      ) : (
        <>
          <div className="space-y-2.5 p-3 md:hidden">
            {rows.map((log) => (
              <article key={log.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-mono text-sm font-semibold">
                      {log.phone_number ?? "Unknown number"}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {log.rep_name ?? "Unassigned"}
                    </span>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium">
                    {log.call_type ?? "Call"}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <span>Duration: {duration(log)}</span>
                  <span className="text-muted-foreground">{formatDateTime(log.created_at)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {summary(log.id)}
                </p>
                <Button
                  className="mt-2"
                  variant="outline"
                  size="sm"
                  disabled={updates.isLoading || Boolean(updates.error)}
                  onClick={() => openUpdates(log)}
                >
                  {updatesByCall.has(log.id) ? "Edit updates" : "Add updates"}
                </Button>
              </article>
            ))}
          </div>
          <div className="crm-table-scroll hidden overflow-x-auto overscroll-x-contain md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  {["CRM user", "Phone", "Type", "Duration", "Logged", "Updates", ""].map(
                    (label) => (
                      <th key={label} className="px-4 py-2 font-medium">
                        {label || <span className="sr-only">Actions</span>}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((log) => (
                  <tr key={log.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <span className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {log.rep_name ?? "Unassigned"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{log.phone_number ?? "—"}</td>
                    <td className="px-4 py-3">{log.call_type ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">{duration(log)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="max-w-sm whitespace-pre-wrap break-words px-4 py-3 text-muted-foreground">
                      {summary(log.id)}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updates.isLoading || Boolean(updates.error)}
                        onClick={() => openUpdates(log)}
                      >
                        {updatesByCall.has(log.id) ? "Edit updates" : "Add updates"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        A log records that a call was started. Actual connection and talk time are not detected.
        Updates are optional.
      </p>
      {reviewCall ? (
        <CallUpdateDialog
          key={reviewCall.id}
          call={reviewCall}
          onClose={() => setReviewCall(null)}
        />
      ) : null}
    </section>
  );
}
