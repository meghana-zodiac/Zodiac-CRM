import type { CrmTable } from "@/lib/crm";

type LeadPasteValues = Record<string, string>;

const LABELS: Record<string, keyof LeadPasteValues> = {
  company: "company_name",
  "company name": "company_name",
  organisation: "company_name",
  organization: "company_name",
  client: "company_name",
  contact: "contact_name",
  "contact person": "contact_name",
  name: "contact_name",
  email: "email",
  "email id": "email",
  phone: "phone",
  mobile: "phone",
  "contact number": "phone",
  industry: "industry",
  sector: "industry",
  city: "city",
  location: "city",
  service: "service_interest",
  "service interest": "service_interest",
  requirement: "service_interest",
  source: "source",
  status: "status",
  notes: "notes",
  remarks: "notes",
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const WEBSITE = /https?:\/\/[^\s]+|www\.[^\s]+/i;

function clean(value: string) {
  return value.replace(/^[\s•*\-–—]+/, "").trim();
}

function setIfEmpty(values: LeadPasteValues, key: string, value: string) {
  if (value && !values[key]) values[key] = value;
}

export function parseLeadPaste(raw: string): LeadPasteValues {
  const values: LeadPasteValues = {};
  const unmatched: string[] = [];
  const lines = raw.split(/\r?\n/).map(clean).filter(Boolean);

  // Extract details from the entire passage first. Website text commonly puts
  // the email and phone in the same sentence, so these checks must be independent.
  const email = raw.match(EMAIL)?.[0];
  const phone = raw.match(PHONE)?.[0];
  if (email) values.email = email;
  if (phone && phone.replace(/\D/g, "").length >= 8) values.phone = phone.trim();

  const companyFromSentence = raw.match(
    /(?:^|[.;,]\s+)([A-Za-z][A-Za-z0-9&.' -]{1,100}?\b(?:private limited|pvt\.?\s*ltd\.?|limited|ltd\.?|llp|inc\.?|corporation|corp\.?|group))\s+(?:is|operates|provides|serves|offers)\b/i,
  );
  if (companyFromSentence) values.company_name = clean(companyFromSentence[1]!);

  const contactFromSentence = raw.match(
    /\b(?:contact|reach|speak (?:to|with))\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\s+(?:at|on|via)\b/,
  );
  if (contactFromSentence) values.contact_name = contactFromSentence[1]!.trim();

  const cityAndState = raw.match(/\b([A-Z][A-Za-z.' -]+),\s*(Haryana|Maharashtra|Delhi|Karnataka|Tamil Nadu|Telangana|Gujarat|Rajasthan|West Bengal|Uttar Pradesh|Madhya Pradesh|Punjab|Kerala|Goa)\b/);
  const operatingLocation = raw.match(
    /\b(?:operates?|located|headquartered)\s+(?:from|in|at)\s+([^.;]+?)(?=\s+(?:for|and|with)\b|[.;]|$)/i,
  );
  const basedLocation = raw.match(/\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*)-based\b/);
  if (cityAndState) values.city = `${cityAndState[1]!.trim()}, ${cityAndState[2]!.trim()}`;
  else if (operatingLocation) values.city = operatingLocation[1]!.trim();
  else if (basedLocation) values.city = basedLocation[1]!.trim();

  const industryFromSentence = raw.match(
    /\bis\s+(?:an?|the)\s+(?:(?:[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*)-based\s+)?(.+?)\s+compan(?:y|ies)\b/i,
  );
  const operatesInIndustry = raw.match(/\boperates\s+in\s+(?:the\s+)?(.+?)\s+industr(?:y|ies)\b/i);
  if (industryFromSentence) values.industry = industryFromSentence[1]!.trim();
  else if (operatesInIndustry) values.industry = operatesInIndustry[1]!.trim();

  if (/\b(?:recruitment|hiring|talent acquisition|staffing)\b/i.test(raw)) {
    values.service_interest = "Permanent Recruitment";
  }

  for (const line of lines) {
    const labelled = line.match(/^([^:–—-]{2,30})\s*[:–—-]\s*(.+)$/);
    if (labelled) {
      const label = labelled[1]!.trim().toLowerCase();
      const value = labelled[2]!.trim();
      const field = LABELS[label];
      if (field) {
        setIfEmpty(values, field, value);
        continue;
      }
    }

    unmatched.push(line);
  }

  if (!values.company_name && unmatched.length) {
    values.company_name = unmatched.shift()!;
  }
  if (unmatched.length) {
    values.notes = [values.notes, ...unmatched].filter(Boolean).join("\n");
  }
  return values;
}

function labelledValues(raw: string) {
  const result: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/).map(clean).filter(Boolean)) {
    const match = line.match(/^([^:–—-]{2,40})\s*[:–—-]\s*(.+)$/);
    if (match) result[match[1]!.trim().toLowerCase()] = match[2]!.trim();
  }
  return result;
}

function firstLabel(labels: Record<string, string>, names: string[]) {
  return names.map((name) => labels[name]).find(Boolean);
}

function numberValue(value: string | undefined) {
  return value?.replace(/[^\d.]/g, "") ?? "";
}

function dateValue(value: string | undefined) {
  if (!value) return "";
  const dmy = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

function splitName(fullName: string | undefined) {
  const parts = fullName?.trim().split(/\s+/) ?? [];
  return {
    first_name: parts.length > 1 ? parts.slice(0, -1).join(" ") : "",
    last_name: parts.at(-1) ?? "",
  };
}

export const SMART_PASTE_TABLES: readonly CrmTable[] = [
  "leads",
  "accounts",
  "contacts",
  "deals",
  "trainers",
  "training_requests",
  "training_batches",
];

export function parseSmartPaste(table: CrmTable, raw: string): Record<string, string> {
  if (table === "leads") return parseLeadPaste(raw);

  const labels = labelledValues(raw);
  const commonEmail = raw.match(EMAIL)?.[0] ?? "";
  const commonPhone = raw.match(PHONE)?.[0] ?? "";
  const website = raw.match(WEBSITE)?.[0]?.replace(/[.,;]+$/, "") ?? "";

  if (table === "accounts") {
    const lead = parseLeadPaste(raw);
    return {
      name: firstLabel(labels, ["client name", "company name", "company", "organisation", "organization"]) ?? lead.company_name ?? "",
      industry: firstLabel(labels, ["industry", "sector"]) ?? lead.industry ?? "",
      client_type: firstLabel(labels, ["engagement type", "client type"]) ?? "",
      city: firstLabel(labels, ["city", "location"]) ?? lead.city ?? "",
      website: firstLabel(labels, ["website", "web", "url"]) ?? website,
      phone: firstLabel(labels, ["phone", "mobile", "contact number"]) ?? commonPhone,
      owner_name: firstLabel(labels, ["owner", "account owner"]) ?? "",
    };
  }

  if (table === "contacts") {
    const explicitName = firstLabel(labels, ["contact person", "contact name", "name"]);
    const sentenceName = raw.match(/\b(?:contact|reach|speak (?:to|with))\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\b/)?.[1];
    const name = splitName(explicitName ?? sentenceName);
    return {
      ...name,
      email: firstLabel(labels, ["email", "email id"]) ?? commonEmail,
      phone: firstLabel(labels, ["phone", "mobile", "contact number"]) ?? commonPhone,
      title: firstLabel(labels, ["designation", "job title", "title", "position"]) ?? "",
      department: firstLabel(labels, ["department", "function", "team"]) ?? "",
      account_id: firstLabel(labels, ["company", "company name", "corporate client", "client"]) ?? "",
      owner_name: firstLabel(labels, ["owner", "contact owner"]) ?? "",
      last_activity_date: dateValue(firstLabel(labels, ["last activity", "last contacted"])),
    };
  }

  if (table === "deals") {
    const amount = firstLabel(labels, ["amount", "contract value", "value", "estimated value", "budget"]);
    return {
      deal_name: firstLabel(labels, ["proposal name", "deal name", "opportunity", "requirement"]) ?? clean(raw.split(/\r?\n/)[0] ?? ""),
      amount: numberValue(amount),
      stage: firstLabel(labels, ["stage", "pipeline stage", "status"]) ?? "",
      service_line: firstLabel(labels, ["service", "service line", "service interest"]) ?? "",
      account_id: firstLabel(labels, ["company", "company name", "corporate client", "client"]) ?? "",
      contact_id: firstLabel(labels, ["contact", "contact person", "client contact"]) ?? "",
      closing_date: dateValue(firstLabel(labels, ["expected close", "closing date", "close date"])),
      sla_signed_date: dateValue(firstLabel(labels, ["sla signed on", "sla date"])),
      owner_name: firstLabel(labels, ["owner", "deal owner"]) ?? "",
    };
  }

  if (table === "trainers") {
    const name = firstLabel(labels, ["trainer", "trainer name", "name"]);
    return {
      full_name: name ?? clean(raw.split(/\r?\n/)[0] ?? ""),
      email: firstLabel(labels, ["email", "email id"]) ?? commonEmail,
      phone: firstLabel(labels, ["phone", "mobile", "contact number"]) ?? commonPhone,
      training_type: firstLabel(labels, ["training type", "trainer type", "type"]) ?? "",
      expertise: firstLabel(labels, ["expertise", "specialisation", "specialization", "skills", "topics"]) ?? "",
      rating: numberValue(firstLabel(labels, ["rating"])),
      day_rate: numberValue(firstLabel(labels, ["day rate", "daily rate", "trainer fee", "fee"])),
      bio: firstLabel(labels, ["profile summary", "bio", "summary"]) ?? raw.trim(),
    };
  }

  if (table === "training_requests") {
    return {
      account_id: firstLabel(labels, ["corporate client", "existing client"]) ?? "",
      client_name: firstLabel(labels, ["client name", "company", "company name", "client"]) ?? "",
      training_type: firstLabel(labels, ["training type", "type"]) ?? "",
      course_topic: firstLabel(labels, ["course", "course topic", "topic", "training topic", "program"] ) ?? "",
      trainer_id: firstLabel(labels, ["trainer", "assigned trainer"]) ?? "",
      participants: numberValue(firstLabel(labels, ["participants", "number of participants", "no. of participants", "batch size"])),
      start_date: dateValue(firstLabel(labels, ["start date", "batch start", "from"])),
      end_date: dateValue(firstLabel(labels, ["end date", "batch end", "to"])),
      status: firstLabel(labels, ["status", "pipeline stage"]) ?? "",
      budget: numberValue(firstLabel(labels, ["budget", "value"])),
      owner_name: firstLabel(labels, ["owner"]) ?? "",
      notes: firstLabel(labels, ["notes", "remarks", "requirement details"]) ?? raw.trim(),
    };
  }

  return {
    batch_code: firstLabel(labels, ["batch code", "code", "batch id"]) ?? "",
    course_topic: firstLabel(labels, ["course", "course topic", "topic", "training topic", "program"]) ?? "",
    training_type: firstLabel(labels, ["training type", "type"]) ?? "",
    request_id: firstLabel(labels, ["linked request", "request", "course request"]) ?? "",
    trainer_id: firstLabel(labels, ["trainer", "assigned trainer"]) ?? "",
    participants: numberValue(firstLabel(labels, ["participants", "number of participants", "batch size"])),
    start_date: dateValue(firstLabel(labels, ["start date", "batch start", "from"])),
    end_date: dateValue(firstLabel(labels, ["end date", "batch end", "to"])),
    mode: firstLabel(labels, ["delivery mode", "mode"]) ?? "",
    status: firstLabel(labels, ["status", "batch status"]) ?? "",
    notes: firstLabel(labels, ["notes", "remarks"]) ?? raw.trim(),
  };
}
