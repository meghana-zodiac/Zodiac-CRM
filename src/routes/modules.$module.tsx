import { createFileRoute, Link } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { ReportsAnalyticsModule } from "@/components/crm/reports-analytics-module";

export const Route = createFileRoute("/modules/$module")({
  head: () => ({
    meta: [
      { title: "Module — Zodiac HR Consultants" },
      {
        name: "description",
        content:
          "Reports and analytics module inside the Zodiac HR Consultants BD & L&D workspace.",
      },
      { property: "og:title", content: "Module — Zodiac HR Consultants" },
      {
        property: "og:description",
        content:
          "Reports and analytics module inside the Zodiac HR Consultants BD & L&D workspace.",
      },
    ],
  }),
  component: ModulePlaceholder,
});

function ModulePlaceholder() {
  const { module } = Route.useParams();
  if (module === "reports" || module === "analytics") {
    return <ReportsAnalyticsModule view={module} />;
  }
  const label = module
    .split("-")
    .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-lg rounded-lg border border-dashed border-border bg-surface p-10 text-center shadow-panel">
        <Construction className="mx-auto size-6 text-muted-foreground" />
        <h1 className="mt-3 text-base font-semibold text-foreground">{label}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This module is reserved in the navigation. Leads, Contacts, Accounts, Deals and Activities
          are fully live today.
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
