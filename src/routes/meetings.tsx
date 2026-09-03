import { createFileRoute } from "@tanstack/react-router";
import { ActivityModule } from "@/components/crm/activity-module";

export const Route = createFileRoute("/meetings")({
  head: () => ({
    meta: [
      { title: "Client Meetings — Zodiac HR Consultants" },
      { name: "description", content: "Scheduled corporate client meetings with related proposals, training requests and owners." },
      { property: "og:title", content: "Client Meetings — Zodiac HR Consultants" },
      { property: "og:description", content: "Scheduled corporate client meetings with related proposals, training requests and owners." },
    ],
  }),
  component: () => <ActivityModule type="Meeting" title="Meetings" createLabel="Schedule Meeting" />,
});
