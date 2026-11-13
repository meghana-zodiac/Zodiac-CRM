import { describe, expect, it } from "vitest";
import {
  leadCountryName,
  leadMarket,
  matchesLeadGeography,
  UNKNOWN_COUNTRY,
} from "./lead-geography";

describe("lead country and market filters", () => {
  it.each([null, undefined, "", "   "])("keeps an unset country unclassified: %s", (country) => {
    expect(leadMarket(country)).toBe("unknown");
    expect(matchesLeadGeography(country, "domestic", "all")).toBe(false);
    expect(matchesLeadGeography(country, "international", "all")).toBe(false);
    expect(matchesLeadGeography(country, "all", UNKNOWN_COUNTRY)).toBe(true);
  });

  it.each(["India", " india ", "IN", "ind"])(
    "recognizes an explicit domestic country: %s",
    (country) => {
      expect(leadMarket(country)).toBe("domestic");
      expect(matchesLeadGeography(country, "domestic", "india")).toBe(true);
      expect(matchesLeadGeography(country, "international", "all")).toBe(false);
    },
  );

  it("combines a market and country without changing the source value", () => {
    expect(matchesLeadGeography("Malaysia", "international", "malaysia")).toBe(true);
    expect(matchesLeadGeography("Malaysia", "international", "india")).toBe(false);
    expect(matchesLeadGeography("Malaysia", "domestic", "malaysia")).toBe(false);
    expect(matchesLeadGeography("Malaysia", "all", "all")).toBe(true);
  });

  it("normalizes known country labels but does not infer ambiguous ones", () => {
    expect(leadCountryName("UAE")).toBe("United Arab Emirates");
    expect(leadCountryName("Hongkong")).toBe("Hong Kong");
    expect(leadCountryName("Korea")).toBe("Korea");
    expect(leadCountryName(null)).toBe("");
  });

  it("does not include classified leads in the country-not-set filter", () => {
    expect(matchesLeadGeography("India", "all", UNKNOWN_COUNTRY)).toBe(false);
    expect(matchesLeadGeography("Singapore", "unknown", "all")).toBe(false);
  });
});
