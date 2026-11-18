import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function requirePrimaryAdmin(userId: string) {
  const supabase = supabaseAdmin;
  const { data, error } = await supabase
    .from("bd_team_members")
    .select("id,device_access_required")
    .eq("id", userId)
    .eq("active", true)
    .eq("access_status", "approved")
    .eq("access_role", "primary_admin")
    .maybeSingle();
  if (error || !data) throw new Error("Primary administrator access is required.");
  if (data.device_access_required) {
    const token = getRequest()?.headers.get("x-zodiac-device-token");
    if (!token) throw new Error("This work device is not registered.");
    const { data: device } = await supabase
      .from("crm_devices")
      .select("id")
      .eq("user_id", userId)
      .eq("token_hash", createHash("sha256").update(token).digest("hex"))
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!device) throw new Error("This work device is not registered.");
  }
  return supabase;
}
