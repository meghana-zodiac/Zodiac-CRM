import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  member: null as { id: string; device_access_required: boolean } | null,
  device: null as { id: string } | null,
  headers: new Headers(),
  predicates: [] as Array<[string, string, unknown]>,
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => ({ headers: mock.headers }) }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          mock.predicates.push([table, key, value]);
          return query;
        },
        is: (key: string, value: unknown) => {
          mock.predicates.push([table, key, value]);
          return query;
        },
        gt: (key: string, value: unknown) => {
          mock.predicates.push([table, key, value]);
          return query;
        },
        maybeSingle: async () => ({
          data: table === "bd_team_members" ? mock.member : mock.device,
          error: null,
        }),
      };
      return query;
    },
  },
}));
import { requirePrimaryAdmin } from "./crm-admin.server";

beforeEach(() => {
  mock.member = null;
  mock.device = null;
  mock.headers = new Headers();
  mock.predicates = [];
});

describe("Global CRM administration authorization", () => {
  it("requires a database-approved primary admin rather than a client-selected identity", async () => {
    await expect(requirePrimaryAdmin("user-id")).rejects.toThrow("Primary administrator");
    expect(mock.predicates).toEqual(
      expect.arrayContaining([
        ["bd_team_members", "id", "user-id"],
        ["bd_team_members", "active", true],
        ["bd_team_members", "access_status", "approved"],
        ["bd_team_members", "access_role", "primary_admin"],
      ]),
    );
  });
  it("rejects an admin's request when device enforcement is enabled but no token is supplied", async () => {
    mock.member = { id: "admin", device_access_required: true };
    await expect(requirePrimaryAdmin("admin")).rejects.toThrow("work device is not registered");
  });
  it("requires the supplied device token to match an active, unexpired device owned by that admin", async () => {
    mock.member = { id: "admin", device_access_required: true };
    mock.headers.set("x-zodiac-device-token", "not-an-approved-device");
    await expect(requirePrimaryAdmin("admin")).rejects.toThrow("work device is not registered");
    expect(mock.predicates).toEqual(
      expect.arrayContaining([
        ["crm_devices", "user_id", "admin"],
        ["crm_devices", "revoked_at", null],
      ]),
    );
    expect(
      mock.predicates.some(([table, key]) => table === "crm_devices" && key === "expires_at"),
    ).toBe(true);
  });
  it("accepts an approved administrator with a matching approved device", async () => {
    mock.member = { id: "admin", device_access_required: true };
    mock.device = { id: "approved-device" };
    mock.headers.set("x-zodiac-device-token", "approved-test-token");
    await expect(requirePrimaryAdmin("admin")).resolves.toBeDefined();
  });
});
