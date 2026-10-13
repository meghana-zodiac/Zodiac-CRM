import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Laptop, Loader2, LockKeyhole, LogOut, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { enrollCrmDevice } from "@/lib/device-access.functions";
import { detectDevice, saveCrmDeviceToken } from "@/lib/device-access";

export function DeviceRegistration({ onApproved }: { onApproved: () => void }) {
  const enroll = useServerFn(enrollCrmDevice);
  const [device] = useState(detectDevice);
  const [label, setLabel] = useState(device.label);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const register = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the six-digit code provided by your CRM administrator.");
      return;
    }
    setSaving(true);
    try {
      const result = await enroll({ data: { code, device: { ...device, label } } });
      saveCrmDeviceToken(result.token);
      toast.success("This work device is now registered.");
      onApproved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This device could not be registered.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
          {device.type === "mobile" ? (
            <Smartphone className="size-7" />
          ) : (
            <Laptop className="size-7" />
          )}
        </span>
        <h1 className="mt-5 text-center text-xl font-semibold">Register this work device</h1>
        <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">
          This account is restricted to Zodiac-issued devices. Ask Meghana or Preetam for a one-time
          registration code; it expires after ten minutes.
        </p>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="device-label">Device name</Label>
            <Input
              id="device-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="device-code">One-time code</Label>
            <Input
              id="device-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-lg tracking-[0.35em]"
            />
          </div>
          <Button
            className="w-full"
            onClick={register}
            disabled={saving || label.trim().length < 2}
          >
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <LockKeyhole className="mr-2 size-4" />
            )}
            Register device
          </Button>
        </div>
        <button
          onClick={() => void supabase.auth.signOut()}
          className="mx-auto mt-5 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </section>
    </main>
  );
}
