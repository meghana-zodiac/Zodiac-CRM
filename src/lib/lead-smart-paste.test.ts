import { describe, expect, it } from "vitest";

import { accountFields, clientCreationFields } from "@/components/crm/field-defs";
import {
  matchSmartPasteOption,
  parseSmartPasteDetailed,
  parseSmartPasteForFields,
  SMART_PASTE_TABLES,
} from "./lead-smart-paste";

describe("Smart Paste", () => {
  it("matches Non-active exactly instead of selecting Active as a substring", () => {
    const options = [
      { value: "Active", label: "Active" },
      { value: "Non-active", label: "Non-active" },
    ];
    expect(matchSmartPasteOption("Non-active", options)?.value).toBe("Non-active");
    expect(matchSmartPasteOption("was active before", options)).toBeUndefined();
  });
  it("fills both sections of Create Client from the same pasted details", () => {
    const result = parseSmartPasteForFields(
      "accounts",
      "Client: Aurora Group\nOwner: Edward D\nActivity status: Non-active\nAssigned recruiter: Prerna\nMandate date: 08.05.2026\nFee / pricing: 8.33%\nPayment period: 30 days\nReplacement period: 90 days\nRemarks: Agreement signed",
      clientCreationFields,
    );
    expect(result.values).toMatchObject({
      name: "Aurora Group",
      owner_name: "Edward D",
      "contract.activity_status": "Non-active",
      "contract.recruiter": "Prerna",
      "contract.mandate_received_date": "2026-05-08",
      "contract.terms": "8.33% I Pay 30 Days I Replace 90 Days",
      "contract.notes": "Agreement signed",
    });
    expect(result.unclassified).toEqual([]);
    expect(result.values["phone"]).toBeUndefined();
  });
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

  it("does not mistake a contact pronoun for the person's name", () => {
    const result = parseSmartPasteDetailed(
      "contacts",
      "Riya Mehta is the Talent Acquisition Manager at TEST Aurora Retail Solutions Pvt Ltd. She works in the Human Resources department. Contact her at riya.test@example.com or +91 90000 10001. She is the main decision-maker for recruitment requirements.",
    );

    expect(result.values["first_name"]).toBe("Riya");
    expect(result.values["last_name"]).toBe("Mehta");
    expect(result.values["email"]).toBe("riya.test@example.com");
    expect(result.values["phone"]).toBe("+91 90000 10001");
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

  it("maps client paste labels to the actual client form", () => {
    const result = parseSmartPasteDetailed(
      "accounts",
      [
        "Client name: Aurora Group",
        "Industry: Hospitality",
        "Engagement type: Recruitment",
        "City: Mumbai",
        "Website: https://aurora.example",
        "Phone 1: +91 90000 10001",
        "Phone 2: +91 90000 10002",
        "Landline: 022-40001234",
        "Owner: Edward D",
      ].join("\n"),
    );

    expect(result.values).toEqual({
      name: "Aurora Group",
      industry: "Hospitality",
      client_type: "Recruitment",
      city: "Mumbai",
      website: "https://aurora.example",
      phone: "+91 90000 10001",
      phone_2: "+91 90000 10002",
      landline: "022-40001234",
      owner_name: "Edward D",
    });
    const fieldNames = accountFields.map((field) => field.name);
    expect(Object.keys(result.values).every((name) => fieldNames.includes(name))).toBe(true);
    expect(result.unclassified).toEqual([]);
  });

  it.each(["Name", "Client", "Company name"])("recognises the client-name label %s", (label) => {
    const result = parseSmartPasteDetailed("accounts", `${label}: Aurora`);
    expect(result.values["name"]).toBe("Aurora");
    expect(result.unclassified).toEqual([]);
  });

  it("retains extra emails and notes for review instead of silently dropping them", () => {
    const result = parseSmartPasteDetailed(
      "accounts",
      [
        "Client: Aurora Group",
        "Email: priya@example.com; careers@example.com",
        "Notes: Please call tomorrow",
        "Owner name: Edward D",
      ].join("\n"),
    );
    expect(result.values["owner_name"]).toBe("Edward D");
    expect(result.unclassified.join("\n")).toContain("priya@example.com");
    expect(result.unclassified.join("\n")).toContain("careers@example.com");
    expect(result.unclassified.join("\n")).toContain("Please call tomorrow");
  });

  it("does not claim a contact's email or designation was filled into the client form", () => {
    const result = parseSmartPasteForFields(
      "accounts",
      [
        "Client: Aurora Group",
        "Contact person: Priya Shah",
        "Email: priya@example.com",
        "Designation: HR Manager",
        "Department: Human Resources",
      ].join("\n"),
      accountFields,
    );

    expect(result.values).toEqual({ name: "Aurora Group" });
    expect(result.unclassified.join("\n")).toContain("priya@example.com");
    expect(result.unclassified.join("\n")).toContain("Priya Shah");
    expect(result.unclassified.join("\n")).toContain("HR Manager");
    expect(result.unclassified.join("\n")).toContain("Contacts tab");
  });

  it("does not copy a labelled secondary phone or landline into Phone 1", () => {
    const result = parseSmartPasteDetailed(
      "accounts",
      ["Client: Aurora Group", "Phone 2: 9000010002", "Landline: 022-40001234"].join("\n"),
    );
    expect(result.values["phone"]).toBeUndefined();
    expect(result.values["phone_2"]).toBe("9000010002");
    expect(result.values["landline"]).toBe("022-40001234");
  });

  it("accepts alternate client phone labels and preserves international numbers", () => {
    const result = parseSmartPasteDetailed(
      "accounts",
      [
        "Company: Aurora Group",
        "Mobile: +44 20 7946 0958",
        "Alternate phone: +1 (212) 555-0199",
        "Office landline: 020-40001234",
      ].join("\n"),
    );
    expect(result.values["phone"]).toBe("+44 20 7946 0958");
    expect(result.values["phone_2"]).toBe("+1 (212) 555-0199");
    expect(result.values["landline"]).toBe("020-40001234");
  });

  it("recognises copied column names with underscores", () => {
    const result = parseSmartPasteDetailed(
      "accounts",
      "Client: Aurora\nPhone_1: 9000010001\nPhone_2: 9000010002",
    );
    expect(result.values["phone"]).toBe("9000010001");
    expect(result.values["phone_2"]).toBe("9000010002");
  });

  it("keeps unsupported parsed fields out of form values and conflict detection", () => {
    const result = parseSmartPasteForFields(
      "contacts",
      "Name: Priya Shah\nEmail: priya@example.com",
      [{ name: "last_name", label: "Last name" }],
    );
    expect(result.values).toEqual({ last_name: "Shah" });
    expect(Object.keys(result.confidence)).toEqual(["last_name"]);
    expect(result.unclassified.join("\n")).toContain("Email: priya@example.com");
    expect(result.unclassified.join("\n")).toContain("no matching field");
  });
});
