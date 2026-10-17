import { supabase } from "@/integrations/supabase/client";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = window.atob(base64);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIosBrowser() {
  return typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandaloneWebApp() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function enablePushNotifications(publicKey: string) {
  if (!pushSupported()) throw new Error("This browser does not support device notifications.");
  if (isIosBrowser() && !isStandaloneWebApp()) {
    throw new Error("On iPhone, add Zodiac CRM to the Home Screen before enabling notifications.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not allowed in this browser.");
  }

  const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(publicKey),
    }));
  const serialized = subscription.toJSON();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw authError ?? new Error("Please sign in again.");
  if (!serialized.endpoint || !serialized.keys?.["p256dh"] || !serialized.keys["auth"]) {
    throw new Error("The browser returned an incomplete notification subscription.");
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: auth.user.id,
      endpoint: serialized.endpoint,
      p256dh: serialized.keys["p256dh"],
      auth_key: serialized.keys["auth"],
      user_agent: navigator.userAgent,
      platform: navigator.platform || null,
      revoked_at: null,
      failure_count: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
  return subscription;
}

export async function disablePushNotifications() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", subscription.endpoint);
  if (error) throw new Error(error.message);
  await subscription.unsubscribe();
}

export async function showTestNotification() {
  if (Notification.permission !== "granted") {
    throw new Error("Notifications are not enabled on this device.");
  }
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification("Zodiac CRM test notification", {
    body: "Device popups are working on this browser.",
    icon: "/favicon.ico",
    tag: `zodiac-crm-test-${Date.now()}`,
    data: { href: "/tasks" },
  });
}
