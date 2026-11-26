export type ClientContactDraft = {
  id: string;
  name: string;
  title: string;
  phone: string;
  landline: string;
  emails: string;
};
export type ClientGroupDraft = {
  name: string;
  city: string;
  priority: string;
  landline: string;
  emails: string;
  notes: string;
  contacts: ClientContactDraft[];
  warnings: string[];
  contract: ReturnType<typeof parseContractPaste>["values"];
};
export const extractEmails = (text: string) => [
  ...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []),
];
const clean = (v: string) =>
  v
    .replace(/\*\*/g, "")
    .replace(/&#x20;|&nbsp;/gi, " ")
    .replace(/\r?\n/g, " ")
    .trim();

function excelRows(raw: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (ch === '"' && (quoted || !cell)) {
      if (quoted && raw[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "\t" && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && raw[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
const key = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
const genericEmail = (v: string) =>
  /^(info|hr|careers?|recruitments?|recruiting|admin|sales|contact|resume|talent|enquir|office)/i.test(
    v.split("@")[0]!,
  );
const phone = (v: string) => v.match(/\+?\d[\d ().-]{6,}\d/)?.[0]?.trim() ?? "";
const aliases: Record<string, string[]> = {
  name: ["organisation", "organization", "company", "company name", "client name"],
  city: ["place", "city", "location"],
  contact: ["contact person", "contact name", "name"],
  title: ["designation", "department"],
  phone: ["mobile nos", "mobile", "mobile number"],
  landline: ["tel nos", "telephone", "board", "landline"],
  email: ["e-mail ids", "email ids", "email", "emails"],
  notes: ["remarks", "notes"],
  priority: ["hot/warm/cold", "priority"],
};
export function parseClientGroups(raw: string): ClientGroupDraft[] {
  const rows = (
    raw.includes("\t")
      ? excelRows(raw).map((cells) => cells.map(clean))
      : raw
          .split(/\r?\n/)
          .filter((l) => l.includes("\t") || l.includes("|"))
          .map((line) => {
            const cells = line.includes("\t")
              ? line.split("\t")
              : line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
            return cells.map(clean);
          })
  ).filter((cells) => !cells.every((c) => !c || /^:?-+:?$/.test(c)));
  if (!rows.length) return [];
  let mapping: Record<string, number> = {};
  const contractHeaders: Record<string, string> = {};
  const header = rows.findIndex(
    (r) =>
      r.some((c) => aliases["name"]!.some((a) => key(a) === key(c))) &&
      (r.some((c) => aliases["contact"]!.some((a) => key(a) === key(c))) ||
        r.some((c) => Boolean(contractPasteField(c)))),
  );
  if (header >= 0) {
    rows[header]!.forEach((c, i) => {
      for (const [f, ls] of Object.entries(aliases))
        if (ls.some((a) => key(a) === key(c))) mapping[f] = i;
      const contractField = contractPasteField(c);
      if (contractField && contractField !== "notes") {
        mapping[`contract.${contractField}`] = i;
        contractHeaders[`contract.${contractField}`] = c;
      }
    });
    rows.splice(0, header + 1);
  } else {
    const offset = /^(hot|warm|cold)$/i.test(rows[0]?.[0] ?? "") ? 1 : 0;
    if ((rows[0]?.length ?? 0) < 8) return [];
    mapping = {
      name: offset,
      city: offset + 1,
      contact: offset + 2,
      title: offset + 3,
      phone: offset + 4,
      landline: offset + 5,
      email: offset + 6,
      notes: offset + 7,
    };
    if (offset) mapping["priority"] = 0;
    if (
      (rows[0]?.length ?? 0) >= 14 &&
      /^(active|non[- ]?active|inactive)$/i.test(rows[0]?.[4] ?? "")
    ) {
      mapping = { name: 7, city: 8, contact: 9, title: 10, phone: 11, landline: 12, email: 13 };
      for (const [field, index, label] of [
        ["approach_date", 1, "Approach date"],
        ["visit_date", 2, "Visit date"],
        ["mandate_received_date", 3, "Mandate received date"],
        ["activity_status", 4, "Client activity status"],
        ["terms", 5, "Commercial terms"],
        ["recruiter", 6, "Assigned recruiter"],
      ] as const) {
        mapping[`contract.${field}`] = index;
        contractHeaders[`contract.${field}`] = label;
      }
    } else if ((rows[0]?.length ?? 0) >= 13 && /^(hot|warm|cold)$/i.test(rows[0]?.[4] ?? "")) {
      mapping = {
        priority: 4,
        name: 5,
        city: 6,
        contact: 7,
        title: 8,
        phone: 9,
        landline: 10,
        email: 11,
        notes: 12,
      };
      mapping["contract.visit_date"] = 2;
      contractHeaders["contract.visit_date"] = "Visit date";
    }
  }
  const groups: ClientGroupDraft[] = [];
  let current: ClientGroupDraft | undefined;
  let inheritedTitle = "";
  const contractLines = new Map<ClientGroupDraft, string[]>();
  for (const cells of rows) {
    if (isContractPasteLine(cells[0] ?? "")) continue;
    if (cells.length < Math.max(mapping["name"] ?? 0, mapping["contact"] ?? 0) + 1) continue;
    const get = (f: string) => cells[mapping[f] ?? -1] ?? "";
    const company = get("name");
    if (company) {
      current = groups.find((g) => key(g.name) === key(company));
      if (!current) {
        current = {
          name: company,
          city: "",
          priority: "",
          landline: "",
          emails: "",
          notes: "",
          contacts: [],
          warnings: [],
          contract: {},
        };
        groups.push(current);
      }
      inheritedTitle = "";
    }
    if (!current) continue;
    const details = contractLines.get(current) ?? [];
    for (const [field, label] of Object.entries(contractHeaders)) {
      const value = get(field);
      if (value && !/^[-—–]$/.test(value)) details.push(`${label}: ${value}`);
    }
    contractLines.set(current, details);
    current.city ||= get("city");
    current.landline ||= phone(get("landline"));
    const priority = get("priority").toLowerCase();
    if (["hot", "warm", "cold"].includes(priority))
      current.priority = priority[0]!.toUpperCase() + priority.slice(1);
    if (get("notes") && !current.notes.includes(get("notes")))
      current.notes = [current.notes, get("notes")].filter(Boolean).join("\n");
    const name = get("contact");
    const validName = name && !name.includes("@") ? name.replace(/^(Mr|Ms|Mrs|Dr)\.?\s*/i, "") : "";
    if (get("title") && !get("title").includes("@")) inheritedTitle = get("title");
    let contact = validName
      ? current.contacts.find((c) => key(c.name) === key(validName))
      : undefined;
    if (validName && !contact) {
      contact = {
        id: crypto.randomUUID(),
        name: validName,
        title: inheritedTitle,
        phone: phone(get("phone")),
        landline: phone(get("landline")),
        emails: "",
      };
      current.contacts.push(contact);
    }
    for (const email of extractEmails(cells.join(" "))) {
      const personal = current.contacts.filter((c) =>
        c.name.split(/\s+/).some((n) => n.length > 2 && key(email.split("@")[0]!).includes(key(n))),
      );
      const companyEmail =
        key(email.split("@")[0]!).length > 3 &&
        key(current.name).startsWith(key(email.split("@")[0]!));
      // Preserve explicit Excel row associations. A continuation row has no owner
      // unless its email uniquely matches an existing contact's name.
      const target =
        contact ??
        (genericEmail(email) || companyEmail
          ? undefined
          : personal.length === 1
            ? personal[0]
            : undefined);
      if (target && !personal.includes(target) && !genericEmail(email) && !companyEmail)
        current.warnings.push(
          `Verify that ${email} belongs to ${target.name}; the email name could not be matched.`,
        );
      if (target) target.emails = [...new Set([...extractEmails(target.emails), email])].join("\n");
      else {
        current.emails = [...new Set([...extractEmails(current.emails), email])].join("\n");
        if (!genericEmail(email))
          current.warnings.push(
            `Review the owner of ${email}; it is kept with the company until assigned.`,
          );
      }
    }
  }
  const rawLines = raw.split(/\r?\n/);
  const labelledContract: string[] = [];
  rawLines.forEach((line, index) => {
    if (!line.includes("\t") && isContractPasteLine(line)) {
      labelledContract.push(line);
      if (!/[:：]/.test(line) && rawLines[index + 1] && !rawLines[index + 1]!.includes("\t"))
        labelledContract.push(rawLines[index + 1]!);
    }
  });
  for (const group of groups) {
    const lines = contractLines.get(group) ?? [];
    if (lines.length && group.notes) lines.push(`Remarks: ${group.notes}`);
    if (groups.length === 1) lines.push(...labelledContract);
    const parsed = parseContractPaste([...new Set(lines)].join("\n"));
    group.contract = parsed.values;
    group.warnings.push(
      ...parsed.warnings,
      ...parsed.unclassified.map((value) => `Contract detail needs review: ${value}`),
    );
    if (groups.length > 1 && labelledContract.length)
      group.warnings.push(
        "Labelled contract details outside the table were not assigned. Include them in each company's columns or paste one company at a time.",
      );
  }
  for (const g of groups) {
    const domains = extractEmails(g.emails)
      .map((e) => e.split("@")[1])
      .filter((d) => !/^(gmail|yahoo|outlook)\.com$/.test(d ?? ""));
    for (const c of g.contacts)
      for (const e of extractEmails(c.emails))
        if (domains.length && !domains.includes(e.split("@")[1]))
          g.warnings.push(`Verify ${e} for ${c.name}: its domain differs from the company email.`);
  }
  return groups;
}
import {
  contractPasteField,
  isContractPasteLine,
  parseContractPaste,
  mergeContractPaste,
  CONTRACT_FIELD_LABELS,
} from "./contract-smart-paste";
import type { ContractInput } from "./client-contracts";

export function mergeGroupedContract(
  current: Record<string, string>,
  incoming: ClientGroupDraft["contract"],
) {
  const draft = Object.fromEntries(
    Object.keys(CONTRACT_FIELD_LABELS).map((key) => [key, current[`contract.${key}`] ?? ""]),
  ) as ContractInput;
  const result = mergeContractPaste(draft, incoming);
  return {
    values: Object.fromEntries(
      Object.entries(result.draft).map(([key, value]) => [`contract.${key}`, value ?? ""]),
    ),
    filled: result.filled,
    conflicts: result.conflicts.map((c) => ({
      field: `contract.${c.field}`,
      label: CONTRACT_FIELD_LABELS[c.field],
      current: c.current,
      incoming: c.incoming,
    })),
  };
}
