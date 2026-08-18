import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";

import { ListModule, type Column } from "@/components/crm/list-module";
import { StatusPill, trainingTypeTone } from "@/components/crm/status-pill";
import { trainerFields } from "@/components/crm/field-defs";
import { TrainerImportDialog } from "@/components/crm/trainer-import-dialog";
import { Button } from "@/components/ui/button";
import { TRAINING_TYPES, currency, trainersQuery, type Trainer } from "@/lib/crm";

export const Route = createFileRoute("/trainers")({
  head: () => ({
    meta: [
      { title: "Trainer Profiles — Zodiac HR Consultants" },
      {
        name: "description",
        content:
          "Panel of technical and soft-skills trainers with expertise areas, ratings and day rates.",
      },
      { property: "og:title", content: "Trainer Profiles — Zodiac HR Consultants" },
      {
        property: "og:description",
        content:
          "Panel of technical and soft-skills trainers with expertise areas, ratings and day rates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrainersPage,
});

function TrainersPage() {
  const trainers = useQuery(trainersQuery());
  const [importOpen, setImportOpen] = useState(false);

  const columns: Column<Trainer>[] = [
    {
      header: "Trainer",
      className: "px-3 py-2.5 font-medium text-foreground",
      render: (row) => row.full_name,
    },
    {
      header: "Track",
      render: (row) => (
        <StatusPill tone={trainingTypeTone(row.training_type)}>{row.training_type}</StatusPill>
      ),
    },
    { header: "Expertise", render: (row) => row.expertise ?? "—" },
    { header: "Rating", render: (row) => (row.rating != null ? `${row.rating} / 5` : "—") },
    { header: "Day rate", render: (row) => currency(row.day_rate) },
    { header: "Email", render: (row) => row.email ?? "—" },
    { header: "Phone", render: (row) => row.phone ?? "—" },
  ];

  return (
    <>
      <ListModule<Trainer>
        title="Trainer Profiles"
        createLabel="Add Trainer"
        recordLabel="Trainer"
        table="trainers"
        fields={trainerFields}
        rows={trainers.data ?? []}
        isLoading={trainers.isLoading}
        columns={columns}
        minWidth={1000}
        filterAllLabel="All trainers"
        filterOptions={TRAINING_TYPES}
        filterValue={(row) => row.training_type}
        headerAction={
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="size-4" /> Import Excel
          </Button>
        }
        searchValues={(row) => [row.full_name, row.expertise, row.email, row.bio]}
        tile={(row) => (
          <>
            <p className="text-sm font-semibold text-foreground">{row.full_name}</p>
            <p className="text-xs text-muted-foreground">{row.expertise ?? "—"}</p>
            <div className="mt-3 flex items-center justify-between">
              <StatusPill tone={trainingTypeTone(row.training_type)}>
                {row.training_type}
              </StatusPill>
              <span className="text-xs text-muted-foreground">
                {row.rating != null ? `${row.rating} / 5` : "—"} · {currency(row.day_rate)}
              </span>
            </div>
          </>
        )}
      />
      <TrainerImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        trainers={trainers.data ?? []}
      />
    </>
  );
}
