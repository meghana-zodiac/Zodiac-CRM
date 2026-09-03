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
import { TRAINING_TYPES, type Trainer } from "@/lib/crm";

type RawRow = Record<string, unknown>;
type TrainingType = (typeof TRAINING_TYPES)[number];
type TrainerField =
  "full_name" | "email" | "phone" | "training_type" | "expertise" | "rating" | "day_rate" | "bio";

type ImportRow = {
  rowNumber: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  training_type: TrainingType;
  expertise: string | null;
  rating: number | null;
  day_rate: number | null;
  bio: string | null;
  error?: string;
};

const aliases: Record<TrainerField, string[]> = {
  full_name: ["trainer name", "full name", "name", "trainer", "faculty name"],
  email: ["email", "email address", "work email", "official email", "email id"],
  phone: ["phone", "phone number", "mobile", "mobile number", "contact number", "telephone"],
  training_type: ["training type", "track", "trainer type", "category", "training category"],
  expertise: [
    "expertise",
    "skills",
    "specialization",
    "specialisation",
    "topics",
    "courses",
    "subject expertise",
  ],
  rating: ["rating", "rating /5", "rating out of 5", "score"],
  day_rate: ["day rate", "daily rate", "fees", "fee", "trainer fee", "rate per day", "commercials"],
  bio: ["bio", "profile summary", "summary", "about", "profile", "description"],
};

const clean = (value: unknown) => String(value ?? "").trim();
const cleanHeader = (value: string) =>
  value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
const nullable = (value: string) => value || null;
const identityKey = (value: string | null | undefined) => clean(value).toLowerCase();

function matchedHeader(row: RawRow, field: TrainerField): string | undefined {
  return Object.keys(row).find((header) => aliases[field].includes(cleanHeader(header)));
}

function valueFor(row: RawRow, field: TrainerField): string {
  const header = matchedHeader(row, field);
  return header ? clean(row[header]) : "";
}

function numberValue(value: string): number | null {
  if (!value) return null;
  const normalized = value.replace(/[₹,\s]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function trainingTypeValue(value: string): TrainingType | null {
  const normalized = value.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (["technical", "tech", "technical skills", "technical training"].includes(normalized)) {
    return "Technical";
  }
  if (
    ["soft skills", "soft skill", "behavioral", "behavioural", "softskills"].includes(normalized)
  ) {
    return "Soft Skills";
  }
  return null;
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
    const fullName = valueFor(row, "full_name");
    const trainingTypeRaw = valueFor(row, "training_type");
    const trainingType = trainingTypeValue(trainingTypeRaw);
    const ratingRaw = valueFor(row, "rating");
    const rating = numberValue(ratingRaw);
    const dayRateRaw = valueFor(row, "day_rate");
    const dayRate = numberValue(dayRateRaw);
    const errors = [
      !fullName ? "Trainer name is required" : "",
      !trainingTypeRaw ? "Training type is required" : "",
      trainingTypeRaw && !trainingType ? "Training type must be Technical or Soft Skills" : "",
      ratingRaw && rating === null ? "Rating must be a number" : "",
      rating !== null && (rating < 0 || rating > 5) ? "Rating must be between 0 and 5" : "",
      dayRateRaw && dayRate === null ? "Day rate must be a number" : "",
      dayRate !== null && dayRate < 0 ? "Day rate cannot be negative" : "",
    ].filter(Boolean);

    return {
      rowNumber: index + 2,
      full_name: fullName,
      email: nullable(valueFor(row, "email")),
      phone: nullable(valueFor(row, "phone")),
      training_type: trainingType ?? "Technical",
      expertise: nullable(valueFor(row, "expertise")),
      rating,
      day_rate: dayRate,
      bio: nullable(valueFor(row, "bio")),
      error: errors.length ? errors.join("; ") : undefined,
    };
  });
}

export function TrainerImportDialog({
  open,
  onOpenChange,
  trainers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainers: Trainer[];
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
        "Trainer Name",
        "Email",
        "Phone",
        "Training Type",
        "Expertise",
        "Rating",
        "Day Rate",
        "Profile Summary",
      ],
      [
        "Meera Iyer",
        "meera@example.com",
        "+91 98765 43210",
        "Technical",
        "Power BI, Advanced Excel, Data Storytelling",
        "4.5",
        "25000",
        "Corporate technical trainer with 10 years of experience.",
      ],
      [
        "Aarav Shah",
        "aarav@example.com",
        "+91 98765 43211",
        "Soft Skills",
        "Leadership Development, Communication Skills",
        "4.7",
        "30000",
        "Leadership and communication facilitator.",
      ],
    ]);
    sheet["!cols"] = [
      { wch: 24 },
      { wch: 30 },
      { wch: 20 },
      { wch: 18 },
      { wch: 45 },
      { wch: 12 },
      { wch: 16 },
      { wch: 55 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Trainer Profiles");
    XLSX.writeFile(workbook, "zodiac-crm-trainer-import-template.xlsx");
  };

  const importRows = async () => {
    setImporting(true);
    try {
      const byEmail = new Map(
        trainers
          .filter((trainer) => trainer.email)
          .map((trainer) => [identityKey(trainer.email), trainer]),
      );
      const byNamePhone = new Map(
        trainers.map((trainer) => [
          `${identityKey(trainer.full_name)}:${identityKey(trainer.phone)}`,
          trainer,
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
          : `trainer:${identityKey(row.full_name)}:${identityKey(row.phone)}`;
        if (seen.has(duplicateKey)) {
          skipped += 1;
          continue;
        }
        seen.add(duplicateKey);
        const match = row.email
          ? byEmail.get(identityKey(row.email))
          : byNamePhone.get(`${identityKey(row.full_name)}:${identityKey(row.phone)}`);
        payload.push({
          ...(match ? { id: match.id } : {}),
          full_name: row.full_name,
          email: row.email,
          phone: row.phone,
          training_type: row.training_type,
          expertise: row.expertise,
          rating: row.rating,
          day_rate: row.day_rate,
          bio: row.bio,
        });
        if (match) updated += 1;
        else inserted += 1;
      }

      if (!payload.length) throw new Error("There are no valid rows to import.");
      for (let index = 0; index < payload.length; index += 200) {
        const { error } = await supabase.from("trainers").upsert(payload.slice(index, index + 200));
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["trainers"] });
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
          <DialogTitle>Import Trainer Profiles</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file. Headers are detected automatically, and existing trainers
            are updated when their email—or their name and phone—matches.
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
                Trainer Name and Training Type are required. Training Type must be Technical or Soft
                Skills.
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
              <div className="crm-table-scroll overflow-x-auto overscroll-x-contain rounded-lg border border-border">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      {[
                        "Row",
                        "Trainer",
                        "Type",
                        "Expertise",
                        "Email",
                        "Phone",
                        "Rating",
                        "Day rate",
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
                        <td className="px-3 py-2 font-medium">{row.full_name || "—"}</td>
                        <td className="px-3 py-2">{row.training_type}</td>
                        <td className="max-w-64 truncate px-3 py-2">{row.expertise ?? "—"}</td>
                        <td className="px-3 py-2">{row.email ?? "—"}</td>
                        <td className="px-3 py-2">{row.phone ?? "—"}</td>
                        <td className="px-3 py-2">{row.rating ?? "—"}</td>
                        <td className="px-3 py-2">{row.day_rate ?? "—"}</td>
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
            {importing ? "Importing…" : `Import ${validCount} trainers`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
