import { createFileRoute } from "@tanstack/react-router";

import { EodReviewModule } from "@/components/crm/eod-review-module";

export const Route = createFileRoute("/eod-review")({
  head: () => ({
    meta: [
      { title: "Team EOD Review — Zodiac CRM" },
      {
        name: "description",
        content:
          "Administrator review workspace for Zodiac HR business development EOD submissions.",
      },
    ],
  }),
  component: EodReviewModule,
});
