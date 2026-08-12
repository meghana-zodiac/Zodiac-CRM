import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const searchSchema = z.object({
  jobTitle: z.string().trim().max(120).optional().default(""),
  companyName: z.string().trim().max(160).optional().default(""),
  location: z.string().trim().max(120).optional().default(""),
  industry: z.string().trim().max(120).optional().default(""),
});

export type ApolloProspect = {
  apolloId: string;
  firstName: string;
  lastName: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  emailStatus: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
};

type Json = Record<string, unknown>;

function pickPhone(person: Json): string | null {
  const list = person["phone_numbers"];
  if (Array.isArray(list) && list.length > 0) {
    const first = list[0] as Json;
    const raw = first?.["sanitized_number"] ?? first?.["raw_number"];
    if (typeof raw === "string") return raw;
  }
  const org = person["organization"] as Json | undefined;
  const orgPhone = org?.["phone"] ?? org?.["primary_phone"];
  if (typeof orgPhone === "string") return orgPhone;
  if (orgPhone && typeof orgPhone === "object") {
    const num = (orgPhone as Json)["number"];
    if (typeof num === "string") return num;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

async function apollo(path: string, init: RequestInit): Promise<Json> {
  const apiKey = process.env["VITE_APOLLO_API_KEY"] || process.env["APOLLO_API_KEY"];
  if (!apiKey) throw new Error("Apollo API Key is missing from environment variables");

  const response = await fetch(`https://api.apollo.io/v1${path}`, {
    method: init.method ?? "POST",
    body: init.body,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Apollo request failed [${response.status}]: ${body}`);
    throw new Error(`Apollo request failed (${response.status}): ${body.slice(0, 400)}`);
  }

  return (await response.json()) as Json;
}

export const searchApolloContacts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => searchSchema.parse(data))
  .handler(async ({ data }): Promise<{ prospects: ApolloProspect[]; total: number }> => {
    const body: Record<string, unknown> = {
      per_page: 8,
      page: 1,
    };

    if (data.jobTitle) body["person_titles"] = [data.jobTitle];
    if (data.location) body["person_locations"] = [data.location];
    if (data.companyName) body["q_organization_domains_list_as_string"] = [data.companyName];
    if (data.industry) body["q_keywords"] = data.industry;

    if (!data.jobTitle && !data.companyName && !data.location && !data.industry) {
      return { prospects: [], total: 0 };
    }

    const result = await apollo("/mixed_people/search", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const people = Array.isArray(result["people"]) ? (result["people"] as Json[]) : [];
    const total = typeof result["total_entries"] === "number" ? result["total_entries"] : people.length;

    const enriched = people.slice(0, 8).map((person) => {
      const id = str(person["id"]);
      if (!id) return null;

      const org = (person["organization"] as Json) ?? {};
      const first = str(person["first_name"]) ?? "";
      const last = str(person["last_name"]) ?? "";

      return {
        apolloId: id,
        firstName: first,
        lastName: last,
        name: str(person["name"]) ?? [first, last].filter(Boolean).join(" "),
        title: str(person["title"]),
        company: str(org["name"]),
        email: str(person["email"]),
        emailStatus: str(person["email_status"]),
        phone: pickPhone(person),
        linkedinUrl: str(person["linkedin_url"]),
        city: str(person["city"]),
        country: str(person["country"]),
        industry: str(org["industry"]),
      } satisfies ApolloProspect;
    });

    return { prospects: enriched.filter((p): p is ApolloProspect => p !== null), total };
  });
