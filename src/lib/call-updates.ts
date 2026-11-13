import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { CallLogAttempt } from "./call-logging";

export type CallUpdateActivity = Tables<"activities">;
export type ReviewCall = {
  id: string;
  phone: string;
  startedAt: number;
  returnedAt?: number;
  attempt?: CallLogAttempt;
  activity?: CallUpdateActivity;
};
export type CallUpdateInput = {
  outcome: string;
  notes: string;
  nextAction: string;
  followUpAt: string;
  followUpId: string;
  priority: string;
};

export function callDetails(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function detailText(activity: CallUpdateActivity | undefined, key: string) {
  const value = callDetails(activity?.service_details ?? null)[key];
  return typeof value === "string" ? value : "";
}

export const callUpdatesQuery = () =>
  queryOptions({
    queryKey: ["call-log-updates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("activity_type", "Call")
        .not("service_details->>call_log_id", "is", null);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export async function saveCallUpdates(call: ReviewCall, input: CallUpdateInput) {
  const followUpAt = input.followUpAt ? new Date(input.followUpAt).toISOString() : null;
  await call.attempt?.save();
  const [{ data: log, error: logError }, { data: auth, error: authError }] = await Promise.all([
    supabase.from("call_logs").select("*").eq("id", call.id).single(),
    supabase.auth.getUser(),
  ]);
  if (logError) throw new Error(logError.message);
  if (authError) throw new Error(authError.message);
  if (!log || !auth.user) throw new Error("Sign in to update this call.");

  // Read the last saved version, including a partial save whose response was lost.
  const { data: existing, error: existingError } = await supabase
    .from("activities")
    .select("*")
    .eq("id", call.activity?.id ?? log.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  const previous = callDetails(existing?.service_details ?? null);
  const relatedType = call.attempt?.relatedType ?? existing?.related_to_type ?? null;
  const relatedId = call.attempt?.relatedId ?? existing?.related_to_id ?? null;
  const previousFollowUpId = detailText(existing ?? undefined, "follow_up_activity_id");
  const followUpId = previousFollowUpId || input.followUpId;
  const details = {
    ...previous,
    source: "CRM call log",
    call_log_id: log.id,
    phone: log.phone_number,
    started_at: log.created_at,
    outcome: input.outcome,
    next_action: input.nextAction,
    follow_up_at: followUpAt,
    follow_up_activity_id: followUpId,
    priority: input.priority,
    updated_by_user_id: auth.user.id,
    ...(call.returnedAt !== undefined
      ? {
          elapsed_seconds: Math.max(0, Math.round((call.returnedAt - call.startedAt) / 1000)),
          duration_type: "estimated_elapsed",
        }
      : {}),
  };
  // One activity per automatic log, including repeated saves and lost-response retries.
  const { error } = await supabase.from("activities").upsert({
    id: call.activity?.id ?? log.id,
    title: `Call to ${log.phone_number ?? "unknown number"}`,
    activity_type: "Call",
    status: "Completed",
    due_date: log.created_at,
    notes: input.notes.trim() || null,
    owner_name: log.rep_name,
    priority: input.priority,
    related_to_type: relatedType,
    related_to_id: relatedId,
    service_details: details,
  });
  if (error) throw new Error(error.message);

  if (followUpAt) {
    const { data: task, error: taskError } = await supabase
      .from("activities")
      .select("*")
      .eq("id", followUpId)
      .maybeSingle();
    if (taskError)
      throw new Error(`Call updates saved, but the follow-up could not load: ${taskError.message}`);
    const { error: followUpError } = await supabase.from("activities").upsert({
      id: followUpId,
      title: `${input.nextAction}: ${log.phone_number ?? "Call follow-up"}`,
      activity_type: "Task",
      status: task?.status ?? "Pending",
      due_date: followUpAt,
      notes: input.notes.trim() || null,
      owner_name: log.rep_name,
      priority: input.priority,
      related_to_type: relatedType,
      related_to_id: relatedId,
      service_details: { source: "Call follow-up", call_log_id: log.id },
    });
    if (followUpError) {
      throw new Error(`Call updates saved, but the follow-up failed: ${followUpError.message}`);
    }
  } else if (previousFollowUpId) {
    // Clearing the optional date removes only the follow-up belonging to this call.
    const { error: removalError } = await supabase
      .from("activities")
      .delete()
      .eq("id", previousFollowUpId)
      .eq("service_details->>call_log_id", log.id);
    if (removalError)
      throw new Error(
        `Call updates saved, but the follow-up could not be removed: ${removalError.message}`,
      );
  }
  // Do not write estimated elapsed time into the actual duration_seconds column.
}

export function callUserKey(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase();
}

export function callMatchesUser(repName: string | null, selectedUser: string | null) {
  return selectedUser === null || callUserKey(repName) === selectedUser;
}
