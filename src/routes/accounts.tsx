import { useCrmIdentity } from "@/components/crm/use-crm-identity";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, RefreshCw, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { EmptyState, ModuleHeader, type ViewMode } from "@/components/crm/module-chrome";
import { RecordDialog } from "@/components/crm/record-dialog";
import { RowActions } from "@/components/crm/row-actions";
import { ClientDetails, ClientActivityStatus } from "@/components/crm/client-details";
import { accountFields, clientCreationFields } from "@/components/crm/field-defs";
import { ownerMatches, useOwnerScope } from "@/components/crm/owner-filter";
import { accountsQuery, contactsQuery, dealsQuery, type Account } from "@/lib/crm";
import {
  clientContractsQuery,
  contractMatchesStatus,
  type ClientStatusFilter,
} from "@/lib/client-contracts";
import { syncCeipalClients } from "@/lib/ceipal.functions";
import { AccountImportDialog } from "@/components/crm/account-import-dialog";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "Clients — Zodiac HR Consultants" },
      {
        name: "description",
        content: "Clients, contract status, terms, contacts and assigned recruiters.",
      },
      { property: "og:title", content: "Clients — Zodiac HR Consultants" },
    ],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useCrmIdentity();
  const runCeipalSync = useServerFn(syncCeipalClients);
  const accounts = useQuery(accountsQuery());
  const contacts = useQuery(contactsQuery());
  const contracts = useQuery(clientContractsQuery());
  const deals = useQuery(dealsQuery());
  const [systemFilter, setSystemFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const { owner } = useOwnerScope();
  const [status, setStatus] = useState<ClientStatusFilter>("all");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const isMobile = useIsMobile();
  const ceipalSync = useMutation({
    mutationFn: () => runCeipalSync(),
    onSuccess: async ({ synced, source }) => {
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(`${synced} clients synced from CEIPAL ${source}.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const contractMap = useMemo(
    () => new Map((contracts.data ?? []).map((c) => [c.account_id, c])),
    [contracts.data],
  );
  const scoped = useMemo(
    () =>
      (accounts.data ?? []).filter((a) =>
        ownerMatches(owner, contractMap.get(a.id)?.owner_name ?? a.owner_name),
      ),
    [accounts.data, owner, contractMap],
  );
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scoped
      .filter((a) => {
        const c = contractMap.get(a.id);
        return (
          contractMatchesStatus(c, status) &&
          (systemFilter !== "with-deals" ||
            (deals.data ?? []).some(
              (deal) => deal.account_id === a.id && !deal.stage.startsWith("Closed"),
            )) &&
          (systemFilter !== "no-contacts" ||
            !(contacts.data ?? []).some((contact) => contact.account_id === a.id)) &&
          (!term ||
            [
              a.name,
              a.industry,
              a.phone,
              a.website,
              c?.recruiter,
              c?.source_organisation,
              c?.source_sector,
              c?.contact_names,
            ].some((value) => value?.toLowerCase().includes(term)))
        );
      })
      .sort(
        (a, b) =>
          Number(Boolean(contractMap.get(b.id))) - Number(Boolean(contractMap.get(a.id))) ||
          a.name.localeCompare(b.name),
      );
  }, [scoped, search, status, contractMap, systemFilter, deals.data, contacts.data]);
  // A selected client disappears immediately when the owner, status or search changes.
  const viewing = rows.find((a) => a.id === viewingId) ?? null;
  const editAccount = (a: Account) => {
    setEditing(a);
    setDialogOpen(true);
  };
  const failed = accounts.isError || contracts.isError;
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <ModuleHeader
        title="Clients"
        count={rows.length}
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        availableViews={["list", "tile"]}
        action={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="size-4" />
              Import Excel
            </Button>
            {isAdmin ? (
              <Button
                size="sm"
                variant="outline"
                disabled={ceipalSync.isPending}
                onClick={() => ceipalSync.mutate()}
              >
                <RefreshCw className={`size-4 ${ceipalSync.isPending ? "animate-spin" : ""}`} />
                {ceipalSync.isPending ? "Syncing…" : "Sync from CEIPAL"}
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Create Client
            </Button>
          </div>
        }
      />
      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <label className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          Additional filter
          <select
            aria-label="Additional client filter"
            className="h-10 rounded-md border border-input bg-surface px-3"
            value={systemFilter}
            onChange={(e) => setSystemFilter(e.target.value)}
          >
            <option value="all">All clients</option>
            <option value="with-deals">With open deals</option>
            <option value="no-contacts">Missing linked contacts</option>
          </select>
        </label>
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Client activity status">
          {(
            [
              ["all", "All clients"],
              ["Active", "Active"],
              ["Non-active", "Non-active"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className={`min-h-10 rounded-full border px-4 py-2 text-sm ${status === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground"}`}
            >
              {label}{" "}
              <span className="ml-2 opacity-75">
                {scoped.filter((a) => contractMatchesStatus(contractMap.get(a.id), value)).length}
              </span>
            </button>
          ))}
        </div>
        {failed ? (
          <div role="alert" className="rounded-lg border border-border bg-surface p-5">
            <p>Client details could not load. Please retry.</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => void Promise.all([accounts.refetch(), contracts.refetch()])}
            >
              Retry
            </Button>
          </div>
        ) : accounts.isLoading || contracts.isLoading ? (
          <EmptyState message="Loading clients…" />
        ) : !rows.length ? (
          <EmptyState message="No clients match this view." />
        ) : (
          <div className={viewing && !isMobile ? "grid min-w-0 gap-4 md:grid-cols-2" : "min-w-0"}>
            <div
              className={
                view === "tile" && !viewing
                  ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                  : "space-y-2"
              }
            >
              {rows.map((a) => {
                const c = contractMap.get(a.id);
                return (
                  <article
                    key={a.id}
                    className={`rounded-xl border bg-surface shadow-panel ${viewing?.id === a.id ? "border-primary ring-1 ring-primary" : "border-border"}`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 p-4 text-left"
                        aria-pressed={viewing?.id === a.id}
                        onClick={() => setViewingId(a.id)}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <span className="break-words text-sm font-semibold">{a.name}</span>
                          <ClientActivityStatus status={c?.activity_status} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {c?.source_sector ?? a.industry ?? "Industry not set"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>BD owner: {c?.owner_name ?? a.owner_name ?? "Not assigned"}</span>
                          {c?.recruiter ? <span>Recruiter: {c.recruiter}</span> : null}
                        </div>
                      </button>
                      <div className="pr-2 pt-3">
                        <RowActions
                          table="accounts"
                          id={a.id}
                          label="Client"
                          onEdit={() => editAccount(a)}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {viewing && !isMobile ? (
              <div className="sticky top-4 max-h-[80vh] min-w-0 self-start overflow-y-auto">
                <ClientDetails
                  key={viewing.id}
                  account={viewing}
                  contract={contractMap.get(viewing.id)}
                  contacts={contacts.data ?? []}
                  onEditAccount={() => editAccount(viewing)}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
      {isMobile ? (
        <Sheet
          open={Boolean(viewing)}
          onOpenChange={(open) => {
            if (!open) setViewingId(null);
          }}
        >
          <SheetContent className="w-full overflow-y-auto">
            <SheetHeader className="mb-3 pr-7">
              <SheetTitle>Client details</SheetTitle>
              <SheetDescription>Overview, contract status and contacts.</SheetDescription>
            </SheetHeader>
            {viewing ? (
              <ClientDetails
                key={viewing.id}
                account={viewing}
                contract={contractMap.get(viewing.id)}
                contacts={contacts.data ?? []}
                onEditAccount={() => editAccount(viewing)}
              />
            ) : null}
          </SheetContent>
        </Sheet>
      ) : null}
      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        table="accounts"
        title={editing ? "Edit Client" : "Create Client"}
        fields={editing ? accountFields : clientCreationFields}
        record={editing}
        invalidateKeys={[
          "accounts",
          "contacts",
          "deals",
          "client-contracts",
          "client-contract-history",
        ]}
      />
      <AccountImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        accounts={accounts.data ?? []}
      />
    </div>
  );
}
