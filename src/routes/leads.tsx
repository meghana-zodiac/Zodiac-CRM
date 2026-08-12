import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ListModule, type Column } from "@/components/crm/list-module";
import { ModuleTabs, type ModuleTab } from "@/components/crm/module-tabs";
import { ApolloProspector } from "@/components/crm/apollo-prospector";
import { StatusPill, leadTone } from "@/components/crm/status-pill";
import { leadFields } from "@/components/crm/field-defs";
import {
  LEAD_STATUSES,
  currency,
  formatDate,
  leadsQuery,
  type Lead,
} from "@/lib/crm";

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
  const leads = useQuery(leadsQuery());
  const [tab, setTab] = useState<ModuleTab>("records");

  const columns: Column<Lead>[] = [
    {
      header: "Company",
      className: "px-3 py-2.5 font-medium text-foreground",
      render: (row) => row.company_name,
    },
    { header: "Contact person", render: (row) => row.contact_name ?? "—" },
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
    <ListModule<Lead>
      title="Corporate Leads"
      createLabel="Add Lead"
      recordLabel="Lead"
      table="leads"
      fields={leadFields}
      rows={leads.data ?? []}
      isLoading={leads.isLoading}
      columns={columns}
      minWidth={1300}
      filterAllLabel="All leads"
      filterOptions={LEAD_STATUSES}
      filterValue={(row) => row.status}
      ownerOf={(row) => row.owner_name}
      searchValues={(row) => [
        row.company_name,
        row.contact_name,
        row.email,
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
            {row.contact_name ?? "—"} · {row.city ?? "—"}
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
      )}
    </div>
  );
}
