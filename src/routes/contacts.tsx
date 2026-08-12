import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  EmptyState,
  FilterPanel,
  ModuleHeader,
  type ViewMode,
} from "@/components/crm/module-chrome";
import { RecordDialog } from "@/components/crm/record-dialog";
import { RowActions } from "@/components/crm/row-actions";
import { ModuleTabs, type ModuleTab } from "@/components/crm/module-tabs";
import { ApolloProspector } from "@/components/crm/apollo-prospector";
import { accountsQuery, contactsQuery, formatDate, fullName } from "@/lib/crm";
import { contactFields } from "@/components/crm/field-defs";
import { teamMembers } from "@/components/crm/nav-data";
import type { ContactWithAccount } from "@/lib/crm";

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Client Contacts — Zodiac HR Consultants" },
      {
        name: "description",
        content: "Browse, filter, and manage every sales contact with account, owner, and activity detail.",
      },
      { property: "og:title", content: "Client Contacts — Zodiac HR Consultants" },
      {
        property: "og:description",
        content: "Browse, filter, and manage every sales contact with account, owner, and activity detail.",
      },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const contacts = useQuery(contactsQuery());
  const accounts = useQuery(accountsQuery());
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [systemFilter, setSystemFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<ContactWithAccount | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState<ModuleTab>("records");

  const all = contacts.data ?? [];

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((contact) => {
      if (systemFilter === "touched" && !contact.last_activity_date) return false;
      if (systemFilter === "untouched" && contact.last_activity_date) return false;
      if (systemFilter === "mine" && contact.owner_name !== "Alex Morgan") return false;
      if (ownerFilter !== "all" && contact.owner_name !== ownerFilter) return false;
      if (!term) return true;
      return [
        fullName(contact.first_name, contact.last_name),
        contact.email,
        contact.phone,
        contact.accounts?.name,
        contact.title,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [all, search, systemFilter, ownerFilter]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <ModuleTabs value={tab} onChange={setTab} recordsLabel="Client Contacts" />
      {tab === "apollo" ? (
        <ApolloProspector target="contacts" />
      ) : (
      <>
      <ModuleHeader
        title="Client Contacts"
        count={rows.length}
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        availableViews={["list", "tile"]}
        onToggleFilters={() => setShowFilters((prev) => !prev)}
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> Create Contact
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1">
        <FilterPanel
          className={showFilters ? "block w-full lg:w-56" : "hidden lg:block"}
          activeFilter={systemFilter}
          onFilterChange={setSystemFilter}
          systemFilters={[
            { id: "all", label: "All contacts", count: all.length },
            { id: "mine", label: "My contacts", count: all.filter((c) => c.owner_name === "Alex Morgan").length },
            { id: "touched", label: "Touched records", count: all.filter((c) => c.last_activity_date).length },
            { id: "untouched", label: "Untouched records", count: all.filter((c) => !c.last_activity_date).length },
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
                count: all.filter((c) => c.owner_name === member).length,
              })),
            ],
          }}
        />

        <div className={showFilters ? "hidden flex-1 p-4 lg:block sm:p-5" : "min-w-0 flex-1 p-4 sm:p-5"}>
          {contacts.isLoading ? (
            <EmptyState message="Loading contacts…" />
          ) : rows.length === 0 ? (
            <EmptyState message="No contacts match this view." />
          ) : view === "tile" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((contact) => (
                <div
                  key={contact.id}
                  className="rounded-lg border border-border bg-surface p-4 shadow-panel"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {fullName(contact.first_name, contact.last_name)}
                      </p>
                      <p className="text-xs text-muted-foreground">{contact.title ?? "—"}</p>
                    </div>
                    <RowActions
                      table="contacts"
                      id={contact.id}
                      label="Contact"
                      onEdit={() => {
                        setEditing(contact);
                        setDialogOpen(true);
                      }}
                    />
                  </div>
                  <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div>{contact.accounts?.name ?? "No account"}</div>
                    <div>{contact.email ?? "—"}</div>
                    <div>{contact.phone ?? "—"}</div>
                    <div>Last activity {formatDate(contact.last_activity_date)}</div>
                  </dl>
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
                        onCheckedChange={(checked) =>
                          setSelected(checked ? rows.map((row) => row.id) : [])
                        }
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-3 py-2.5">Contact name</th>
                    <th className="px-3 py-2.5">Account name</th>
                    <th className="px-3 py-2.5">Email</th>
                    <th className="px-3 py-2.5">Phone</th>
                    <th className="px-3 py-2.5">Owner</th>
                    <th className="px-3 py-2.5">Last activity</th>
                    <th className="w-12 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((contact) => (
                    <tr key={contact.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={selected.includes(contact.id)}
                          onCheckedChange={(checked) =>
                            setSelected((prev) =>
                              checked ? [...prev, contact.id] : prev.filter((id) => id !== contact.id),
                            )
                          }
                          aria-label={`Select ${contact.last_name}`}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-foreground">
                          {fullName(contact.first_name, contact.last_name)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {contact.title ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {contact.accounts?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{contact.email ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{contact.phone ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{contact.owner_name ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {formatDate(contact.last_activity_date)}
                      </td>
                      <td className="px-3 py-2.5">
                        <RowActions
                          table="contacts"
                          id={contact.id}
                          label="Contact"
                          onEdit={() => {
                            setEditing(contact);
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
      </>
      )}

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        table="contacts"
        title={editing ? "Edit Contact" : "Create Contact"}
        fields={contactFields(accounts.data ?? [])}
        record={editing}
      />
    </div>
  );
}
