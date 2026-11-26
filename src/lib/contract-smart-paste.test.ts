import { describe, expect, it } from "vitest";
import type { ContractInput } from "./client-contracts";
import { commercialTerms } from "./contract-terms";
import {
  CONTRACT_FIELD_LABELS,
  mergeContractPaste,
  parseContractPaste,
} from "./contract-smart-paste";

const empty: ContractInput = {
  activity_status: "",
  recruiter: "",
  approach_date: "",
  visit_date: "",
  mandate_received_date: "",
  terms: "",
  notes: "",
};

describe("Contract Status Smart Paste", () => {
  it("maps the screenshot's fields into the saved contract record", () => {
    const result = parseContractPaste(
      [
        "Client activity status: Non-active",
        "Assigned recruiter: Prerna",
        "Approach date(s): 18.10.2025",
        "Visit date: —",
        "Mandate received: 08/05/2026",
        "Fee / pricing: 8.33%",
        "Payment period: 30 days",
        "Replacement period: 90 days",
        "Remarks: Agreement signed Digitally",
      ].join("\n"),
    );
    expect(result.values).toEqual({
      activity_status: "Non-active",
      recruiter: "Prerna",
      approach_date: "18.10.2025",
      mandate_received_date: "2026-05-08",
      terms: "8.33% I Pay 30 Days I Replace 90 Days",
      notes: "Agreement signed Digitally",
    });
    expect(result.warnings).toEqual([]);
    expect(result.unclassified).toEqual([]);
    expect(commercialTerms(result.values.terms ?? null)).toEqual({
      fee: "8.33%",
      payment: "30",
      replacement: "90",
    });
    expect(Object.keys(result.values).every((key) => key in CONTRACT_FIELD_LABELS)).toBe(true);
  });

  it.each([
    ["Non-active", "Non-active"],
    ["NON-ACTIVE", "Non-active"],
    ["Inactive", "Non-active"],
    ["ACTIVE", "Active"],
  ])("recognises status %s without matching active inside non-active", (source, expected) => {
    expect(parseContractPaste(`Active / Non-active: ${source}`).values.activity_status).toBe(
      expected,
    );
  });

  it("does not treat agreement signing or an uncertain Closed status as Active", () => {
    const result = parseContractPaste("Status: Closed\nRemarks: Agreement signed digitally");
    expect(result.values.activity_status).toBeUndefined();
    expect(result.values.notes).toBe("Agreement signed digitally");
    expect(result.warnings.join(" ")).toContain("Select Active or Non-active");
    expect(result.values.mandate_received_date).toBeUndefined();
  });

  it("accepts calendar-valid ISO and named dates and preserves multiple approach dates", () => {
    const result = parseContractPaste(
      "Approach dates: 18.10.2025 / 22.10.2025\nVisit date: 2026-11-18\nMandate date: 26 November 2026",
    );
    expect(result.values.approach_date).toBe("18.10.2025 / 22.10.2025");
    expect(result.values.visit_date).toBe("2026-11-18");
    expect(result.values.mandate_received_date).toBe("2026-11-26");
  });

  it.each([
    "31.02.2026",
    "29.02.2025",
    "2026-13-12",
    "12/31/2026",
    "next Friday",
    "26 Mayonnaise 2026",
  ])("keeps invalid or ambiguous date %s for manual review", (date) => {
    const result = parseContractPaste(`Mandate date: ${date}`);
    expect(result.values.mandate_received_date).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.unclassified.join(" ")).toContain(date);
  });

  it("preserves tiered pricing and payment-after terms verbatim", () => {
    const terms =
      "Up to Assistant Manager Level=8.33% I Sr. Manager & Above=10.00% I Pay aft. 60 Days I Replace 90 Days";
    const result = parseContractPaste(`Commercial terms: ${terms}`);
    expect(result.values.terms).toBe(terms);
    expect(commercialTerms(result.values.terms ?? null)).toEqual({
      fee: "Up to Assistant Manager Level=8.33% I Sr. Manager & Above=10.00%",
      payment: "60",
      replacement: "90",
    });
  });

  it("does not invent percentage fees or periods for BGV and training", () => {
    const result = parseContractPaste("Pricing: BGV = Rs. 3,445/- per candidature");
    expect(result.values.terms).toBe("BGV = Rs. 3,445/- per candidature");
    expect(commercialTerms(result.values.terms ?? null).payment).toBeUndefined();
    expect(parseContractPaste("Fee: 50000 + GST").values.terms).toBe("50000 + GST");
  });

  it("recognises copied labels with the value on the following line", () => {
    const result = parseContractPaste(
      "Assigned recruiter\nPrerna\nClient activity status\nNon-active\nMandate received\n08/05/2026\nFee / pricing\n8.33%\nPayment period\n30 days\nRemarks\nAgreement signed digitally",
    );
    expect(result.values).toMatchObject({
      recruiter: "Prerna",
      activity_status: "Non-active",
      mandate_received_date: "2026-05-08",
      terms: "8.33% I Pay 30 Days",
      notes: "Agreement signed digitally",
    });
    expect(result.unclassified).toEqual([]);
  });

  it("does not consume the next labelled field when a preceding field has no value", () => {
    const result = parseContractPaste("Visit date\nRecruiter: Prerna\nMandate date: 26.11. 2026");
    expect(result.values.visit_date).toBeUndefined();
    expect(result.values.recruiter).toBe("Prerna");
    expect(result.values.mandate_received_date).toBe("2026-11-26");
    expect(result.warnings).toHaveLength(1);
  });

  it("does not equate a currency amount with a percentage", () => {
    const result = parseContractPaste("Commercial terms: ₹8.33 I Pay 30 Days\nFee: 8.33%");
    expect(result.values.terms).toBe("₹8.33 I Pay 30 Days");
    expect(result.warnings).toHaveLength(1);
  });

  it("adds an explicitly stated fee when the terms only contain payment information", () => {
    expect(parseContractPaste("Commercial terms: Pay 30 Days\nFee: 8.33%").values.terms).toBe(
      "8.33% I Pay 30 Days",
    );
    expect(commercialTerms("Pay 30 Days").fee).toBe("Not recorded");
  });

  it("flags contradictions rather than changing explicit commercial terms", () => {
    const terms = "8.33% I Pay 30 Days I Replace 90 Days";
    const result = parseContractPaste(
      `Commercial terms: ${terms}\nFee: 10%\nPayment period: 60 days\nReplacement period: 120 days`,
    );
    expect(result.values.terms).toBe(terms);
    expect(result.warnings).toHaveLength(3);
    expect(result.unclassified).toHaveLength(3);
  });

  it("keeps unclear payment language and duplicate fields available for review", () => {
    const result = parseContractPaste(
      "Recruiter: Prerna\nRecruiter: Shivani\nPayment period: after joining\nReplacement period: -90 days",
    );
    expect(result.values.recruiter).toBe("Prerna");
    expect(result.values.terms).toBeUndefined();
    expect(result.unclassified).toHaveLength(3);
  });

  it("preserves multiline remarks and does not change the client or its owner", () => {
    const result = parseContractPaste(
      "BD owner: Another person\nClient name: Different client\nRemarks: Agreement signed\nCourier copy pending",
    );
    expect(result.values.notes).toBe("Agreement signed\nCourier copy pending");
    expect(result.unclassified).toEqual([
      "BD owner: Another person",
      "Client name: Different client",
    ]);
    expect(Object.keys(result.values)).toEqual(["notes"]);
  });

  it("fills empty fields while requiring a deliberate choice for existing values", () => {
    const original: ContractInput = {
      ...empty,
      activity_status: "Active",
      terms: "8.33% I Pay 30 Days",
      notes: "Existing remarks",
    };
    const result = mergeContractPaste(original, {
      activity_status: "Non-active",
      recruiter: "Prerna",
      terms: "10% I Pay 60 Days",
      notes: "New remarks",
    });
    expect(result.draft).toEqual({ ...original, recruiter: "Prerna" });
    expect(result.filled).toEqual(["Assigned recruiter"]);
    expect(result.conflicts.map((conflict) => conflict.field)).toEqual([
      "activity_status",
      "terms",
      "notes",
    ]);
    expect(original.recruiter).toBe("");
    expect(mergeContractPaste(original, {}).draft).toEqual(original);
  });

  it("does not erase existing dates when a pasted date is blank or a dash", () => {
    const original = { ...empty, visit_date: "2026-11-18" };
    const result = mergeContractPaste(original, parseContractPaste("Visit date: —").values);
    expect(result.draft.visit_date).toBe("2026-11-18");
    expect(result.conflicts).toEqual([]);
  });
});
