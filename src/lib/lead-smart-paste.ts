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

    const email = line.match(EMAIL)?.[0];
    if (email) {
      setIfEmpty(values, "email", email);
      const remainder = clean(line.replace(email, ""));
      if (remainder) unmatched.push(remainder);
      continue;
    }

    const phone = line.match(PHONE)?.[0];
    if (phone && phone.replace(/\D/g, "").length >= 8) {
      setIfEmpty(values, "phone", phone.trim());
      const remainder = clean(line.replace(phone, ""));
      if (remainder) unmatched.push(remainder);
      continue;
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
