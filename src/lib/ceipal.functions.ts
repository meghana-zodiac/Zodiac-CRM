import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type JsonObject = Record<string, unknown>;

export type CeipalSyncResult = {
  synced: number;
  source: "ATS" | "Workforce";
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

async function ceipalJson(url: string, token: string): Promise<JsonObject> {
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
  return (await response.json()) as JsonObject;
}

async function authenticate(): Promise<{ token: string; source: "ATS" | "Workforce" }> {
  const email = process.env["CEIPAL_USERNAME"];
  const password = process.env["CEIPAL_PASSWORD"];
  const apiKey = process.env["CEIPAL_API_KEY"];
  if (!email || !password || !apiKey) {
    throw new Error("CEIPAL credentials are not configured in Vercel.");
  }

  const response = await fetch(`${CEIPAL_BASE_URL}/auth_token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password, api_key: apiKey }),
  });
  if (response.status === 410) {
    const form = new FormData();
    form.set("email", email);
    form.set("password", password);
    form.set("api_key", apiKey);
    form.set("json", "1");
    const workforceResponse = await fetch(`${CEIPAL_BASE_URL}/wf/v1/createAuthtoken`, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: form,
    });
    if (!workforceResponse.ok) {
      throw new Error(`CEIPAL Workforce authentication failed (${workforceResponse.status}).`);
    }
    const workforceToken = tokenFrom((await workforceResponse.json()) as JsonObject);
    if (!workforceToken) {
      throw new Error("CEIPAL Workforce authenticated but did not return an access token.");
    }
    return { token: workforceToken, source: "Workforce" };
  }
  if (!response.ok) throw new Error(`CEIPAL authentication failed (${response.status}).`);

  const token = tokenFrom((await response.json()) as JsonObject);
  if (!token) throw new Error("CEIPAL authenticated but did not return an access token.");
  return { token, source: "ATS" };
}

function recordsFrom(payload: JsonObject): JsonObject[] {
  for (const key of ["results", "data", "clients"]) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is JsonObject => !!item && typeof item === "object");
    }
  }
  return [];
}

async function fetchAllClients(
  token: string,
  preferredSource: "ATS" | "Workforce",
): Promise<{ clients: JsonObject[]; source: "ATS" | "Workforce" }> {
  let source = preferredSource;
  let url =
    source === "Workforce"
      ? `${CEIPAL_BASE_URL}/wf/v1/getClients?limit=100`
      : `${CEIPAL_BASE_URL}/clients/?page=1`;
  let first: JsonObject;
  try {
    first = await ceipalJson(url, token);
  } catch (error) {
    if (source === "Workforce" || (error as { status?: number }).status !== 404) throw error;
    source = "Workforce";
    url = `${CEIPAL_BASE_URL}/wf/v1/getClients?limit=100`;
    first = await ceipalJson(url, token);
  }

  const clients = recordsFrom(first);
  let next = text(first["next"]);
  let pages = 1;
  while (next && pages < 100) {
    const payload = await ceipalJson(
      next.startsWith("http") ? next : `${CEIPAL_BASE_URL}${next}`,
      token,
    );
    clients.push(...recordsFrom(payload));
    next = text(payload["next"]);
    pages += 1;
  }
  return { clients, source };
}

function accountFrom(client: JsonObject) {
  const ceipalId = text(client["id"]) ?? text(client["client_id"]);
  const name =
    text(client["business_display_name"]) ??
    text(client["business_name"]) ??
    text(client["client_name"]) ??
    text(client["name"]);
  if (!ceipalId || !name) return null;

  return {
    ceipal_id: ceipalId,
    ceipal_client_number: text(client["client_number"]) ?? text(client["client_code"]),
    ceipal_last_synced_at: new Date().toISOString(),
    name,
    client_type: text(client["client_type"]) ?? text(client["category"]),
    industry: text(client["industry"]),
    website:
      text(client["business_url"]) ?? text(client["website"]) ?? text(client["website_url"]),
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
    const auth = await authenticate();
    const { clients, source } = await fetchAllClients(auth.token, auth.source);
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

    return { synced: accounts.length, source };
  });
