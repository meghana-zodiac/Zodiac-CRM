import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Account } from "@/lib/crm";

type ImportRow = {
  rowNumber: number;
  name: string;
  client_type: string | null;
  industry: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  owner_name: string | null;
  error?: string;
};

type RawRow = Record<string, unknown>;
type ImportField = Exclude<keyof ImportRow, "rowNumber" | "error">;

const headerAliases: Record<ImportField, string[]> = {
  name: ["company name", "company", "account name", "client name", "name"],
  client_type: ["client type", "type", "category"],
  industry: ["industry", "sector"],
  website: ["website", "website url", "url"],
  phone: ["phone", "phone number", "telephone", "mobile"],
  city: ["city", "location"],
  owner_name: ["owner", "owner name", "account owner"],
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function valueFor(row: RawRow, field: ImportField): string {
  const match = Object.entries(row).find(([header]) => headerAliases[field].includes(cleanHeader(header)));
  return clean(match?.[1]);
}

function nullable(value: string): string | null {
  return value || null;
}

function parseWorkbook(buffer: ArrayBuffer): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("The workbook does not contain a worksheet.");
  const source = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], { defval: "", raw: false });

  return source.map((row, index) => {
    const name = valueFor(row, "name");
    return {
      rowNumber: index + 2,
      name,
      client_type: nullable(valueFor(row, "client_type")),
      industry: nullable(valueFor(row, "industry")),
      website: nullable(valueFor(row, "website")),
      phone: nullable(valueFor(row, "phone")),
      city: nullable(valueFor(row, "city")),
      owner_name: nullable(valueFor(row, "owner_name")),
      error: name ? undefined : "Company Name is required",
    };
  });
}

function matchKey(value: string | null | undefined): string {
  return clean(value).toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function AccountImportDialog({ open, onOpenChange, accounts }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const validCount = rows.filter((row) => !row.error).length;
  const errorCount = rows.length - validCount;
  const preview = useMemo(() => rows.slice(0, 12), [rows]);

  const reset = () => {
    setFileName("");
    setRows([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseWorkbook(await file.arrayBuffer());
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
      ["Company Name", "Client Type", "Industry", "Website", "Phone", "City", "Owner Name"],
      ["Example Company", "Corporate", "Technology", "https://example.com", "+91 98765 43210", "Mumbai", ""],
    ]);
    sheet["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 20 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Corporate Clients");
    XLSX.writeFile(workbook, "zodiac-crm-client-import-template.xlsx");
  };

  const importRows = async () => {
    setImporting(true);
    try {
      const byName = new Map(accounts.map((account) => [matchKey(account.name), account]));
      const byWebsite = new Map(accounts.filter((account) => account.website).map((account) => [matchKey(account.website), account]));
      const seen = new Set<string>();
      let skipped = errorCount;
      let inserted = 0;
      let updated = 0;
      const payload: Array<Record<string, string | null>> = [];

      for (const row of rows) {
        if (row.error) continue;
        const key = matchKey(row.name);
        if (seen.has(key)) {
          skipped += 1;
          continue;
        }
        seen.add(key);
        const existing = byName.get(key) ?? (row.website ? byWebsite.get(matchKey(row.website)) : undefined);
        payload.push({
          ...(existing ? { id: existing.id } : {}),
          name: row.name,
          client_type: row.client_type,
          industry: row.industry,
          website: row.website,
          phone: row.phone,
          city: row.city,
          owner_name: row.owner_name,
        });
        if (existing) updated += 1;
        else inserted += 1;
      }

      if (!payload.length) throw new Error("There are no valid rows to import.");
      for (let index = 0; index < payload.length; index += 200) {
        const { error } = await supabase.from("accounts").upsert(payload.slice(index, index + 200));
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
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
    <Dialog open={open} onOpenChange={(next) => { if (!next && !importing) reset(); onOpenChange(next); }}>
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Corporate Clients</DialogTitle>
          <DialogDescription>Upload an Excel or CSV file. Existing clients are matched by company name or website and updated.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={inputRef} className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void readFile(event.target.files?.[0])} />
            <Button type="button" onClick={() => inputRef.current?.click()}><Upload className="size-4" /> Choose Excel file</Button>
            <Button type="button" variant="outline" onClick={downloadTemplate}><Download className="size-4" /> Download template</Button>
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>
          {!rows.length ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <FileSpreadsheet className="mx-auto size-9 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Upload .xlsx, .xls, or .csv</p>
              <p className="text-xs text-muted-foreground">Company Name is the only required column.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-3 text-sm">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{validCount} valid</span>
                {!!errorCount && <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">{errorCount} invalid</span>}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground"><tr>
                    {["Row", "Company Name", "Type", "Industry", "Website", "Phone", "City", "Status"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-border">{preview.map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td><td className="px-3 py-2 font-medium">{row.name || "—"}</td>
                      <td className="px-3 py-2">{row.client_type ?? "—"}</td><td className="px-3 py-2">{row.industry ?? "—"}</td>
                      <td className="px-3 py-2">{row.website ?? "—"}</td><td className="px-3 py-2">{row.phone ?? "—"}</td><td className="px-3 py-2">{row.city ?? "—"}</td>
                      <td className={row.error ? "px-3 py-2 text-red-600" : "px-3 py-2 text-emerald-700"}>{row.error ?? "Ready"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {rows.length > preview.length && <p className="text-xs text-muted-foreground">Previewing 12 of {rows.length} rows.</p>}
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={importing} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!validCount || importing} onClick={() => void importRows()}>
            {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{importing ? "Importing…" : `Import ${validCount} clients`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
