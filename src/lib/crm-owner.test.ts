import { describe, expect, it } from "vitest";
import { matchesCrmOwner } from "./crm-owner";

describe("CRM owner display filtering", () => {
  it("keeps historical Nuzhat records visible to the same member", () => {
    expect(matchesCrmOwner("Nuzhat K", "Nuzhat")).toBe(true);
    expect(matchesCrmOwner("Nuzhat", "Nuzhat K")).toBe(true);
  });
  it("matches case and whitespace without guessing other first-name aliases", () => {
    expect(matchesCrmOwner("Edward D", " edward d ")).toBe(true);
    expect(matchesCrmOwner("Edward D", "Edward")).toBe(false);
    expect(matchesCrmOwner("debarati d", "Edward D")).toBe(false);
  });
  it("keeps unassigned records out of a member filter", () => {
    expect(matchesCrmOwner("Edward D", null)).toBe(false);
    expect(matchesCrmOwner("", null)).toBe(false);
    expect(matchesCrmOwner("all", null)).toBe(true);
  });
});
