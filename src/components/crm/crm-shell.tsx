import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  Menu,
  Plus,
  Search,
  Layers,
  LogOut,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { navGroups } from "./nav-data";
import { RecordDialog } from "./record-dialog";
import { ScheduleDrawer } from "./schedule-drawer";
import { NotificationsDrawer, useNotifications } from "./notifications-drawer";
import { contactFields, dealFields, leadFields } from "./field-defs";
import { supabase } from "@/integrations/supabase/client";

import { accountsQuery, contactsQuery, currency, dealsQuery, fullName } from "@/lib/crm";

type QuickCreate = "lead" | "contact" | "deal" | null;

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin">
      {navGroups.map((group) => (
        <div key={group.label}>
          {!collapsed ? (
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-nav-muted">
              {group.label}
            </p>
          ) : (
            <div className="mx-2 mb-2 h-px bg-nav-border" />
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.to;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    title={item.label}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-nav-foreground/85 transition-colors hover:bg-nav-accent hover:text-nav-foreground",
                      active && "bg-nav-accent font-medium text-nav-foreground",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex h-14 items-center gap-2.5 border-b border-nav-border px-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-primary-foreground shadow-raised">
        <Layers className="size-4" />
      </span>
      <div
        aria-hidden={collapsed}
        className={cn(
          "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out",
          collapsed ? "max-w-0 opacity-0" : "max-w-48 opacity-100",
        )}
      >
        <p className="truncate text-sm font-semibold text-nav-foreground">Zodiac HR Consultants</p>
        <p className="truncate text-[11px] text-nav-muted">BD &amp; L&amp;D CRM</p>
      </div>
    </div>
  );
}

function RouteProgress() {
  const isLoading = useRouterState({ select: (state) => state.isLoading });

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden transition-opacity duration-150",
        isLoading ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="h-full w-2/5 animate-route-progress bg-brand-accent shadow-[0_0_10px_var(--color-brand-accent)]" />
    </div>
  );
}

function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const contacts = useQuery({ ...contactsQuery(), enabled: open });
  const accounts = useQuery({ ...accountsQuery(), enabled: open });
  const deals = useQuery({ ...dealsQuery(), enabled: open });

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput aria-label="Search records" />
      <CommandList>
        <CommandEmpty>No records found.</CommandEmpty>
        <CommandGroup heading="Contacts">
          {(contacts.data ?? []).slice(0, 6).map((contact) => (
            <CommandItem
              key={contact.id}
              value={`${fullName(contact.first_name, contact.last_name)} ${contact.email ?? ""}`}
              asChild
            >
              <Link to="/contacts" onClick={() => onOpenChange(false)}>
                {fullName(contact.first_name, contact.last_name)}
                <span className="ml-auto text-xs text-muted-foreground">{contact.email}</span>
              </Link>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Accounts">
          {(accounts.data ?? []).slice(0, 6).map((account) => (
            <CommandItem key={account.id} value={account.name} asChild>
              <Link to="/accounts" onClick={() => onOpenChange(false)}>
                {account.name}
                <span className="ml-auto text-xs text-muted-foreground">{account.industry}</span>
              </Link>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Deals">
          {(deals.data ?? []).slice(0, 6).map((deal) => (
            <CommandItem key={deal.id} value={deal.deal_name} asChild>
              <Link to="/deals" onClick={() => onOpenChange(false)}>
                {deal.deal_name}
                <span className="ml-auto text-xs text-muted-foreground">
                  {currency(deal.amount)}
                </span>
              </Link>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quickCreate, setQuickCreate] = useState<QuickCreate>(null);
  const accounts = useQuery({
    ...accountsQuery(),
    enabled: quickCreate === "contact" || quickCreate === "deal",
  });
  const contacts = useQuery({ ...contactsQuery(), enabled: quickCreate === "deal" });
  const notifications = useNotifications(notificationsOpen);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("zodiac-crm-sidebar") === "collapsed");
  }, []);

  const toggleSidebar = () => {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem("zodiac-crm-sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-dvh w-full bg-background">
      <RouteProgress />

      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden bg-nav will-change-[width] transition-[width] duration-200 ease-out md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <SidebarBrand collapsed={collapsed} />
        <NavList collapsed={collapsed} />
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="flex items-center gap-2 border-t border-nav-border px-4 py-3 text-xs text-nav-muted transition-colors hover:text-nav-foreground"
        >
          <ChevronsLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && "Collapse"}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-1.5 border-b border-border bg-surface px-2 sm:gap-2 sm:px-5">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-nav-border bg-nav p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBrand collapsed={false} />
              <NavList collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>

          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-sm text-muted-foreground transition-all hover:border-brand-accent/60 hover:shadow-card sm:max-w-md sm:px-3"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">Search records</span>
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">Create</span>
                  <ChevronDown className="hidden size-3.5 opacity-70 sm:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Quick create</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setQuickCreate("lead")}>
                  Corporate Lead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQuickCreate("contact")}>
                  Contact
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQuickCreate("deal")}>
                  BD Proposal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              aria-label="Calendar"
              onClick={() => setScheduleOpen(true)}
            >
              <CalendarDays className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Notifications"
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell className="size-4" />
              {notifications.unreadCount > 0 && (
                <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
                  {notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}
                </span>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label="Account menu"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                    AM
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Signed-in account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="gap-2">
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main key={pathname} className="crm-route-enter min-w-0 flex-1">
          {children}
        </main>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <ScheduleDrawer open={scheduleOpen} onOpenChange={setScheduleOpen} />

      <NotificationsDrawer
        open={notificationsOpen}
        onOpenChange={(open) => {
          setNotificationsOpen(open);
          if (!open) notifications.markAllRead();
        }}
        items={notifications.items}
        unreadIds={notifications.unreadIds}
        markAllRead={notifications.markAllRead}
        clearAll={notifications.clearAll}
      />

      <RecordDialog
        open={quickCreate === "lead"}
        onOpenChange={(open) => !open && setQuickCreate(null)}
        table="leads"
        title="New Corporate Lead"
        fields={leadFields}
      />
      <RecordDialog
        open={quickCreate === "contact"}
        onOpenChange={(open) => !open && setQuickCreate(null)}
        table="contacts"
        title="Create Contact"
        fields={contactFields(accounts.data ?? [])}
      />
      <RecordDialog
        open={quickCreate === "deal"}
        onOpenChange={(open) => !open && setQuickCreate(null)}
        table="deals"
        title="New BD Proposal"
        fields={dealFields(accounts.data ?? [], contacts.data ?? [])}
      />
    </div>
  );
}
