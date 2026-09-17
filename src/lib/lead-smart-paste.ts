import type { CrmTable } from "@/lib/crm";

type PasteValues = Record<string, string>;
export type PasteConfidence = "high" | "review";
export type SmartPasteResult = {
  values: PasteValues;
  confidence: Record<string, PasteConfidence>;
  unclassified: string[];
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const WEBSITE = /(?:https?:\/\/|www\.)[^\s,;]+/i;
const COMPANY_SUFFIX =
  "(?:private\\s+limited|pvt\\.?\\s*ltd\\.?|limited|ltd\\.?|llp|inc\\.?|corporation|corp\\.?|group|company|industries|solutions|technologies|enterprises|consultants|consulting|services)";
const LEGAL_COMPANY_SUFFIX =
  "(?:private\\s+limited|pvt\\.?\\s*ltd\\.?|limited|ltd\\.?|llp|inc\\.?|corporation|corp\\.?)";
const PERSON = "([A-Z][A-Za-z.'-]+(?:\\s+[A-Z][A-Za-z.'-]+){1,3})";
const DATE_TOKEN =
  "(\\d{1,2}[\\/-]\\d{1,2}[\\/-](?:\\d{4}|\\d{2})|\\d{1,2}\\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*[,]?\\s+\\d{4})";

const KNOWN_LABELS = new Set([
  "company",
  "company name",
  "organisation",
  "organization",
  "client",
  "client name",
  "contact",
  "contact name",
  "contact person",
  "name",
  "email",
  "email id",
  "phone",
  "mobile",
  "contact number",
  "designation",
  "job title",
  "title",
  "position",
  "department",
  "function",
  "team",
  "industry",
  "sector",
  "city",
  "location",
  "service",
  "service line",
  "service interest",
  "requirement",
  "source",
  "lead source",
  "status",
  "lead status",
  "owner",
  "account owner",
  "contact owner",
  "deal owner",
  "notes",
  "remarks",
  "engagement type",
  "client type",
  "website",
  "web",
  "url",
  "last activity",
  "last contacted",
  "proposal name",
  "deal name",
  "opportunity",
  "amount",
  "contract value",
  "value",
  "estimated value",
  "budget",
  "stage",
  "pipeline stage",
  "expected close",
  "closing date",
  "close date",
  "sla signed on",
  "sla date",
  "trainer",
  "trainer name",
  "training type",
  "trainer type",
  "type",
  "expertise",
  "specialisation",
  "specialization",
  "skills",
  "topics",
  "rating",
  "day rate",
  "daily rate",
  "trainer fee",
  "fee",
  "profile summary",
  "bio",
  "summary",
  "corporate client",
  "existing client",
  "course",
  "course topic",
  "topic",
  "training topic",
  "program",
  "assigned trainer",
  "participants",
  "number of participants",
  "no. of participants",
  "batch size",
  "start date",
  "batch start",
  "from",
  "end date",
  "batch end",
  "to",
  "requirement details",
  "batch code",
  "code",
  "batch id",
  "linked request",
  "request",
  "course request",
  "delivery mode",
  "mode",
  "batch status",
]);

function clean(value: string) {
  return value
    .replace(/^[\s•*\-–—]+/, "")
    .replace(/[\s,;.]+$/, "")
    .trim();
}

function createResult(): SmartPasteResult {
  return { values: {}, confidence: {}, unclassified: [] };
}

function put(
  result: SmartPasteResult,
  field: string,
  value: string | undefined,
  confidence: PasteConfidence = "high",
) {
  const cleaned = value ? clean(value) : "";
  if (!cleaned || result.values[field]) return;
  result.values[field] = cleaned;
  result.confidence[field] = confidence;
}

function labelledValues(raw: string) {
  const values: Record<string, string> = {};
  const unknown: string[] = [];
  for (const line of raw
    .split(/\r?\n|\s*[|;]\s*/)
    .map(clean)
    .filter(Boolean)) {
    const match = line.match(/^([^:–—-]{2,40})\s*[:–—-]\s*(.+)$/);
    if (!match) continue;
    const label = match[1]!.trim().toLowerCase();
    values[label] = match[2]!.trim();
    if (!KNOWN_LABELS.has(label)) unknown.push(line);
  }
  return { values, unknown };
}

function firstLabel(labels: Record<string, string>, names: string[]) {
  return names.map((name) => labels[name]).find(Boolean);
}

function numberValue(value: string | undefined) {
  return value?.replace(/[^\d.]/g, "") ?? "";
}

function moneyValue(raw: string, labelled?: string) {
  if (labelled) return numberValue(labelled);
  const match = raw.match(
    /(?:budget|worth|value|fee|rate|cost|amount|contract(?:\s+value)?)(?:\s+(?:is|of|at))?\s*(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(crores?|cr|lakhs?|lacs?|k)?/i,
  );
  if (!match) return "";
  const base = Number(match[1]!.replace(/,/g, ""));
  if (!Number.isFinite(base)) return "";
  const unit = match[2]?.toLowerCase() ?? "";
  const multiplier = unit.startsWith("cr")
    ? 10_000_000
    : /la(?:kh|c)/.test(unit)
      ? 100_000
      : unit === "k"
        ? 1_000
        : 1;
  return String(base * multiplier);
}

function dateValue(value: string | undefined) {
  if (!value) return "";
  const dmy = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})$/);
  if (dmy) {
    const year = dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

function contextualDate(raw: string, contexts: string[]) {
  const context = contexts.join("|");
  const after = raw.match(
    new RegExp(`(?:${context})(?:\\s+(?:is|on|from|at|for))?\\s*${DATE_TOKEN}`, "i"),
  );
  if (after?.[1]) return dateValue(after[1]);
  const before = raw.match(new RegExp(`${DATE_TOKEN}\\s*(?:${context})`, "i"));
  return dateValue(before?.[1]);
}

function splitName(fullName: string | undefined) {
  const parts = fullName?.trim().split(/\s+/) ?? [];
  return {
    first_name: parts.length > 1 ? parts.slice(0, -1).join(" ") : "",
    last_name: parts.at(-1) ?? "",
  };
}

function companyName(raw: string) {
  const legalName = raw.match(
    new RegExp(`\\b([A-Z][A-Za-z0-9&.' -]{1,100}?\\b${LEGAL_COMPANY_SUFFIX})\\b`, "i"),
  );
  const suffixed =
    legalName ??
    raw.match(new RegExp(`\\b([A-Z][A-Za-z0-9&.' -]{1,100}?\\b${COMPANY_SUFFIX})\\b`, "i"));
  if (suffixed?.[1]) {
    const candidate = suffixed[1]
      .split(/\b(?:at|for|with|from|by)\s+/i)
      .at(-1)
      ?.replace(/^(?:contact|reach|client|company|proposal)\s+/i, "");
    return candidate ? clean(candidate) : undefined;
  }
  return raw.match(
    /\b(?:company|client|organisation|organization)\s+(?:is\s+)?(?:named\s+)?([A-Z][A-Za-z0-9&.' -]{2,80})(?=[,.;]|\s+(?:needs|requires|is|has|based|located)\b)/i,
  )?.[1];
}

function personName(raw: string) {
  const direct = raw.match(
    new RegExp(
      `\\b(?:contact(?:\\s+person)?|reach|speak\\s+(?:to|with)|trainer(?:\\s+is)?|assigned\\s+to)[:\\s]+${PERSON}(?=\\s+(?:at|on|via|is|for|from|will)\\b|[,.;]|$)`,
      "i",
    ),
  );
  if (direct?.[1]) return clean(direct[1].split(/[.,;]/)[0] ?? direct[1]);
  return raw.match(
    new RegExp(
      `\\b${PERSON}\\s+is\\s+(?:an?\\s+|the\\s+)?(?:HR|Human Resources|Talent|L&D|Learning|Training|Recruitment|Leadership|POSH|Technical|Soft Skills)\\b`,
    ),
  )?.[1];
}

function serviceLine(raw: string) {
  const mappings: Array<[RegExp, string]> = [
    [/\b(?:background verification|bgv)\b/i, "Background Verification (BGV)"],
    [
      /\b(?:salary benchmark|comp(?:ensation)? structure)\b/i,
      "Salary Benchmarking & Comp Structure",
    ],
    [
      /\b(?:organisation development|organization development|od intervention|change management)\b/i,
      "OD Interventions & Change Management",
    ],
    [/\b(?:executive search|leadership hiring|senior leadership hiring)\b/i, "Executive Search"],
    [/\b(?:rpo|recruitment process outsourcing)\b/i, "RPO"],
    [
      /\b(?:technical training|excel|power bi|data analytics|java|ai\s*&?\s*automation)\b/i,
      "Technical Training",
    ],
    [
      /\b(?:soft skills?|leadership training|posh training|communication training|sales training)\b/i,
      "Soft Skills / Leadership Training",
    ],
    [/\b(?:hr consulting|hr policies|sop|employee engagement)\b/i, "HR Consulting"],
    [/\b(?:recruitment|hiring|talent acquisition|staffing|placement)\b/i, "Recruitment & Staffing"],
  ];
  return mappings.find(([pattern]) => pattern.test(raw))?.[1] ?? "";
}

function trainingType(raw: string) {
  if (/\b(?:advanced excel|power bi|java|data analytics|ai|automation|technical)\b/i.test(raw))
    return "Technical";
  if (
    /\b(?:leadership|sales|communication|etiquette|collaboration|posh|soft skill|behavioural|behavioral)\b/i.test(
      raw,
    )
  )
    return "Soft Skills";
  return "";
}

function courseTopic(raw: string) {
  const courses: Array<[RegExp, string]> = [
    [/\badvanced excel\b/i, "Advanced Excel"],
    [/\bpower bi\b/i, "Power BI"],
    [/\bjava(?: programming)?\b/i, "Java Programming"],
    [/\bai\s*(?:&|and)?\s*automation\b/i, "AI & Automation"],
    [/\bdata analytics\b/i, "Data Analytics"],
    [/\bleadership(?: development| training)?\b/i, "Leadership Development"],
    [/\bsales negotiation\b/i, "Sales Negotiation"],
    [/\bcommunication skills?\b/i, "Communication Skills"],
    [/\bbusiness etiquette\b/i, "Business Etiquette"],
    [/\bteam collaboration\b/i, "Team Collaboration"],
    [/\bposh(?: awareness| training)?\b/i, "POSH Awareness"],
  ];
  return courses.find(([pattern]) => pattern.test(raw))?.[1] ?? "";
}

function deliveryMode(raw: string) {
  if (/\b(?:hybrid|blended)\b/i.test(raw)) return "Hybrid";
  if (/\b(?:virtual|online|remote|zoom|teams)\b/i.test(raw)) return "Virtual";
  if (/\b(?:onsite|on-site|in[ -]person|classroom|at (?:the )?(?:client|office))\b/i.test(raw))
    return "Onsite";
  return "";
}

function leadStatus(raw: string) {
  if (/\bdisqualified|not interested|invalid lead\b/i.test(raw)) return "Disqualified";
  if (/\bconverted|won|client onboarded\b/i.test(raw)) return "Converted";
  if (/\bqualified|interested|requirement confirmed\b/i.test(raw)) return "Qualified";
  if (/\bcontacted|spoke|called|emailed\b/i.test(raw)) return "Contacted";
  if (/\bnew lead\b/i.test(raw)) return "New";
  return "";
}

function leadSource(raw: string) {
  if (/\blinkedin\b/i.test(raw)) return "LinkedIn Outreach";
  if (/\breferr(?:al|ed)\b/i.test(raw)) return "Referral";
  if (/\bcold call\b/i.test(raw)) return "Cold Call";
  if (/\bevent|conference|exhibition\b/i.test(raw)) return "Event";
  if (/\bwebsite|web inquiry|inbound\b/i.test(raw)) return "Inbound Website";
  return "";
}

function dealStage(raw: string) {
  if (/\bsla\s+signed|agreement signed|contract signed\b/i.test(raw)) return "SLA Signed";
  if (/\bsla negotiation|negotiat(?:ing|ion)|commercial discussion\b/i.test(raw))
    return "SLA Negotiation";
  if (/\bproposal sent|quote sent|proposal shared\b/i.test(raw)) return "Proposal Sent";
  if (/\bpitch scheduled|meeting scheduled|presentation scheduled\b/i.test(raw))
    return "Pitch Scheduled";
  if (/\bnew (?:opportunity|lead|deal)\b/i.test(raw)) return "New Lead";
  return "";
}

function trainingStatus(raw: string) {
  if (/\bcompleted(?:\s+and)?\s+invoiced|invoice raised\b/i.test(raw))
    return "Completed & Invoiced";
  if (/\bbatch scheduled|session scheduled|training scheduled\b/i.test(raw))
    return "Batch Scheduled";
  if (/\btrainer assigned\b/i.test(raw)) return "Trainer Assigned";
  if (/\b(?:curriculum|quote|proposal) sent\b/i.test(raw)) return "Curriculum & Quote Sent";
  if (/\binquiry received|new inquiry|enquiry received\b/i.test(raw)) return "Inquiry Received";
  return "";
}

function batchStatus(raw: string) {
  if (/\bcancelled|canceled\b/i.test(raw)) return "Cancelled";
  if (/\bcompleted|finished\b/i.test(raw)) return "Completed";
  if (/\bin progress|ongoing|currently running\b/i.test(raw)) return "In Progress";
  if (/\bscheduled|confirmed\b/i.test(raw)) return "Scheduled";
  return "";
}

function addCommon(result: SmartPasteResult, raw: string, labels: Record<string, string>) {
  put(result, "email", firstLabel(labels, ["email", "email id"]) ?? raw.match(EMAIL)?.[0]);
  const phone = firstLabel(labels, ["phone", "mobile", "contact number"]) ?? raw.match(PHONE)?.[0];
  if (phone && phone.replace(/\D/g, "").length >= 8) put(result, "phone", phone);
  put(
    result,
    "owner_name",
    firstLabel(labels, ["owner", "account owner", "contact owner", "deal owner"]),
  );
}

export function parseLeadPasteDetailed(raw: string): SmartPasteResult {
  const result = createResult();
  const labelled = labelledValues(raw);
  const labels = labelled.values;
  addCommon(result, raw, labels);
  put(
    result,
    "company_name",
    firstLabel(labels, [
      "company",
      "company name",
      "organisation",
      "organization",
      "client",
      "client name",
    ]) ?? companyName(raw),
  );
  put(
    result,
    "contact_name",
    firstLabel(labels, ["contact", "contact name", "contact person", "name"]) ?? personName(raw),
  );
  const cityState = raw.match(
    /\b([A-Z][A-Za-z.' -]+),\s*(Haryana|Maharashtra|Delhi|Karnataka|Tamil Nadu|Telangana|Gujarat|Rajasthan|West Bengal|Uttar Pradesh|Madhya Pradesh|Punjab|Kerala|Goa)\b/,
  );
  const location = raw.match(
    /\b(?:located|based|headquartered|operates?)\s+(?:from|in|at)\s+([^.;,]+?)(?=\s+(?:and|with|for|which|that)\b|[.;,]|$)/i,
  );
  const based = raw.match(/\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*)-based\b/);
  put(
    result,
    "city",
    firstLabel(labels, ["city", "location"]) ??
      (cityState ? `${cityState[1]}, ${cityState[2]}` : (location?.[1] ?? based?.[1])),
  );
  const industry =
    raw.match(
      /\b(?:is|as)\s+(?:an?|the)\s+(?:(?:[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*)-based\s+)?(.+?)\s+(?:company|business|brand|organisation|organization)\b/i,
    )?.[1] ?? raw.match(/\boperates?\s+in\s+(?:the\s+)?(.+?)\s+(?:industry|sector)\b/i)?.[1];
  put(
    result,
    "industry",
    firstLabel(labels, ["industry", "sector"]) ?? industry,
    industry ? "review" : "high",
  );
  put(
    result,
    "service_interest",
    firstLabel(labels, ["service", "service line", "service interest", "requirement"]) ??
      serviceLine(raw),
  );
  put(result, "source", firstLabel(labels, ["source", "lead source"]) ?? leadSource(raw));
  put(result, "status", firstLabel(labels, ["status", "lead status"]) ?? leadStatus(raw));
  put(
    result,
    "estimated_value",
    moneyValue(raw, firstLabel(labels, ["estimated value", "value", "budget"])),
  );
  put(result, "notes", firstLabel(labels, ["notes", "remarks"]) ?? raw.trim(), "review");
  result.unclassified = labelled.unknown;
  return result;
}

export function parseLeadPaste(raw: string): PasteValues {
  return parseLeadPasteDetailed(raw).values;
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

export function parseSmartPasteDetailed(table: CrmTable, raw: string): SmartPasteResult {
  if (table === "leads") return parseLeadPasteDetailed(raw);
  const result = createResult();
  const labelled = labelledValues(raw);
  const labels = labelled.values;
  result.unclassified = labelled.unknown;
  addCommon(result, raw, labels);

  if (table === "accounts") {
    const lead = parseLeadPasteDetailed(raw);
    put(
      result,
      "name",
      firstLabel(labels, [
        "client name",
        "company name",
        "company",
        "organisation",
        "organization",
      ]) ?? lead.values["company_name"],
    );
    put(
      result,
      "industry",
      firstLabel(labels, ["industry", "sector"]) ?? lead.values["industry"],
      lead.confidence["industry"],
    );
    const inferredType = /\bmultiple|multi[- ]service\b/i.test(raw)
      ? "Multi-service"
      : serviceLine(raw).replace("Recruitment & Staffing", "Recruitment");
    put(
      result,
      "client_type",
      firstLabel(labels, ["engagement type", "client type"]) ?? inferredType,
    );
    put(result, "city", firstLabel(labels, ["city", "location"]) ?? lead.values["city"]);
    put(
      result,
      "website",
      firstLabel(labels, ["website", "web", "url"]) ??
        raw.match(WEBSITE)?.[0]?.replace(/[.,;]+$/, ""),
    );
    result.unclassified.push(...lead.unclassified);
    return result;
  }

  if (table === "contacts") {
    const explicitName = firstLabel(labels, ["contact person", "contact name", "name"]);
    const inferredName =
      personName(raw) ?? raw.match(new RegExp(`^${PERSON}(?=\\s+(?:is|works|from|at)\\b)`))?.[1];
    const name = splitName(explicitName ?? inferredName);
    put(result, "first_name", name.first_name, explicitName ? "high" : "review");
    put(result, "last_name", name.last_name, explicitName ? "high" : "review");
    const title = raw.match(
      /\b(?:is|works as|serves as)\s+(?:an?|the)?\s*([^,.;]+?)\s+(?:at|with|for)\s+[A-Z]/i,
    )?.[1];
    put(
      result,
      "title",
      firstLabel(labels, ["designation", "job title", "title", "position"]) ?? title,
      title ? "review" : "high",
    );
    const department = raw.match(
      /\b(?:works? in|part of|from)\s+(?:the\s+)?([^,.;]+?)(?:\s+(?:department|team|function))?(?=[,.;]|$)/i,
    )?.[1];
    put(
      result,
      "department",
      firstLabel(labels, ["department", "function", "team"]) ?? department,
      department ? "review" : "high",
    );
    put(
      result,
      "account_id",
      firstLabel(labels, ["company", "company name", "corporate client", "client"]) ??
        companyName(raw),
    );
    put(
      result,
      "last_activity_date",
      dateValue(firstLabel(labels, ["last activity", "last contacted"])) ||
        contextualDate(raw, ["last contacted", "last activity", "spoke on", "called on"]),
    );
    return result;
  }

  if (table === "deals") {
    const inferredCompany = companyName(raw);
    const inferredService = serviceLine(raw);
    const firstClause = clean(raw.split(/\r?\n|[.;]/)[0] ?? "");
    const generatedName =
      inferredCompany && inferredService ? `${inferredService} – ${inferredCompany}` : firstClause;
    put(
      result,
      "deal_name",
      firstLabel(labels, ["proposal name", "deal name", "opportunity", "requirement"]) ??
        generatedName,
      "review",
    );
    put(
      result,
      "amount",
      moneyValue(
        raw,
        firstLabel(labels, ["amount", "contract value", "value", "estimated value", "budget"]),
      ),
    );
    put(
      result,
      "stage",
      firstLabel(labels, ["stage", "pipeline stage", "status"]) ?? dealStage(raw),
    );
    put(
      result,
      "service_line",
      firstLabel(labels, ["service", "service line", "service interest"]) ?? inferredService,
    );
    put(
      result,
      "account_id",
      firstLabel(labels, ["company", "company name", "corporate client", "client"]) ??
        inferredCompany,
    );
    put(
      result,
      "contact_id",
      firstLabel(labels, ["contact", "contact person", "client contact"]) ?? personName(raw),
    );
    put(
      result,
      "closing_date",
      dateValue(firstLabel(labels, ["expected close", "closing date", "close date"])) ||
        contextualDate(raw, ["expected to close", "close(?:s|d)?", "closing date"]),
    );
    put(
      result,
      "sla_signed_date",
      dateValue(firstLabel(labels, ["sla signed on", "sla date"])) ||
        contextualDate(raw, ["sla signed", "agreement signed"]),
    );
    return result;
  }

  if (table === "trainers") {
    const inferredName =
      personName(raw) ??
      raw.match(new RegExp(`^${PERSON}(?=\\s+(?:is|works|has|specialises|specializes)\\b)`))?.[1];
    put(
      result,
      "full_name",
      firstLabel(labels, ["trainer", "trainer name", "name"]) ?? inferredName,
      inferredName ? "review" : "high",
    );
    put(
      result,
      "training_type",
      firstLabel(labels, ["training type", "trainer type", "type"]) ?? trainingType(raw),
    );
    const expertise = raw.match(
      /\b(?:expertise|speciali[sz]es? in|trainer (?:in|for)|trains? (?:in|on))\s+([^.;]+?)(?=\s+(?:with|and (?:a|has)|charging|at a rate)|[.;]|$)/i,
    )?.[1];
    put(
      result,
      "expertise",
      firstLabel(labels, ["expertise", "specialisation", "specialization", "skills", "topics"]) ??
        expertise,
      expertise ? "review" : "high",
    );
    put(
      result,
      "rating",
      numberValue(
        firstLabel(labels, ["rating"]) ??
          raw.match(/\b(?:rated|rating(?:\s+is)?)[\s:]*(\d(?:\.\d)?)\s*(?:\/\s*5)?\b/i)?.[1],
      ),
    );
    put(
      result,
      "day_rate",
      moneyValue(raw, firstLabel(labels, ["day rate", "daily rate", "trainer fee", "fee"])),
    );
    put(
      result,
      "bio",
      firstLabel(labels, ["profile summary", "bio", "summary"]) ?? raw.trim(),
      "review",
    );
    return result;
  }

  const participants =
    firstLabel(labels, [
      "participants",
      "number of participants",
      "no. of participants",
      "batch size",
    ]) ??
    raw.match(
      /\b(?:for|with|of)?\s*(\d{1,5})\s+(?:participants?|employees?|people|attendees?|learners?|members?)\b/i,
    )?.[1];
  const inferredClient =
    companyName(raw) ??
    raw.match(/^([A-Z][A-Za-z0-9&.' -]{2,80}?)\s+(?:needs|requires|wants|is looking for)\b/i)?.[1];
  const inferredTrainer = raw.match(
    new RegExp(
      `\\b(?:trainer|facilitator|assigned to|conducted by)(?:\\s+is|\\s+will be|[:\\s]+)\\s*${PERSON}`,
    ),
  )?.[1];

  if (table === "training_requests") {
    put(
      result,
      "account_id",
      firstLabel(labels, ["corporate client", "existing client"]) ?? inferredClient,
    );
    put(
      result,
      "client_name",
      firstLabel(labels, ["client name", "company", "company name", "client"]) ?? inferredClient,
    );
    put(
      result,
      "training_type",
      firstLabel(labels, ["training type", "type"]) ?? trainingType(raw),
    );
    put(
      result,
      "course_topic",
      firstLabel(labels, ["course", "course topic", "topic", "training topic", "program"]) ??
        courseTopic(raw),
    );
    put(
      result,
      "trainer_id",
      firstLabel(labels, ["trainer", "assigned trainer"]) ?? inferredTrainer,
    );
    put(result, "participants", numberValue(participants));
    put(
      result,
      "start_date",
      dateValue(firstLabel(labels, ["start date", "batch start", "from"])) ||
        contextualDate(raw, [
          "starts?",
          "begin(?:s)?",
          "scheduled (?:on|for)",
          "training (?:on|from)",
          "session (?:on|from)",
        ]),
    );
    put(
      result,
      "end_date",
      dateValue(firstLabel(labels, ["end date", "batch end", "to"])) ||
        contextualDate(raw, ["ends?", "until", "through"]),
    );
    put(result, "status", firstLabel(labels, ["status", "pipeline stage"]) ?? trainingStatus(raw));
    put(result, "budget", moneyValue(raw, firstLabel(labels, ["budget", "value"])));
    put(
      result,
      "notes",
      firstLabel(labels, ["notes", "remarks", "requirement details"]) ?? raw.trim(),
      "review",
    );
    return result;
  }

  put(
    result,
    "batch_code",
    firstLabel(labels, ["batch code", "code", "batch id"]) ??
      raw.match(/\bbatch(?:\s+(?:code|id))?[:\s-]+([A-Z0-9][A-Z0-9_-]{2,30})\b/i)?.[1],
  );
  put(
    result,
    "course_topic",
    firstLabel(labels, ["course", "course topic", "topic", "training topic", "program"]) ??
      courseTopic(raw),
  );
  put(result, "training_type", firstLabel(labels, ["training type", "type"]) ?? trainingType(raw));
  put(result, "request_id", firstLabel(labels, ["linked request", "request", "course request"]));
  put(result, "trainer_id", firstLabel(labels, ["trainer", "assigned trainer"]) ?? inferredTrainer);
  put(result, "participants", numberValue(participants));
  put(
    result,
    "start_date",
    dateValue(firstLabel(labels, ["start date", "batch start", "from"])) ||
      contextualDate(raw, ["starts?", "begin(?:s)?", "scheduled (?:on|for)"]),
  );
  put(
    result,
    "end_date",
    dateValue(firstLabel(labels, ["end date", "batch end", "to"])) ||
      contextualDate(raw, ["ends?", "until", "through"]),
  );
  put(result, "mode", firstLabel(labels, ["delivery mode", "mode"]) ?? deliveryMode(raw));
  put(result, "status", firstLabel(labels, ["status", "batch status"]) ?? batchStatus(raw));
  put(result, "notes", firstLabel(labels, ["notes", "remarks"]) ?? raw.trim(), "review");
  return result;
}

export function parseSmartPaste(table: CrmTable, raw: string): PasteValues {
  return parseSmartPasteDetailed(table, raw).values;
}
