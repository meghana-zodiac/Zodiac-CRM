import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCheck, FileSignature, PhoneCall, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { activitiesQuery, dealsQuery, formatDateTime } from "@/lib/crm";
import { supabase } from "@/integrations/supabase/client";

export type Notification = {
  id: string;
  kind: "lead" | "sla" | "activity";
  title: string;
  detail: string;
  timestamp: string | null;
  tone: "default" | "warning" | "danger";
};

const KIND_META: Record<Notification["kind"], { icon: LucideIcon; label: string }> = {
  lead: { icon: Sparkles, label: "Lead assignment" },
  sla: { icon: FileSignature, label: "SLA reminder" },
  activity: { icon: PhoneCall, label: "Activity alert" },
};

const READ_KEY = "zodiac-crm.read-notifications";
const CLEARED_KEY = "zodiac-crm.cleared-notifications";

function loadIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function daysUntil(date: string | null) {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

/** Derives the live notification feed from leads, proposals and activities. */
export function useNotifications(enabled = true) {
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

  useEffect(() => {
    setRead(loadIds(READ_KEY));
    setCleared(loadIds(CLEARED_KEY));
  }, []);

  const persist = (key: string, ids: string[]) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  };

  const items = useMemo<Notification[]>(() => {
    const out: Notification[] = [];
    const weekAgo = Date.now() - 7 * 86_400_000;

    for (const lead of leads.data ?? []) {
      if (new Date(lead.created_at).getTime() < weekAgo) continue;
      if (lead.status !== "New" && lead.status !== "Contacted") continue;
      out.push({
        id: `lead-${lead.id}`,
        kind: "lead",
        title: `New lead assigned to ${lead.owner_name ?? "the team"}`,
        detail: `${lead.company_name}${lead.service_interest ? ` · ${lead.service_interest}` : ""}`,
        timestamp: lead.created_at,
        tone: "default",
      });
    }

    for (const deal of deals.data ?? []) {
      if (deal.stage === "SLA Signed") continue;
      const left = daysUntil(deal.closing_date);
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
      });
    }

    for (const activity of activities.data ?? []) {
      const left = daysUntil(activity.due_date);
      if (activity.status !== "Completed") {
        if (left === null || left > 1) continue;
        out.push({
          id: `act-${activity.id}`,
          kind: "activity",
          title:
            activity.activity_type === "Call"
              ? left < 0
                ? "Follow-up call overdue"
                : "Follow-up call due"
              : left < 0
                ? `${activity.activity_type} overdue`
                : `${activity.activity_type} due`,
          detail: `${activity.title} · ${activity.owner_name ?? "Unassigned"}`,
          timestamp: activity.due_date,
          tone: left !== null && left < 0 ? "danger" : "warning",
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
        });
      }
    }

    return out
      .filter((item) => !cleared.includes(item.id))
      .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());
  }, [leads.data, deals.data, activities.data, cleared]);

  const unread = items.filter((item) => !read.includes(item.id));

  const markAllRead = useCallback(() => {
    setRead((prev) => {
      const next = [...new Set([...prev, ...items.map((i) => i.id)])];
      persist(READ_KEY, next);
      return next;
    });
  }, [items]);

  const clearAll = useCallback(() => {
    setCleared((prev) => {
      const next = [...new Set([...prev, ...items.map((i) => i.id)])];
      persist(CLEARED_KEY, next);
      return next;
    });
  }, [items]);

  return {
    items,
    unreadIds: unread.map((i) => i.id),
    unreadCount: unread.length,
    markAllRead,
    clearAll,
  };
}

export function NotificationsDrawer({
  open,
  onOpenChange,
  items,
  unreadIds,
  markAllRead,
  clearAll,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Notification[];
  unreadIds: string[];
  markAllRead: () => void;
  clearAll: () => void;
}) {
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
