import { describe, expect, it } from "vitest";
import { buildBdTeamPerformance } from "./bd-team-performance";

const admin = {
  id: "admin",
  display_name: "Administrator",
  active: true,
  access_status: "approved",
  access_role: "primary_admin",
};
const edward = {
  id: "edward",
  display_name: "Edward D",
  active: true,
  access_status: "approved",
  access_role: "bd_member",
};
const debarati = { ...edward, id: "debarati", display_name: "debarati d" };
const nuzhat = { ...edward, id: "nuzhat", display_name: "Nuzhat K" };
const input = {
  members: [edward, debarati, nuzhat],
  viewer: admin,
  ownerFilter: "all",
  deals: [],
  activities: [],
  trainingRequests: [],
  isToday: (date: string | null) => date === "2026-11-18",
};

describe("BD Team Performance", () => {
  it("automatically includes approved members without a fixed employee list", () => {
    const newMember = { ...edward, id: "new-user", display_name: "New BD User" };
    const rows = buildBdTeamPerformance({
      ...input,
      members: [
        ...input.members,
        newMember,
        { ...edward, id: "inactive", active: false },
        { ...edward, id: "pending", access_status: "pending" },
      ],
    });
    expect(rows.map((row) => row.owner)).toEqual([
      "Edward D",
      "debarati d",
      "Nuzhat K",
      "New BD User",
    ]);
  });
  it("counts real full-name and known legacy-owner records while excluding completed work", () => {
    const rows = buildBdTeamPerformance({
      ...input,
      deals: [
        { owner_name: "Edward D", stage: "Proposal Sent", amount: 20000 },
        { owner_name: " edward d ", stage: "SLA Signed", amount: 50000 },
        { owner_name: "debarati d", stage: "New Lead", amount: 5000 },
        { owner_name: "Nuzhat", stage: "SLA Negotiation", amount: 3000 },
        { owner_name: null, stage: "New Lead", amount: 99999 },
      ],
      activities: [
        {
          owner_name: "Edward D",
          activity_type: "Meeting",
          status: "Pending",
          due_date: "2026-11-18",
        },
        {
          owner_name: "Edward D",
          activity_type: "Meeting",
          status: "Completed",
          due_date: "2026-11-18",
        },
        {
          owner_name: "Edward D",
          activity_type: "Task",
          status: "Pending",
          due_date: "2026-11-18",
        },
      ],
      trainingRequests: [
        { owner_name: "Edward D", status: "Inquiry Received" },
        { owner_name: "Edward D", status: "Completed & Invoiced" },
      ],
    });
    expect(rows[0]).toMatchObject({
      owner: "Edward D",
      openDeals: 1,
      pipelineValue: 20000,
      meetings: 1,
      meetingsToday: 1,
      trainingRequests: 1,
    });
    expect(rows[1]).toMatchObject({ owner: "debarati d", pipelineValue: 5000 });
    expect(rows[2]).toMatchObject({ owner: "Nuzhat K", pipelineValue: 3000 });
  });
  it("shows only the current BD member even if another owner filter is supplied", () => {
    expect(
      buildBdTeamPerformance({ ...input, viewer: edward, ownerFilter: "debarati d" }).map(
        (row) => row.owner,
      ),
    ).toEqual(["Edward D"]);
  });
  it("lets admins select a member and denies missing or unapproved viewers", () => {
    expect(
      buildBdTeamPerformance({ ...input, ownerFilter: "debarati d" }).map((row) => row.owner),
    ).toEqual(["debarati d"]);
    expect(buildBdTeamPerformance({ ...input, viewer: undefined })).toEqual([]);
    expect(
      buildBdTeamPerformance({ ...input, viewer: { ...edward, access_status: "pending" } }),
    ).toEqual([]);
  });
});
