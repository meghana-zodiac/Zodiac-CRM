import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState, ModuleHeader, type ViewMode } from "@/components/crm/module-chrome";
import { RecordDialog } from "@/components/crm/record-dialog";
import { RowActions } from "@/components/crm/row-actions";
import { OwnerFilter, ownerMatches, type OwnerFilterValue } from "@/components/crm/owner-filter";
import { StatusPill, trainingTone, trainingTypeTone } from "@/components/crm/status-pill";
import { trainingRequestFields } from "@/components/crm/field-defs";
import {
  TRAINING_STATUSES,
  accountsQuery,
  currency,
  formatDate,
  trainersQuery,
  trainingRequestsQuery,
  updateRecord,
  type TrainingRequestWithRefs,
  type TrainingStatus,
} from "@/lib/crm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/training-requests")({
  head: () => ({
    meta: [
      { title: "Training Requests — Zodiac HR Consultants" },
      {
        name: "description",
        content:
          "L&D training pipeline from inquiry received and curriculum quote to trainer assigned, batch scheduled and completed & invoiced.",
      },
      { property: "og:title", content: "Training Requests — Zodiac HR Consultants" },
      {
        property: "og:description",
        content:
          "L&D training pipeline from inquiry received and curriculum quote to trainer assigned, batch scheduled and completed & invoiced.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrainingRequestsPage,
});

function TrainingRequestsPage() {
  const requests = useQuery(trainingRequestsQuery());
  const accounts = useQuery(accountsQuery());
  const trainers = useQuery(trainersQuery());
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");
  const [owner, setOwner] = useState<OwnerFilterValue>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingRequestWithRefs | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const moveStage = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TrainingStatus }) =>
      updateRecord("training_requests", id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_requests"] });
      toast.success("Training stage updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (requests.data ?? []).filter((row) => ownerMatches(owner, row.owner_name));
    if (!term) return list;
    return list.filter((row) =>
      [
        row.accounts?.name,
        row.client_name,
        row.course_topic,
        row.trainers?.full_name,
        row.training_type,
        row.status,
        row.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [requests.data, search, owner]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <ModuleHeader
        title="Training Requests"
        count={rows.length}
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        availableViews={["kanban", "list"]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <OwnerFilter value={owner} onChange={setOwner} />
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" /> New Training Request
            </Button>
          </div>
        }
      />

      <div className="min-w-0 flex-1 p-4 sm:p-5">
        {requests.isLoading ? (
          <EmptyState message="Loading training requests…" />
        ) : view === "list" ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-panel">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Client</th>
                  <th className="px-3 py-2.5">Training type</th>
                  <th className="px-3 py-2.5">Course / topic</th>
                  <th className="px-3 py-2.5">Trainer</th>
                  <th className="px-3 py-2.5">Participants</th>
                  <th className="px-3 py-2.5">Schedule</th>
                  <th className="px-3 py-2.5">Budget</th>
                  <th className="px-3 py-2.5">Pipeline stage</th>
                  <th className="px-3 py-2.5">Owner</th>
                  <th className="w-12 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      {row.accounts?.name ?? row.client_name ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill tone={trainingTypeTone(row.training_type)}>
                        {row.training_type}
                      </StatusPill>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{row.course_topic}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {row.trainers?.full_name ?? "Unassigned"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                      {row.participants ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatDate(row.start_date)} → {formatDate(row.end_date)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-foreground">
                      {currency(row.budget)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill tone={trainingTone(row.status)}>{row.status}</StatusPill>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{row.owner_name ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <RowActions
                        table="training_requests"
                        id={row.id}
                        label="Training Request"
                        onEdit={() => {
                          setEditing(row);
                          setDialogOpen(true);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {TRAINING_STATUSES.map((status) => {
              const stageRows = rows.filter((row) => row.status === status);
              const participants = stageRows.reduce(
                (sum, row) => sum + Number(row.participants ?? 0),
                0,
              );
              return (
                <div
                  key={status}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragId) moveStage.mutate({ id: dragId, status });
                    setDragId(null);
                  }}
                  className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-surface shadow-panel"
                >
                  <div className="border-b border-border px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{status}</p>
                      <span className="text-xs text-muted-foreground">{stageRows.length}</span>
                    </div>
                    <p className="mt-0.5 text-xs font-medium tabular-nums text-primary">
                      {participants} participants
                    </p>
                  </div>
                  <div className="flex-1 space-y-2 p-2">
                    {stageRows.map((row) => (
                      <div
                        key={row.id}
                        draggable
                        onDragStart={() => setDragId(row.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => {
                          setEditing(row);
                          setDialogOpen(true);
                        }}
                        className={cn(
                          "cursor-pointer rounded-md border border-border bg-background p-3 transition-shadow hover:shadow-raised",
                          dragId === row.id && "opacity-50",
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {row.course_topic}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.accounts?.name ?? row.client_name ?? "No client"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <StatusPill tone={trainingTypeTone(row.training_type)}>
                            {row.training_type}
                          </StatusPill>
                          <span className="text-muted-foreground">
                            {formatDate(row.start_date)}
                          </span>
                        </div>
                        <p className="mt-2 truncate text-xs text-muted-foreground">
                          {row.trainers?.full_name ?? "Unassigned"} · {currency(row.budget)}
                        </p>
                      </div>
                    ))}
                    {stageRows.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                        Drop requests here
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        table="training_requests"
        title={editing ? "Edit Training Request" : "New Training Request"}
        fields={trainingRequestFields(accounts.data ?? [], trainers.data ?? [])}
        record={editing}
      />
    </div>
  );
}
