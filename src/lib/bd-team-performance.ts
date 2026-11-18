import type { Activity, Deal, TrainingRequest } from "./crm";
import type { BdTeamMember } from "./poa";
import { matchesCrmOwner } from "./crm-owner";

type Member = Pick<
  BdTeamMember,
  "id" | "display_name" | "active" | "access_status" | "access_role"
>;
type Input = {
  members: Member[];
  viewer: Member | undefined;
  ownerFilter: string;
  deals: Pick<Deal, "owner_name" | "stage" | "amount">[];
  activities: Pick<Activity, "owner_name" | "activity_type" | "status" | "due_date">[];
  trainingRequests: Pick<TrainingRequest, "owner_name" | "status">[];
  isToday: (date: string | null) => boolean;
};

export function buildBdTeamPerformance(input: Input) {
  const { viewer } = input;
  if (!viewer?.active || viewer.access_status !== "approved") return [];
  const isAdmin = viewer.access_role === "primary_admin";
  return input.members
    .filter((member) => member.active && member.access_status === "approved")
    .filter((member) =>
      isAdmin ? matchesCrmOwner(input.ownerFilter, member.display_name) : member.id === viewer.id,
    )
    .map((member) => {
      const owned = (owner: string | null) => matchesCrmOwner(member.display_name, owner);
      const openDeals = input.deals.filter(
        (deal) => deal.stage !== "SLA Signed" && owned(deal.owner_name),
      );
      const meetings = input.activities.filter(
        (activity) =>
          activity.activity_type === "Meeting" &&
          activity.status !== "Completed" &&
          owned(activity.owner_name),
      );
      return {
        id: member.id,
        owner: member.display_name,
        openDeals: openDeals.length,
        pipelineValue: openDeals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0),
        meetings: meetings.length,
        meetingsToday: meetings.filter((meeting) => input.isToday(meeting.due_date)).length,
        trainingRequests: input.trainingRequests.filter(
          (request) => request.status !== "Completed & Invoiced" && owned(request.owner_name),
        ).length,
      };
    });
}
