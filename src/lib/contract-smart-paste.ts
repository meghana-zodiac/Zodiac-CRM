import type { ContractInput } from "./client-contracts";
import { commercialTerms } from "./contract-terms";

export const CONTRACT_FIELD_LABELS = {
  activity_status: "Client activity status",
  recruiter: "Assigned recruiter",
  approach_date: "Approach date(s)",
  visit_date: "Visit date",
  mandate_received_date: "Mandate received date",
  terms: "Commercial terms",
  notes: "Remarks",
} as const satisfies Record<keyof ContractInput, string>;

type ContractField = keyof ContractInput;
export type ContractPasteResult = {
  values: Partial<Record<ContractField, string>>;
  warnings: string[];
  unclassified: string[];
};
export type ContractPasteConflict = {
  field: ContractField;
  current: string;
  incoming: string;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases: Record<string, string[]> = {
  activity_status: [
    "client activity status",
    "activity status",
    "contract status",
    "active / non-active",
    "active / inactive",
    "status",
  ],
  recruiter: ["assigned recruiter", "recruiter"],
  approach_date: ["approach date(s)", "approach date", "approach dates", "approached on"],
  visit_date: ["visit date", "visited on"],
  mandate_received_date: ["mandate received", "mandate received date", "mandate date"],
  terms: ["commercial terms", "contract terms", "terms"],
  notes: ["remarks", "notes", "call remarks"],
  fee: ["fee / pricing", "fee", "fees", "pricing", "recruitment fee", "service fee"],
  payment: ["payment period", "payment terms", "payment", "pay"],
  replacement: ["replacement period", "replacement", "replace"],
};
const labelMap = new Map(
  Object.entries(aliases).flatMap(([field, labels]) =>
    labels.map((label) => [normalize(label), field]),
  ),
);

/** Day-first dates from Indian trackers; never rely on US Date.parse interpretation. */
function dateOnly(value: string): string | undefined {
  let year: number, month: number, day: number;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const numeric = value.match(/^(\d{1,2})[./-]\s*(\d{1,2})[./-]\s*(\d{4})$/);
  const named = value.match(/^(\d{1,2})\s+([A-Za-z]+)[,]?\s+(\d{4})$/);
  if (iso) [, year, month, day] = iso.map(Number) as [number, number, number, number];
  else if (numeric) [, day, month, year] = numeric.map(Number) as [number, number, number, number];
  else if (named) {
    if (
      !/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i.test(
        named[2]!,
      )
    )
      return undefined;
    day = Number(named[1]);
    year = Number(named[3]);
    month =
      ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
        named[2]!.slice(0, 3).toLowerCase(),
      ) + 1;
  } else return undefined;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  )
    return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseContractPaste(raw: string): ContractPasteResult {
  const result: ContractPasteResult = { values: {}, warnings: [], unclassified: [] };
  const labelled: Record<string, string> = {};
  let continuation: string | undefined;
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const match = line.match(/^(.{2,45}?)\s*[:：\t]\s*(.+)$/);
    const field = match ? labelMap.get(normalize(match[1]!)) : labelMap.get(normalize(line));
    let value = match?.[2]?.trim();
    const next = lines[index + 1];
    const nextLabel = next?.match(/^(.{2,45}?)\s*[:：\t]/)?.[1] ?? next;
    if (field && !value && next && !labelMap.has(normalize(nextLabel!))) {
      value = lines[++index];
    }
    if (field) {
      if (!value) {
        result.warnings.push(
          `No value was provided for ${CONTRACT_FIELD_LABELS[field as ContractField] ?? field}.`,
        );
      } else if (labelled[field] && labelled[field] !== value) {
        result.warnings.push(
          `More than one value was provided for ${CONTRACT_FIELD_LABELS[field as ContractField] ?? field}. Review both values.`,
        );
        result.unclassified.push(`${line}${match ? "" : `: ${value}`}`);
      } else labelled[field] = value;
      continuation = field === "notes" || field === "terms" ? field : undefined;
    } else if (!match && continuation) {
      labelled[continuation] += `\n${line}`;
    } else if (
      !match &&
      /\bPay(?:\s+(?:after|aft\.?))?\s+\d+\s*Days?/i.test(line) &&
      /%|\bRs\.?|₹|INR/i.test(line) &&
      !labelled["terms"]
    ) {
      labelled["terms"] = line;
      continuation = "terms";
    } else {
      result.unclassified.push(line);
      continuation = undefined;
    }
  }
  for (const field of ["recruiter", "approach_date", "notes"] as const) {
    if (labelled[field]) result.values[field] = labelled[field];
  }
  const status = labelled["activity_status"];
  if (status) {
    const key = normalize(status);
    if (key === "active") result.values.activity_status = "Active";
    else if (["nonactive", "inactive", "notactive"].includes(key))
      result.values.activity_status = "Non-active";
    else {
      result.warnings.push(`Status “${status}” is unclear. Select Active or Non-active manually.`);
      result.unclassified.push(`Client activity status: ${status}`);
    }
  }
  for (const field of ["visit_date", "mandate_received_date"] as const) {
    const value = labelled[field];
    if (!value || /^(?:[-—–]|n\/?a|not set|not recorded)$/i.test(value)) continue;
    const parsed = dateOnly(value);
    if (parsed) result.values[field] = parsed;
    else {
      result.warnings.push(
        `${CONTRACT_FIELD_LABELS[field]} “${value}” was not filled. Use DD.MM.YYYY or YYYY-MM-DD.`,
      );
      result.unclassified.push(`${CONTRACT_FIELD_LABELS[field]}: ${value}`);
    }
  }
  let terms = labelled["terms"] ?? "";
  const parts = commercialTerms(terms || null);
  const fee = labelled["fee"];
  if (fee && (!terms || parts.fee === "Not recorded"))
    terms = [fee, terms].filter(Boolean).join(" I ");
  else if (fee && parts.fee.trim().toLowerCase() !== fee.trim().toLowerCase()) {
    result.warnings.push(
      "Fee / pricing differs from Commercial terms. The full Commercial terms were kept; review the fee before saving.",
    );
    result.unclassified.push(`Fee / pricing: ${fee}`);
  }
  for (const field of ["payment", "replacement"] as const) {
    const value = labelled[field];
    if (!value) continue;
    const match = value.match(
      /^(?:(?:pay|payment|replace|replacement)(?:\s+period)?\s*)?(?:(?:after|aft\.?|within|net)\s*)?(\d{1,4})\s*(?:days?)?$/i,
    );
    if (!match) {
      result.warnings.push(
        `${field === "payment" ? "Payment" : "Replacement"} period “${value}” was not converted. Enter a number of days or retain it in Commercial terms.`,
      );
      result.unclassified.push(`${field} period: ${value}`);
    } else if (parts[field] && Number(parts[field]) !== Number(match[1])) {
      result.warnings.push(
        `${field === "payment" ? "Payment" : "Replacement"} period conflicts with Commercial terms. The full terms were kept.`,
      );
      result.unclassified.push(`${field} period: ${value}`);
    } else if (!parts[field]) {
      terms = [terms, `${field === "payment" ? "Pay" : "Replace"} ${Number(match[1])} Days`]
        .filter(Boolean)
        .join(" I ");
    }
  }
  if (terms) result.values.terms = terms;
  return result;
}

/** Preserve existing data until the user explicitly accepts each changed field. */
export function mergeContractPaste(draft: ContractInput, values: ContractPasteResult["values"]) {
  const next = { ...draft };
  const conflicts: ContractPasteConflict[] = [];
  const filled: string[] = [];
  for (const field of Object.keys(CONTRACT_FIELD_LABELS) as ContractField[]) {
    const incoming = values[field]?.trim();
    if (!incoming) continue;
    const current = draft[field]?.trim() ?? "";
    if (!current) {
      next[field] = incoming;
      filled.push(CONTRACT_FIELD_LABELS[field]);
    } else if (current.toLowerCase() !== incoming.toLowerCase())
      conflicts.push({ field, current, incoming });
  }
  return { draft: next, conflicts, filled };
}
