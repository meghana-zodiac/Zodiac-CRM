import type { User } from "@supabase/supabase-js";

export const ORGANIZATION_EMAIL_DOMAIN = "zodiachrc.com";

export function isOrganizationEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const normalizedEmail = email.trim().toLowerCase();
  const separatorIndex = normalizedEmail.lastIndexOf("@");

  return (
    separatorIndex > 0 && normalizedEmail.slice(separatorIndex + 1) === ORGANIZATION_EMAIL_DOMAIN
  );
}

export function isOrganizationGoogleUser(user: User | null): boolean {
  if (!user || !isOrganizationEmail(user.email)) return false;

  const providers = new Set([
    user.app_metadata.provider,
    ...(Array.isArray(user.app_metadata.providers) ? user.app_metadata.providers : []),
  ]);

  return providers.has("google");
}
