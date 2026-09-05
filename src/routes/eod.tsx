import { createFileRoute } from "@tanstack/react-router";

import { EodModule } from "@/components/crm/eod-module";

export const Route = createFileRoute("/eod")({
  head: () => ({
    meta: [
      { title: "My Daily EOD — Zodiac CRM" },
      {
        name: "description",
        content:
          "Review automatically calculated CRM activity and submit daily business development outcomes, blockers and priorities.",
      },
    ],
  }),
  component: EodModule,
});
