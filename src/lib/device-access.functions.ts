import { createHash, randomBytes, randomInt } from "node:crypto";

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const deviceInfoSchema = z.object({
  label: z.string().trim().min(2).max(80),
  type: z.enum(["laptop", "mobile", "tablet", "other"]),
  browser: z.string().trim().max(80).optional(),
  operatingSystem: z.string().trim().max(80).optional(),
});

const enrollmentSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  device: deviceInfoSchema,
});

const tokenSchema = z.object({ token: z.string().min(32).max(256).optional() });
const memberSchema = z.object({ memberId: z.string().uuid() });
const deviceSchema = z.object({ deviceId: z.string().uuid() });
const enforcementSchema = memberSchema.extend({ required: z.boolean() });

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function requestIp() {
  const headers = getRequest()?.headers;
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers?.get("x-real-ip") || null;
}

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requirePrimaryAdmin(userId: string) {
  const supabase = await adminClient();
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
      .eq("token_hash", hash(token))
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!device) throw new Error("This work device is not registered.");
  }
  return supabase;
}

export type DeviceAccessStatus = {
  required: boolean;
  approved: boolean;
  deviceId: string | null;
};

export const checkCrmDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data, context }): Promise<DeviceAccessStatus> => {
    const supabase = await adminClient();
    const { data: member, error: memberError } = await supabase
      .from("bd_team_members")
      .select("device_access_required")
      .eq("id", context.userId)
      .maybeSingle();
    if (memberError || !member) throw new Error("CRM membership could not be verified.");
    if (!member.device_access_required) return { required: false, approved: true, deviceId: null };
    if (!data.token) return { required: true, approved: false, deviceId: null };

    const { data: device, error } = await supabase
      .from("crm_devices")
      .select("id")
      .eq("user_id", context.userId)
      .eq("token_hash", hash(data.token))
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !device) return { required: true, approved: false, deviceId: null };

    await supabase
      .from("crm_devices")
      .update({ last_seen_at: new Date().toISOString(), last_ip: requestIp() })
      .eq("id", device.id);
    return { required: true, approved: true, deviceId: device.id };
  });

export const enrollCrmDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => enrollmentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = await adminClient();
    const now = new Date().toISOString();
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("crm_device_enrollment_codes")
      .select("id,created_by")
      .eq("user_id", context.userId)
      .eq("code_hash", hash(data.code))
      .is("used_at", null)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (enrollmentError || !enrollment) {
      throw new Error("This enrolment code is invalid or has expired.");
    }

    const { data: member, error: memberError } = await supabase
      .from("bd_team_members")
      .select("device_limit")
      .eq("id", context.userId)
      .maybeSingle();
    if (memberError || !member) {
      throw new Error("CRM membership could not be verified.");
    }

    const { count } = await supabase
      .from("crm_devices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .gt("expires_at", now);
    if ((count ?? 0) >= member.device_limit) {
      throw new Error(
        `This account already has ${member.device_limit} approved devices. Ask an administrator to revoke one first.`,
      );
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const { error: insertError } = await supabase.from("crm_devices").insert({
      user_id: context.userId,
      device_label: data.device.label,
      device_type: data.device.type,
      browser: data.device.browser ?? null,
      operating_system: data.device.operatingSystem ?? null,
      token_hash: hash(token),
      approved_by: enrollment.created_by,
      expires_at: expiresAt.toISOString(),
      last_seen_at: now,
      last_ip: requestIp(),
    });
    if (insertError) throw new Error(`The device could not be registered: ${insertError.message}`);

    await supabase
      .from("crm_device_enrollment_codes")
      .update({ used_at: now })
      .eq("id", enrollment.id);
    return { token };
  });

export const generateDeviceEnrollmentCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => memberSchema.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = await requirePrimaryAdmin(context.userId);
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await supabase
      .from("crm_device_enrollment_codes")
      .delete()
      .eq("user_id", data.memberId)
      .is("used_at", null);
    const { error } = await supabase.from("crm_device_enrollment_codes").insert({
      user_id: data.memberId,
      code_hash: hash(code),
      created_by: context.userId,
      expires_at: expiresAt.toISOString(),
    });
    if (error) throw new Error(`An enrolment code could not be created: ${error.message}`);
    return { code, expiresAt: expiresAt.toISOString() };
  });

export const listCrmDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = await requirePrimaryAdmin(context.userId);
    const { data, error } = await supabase
      .from("crm_devices")
      .select(
        "id,user_id,device_label,device_type,browser,operating_system,approved_at,expires_at,last_seen_at,last_ip,revoked_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Devices could not be loaded: ${error.message}`);
    return data ?? [];
  });

export const revokeCrmDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => deviceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = await requirePrimaryAdmin(context.userId);
    const { error } = await supabase
      .from("crm_devices")
      .update({ revoked_at: new Date().toISOString(), revoked_by: context.userId })
      .eq("id", data.deviceId)
      .is("revoked_at", null);
    if (error) throw new Error(`The device could not be revoked: ${error.message}`);
    return { success: true };
  });

export const setDeviceEnforcement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => enforcementSchema.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = await requirePrimaryAdmin(context.userId);
    const { error } = await supabase
      .from("bd_team_members")
      .update({ device_access_required: data.required, updated_at: new Date().toISOString() })
      .eq("id", data.memberId);
    if (error) throw new Error(`Device enforcement could not be updated: ${error.message}`);
    return { success: true };
  });
