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
            <>
              <div className="space-y-2.5 md:hidden">
                {visibleRows.map((row) => (
                  <article
                    key={row.id}
                    className="overflow-hidden rounded-xl border border-border bg-surface shadow-panel transition-shadow active:shadow-none"
                  >
                    <div className="flex items-start gap-3 p-3.5">
                      <button
                        type="button"
                        onClick={() => onRowClick?.(row)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="mb-2.5 flex items-start justify-between gap-3">
                          <div className="min-w-0 text-[15px] font-semibold leading-5 text-foreground">
                            {columns[0]?.render(row)}
                          </div>
                        </div>
                        <dl className="grid gap-2">
                          {columns.slice(1, 4).map((column) => (
                            <div
                              key={column.header}
                              className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2"
                            >
                              <dt className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                {column.header}
                              </dt>
                              <dd className="min-w-0 truncate text-sm text-foreground/80">
                                {column.render(row)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </button>
                      <RowActions
                        table={table}
                        id={row.id}
                        label={recordLabel}
                        onEdit={() => openEdit(row)}
                      />
                    </div>
                  </article>
                ))}
              </div>
              <div className="crm-table-scroll hidden overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-surface shadow-panel md:block">
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
            </>
          )}

          {!isLoading && filtered.length > ROWS_PER_PAGE ? (
            <div className="mt-3 flex flex-col items-stretch gap-3 rounded-lg border border-border bg-surface px-3 py-2 shadow-panel sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * ROWS_PER_PAGE + 1}–
                {Math.min(page * ROWS_PER_PAGE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="size-4" /> Previous
                </Button>
                <span className="min-w-20 text-center text-xs font-medium tabular-nums">
                  {page} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                >
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        table={table}
        title={editing ? `Edit ${recordLabel}` : createLabel}
        fields={fields}
        record={editing as Record<string, unknown> | null}
      />
    </div>
  );
}
