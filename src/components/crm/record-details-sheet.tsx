import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { FieldDef } from "./record-dialog";

function nestedValue(record: Record<string, unknown>, name: string) {
  return name.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, record);
}

function displayValue(value: unknown, field?: FieldDef) {
  if (value === null || value === undefined || value === "") return "—";
  if (field?.options) {
    const option = field.options.find((item) => item.value === String(value));
    if (option) return option.label;
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field?.type === "date" || field?.type === "datetime") {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date.toLocaleString("en-IN");
  }
  return String(value);
}

export function RecordDetailsSheet<T extends { id: string }>({
  record,
  fields,
  label,
  title,
  onClose,
  onEdit,
}: {
  record: T | null;
  fields: FieldDef[];
  label: string;
  title: (record: T) => string;
  onClose: () => void;
  onEdit?: (record: T) => void;
}) {
  const visibleFields = fields.filter((field) => field.type !== "hidden");

  return (
    <Sheet open={Boolean(record)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {record ? (
          <>
            <SheetHeader className="pr-8">
              <SheetTitle>{title(record)}</SheetTitle>
              <SheetDescription>
                Complete {label.toLowerCase()} information stored in the CRM.
              </SheetDescription>
            </SheetHeader>

            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {visibleFields.map((field) => (
                <div
                  key={field.name}
                  className={
                    field.span === 2
                      ? "rounded-lg bg-muted/50 p-3 sm:col-span-2"
                      : "rounded-lg bg-muted/50 p-3"
                  }
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                    {displayValue(
                      nestedValue(record as Record<string, unknown>, field.name),
                      field,
                    )}
                  </dd>
                </div>
              ))}
              <div className="rounded-lg bg-muted/50 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Created
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {displayValue((record as Record<string, unknown>)["created_at"], {
                    name: "created_at",
                    label: "Created",
                    type: "datetime",
                  })}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Last updated
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {displayValue((record as Record<string, unknown>)["updated_at"], {
                    name: "updated_at",
                    label: "Last updated",
                    type: "datetime",
                  })}
                </dd>
              </div>
            </dl>

            {onEdit ? (
              <Button className="mt-6 w-full" onClick={() => onEdit(record)}>
                <Pencil className="size-4" /> Edit {label}
              </Button>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
