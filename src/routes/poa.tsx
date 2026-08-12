import { createFileRoute } from "@tanstack/react-router";
import { PoaModule } from "@/components/crm/poa-module";

export const Route = createFileRoute("/poa")({
  head: () => ({
    meta: [
      { title: "Daily POA & KRA Tracker — Zodiac HR Consultants" },
      {
        name: "description",
        content:
          "Log daily BD plans versus actuals for leads, calls, proposals, meetings and onboarding, with CAG bookings and revenue targets.",
      },
      { property: "og:title", content: "Daily POA & KRA Tracker — Zodiac HR Consultants" },
      {
        property: "og:description",
        content:
          "Log daily BD plans versus actuals for leads, calls, proposals, meetings and onboarding, with CAG bookings and revenue targets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PoaModule,
});
