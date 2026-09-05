import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

export type DailyEodReport = Tables<"daily_eod_reports">;

export type DailyEodMetrics = {
  prospectsAdded: number;
  contactsAdded: number;
  outboundCalls: number;
  meetingsBooked: number;
  meetingsHeld: number;
  opportunitiesCreated: number;
  clientsAdded: number;
  proposalsActive: number;
  activePipelineValue: number;
};

export type DailyEodContext = {
  userId: string;
  employeeName: string;
  metrics: DailyEodMetrics;
  report: DailyEodReport | null;
};

export type TeamEodRow = {
  userId: string;
  employeeName: string;
  email: string;
  report: DailyEodReport | null;
};

function dayBounds(date: string) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function count(result: { count: number | null; error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

export const dailyEodQuery = (reportDate: string) =>
  queryOptions({
    queryKey: ["daily-eod", reportDate],
    queryFn: async (): Promise<DailyEodContext> => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      if (!auth.user) throw new Error("Please sign in again to complete your EOD.");

      const { data: member, error: memberError } = await supabase
        .from("bd_team_members")
        .select("display_name")
        .eq("id", auth.user.id)
        .single();
      if (memberError) throw new Error(memberError.message);

      const { start, end } = dayBounds(reportDate);
      const owner = member.display_name;

      const [
        prospects,
        contacts,
        calls,
        meetingsBooked,
        meetingsHeld,
        opportunities,
        clients,
        activeDeals,
        reportResult,
      ] = await Promise.all([
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("owner_name", owner)
          .gte("created_at", start)
          .lt("created_at", end),
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("owner_name", owner)
          .gte("created_at", start)
          .lt("created_at", end),
        supabase
          .from("call_logs")
          .select("id", { count: "exact", head: true })
          .eq("rep_name", owner)
          .gte("created_at", start)
          .lt("created_at", end),
        supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("owner_name", owner)
          .eq("activity_type", "Meeting")
          .gte("created_at", start)
          .lt("created_at", end),
        supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("owner_name", owner)
          .eq("activity_type", "Meeting")
          .eq("status", "Completed")
          .gte("due_date", start)
          .lt("due_date", end),
        supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .eq("owner_name", owner)
          .gte("created_at", start)
          .lt("created_at", end),
        supabase
          .from("accounts")
          .select("id", { count: "exact", head: true })
          .eq("owner_name", owner)
          .gte("created_at", start)
          .lt("created_at", end),
        supabase.from("deals").select("amount").eq("owner_name", owner).neq("stage", "SLA Signed"),
        supabase
          .from("daily_eod_reports")
          .select("*")
          .eq("user_id", auth.user.id)
          .eq("report_date", reportDate)
          .maybeSingle(),
      ]);

      if (activeDeals.error) throw new Error(activeDeals.error.message);
      if (reportResult.error) throw new Error(reportResult.error.message);
      const activePipelineValue = (activeDeals.data ?? []).reduce(
        (total, deal) => total + Number(deal.amount ?? 0),
        0,
      );

      return {
        userId: auth.user.id,
        employeeName: owner,
        metrics: {
          prospectsAdded: count(prospects),
          contactsAdded: count(contacts),
          outboundCalls: count(calls),
          meetingsBooked: count(meetingsBooked),
          meetingsHeld: count(meetingsHeld),
          opportunitiesCreated: count(opportunities),
          clientsAdded: count(clients),
          proposalsActive: activeDeals.data?.length ?? 0,
          activePipelineValue,
        },
        report: reportResult.data,
      };
    },
  });

export async function saveDailyEod(values: {
  userId: string;
  employeeName: string;
  reportDate: string;
  bestOutcome: string;
  supportNeeded: string;
  nextDayPriorities: string;
  metrics: DailyEodMetrics;
  submit: boolean;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("daily_eod_reports").upsert(
    {
      user_id: values.userId,
      employee_name: values.employeeName,
      report_date: values.reportDate,
      best_outcome: values.bestOutcome.trim(),
      support_needed: values.supportNeeded.trim(),
      next_day_priorities: values.nextDayPriorities.trim(),
      metrics_snapshot: values.metrics as unknown as Json,
      status: values.submit ? "submitted" : "draft",
      submitted_at: values.submit ? now : null,
      updated_at: now,
    },
    { onConflict: "user_id,report_date" },
  );
  if (error) throw new Error(error.message);
}

export const teamEodQuery = (reportDate: string) =>
  queryOptions({
    queryKey: ["team-eod", reportDate],
    queryFn: async (): Promise<TeamEodRow[]> => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      if (!auth.user) throw new Error("Please sign in again.");

      const { data: currentMember, error: currentMemberError } = await supabase
        .from("bd_team_members")
        .select("access_role,access_status")
        .eq("id", auth.user.id)
        .single();
      if (currentMemberError) throw new Error(currentMemberError.message);
      if (
        currentMember.access_role !== "primary_admin" ||
        currentMember.access_status !== "approved"
      ) {
        throw new Error("Team EOD Review is available only to primary administrators.");
      }

      const [membersResult, reportsResult] = await Promise.all([
        supabase
          .from("bd_team_members")
          .select("id,display_name,email")
          .eq("active", true)
          .eq("access_status", "approved")
          .order("display_name"),
        supabase.from("daily_eod_reports").select("*").eq("report_date", reportDate),
      ]);
      if (membersResult.error) throw new Error(membersResult.error.message);
      if (reportsResult.error) throw new Error(reportsResult.error.message);

      const reports = new Map((reportsResult.data ?? []).map((report) => [report.user_id, report]));
      return (membersResult.data ?? []).map((member) => ({
        userId: member.id,
        employeeName: member.display_name,
        email: member.email,
        report: reports.get(member.id) ?? null,
      }));
    },
  });

export async function reviewDailyEod(values: {
  reportId: string;
  review: "pending" | "reviewed" | "coaching_required";
  comments: string;
}) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(authError.message);
  if (!auth.user) throw new Error("Please sign in again.");
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("daily_eod_reports")
    .update({
      manager_review: values.review,
      manager_comments: values.comments.trim() || null,
      reviewed_at: values.review === "pending" ? null : now,
      reviewed_by: values.review === "pending" ? null : auth.user.id,
      updated_at: now,
    })
    .eq("id", values.reportId);
  if (error) throw new Error(error.message);
}
