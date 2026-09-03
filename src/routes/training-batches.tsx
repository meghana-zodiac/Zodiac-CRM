import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ListModule, type Column } from "@/components/crm/list-module";
import { StatusPill, batchTone, trainingTypeTone } from "@/components/crm/status-pill";
import { trainingBatchFields } from "@/components/crm/field-defs";
import {
  BATCH_STATUSES,
  formatDate,
  trainersQuery,
  trainingBatchesQuery,
  trainingRequestsQuery,
  type TrainingBatchWithRefs,
} from "@/lib/crm";

export const Route = createFileRoute("/training-batches")({
  head: () => ({
    meta: [
      { title: "Training Batches — Zodiac HR Consultants" },
      {
        name: "description",
        content:
          "Scheduled corporate training batches with assigned trainers, delivery mode, participants and completion status.",
      },
      { property: "og:title", content: "Training Batches — Zodiac HR Consultants" },
      {
        property: "og:description",
        content:
          "Scheduled corporate training batches with assigned trainers, delivery mode, participants and completion status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrainingBatchesPage,
});

function TrainingBatchesPage() {
  const batches = useQuery(trainingBatchesQuery());
  const requests = useQuery(trainingRequestsQuery());
  const trainers = useQuery(trainersQuery());

  const columns: Column<TrainingBatchWithRefs>[] = [
    {
      header: "Batch",
      className: "px-3 py-2.5 font-medium text-foreground",
      render: (row) => row.batch_code,
    },
    { header: "Course / topic", render: (row) => row.course_topic ?? row.training_requests?.course_topic ?? "—" },
    {
      header: "Track",
      render: (row) => (
        <StatusPill tone={trainingTypeTone(row.training_type)}>{row.training_type}</StatusPill>
      ),
    },
    { header: "Client", render: (row) => row.training_requests?.accounts?.name ?? "—" },
    { header: "Trainer", render: (row) => row.trainers?.full_name ?? "Unassigned" },
    {
      header: "Schedule",
      render: (row) => `${formatDate(row.start_date)} → ${formatDate(row.end_date)}`,
    },
    { header: "Participants", render: (row) => row.participants ?? 0 },
    { header: "Mode", render: (row) => row.mode ?? "—" },
    {
      header: "Status",
      render: (row) => <StatusPill tone={batchTone(row.status)}>{row.status}</StatusPill>,
    },
  ];

  return (
    <ListModule<TrainingBatchWithRefs>
      title="Training Batches"
      createLabel="Schedule Batch"
      recordLabel="Batch"
      table="training_batches"
      fields={trainingBatchFields(requests.data ?? [], trainers.data ?? [])}
      rows={batches.data ?? []}
      isLoading={batches.isLoading}
      columns={columns}
      minWidth={1300}
      filterAllLabel="All batches"
      filterOptions={BATCH_STATUSES}
      filterValue={(row) => row.status}
      searchValues={(row) => [
        row.batch_code,
        row.course_topic,
        row.trainers?.full_name,
        row.training_requests?.accounts?.name,
        row.mode,
      ]}
      tile={(row) => (
        <>
          <p className="text-sm font-semibold text-foreground">{row.batch_code}</p>
          <p className="text-xs text-muted-foreground">
            {row.course_topic ?? row.training_requests?.course_topic ?? "—"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusPill tone={trainingTypeTone(row.training_type)}>{row.training_type}</StatusPill>
            <StatusPill tone={batchTone(row.status)}>{row.status}</StatusPill>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatDate(row.start_date)} → {formatDate(row.end_date)} · {row.participants ?? 0} pax ·{" "}
            {row.mode ?? "—"}
          </p>
        </>
      )}
    />
  );
}
