import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchCrmVersion } from "@/lib/crm-version";

declare const __CRM_BUILD_ID__: string;

export function UpdateBanner() {
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const snoozed = useRef<{ version: string; until: number } | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let disposed = false;
    let checking = false;
    let controller: AbortController | null = null;

    const check = async () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 10_000);
      try {
        const version = await fetchCrmVersion(controller.signal);
        if (disposed || !version) return;
        if (version === __CRM_BUILD_ID__) {
          setAvailableVersion(null);
        } else if (snoozed.current?.version !== version || snoozed.current.until <= Date.now()) {
          setAvailableVersion(version);
        }
      } catch {
        // A failed version check must never interrupt CRM work.
      } finally {
        window.clearTimeout(timeout);
        checking = false;
      }
    };

    const firstCheck = window.setTimeout(() => void check(), 5_000);
    const interval = window.setInterval(() => void check(), 60_000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearTimeout(firstCheck);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  if (!availableVersion) return null;

  return (
    <section
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="mx-3 my-3 flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 text-foreground sm:mx-5 sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <RefreshCw className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold sm:text-base">A new CRM update is available</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Refresh to load the latest changes. Save any unfinished work first.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <Button className="min-h-10" onClick={() => window.location.reload()}>
          Refresh now
        </Button>
        <Button
          variant="ghost"
          className="min-h-10 text-primary"
          onClick={() => {
            snoozed.current = { version: availableVersion, until: Date.now() + 30 * 60_000 };
            setAvailableVersion(null);
          }}
        >
          Later
        </Button>
      </div>
    </section>
  );
}
