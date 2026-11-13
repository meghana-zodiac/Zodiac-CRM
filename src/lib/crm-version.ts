/** Ignore missing manifests, login pages, and failed/offline checks. */
export async function fetchCrmVersion(signal: AbortSignal): Promise<string | null> {
  const response = await fetch(`/crm-version.json?t=${Date.now()}`, {
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    return null;
  }
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("version" in data)) return null;
  return typeof data.version === "string" && data.version.trim() ? data.version.trim() : null;
}
