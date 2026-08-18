import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { LEAD_SOURCES, LEAD_STATUSES, SERVICE_LINES, type Lead } from "@/lib/crm";

type RawRow = Record<string, unknown>;
type LeadField =
  | "company_name"
  | "contact_name"
  | "email"
  | "phone"
  | "industry"
  | "city"
  | "service_interest"
  | "source"
  | "status"
  | "estimated_value"
  | "owner_name"
  | "notes";

type ImportRow = {
  rowNumber: number;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  city: string | null;
  service_interest: string | null;
  source: string | null;
  status: string;
  estimated_value: number | null;
  owner_name: string | null;
  notes: string | null;
  error?: string;
};

const aliases: Record<LeadField, string[]> = {
  company_name: [
    "company",
    "company name",
    "organisation",
    "organization",
    "client",
    "client name",
  ],
  contact_name: ["contact", "contact name", "contact person", "decision maker", "poc", "poc name"],
  email: ["email", "email address", "work email", "official email", "email id"],
  phone: ["phone", "phone number", "mobile", "mobile number", "contact number", "telephone"],
  industry: ["industry", "sector", "industry sector"],
  city: ["city", "location", "office location"],
  service_interest: [
    "service interest",
    "service",
    "service line",
    "requirement",
    "interested service",
  ],
  source: ["source", "lead source", "channel", "origin"],
  status: ["status", "lead status", "stage"],
  estimated_value: [
    "estimated value",
    "value",
    "deal value",
    "potential value",
    "estimated revenue",
    "amount",
  ],
  owner_name: ["owner", "owner name", "assigned to", "bd owner", "relationship owner"],
  notes: ["notes", "remarks", "comments", "qualification notes", "description"],
};

const clean = (value: unknown) => String(value ?? "").trim();
const cleanHeader = (value: string) =>
  value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
const nullable = (value: string) => value || null;
const identityKey = (value: string | null | undefined) => clean(value).toLowerCase();

function valueFor(row: RawRow, field: LeadField): string {
  const header = Object.keys(row).find((key) => aliases[field].includes(cleanHeader(key)));
  return header ? clean(row[header]) : "";
}

function numberValue(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function enumValue(value: string, values: readonly string[]): string | null {
  if (!value) return null;
  return values.find((item) => item.toLowerCase() === value.toLowerCase()) ?? null;
}

function parseWorkbook(buffer: ArrayBuffer): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("The workbook does not contain a worksheet.");
  const source = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], {
    defval: "",
    raw: false,
  });

  return source.map((row, index) => {
    const companyName = valueFor(row, "company_name");
    const statusRaw = valueFor(row, "status");
    const sourceRaw = valueFor(row, "source");
    const serviceRaw = valueFor(row, "service_interest");
    const valueRaw = valueFor(row, "estimated_value");
    const estimatedValue = numberValue(valueRaw);
    const status = statusRaw ? enumValue(statusRaw, LEAD_STATUSES) : "New";
    const sourceValue = sourceRaw ? enumValue(sourceRaw, LEAD_SOURCES) : null;
    const service = serviceRaw ? enumValue(serviceRaw, SERVICE_LINES) : null;
    const errors = [
      !companyName ? "Company name is required" : "",
      statusRaw && !status ? `Unknown status: ${statusRaw}` : "",
      sourceRaw && !sourceValue ? `Unknown source: ${sourceRaw}` : "",
      serviceRaw && !service ? `Unknown service: ${serviceRaw}` : "",
      valueRaw && estimatedValue === null ? "Estimated value must be a number" : "",
      estimatedValue !== null && estimatedValue < 0 ? "Estimated value cannot be negative" : "",
    ].filter(Boolean);

    return {
      rowNumber: index + 2,
      company_name: companyName,
      contact_name: nullable(valueFor(row, "contact_name")),
      email: nullable(valueFor(row, "email")),
      phone: nullable(valueFor(row, "phone")),
      industry: nullable(valueFor(row, "industry")),
      city: nullable(valueFor(row, "city")),
      service_interest: service,
      source: sourceValue,
      status: status ?? "New",
      estimated_value: estimatedValue,
      owner_name: nullable(valueFor(row, "owner_name")),
      notes: nullable(valueFor(row, "notes")),
      error: errors.length ? errors.join("; ") : undefined,
    };
  });
}

export function LeadImportDialog({
  open,
  onOpenChange,
  leads,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const validCount = rows.filter((row) => !row.error).length;
  const errorCount = rows.length - validCount;
  const preview = useMemo(() => rows.slice(0, 12), [rows]);

  const reset = () => {
    setFileName("");
    setRows([]);
    setHeaders([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });
      setHeaders((matrix[0] ?? []).map(clean).filter(Boolean));
      const parsed = parseWorkbook(buffer);
      if (!parsed.length) throw new Error("The first worksheet has no data rows.");
      setRows(parsed);
      setFileName(file.name);
    } catch (error) {
      reset();
      toast.error((error as Error).message);
    }
  };

  const downloadTemplate = () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      [
        "Company Name",
        "Contact Person",
        "Email",
        "Phone",
        "Industry",
        "City",
        "Service Interest",
        "Lead Source",
        "Lead Status",
        "Estimated Value",
        "Owner",
        "Notes",
      ],
      [
        "Vertex Global Services",
        "Rahul Menon",
        "rahul@vertexglobal.in",
        "+91 98450 11223",
        "IT Services",
        "Bengaluru",
        "Recruitment & Staffing",
        "LinkedIn Outreach",
        "New",
        "1200000",
        "Nuzhat",
        "Looking for mid-level technology hiring support.",
      ],
    ]);
    sheet["!cols"] = [24, 22, 30, 20, 20, 18, 34, 22, 18, 18, 18, 52].map((wch) => ({ wch }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Corporate Leads");
    XLSX.writeFile(workbook, "zodiac-crm-corporate-leads-template.xlsx");
  };

  const importRows = async () => {
    setImporting(true);
    try {
      const byEmail = new Map(
        leads.filter((lead) => lead.email).map((lead) => [identityKey(lead.email), lead]),
      );
      const byCompanyContact = new Map(
        leads.map((lead) => [
          `${identityKey(lead.company_name)}:${identityKey(lead.contact_name)}`,
          lead,
        ]),
      );
      const seen = new Set<string>();
      const payload: Array<Record<string, unknown>> = [];
      let skipped = errorCount;
      let inserted = 0;
      let updated = 0;

      for (const row of rows) {
        if (row.error) continue;
        const duplicateKey = row.email
          ? `email:${identityKey(row.email)}`
          : `lead:${identityKey(row.company_name)}:${identityKey(row.contact_name)}`;
        if (seen.has(duplicateKey)) {
          skipped += 1;
          continue;
        }
        seen.add(duplicateKey);
        const match = row.email
          ? byEmail.get(identityKey(row.email))
          : byCompanyContact.get(
              `${identityKey(row.company_name)}:${identityKey(row.contact_name)}`,
            );
        payload.push({
          ...(match ? { id: match.id } : {}),
          company_name: row.company_name,
          contact_name: row.contact_name,
          email: row.email,
          phone: row.phone,
          industry: row.industry,
          city: row.city,
          service_interest: row.service_interest,
          source: row.source,
          status: row.status,
          estimated_value: row.estimated_value,
          owner_name: row.owner_name,
          notes: row.notes,
        });
        if (match) updated += 1;
        else inserted += 1;
      }

      if (!payload.length) throw new Error("There are no valid rows to import.");
      for (let index = 0; index < payload.length; index += 200) {
        const { error } = await supabase.from("leads").upsert(payload.slice(index, index + 200));
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Import complete: ${inserted} added, ${updated} updated, ${skipped} skipped.`);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !importing) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Corporate Leads</DialogTitle>
          <DialogDescription>
            Upload Excel or CSV. Headers are detected automatically. Matching email—or company and
            contact—updates an existing lead.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
            <Button type="button" onClick={() => inputRef.current?.click()}>
              <Upload className="size-4" /> Choose Excel file
            </Button>
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              <Download className="size-4" /> Download template
            </Button>
            {fileName ? <span className="text-sm text-muted-foreground">{fileName}</span> : null}
          </div>
          {!rows.length ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <FileSpreadsheet className="mx-auto size-9 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Upload .xlsx, .xls, or .csv</p>
              <p className="text-xs text-muted-foreground">
                Only Company Name is required. Missing status defaults to New.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                  {validCount} valid
                </span>
                {errorCount ? (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">
                    {errorCount} invalid
                  </span>
                ) : null}
                <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  Detected {headers.length} columns
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[1200px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      {[
                        "Row",
                        "Company",
                        "Contact",
                        "Email",
                        "Phone",
                        "Industry",
                        "City",
                        "Service",
                        "Source",
                        "Status",
                        "Value",
                        "Owner",
                        "Result",
                      ].map((header) => (
                        <th key={header} className="px-3 py-2">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
                        <td className="px-3 py-2 font-medium">{row.company_name || "—"}</td>
                        <td className="px-3 py-2">{row.contact_name ?? "—"}</td>
                        <td className="px-3 py-2">{row.email ?? "—"}</td>
                        <td className="px-3 py-2">{row.phone ?? "—"}</td>
                        <td className="px-3 py-2">{row.industry ?? "—"}</td>
                        <td className="px-3 py-2">{row.city ?? "—"}</td>
                        <td className="max-w-56 truncate px-3 py-2">
                          {row.service_interest ?? "—"}
                        </td>
                        <td className="px-3 py-2">{row.source ?? "—"}</td>
                        <td className="px-3 py-2">{row.status}</td>
                        <td className="px-3 py-2">{row.estimated_value ?? "—"}</td>
                        <td className="px-3 py-2">{row.owner_name ?? "—"}</td>
                        <td
                          className={
                            row.error ? "px-3 py-2 text-red-600" : "px-3 py-2 text-emerald-700"
                          }
                        >
                          {row.error ?? "Ready"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > preview.length ? (
                <p className="text-xs text-muted-foreground">
                  Previewing 12 of {rows.length} rows.
                </p>
              ) : null}
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!validCount || importing}
            onClick={() => void importRows()}
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {importing ? "Importing…" : `Import ${validCount} leads`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
