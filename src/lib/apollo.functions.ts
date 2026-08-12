import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/apollo";

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
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["APOLLO_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!connectionKey) throw new Error("Apollo connection is not configured");

  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
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
    const body: Json = { per_page: 8, page: 1 };
    if (data.jobTitle) body["person_titles"] = [data.jobTitle];
    if (data.location) body["person_locations"] = [data.location];
    if (data.companyName) body["q_organization_name"] = data.companyName;
    if (data.industry) body["q_keywords"] = data.industry;

    if (!data.jobTitle && !data.companyName && !data.location && !data.industry) {
      return { prospects: [], total: 0 };
    }

    const result = await apollo("/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const people = Array.isArray(result["people"]) ? (result["people"] as Json[]) : [];
    const total = typeof result["total_entries"] === "number" ? result["total_entries"] : people.length;

    const enriched = await Promise.all(
      people.slice(0, 8).map(async (person) => {
        const id = str(person["id"]);
        if (!id) return null;
        try {
          const match = await apollo(
            `/api/v1/people/match?id=${encodeURIComponent(id)}&reveal_personal_emails=false`,
            { method: "POST" },
          );
          const full = (match["person"] as Json) ?? {};
          const org = (full["organization"] as Json) ?? {};
          const searchOrg = (person["organization"] as Json) ?? {};
          const first = str(full["first_name"]) ?? str(person["first_name"]) ?? "";
          const last = str(full["last_name"]) ?? "";
          return {
            apolloId: id,
            firstName: first,
            lastName: last,
            name: str(full["name"]) ?? [first, last].filter(Boolean).join(" "),
            title: str(full["title"]) ?? str(person["title"]),
            company: str(org["name"]) ?? str(full["organization_name"]) ?? str(searchOrg["name"]),
            email: str(full["email"]),
            emailStatus: str(full["email_status"]),
            phone: pickPhone(full),
            linkedinUrl: str(full["linkedin_url"]),
            city: str(full["city"]),
            country: str(full["country"]),
            industry: str(org["industry"]),
          } satisfies ApolloProspect;
        } catch (error) {
          console.error("Apollo enrichment failed", error);
          return null;
        }
      }),
    );

    return { prospects: enriched.filter((p): p is ApolloProspect => p !== null), total };
  });
