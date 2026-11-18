import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ClientContract = Tables<"client_contracts">;
export type ClientContractHistory = Tables<"client_contract_history">;
export type ClientStatusFilter = "all" | "Active" | "Non-active";

export const clientContractsQuery = () =>
  queryOptions({
    queryKey: ["client-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contracts")
        .select("*")
        .order("created_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const contractHistoryQuery = (id?: string) =>
  queryOptions({
    queryKey: ["client-contract-history", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contract_history")
        .select("*")
        .eq("contract_id", id!)
        .order("revision", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export function contractMatchesStatus(
  contract: ClientContract | undefined,
  filter: ClientStatusFilter,
) {
  return filter === "all" || contract?.activity_status === filter;
}

export function commercialTerms(terms: string | null) {
  return {
    fee: terms?.split(/\s+[I|]\s*Pay\b/i)[0] || "Not recorded",
    payment: terms?.match(/\bPay\s+(\d+)\s*Days?/i)?.[1],
    replacement: terms?.match(/\bReplace\s+(\d+)\s*Days?/i)?.[1],
  };
}

export type ContractInput = Pick<
  ClientContract,
  | "activity_status"
  | "recruiter"
  | "approach_date"
  | "visit_date"
  | "mandate_received_date"
  | "terms"
  | "notes"
>;

export async function saveClientContract(
  contract: ClientContract | undefined,
  accountId: string,
  owner: string,
  input: ContractInput,
) {
  if (!owner.trim()) throw new Error("Assign a BD owner before adding contract details.");
  const request = contract
    ? supabase
        .from("client_contracts")
        .update(input)
        .eq("id", contract.id)
        .eq("updated_at", contract.updated_at)
    : supabase
        .from("client_contracts")
        .insert({ ...input, account_id: accountId, owner_name: owner });
  const { data, error } = await request.select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data)
    throw new Error(
      "This contract changed while you were editing. Close the editor, reload the details and try again.",
    );
  return data;
}
