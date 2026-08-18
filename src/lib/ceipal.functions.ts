import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type JsonObject = Record<string, unknown>;

export type CeipalSyncResult = {
  synced: number;
  source: "ATS";
};

const CEIPAL_BASE_URL = "https://api.ceipal.com";

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
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const error = new Error(`CEIPAL returned ${response.status}`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return response.json();
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
  for (const key of ["results", "data", "clients"]) {
    const value = object[key];
    if (Array.isArray(value))
      return value.filter((item): item is JsonObject => !!item && typeof item === "object");
  }
  return [];
}

async function fetchClients(token: string): Promise<JsonObject[]> {
  const payload = await ceipalJson(`${CEIPAL_BASE_URL}/v2/getClientsList/?limit=50`, token);
  return recordsFrom(payload);
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
