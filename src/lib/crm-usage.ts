import { supabase } from "@/integrations/supabase/client";

export type CrmUsageDevice = "desktop" | "mobile" | "tablet" | "unknown";

type UsageEventOptions = {
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  route?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

const SESSION_KEY = "zodiac-crm-usage-session";
const SESSION_STARTED_KEY = "zodiac-crm-usage-session-started";

function deviceDetails() {
  if (typeof window === "undefined") {
    return {
      deviceType: "unknown" as CrmUsageDevice,
      browser: "Unknown",
      operatingSystem: "Unknown",
    };
  }

  const ua = window.navigator.userAgent;
  const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua);
  const isMobile = /Android|iPhone|iPod|Mobile/i.test(ua) || window.innerWidth < 768;
  const deviceType: CrmUsageDevice = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  const browser = /Edg//i.test(ua)
    ? "Edge"
    : /OPR//i.test(ua)
      ? "Opera"
      : /Chrome//i.test(ua)
        ? "Chrome"
        : /Safari//i.test(ua)
          ? "Safari"
          : /Firefox//i.test(ua)
            ? "Firefox"
            : "Other";

  const operatingSystem = /iPhone|iPad|iPod/i.test(ua)
    ? "iOS"
    : /Android/i.test(ua)
      ? "Android"
      : /Mac OS X/i.test(ua)
        ? "macOS"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Other";

  return { deviceType, browser, operatingSystem };
}

function usageSessionKey() {
  if (typeof window === "undefined") return "";
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const created =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

export async function logCrmUsageEvent(
  eventType: string,
  action: string,
  options: UsageEventOptions = {},
) {
  if (typeof window === "undefined") return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const details = deviceDetails();
  const { error } = await supabase.from("crm_usage_events").insert({
    user_id: user.id,
    event_type: eventType,
    action,
    entity_type: options.entityType,
    entity_id: options.entityId,
    entity_label: options.entityLabel,
    device_type: details.deviceType,
    browser: details.browser,
    operating_system: details.operatingSystem,
    route: options.route ?? window.location.pathname,
    source: "client",
    metadata: options.metadata ?? {},
  });

  if (error) {
    console.warn("CRM usage event was not recorded", error.message);
  }
}

export async function trackCrmSession(pathname: string, logPageView = true) {
  if (typeof window === "undefined") return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const sessionKey = usageSessionKey();
  const details = deviceDetails();
  const { error } = await supabase.from("crm_usage_sessions").upsert(
    {
      user_id: user.id,
      session_key: sessionKey,
      device_type: details.deviceType,
      browser: details.browser,
      operating_system: details.operatingSystem,
      current_path: pathname,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,session_key" },
  );

  if (error) {
    console.warn("CRM usage session was not recorded", error.message);
    return;
  }

  if (!window.sessionStorage.getItem(SESSION_STARTED_KEY)) {
    window.sessionStorage.setItem(SESSION_STARTED_KEY, "true");
    await logCrmUsageEvent("session_started", "Started CRM session", { route: pathname });
  } else if (logPageView) {
    await logCrmUsageEvent("page_view", "Viewed CRM page", {
      route: pathname,
      metadata: { path: pathname },
    });
  }
}
