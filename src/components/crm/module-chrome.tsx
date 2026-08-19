import { LayoutGrid, List, Rows3, Table2, Search, SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ViewMode = "list" | "kanban" | "sheet" | "tile";

const viewIcons: { mode: ViewMode; icon: typeof List; label: string }[] = [
  { mode: "list", icon: List, label: "List view" },
  { mode: "kanban", icon: LayoutGrid, label: "Kanban view" },
  { mode: "sheet", icon: Table2, label: "Sheet view" },
  { mode: "tile", icon: Rows3, label: "Tile view" },
];

export function ModuleHeader({
  title,
  count,
  search,
  onSearchChange,
  view,
  onViewChange,
  availableViews,
  action,
  onToggleFilters,
}: {
  title: string;
  count: number;
  search: string;
  onSearchChange: (value: string) => void;
  view?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  availableViews?: ViewMode[];
  action?: React.ReactNode;
  onToggleFilters?: () => void;
}) {
  const views = availableViews ?? ["list", "tile"];

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
      <div className="flex items-baseline gap-2">
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        <span className="text-xs text-muted-foreground">{count} records</span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="lg:hidden" onClick={onToggleFilters}>
          <SlidersHorizontal className="size-4" />
          Filters
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label={`Search ${title}`}
            className="h-9 w-44 pl-8 sm:w-56"
          />
        </div>
        {onViewChange && view ? (
          <div className="flex items-center rounded-md border border-input bg-background p-0.5">
            {viewIcons
              .filter((entry) => views.includes(entry.mode))
              .map((entry) => (
                <button
                  key={entry.mode}
                  title={entry.label}
                  aria-label={entry.label}
                  onClick={() => onViewChange(entry.mode)}
                  className={cn(
                    "grid size-8 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground",
                    view === entry.mode && "bg-accent text-accent-foreground",
                  )}
                >
                  <entry.icon className="size-4" />
                </button>
              ))}
          </div>
        ) : null}
        {action}
      </div>
    </div>
  );
}

export type FilterOption = { id: string; label: string; count?: number };

export function FilterPanel({
  systemFilters,
  activeFilter,
  onFilterChange,
  fieldFilters,
  className,
}: {
  systemFilters: FilterOption[];
  activeFilter: string;
  onFilterChange: (id: string) => void;
  fieldFilters?: {
    label: string;
    options: FilterOption[];
    active: string;
    onChange: (id: string) => void;
  };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-56 shrink-0 space-y-6 border-r border-border bg-surface px-4 py-5",
        className,
      )}
    >
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          System defined filters
        </p>
        <ul className="space-y-0.5">
          {systemFilters.map((filter) => (
            <li key={filter.id}>
              <button
                onClick={() => onFilterChange(filter.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  activeFilter === filter.id && "bg-accent font-medium text-accent-foreground",
                )}
              >
                <span className="truncate">{filter.label}</span>
                {filter.count !== undefined ? (
                  <span className="text-xs tabular-nums opacity-70">{filter.count}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {fieldFilters ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Filter by {fieldFilters.label}
          </p>
          <ul className="space-y-0.5">
            {fieldFilters.options.map((option) => (
              <li key={option.id}>
                <button
                  onClick={() => fieldFilters.onChange(option.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    fieldFilters.active === option.id &&
                      "bg-accent font-medium text-accent-foreground",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.count !== undefined ? (
                    <span className="text-xs tabular-nums opacity-70">{option.count}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-border bg-surface py-16 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
