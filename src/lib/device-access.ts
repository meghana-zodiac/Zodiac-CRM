export const CRM_DEVICE_TOKEN_STORAGE_KEY = "zodiac-crm-device-token.v1";

export function getCrmDeviceToken() {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(CRM_DEVICE_TOKEN_STORAGE_KEY) ?? undefined;
}

export function saveCrmDeviceToken(token: string) {
  window.localStorage.setItem(CRM_DEVICE_TOKEN_STORAGE_KEY, token);
}

export function detectDevice() {
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const mobile = /Android|iPhone|Mobile/i.test(agent);
  const tablet = /iPad|Tablet/i.test(agent);
  const browser = /Edg/i.test(agent)
    ? "Edge"
    : /CriOS|Chrome/i.test(agent)
      ? "Chrome"
      : /Safari/i.test(agent)
        ? "Safari"
        : /Firefox/i.test(agent)
          ? "Firefox"
          : "Web browser";
  const operatingSystem = /iPhone|iPad/i.test(agent)
    ? "iOS"
    : /Android/i.test(agent)
      ? "Android"
      : /Windows/i.test(agent)
        ? "Windows"
        : /Macintosh|Mac OS/i.test(agent)
          ? "macOS"
          : "Unknown";
  const type = tablet ? "tablet" : mobile ? "mobile" : "laptop";
  return {
    type: type as "laptop" | "mobile" | "tablet",
    browser,
    operatingSystem,
    label: `Work ${type} · ${browser}`,
  };
}
