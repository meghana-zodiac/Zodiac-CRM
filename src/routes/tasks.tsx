import { createFileRoute } from "@tanstack/react-router";
import { ActivityModule } from "@/components/crm/activity-module";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Zodiac HR Consultants" },
      { name: "description", content: "Internal BD and L&D tasks with due dates, owners and completion status." },
      { property: "og:title", content: "Tasks — Zodiac HR Consultants" },
      { property: "og:description", content: "Internal BD and L&D tasks with due dates, owners and completion status." },
    ],
  }),
  component: () => <ActivityModule type="Task" title="Tasks" createLabel="Create Task" />,
});
