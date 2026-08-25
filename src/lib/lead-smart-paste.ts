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
