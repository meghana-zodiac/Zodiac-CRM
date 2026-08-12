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
import { OwnerFilter, ownerMatches, type OwnerFilterValue } from "@/components/crm/owner-filter";
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
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilterValue>("all");
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
          <div className="flex flex-wrap items-center gap-2">
            <OwnerFilter value={ownerFilter} onChange={setOwnerFilter} />
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

        <div className={showFilters ? "hidden flex-1 p-4 lg:block sm:p-5" : "min-w-0 flex-1 p-4 sm:p-5"}>
          {activities.isLoading ? (
            <EmptyState message="Loading activities…" />
          ) : rows.length === 0 ? (
            <EmptyState message={`No ${title.toLowerCase()} match this view.`} />
          ) : (
            <ul className="space-y-2">
              {rows.map((activity) => {
                const badge = dueBadge(activity.due_date);
                return (
                  <li
                    key={activity.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3.5 shadow-panel"
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
                        <StatusPill tone={activityTone(activity.status)}>{activity.status}</StatusPill>
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
