import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Plus, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { RecordDialog } from "./record-dialog";
import { activityFields } from "./field-defs";
import { BD_OWNERS } from "./nav-data";
import { activitiesQuery, formatDateTime, type Activity } from "@/lib/crm";

type RepFilter = "all" | (typeof BD_OWNERS)[number];
type TypeFilter = "all" | "vc" | "f2f";

/** Mirrors the POA aggregation heuristic for classifying a meeting as virtual. */
function isVirtual(activity: Activity) {
  const details = (activity.service_details ?? {}) as Record<string, unknown>;
  const mode = String(details["mode"] ?? "").toLowerCase();
  if (mode) return mode.includes("virtual") || mode.includes("vc") || mode.includes("online");
  const text = `${activity.title} ${activity.notes ?? ""}`.toLowerCase();
  return (
    text.includes("virtual") ||
    text.includes("zoom") ||
    text.includes("teams") ||
    text.includes(" vc")
  );
}

function dayLabel(value: string | null) {
  if (!value) return "Unscheduled";
  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function ScheduleDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rep, setRep] = useState<RepFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const activities = useQuery({ ...activitiesQuery(), enabled: open });

  const upcoming = useMemo(() => {
    const cutoff = Date.now() - 3_600_000;
    return (activities.data ?? [])
      .filter((a) => a.activity_type === "Meeting" || a.activity_type === "Interview")
      .filter((a) => a.status !== "Completed")
      .filter((a) => (a.due_date ? new Date(a.due_date).getTime() >= cutoff : false))
      .filter((a) => rep === "all" || a.owner_name === rep)
      .filter((a) => type === "all" || (type === "vc") === isVirtual(a))
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  }, [activities.data, rep, type]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof upcoming>();
    for (const item of upcoming) {
      const key = dayLabel(item.due_date);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [upcoming]);

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active
        ? "border-transparent bg-primary text-primary-foreground"
        : "border-input text-muted-foreground hover:bg-accent",
    );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-brand-accent" />
              Upcoming Schedule
            </SheetTitle>
            <SheetDescription>Client meetings for the BD team.</SheetDescription>
          </SheetHeader>

          <div className="space-y-2 border-b border-border px-5 py-3">
            <div className="flex flex-wrap gap-1.5">
              <button className={chip(rep === "all")} onClick={() => setRep("all")}>
                All reps
              </button>
              {BD_OWNERS.map((owner) => (
                <button key={owner} className={chip(rep === owner)} onClick={() => setRep(owner)}>
                  {owner}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button className={chip(type === "all")} onClick={() => setType("all")}>
                All types
              </button>
              <button className={chip(type === "vc")} onClick={() => setType("vc")}>
                Virtual (VC)
              </button>
              <button className={chip(type === "f2f")} onClick={() => setType("f2f")}>
                In-person (F2F)
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {groups.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No upcoming meetings match these filters.
              </p>
            )}
            {groups.map(([label, items]) => (
              <div key={label}>
                <p className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <ul className="space-y-2">
                  {items.map((item) => {
                    const virtual = isVirtual(item);
                    return (
                      <li
                        key={item.id}
                        className="rounded-lg border border-border bg-surface p-3 shadow-card"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                            {virtual ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(item.due_date)} · {item.owner_name}
                            </p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {virtual ? "VC" : "F2F"}
                          </Badge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-border px-5 py-3">
            <Button className="w-full gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              Add Reminder / Event
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <RecordDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        table="activities"
        title="Add Reminder / Event"
        description="Schedule a follow-up linked to a corporate lead or client."
        fields={activityFields()}
        record={{ related_to_type: "Corporate Lead", activity_type: "Meeting" }}
        invalidateKeys={["activities"]}
      />
    </>
  );
}
