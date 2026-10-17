import { timingSafeEqual } from "node:crypto";

import { createFileRoute } from "@tanstack/react-router";
import webpush from "web-push";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ActivityRow = {
  id: string;
  title: string;
  activity_type: "Task" | "Call" | "Meeting";
  due_date: string | null;
  reminder_at: string | null;
  owner_name: string | null;
  service_details: unknown;
};

function authorized(request: Request) {
  const expected = process.env["CRON_SECRET"];
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

function activityHref(type: ActivityRow["activity_type"]) {
  if (type === "Call") return "/calls";
  if (type === "Meeting") return "/meetings";
  return "/tasks";
}

function snoozedUntil(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const value = (details as Record<string, unknown>)["notification_snoozed_until"];
  return typeof value === "string" ? value : null;
}

function reminderTitle(activity: ActivityRow, now: number) {
  const due = activity.due_date ? new Date(activity.due_date).getTime() : null;
  if (activity.activity_type === "Meeting" && due !== null && due > now) {
    const minutes = Math.max(1, Math.ceil((due - now) / 60_000));
    return `Meeting starts in ${minutes} min`;
  }
  return `${activity.activity_type} reminder`;
}

async function dispatchPushNotifications() {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:crm@zodiachrc.com";
  if (!publicKey || !privateKey) throw new Error("VAPID keys are not configured.");
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { data: activityData, error: activityError } = await supabaseAdmin
    .from("activities")
    .select("id,title,activity_type,due_date,reminder_at,owner_name,service_details")
    .neq("status", "Completed")
    .not("owner_name", "is", null)
    .limit(1000);
  if (activityError) throw activityError;

  const { data: members, error: memberError } = await supabaseAdmin
    .from("bd_team_members")
    .select("id,display_name")
    .eq("active", true)
    .eq("access_status", "approved");
  if (memberError) throw memberError;

  const memberByName = new Map(
    (members ?? []).map((member) => [member.display_name.trim().toLowerCase(), member.id]),
  );
  const now = Date.now();
  const oldest = now - 10 * 60_000;
  const dueActivities = ((activityData ?? []) as ActivityRow[]).filter((activity) => {
    const effective =
      snoozedUntil(activity.service_details) ?? activity.reminder_at ?? activity.due_date;
    if (!effective) return false;
    const timestamp = new Date(effective).getTime();
    return Number.isFinite(timestamp) && timestamp >= oldest && timestamp <= now;
  });
  if (dueActivities.length === 0) return { activities: 0, sent: 0, failed: 0 };

  const userIds = [
    ...new Set(
      dueActivities
        .map((activity) => memberByName.get(activity.owner_name!.trim().toLowerCase()))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (userIds.length === 0) return { activities: dueActivities.length, sent: 0, failed: 0 };

  const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth_key,failure_count")
    .in("user_id", userIds)
    .is("revoked_at", null);
  if (subscriptionError) throw subscriptionError;

  let sent = 0;
  let failed = 0;
  for (const activity of dueActivities) {
    const userId = memberByName.get(activity.owner_name!.trim().toLowerCase());
    if (!userId) continue;
    const effective =
      snoozedUntil(activity.service_details) ?? activity.reminder_at ?? activity.due_date!;
    for (const subscription of (subscriptions ?? []).filter((item) => item.user_id === userId)) {
      const { error: claimError } = await supabaseAdmin.from("activity_push_deliveries").insert({
        activity_id: activity.id,
        subscription_id: subscription.id,
        reminder_key: effective,
        status: "processing",
      });
      if (claimError?.code === "23505") continue;
      if (claimError) {
        failed += 1;
        continue;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
          },
          JSON.stringify({
            title: reminderTitle(activity, now),
            body: `${activity.title} · ${activity.owner_name}`,
            href: activityHref(activity.activity_type),
            tag: `activity-${activity.id}-${effective}`,
          }),
          { TTL: 60 * 60, urgency: "high" },
        );
        sent += 1;
        await Promise.all([
          supabaseAdmin
            .from("activity_push_deliveries")
            .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
            .eq("activity_id", activity.id)
            .eq("subscription_id", subscription.id)
            .eq("reminder_key", effective),
          supabaseAdmin
            .from("push_subscriptions")
            .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
            .eq("id", subscription.id),
        ]);
      } catch (error) {
        failed += 1;
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number(error.statusCode)
            : null;
        const message = error instanceof Error ? error.message.slice(0, 500) : "Push failed";
        const shouldRevoke =
          statusCode === 404 || statusCode === 410 || subscription.failure_count >= 2;
        if (shouldRevoke) {
          await supabaseAdmin
            .from("activity_push_deliveries")
            .update({ status: "failed", error: message })
            .eq("activity_id", activity.id)
            .eq("subscription_id", subscription.id)
            .eq("reminder_key", effective);
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", subscription.id);
        } else {
          await Promise.all([
            supabaseAdmin
              .from("activity_push_deliveries")
              .delete()
              .eq("activity_id", activity.id)
              .eq("subscription_id", subscription.id)
              .eq("reminder_key", effective),
            supabaseAdmin
              .from("push_subscriptions")
              .update({ failure_count: subscription.failure_count + 1 })
              .eq("id", subscription.id),
          ]);
        }
      }
    }
  }

  return { activities: dueActivities.length, sent, failed };
}

export const Route = createFileRoute("/api/push/dispatch")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
        try {
          return Response.json(await dispatchPushNotifications());
        } catch (error) {
          console.error("[push-dispatch]", error);
          return Response.json({ error: "Push dispatch failed" }, { status: 500 });
        }
      },
    },
  },
});
