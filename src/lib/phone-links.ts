/** WhatsApp requires the international digits without the leading plus sign. */
export function whatsappNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  // Explicit international numbers must never receive an extra Indian prefix.
  if (value.trim().startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  return digits.length === 10
    ? `91${digits}`
    : digits.length === 11 && digits.startsWith("0")
      ? `91${digits.slice(1)}`
      : digits;
}
