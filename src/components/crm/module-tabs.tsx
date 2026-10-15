import { cn } from "@/lib/utils";

export type ModuleTab = "records" | "ceipal" | "apollo";

export function ModuleTabs({
  value,
  onChange,
  recordsLabel,
  tabs: suppliedTabs,
}: {
  value: ModuleTab;
  onChange: (value: ModuleTab) => void;
  recordsLabel: string;
  tabs?: { id: ModuleTab; label: string }[];
}) {
  const tabs =
    suppliedTabs ??
    ([
      { id: "records", label: recordsLabel },
      { id: "apollo", label: "Find Contacts via Apollo" },
    ] satisfies { id: ModuleTab; label: string }[]);

  return (
    <div className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain border-b border-border bg-surface px-3 pt-2 sm:px-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-t-lg px-3 py-2 text-sm font-medium transition-colors",
            value === tab.id
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
