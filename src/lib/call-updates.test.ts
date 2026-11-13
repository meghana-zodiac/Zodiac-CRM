import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  activities: new Map<string, Record<string, unknown>>(),
  writes: vi.fn(),
  logWrites: vi.fn(),
  failTask: false,
  signedIn: true,
  log: {
    id: "call-1",
    rep_name: "Actual Caller",
    phone_number: "123",
    created_at: "2026-11-13T06:00:00Z",
    duration_seconds: null,
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({
        data: { user: database.signedIn ? { id: "editor-user" } : null },
        error: null,
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: (_field: string, id: string) => ({
          single: async () => ({ data: database.log, error: null }),
          maybeSingle: async () => ({ data: database.activities.get(id) ?? null, error: null }),
        }),
      }),
      upsert: async (row: Record<string, unknown>) => {
        if (table === "call_logs") {
          database.logWrites(row);
          return { error: null };
        }
        database.writes(row);
        database.activities.set(String(row["id"]), row);
        if (row["activity_type"] === "Task" && database.failTask) {
          database.failTask = false;
          return { error: { message: "Lost response" } };
        }
        return { error: null };
      },
      delete: () => ({
        eq: (_field: string, id: string) => ({
          eq: (_jsonField: string, callId: string) => {
            const row = database.activities.get(id);
            const details = row?.["service_details"] as Record<string, unknown> | undefined;
            if (details?.["call_log_id"] === callId) database.activities.delete(id);
            return Promise.resolve({ error: null });
          },
        }),
      }),
    }),
  },
}));

import {
  callMatchesUser,
  callUserKey,
  saveCallUpdates,
  type ReviewCall,
  type CallUpdateInput,
} from "./call-updates";
const call: ReviewCall = {
  id: "call-1",
  phone: "123",
  startedAt: Date.parse("2026-11-13T06:00:00Z"),
  returnedAt: Date.parse("2026-11-13T06:02:00Z"),
};
const input: CallUpdateInput = {
  outcome: "Connected",
  notes: "Discussed requirements",
  nextAction: "Call Again",
  followUpAt: "",
  followUpId: "followup-1",
  priority: "Medium",
};

beforeEach(() => {
  vi.clearAllMocks();
  database.activities.clear();
  database.failTask = false;
  database.signedIn = true;
});

describe("call updates", () => {
  it("updates the same entry without duplicating logs or inventing call duration", async () => {
    await saveCallUpdates(call, input);
    await saveCallUpdates(call, { ...input, notes: "Revised notes" });
    expect(database.activities.size).toBe(1);
    expect(database.activities.get("call-1")?.["notes"]).toBe("Revised notes");
    expect(database.activities.get("call-1")?.["owner_name"]).toBe("Actual Caller");
    expect(database.logWrites).not.toHaveBeenCalled();
    expect(database.log.duration_seconds).toBeNull();
    expect(database.activities.get("call-1")?.["service_details"]).toMatchObject({
      call_log_id: "call-1",
      elapsed_seconds: 120,
      duration_type: "estimated_elapsed",
      updated_by_user_id: "editor-user",
    });
  });

  it("waits for the automatic entry before saving updates", async () => {
    const save = vi.fn(async () => {
      expect(database.writes).not.toHaveBeenCalled();
    });
    await saveCallUpdates(
      {
        ...call,
        attempt: {
          id: call.id,
          phone: call.phone,
          startedAt: call.startedAt,
          device: "Mobile",
          save,
          relatedId: "contact-1",
          relatedType: "Client Contact",
        },
      },
      input,
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(database.activities.get("call-1")).toMatchObject({
      related_to_id: "contact-1",
      related_to_type: "Client Contact",
    });
  });

  it("retries partial follow-up saves using the existing task ID even after reopening", async () => {
    database.failTask = true;
    const scheduled = { ...input, followUpAt: "2026-11-14T06:00:00Z" };
    await expect(saveCallUpdates(call, scheduled)).rejects.toThrow("follow-up failed");
    await saveCallUpdates(call, { ...scheduled, followUpId: "new-dialog-id" });
    expect(database.activities.size).toBe(2);
    expect(database.activities.has("followup-1")).toBe(true);
    expect(database.activities.has("new-dialog-id")).toBe(false);
  });

  it("preserves completed follow-ups when only the call notes are changed", async () => {
    const scheduled = { ...input, followUpAt: "2026-11-14T06:00:00Z" };
    await saveCallUpdates(call, scheduled);
    database.activities.get("followup-1")!["status"] = "Completed";
    await saveCallUpdates(call, { ...scheduled, notes: "Updated note" });
    expect(database.activities.get("followup-1")?.["status"]).toBe("Completed");
  });

  it("removes only this call's follow-up when its date is cleared", async () => {
    await saveCallUpdates(call, { ...input, followUpAt: "2026-11-14T06:00:00Z" });
    database.activities.set("unrelated", {
      id: "unrelated",
      service_details: { call_log_id: "another-call" },
    });
    await saveCallUpdates(call, input);
    expect(database.activities.has("followup-1")).toBe(false);
    expect(database.activities.has("unrelated")).toBe(true);
  });

  it("does not save updates without an authenticated user", async () => {
    database.signedIn = false;
    await expect(saveCallUpdates(call, input)).rejects.toThrow("Sign in");
    expect(database.writes).not.toHaveBeenCalled();
  });
});

describe("CRM user filters", () => {
  it("shows all users without selecting a caller identity", () => {
    expect(callMatchesUser("Actual Caller", null)).toBe(true);
    expect(callMatchesUser(null, null)).toBe(true);
  });
  it("filters a user while handling legacy name casing and spacing", () => {
    expect(callMatchesUser(" Meghana M ", callUserKey("meghana m"))).toBe(true);
    expect(callMatchesUser("Edward D", callUserKey("Meghana M"))).toBe(false);
    expect(callMatchesUser(null, callUserKey("Meghana M"))).toBe(false);
    expect(callMatchesUser(null, "")).toBe(true);
  });
});
