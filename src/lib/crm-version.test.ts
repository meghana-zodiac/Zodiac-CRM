import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCrmVersion } from "./crm-version";

afterEach(() => vi.unstubAllGlobals());

describe("CRM deployment checks", () => {
  it("fetches a fresh version manifest without a cached response", async () => {
    const signal = new AbortController().signal;
    const fetch = vi.fn().mockResolvedValue(Response.json({ version: "release-2" }));
    vi.stubGlobal("fetch", fetch);
    expect(await fetchCrmVersion(signal)).toBe("release-2");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/crm-version\.json\?t=\d+$/),
      expect.objectContaining({ cache: "no-store", signal }),
    );
  });

  it.each([null, {}, { version: 2 }, { version: "  " }])(
    "ignores an invalid manifest: %j",
    async (body) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
      expect(await fetchCrmVersion(new AbortController().signal)).toBeNull();
    },
  );

  it("ignores HTML sign-in or fallback pages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Sign in</html>")));
    expect(await fetchCrmVersion(new AbortController().signal)).toBeNull();
  });

  it("ignores failed responses even when they contain a version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ version: "bad" }, { status: 503 })),
    );
    expect(await fetchCrmVersion(new AbortController().signal)).toBeNull();
  });

  it("allows callers to handle offline failures without inventing an update", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Offline")));
    await expect(fetchCrmVersion(new AbortController().signal)).rejects.toThrow("Offline");
  });
});
