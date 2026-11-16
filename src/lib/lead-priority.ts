import type { LeadPriority } from "./crm";

export const LEAD_PRIORITY_STYLES: Record<LeadPriority, { pill: string; dot: string }> = {
  Hot: {
    pill: "border-red-300 bg-red-100 text-red-800",
    dot: "bg-red-500",
  },
  Warm: {
    pill: "border-amber-300 bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  Cold: {
    pill: "border-blue-300 bg-blue-100 text-blue-800",
    dot: "bg-blue-500",
  },
};

export function leadPriorityStyle(value: string | null | undefined) {
  return value === "Hot" || value === "Warm" || value === "Cold"
    ? LEAD_PRIORITY_STYLES[value]
    : null;
}
