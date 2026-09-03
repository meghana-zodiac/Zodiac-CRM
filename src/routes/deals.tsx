import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, GripVertical } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmptyState, ModuleHeader, type ViewMode } from "@/components/crm/module-chrome";
import { RecordDialog } from "@/components/crm/record-dialog";
import { RowActions } from "@/components/crm/row-actions";
import { OwnerFilter, ownerMatches, type OwnerFilterValue } from "@/components/crm/owner-filter";
import { StatusPill, activityTone, bdTone } from "@/components/crm/status-pill";
import { dealFields } from "@/components/crm/field-defs";
import {
  BD_STAGES,
  bdStageLabel,
  accountsQuery,
  activitiesQuery,
  contactsQuery,
  createRecord,
  currency,
  dealsQuery,
  formatDate,
  formatDateTime,
  fullName,
  updateRecord,
  type BdStage,
  type DealWithRefs,
} from "@/lib/crm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "BD Proposals & SLAs — Zodiac HR Consultants" },
      {
        name: "description",
        content:
          "Staffing and consulting SLA pipeline from new lead and pitch scheduled to proposal sent, SLA negotiation and SLA signed.",
      },
      { property: "og:title", content: "BD Proposals & SLAs — Zodiac HR Consultants" },
      {
        property: "og:description",
        content:
          "Staffing and consulting SLA pipeline from new lead and pitch scheduled to proposal sent, SLA negotiation and SLA signed.",
      },
    ],
  }),
  component: DealsPage,
});

function DealsPage() {
  const deals = useQuery(dealsQuery());
  const accounts = useQuery(accountsQuery());
  const contacts = useQuery(contactsQuery());
  const activities = useQuery(activitiesQuery());
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");
  const [owner, setOwner] = useState<OwnerFilterValue>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DealWithRefs | null>(null);
  const [openDeal, setOpenDeal] = useState<DealWithRefs | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragStage, setDragStage] = useState<BdStage | null>(null);
  const [mobileStage, setMobileStage] = useState<BdStage>(BD_STAGES[0]);
  const [note, setNote] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);

  const moveStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: BdStage }) =>
      updateRecord("deals", id, { stage }),
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["deals"] });
      const previous = queryClient.getQueryData<DealWithRefs[]>(["deals"]);
      queryClient.setQueryData<DealWithRefs[]>(["deals"], (current = []) =>
        current.map((deal) => (deal.id === id ? { ...deal, stage } : deal)),
      );
      return { previous };
    },
    onSuccess: () => {
      toast.success("Proposal stage updated");
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["deals"], context.previous);
      toast.error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["deals"] }),
  });

  const logNote = useMutation({
    mutationFn: async (dealId: string) => {
      await createRecord("activities", {
        title: note.slice(0, 80),
        activity_type: "Task",
        status: "Completed",
        notes: note,
        related_to_type: "Proposal",
        related_to_id: dealId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      setNote("");
      toast.success("Note logged");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (deals.data ?? []).filter((deal) => {
      if (!ownerMatches(owner, deal.owner_name)) return false;
      if (!term) return true;
      return [deal.deal_name, deal.accounts?.name, deal.owner_name, deal.stage]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [deals.data, search, owner]);

  const dealActivities = (dealId: string) =>
    (activities.data ?? []).filter(
      (activity) => activity.related_to_type === "Proposal" && activity.related_to_id === dealId,
    );

  const handleBoardDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const board = boardRef.current;
    if (!board) return;
    const bounds = board.getBoundingClientRect();
    const edge = 90;
    if (event.clientX < bounds.left + edge) board.scrollBy({ left: -18, behavior: "auto" });
    if (event.clientX > bounds.right - edge) board.scrollBy({ left: 18, behavior: "auto" });
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <ModuleHeader
        title="BD Proposals & SLAs"
        count={rows.length}
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        availableViews={["kanban", "list"]}
        action={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <OwnerFilter value={owner} onChange={setOwner} />
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" /> New Proposal
            </Button>
          </div>
        }
      />

      <div className="min-w-0 flex-1 p-4 sm:p-5">
        {deals.isLoading ? (
          <EmptyState message="Loading proposals…" />
        ) : view === "list" ? (
          <>
            <div className="space-y-2.5 md:hidden">
              {rows.map((deal) => (
                <article
                  key={deal.id}
                  className="rounded-xl border border-border bg-surface p-3.5 shadow-panel"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenDeal(deal)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-[15px] font-semibold text-foreground">
                        {deal.deal_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {deal.accounts?.name ?? "No client"}
                      </p>
                    </button>
                    <RowActions
                      table="deals"
                      id={deal.id}
                      label="Proposal"
                      onEdit={() => {
                        setEditing(deal);
                        setDialogOpen(true);
                      }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <StatusPill tone={bdTone(deal.stage)}>{bdStageLabel(deal.stage)}</StatusPill>
                    <span className="font-semibold tabular-nums">{currency(deal.amount)}</span>
                  </div>
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    {deal.service_line ?? "No service line"} · closes{" "}
                    {formatDate(deal.closing_date)}
                  </p>
                </article>
              ))}
            </div>
            <div className="crm-table-scroll hidden overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-surface shadow-panel md:block">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5">Proposal</th>
                    <th className="px-3 py-2.5">Client</th>
                    <th className="px-3 py-2.5">Service line</th>
                    <th className="px-3 py-2.5">Contact</th>
                    <th className="px-3 py-2.5">Amount</th>
                    <th className="px-3 py-2.5">Stage</th>
                    <th className="px-3 py-2.5">Closing date</th>
                    <th className="px-3 py-2.5">Owner</th>
                    <th className="w-12 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((deal) => (
                    <tr
                      key={deal.id}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <td
                        className="px-3 py-2.5 font-medium text-foreground"
                        onClick={() => setOpenDeal(deal)}
                      >
                        {deal.deal_name}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {deal.accounts?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {deal.service_line ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {deal.contacts
                          ? fullName(deal.contacts.first_name, deal.contacts.last_name)
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-foreground">
                        {currency(deal.amount)}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill tone={bdTone(deal.stage)}>
                          {bdStageLabel(deal.stage)}
                        </StatusPill>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {formatDate(deal.closing_date)}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {deal.owner_name ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <RowActions
                          table="deals"
                          id={deal.id}
                          label="Proposal"
                          onEdit={() => {
                            setEditing(deal);
                            setDialogOpen(true);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
                {BD_STAGES.map((stage) => {
                  const stageDeals = rows.filter((deal) => deal.stage === stage);
                  return (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => setMobileStage(stage)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                        mobileStage === stage
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-surface text-muted-foreground",
                      )}
                    >
                      {bdStageLabel(stage)}
                      <span className="ml-1.5 opacity-75">{stageDeals.length}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-end justify-between rounded-xl border border-border bg-surface px-4 py-3 shadow-panel">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Selected stage</p>
                  <p className="mt-0.5 text-base font-semibold text-foreground">
                    {bdStageLabel(mobileStage)}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-brand-accent">
                  {currency(
                    rows
                      .filter((deal) => deal.stage === mobileStage)
                      .reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0),
                  )}
                </p>
              </div>

              <div className="space-y-2.5">
                {rows
                  .filter((deal) => deal.stage === mobileStage)
                  .map((deal) => (
                    <article
                      key={deal.id}
                      className="rounded-xl border border-border bg-card p-3.5 shadow-card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setOpenDeal(deal)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-[15px] font-semibold text-foreground">
                            {deal.deal_name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {deal.accounts?.name ?? "No client"}
                          </p>
                        </button>
                        <RowActions
                          table="deals"
                          id={deal.id}
                          label="Proposal"
                          onEdit={() => {
                            setEditing(deal);
                            setDialogOpen(true);
                          }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <StatusPill tone={bdTone(deal.stage)}>
                          {bdStageLabel(deal.stage)}
                        </StatusPill>
                        <span className="font-semibold tabular-nums text-foreground">
                          {currency(deal.amount)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                        <span className="min-w-0 truncate">
                          {deal.service_line ?? "No service line"}
                        </span>
                        <span className="shrink-0">{formatDate(deal.closing_date)}</span>
                      </div>
                    </article>
                  ))}
                {rows.filter((deal) => deal.stage === mobileStage).length === 0 ? (
                  <EmptyState message="No proposals in this stage." />
                ) : null}
              </div>
            </div>

            <div
              ref={boardRef}
              onDragOver={handleBoardDragOver}
              className="hidden scroll-smooth gap-3 overflow-x-auto pb-2 scrollbar-thin md:flex"
            >
              {BD_STAGES.map((stage) => {
                const stageDeals = rows.filter((deal) => deal.stage === stage);
                const total = stageDeals.reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0);
                return (
                  <div
                    key={stage}
                    onDragEnter={() => dragId && setDragStage(stage)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const movingDeal = rows.find((deal) => deal.id === dragId);
                      if (dragId && movingDeal?.stage !== stage)
                        moveStage.mutate({ id: dragId, stage });
                      setDragId(null);
                      setDragStage(null);
                    }}
                    className={cn(
                      "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-surface shadow-card transition-all duration-150",
                      dragId &&
                        dragStage === stage &&
                        "border-brand-accent bg-brand-accent/5 ring-2 ring-brand-accent/20",
                    )}
                  >
                    <div className="border-b border-border px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">
                          {bdStageLabel(stage)}
                        </p>
                        <span className="text-xs text-muted-foreground">{stageDeals.length}</span>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums text-brand-accent">
                        {currency(total)}
                      </p>
                    </div>
                    <div className="flex-1 space-y-2 p-2">
                      {stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", deal.id);
                            setDragId(deal.id);
                            setDragStage(deal.stage as BdStage);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setDragStage(null);
                          }}
                          onClick={() => setOpenDeal(deal)}
                          className={cn(
                            "group cursor-grab rounded-xl border border-border bg-card p-3 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-accent/50 hover:shadow-card-hover active:cursor-grabbing",
                            dragId === deal.id && "scale-[0.98] opacity-40 shadow-none",
                          )}
                        >
                          <div className="flex items-start gap-1.5">
                            <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-brand-accent" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {deal.deal_name}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {deal.accounts?.name ?? "No account"}
                              </p>
                            </div>
                            <div
                              draggable={false}
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <RowActions
                                table="deals"
                                id={deal.id}
                                label="Proposal"
                                onEdit={() => {
                                  setEditing(deal);
                                  setDialogOpen(true);
                                }}
                              />
                            </div>
                          </div>
                          <p className="mt-2 truncate text-xs text-muted-foreground">
                            {deal.service_line ?? "—"}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="font-semibold tabular-nums text-foreground">
                              {currency(deal.amount)}
                            </span>
                            <span className="text-muted-foreground">
                              {formatDate(deal.closing_date)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {stageDeals.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                          Drop proposals here
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Sheet open={Boolean(openDeal)} onOpenChange={(open) => !open && setOpenDeal(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {openDeal ? (
            <>
              <SheetHeader>
                <SheetTitle>{openDeal.deal_name}</SheetTitle>
                <SheetDescription>
                  {openDeal.accounts?.name ?? "No account"} · {currency(openDeal.amount)}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-6">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Detail label="Service line">{openDeal.service_line ?? "—"}</Detail>
                  <Detail label="Stage">
                    <StatusPill tone={bdTone(openDeal.stage)}>
                      {bdStageLabel(openDeal.stage)}
                    </StatusPill>
                  </Detail>
                  <Detail label="Closing date">{formatDate(openDeal.closing_date)}</Detail>
                  <Detail label="Primary contact">
                    {openDeal.contacts
                      ? fullName(openDeal.contacts.first_name, openDeal.contacts.last_name)
                      : "—"}
                  </Detail>
                  <Detail label="Owner">{openDeal.owner_name ?? "—"}</Detail>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Activity & notes
                  </p>
                  <ul className="space-y-2">
                    {dealActivities(openDeal.id).map((activity) => (
                      <li key={activity.id} className="rounded-md border border-border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{activity.title}</p>
                          <StatusPill tone={activityTone(activity.status)}>
                            {activity.status}
                          </StatusPill>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {activity.activity_type} · {formatDateTime(activity.due_date)}
                        </p>
                        {activity.notes ? (
                          <p className="mt-1 text-xs text-muted-foreground">{activity.notes}</p>
                        ) : null}
                      </li>
                    ))}
                    {dealActivities(openDeal.id).length === 0 ? (
                      <li className="text-xs text-muted-foreground">No activity logged yet.</li>
                    ) : null}
                  </ul>
                </div>

                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    value={note}
                    aria-label="Deal note"
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!note.trim() || logNote.isPending}
                    onClick={() => logNote.mutate(openDeal.id)}
                  >
                    Log note
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(openDeal);
                    setOpenDeal(null);
                    setDialogOpen(true);
                  }}
                >
                  Edit proposal
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        table="deals"
        title={editing ? "Edit Proposal" : "New Proposal"}
        fields={dealFields(accounts.data ?? [], contacts.data ?? [])}
        record={editing}
      />
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm text-foreground">{children}</div>
    </div>
  );
}
