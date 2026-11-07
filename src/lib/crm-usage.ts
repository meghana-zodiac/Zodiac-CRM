import { supabase } from "@/integrations/supabase/client";

export type CrmUsageDevice = "desktop" | "mobile" | "tablet" | "unknown";

type UsageEventOptions = {
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  route?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

type UsageRpcError = { message: string } | null;
type UsageRpc = (
  functionName: string,
  args: Record<string, unknown>,
) => Promise<{ error: UsageRpcError }>;

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

  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Safari\//i.test(ua)
          ? "Safari"
          : /Firefox\//i.test(ua)
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

async function recordUsage(
  pathname: string,
  eventType?: string,
  action?: string,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  const details = deviceDetails();
  const rpc = supabase.rpc.bind(supabase) as unknown as UsageRpc;
  return rpc("record_crm_usage", {
    p_session_key: usageSessionKey(),
    p_device_type: details.deviceType,
    p_browser: details.browser,
    p_operating_system: details.operatingSystem,
    p_route: pathname,
    p_event_type: eventType ?? null,
    p_action: action ?? null,
    p_metadata: metadata,
  });
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

  const route = options.route ?? window.location.pathname;
  const metadata = {
    ...options.metadata,
    ...(options.entityType ? { entity_type: options.entityType } : {}),
    ...(options.entityId ? { entity_id: options.entityId } : {}),
    ...(options.entityLabel ? { entity_label: options.entityLabel } : {}),
  };
  const { error } = await recordUsage(route, eventType, action, metadata);

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

  const sessionStarted = window.sessionStorage.getItem(SESSION_STARTED_KEY);
  const eventType = !sessionStarted ? "session_started" : logPageView ? "page_view" : undefined;
  const action = !sessionStarted
    ? "Started CRM session"
    : logPageView
      ? "Viewed CRM page"
      : undefined;
  const metadata = eventType === "page_view" ? { path: pathname } : {};

  const { error } = await recordUsage(pathname, eventType, action, metadata);

  if (error) {
    console.warn("CRM usage session was not recorded", error.message);
    return;
  }

  if (!sessionStarted) {
    window.sessionStorage.setItem(SESSION_STARTED_KEY, "true");
  }
}
