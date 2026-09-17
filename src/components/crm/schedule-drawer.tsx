import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckSquare, MapPin, PhoneCall, Plus, Users, Video } from "lucide-react";

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
import { supabase } from "@/integrations/supabase/client";

type RepFilter = "mine" | "all" | (typeof BD_OWNERS)[number];
type TypeFilter = "all" | "task" | "call" | "meeting" | "vc" | "f2f";

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
  if (date.getTime() < today.setHours(0, 0, 0, 0)) return "Overdue";
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
  const [rep, setRep] = useState<RepFilter>("mine");
  const [type, setType] = useState<TypeFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const activities = useQuery({ ...activitiesQuery(), enabled: open });
  const currentMember = useQuery({
    queryKey: ["schedule-current-member"],
    enabled: open,
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError ?? new Error("Not signed in");
      const { data, error } = await supabase
        .from("bd_team_members")
        .select("display_name,access_role")
        .eq("id", auth.user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const upcoming = useMemo(() => {
    return (activities.data ?? [])
      .filter((a) => a.status !== "Completed")
      .filter((a) => Boolean(a.due_date))
      .filter((a) =>
        rep === "mine"
          ? Boolean(currentMember.data?.display_name) &&
            a.owner_name === currentMember.data?.display_name
          : rep === "all" || a.owner_name === rep,
      )
      .filter((a) => {
        if (type === "all") return true;
        if (type === "task") return a.activity_type === "Task";
        if (type === "call") return a.activity_type === "Call";
        if (type === "meeting") return a.activity_type === "Meeting";
        return a.activity_type === "Meeting" && (type === "vc") === isVirtual(a);
      })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  }, [activities.data, currentMember.data?.display_name, rep, type]);

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
              Follow-ups &amp; Schedule
            </SheetTitle>
            <SheetDescription>
              Your pending tasks, calls and meetings in one daily plan.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-2 border-b border-border px-5 py-3">
            <div className="flex flex-wrap gap-1.5">
              <button className={chip(rep === "mine")} onClick={() => setRep("mine")}>
                My follow-ups
              </button>
              {currentMember.data?.access_role === "primary_admin" && (
                <button className={chip(rep === "all")} onClick={() => setRep("all")}>
                  <Users className="mr-1 inline size-3" /> Team schedule
                </button>
              )}
              {currentMember.data?.access_role === "primary_admin" &&
                BD_OWNERS.map((owner) => (
                  <button key={owner} className={chip(rep === owner)} onClick={() => setRep(owner)}>
                    {owner}
                  </button>
                ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button className={chip(type === "all")} onClick={() => setType("all")}>
                All
              </button>
              <button className={chip(type === "task")} onClick={() => setType("task")}>
                Tasks
              </button>
              <button className={chip(type === "call")} onClick={() => setType("call")}>
                Calls
              </button>
              <button className={chip(type === "meeting")} onClick={() => setType("meeting")}>
                Meetings
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
                No pending follow-ups match these filters.
              </p>
            )}
            {groups.map(([label, items]) => (
              <div key={label}>
                <p className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <ul className="space-y-2">
                  {items.map((item) => {
                    const virtual = item.activity_type === "Meeting" && isVirtual(item);
                    const Icon =
                      item.activity_type === "Task"
                        ? CheckSquare
                        : item.activity_type === "Call"
                          ? PhoneCall
                          : virtual
                            ? Video
                            : MapPin;
                    return (
                      <li
                        key={item.id}
                        className="rounded-lg border border-border bg-surface p-3 shadow-card"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                            <Icon className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(item.due_date)} · {item.owner_name}
                            </p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {item.activity_type === "Meeting"
                              ? virtual
                                ? "VC"
                                : "F2F"
                              : item.activity_type}
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
              Add Follow-up
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <RecordDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        table="activities"
        title="Add Follow-up"
        description="Schedule a task, call or meeting linked to a CRM record."
        fields={activityFields()}
        record={{
          related_to_type: "Corporate Lead",
          activity_type: "Task",
          owner_name: currentMember.data?.display_name ?? null,
        }}
        invalidateKeys={["activities"]}
      />
    </>
  );
}
