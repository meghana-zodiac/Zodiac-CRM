import {
  Home,
  BarChart3,
  PieChart,
  Building2,
  Contact as ContactIcon,
  FileSignature,
  Sparkles,
  GraduationCap,
  CalendarRange,
  UserCog,
  CalendarDays,
  PhoneCall,
  CheckSquare,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; to: string; icon: LucideIcon; module?: string };
export type NavGroup = { label: string; items: NavItem[] };

const mod = (label: string, icon: LucideIcon, slug: string): NavItem => ({
  label,
  to: `/modules/${slug}`,
  icon,
  module: slug,
});

export const navGroups: NavGroup[] = [
  {
    label: "General",
    items: [
      { label: "Home", to: "/", icon: Home },
      mod("Reports", BarChart3, "reports"),
      mod("Analytics", PieChart, "analytics"),
    ],
  },
  {
    label: "Business Development",
    items: [
      { label: "Corporate Leads", to: "/leads", icon: Sparkles },
      { label: "Corporate Clients", to: "/accounts", icon: Building2 },
      { label: "Client Contacts", to: "/contacts", icon: ContactIcon },
      { label: "BD Proposals & SLAs", to: "/deals", icon: FileSignature },
      { label: "Daily POA & KRA", to: "/poa", icon: ClipboardList },
    ],
  },
  {
    label: "Training & L&D",
    items: [
      { label: "Training Requests", to: "/training-requests", icon: GraduationCap },
      { label: "Training Batches", to: "/training-batches", icon: CalendarRange },
      { label: "Trainer Profiles", to: "/trainers", icon: UserCog },
    ],
  },
  {
    label: "Activities & Logs",
    items: [
      { label: "Client Meetings", to: "/meetings", icon: CalendarDays },
      { label: "Call Logs", to: "/calls", icon: PhoneCall },
      { label: "Tasks", to: "/tasks", icon: CheckSquare },
    ],
  },
];

/** The 2-person BD team. */
export const BD_OWNERS = ["Nuzhat", "Edward"] as const;
export type BdOwner = (typeof BD_OWNERS)[number];

export const teamMembers: string[] = [...BD_OWNERS];
