import { cn } from "@/lib/utils";
import { BD_OWNERS } from "./nav-data";

export type OwnerFilterValue = "all" | string;

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
