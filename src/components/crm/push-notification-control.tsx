import { useEffect, useState } from "react";
import { BellOff, BellRing, Info } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getWebPushPublicKey } from "@/lib/push-notifications.functions";
import {
  currentPushSubscription,
  disablePushNotifications,
  enablePushNotifications,
  isIosBrowser,
  isStandaloneWebApp,
  pushSupported,
  showTestNotification,
} from "@/lib/push-notifications";

type PushState = "checking" | "unsupported" | "needs-install" | "blocked" | "disabled" | "enabled";

export function PushNotificationControl() {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const getPublicKey = useServerFn(getWebPushPublicKey);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (isIosBrowser() && !isStandaloneWebApp()) return active && setState("needs-install");
      if (!pushSupported()) return active && setState("unsupported");
      if (Notification.permission === "denied") return active && setState("blocked");
      const subscription = await currentPushSubscription();
      if (active) setState(subscription ? "enabled" : "disabled");
    };
    void check();
    return () => {
      active = false;
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const { publicKey } = await getPublicKey();
      await enablePushNotifications(publicKey);
      setState("enabled");
      toast.success("Device popup notifications enabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notifications could not be enabled.");
      if (Notification.permission === "denied") setState("blocked");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await disablePushNotifications();
      setState("disabled");
      toast.success("Device popup notifications disabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notifications could not be disabled.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    try {
      await showTestNotification();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The test notification failed.");
    }
  };

  if (state === "checking") return null;
  if (state === "needs-install") {
    return (
      <div className="border-b border-border bg-accent/30 px-5 py-3 text-xs text-muted-foreground">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          On iPhone, tap Share → Add to Home Screen, open Zodiac CRM from its new icon, then enable
          notifications here.
        </p>
      </div>
    );
  }
  if (state === "unsupported") {
    return (
      <p className="border-b border-border px-5 py-3 text-xs text-muted-foreground">
        This browser does not support device popup notifications.
      </p>
    );
  }
  if (state === "blocked") {
    return (
      <p className="border-b border-border px-5 py-3 text-xs text-destructive">
        Notifications are blocked. Allow them in this browser’s site settings, then reopen the CRM.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-border bg-accent/20 px-5 py-3">
      {state === "enabled" ? (
        <BellRing className="size-4 shrink-0 text-emerald-600" />
      ) : (
        <BellOff className="size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">Device popup notifications</p>
        <p className="text-[11px] text-muted-foreground">
          {state === "enabled"
            ? "Enabled on this browser"
            : "Get reminders even when the CRM tab is closed"}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {state === "enabled" ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={test}>
            Test
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={state === "enabled" ? "ghost" : "default"}
          disabled={busy}
          onClick={state === "enabled" ? disable : enable}
        >
          {busy ? "Please wait…" : state === "enabled" ? "Disable" : "Enable"}
        </Button>
      </div>
    </div>
  );
}
