import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWebPushPublicKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(() => {
    const publicKey = process.env["VAPID_PUBLIC_KEY"];
    if (!publicKey) throw new Error("Device notifications are not configured yet.");
    return { publicKey };
  });
