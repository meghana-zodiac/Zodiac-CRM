import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { bdTeamMembersQuery } from "@/lib/poa";
import { cn } from "@/lib/utils";
import { BD_OWNERS } from "./nav-data";

export type OwnerFilterValue = "all" | string;
type OwnerScopeValue = { owner: OwnerFilterValue; setOwner: (owner: OwnerFilterValue) => void };
const OwnerScopeContext = createContext<OwnerScopeValue | null>(null);
const OWNER_STORAGE_KEY = "zodiac-crm-owner-filter";

export function OwnerScopeProvider({ children }: { children: React.ReactNode }) {
  const [owner, setOwnerState] = useState<OwnerFilterValue>("all");
  useEffect(() => {
    const saved = window.localStorage.getItem(OWNER_STORAGE_KEY);
    if (saved) setOwnerState(saved);
  }, []);
  const value = useMemo(
    () => ({
      owner,
      setOwner: (next: OwnerFilterValue) => {
        setOwnerState(next);
        window.localStorage.setItem(OWNER_STORAGE_KEY, next);
      },
    }),
    [owner],
  );
  return <OwnerScopeContext.Provider value={value}>{children}</OwnerScopeContext.Provider>;
}

export function useOwnerScope() {
  const context = useContext(OwnerScopeContext);
  if (!context) throw new Error("useOwnerScope must be used within OwnerScopeProvider");
  return context;
}

export function GlobalOwnerTabs() {
  const { owner, setOwner } = useOwnerScope();
  const members = useQuery(bdTeamMembersQuery());
  const names = useMemo(
    () =>
      (members.data ?? [])
        .filter((member) => member.active && member.access_status === "approved")
        .map((member) => member.display_name),
    [members.data],
  );
  const options: OwnerFilterValue[] = ["all", ...names];

  useEffect(() => {
    if (!members.isLoading && owner !== "all" && !names.includes(owner)) setOwner("all");
  }, [members.isLoading, names, owner, setOwner]);

  return (
    <nav
      aria-label="Filter CRM by BD member"
      className="border-b border-border bg-surface px-2 py-2 sm:px-5"
    >
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg border border-input bg-muted/40 p-1 scrollbar-thin">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setOwner(option)}
            aria-pressed={owner === option}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              owner === option
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            {option === "all" ? "All Members" : option}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function ownerMatches(filter: OwnerFilterValue, owner: string | null | undefined) {
  if (filter === "all") return true;
  return (owner ?? "").trim().toLowerCase() === filter.toLowerCase();
}

export function OwnerFilter({
  value,
  onChange,
  label = "Owner",
  className,
  allowAll = true,
}: {
  value: OwnerFilterValue;
  onChange: (value: OwnerFilterValue) => void;
  label?: string;
  className?: string;
  allowAll?: boolean;
}) {
  const options: OwnerFilterValue[] = allowAll ? ["all", ...BD_OWNERS] : [...BD_OWNERS];
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="hidden text-xs font-medium text-muted-foreground sm:inline">{label}</span>
      <div className="flex items-center rounded-md border border-input bg-background p-0.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
              value === option
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option === "all" ? "All" : option}
          </button>
        ))}
      </div>
    </div>
  );
}
