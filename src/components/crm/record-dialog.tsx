import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createRecord, updateRecord, type CrmTable } from "@/lib/crm";
import { parseSmartPaste, SMART_PASTE_TABLES } from "@/lib/lead-smart-paste";

export type FieldType =
  "text" | "email" | "tel" | "number" | "date" | "datetime" | "select" | "textarea";

export type FieldDef = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  span?: 1 | 2;
  /** Only show this field when the field named here has one of `showWhen` values. */
  dependsOn?: string;
  showWhen?: readonly string[];
};

/** Reads a possibly dotted path (e.g. "service_details.tat_days") off a record. */
function readPath(record: Record<string, unknown> | null | undefined, path: string): unknown {
  if (!record) return undefined;
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      record,
    );
}

function writePath(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let node = target;
  for (const key of keys.slice(0, -1)) {
    if (typeof node[key] !== "object" || node[key] === null) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]!] = value;
}

type Values = Record<string, string>;
type PasteConflict = {
  field: string;
  label: string;
  current: string;
  incoming: string;
};

function toInputValue(type: FieldType, raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (type === "datetime") return new Date(String(raw)).toISOString().slice(0, 16);
  if (type === "date") return String(raw).slice(0, 10);
  return String(raw);
}

export function RecordDialog({
  open,
  onOpenChange,
  table,
  title,
  description,
  fields,
  record,
  invalidateKeys,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: CrmTable;
  title: string;
  description?: string;
  fields: FieldDef[];
  record?: Record<string, unknown> | null;
  invalidateKeys?: string[];
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Values>({});
  const [pasteText, setPasteText] = useState("");
  const [pasteConflicts, setPasteConflicts] = useState<PasteConflict[]>([]);

  useEffect(() => {
    if (!open) return;
    const next: Values = {};
    for (const field of fields) {
      const value = toInputValue(field.type ?? "text", readPath(record, field.name));
      next[field.name] = value;
    }
    setValues(next);
    setPasteText("");
    setPasteConflicts([]);
  }, [open, record, fields]);

  const sortPastedDetails = () => {
    const parsed = parseSmartPaste(table, pasteText);
    for (const field of fields) {
      const parsedValue = parsed[field.name];
      if (!parsedValue || !field.options?.length) continue;
      const normalized = parsedValue.toLowerCase();
      const match = field.options.find(
        (option) =>
          option.value.toLowerCase() === normalized ||
          option.label.toLowerCase() === normalized ||
          normalized.includes(option.label.toLowerCase()),
      );
      if (match) parsed[field.name] = match.value;
      else delete parsed[field.name];
    }
    setValues((current) => {
      const next = { ...current };
      const conflicts: PasteConflict[] = [];
      for (const [fieldName, incoming] of Object.entries(parsed)) {
        if (!incoming) continue;
        const existing = current[fieldName]?.trim() ?? "";
        if (!existing) {
          next[fieldName] = incoming;
          continue;
        }
        if (existing.toLowerCase() === incoming.trim().toLowerCase()) continue;
        conflicts.push({
          field: fieldName,
          label: fields.find((field) => field.name === fieldName)?.label ?? fieldName,
          current: existing,
          incoming,
        });
      }
      setPasteConflicts(conflicts);
      return next;
    });
    toast.success(
      record?.["id"]
        ? "Empty fields were filled. Review any differences before saving."
        : "Details sorted into the form. Please review before saving.",
    );
  };

  const applyPastedValue = (conflict: PasteConflict) => {
    setValues((current) => ({ ...current, [conflict.field]: conflict.incoming }));
    setPasteConflicts((current) => current.filter((item) => item.field !== conflict.field));
  };

  const visibleFields = fields.filter(
    (field) =>
      !field.dependsOn ||
      (field.showWhen ?? []).some(
        (allowed) =>
          (values[field.dependsOn!] ?? "").trim().toLowerCase() === allowed.toLowerCase(),
      ),
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {};
      for (const field of visibleFields) {
        const raw = values[field.name]?.trim() ?? "";
        if (raw === "") {
          writePath(payload, field.name, null);
          continue;
        }
        if (field.type === "number") writePath(payload, field.name, Number(raw));
        else if (field.type === "datetime")
          writePath(payload, field.name, new Date(raw).toISOString());
        else if (field.type === "select" && field.options?.length) {
          const match = field.options.find(
            (option) =>
              option.label.toLowerCase() === raw.toLowerCase() ||
              option.value.toLowerCase() === raw.toLowerCase(),
          );
          const isIdField = field.options.some((option) => option.value !== option.label);
          writePath(payload, field.name, match ? match.value : isIdField ? null : raw);
        } else writePath(payload, field.name, raw);
      }
      if (record?.["id"]) {
        await updateRecord(table, String(record["id"]), payload);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await createRecord(table as any, payload as any);
      }
    },
    onSuccess: () => {
      for (const key of invalidateKeys ?? [table]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success(record?.["id"] ? "Record updated" : "Record created");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const missingRequired = visibleFields.some(
    (field) => field.required && !(values[field.name] ?? "").trim(),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {SMART_PASTE_TABLES.includes(table) ? (
          <section className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="mb-2">
              <Label
                htmlFor={`${table}-smart-paste`}
                className="text-sm font-semibold text-foreground"
              >
                Paste details
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {record?.["id"]
                  ? "Empty fields will be filled. Existing information will not be replaced without your approval."
                  : "Paste the information, then review the fields before creating the record."}
              </p>
            </div>
            <Textarea
              id={`${table}-smart-paste`}
              rows={5}
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2"
              disabled={!pasteText.trim()}
              onClick={sortPastedDetails}
            >
              Sort into fields
            </Button>
            {pasteConflicts.length ? (
              <div className="mt-3 space-y-2 border-t border-primary/15 pt-3">
                <p className="text-xs font-semibold text-foreground">
                  Review differences ({pasteConflicts.length})
                </p>
                {pasteConflicts.map((conflict) => (
                  <div
                    key={conflict.field}
                    className="rounded-md border border-border bg-background p-2.5"
                  >
                    <p className="text-xs font-semibold text-foreground">{conflict.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Current: {conflict.current}
                    </p>
                    <p className="text-xs text-muted-foreground">Pasted: {conflict.incoming}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-xs"
                      onClick={() => applyPastedValue(conflict)}
                    >
                      Use pasted value
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleFields.map((field) => {
            const type = field.type ?? "text";
            return (
              <div
                key={field.name}
                className={field.span === 2 || type === "textarea" ? "sm:col-span-2" : undefined}
              >
                <Label
                  htmlFor={field.name}
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  {field.label}
                  {field.required ? <span className="text-destructive"> *</span> : null}
                </Label>
                {type === "select" ? (
                  <Select
                    value={values[field.name] || undefined}
                    onValueChange={(value) =>
                      setValues((prev) => ({ ...prev, [field.name]: value }))
                    }
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options ?? []).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : type === "textarea" ? (
                  <Textarea
                    id={field.name}
                    rows={3}
                    value={values[field.name] ?? ""}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                    }
                  />
                ) : (
                  <Input
                    id={field.name}
                    type={
                      type === "datetime"
                        ? "datetime-local"
                        : type === "number"
                          ? "number"
                          : type === "date"
                            ? "date"
                            : type
                    }
                    value={values[field.name] ?? ""}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={missingRequired || mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : record?.["id"] ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
