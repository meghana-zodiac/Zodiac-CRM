import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type JsonObject = Record<string, unknown>;

export type CeipalSyncResult = {
  synced: number;
  source: "ATS";
};

export type CeipalLeadContactSyncResult = {
  checked: number;
  updated: number;
  withPhone: number;
  withoutPhone: number;
  remaining: number;
  source: "ATS";
};

const CEIPAL_BASE_URL = "https://api.ceipal.com";
const CEIPAL_PAGE_DELAY_MS = 650;
const CEIPAL_MAX_RETRIES = 4;
// Keep each request short enough for the hosting runtime. The UI automatically
// requests the next batch until every CEIPAL lead has been checked.
const CEIPAL_CONTACT_BATCH_SIZE = 25;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(seconds * 1000, CEIPAL_PAGE_DELAY_MS);

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.max(retryAt - Date.now(), CEIPAL_PAGE_DELAY_MS);
  }

  return Math.min(5000 * 2 ** attempt, 30000);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function tokenFrom(payload: JsonObject): string | null {
  const candidates = [
    payload["access_token"],
    payload["access"],
    payload["token"],
    (payload["data"] as JsonObject | undefined)?.["access_token"],
    (payload["data"] as JsonObject | undefined)?.["token"],
  ];
  return candidates.map(text).find(Boolean) ?? null;
}

async function ceipalJson(url: string, token: string): Promise<unknown> {
  for (let attempt = 0; attempt <= CEIPAL_MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      },
    });
    if (response.ok) return response.json();

    if (response.status === 429 && attempt < CEIPAL_MAX_RETRIES) {
      await sleep(retryDelay(response, attempt));
      continue;
    }

    const error = new Error(
      response.status === 429
        ? "CEIPAL is still rate-limiting this sync. Please wait a few minutes and try again."
        : `CEIPAL returned ${response.status}`,
    );
    Object.assign(error, { status: response.status });
    throw error;
  }

  throw new Error("CEIPAL sync could not be completed after retrying.");
}

async function authenticate(): Promise<string> {
  const email = process.env["CEIPAL_USERNAME"];
  const password = process.env["CEIPAL_PASSWORD"];
  const apiKey = process.env["CEIPAL_API_KEY"];
  if (!email || !password || !apiKey) {
    throw new Error("CEIPAL credentials are not configured in Vercel.");
  }

  const response = await fetch(`${CEIPAL_BASE_URL}/v2/createAuthtoken/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password, apiKey }),
  });
  if (!response.ok) {
    throw new Error(`CEIPAL ATS v2 authentication failed (${response.status}).`);
  }

  const token = tokenFrom((await response.json()) as JsonObject);
  if (!token) throw new Error("CEIPAL authenticated but did not return an access token.");
  return token;
}

function recordsFrom(payload: unknown): JsonObject[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is JsonObject => !!item && typeof item === "object");
  }
  if (!payload || typeof payload !== "object") return [];
  const object = payload as JsonObject;
  for (const key of ["results", "data", "clients", "leads"]) {
    const value = object[key];
    if (Array.isArray(value))
      return value.filter((item): item is JsonObject => !!item && typeof item === "object");
  }
  return [];
}

function objectFrom(payload: unknown): JsonObject | null {
  if (Array.isArray(payload)) {
    return payload.find((item): item is JsonObject => !!item && typeof item === "object") ?? null;
  }
  if (!payload || typeof payload !== "object") return null;
  const object = payload as JsonObject;
  for (const key of ["data", "result", "lead", "details"]) {
    const nested = objectFrom(object[key]);
    if (nested) return nested;
  }
  return object;
}

function firstText(object: JsonObject, keys: string[]) {
  return keys.map((key) => text(object[key])).find(Boolean) ?? null;
}

function primaryContactFrom(payload: unknown) {
  const detail = objectFrom(payload);
  if (!detail) return null;
  const rawContacts = detail["contacts"] ?? detail["contact_details"] ?? detail["contactDetails"];
  const contacts = Array.isArray(rawContacts)
    ? rawContacts.filter((item): item is JsonObject => !!item && typeof item === "object")
    : [];
  const phoneKeys = [
    "mobile_no", "mobile", "mobile_number", "mobileNumber", "contact_number",
    "contactNumber", "phone", "phone_number", "phoneNumber", "work_phone", "office_no",
  ];
  const contact = contacts.find((item) => firstText(item, phoneKeys)) ?? contacts[0];
  if (!contact) return null;

  const firstName = firstText(contact, ["contact_first_name", "first_name", "firstName"]);
  const lastName = firstText(contact, ["contact_last_name", "last_name", "lastName"]);
  const combinedName = [firstName, lastName].filter(Boolean).join(" ") || null;
  return {
    name: firstText(contact, ["contact_person_name", "contact_name", "contactName", "name"]) ?? combinedName,
    phone: firstText(contact, phoneKeys),
    email: firstText(contact, ["email", "email_id", "emailId", "email_address", "emailAddress", "contact_email"]),
  };
}

async function fetchLeads(token: string): Promise<JsonObject[]> {
  const leads: JsonObject[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= 100; page += 1) {
    const url = new URL(`${CEIPAL_BASE_URL}/v2/getLeadsList/`);
    url.searchParams.set("limit", "50");
    url.searchParams.set("page", String(page));

    const payload = await ceipalJson(url.toString(), token);
    const batch = recordsFrom(payload);
    let added = 0;

    for (const lead of batch) {
      const id = text(lead["id"]);
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      leads.push(lead);
      added += 1;
    }

    if (batch.length < 50 || added === 0) break;
    await sleep(CEIPAL_PAGE_DELAY_MS);
  }

  return leads;
}

async function fetchClients(token: string): Promise<JsonObject[]> {
  const clients: JsonObject[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= 100; page += 1) {
    const url = new URL(`${CEIPAL_BASE_URL}/v2/getClientsList/`);
    url.searchParams.set("limit", "50");
    url.searchParams.set("page", String(page));

    const payload = await ceipalJson(url.toString(), token);
    const batch = recordsFrom(payload);
    let added = 0;

    for (const client of batch) {
      const id = text(client["id"]) ?? text(client["client_id"]);
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      clients.push(client);
      added += 1;
    }

    if (batch.length < 50 || added === 0) break;
    await sleep(CEIPAL_PAGE_DELAY_MS);
  }

  return clients;
}

function accountFrom(client: JsonObject) {
  const ceipalId = text(client["id"]) ?? text(client["client_id"]);
  const name =
    text(client["name"]) ??
    text(client["business_display_name"]) ??
    text(client["business_name"]) ??
    text(client["client_name"]);
  if (!ceipalId || !name) return null;

  return {
    ceipal_id: ceipalId,
    ceipal_client_number: text(client["client_number"]) ?? text(client["client_code"]),
    ceipal_last_synced_at: new Date().toISOString(),
    name,
    client_type: text(client["category"]) ?? text(client["client_type"]),
    industry: text(client["industry_exp"]) ?? text(client["industry"]),
    website: text(client["website"]) ?? text(client["business_url"]) ?? text(client["website_url"]),
    phone:
      text(client["business_main_phnumber"]) ??
      text(client["business_phone"]) ??
      text(client["phone_number"]) ??
      text(client["phone"]),
    city: text(client["city"]),
  };
}

function leadFrom(lead: JsonObject) {
  const ceipalId = text(lead["id"]);
  const companyName = text(lead["name"]);
  if (!ceipalId || !companyName) return null;

  return {
    ceipal_id: ceipalId,
    ceipal_last_synced_at: new Date().toISOString(),
    company_name: companyName,
    industry: text(lead["industry_type"]),
    city: text(lead["city"]),
    source: "CEIPAL",
    status: text(lead["lead_status"]) ?? "New",
  };
}

export const syncCeipalClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CeipalSyncResult> => {
    const token = await authenticate();
    const clients = await fetchClients(token);
    const accounts = clients
      .map(accountFrom)
      .filter((account): account is NonNullable<typeof account> => account !== null);
    if (accounts.length === 0) throw new Error("CEIPAL returned no usable clients.");

    for (let offset = 0; offset < accounts.length; offset += 200) {
      const { error } = await context.supabase
        .from("accounts")
        .upsert(accounts.slice(offset, offset + 200), { onConflict: "ceipal_id" });
      if (error) throw new Error(`Could not save CEIPAL clients: ${error.message}`);
    }

    return { synced: accounts.length, source: "ATS" };
  });

export const syncCeipalLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CeipalSyncResult> => {
    const token = await authenticate();
    const ceipalLeads = await fetchLeads(token);
    const leads = ceipalLeads
      .map(leadFrom)
      .filter((lead): lead is NonNullable<typeof lead> => lead !== null);
    if (leads.length === 0) throw new Error("CEIPAL returned no usable leads.");

    for (let offset = 0; offset < leads.length; offset += 200) {
      const { error } = await context.supabase
        .from("leads")
        .upsert(leads.slice(offset, offset + 200), { onConflict: "ceipal_id" });
      if (error) throw new Error(`Could not save CEIPAL leads: ${error.message}`);
    }

    return { synced: leads.length, source: "ATS" };
  });

export const syncCeipalLeadContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CeipalLeadContactSyncResult> => {
    const { data: candidates, error: candidatesError } = await context.supabase
      .from("leads")
      .select("id, ceipal_id, contact_name, phone, email")
      .not("ceipal_id", "is", null)
      .is("ceipal_contact_synced_at", null)
      .order("created_at", { ascending: true })
      .limit(CEIPAL_CONTACT_BATCH_SIZE);
    if (candidatesError) throw new Error(`Could not load CEIPAL leads: ${candidatesError.message}`);
    if (!candidates?.length)
      return { checked: 0, updated: 0, withPhone: 0, withoutPhone: 0, remaining: 0, source: "ATS" };

    const token = await authenticate();
    let checked = 0;
    let updated = 0;
    let withPhone = 0;
    let withoutPhone = 0;

    for (const candidate of candidates) {
      try {
        const payload = await ceipalJson(
          `${CEIPAL_BASE_URL}/v2/getLeadsDetail/${encodeURIComponent(candidate.ceipal_id!)}/`,
          token,
        );
        const contact = primaryContactFrom(payload);
        const patch = {
          ceipal_contact_synced_at: new Date().toISOString(),
          contact_name: candidate.contact_name ?? contact?.name ?? null,
          phone: candidate.phone ?? contact?.phone ?? null,
          email: candidate.email ?? contact?.email ?? null,
        };
        const { error } = await context.supabase.from("leads").update(patch).eq("id", candidate.id);
        if (error) throw new Error(`Could not save a CEIPAL contact: ${error.message}`);
        checked += 1;
        if (contact?.phone || contact?.email || contact?.name) updated += 1;
        if (patch.phone) withPhone += 1;
        else withoutPhone += 1;
      } catch (error) {
        if ((error as { status?: number }).status === 429) throw error;
        const { error: markError } = await context.supabase
          .from("leads")
          .update({ ceipal_contact_synced_at: new Date().toISOString() })
          .eq("id", candidate.id);
        if (markError) throw new Error(`Could not mark a CEIPAL lead as checked: ${markError.message}`);
        checked += 1;
        withoutPhone += 1;
      }
      if (checked < candidates.length) await sleep(CEIPAL_PAGE_DELAY_MS);
    }

    const { count, error: countError } = await context.supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .not("ceipal_id", "is", null)
      .is("ceipal_contact_synced_at", null);
    if (countError) throw new Error(`Could not count remaining CEIPAL leads: ${countError.message}`);
    return { checked, updated, withPhone, withoutPhone, remaining: count ?? 0, source: "ATS" };
  });
