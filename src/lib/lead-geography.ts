export type LeadMarket = "all" | "domestic" | "international" | "unknown";
export const UNKNOWN_COUNTRY = "__unknown_country__";

const COUNTRY_NAMES: Record<string, string> = {
  india: "India",
  in: "India",
  ind: "India",
  uae: "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  hongkong: "Hong Kong",
  "hong kong": "Hong Kong",
  "united states": "United States",
  usa: "United States",
  "united kingdom": "United Kingdom",
  uk: "United Kingdom",
};

/** Country describes the property/company, never the contact's phone prefix. */
export function leadCountryName(value: string | null | undefined): string {
  const country = value?.trim().replace(/\s+/g, " ") ?? "";
  return COUNTRY_NAMES[country.toLowerCase()] ?? country;
}

export function leadCountryKey(value: string | null | undefined): string {
  return leadCountryName(value).toLowerCase();
}

export function leadMarket(value: string | null | undefined): Exclude<LeadMarket, "all"> {
  const country = leadCountryKey(value);
  return !country ? "unknown" : country === "india" ? "domestic" : "international";
}

export function matchesLeadGeography(
  country: string | null | undefined,
  market: LeadMarket,
  selectedCountry: string,
): boolean {
  if (market !== "all" && leadMarket(country) !== market) return false;
  if (selectedCountry === "all") return true;
  const key = leadCountryKey(country);
  return selectedCountry === UNKNOWN_COUNTRY ? !key : key === selectedCountry;
}
