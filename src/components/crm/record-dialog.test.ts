import { describe, expect, it } from "vitest";

import { parseVCard } from "./record-dialog";

describe("mobile contact card import", () => {
  it("reads common vCard fields", () => {
    const contact = parseVCard(
      [
        "BEGIN:VCARD",
        "VERSION:3.0",
        "FN:Priya Shah",
        "ORG:Nova Retail Solutions Pvt Ltd",
        "TEL;TYPE=CELL:+91 98765 43210",
        "EMAIL;TYPE=WORK:priya@novaretail.com",
        "END:VCARD",
      ].join("\n"),
    );

    expect(contact).toEqual({
      name: ["Priya Shah"],
      organization: ["Nova Retail Solutions Pvt Ltd"],
      tel: ["+91 98765 43210"],
      email: ["priya@novaretail.com"],
    });
  });

  it("returns null for a file without contact information", () => {
    expect(parseVCard("BEGIN:VCARD\nVERSION:3.0\nEND:VCARD")).toBeNull();
  });
});
