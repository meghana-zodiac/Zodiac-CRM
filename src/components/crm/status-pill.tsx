import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const toneMap: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  success: "bg-success/12 text-success ring-success/25",
  warning: "bg-warning/15 text-warning-foreground ring-warning/35",
  danger: "bg-destructive/10 text-destructive ring-destructive/25",
  info: "bg-info/12 text-info ring-info/25",
  primary: "bg-primary/10 text-primary ring-primary/20",
};

export function StatusPill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneMap[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Staffing / consulting SLA pipeline */
export function bdTone(stage: string): Tone {
  if (stage === "SLA Signed") return "success";
  if (stage === "SLA Negotiation") return "warning";
  if (stage === "Proposal Sent") return "info";
  if (stage === "Pitch Scheduled") return "primary";
  return "neutral";
}

/** Corporate lead qualification */
export function leadTone(status: string): Tone {
  if (status === "Converted") return "success";
  if (status === "Disqualified") return "danger";
  if (status === "Qualified") return "info";
  if (status === "Contacted") return "warning";
  return "primary";
}

/** L&D training pipeline */
export function trainingTone(status: string): Tone {
  if (status === "Completed & Invoiced") return "success";
  if (status === "Batch Scheduled") return "info";
  if (status === "Trainer Assigned") return "primary";
  if (status === "Curriculum & Quote Sent") return "warning";
  return "neutral";
}


export function batchTone(status: string): Tone {
  if (status === "Completed") return "success";
  if (status === "Cancelled") return "danger";
  if (status === "In Progress") return "warning";
  return "info";
}

export function trainingTypeTone(type: string): Tone {
  return type === "Technical" ? "info" : "primary";
}

export function priorityTone(priority: string): Tone {
  if (priority === "Critical") return "danger";
  if (priority === "High") return "warning";
  if (priority === "Low") return "neutral";
  return "info";
}

export function activityTone(status: string): Tone {
  if (status === "Completed") return "success";
  if (status === "In Progress") return "warning";
  return "neutral";
}
