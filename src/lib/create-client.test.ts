import { describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  rpc: vi.fn().mockResolvedValue({ data: "client-id", error: null }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock }));
import {
  createClientGroup,
  createClientWithContract,
  prepareClientCreation,
} from "./create-client";

describe("combined client creation", () => {
  it("sends named HR rows and every email in the grouped save", async () => {
    await createClientGroup(
      "company-id",
      {
        name: "Greenzo",
        owner_name: "Edward D",
        email_addresses: "info@greenzo.com",
        notes: "Proposal sent",
      },
      [
        {
          id: "contact-id",
          name: "Sandeep Agarwal",
          title: "HR Dept",
          phone: "9897100900",
          landline: "9910669939",
          emails: "sandeep@example.com\nsandeep.two@example.com",
        },
      ],
    );
    expect(mock.rpc).toHaveBeenLastCalledWith(
      "create_client_group",
      expect.objectContaining({
        p_client: expect.objectContaining({
          name: "Greenzo",
          email_addresses: ["info@greenzo.com"],
        }),
        p_contacts: [
          expect.objectContaining({
            id: "contact-id",
            first_name: "Sandeep",
            last_name: "Agarwal",
            email_addresses: ["sandeep@example.com", "sandeep.two@example.com"],
          }),
        ],
      }),
    );
  });
  it("keeps the contract optional", () => {
    expect(
      prepareClientCreation("stable-id", {
        name: "Aurora",
        contract: { activity_status: "", notes: " " },
      }),
    ).toEqual({ p_client: { id: "stable-id", name: "Aurora" }, p_contract: null });
  });
  it("requires an explicit owner and status when contract details are supplied", () => {
    expect(() =>
      prepareClientCreation("id", { name: "Aurora", contract: { recruiter: "Prerna" } }),
    ).toThrow("BD owner");
    expect(() =>
      prepareClientCreation("id", {
        name: "Aurora",
        owner_name: "Edward D",
        contract: { terms: "8.33%" },
      }),
    ).toThrow("Active or Non-active");
  });
  it("sends both records in a single RPC and preserves the retry ID", async () => {
    const payload = {
      name: "Aurora",
      owner_name: "Edward D",
      contract: { activity_status: "Non-active", terms: "8.33% I Pay 30 Days", notes: " Signed " },
    };
    await createClientWithContract("same-id", payload);
    await createClientWithContract("same-id", payload);
    expect(mock.rpc).toHaveBeenCalledWith(
      "create_client_with_contract",
      expect.objectContaining({
        p_client: { id: "same-id", name: "Aurora", owner_name: "Edward D" },
        p_contract: expect.objectContaining({ activity_status: "Non-active", notes: "Signed" }),
      }),
    );
    expect(mock.rpc.mock.calls.at(-1)).toEqual(mock.rpc.mock.calls.at(-2));
  });
  it("surfaces save errors without attempting a separate client insert", async () => {
    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: "Contract failed" } });
    await expect(createClientWithContract("id", { name: "Aurora" })).rejects.toThrow(
      "Contract failed",
    );
  });
});
