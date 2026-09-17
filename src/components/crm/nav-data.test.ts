import { describe, expect, it } from "vitest";

import { navGroups } from "./nav-data";
import { mobileNavItems } from "./crm-shell";

describe("CRM navigation", () => {
  it("uses unique destinations and includes every core module", () => {
    const items = navGroups.flatMap((group) => group.items);
    const destinations = items.map((item) => item.to);

    expect(new Set(destinations).size).toBe(destinations.length);
    expect(destinations).toEqual(
      expect.arrayContaining([
        "/",
        "/leads",
        "/accounts",
        "/contacts",
        "/deals",
        "/poa",
        "/eod",
        "/eod-review",
        "/training-requests",
        "/training-batches",
        "/trainers",
        "/meetings",
        "/calls",
        "/tasks",
      ]),
    );
  });

  it("keeps Team EOD Review administrator-only", () => {
    const review = navGroups
      .flatMap((group) => group.items)
      .find((item) => item.to === "/eod-review");
    expect(review?.adminOnly).toBe(true);
  });

  it("keeps the five direct mobile destinations, including Contacts", () => {
    expect(mobileNavItems.map((item) => item.label)).toEqual([
      "Home",
      "Leads",
      "Clients",
      "Contacts",
      "Deals",
    ]);
  });
});
