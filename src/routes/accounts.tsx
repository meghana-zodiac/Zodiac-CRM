import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, FilterPanel, ModuleHeader, type ViewMode } from "@/components/crm/module-chrome";
import { RecordDialog } from "@/components/crm/record-dialog";
import { RowActions } from "@/components/crm/row-actions";
import { accountFields } from "@/components/crm/field-defs";
import { teamMembers } from "@/components/crm/nav-data";
import { accountsQuery, contactsQuery, currency, dealsQuery, formatDate } from "@/lib/crm";
import type { Account } from "@/lib/crm";

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "Corporate Clients — Zodiac HR Consultants" },
      {
        name: "description",
        content: "Company records with industry, contacts, open pipeline value, and record owner.",
      },
      { property: "og:title", content: "Corporate Clients — Zodiac HR Consultants" },
      {
        property: "og:description",
        content: "Company records with industry, contacts, open pipeline value, and record owner.",
      },
    ],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const accounts = useQuery(accountsQuery());
  const contacts = useQuery(contactsQuery());
  const deals = useQuery(dealsQuery());
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [systemFilter, setSystemFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Account | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const all = accounts.data ?? [];
  const contactCount = (accountId: string) =>
    (contacts.data ?? []).filter((contact) => contact.account_id === accountId).length;
  const pipeline = (accountId: string) =>
    (deals.data ?? [])
      .filter((deal) => deal.account_id === accountId && !deal.stage.startsWith("Closed"))
      .reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((account) => {
      if (ownerFilter !== "all" && account.owner_name !== ownerFilter) return false;
      if (systemFilter === "with-deals" && pipeline(account.id) === 0) return false;
      if (systemFilter === "no-contacts" && contactCount(account.id) > 0) return false;
      if (!term) return true;
      return [account.name, account.industry, account.website, account.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, search, ownerFilter, systemFilter, contacts.data, deals.data]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <ModuleHeader
        title="Corporate Clients"
        count={rows.length}
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        availableViews={["list", "tile"]}
        onToggleFilters={() => setShowFilters((prev) => !prev)}
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" /> Create Account
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1">
        <FilterPanel
          className={showFilters ? "block w-full lg:w-56" : "hidden lg:block"}
          activeFilter={systemFilter}
          onFilterChange={setSystemFilter}
          systemFilters={[
            { id: "all", label: "All accounts", count: all.length },
            { id: "with-deals", label: "With open deals" },
            { id: "no-contacts", label: "Missing contacts" },
          ]}
          fieldFilters={{
            label: "owner",
            active: ownerFilter,
            onChange: setOwnerFilter,
            options: [
              { id: "all", label: "Any owner" },
              ...teamMembers.map((member) => ({
                id: member,
                label: member,
                count: all.filter((a) => a.owner_name === member).length,
              })),
            ],
          }}
        />

        <div className={showFilters ? "hidden flex-1 p-4 lg:block sm:p-5" : "min-w-0 flex-1 p-4 sm:p-5"}>
          {accounts.isLoading ? (
            <EmptyState message="Loading accounts…" />
          ) : rows.length === 0 ? (
            <EmptyState message="No accounts match this view." />
          ) : view === "tile" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((account) => (
                <div key={account.id} className="rounded-lg border border-border bg-surface p-4 shadow-panel">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{account.name}</p>
                      <p className="text-xs text-muted-foreground">{account.industry ?? "—"}</p>
                    </div>
                    <RowActions
                      table="accounts"
                      id={account.id}
                      label="Client"
                      onEdit={() => {
                        setEditing(account);
                        setDialogOpen(true);
                      }}
                    />
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <Globe className="size-3.5" /> {account.website ?? "—"}
                    </p>
                    <p>{account.phone ?? "—"}</p>
                    <p>
                      {contactCount(account.id)} contacts · {currency(pipeline(account.id))} open
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-panel">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="w-10 px-3 py-2.5">
                      <Checkbox
                        checked={selected.length > 0 && selected.length === rows.length}
                        onCheckedChange={(checked) => setSelected(checked ? rows.map((r) => r.id) : [])}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-3 py-2.5">Account name</th>
                    <th className="px-3 py-2.5">Industry</th>
                    <th className="px-3 py-2.5">Website</th>
                    <th className="px-3 py-2.5">Phone</th>
                    <th className="px-3 py-2.5">Contacts</th>
                    <th className="px-3 py-2.5">Open pipeline</th>
                    <th className="px-3 py-2.5">Owner</th>
                    <th className="px-3 py-2.5">Created</th>
                    <th className="w-12 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((account) => (
                    <tr key={account.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={selected.includes(account.id)}
                          onCheckedChange={(checked) =>
                            setSelected((prev) =>
                              checked ? [...prev, account.id] : prev.filter((id) => id !== account.id),
                            )
                          }
                          aria-label={`Select ${account.name}`}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{account.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{account.industry ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{account.website ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{account.phone ?? "—"}</td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                        {contactCount(account.id)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-foreground">
                        {currency(pipeline(account.id))}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{account.owner_name ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatDate(account.created_at)}</td>
                      <td className="px-3 py-2.5">
                        <RowActions
                          table="accounts"
                          id={account.id}
                          label="Client"
                          onEdit={() => {
                            setEditing(account);
                            setDialogOpen(true);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        table="accounts"
        title={editing ? "Edit Client" : "Create Client"}
        fields={accountFields}
        record={editing}
        invalidateKeys={["accounts", "contacts", "deals"]}
      />
    </div>
  );
}
