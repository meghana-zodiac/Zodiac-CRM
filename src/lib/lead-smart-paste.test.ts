import { describe, expect, it } from "vitest";

import { parseSmartPasteDetailed, SMART_PASTE_TABLES } from "./lead-smart-paste";

describe("Smart Paste", () => {
  it("supports every CRM record type advertised by the UI", () => {
    expect(SMART_PASTE_TABLES).toEqual([
      "leads",
      "accounts",
      "contacts",
      "deals",
      "trainers",
      "training_requests",
      "training_batches",
    ]);
  });

  it("extracts an unstructured corporate lead", () => {
    const result = parseSmartPasteDetailed(
      "leads",
      "Spoke with Priya Shah from Nova Retail Solutions Pvt Ltd in Mumbai. They need recruitment support for 25 positions. Email priya@novaretail.com, phone +91 98765 43210. Lead came through LinkedIn and is qualified. Estimated value ₹4 lakh.",
    );

    expect(result.values["company_name"]).toBe("Nova Retail Solutions Pvt Ltd");
    expect(result.values["email"]).toBe("priya@novaretail.com");
    expect(result.values["estimated_value"]).toBe("400000");
  });

  it("extracts contact details from natural text", () => {
    const result = parseSmartPasteDetailed(
      "contacts",
      "Priya Shah is the HR Manager at Nova Retail Solutions Pvt Ltd. Reach her at priya@novaretail.com or 9876543210.",
    );

    expect(result.values["first_name"]).toBe("Priya");
    expect(result.values["last_name"]).toBe("Shah");
    expect(result.values["email"]).toBe("priya@novaretail.com");
  });

  it("keeps unmatched text available for review", () => {
    const result = parseSmartPasteDetailed(
      "training_requests",
      "Need PoSH awareness for 30 people, online, on 21 September 2026. Please call after lunch.",
    );

    expect(result.values["course_topic"]).toBe("POSH Awareness");
    expect(result.values["participants"]).toBe("30");
    expect(result.values["notes"]).toContain("Please call after lunch");
  });
});
