import { useMemo, useState } from "react";
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
import { activityFields } from "@/components/crm/field-defs";
import {
  LEAD_STATUSES,
  currency,
  formatDate,
  leadsQuery,
  type ActivityType,
  type Lead,
} from "@/lib/crm";
import { syncCeipalLeadContacts, syncCeipalLeads } from "@/lib/ceipal.functions";

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

function LeadsPage() {
  const queryClient = useQueryClient();
  const runCeipalSync = useServerFn(syncCeipalLeads);
  const runCeipalContactSync = useServerFn(syncCeipalLeadContacts);
  const leads = useQuery(leadsQuery());
  const [tab, setTab] = useState<ModuleTab>("records");
  const [importOpen, setImportOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>("Task");
  const [activityTitle, setActivityTitle] = useState("Follow up");
  const [activityLead, setActivityLead] = useState<Lead | null>(null);
  const { uploadedLeads, ceipalLeads } = useMemo(() => {
    const uploaded: Lead[] = [];
    const ceipal: Lead[] = [];
    for (const lead of leads.data ?? []) {
      if (lead.ceipal_id || lead.source?.toLowerCase() === "ceipal") ceipal.push(lead);
      else uploaded.push(lead);
    }
    return { uploadedLeads: uploaded, ceipalLeads: ceipal };
  }, [leads.data]);
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
    { header: "Candidate name", render: (row) => row.contact_name ?? "—" },
    { header: "Resume title", render: (row) => row.resume_title ?? "—" },
    { header: "Phone 1", render: (row) => row.phone ?? "—" },
    { header: "Phone 2", render: (row) => row.phone_2 ?? "—" },
    { header: "Landline", render: (row) => row.landline ?? "—" },
    { header: "Email", render: (row) => row.email ?? "—" },
    { header: "Work exp", render: (row) => row.work_experience ?? "—" },
    { header: "Annual salary", render: (row) => row.annual_salary ?? "—" },
    { header: "Current location", render: (row) => row.city ?? "—" },
    { header: "Preferred location", render: (row) => row.preferred_location ?? "—" },
    {
      header: "Current employer",
      className: "px-3 py-2.5 font-medium text-foreground",
      render: (row) => row.company_name,
    },
    { header: "Designation", render: (row) => row.designation ?? "—" },
    { header: "U.G. course", render: (row) => row.ug_course ?? "—" },
    { header: "P.G. course", render: (row) => row.pg_course ?? "—" },
    { header: "Post P.G. course", render: (row) => row.post_pg_course ?? "—" },
    { header: "Age / DOB", render: (row) => row.age_or_dob ?? "—" },
    { header: "Postal address", render: (row) => row.postal_address ?? "—" },
    { header: "Last active", render: (row) => row.last_active ?? "—" },
    { header: "Industry", render: (row) => row.industry ?? "—" },
    { header: "Service interest", render: (row) => row.service_interest ?? "—" },
    { header: "Source", render: (row) => row.source ?? "—" },
    {
      header: "Status",
      render: (row) => <StatusPill tone={leadTone(row.status)}>{row.status}</StatusPill>,
    },
    { header: "Est. value", render: (row) => currency(row.estimated_value) },
    { header: "Owner", render: (row) => row.owner_name ?? "—" },
    { header: "Notes", render: (row) => row.notes ?? "—" },
    { header: "Created", render: (row) => formatDate(row.created_at) },
  ];

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <ModuleTabs
        value={tab}
        onChange={setTab}
        recordsLabel="Uploaded Leads"
        tabs={[
          { id: "records", label: `Uploaded Leads (${uploadedLeads.length})` },
          { id: "ceipal", label: `CEIPAL Sync (${ceipalLeads.length})` },
          { id: "apollo", label: "Find Contacts via Apollo" },
        ]}
      />
      {tab === "apollo" ? (
        <ApolloProspector target="leads" />
      ) : (
        <>
          <ListModule<Lead>
            title={tab === "ceipal" ? "CEIPAL Leads" : "Uploaded Leads"}
            createLabel="Add Lead"
            recordLabel="Lead"
            table="leads"
            fields={leadFields}
            rows={tab === "ceipal" ? ceipalLeads : uploadedLeads}
            isLoading={leads.isLoading}
            columns={columns}
            mobileColumns={[
              { header: "HR / Contact", render: (row) => row.contact_name ?? "—" },
              {
                header: "Company",
                className: "font-medium text-foreground",
                render: (row) => row.company_name,
              },
              { header: "Designation", render: (row) => row.designation ?? "—" },
              { header: "Location", render: (row) => row.city ?? "—" },
            ]}
            minWidth={3900}
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
              row.resume_title,
              row.work_experience,
              row.annual_salary,
              row.preferred_location,
              row.designation,
              row.ug_course,
              row.pg_course,
              row.post_pg_course,
              row.age_or_dob,
              row.postal_address,
              row.last_active,
              row.industry,
              row.city,
              row.service_interest,
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
                  <StatusPill tone="info">{row.service_interest ?? "—"}</StatusPill>
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
              );
            }}
          />
          <LeadImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            leads={leads.data ?? []}
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
