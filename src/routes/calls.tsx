import { createFileRoute } from "@tanstack/react-router";
import { CallLogsPanel } from "@/components/crm/call-logs-panel";

export const Route = createFileRoute("/calls")({
  head: () => ({
    meta: [
      { title: "Call Logs — Zodiac HR Consultants" },
      {
        name: "description",
        content:
          "Automatic CRM call logs with user filters, optional updates, notes and follow-ups.",
      },
      { property: "og:title", content: "Call Logs — Zodiac HR Consultants" },
      {
        property: "og:description",
        content:
          "Automatic CRM call logs with user filters, optional updates, notes and follow-ups.",
      },
    ],
  }),
  component: CallsPage,
});

function CallsPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <CallLogsPanel />
    </div>
  );
}
