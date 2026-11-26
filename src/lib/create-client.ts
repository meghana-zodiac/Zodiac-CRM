import { supabase } from "@/integrations/supabase/client";
import { CONTRACT_FIELD_LABELS } from "./contract-smart-paste";
import type { Json } from "@/integrations/supabase/types";
import { extractEmails, type ClientContactDraft } from "./client-group-paste";

export function prepareClientCreation(id: string, payload: Record<string, unknown>) {
  const { contract, ...client } = payload;
  const input =
    contract && typeof contract === "object" ? (contract as Record<string, unknown>) : {};
  const details = Object.fromEntries(
    Object.keys(CONTRACT_FIELD_LABELS).map((key) => [key, String(input[key] ?? "").trim() || null]),
  );
  const hasContract = Object.values(details).some(Boolean);
  if (hasContract && !String(client["owner_name"] ?? "").trim())
    throw new Error("Choose a BD owner to save contract details.");
  if (hasContract && !["Active", "Non-active"].includes(String(details["activity_status"])))
    throw new Error("Choose Active or Non-active for the contract.");
  return {
    p_client: { ...client, id } as Json,
    p_contract: hasContract ? (details as Json) : null,
  };
}

export async function createClientWithContract(id: string, payload: Record<string, unknown>) {
  const { error } = await supabase.rpc(
    "create_client_with_contract",
    prepareClientCreation(id, payload),
  );
  if (error) throw new Error(error.message);
}

export async function createClientGroup(
  id: string,
  payload: Record<string, unknown>,
  contacts: ClientContactDraft[],
) {
  const input = prepareClientCreation(id, payload);
  const client = {
    ...(input.p_client as Record<string, Json>),
    email_addresses: extractEmails(String(payload["email_addresses"] ?? "")),
  };
  const rows = contacts
    .filter((c) => Object.entries(c).some(([key, value]) => key !== "id" && value.trim()))
    .map((c) => {
      if (!c.name.trim())
        throw new Error(
          "Add a name for each HR contact, or keep unassigned details with the company.",
        );
      const names = c.name.trim().split(/\s+/);
      const emailList = extractEmails(c.emails);
      return {
        id: c.id,
        first_name: names.length > 1 ? names.slice(0, -1).join(" ") : null,
        last_name: names.at(-1),
        title: c.title.trim() || null,
        phone: c.phone.trim() || null,
        landline: c.landline.trim() || null,
        email: emailList[0] || null,
        email_addresses: emailList,
      };
    });
  const { error } = await supabase.rpc("create_client_group", {
    p_client: client as Json,
    p_contract: input.p_contract,
    p_contacts: rows as Json,
  });
  if (error) throw new Error(error.message);
}
