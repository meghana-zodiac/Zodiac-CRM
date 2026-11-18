import { describe, expect, it } from "vitest";
import { indiaUsageDay, usageRange } from "./usage-period";

describe("CRM usage calendar in India time", () => {
  it("opens the current India day even when the UTC date is still yesterday", () => {
    const now = new Date("2026-11-17T18:30:00Z");
    expect(indiaUsageDay(now)).toBe("2026-11-18");
    const range = usageRange("today", "", "", now);
    expect(range.start.toISOString()).toBe("2026-11-17T18:30:00.000Z");
    expect(range.end.toISOString()).toBe("2026-11-18T18:29:59.999Z");
  });
  it("changes days at India midnight", () => {
    expect(indiaUsageDay(new Date("2026-11-18T18:29:59.999Z"))).toBe("2026-11-18");
    expect(indiaUsageDay(new Date("2026-11-18T18:30:00Z"))).toBe("2026-11-19");
  });
  it("keeps week and month filters aligned with the same calendar", () => {
    const now = new Date("2026-11-18T09:00:00Z");
    expect(usageRange("this_week", "", "", now).start.toISOString()).toBe(
      "2026-11-15T18:30:00.000Z",
    );
    expect(usageRange("this_month", "", "", now).start.toISOString()).toBe(
      "2026-10-31T18:30:00.000Z",
    );
  });
  it("preserves inclusive rolling and custom date ranges", () => {
    const now = new Date("2026-11-18T09:00:00Z");
    expect(usageRange("7", "", "", now).start.toISOString()).toBe("2026-11-11T18:30:00.000Z");
    const custom = usageRange("custom", "2026-11-18", "2026-11-16", now);
    expect(custom.start.toISOString()).toBe("2026-11-15T18:30:00.000Z");
    expect(custom.end.toISOString()).toBe("2026-11-18T18:29:59.999Z");
  });
});
