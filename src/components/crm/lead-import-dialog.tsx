import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { LEAD_SOURCES, LEAD_STATUSES, type Lead } from "@/lib/crm";
import { bdTeamMembersQuery } from "@/lib/poa";

type RawRow = Record<string, unknown>;
type LeadField =
  | "company_name"
  | "contact_name"
  | "email"
  | "phone"
  | "phone_2"
  | "landline"
  | "designation"
  | "age_or_dob"
  | "industry"
  | "city"
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
  phone_2: string | null;
  landline: string | null;
  designation: string | null;
  age_or_dob: string | null;
  industry: string | null;
  city: string | null;
  source: string | null;
  status: string;
  estimated_value: number | null;
  owner_name: string | null;
  notes: string | null;
  error?: string;
  duplicate?: string;
};

const aliases: Record<LeadField, string[]> = {
  company_name: [
    "company",
    "company name",
    "organisation",
    "organization",
    "client",
    "client name",
    "current employer",
    "name of the current company",
    "name of current company",
  ],
  contact_name: [
    "contact",
    "contact name",
    "contact person",
    "decision maker",
    "poc",
    "poc name",
    "candidate name",
    "name",
  ],
  email: ["email", "email address", "work email", "official email", "email id"],
  phone: [
    "phone",
    "phone 1",
    "phone number",
    "mobile",
    "mobile 1",
    "mobile number",
    "contact number",
    "contact no.",
    "contact no",
    "telephone",
  ],
  phone_2: ["phone 2", "secondary phone", "alternate phone", "alternate mobile", "mobile 2"],
  landline: ["landline", "landline number", "office landline", "telephone landline"],
  designation: ["designation", "job title"],
  age_or_dob: ["age/date of birth", "age / date of birth", "age", "date of birth"],
  industry: ["industry", "sector", "industry sector"],
  city: ["city", "location", "office location", "current location"],
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

function valueForHeaders(row: RawRow, headers: string[]): string {
  const match = Object.keys(row).find((header) => headers.includes(cleanHeader(header)));
  return match ? clean(row[match]) : "";
}

function workbookRows(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("The workbook does not contain a worksheet.");
  const sheet = workbook.Sheets[firstSheet];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  const knownHeaders = new Set(Object.values(aliases).flat());
  const relativeHeaderIndex = matrix.findIndex((row) => {
    const cells = row.map((value) => cleanHeader(clean(value))).filter(Boolean);
    return (
      cells.some((cell) => knownHeaders.has(cell)) &&
      cells.some((cell) =>
        [
          "company name",
          "current employer",
          "name of the current company",
          "name of current company",
        ].includes(cell),
      )
    );
  });
  if (relativeHeaderIndex < 0) {
    throw new Error("Could not find the Name of the Current Company header row.");
  }
  const headers = (matrix[relativeHeaderIndex] ?? []).map(clean).filter(Boolean);
  const usedRange = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const headerIndex = usedRange.s.r + relativeHeaderIndex;
  const source = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: "",
    raw: false,
    range: headerIndex,
  });
  return { source, headers, headerIndex };
}

function comparablePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function phoneKeys(record: {
  phone: string | null;
  phone_2: string | null;
  landline: string | null;
}) {
  return [record.phone, record.phone_2, record.landline]
    .filter((value): value is string => Boolean(value))
    .map(comparablePhone)
    .filter((value) => value.length >= 7);
}

function companyContactKey(company: string, contact: string | null) {
  const normalizedContact = identityKey(contact);
  return normalizedContact ? `${identityKey(company)}:${normalizedContact}` : "";
}

function markDuplicates(rows: ImportRow[], leads: Lead[]) {
  const emails = new Set(leads.map((lead) => identityKey(lead.email)).filter(Boolean));
  const phones = new Set(leads.flatMap(phoneKeys));
  const companyContacts = new Set(
    leads.map((lead) => companyContactKey(lead.company_name, lead.contact_name)).filter(Boolean),
  );

  return rows.map((row) => {
    if (row.error) return { ...row, duplicate: undefined };
    const email = identityKey(row.email);
    const rowPhones = phoneKeys(row);
    const companyContact = companyContactKey(row.company_name, row.contact_name);
    let duplicate = "";

    if (email && emails.has(email)) duplicate = "Duplicate email already exists";
    else if (rowPhones.some((phone) => phones.has(phone))) {
      duplicate = "Duplicate phone number already exists";
    } else if (companyContact && companyContacts.has(companyContact)) {
      duplicate = "This name and company combination already exists";
    }

    if (!duplicate) {
      if (email) emails.add(email);
      rowPhones.forEach((phone) => phones.add(phone));
      if (companyContact) companyContacts.add(companyContact);
    }
    return { ...row, duplicate: duplicate || undefined };
  });
}

function looksLikeIndianMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  return local.length === 10 && /^[6-9]/.test(local);
}

function splitContactNumbers(raw: string) {
  const values = raw
    .split(/[\n,;|/]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const unique = values.filter(
    (value, index) =>
      values.findIndex((candidate) => comparablePhone(candidate) === comparablePhone(value)) ===
      index,
  );
  const mobiles = unique.filter(looksLikeIndianMobile);
  const landlines = unique.filter((value) => !looksLikeIndianMobile(value));
  return {
    phone: mobiles[0] ?? unique[0] ?? null,
    phone_2: mobiles.slice(1).find((value) => value !== mobiles[0]) ?? null,
    landline: landlines[0] ?? null,
  };
}

function resolvedOwner(value: string, ownerNames: string[]) {
  if (!value) return { value: null, error: "" };
  const normalized = clean(value).toLowerCase();
  const exact = ownerNames.find((name) => name.toLowerCase() === normalized);
  if (exact) return { value: exact, error: "" };
  const partial = ownerNames.filter((name) => {
    const candidate = name.toLowerCase();
    return candidate.split(/\s+/)[0] === normalized || candidate.startsWith(`${normalized} `);
  });
  if (partial.length === 1) return { value: partial[0]!, error: "" };
  return { value: null, error: `Unknown owner: ${value}` };
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

function parseWorkbook(buffer: ArrayBuffer, ownerNames: string[]): ImportRow[] {
  const { source, headerIndex } = workbookRows(buffer);

  return source.map((row, index) => {
    const companyName = valueFor(row, "company_name");
    const statusRaw = valueFor(row, "status");
    const sourceRaw = valueFor(row, "source");
    const valueRaw = valueFor(row, "estimated_value");
    const estimatedValue = numberValue(valueRaw);
    const rawPhone = valueFor(row, "phone");
    const detectedPhones = splitContactNumbers(rawPhone);
    const phone = nullable(valueForHeaders(row, ["phone 1", "mobile 1"])) ?? detectedPhones.phone;
    const phone2 = nullable(valueFor(row, "phone_2")) ?? detectedPhones.phone_2;
    const landline = nullable(valueFor(row, "landline")) ?? detectedPhones.landline;
    const owner = resolvedOwner(valueFor(row, "owner_name"), ownerNames);
    const status = statusRaw ? enumValue(statusRaw, LEAD_STATUSES) : "New";
    const sourceValue = sourceRaw ? enumValue(sourceRaw, LEAD_SOURCES) : null;
    const errors = [
      !companyName ? "Company name is required" : "",
      statusRaw && !status ? `Unknown status: ${statusRaw}` : "",
      sourceRaw && !sourceValue ? `Unknown source: ${sourceRaw}` : "",
      valueRaw && estimatedValue === null ? "Estimated value must be a number" : "",
      estimatedValue !== null && estimatedValue < 0 ? "Estimated value cannot be negative" : "",
      owner.error,
    ].filter(Boolean);

    const suppliedNotes = valueFor(row, "notes");

    return {
      rowNumber: headerIndex + index + 2,
      company_name: companyName,
      contact_name: nullable(valueFor(row, "contact_name")),
      email: nullable(valueFor(row, "email")),
      phone,
      phone_2: phone2,
      landline,
      designation: nullable(valueFor(row, "designation")),
      age_or_dob: nullable(valueFor(row, "age_or_dob")),
      industry: nullable(valueFor(row, "industry")),
      city: nullable(valueFor(row, "city")),
      source: sourceValue,
      status: status ?? "New",
      estimated_value: estimatedValue,
      owner_name: owner.value,
      notes: nullable(suppliedNotes),
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
  const teamMembers = useQuery(bdTeamMembersQuery());
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<"all" | "invalid" | "duplicates">("all");
  const validCount = rows.filter((row) => !row.error && !row.duplicate).length;
  const errorCount = rows.filter((row) => row.error).length;
  const duplicateCount = rows.filter((row) => row.duplicate).length;
  const previewRows = useMemo(
    () =>
      previewFilter === "invalid"
        ? rows.filter((row) => row.error)
        : previewFilter === "duplicates"
          ? rows.filter((row) => row.duplicate)
          : rows,
    [previewFilter, rows],
  );
  const preview = useMemo(() => previewRows.slice(0, 25), [previewRows]);

  const reset = () => {
    setFileName("");
    setRows([]);
    setHeaders([]);
    setPreviewFilter("all");
    if (inputRef.current) inputRef.current.value = "";
  };

  const updateCompanyName = (rowNumber: number, value: string) => {
    setRows((current) =>
      current.map((row) =>
        row.rowNumber === rowNumber ? { ...row, company_name: value.trimStart() } : row,
      ),
    );
  };

  const validateCompanyName = (rowNumber: number) => {
    setRows((current) =>
      current.map((row) => {
        if (row.rowNumber !== rowNumber) return row;
        const otherErrors = (row.error ?? "")
          .split("; ")
          .filter((error) => error && error !== "Company name is required");
        const companyName = row.company_name.trim();
        const errors = companyName ? otherErrors : ["Company name is required", ...otherErrors];
        return {
          ...row,
          company_name: companyName,
          error: errors.length ? errors.join("; ") : undefined,
        };
      }),
    );
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const ownerNames = (teamMembers.data ?? [])
        .filter((member) => member.active && member.access_status === "approved")
        .map((member) => member.display_name);
      const workbook = workbookRows(buffer);
      setHeaders(workbook.headers);
      const parsed = markDuplicates(parseWorkbook(buffer, ownerNames), leads);
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
        "Name",
        "Name of the Current Company",
        "Industry",
        "Current Location",
        "Designation",
        "Phone 1",
        "Phone 2",
        "Email ID",
        "Landline",
        "Date of Birth",
        "Lead Source",
        "Lead Status",
        "Estimated Value",
        "Owner",
        "Notes",
      ],
      [
        "Rahul Menon",
        "Vertex Global Services",
        "IT Services",
        "Bengaluru",
        "HR Manager",
        "+91 98450 11223",
        "+91 98765 44321",
        "rahul@vertexglobal.in",
        "080 4000 0000",
        "15/08/1991",
        "Naukri Resdex",
        "New",
        "1200000",
        "Nuzhat K",
        "Looking for mid-level technology hiring support.",
      ],
    ]);
    sheet["!cols"] = Array.from({ length: 15 }, (_, index) => ({
      wch: [0, 1, 14].includes(index) ? 36 : 20,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Corporate Leads");
    XLSX.writeFile(workbook, "zodiac-crm-corporate-leads-template.xlsx");
  };

  const importRows = async () => {
    setImporting(true);
    try {
      const checkedRows = markDuplicates(
        rows.map((row) => ({ ...row, duplicate: undefined })),
        leads,
      );
      const payload: Array<Record<string, unknown>> = [];
      let skipped = 0;

      for (const row of checkedRows) {
        if (row.error || row.duplicate) {
          skipped += 1;
          continue;
        }
        payload.push({
          company_name: row.company_name,
          contact_name: row.contact_name,
          industry: row.industry,
          city: row.city,
          designation: row.designation,
          email: row.email,
          phone: row.phone,
          phone_2: row.phone_2,
          landline: row.landline,
          age_or_dob: row.age_or_dob,
          source: row.source,
          status: row.status,
          estimated_value: row.estimated_value,
          owner_name: row.owner_name,
          notes: row.notes,
        });
      }

      if (!payload.length) {
        throw new Error(
          "No new valid leads were found. Existing and duplicate leads were skipped.",
        );
      }
      for (let index = 0; index < payload.length; index += 200) {
        const { error } = await supabase.from("leads").insert(payload.slice(index, index + 200));
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Import complete: ${payload.length} added, ${skipped} skipped.`);
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
      <DialogContent className="flex max-h-[92dvh] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[88vh]">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4 pr-12 sm:px-6">
          <DialogTitle>Import Corporate Leads</DialogTitle>
          <DialogDescription>
            Upload Excel or CSV. Existing leads are detected by email, phone number, or name and
            company, and are skipped automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
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
                Name of the Current Company is required. Missing Lead Status defaults to New.
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
                {duplicateCount ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                    {duplicateCount} duplicates skipped
                  </span>
                ) : null}
                <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  Detected {headers.length} columns
                </span>
              </div>
              {errorCount ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={previewFilter === "all" ? "default" : "outline"}
                    onClick={() => setPreviewFilter("all")}
                  >
                    Preview all
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={previewFilter === "invalid" ? "destructive" : "outline"}
                    onClick={() => setPreviewFilter("invalid")}
                  >
                    Fix {errorCount} invalid rows
                  </Button>
                  {previewFilter === "invalid" ? (
                    <p className="text-xs text-muted-foreground">
                      Enter the missing company. Corrected rows become valid automatically.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {duplicateCount ? (
                <Button
                  type="button"
                  size="sm"
                  variant={previewFilter === "duplicates" ? "default" : "outline"}
                  onClick={() => setPreviewFilter("duplicates")}
                >
                  View {duplicateCount} duplicates
                </Button>
              ) : null}
              <div className="crm-table-scroll overflow-x-auto overscroll-x-contain rounded-lg border border-border">
                <table className="w-full min-w-[1200px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      {[
                        "Row",
                        "Name",
                        "Current company",
                        "Industry",
                        "Current location",
                        "Designation",
                        "Phone 1",
                        "Phone 2",
                        "Email ID",
                        "Landline",
                        "Date of birth",
                        "Lead source",
                        "Lead status",
                        "Estimated value",
                        "Owner",
                        "Notes",
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
                        <td className="px-3 py-2">{row.contact_name ?? "—"}</td>
                        <td className="px-3 py-2 font-medium">
                          {row.error?.includes("Company name is required") ? (
                            <Input
                              className="h-8 min-w-52 bg-background"
                              placeholder="Enter company name"
                              aria-label={`Company name for row ${row.rowNumber}`}
                              value={row.company_name}
                              onChange={(event) =>
                                updateCompanyName(row.rowNumber, event.target.value)
                              }
                              onBlur={() => validateCompanyName(row.rowNumber)}
                            />
                          ) : (
                            row.company_name || "—"
                          )}
                        </td>
                        <td className="px-3 py-2">{row.industry ?? "—"}</td>
                        <td className="px-3 py-2">{row.city ?? "—"}</td>
                        <td className="px-3 py-2">{row.designation ?? "—"}</td>
                        <td className="px-3 py-2">{row.phone ?? "—"}</td>
                        <td className="px-3 py-2">{row.phone_2 ?? "—"}</td>
                        <td className="px-3 py-2">{row.email ?? "—"}</td>
                        <td className="px-3 py-2">{row.landline ?? "—"}</td>
                        <td className="px-3 py-2">{row.age_or_dob ?? "—"}</td>
                        <td className="px-3 py-2">{row.source ?? "—"}</td>
                        <td className="px-3 py-2">{row.status}</td>
                        <td className="px-3 py-2">{row.estimated_value ?? "—"}</td>
                        <td className="px-3 py-2">{row.owner_name ?? "—"}</td>
                        <td className="max-w-56 truncate px-3 py-2">{row.notes ?? "—"}</td>
                        <td
                          className={
                            row.error
                              ? "px-3 py-2 text-red-600"
                              : row.duplicate
                                ? "px-3 py-2 text-amber-700"
                                : "px-3 py-2 text-emerald-700"
                          }
                        >
                          {row.error ?? row.duplicate ?? "Ready"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewRows.length > preview.length ? (
                <p className="text-xs text-muted-foreground">
                  Previewing {preview.length} of {previewRows.length}{" "}
                  {previewFilter === "invalid"
                    ? "invalid"
                    : previewFilter === "duplicates"
                      ? "duplicate"
                      : "total"}{" "}
                  rows.
                </p>
              ) : null}
            </>
          )}
        </div>
        <DialogFooter className="shrink-0 border-t border-border bg-background px-4 py-4 sm:px-6">
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
