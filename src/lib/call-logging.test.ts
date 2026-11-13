import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: (table: string) =>
      table === "bd_team_members"
        ? { select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }
        : { upsert: mocks.upsert },
  },
}));

import { createCallLogAttempt } from "./call-logging";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "rep", email: "rep@example.com", user_metadata: { full_name: "Rep" } } },
    error: null,
  });
  mocks.maybeSingle.mockResolvedValue({ data: { display_name: "CRM Rep" } });
  mocks.upsert.mockResolvedValue({ error: null });
});

describe("automatic call logs", () => {
  it.each(["Android Mobile", "iPhone", "iPad"])(
    "saves a %s attempt without a review form",
    async (ua) => {
      const attempt = createCallLogAttempt("+919876543210", ua);
      await attempt.save();
      expect(mocks.upsert).toHaveBeenCalledWith(
        {
          id: attempt.id,
          phone_number: "+919876543210",
          rep_name: "CRM Rep",
          call_type: "Call Initiated · Mobile",
          duration_seconds: null,
          created_at: new Date(attempt.startedAt).toISOString(),
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
    },
  );

  it("shares the write with optional review and does not insert again", async () => {
    const attempt = createCallLogAttempt("123", "Desktop");
    await Promise.all([attempt.save(), attempt.save()]);
    await attempt.save();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(attempt.device).toBe("Desktop");
  });

  it("retries a lost response with the same ID without overwriting details", async () => {
    mocks.upsert.mockResolvedValueOnce({ error: new Error("Response lost") });
    const attempt = createCallLogAttempt("123", "iPhone");
    await expect(attempt.save()).rejects.toThrow("Response lost");
    await attempt.save();
    const [first, retry] = mocks.upsert.mock.calls;
    expect(first?.[0].id).toBe(retry?.[0].id);
    expect(retry?.[1].ignoreDuplicates).toBe(true);
  });

  it("reports authentication failure instead of silently losing a log", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const attempt = createCallLogAttempt("123", "iPhone");
    await expect(attempt.save()).rejects.toThrow("Sign in");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("uses the signed-in name when team lookup is unavailable", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null });
    await createCallLogAttempt("123", "Android").save();
    expect(mocks.upsert.mock.calls[0]?.[0].rep_name).toBe("Rep");
  });

  it("assigns separate entries to separate call attempts", () => {
    expect(createCallLogAttempt("123", "Android").id).not.toBe(
      createCallLogAttempt("123", "Android").id,
    );
  });
});
