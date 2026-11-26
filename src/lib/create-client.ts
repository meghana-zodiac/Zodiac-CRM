import { supabase } from "@/integrations/supabase/client";
import { CONTRACT_FIELD_LABELS } from "./contract-smart-paste";
import type { Json } from "@/integrations/supabase/types";

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
