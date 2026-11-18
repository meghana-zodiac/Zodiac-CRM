import { describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as { message: string } | null },
  predicates: [] as unknown[][],
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: (key: string, value: string) => {
          mock.predicates.push([key, value]);
          return {
            eq: (key: string, value: string) => {
              mock.predicates.push([key, value]);
              return { select: () => ({ maybeSingle: async () => mock.result }) };
            },
          };
        },
      }),
    }),
  },
}));
import {
  commercialTerms,
  contractMatchesStatus,
  saveClientContract,
  type ClientContract,
} from "./client-contracts";

describe("Client contract behavior", () => {
  it("keeps clients without contract status in All without treating them as non-active", () => {
    expect(contractMatchesStatus(undefined, "all")).toBe(true);
    expect(contractMatchesStatus(undefined, "Active")).toBe(false);
    expect(contractMatchesStatus(undefined, "Non-active")).toBe(false);
  });
  it("preserves tiered pricing while extracting payment and replacement periods", () => {
    expect(
      commercialTerms(
        "Up to 15 Lakhs=8.33% I 15 Lakhs to 40 Lakhs=12.50% I Pay 30 Days I Replace 60 Days",
      ),
    ).toEqual({
      fee: "Up to 15 Lakhs=8.33% I 15 Lakhs to 40 Lakhs=12.50%",
      payment: "30",
      replacement: "60",
    });
  });
  it("does not invent recruitment terms for BGV or training prices", () => {
    expect(commercialTerms("BGV = Rs. 3,445/- per candidature")).toEqual({
      fee: "BGV = Rs. 3,445/- per candidature",
      payment: undefined,
      replacement: undefined,
    });
    expect(commercialTerms("GST Training = Rs. 50,000/- + GST").fee).toBe(
      "GST Training = Rs. 50,000/- + GST",
    );
  });
  it("rejects a stale save rather than overwriting another user's contract update", async () => {
    const contract = { id: "contract-1", updated_at: "2026-11-18T07:00:00Z" } as ClientContract;
    await expect(
      saveClientContract(contract, "account-1", "Edward D", {
        activity_status: "Active",
        recruiter: "Preeti",
        approach_date: null,
        visit_date: null,
        mandate_received_date: null,
        terms: "8.33%",
        notes: null,
      }),
    ).rejects.toThrow("changed while you were editing");
    expect(mock.predicates).toEqual([
      ["id", "contract-1"],
      ["updated_at", "2026-11-18T07:00:00Z"],
    ]);
  });
});
