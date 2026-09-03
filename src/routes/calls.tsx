import { createFileRoute } from "@tanstack/react-router";
import { ActivityModule } from "@/components/crm/activity-module";
import { CallLogsPanel } from "@/components/crm/call-logs-panel";

export const Route = createFileRoute("/calls")({
  head: () => ({
    meta: [
      { title: "Call Logs — Zodiac HR Consultants" },
      {
        name: "description",
        content:
          "Logged and upcoming client calls with notes and outcomes across BD and training accounts.",
      },
      { property: "og:title", content: "Call Logs — Zodiac HR Consultants" },
      {
        property: "og:description",
        content:
          "Logged and upcoming client calls with notes and outcomes across BD and training accounts.",
      },
    ],
  }),
  component: CallsPage,
});

function CallsPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <CallLogsPanel />
      <ActivityModule type="Call" title="Calls" createLabel="Log Call" />
    </div>
  );
}
