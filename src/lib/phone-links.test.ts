import { describe, expect, it } from "vitest";
import { whatsappNumber } from "./phone-links";

describe("WhatsApp contact links", () => {
  it.each([
    ["+65 9123 4567", "6591234567"],
    [" +65 6123 4567 ", "6561234567"],
    ["+852 2345 6789", "85223456789"],
    ["+971 50 123 4567", "971501234567"],
    ["0065 9123 4567", "6591234567"],
    ["+91 98765 43210", "919876543210"],
    ["9876543210", "919876543210"],
    ["09876543210", "919876543210"],
  ])("preserves the dialling code for %s", (phone, expected) => {
    expect(whatsappNumber(phone)).toBe(expected);
  });
});
