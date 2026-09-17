import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock3,
  Eye,
  FileSignature,
  PhoneCall,
  Sparkles,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { activitiesQuery, dealsQuery, formatDateTime, updateRecord } from "@/lib/crm";
import { supabase } from "@/integrations/supabase/client";

export type Notification = {
  id: string;
  kind: "lead" | "sla" | "activity";
  title: string;
  detail: string;
  timestamp: string | null;
  tone: "default" | "warning" | "danger";
  href: "/leads" | "/deals" | "/tasks" | "/calls" | "/meetings";
  activityId?: string;
  serviceDetails?: Record<string, unknown>;
};

const KIND_META: Record<Notification["kind"], { icon: LucideIcon; label: string }> = {
  lead: { icon: Sparkles, label: "Lead assignment" },
  sla: { icon: FileSignature, label: "SLA reminder" },
  activity: { icon: PhoneCall, label: "Activity alert" },
};

const READ_KEY = "zodiac-crm.read-notifications.v2";
const CLEARED_KEY = "zodiac-crm.cleared-notifications.v2";

function accountKey(base: string, userId: string | undefined) {
  return `${base}.${userId ?? "signed-out"}`;
}

function loadIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function daysUntil(date: string | null, now: number) {
  if (!date) return null;
  const diff = new Date(date).getTime() - now;
  return Math.ceil(diff / 86_400_000);
}

function activityHref(type: string): Notification["href"] {
  if (type === "Call") return "/calls";
  if (type === "Meeting") return "/meetings";
  return "/tasks";
}

/** Derives the live notification feed from leads, proposals and activities. */
export function useNotifications(enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  const currentMember = useQuery({
    queryKey: ["notification-current-member"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError ?? new Error("Not signed in");
      const { data, error } = await supabase
        .from("bd_team_members")
        .select("display_name,access_role,access_status,active")
        .eq("id", auth.user.id)
        .single();
      if (error) throw error;
      return {
        userId: auth.user.id,
        displayName: data.display_name,
        isAdmin:
          data.access_role === "primary_admin" && data.access_status === "approved" && data.active,
      };
    },
  });
  const leads = useQuery({
    queryKey: ["notifications", "recent-leads"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("leads")
        .select("id, company_name, service_interest, owner_name, status, created_at")
        .in("status", ["New", "Contacted"])
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const deals = useQuery({ ...dealsQuery(), enabled });
  const activities = useQuery({ ...activitiesQuery(), enabled });

  const [read, setRead] = useState<string[]>([]);
  const [cleared, setCleared] = useState<string[]>([]);

  const readKey = accountKey(READ_KEY, currentMember.data?.userId);
  const clearedKey = accountKey(CLEARED_KEY, currentMember.data?.userId);

  useEffect(() => {
    if (!currentMember.data?.userId) return;
    setRead(loadIds(readKey));
    setCleared(loadIds(clearedKey));
  }, [currentMember.data?.userId, readKey, clearedKey]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  const persist = (key: string, ids: string[]) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  };

  const items = useMemo<Notification[]>(() => {
    const owner = currentMember.data?.displayName;
    if (!owner) return [];
    const showAllOwners = currentMember.data?.isAdmin === true;
    const out: Notification[] = [];
    const weekAgo = Date.now() - 7 * 86_400_000;

    for (const lead of leads.data ?? []) {
      if (!showAllOwners && lead.owner_name !== owner) continue;
      if (new Date(lead.created_at).getTime() < weekAgo) continue;
      if (lead.status !== "New" && lead.status !== "Contacted") continue;
      out.push({
        id: `lead-${lead.id}`,
        kind: "lead",
        title: `New lead assigned to ${lead.owner_name ?? "the team"}`,
        detail: `${lead.company_name}${lead.service_interest ? ` · ${lead.service_interest}` : ""}`,
        timestamp: lead.created_at,
        tone: "default",
        href: "/leads",
      });
    }

    for (const deal of deals.data ?? []) {
      if (!showAllOwners && deal.owner_name !== owner) continue;
      if (deal.stage === "SLA Signed") continue;
      const left = daysUntil(deal.closing_date, now);
      if (left === null || left > 7) continue;
      out.push({
        id: `sla-${deal.id}`,
        kind: "sla",
        title:
          left < 0
            ? `SLA deadline overdue by ${Math.abs(left)}d`
            : left === 0
              ? "SLA deadline is today"
              : `SLA deadline in ${left}d`,
        detail: `${deal.deal_name} · ${deal.stage}${deal.service_line ? ` · ${deal.service_line}` : ""}`,
        timestamp: deal.closing_date,
        tone: left <= 0 ? "danger" : "warning",
        href: "/deals",
      });
    }

    for (const activity of activities.data ?? []) {
      if (!showAllOwners && activity.owner_name !== owner) continue;
      if (activity.status !== "Completed") {
        const serviceDetails =
          activity.service_details && typeof activity.service_details === "object"
            ? (activity.service_details as Record<string, unknown>)
            : {};
        const snoozedUntil =
          typeof serviceDetails.notification_snoozed_until === "string"
            ? serviceDetails.notification_snoozed_until
            : null;
        if (snoozedUntil && new Date(snoozedUntil).getTime() > now) continue;
        const dueTime = activity.due_date ? new Date(activity.due_date).getTime() : null;
        const reminderTime = activity.reminder_at ? new Date(activity.reminder_at).getTime() : null;
        const overdue = dueTime !== null && dueTime < now;
        const meetingSoon =
          activity.activity_type === "Meeting" &&
          dueTime !== null &&
          dueTime >= now &&
          dueTime - now <= 30 * 60_000;
        const reminderReached =
          reminderTime !== null && reminderTime <= now && (dueTime === null || now <= dueTime);
        const dueNow = dueTime !== null && dueTime <= now;
        if (!overdue && !meetingSoon && !reminderReached && !dueNow) continue;

        const phase = overdue
          ? "overdue"
          : meetingSoon
            ? "soon"
            : reminderReached
              ? "reminder"
              : "due";
        const notificationDate = activity.reminder_at ?? activity.due_date;
        const minutesToMeeting =
          dueTime === null ? null : Math.max(0, Math.ceil((dueTime - now) / 60_000));
        out.push({
          id: `act-${activity.id}-${phase}-${snoozedUntil ?? notificationDate ?? "unscheduled"}`,
          kind: "activity",
          title: overdue
            ? `${activity.activity_type} overdue`
            : meetingSoon
              ? minutesToMeeting === 0
                ? "Meeting starting now"
                : `Meeting starts in ${minutesToMeeting} min`
              : reminderReached
                ? `Reminder: ${activity.title}`
                : `${activity.activity_type} due now`,
          detail: `${activity.title} · ${activity.owner_name ?? "Unassigned"}`,
          timestamp: notificationDate,
          tone: overdue ? "danger" : "warning",
          href: activityHref(activity.activity_type),
          activityId: activity.id,
          serviceDetails,
        });
      } else if (
        activity.activity_type === "Meeting" &&
        activity.due_date &&
        new Date(activity.due_date).getTime() >= weekAgo
      ) {
        out.push({
          id: `act-${activity.id}`,
          kind: "activity",
          title: "Meeting logged",
          detail: `${activity.title} · ${activity.owner_name ?? "Unassigned"}`,
          timestamp: activity.due_date,
          tone: "default",
          href: "/meetings",
          activityId: activity.id,
        });
      }
    }

    return out
      .filter((item) => !cleared.includes(item.id))
      .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());
  }, [leads.data, deals.data, activities.data, cleared, currentMember.data, now]);

  const unread = items.filter((item) => !read.includes(item.id));

  const markAllRead = useCallback(() => {
    setRead((prev) => {
      const next = [...new Set([...prev, ...items.map((i) => i.id)])];
      persist(readKey, next);
      return next;
    });
  }, [items, readKey]);

  const clearAll = useCallback(() => {
    setCleared((prev) => {
      const next = [...new Set([...prev, ...items.map((i) => i.id)])];
      persist(clearedKey, next);
      return next;
    });
  }, [items, clearedKey]);

  const dismiss = useCallback(
    (id: string) => {
      setCleared((prev) => {
        const next = [...new Set([...prev, id])];
        persist(clearedKey, next);
        return next;
      });
    },
    [clearedKey],
  );

  return {
    items,
    unreadIds: unread.map((i) => i.id),
    unreadCount: unread.length,
    markAllRead,
    clearAll,
    dismiss,
  };
}

export function NotificationsDrawer({
  open,
  onOpenChange,
  items,
  unreadIds,
  markAllRead,
  clearAll,
  dismiss,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Notification[];
  unreadIds: string[];
  markAllRead: () => void;
  clearAll: () => void;
  dismiss: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const completeActivity = useMutation({
    mutationFn: (id: string) =>
      updateRecord("activities", id, {
        status: "Completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Follow-up marked complete");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const snoozeActivity = useMutation({
    mutationFn: (item: Notification) =>
      updateRecord("activities", item.activityId!, {
        service_details: {
          ...(item.serviceDetails ?? {}),
          notification_snoozed_until: new Date(Date.now() + 15 * 60_000).toISOString(),
        },
        updated_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Reminder snoozed for 15 minutes");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4 text-brand-accent" />
            Notifications
            {unreadIds.length > 0 && (
              <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                {unreadIds.length} new
              </span>
            )}
          </SheetTitle>
          <SheetDescription>Lead assignments, SLA deadlines and activity alerts.</SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 border-b border-border px-5 py-2.5">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={markAllRead}>
            <CheckCheck className="size-4" />
            Mark all as read
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            onClick={clearAll}
          >
            Clear all
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const meta = KIND_META[item.kind];
                const unread = unreadIds.includes(item.id);
                return (
                  <li
                    key={item.id}
                    className={cn("flex gap-3 px-5 py-3", unread && "bg-accent/40")}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-7 shrink-0 place-items-center rounded-md",
                        item.tone === "danger"
                          ? "bg-destructive/10 text-destructive"
                          : item.tone === "warning"
                            ? "bg-warning/15 text-warning-foreground"
                            : "bg-accent text-accent-foreground",
                      )}
                    >
                      {item.tone === "danger" ? (
                        <AlertTriangle className="size-3.5" />
                      ) : (
                        <meta.icon className="size-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                      <p className="pt-0.5 text-[11px] text-muted-foreground">
                        {meta.label} · {formatDateTime(item.timestamp)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 px-2 text-[11px]"
                          asChild
                        >
                          <Link to={item.href} onClick={() => onOpenChange(false)}>
                            <Eye className="size-3" /> Open
                          </Link>
                        </Button>
                        {item.activityId && item.title !== "Meeting logged" ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 px-2 text-[11px]"
                              disabled={completeActivity.isPending}
                              onClick={() => completeActivity.mutate(item.activityId!)}
                            >
                              <CheckCheck className="size-3" /> Complete
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 px-2 text-[11px]"
                              disabled={snoozeActivity.isPending}
                              onClick={() => snoozeActivity.mutate(item)}
                            >
                              <Clock3 className="size-3" /> Snooze 15m
                            </Button>
                          </>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
                          onClick={() => dismiss(item.id)}
                        >
                          <X className="size-3" /> Dismiss
                        </Button>
                      </div>
                    </div>
                    {unread && (
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-destructive" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
