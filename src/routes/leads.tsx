import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Clock3,
  FileSpreadsheet,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { ListModule, type Column } from "@/components/crm/list-module";
import { ModuleTabs, type ModuleTab } from "@/components/crm/module-tabs";
import { ApolloProspector } from "@/components/crm/apollo-prospector";
import { StatusPill, leadTone } from "@/components/crm/status-pill";
import { leadFields } from "@/components/crm/field-defs";
import { LeadImportDialog } from "@/components/crm/lead-import-dialog";
import { RecordDialog } from "@/components/crm/record-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DesktopContactActions } from "@/components/crm/desktop-contact-actions";
import { activityFields } from "@/components/crm/field-defs";
import {
  LEAD_STATUSES,
  currency,
  formatDateOnly,
  updateRecord,
  type ActivityType,
  type Lead,
} from "@/lib/crm";
import { syncCeipalLeadContacts, syncCeipalLeads } from "@/lib/ceipal.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Corporate Leads — Zodiac HR Consultants" },
      {
        name: "description",
        content:
          "Qualify inbound and outbound corporate leads for staffing, executive search, RPO, HR consulting and training engagements.",
      },
      { property: "og:title", content: "Corporate Leads — Zodiac HR Consultants" },
      {
        property: "og:description",
        content:
          "Qualify inbound and outbound corporate leads for staffing, executive search, RPO, HR consulting and training engagements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadsPage,
});

const CALL_STATUSES = [
  "Interested",
  "Not Interested",
  "Follow-up Required",
  "Call Back",
  "No Response",
  "Busy",
  "Wrong Number",
  "Converted / Closed",
] as const;

type CallStatus = (typeof CALL_STATUSES)[number];
const CLEAR_CALL_STATUS = "__clear_call_status__";

type InlineLeadField =
  | "contact_name"
  | "company_name"
  | "industry"
  | "city"
  | "designation"
  | "phone"
  | "phone_2"
  | "email"
  | "landline"
  | "age_or_dob"
  | "notes";

const CALL_STATUS_STYLE: Record<CallStatus, { pill: string; dot: string; row: string }> = {
  Interested: {
    pill: "border-emerald-300 bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
    row: "bg-emerald-50/80 hover:bg-emerald-100/70",
  },
  "Not Interested": {
    pill: "border-rose-300 bg-rose-100 text-rose-800",
    dot: "bg-rose-500",
    row: "bg-rose-50/80 hover:bg-rose-100/70",
  },
  "Follow-up Required": {
    pill: "border-amber-300 bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    row: "bg-amber-50/80 hover:bg-amber-100/70",
  },
  "Call Back": {
    pill: "border-orange-300 bg-orange-100 text-orange-800",
    dot: "bg-orange-500",
    row: "bg-orange-50/80 hover:bg-orange-100/70",
  },
  "No Response": {
    pill: "border-slate-300 bg-slate-100 text-slate-700",
    dot: "bg-slate-500",
    row: "bg-slate-50/90 hover:bg-slate-100/80",
  },
  Busy: {
    pill: "border-violet-300 bg-violet-100 text-violet-800",
    dot: "bg-violet-500",
    row: "bg-violet-50/80 hover:bg-violet-100/70",
  },
  "Wrong Number": {
    pill: "border-red-300 bg-red-100 text-red-800",
    dot: "bg-red-600",
    row: "bg-red-50/80 hover:bg-red-100/70",
  },
  "Converted / Closed": {
    pill: "border-blue-300 bg-blue-100 text-blue-800",
    dot: "bg-blue-600",
    row: "bg-blue-50/80 hover:bg-blue-100/70",
  },
};

function isCallStatus(value: string | null): value is CallStatus {
  return CALL_STATUSES.includes(value as CallStatus);
}

function CallStatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (status: CallStatus | null) => void;
  disabled?: boolean;
}) {
  const selected = isCallStatus(value) ? value : null;
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Select
        value={selected ?? CLEAR_CALL_STATUS}
        onValueChange={(status) =>
          onChange(status === CLEAR_CALL_STATUS ? null : (status as CallStatus))
        }
        disabled={disabled}
      >
        <SelectTrigger
          className={`h-9 min-w-48 border ${selected ? CALL_STATUS_STYLE[selected].pill : "bg-surface"}`}
          aria-label="Call status"
        >
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CLEAR_CALL_STATUS}>
            <span className="text-muted-foreground">Select status</span>
          </SelectItem>
          {CALL_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              <span className="flex items-center gap-2">
                <span className={`size-2.5 rounded-full ${CALL_STATUS_STYLE[status].dot}`} />
                {status}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function InlineLeadCell({
  value,
  displayValue,
  required = false,
  onSave,
}: {
  value: string | null;
  displayValue?: string;
  required?: boolean;
  onSave: (value: string | null) => Promise<void>;
}) {
  const initialValue = value ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(initialValue);
  }, [editing, initialValue]);

  const save = async () => {
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    const normalized = draft.trim();
    if (required && !normalized) {
      toast.error("This field cannot be left empty.");
      return;
    }
    if (normalized === initialValue.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(normalized || null);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <span
        className="block min-h-5 cursor-text"
        title="Double-click to edit"
        onDoubleClick={(event) => {
          event.stopPropagation();
          setEditing(true);
        }}
      >
        {displayValue ?? value ?? "—"}
      </span>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      disabled={saving}
      className="h-8 w-full min-w-32 rounded-md border border-primary bg-surface px-2 text-sm text-foreground outline-none ring-2 ring-primary/20"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void save()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          void save();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancelRef.current = true;
          setDraft(initialValue);
          setEditing(false);
        }
      }}
      aria-label="Edit lead field"
    />
  );
}

const LEADS_PAGE_SIZE = 500;
type LeadOrigin = "uploaded" | "ceipal";

async function fetchLeadsByOrigin(origin: LeadOrigin) {
  const records: Lead[] = [];

  for (let from = 0; ; from += LEADS_PAGE_SIZE) {
    let request = supabase.from("leads").select("*");
    request =
      origin === "ceipal"
        ? request.or("ceipal_id.not.is.null,source.ilike.CEIPAL")
        : request.is("ceipal_id", null).or("source.is.null,source.not.ilike.CEIPAL");

    const { data, error } = await request
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + LEADS_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    const page = (data ?? []) as Lead[];
    records.push(...page);
    if (page.length < LEADS_PAGE_SIZE) break;
  }

  return records;
}

function LeadsPage() {
  const queryClient = useQueryClient();
  const runCeipalSync = useServerFn(syncCeipalLeads);
  const runCeipalContactSync = useServerFn(syncCeipalLeadContacts);
  const [tab, setTab] = useState<ModuleTab>("records");
  const uploadedLeads = useQuery({
    queryKey: ["leads", "uploaded"],
    queryFn: () => fetchLeadsByOrigin("uploaded"),
    retry: 2,
  });
  const ceipalLeads = useQuery({
    queryKey: ["leads", "ceipal"],
    queryFn: () => fetchLeadsByOrigin("ceipal"),
    enabled: tab === "ceipal",
    retry: 2,
  });
  const [importOpen, setImportOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>("Task");
  const [activityTitle, setActivityTitle] = useState("Follow up");
  const [activityLead, setActivityLead] = useState<Lead | null>(null);
  const activeLeadsQuery = tab === "ceipal" ? ceipalLeads : uploadedLeads;
  const callStatusUpdate = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CallStatus | null }) => {
      const { error } = await supabase.from("leads").update({ call_status: status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error: Error) => toast.error(`Call status could not be updated: ${error.message}`),
  });
  const inlineLeadUpdate = useMutation({
    mutationFn: async ({
      id,
      field,
      value,
    }: {
      id: string;
      field: InlineLeadField;
      value: string | null;
    }) => updateRecord("leads", id, { [field]: value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error: Error) => toast.error(`Lead could not be updated: ${error.message}`),
  });
  const inlineCell = (
    row: Lead,
    field: InlineLeadField,
    displayValue?: string,
    required = false,
  ) => (
    <InlineLeadCell
      value={row[field] as string | null}
      displayValue={displayValue}
      required={required}
      onSave={(value) => inlineLeadUpdate.mutateAsync({ id: row.id, field, value })}
    />
  );
  const ceipalLeadSync = useMutation({
    mutationFn: () => runCeipalSync(),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(
        result.complete
          ? `Lead sync completed. ${result.totalSynced ?? result.synced} CEIPAL leads processed.`
          : `${result.synced} leads synced. Progress saved at CEIPAL page ${result.nextPage}; click again to continue.`,
      );
    },
    onError: (error: Error) =>
      toast.error(`${error.message} Progress was saved; try again to resume.`),
  });
  const ceipalContactSync = useMutation({
    mutationFn: () => runCeipalContactSync(),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(
        result.checked === 0
          ? "All CEIPAL lead contacts have already been checked."
          : `${result.checked} contacts checked: ${result.withPhone} with phone, ${result.withoutPhone} without phone. ${result.remaining} remaining.`,
      );
    },
    onError: (error: Error) => toast.error(`${error.message} Completed batches remain saved.`),
  });

  const columns: Column<Lead>[] = [
    { header: "Name", inlineEditable: true, render: (row) => inlineCell(row, "contact_name") },
    {
      header: "Current company",
      className: "px-3 py-2.5 font-medium text-foreground",
      inlineEditable: true,
      render: (row) => inlineCell(row, "company_name", undefined, true),
    },
    { header: "Industry", inlineEditable: true, render: (row) => inlineCell(row, "industry") },
    {
      header: "Current location",
      inlineEditable: true,
      render: (row) => inlineCell(row, "city"),
    },
    {
      header: "Designation",
      className: "w-80 max-w-80 px-3 py-2.5 text-muted-foreground",
      inlineEditable: true,
      render: (row) => inlineCell(row, "designation"),
    },
    { header: "Phone 1", inlineEditable: true, render: (row) => inlineCell(row, "phone") },
    { header: "Phone 2", inlineEditable: true, render: (row) => inlineCell(row, "phone_2") },
    { header: "Email ID", inlineEditable: true, render: (row) => inlineCell(row, "email") },
    { header: "Landline", inlineEditable: true, render: (row) => inlineCell(row, "landline") },
    {
      header: "Date of birth",
      inlineEditable: true,
      render: (row) => inlineCell(row, "age_or_dob", formatDateOnly(row.age_or_dob)),
    },
    { header: "Lead source", render: (row) => row.source ?? "—" },
    {
      header: "Lead status",
      render: (row) => <StatusPill tone={leadTone(row.status)}>{row.status}</StatusPill>,
    },
    {
      header: "Call status",
      className: "whitespace-nowrap px-3 py-2.5",
      render: (row) => (
        <CallStatusSelect
          value={row.call_status}
          disabled={callStatusUpdate.isPending}
          onChange={(status) => callStatusUpdate.mutate({ id: row.id, status })}
        />
      ),
    },
    { header: "Estimated value", render: (row) => currency(row.estimated_value) },
    { header: "Owner", render: (row) => row.owner_name ?? "—" },
    { header: "Notes", inlineEditable: true, render: (row) => inlineCell(row, "notes") },
  ];

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <ModuleTabs
        value={tab}
        onChange={setTab}
        recordsLabel="Uploaded Leads"
        tabs={[
          { id: "records", label: `Uploaded Leads (${uploadedLeads.data?.length ?? 0})` },
          {
            id: "ceipal",
            label: ceipalLeads.data ? `CEIPAL Sync (${ceipalLeads.data.length})` : "CEIPAL Sync",
          },
          { id: "apollo", label: "Find Contacts via Apollo" },
        ]}
      />
      {tab === "apollo" ? (
        <ApolloProspector target="leads" />
      ) : (
        <>
          {activeLeadsQuery.isError ? (
            <div className="mx-4 mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Leads could not be loaded. Please try again.
              <Button
                className="ml-3"
                size="sm"
                variant="outline"
                onClick={() => activeLeadsQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : null}
                    <ListModule<Lead>
            title={tab === "ceipal" ? "CEIPAL Leads" : "Uploaded Leads"}
            createLabel="Add Lead"
            recordLabel="Lead"
            table="leads"
            fields={leadFields}
            rows={tab === "ceipal" ? (ceipalLeads.data ?? []) : (uploadedLeads.data ?? [])}
            isLoading={activeLeadsQuery.isLoading}
            columns={columns}
            mobileColumns={[
              { header: "HR / Contact", render: (row) => row.contact_name ?? "—" },
              {
                header: "Current company",
                className: "font-medium text-foreground",
                render: (row) => row.company_name,
              },
              { header: "Designation", render: (row) => row.designation ?? "—" },
              { header: "Location", render: (row) => row.city ?? "—" },
            ]}
            minWidth={4200}
            showSerialNumbers
            allowCreate={tab !== "ceipal"}
            filterAllLabel="All leads"
            filterOptions={LEAD_STATUSES}
            filterValue={(row) => row.status}
            filterPlacement="toolbar"
            ownerOf={(row) => row.owner_name}
            headerAction={
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                {tab === "records" ? (
                  <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                    <FileSpreadsheet className="size-4" /> Import Excel
                  </Button>
                ) : null}
                {tab === "ceipal" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={ceipalLeadSync.isPending || ceipalContactSync.isPending}
                      onClick={() => ceipalLeadSync.mutate()}
                    >
                      <RefreshCw
                        className={ceipalLeadSync.isPending ? "size-4 animate-spin" : "size-4"}
                      />
                      {ceipalLeadSync.isPending ? "Syncing 500 leads…" : "Sync CEIPAL leads"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={ceipalLeadSync.isPending || ceipalContactSync.isPending}
                      onClick={() => ceipalContactSync.mutate()}
                    >
                      <RefreshCw
                        className={ceipalContactSync.isPending ? "size-4 animate-spin" : "size-4"}
                      />
                      {ceipalContactSync.isPending
                        ? "Checking 25 contacts…"
                        : "Resume contact details"}
                    </Button>
                  </>
                ) : null}
              </div>
            }
            searchValues={(row) => [
              row.company_name,
              row.contact_name,
              row.email,
              row.phone,
              row.phone_2,
              row.landline,
              row.designation,
              row.age_or_dob,
              row.industry,
              row.city,
              row.source,
              row.notes,
            ]}
            tile={(row) => (
              <>
                <p className="text-sm font-semibold text-foreground">{row.company_name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.contact_name ?? "—"} · {row.phone ?? row.phone_2 ?? row.landline ?? "—"} ·{" "}
                  {row.city ?? "—"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <StatusPill tone={leadTone(row.status)}>{row.status}</StatusPill>
                  {row.industry ? <StatusPill tone="info">{row.industry}</StatusPill> : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {currency(row.estimated_value)} · {row.source ?? "—"}
                </p>
              </>
            )}
            mobileActions={(row) => {
              const numbers = [
                { label: "Phone 1", value: row.phone },
                { label: "Phone 2", value: row.phone_2 },
                { label: "Landline", value: row.landline },
              ].filter((item): item is { label: string; value: string } => Boolean(item.value));
              const whatsappNumber = row.phone ?? row.phone_2;
              const openActivity = (type: ActivityType, title: string) => {
                setActivityLead(row);
                setActivityType(type);
                setActivityTitle(title);
                setActivityDialogOpen(true);
              };

              return (
                <div className="space-y-2">
                  <CallStatusSelect
                    value={row.call_status}
                    disabled={callStatusUpdate.isPending}
                    onChange={(status) => callStatusUpdate.mutate({ id: row.id, status })}
                  />
                  <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain">
                  {numbers.map(({ label, value }) => (
                    <a
                      key={label}
                      href={`tel:${value}`}
                      className="inline-flex min-w-fit items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-primary hover:bg-primary/10"
                      aria-label={`Call ${label}: ${value}`}
                    >
                      <Phone className="size-3.5" /> {label}
                    </a>
                  ))}
                  {whatsappNumber ? (
                    <a
                      href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-fit items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      <MessageCircle className="size-3.5" /> WhatsApp
                    </a>
                  ) : null}
                  {row.email ? (
                    <a
                      href={`mailto:${row.email}`}
                      className="inline-flex min-w-fit items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      <Mail className="size-3.5" /> Email
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex min-w-fit items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-primary hover:bg-primary/10"
                    onClick={() =>
                      openActivity("Call", `Call with ${row.contact_name ?? row.company_name}`)
                    }
                  >
                    <NotebookPen className="size-3.5" /> Log call
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-w-fit items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-primary hover:bg-primary/10"
                    onClick={() => openActivity("Task", `Follow up: ${row.company_name}`)}
                  >
                    <Clock3 className="size-3.5" /> Follow-up
                  </button>
                  </div>
                </div>
              );
            }}
            desktopActions={(row) => (
              <DesktopContactActions phone={row.phone ?? row.phone_2} email={row.email} compact />
            )}
          />
          <LeadImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            leads={uploadedLeads.data ?? []}
          />
          <RecordDialog
            open={activityDialogOpen}
            onOpenChange={setActivityDialogOpen}
            table="activities"
            title={activityTitle}
            fields={activityFields(activityType)}
            record={{
              title: activityTitle,
              activity_type: activityType,
              status: "Pending",
              owner_name: activityLead?.owner_name ?? null,
              related_to_type: "Corporate Lead",
            }}
            fixedValues={
              activityLead
                ? { related_to_type: "Corporate Lead", related_to_id: activityLead.id }
                : undefined
            }
            invalidateKeys={["activities"]}
          />
        </>
      )}
    </div>
  );
}
