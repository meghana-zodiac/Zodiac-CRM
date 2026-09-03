import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, FilterPanel, ModuleHeader, type ViewMode } from "./module-chrome";
import { RecordDialog, type FieldDef } from "./record-dialog";
import { RowActions } from "./row-actions";
import { OwnerFilter, ownerMatches, type OwnerFilterValue } from "./owner-filter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CrmTable } from "@/lib/crm";

export type Column<T> = {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

const ROWS_PER_PAGE = 100;

export function ListModule<T extends { id: string }>({
  title,
  createLabel,
  recordLabel,
  table,
  fields,
  rows,
  isLoading,
  columns,
  minWidth = 900,
  searchValues,
  filterAllLabel,
  filterOptions,
  filterValue,
  tile,
  onRowClick,
  ownerOf,
  headerAction,
  filterPlacement = "sidebar",
}: {
  title: string;
  createLabel: string;
  recordLabel: string;
  table: CrmTable;
  fields: FieldDef[];
  rows: T[];
  isLoading: boolean;
  columns: Column<T>[];
  minWidth?: number;
  searchValues: (row: T) => (string | number | null | undefined)[];
  filterAllLabel?: string;
  filterOptions?: readonly string[];
  filterValue?: (row: T) => string;
  tile?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  ownerOf?: (row: T) => string | null | undefined;
  headerAction?: React.ReactNode;
  filterPlacement?: "sidebar" | "toolbar";
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [filter, setFilter] = useState("all");
  const [owner, setOwner] = useState<OwnerFilterValue>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && filterValue && filterValue(row) !== filter) return false;
      if (ownerOf && !ownerMatches(owner, ownerOf(row))) return false;
      if (!term) return true;
      return searchValues(row)
        .filter((value) => value !== null && value !== undefined && value !== "")
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [rows, deferredSearch, filter, filterValue, searchValues, owner, ownerOf]);
  const availableFilterOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...(filterOptions ?? []),
          ...(filterValue ? rows.map((row) => filterValue(row)).filter(Boolean) : []),
        ]),
      ),
    [filterOptions, filterValue, rows],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const visibleRows = useMemo(
    () => filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE),
    [filtered, page],
  );

  useEffect(() => {
    setPage(1);
  }, [search, filter, owner, view]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (row: T) => {
    setEditing(row);
    setDialogOpen(true);
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <ModuleHeader
        title={title}
        count={filtered.length}
        search={search}
        onSearchChange={setSearch}
        {...(tile
          ? {
              view,
              onViewChange: setView,
              availableViews: ["list", "tile"] as ViewMode[],
            }
          : {})}

        {...(filterPlacement === "sidebar"
          ? { onToggleFilters: () => setShowFilters((prev) => !prev) }
          : {})}
        action={
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
            {ownerOf ? <OwnerFilter value={owner} onChange={setOwner} /> : null}
            {headerAction}
            <Button size="sm" className="ml-auto sm:ml-0" onClick={openCreate}>
              <Plus className="size-4" /> {createLabel}
            </Button>
          </div>
        }
      />

      {filterPlacement === "toolbar" && filterOptions && filterValue ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full bg-surface sm:w-[210px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {filterAllLabel ?? `All ${title.toLowerCase()}`} ({rows.length})
              </SelectItem>
              {availableFilterOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option} ({rows.filter((row) => filterValue(row) === option).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {filterPlacement === "sidebar" && filterOptions && filterValue ? (
          <FilterPanel
            className={showFilters ? "block w-full lg:w-56" : "hidden lg:block"}
            activeFilter={filter}
            onFilterChange={setFilter}
            systemFilters={[
              {
                id: "all",
                label: filterAllLabel ?? `All ${title.toLowerCase()}`,
                count: rows.length,
              },
              ...availableFilterOptions.map((option) => ({
                id: option,
                label: option,
                count: rows.filter((row) => filterValue(row) === option).length,
              })),
            ]}
          />
        ) : null}

        <div
          className={
            filterPlacement === "sidebar" && filterOptions && showFilters
              ? "hidden flex-1 p-4 sm:p-5 lg:block"
              : "min-w-0 flex-1 p-4 sm:p-5"
          }
        >
          {isLoading ? (
            <EmptyState message={`Loading ${title.toLowerCase()}…`} />
          ) : filtered.length === 0 ? (
            <EmptyState message={`No ${title.toLowerCase()} match this view.`} />
          ) : tile && view === "tile" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-border bg-surface p-4 shadow-panel"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={onRowClick ? "min-w-0 flex-1 cursor-pointer" : "min-w-0 flex-1"}
                      onClick={() => onRowClick?.(row)}
                    >
                      {tile(row)}
                    </div>
                    <RowActions
                      table={table}
                      id={row.id}
                      label={recordLabel}
                      onEdit={() => openEdit(row)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="crm-table-scroll overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-surface shadow-panel">
              <table className="w-full text-sm" style={{ minWidth }}>
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {columns.map((column) => (
                      <th key={column.header} className="px-3 py-2.5">
                        {column.header}
                      </th>
                    ))}
                    <th className="w-12 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleRows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        onRowClick
                          ? "cursor-pointer transition-colors hover:bg-muted/40"
                          : "transition-colors hover:bg-muted/40"
                      }
                    >
                      {columns.map((column) => (
                        <td
                          key={column.header}
                          className={column.className ?? "px-3 py-2.5 text-muted-foreground"}
                          onClick={() => onRowClick?.(row)}
                        >
                          {column.render(row)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5">
                        <RowActions
                          table={table}
                          id={row.id}
                          label={recordLabel}
                          onEdit={() => openEdit(row)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && filtered.length > ROWS_PER_PAGE ? (
            <div className="mt-3 flex flex-col items-stretch gap-3 rounded-lg border border-border bg-surface px-3 py-2 shadow-panel sm:flex-row sm:items-center sm:justify-between">
      ㍹��$z{-���jםeps
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
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="size-4" /> Import Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={ceipalSync.isPending}
              onClick={() => ceipalSync.mutate()}
            >
              <RefreshCw className={`size-4 ${ceipalSync.isPending ? "animate-spin" : ""}`} />
              {ceipalSync.isPending ? "Syncing…" : "Sync from CEIPAL"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" /> Create Account
            </Button>
          </div>
        }
      />

      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Filter
          </span>
          <Select value={systemFilter} onValueChange={setSystemFilter}>
            <SelectTrigger className="w-full bg-surface sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts ({all.length})</SelectItem>
              <SelectItem value="with-deals">With open deals</SelectItem>
              <SelectItem value="no-contacts">Missing contacts</SelectItem>
            </SelectContent>
          </Select>

          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-full bg-surface sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any owner</SelectItem>
              {ownerOptions.map((owner) => (
                <SelectItem key={owner} value={owner}>
                  {owner} ({all.filter((account) => account.owner_name === owner).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {accounts.isLoading ? (
          <EmptyState message="Loading accounts…" />
        ) : rows.length === 0 ? (
          <EmptyState message="No accounts match this view." />
        ) : view === "tile" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((account) => (
              <div
                key={account.id}
                className="rounded-lg border border-border bg-surface p-4 shadow-panel"
              >
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
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => setOpportunityAccount(account)}
                >
                  <Handshake className="size-4" /> Create Opportunity
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="crm-table-scroll overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-surface shadow-panel">
            <table className="w-full min-w-[1180px] table-fixed text-sm">
              <colgroup>
                <col className="w-[3%]" />
                <col className="w-[13%]" />
                <col className="w-[12%]" />
                <col className="w-[21%]" />
                <col className="w-[9%]" />
                <col className="w-[6%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[3%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox
                      checked={selected.length > 0 && selected.length === rows.length}
                      onCheckedChange={(checked) =>
                        setSelected(checked ? rows.map((r) => r.id) : [])
                      }
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
                  <th className="px-3 py-2.5">Opportunity</th>
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
                            checked
                              ? [...prev, account.id]
                              : prev.filter((id) => id !== account.id),
                          )
                        }
                        aria-label={`Select ${account.name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{account.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{account.industry ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      <span className="block truncate" title={account.website ?? undefined}>
                        {account.website ?? "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {account.phone ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                      {contactCount(account.id)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-foreground">
                      {currency(pipeline(account.id))}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {account.owner_name ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatDate(account.created_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpportunityAccount(account)}
                      >
                        <Handshake className="size-4" /> Create
                      </Button>
                    </td>
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

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        table="accounts"
        title={editing ? "Edit Client" : "Create Client"}
        fields={accountFields}
        record={editing}
        invalidateKeys={["accounts", "contacts", "deals"]}
      />
      <AccountImportDialog open={importOpen} onOpenChange={setImportOpen} accounts={all} />
      <RecordDialog
        open={Boolean(opportunityAccount)}
        onOpenChange={(open) => !open && setOpportunityAccount(null)}
        table="deals"
        title="Create Opportunity"
        description="The corporate client, primary contact and owner are prefilled. Add the commercial details to place it in New Opportunity."
        fields={dealFields(all, contacts.data ?? [])}
        record={opportunityPrefill}
        invalidateKeys={["deals"]}
      />
    </div>
  );
}
