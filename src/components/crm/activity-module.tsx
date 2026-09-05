import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, FilterPanel, ModuleHeader } from "@/components/crm/module-chrome";
import { RecordDialog } from "@/components/crm/record-dialog";
import { RowActions } from "@/components/crm/row-actions";
import { StatusPill, activityTone } from "@/components/crm/status-pill";
import { activityFields } from "@/components/crm/field-defs";
import { OwnerFilter, ownerMatches, useOwnerScope } from "@/components/crm/owner-filter";
import { BD_OWNERS } from "@/components/crm/nav-data";
import {
  ACTIVITY_STATUSES,
  activitiesQuery,
  dueBadge,
  formatDateTime,
  updateRecord,
  type Activity,
  type ActivityType,
} from "@/lib/crm";

function callDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

export function ActivityModule({
  type,
  title,
  createLabel,
}: {
  type: ActivityType;
  title: string;
  createLabel: string;
}) {
  const activities = useQuery(activitiesQuery());
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { owner: ownerFilter } = useOwnerScope();
  const [activeRep, setActiveRep] = useState<string>(BD_OWNERS[0]);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const all = (activities.data ?? []).filter((activity) => activity.activity_type === type);

  const toggleComplete = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateRecord("activities", id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Activity updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((activity) => {
      if (statusFilter !== "all" && activity.status !== statusFilter) return false;
      if (!ownerMatches(ownerFilter, activity.owner_name)) return false;
      if (!term) return true;
      return [activity.title, activity.notes, activity.owner_name, activity.related_to_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [all, search, statusFilter, ownerFilter]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <ModuleHeader
        title={title}
        count={rows.length}
        search={search}
        onSearchChange={setSearch}
        onToggleFilters={() => setShowFilters((prev) => !prev)}
        action={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <OwnerFilter
              label="Logging as"
              value={activeRep}
              allowAll={false}
              onChange={(value) => setActiveRep(value === "all" ? BD_OWNERS[0] : value)}
            />
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" /> {createLabel}
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        <FilterPanel
          className={showFilters ? "block w-full lg:w-56" : "hidden lg:block"}
          activeFilter={statusFilter}
          onFilterChange={setStatusFilter}
          systemFilters={[
            { id: "all", label: `All ${title.toLowerCase()}`, count: all.length },
            ...ACTIVITY_STATUSES.map((status) => ({
              id: status,
              label: status,
              count: all.filter((activity) => activity.status === status).length,
            })),
          ]}
        />

        <div
          className={
            showFilters ? "hidden flex-1 p-4 lg:block sm:p-5" : "min-w-0 flex-1 p-4 sm:p-5"
          }
        >
          {activities.isLoading ? (
            <EmptyState message="Loading activities…" />
          ) : rows.length === 0 ? (
            <EmptyState message={`No ${title.toLowerCase()} match this view.`} />
          ) : (
            <ul className="space-y-2">
              {rows.map((activity) => {
                const badge = dueBadge(activity.due_date);
                const details = type === "Call" ? callDetails(activity.service_details) : null;
                return (
                  <li
                    key={activity.id}
                    className="flex items-start gap-2.5 rounded-xl border border-border bg-surface p-3 shadow-panel sm:gap-3 sm:p-3.5"
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={activity.status === "Completed"}
                      onCheckedChange={(checked) =>
                        toggleComplete.mutate({
                          id: activity.id,
                          status: checked ? "Completed" : "Pending",
                        })
                      }
                      aria-label="Toggle completed"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={
                            activity.status === "Completed"
                              ? "text-sm font-medium text-muted-foreground line-through"
                              : "text-sm font-medium text-foreground"
                          }
                        >
                          {activity.title}
                        </p>
                        <StatusPill tone={activityTone(activity.status)}>
                          {activity.status}
                        </StatusPill>
                        {activity.status !== "Completed" ? (
                          <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(activity.due_date)} · {activity.owner_name ?? "Unassigned"}
                        {activity.related_to_type ? ` · ${activity.related_to_type}` : ""}
                      </p>
                      {activity.notes ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">{activity.notes}</p>
                      ) : null}
                      {details ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                          {typeof details.outcome === "string" ? (
                            <span className="rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">
                              {details.outcome}
                            </span>
                          ) : null}
                          {typeof details.elapsed_seconds === "number" ? (
                            <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                              Approx. {formatElapsed(details.elapsed_seconds)}
                            </span>
                          ) : null}
                          {typeof details.next_action === "string" ? (
                            <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                              Next: {details.next_action}
                            </span>
                          ) : null}
                          {typeof details.priority === "string" ? (
                            <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                              {details.priority} priority
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <RowActions
                      table="activities"
                      id={activity.id}
                      label={type}
                      onEdit={() => {
                        setEditing(activity);
                        setDialogOpen(true);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        table="activities"
        title={editing ? `Edit ${type}` : createLabel}
        fields={activityFields(type)}
        record={editing ?? { activity_type: type, status: "Pending", owner_name: activeRep }}
      />
    </div>
  );
}
