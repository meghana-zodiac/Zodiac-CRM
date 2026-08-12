import type { FieldDef } from "./record-dialog";
import {
  ACTIVITY_STATUSES,
  BENCHMARK_METRICS,
  BENCHMARK_PERCENTILES,
  BGV_CHECK_TYPES,
  BGV_SERVICE_LINE,
  BGV_VERIFICATION_STATUSES,
  COMP_SERVICE_LINE,
  OD_DELIVERABLES,
  OD_SCOPES,
  OD_SERVICE_LINE,
  ACTIVITY_TYPES,
  ALL_COURSES,
  BATCH_STATUSES,
  BD_STAGES,
  CLIENT_TYPES,
  DELIVERY_MODES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  SERVICE_LINES,
  TRAINING_STATUSES,
  TRAINING_TYPES,
  fullName,
} from "@/lib/crm";
import type { Account, Contact, Trainer, TrainingRequest } from "@/lib/crm";
import { teamMembers } from "./nav-data";

const opts = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

const ownerField: FieldDef = {
  name: "owner_name",
  label: "Owner",
  type: "select",
  options: opts(teamMembers),
};

/** Service-line specific tracking fields, revealed when that line is selected. */
export const serviceDetailFields = (dependsOn: string): FieldDef[] => [
  // Background Verification (BGV)
  {
    name: "service_details.bgv_check_types",
    label: "BGV check types",
    span: 2,
    type: "select",
    options: opts(BGV_CHECK_TYPES),
    placeholder: "Employment, Academic, Criminal",
    dependsOn,
    showWhen: [BGV_SERVICE_LINE],
  },
  {
    name: "service_details.bgv_monthly_volume",
    label: "Monthly candidate volume",
    type: "number",
    placeholder: "250",
    dependsOn,
    showWhen: [BGV_SERVICE_LINE],
  },
  {
    name: "service_details.bgv_tat_days",
    label: "SLA turnaround (days)",
    type: "number",
    placeholder: "7",
    dependsOn,
    showWhen: [BGV_SERVICE_LINE],
  },
  {
    name: "service_details.bgv_verification_status",
    label: "Verification status",
    type: "select",
    options: opts(BGV_VERIFICATION_STATUSES),
    dependsOn,
    showWhen: [BGV_SERVICE_LINE],
  },
  // OD Interventions & Change Management
  {
    name: "service_details.od_scope",
    label: "Intervention scope",
    span: 2,
    type: "select",
    options: opts(OD_SCOPES),
    placeholder: "Leadership, Culture",
    dependsOn,
    showWhen: [OD_SERVICE_LINE],
  },
  {
    name: "service_details.od_duration",
    label: "Duration",
    placeholder: "6 weeks",
    dependsOn,
    showWhen: [OD_SERVICE_LINE],
  },
  {
    name: "service_details.od_sessions",
    label: "No. of sessions",
    type: "number",
    placeholder: "8",
    dependsOn,
    showWhen: [OD_SERVICE_LINE],
  },
  {
    name: "service_details.od_lead_consultant",
    label: "Lead OD consultant",
    type: "select",
    options: opts(teamMembers),
    placeholder: "Nuzhat",
    dependsOn,
    showWhen: [OD_SERVICE_LINE],
  },
  {
    name: "service_details.od_deliverables",
    label: "Target deliverables",
    span: 2,
    type: "select",
    options: opts(OD_DELIVERABLES),
    placeholder: "SOPs, Diagnostic Report",
    dependsOn,
    showWhen: [OD_SERVICE_LINE],
  },
  // Salary Benchmarking & Comp Structure
  {
    name: "service_details.comp_target_roles",
    label: "Target roles",
    placeholder: "Engineering Manager, SDE II",
    dependsOn,
    showWhen: [COMP_SERVICE_LINE],
  },
  {
    name: "service_details.comp_industry_sector",
    label: "Industry sector",
    placeholder: "IT Services",
    dependsOn,
    showWhen: [COMP_SERVICE_LINE],
  },
  {
    name: "service_details.comp_metrics",
    label: "Benchmark metrics",
    span: 2,
    type: "select",
    options: opts(BENCHMARK_METRICS),
    placeholder: "Base Salary, Variable, ESOPs",
    dependsOn,
    showWhen: [COMP_SERVICE_LINE],
  },
  {
    name: "service_details.comp_percentile",
    label: "Target percentile",
    type: "select",
    options: opts(BENCHMARK_PERCENTILES),
    dependsOn,
    showWhen: [COMP_SERVICE_LINE],
  },
  {
    name: "service_details.comp_delivery_date",
    label: "Target delivery date",
    type: "date",
    dependsOn,
    showWhen: [COMP_SERVICE_LINE],
  },
];

export const accountFields: FieldDef[] = [
  { name: "name", label: "Client name", required: true, placeholder: "Nexora Technologies Pvt Ltd" },
  { name: "industry", label: "Industry", placeholder: "IT Services" },
  { name: "client_type", label: "Engagement type", type: "select", options: opts(CLIENT_TYPES) },
  { name: "city", label: "City", placeholder: "Bengaluru" },
  { name: "website", label: "Website", placeholder: "nexora.com" },
  { name: "phone", label: "Phone", type: "tel", placeholder: "+91 98765 43210" },
  ownerField,
];

export const leadFields: FieldDef[] = [
  {
    name: "company_name",
    label: "Company name",
    required: true,
    span: 2,
    placeholder: "Vertex Global Services",
  },
  { name: "contact_name", label: "Contact person", placeholder: "Rahul Menon" },
  { name: "email", label: "Email", type: "email", placeholder: "rahul@vertexglobal.in" },
  { name: "phone", label: "Phone", type: "tel", placeholder: "+91 98450 11223" },
  { name: "industry", label: "Industry", placeholder: "IT Services" },
  { name: "city", label: "City", placeholder: "Bengaluru" },
  {
    name: "service_interest",
    label: "Service interest",
    type: "select",
    options: opts(SERVICE_LINES),
  },
  { name: "source", label: "Lead source", type: "select", options: opts(LEAD_SOURCES) },
  { name: "status", label: "Lead status", type: "select", options: opts(LEAD_STATUSES) },
  { name: "estimated_value", label: "Estimated value (₹)", type: "number", placeholder: "1200000" },
  ownerField,
  { name: "notes", label: "Qualification notes", type: "textarea" },
];

export const contactFields = (accounts: Account[]): FieldDef[] => [
  { name: "first_name", label: "First name", placeholder: "Ananya" },
  { name: "last_name", label: "Last name", required: true, placeholder: "Sharma" },
  { name: "email", label: "Email", type: "email", placeholder: "ananya@nexora.com" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "title", label: "Designation", placeholder: "Head of Learning & Development" },
  { name: "department", label: "Department", placeholder: "Human Resources" },
  {
    name: "account_id",
    label: "Corporate client",
    type: "select",
    options: accounts.map((account) => ({ value: account.id, label: account.name })),
  },
  ownerField,
  { name: "last_activity_date", label: "Last activity", type: "date" },
];

export const dealFields = (accounts: Account[], contacts: Contact[]): FieldDef[] => [
  {
    name: "deal_name",
    label: "Proposal name",
    required: true,
    span: 2,
    placeholder: "Nexora — RPO retainer FY26",
  },
  { name: "amount", label: "Contract value (₹)", type: "number", placeholder: "1200000" },
  { name: "stage", label: "SLA pipeline stage", type: "select", options: opts(BD_STAGES) },
  { name: "service_line", label: "Service line", type: "select", options: opts(SERVICE_LINES) },
  {
    name: "account_id",
    label: "Corporate client",
    type: "select",
    options: accounts.map((account) => ({ value: account.id, label: account.name })),
  },
  {
    name: "contact_id",
    label: "Client contact",
    type: "select",
    options: contacts.map((contact) => ({
      value: contact.id,
      label: fullName(contact.first_name, contact.last_name),
    })),
  },
  { name: "closing_date", label: "Expected close", type: "date" },
  { name: "sla_signed_date", label: "SLA signed on", type: "date" },
  ownerField,
  ...serviceDetailFields("service_line"),
];

export const trainerFields: FieldDef[] = [
  { name: "full_name", label: "Trainer name", required: true, placeholder: "Meera Iyer" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "training_type", label: "Training type", type: "select", options: opts(TRAINING_TYPES) },
  {
    name: "expertise",
    label: "Expertise",
    span: 2,
    placeholder: "Power BI, Advanced Excel, Data Storytelling",
  },
  { name: "rating", label: "Rating (/5)", type: "number" },
  { name: "day_rate", label: "Day rate (₹)", type: "number" },
  { name: "bio", label: "Profile summary", type: "textarea" },
];

export const trainingRequestFields = (
  accounts: Account[],
  trainers: Trainer[],
): FieldDef[] => [
  {
    name: "account_id",
    label: "Corporate client",
    type: "select",
    options: accounts.map((account) => ({ value: account.id, label: account.name })),
  },
  { name: "client_name", label: "Client name (if new)", placeholder: "Zenith Manufacturing" },
  { name: "training_type", label: "Training type", type: "select", options: opts(TRAINING_TYPES) },
  {
    name: "course_topic",
    label: "Course / topic",
    required: true,
    type: "select",
    options: opts(ALL_COURSES),
  },
  {
    name: "trainer_id",
    label: "Assigned trainer",
    type: "select",
    options: trainers.map((trainer) => ({ value: trainer.id, label: trainer.full_name })),
  },
  { name: "participants", label: "No. of participants", type: "number" },
  { name: "start_date", label: "Batch start", type: "date" },
  { name: "end_date", label: "Batch end", type: "date" },
  { name: "status", label: "L&D pipeline stage", type: "select", options: opts(TRAINING_STATUSES) },
  { name: "budget", label: "Budget (₹)", type: "number" },
  ownerField,
  { name: "notes", label: "Notes", type: "textarea" },
];

export const trainingBatchFields = (
  requests: TrainingRequest[],
  trainers: Trainer[],
): FieldDef[] => [
  { name: "batch_code", label: "Batch code", required: true, placeholder: "ZB-2026-014" },
  { name: "course_topic", label: "Course / topic", type: "select", options: opts(ALL_COURSES) },
  { name: "training_type", label: "Training type", type: "select", options: opts(TRAINING_TYPES) },
  {
    name: "request_id",
    label: "Linked request",
    type: "select",
    options: requests.map((request) => ({ value: request.id, label: request.course_topic })),
  },
  {
    name: "trainer_id",
    label: "Assigned trainer",
    type: "select",
    options: trainers.map((trainer) => ({ value: trainer.id, label: trainer.full_name })),
  },
  { name: "participants", label: "Participants", type: "number" },
  { name: "start_date", label: "Start date", type: "date" },
  { name: "end_date", label: "End date", type: "date" },
  { name: "mode", label: "Delivery mode", type: "select", options: opts(DELIVERY_MODES) },
  { name: "status", label: "Batch status", type: "select", options: opts(BATCH_STATUSES) },
  { name: "notes", label: "Notes", type: "textarea" },
];

export const activityFields = (type?: string): FieldDef[] => [
  { name: "title", label: "Subject", required: true, span: 2 },
  {
    name: "activity_type",
    label: "Type",
    type: "select",
    options: opts(type ? [type] : ACTIVITY_TYPES),
  },
  { name: "status", label: "Status", type: "select", options: opts(ACTIVITY_STATUSES) },
  { name: "due_date", label: "Date & time", type: "datetime" },
  ownerField,
  {
    name: "related_to_type",
    label: "Related to",
    type: "select",
    options: opts([
      "Corporate Lead",
      "Client",
      "Client Contact",
      "Proposal",
      "Training Request",
      "Training Batch",
    ]),
  },
  {
    name: "service_line",
    label: "Service line",
    type: "select",
    options: opts(SERVICE_LINES),
  },
  ...serviceDetailFields("service_line"),
  { name: "notes", label: "Notes", type: "textarea" },
];
