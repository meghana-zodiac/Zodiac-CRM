import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { ListModule, type Column } from "@/components/crm/list-module";
import { ModuleTabs, type ModuleTab } from "@/components/crm/module-tabs";
import { ApolloProspector } from "@/components/crm/apollo-prospector";
import { StatusPill, leadTone } from "@/components/crm/status-pill";
import { leadFields } from "@/components/crm/field-defs";
import { LeadImportDialog } from "@/components/crm/lead-import-dialog";
import { Button } from "@/components/ui/button";
import { LEAD_STATUSES, currency, formatDate, leadsQuery, type Lead } from "@/lib/crm";
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
    {
      header: "Company",
      className: "px-3 py-2.5 font-medium text-foreground",
      render: (row) => row.company_name,
    },
    { header: "Contact person", render: (row) => row.contact_name ?? "—" },
    { header: "Phone", render: (row) => row.phone ?? "—" },
    { header: "Service interest", render: (row) => row.service_interest ?? "—" },
    { header: "Industry", render: (row) => row.industry ?? "—" },
    { header: "City", render: (row) => row.city ?? "—" },
    { header: "Source", render: (row) => row.source ?? "—" },
    {
      header: "Status",
      render: (row) => <StatusPill tone={leadTone(row.status)}>{row.status}</StatusPill>,
    },
    { header: "Est. value", render: (row) => currency(row.estimated_value) },
    { header: "Owner", render: (row) => row.owner_name ?? "—" },
    { header: "Created", render: (row) => formatDate(row.created_at) },
  ];

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <ModuleTabs value={tab} onChange={setTab} recordsLabel="Corporate Leads" />
      {tab === "apollo" ? (
        <ApolloProspector target="leads" />
      ) : (
        <>
          <ListModule<Lead>
            title="Corporate Leads"
            createLabel="Add Lead"
            recordLabel="Lead"
            table="leads"
            fields={leadFields}
            rows={leads.data ?? []}
            isLoading={leads.isLoading}
            columns={columns}
            minWidth={1420}
            filterAllLabel="All leads"
            filterOptions={LEAD_STATUSES}
            filterValue={(row) => row.status}
            filterPlacement="toolbar"
            ownerOf={(row) => row.owner_name}
            headerAction={
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                  <FileSpreadsheet className="size-4" /> Import Excel
                </Button>
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
                  {ceipalContactSync.isPending ? "Checking 25 contacts…" : "Resume contact details"}
                </Button>
              </div>
            }
            searchValues={(row) => [
              row.company_name,
              row.contact_name,
              row.email,
              row.phone,
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
                  {row.contact_name ?? "—"} · {row.phone ?? "—"} · {row.city ?? "—"}
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
          />
          <LeadImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            leads={leads.data ?? []}
          />
        </>
      )}
    </div>
  );
}
