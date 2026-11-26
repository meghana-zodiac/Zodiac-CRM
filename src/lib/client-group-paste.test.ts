import { describe, it, expect } from "vitest";
import { parseClientGroups } from "./client-group-paste";
describe("company-grouped client paste", () => {
  it("reads quoted Excel cells containing line breaks without splitting a contact", () => {
    const group = parseClientGroups(
      '"Aurora\nGroup"\tPune\tPriya Shah\tHR\t9000010001\t020-12345678\t"priya@aurora.com\npriya.two@aurora.com"\tProposal shared',
    )[0]!;
    expect(group.name).toBe("Aurora Group");
    expect(group.contacts).toHaveLength(1);
    expect(group.contacts[0]!.emails).toContain("priya.two@aurora.com");
  });
  it("keeps Greenzo continuation emails and the proposal history without inventing a contract", () => {
    const g = parseClientGroups(
      "Greenzo Energy India Limited\tNew Delhi\tMr. Sandeep Agarwal\tHR Dept\tSandep=9897100900\tBoard: 9910669939\tgreenzoenergy@gmail.com\tProposal sent as on 09.11.2026\n\t\t\tinfo@greenzoenergy.com\t\t\t\t\n\t\t\tsandeep@kushalpower.com\t\t\t\t",
    )[0]!;
    expect(g.name).toBe("Greenzo Energy India Limited");
    expect(g.city).toBe("New Delhi");
    expect(g.contacts).toHaveLength(1);
    expect(g.contacts[0]).toMatchObject({
      name: "Sandeep Agarwal",
      title: "HR Dept",
      phone: "9897100900",
      emails: "greenzoenergy@gmail.com\nsandeep@kushalpower.com",
    });
    expect(g.emails).toContain("info@greenzoenergy.com");
    expect(g.notes).toContain("09.11.2026");
    expect(g.warnings.join(" ")).toContain("domain differs");
  });
  it("keeps each Panchshil contact's telephone and personal emails on their row", () => {
    const gs = parseClientGroups(
      "HOT/WARM/COLD\tORGANISATION\tPLACE\tCONTACT PERSON\tDESIGNATION\tMOBILE NOS\tTEL NOS\tE-MAIL IDS\tREMARKS\nWARM\tPanchshil Realty\tPune\tMs. Jesmin Pappachan\tHR Dept\t\tBoard:020-66473200\tjesmin.pappachan@panchshil.com\tProposal sent as on 09.11.2026\n\t\t\tMs. Zarina Darji\t\t\tBoard:020-66473201\trecruitments@panchshil.com\t\n\t\t\tMr. Dattatrya Jagdale\t\t\tBoard:8970007700\tcareers@panchshil.com\t",
    );
    expect(gs).toHaveLength(1);
    expect(gs[0]!.priority).toBe("Warm");
    expect(gs[0]!.contacts.map((c) => c.name)).toEqual([
      "Jesmin Pappachan",
      "Zarina Darji",
      "Dattatrya Jagdale",
    ]);
    expect(gs[0]!.contacts[1]!.landline).toBe("020-66473201");
    expect(gs[0]!.contacts[2]!.title).toBe("HR Dept");
    expect(gs[0]!.contacts[2]!.emails).toContain("careers@panchshil.com");
  });
  it("reads Markdown tables and skips divider rows", () => {
    const gs = parseClientGroups(
      "| **Greenzo Energy India Limited** | New Delhi | Mr. Sandeep Agarwal | HR Dept | Sandep=9897100900 | Board:9910669939 | greenzoenergy@gmail.com | Proposal sent |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| | | | info@greenzoenergy.com | | | | |",
    );
    expect(gs).toHaveLength(1);
    expect(gs[0]!.contacts).toHaveLength(1);
    expect(gs[0]!.emails).toContain("info@greenzoenergy.com");
  });
  it("returns separate companies and never attaches a second company's HR to the first", () => {
    const gs = parseClientGroups(
      "Warm\tAurora Group\tPune\tPriya Shah\tHR\t9000010001\t020-12345678\tpriya@aurora.com\tNotes\nHot\tNova Group\tDelhi\tRiya Jain\tHR\t9000010002\t011-12345678\triya@nova.com\tNotes",
    );
    expect(gs.map((g) => g.name)).toEqual(["Aurora Group", "Nova Group"]);
    expect(gs[1]!.contacts[0]!.name).toBe("Riya Jain");
  });
});
