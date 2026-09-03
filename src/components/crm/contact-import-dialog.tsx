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
import type { Account, ContactWithAccount } from "@/lib/crm";

type RawRow = Record<string, unknown>;
type ContactField =
  | "full_name"
  | "first_name"
  | "last_name"
  | "account_name"
  | "title"
  | "department"
  | "email"
  | "phone"
  | "owner_name"
  | "last_activity_date";
type ImportRow = {
  rowNumber: number;
  first_name: string | null;
  last_name: string;
  account_name: string | null;
  account_id: string | null;
  title: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  owner_name: string | null;
  last_activity_date: string | null;
  additional_fields: Record<string, string>;
  error?: string;
};

const aliases: Record<ContactField, string[]> = {
  full_name: ["full name", "contact name", "name", "client contact"],
  first_name: ["first name", "firstname", "given name"],
  last_name: ["last name", "lastname", "surname", "family name"],
  account_name: [
    "company",
    "company name",
    "account",
    "account name",
    "client",
    "client name",
    "organisation",
    "organization",
  ],
  title: ["title", "designation", "job title", "position", "role"],
  department: ["department", "function", "team"],
  email: ["email", "email address", "work email", "official email"],
  phone: ["phone", "phone number", "mobile", "mobile number", "telephone", "contact number"],
  owner_name: ["owner", "owner name", "contact owner", "record owner"],
  last_activity_date: [
    "last activity",
    "last activity date",
    "last contacted",
    "last contacted date",
  ],
};

const clean = (value: unknown) => String(value ?? "").trim();
const cleanHeader = (value: string) =>
  value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
const nullable = (value: string) => value || null;
const key = (value: string | null | undefined) => clean(value).toLowerCase();

function matchedHeader(row: RawRow, field: ContactField): string | undefined {
  return Object.keys(row).find((header) => aliases[field].includes(cleanHeader(header)));
}

function valueFor(row: RawRow, field: ContactField): string {
  const header = matchedHeader(row, field);
  return header ? clean(row[header]) : "";
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: "", last: parts[0] ?? "" };
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1) ?? "" };
}

function excelDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseWorkbook(buffer: ArrayBuffer, accounts: Account[]): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("The workbook does not contain a worksheet.");
  const source = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], {
    defval: "",
    raw: false,
  });
  const accountsByName = new Map(accounts.map((account) => [key(account.name), account.id]));

  return source.map((row, index) => {
    const usedHeaders = new Set(
      Object.keys(aliases)
        .map((field) => matchedHeader(row, field as ContactField))
        .filter(Boolean),
    );
    const split = splitName(valueFor(row, "full_name"));
    const firstName = valueFor(row, "first_name") || split.first;
    const lastName = valueFor(row, "last_name") || split.last;
    const accountName = valueFor(row, "account_name");
    const accountId = accountName ? (accountsByName.get(key(accountName)) ?? null) : null;
    const additionalFields = Object.fromEntries(
      Object.entries(row)
        .filter(([header, value]) => !usedHeaders.has(header) && clean(value))
        .map(([header, value]) => [header.trim(), clean(value)]),
    );
    const errors = [
      !lastName ? "Contact name is required" : "",
      accountName && !accountId ? `Company “${accountName}” was not found` : "",
    ].filter(Boolean);
    return {
      rowNumber: index + 2,
      first_name: nullable(firstName),
      last_name: lastName,
      account_name: nullable(accountName),
      account_id: accountId,
      title: nullable(valueFor(row, "title")),
      department: nullable(valueFor(row, "department")),
      email: nullable(valueFor(row, "email")),
      phone: nullable(valueFor(row, "phone")),
      owner_name: nullable(valueFor(row, "owner_name")),
      last_activity_date: excelDate(valueFor(row, "last_activity_date")),
      additional_fields: additionalFields,
      error: errors.length ? errors.join("; ") : undefined,
    };
  });
}

export function ContactImportDialog({
  open,
  onOpenChange,
  contacts,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactWithAccount[];
  accounts: Account[];
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
      const parsed = parseWorkbook(buffer, accounts);
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
        "Full Name",
        "Company Name",
        "Designation",
        "Department",
        "Email",
        "Phone",
        "Owner Name",
        "Last Activity Date",
      ],
      [
        "Ananya Sharma",
        "Example Company",
        "Head of L&D",
        "Human Resources",
        "ananya@example.com",
        "+91 98765 43210",
        "",
        "2026-08-18",
      ],
    ]);
    sheet["!cols"] = [
      { wch: 24 },
      { wch: 28 },
      { wch: 24 },
      { wch: 20 },
      { wch: 30 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Client Contacts");
    XLSX.writeFile(workbook, "zodiac-crm-contact-import-template.xlsx");
  };

  const importRows = async () => {
    setImporting(true);
    try {
      const byEmail = new Map(
        contacts.filter((contact) => contact.email).map((contact) => [key(contact.email), contact]),
      );
      const seen = new Set<string>();
      let skipped = errorCount;
      let inserted = 0;
      let updated = 0;
      const payload: Array<Record<string, unknown>> = [];
      for (const row of rows) {
        if (row.error) continue;
        const match = row.email ? byEmail.get(key(row.email)) : undefined;
        const duplicateKey = row.email
          ? `email:${key(row.email)}`
          : `contact:${key(`${row.first_name} ${row.last_name}`)}:${row.account_id ?? ""}`;
        if (seen.has(duplicateKey)) {
          skipped += 1;
          continue;
        }
        seen.add(duplicateKey);
        payload.push({
          ...(match ? { id: match.id } : {}),
          account_id: row.account_id,
          first_name: row.first_name,
          last_name: row.last_name,
          title: row.title,
          department: row.department,
          email: row.email,
          phone: row.phone,
          owner_name: row.owner_name,
          last_activity_date: row.last_activity_date,
          additional_fields: row.additional_fields,
        });
        if (match) updated += 1;
        else inserted += 1;
      }
      if (!payload.length) throw new Error("There are no valid rows to import.");
      for (let index = 0; index < payload.length; index += 200) {
        const { error } = await supabase.from("contacts").upsert(payload.slice(index, index + 200));
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
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
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Client Contacts</DialogTitle>
          <DialogDescription>
            Headers are detected automatically. Extra columns are saved with the contact. Company
            names must already exist under Corporate Clients.
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
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>
          {!rows.length ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <FileSpreadsheet className="mx-auto size-9 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Upload .xlsx, .xls, or .csv</p>
              <p className="text-xs text-muted-foreground">
                Full Name or Last Name is required. Other headers are detected automatically.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                  {validCount} valid
                </span>
                {!!errorCount && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">
                    {errorCount} invalid
                  </span>
                )}
                <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  Detected {headers.length} columns
                </span>
              </div>
              <div className="crm-table-scroll overflow-x-auto overscroll-x-contain rounded-lg border border-border">
                <table className="w-full min-w-[920px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      {[
                        "Row",
                        "Contact",
                        "Company",
                        "Designation",
                        "Email",
                        "Phone",
                        "Extra fields",
                        "Status",
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
                        <td className="px-3 py-2 font-medium">
                          {[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="px-3 py-2">{row.account_name ?? "—"}</td>
                        <td className="px-3 py-2">{row.title ?? "—"}</td>
                        <td className="px-3 py-2">{row.email ?? "—"}</td>
                        <td className="px-3 py-2">{row.phone ?? "—"}</td>
                        <td className="px-3 py-2">{Object.keys(row.additional_fields).length}</td>
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
              {rows.length > preview.length && (
                <p className="text-xs text-muted-foreground">
                  Previewing 12 of {rows.length} rows.
                </p>
              )}
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
            {importing ? "Importing…" : `Import ${validCount} contacts`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
