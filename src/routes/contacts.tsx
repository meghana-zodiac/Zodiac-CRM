import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  FileSpreadsheet,
  Mail,
  MapPin,
  MessageCircle,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  Clock3,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  EmptyState,
  FilterPanel,
  ModuleHeader,
  type ViewMode,
} from "@/components/crm/module-chrome";
import { RecordDialog } from "@/components/crm/record-dialog";
import { RowActions } from "@/components/crm/row-actions";
import { ModuleTabs, type ModuleTab } from "@/components/crm/module-tabs";
import { ApolloProspector } from "@/components/crm/apollo-prospector";
import {
  accountsQuery,
  activitiesQuery,
  bdStageLabel,
  contactsQuery,
  createRecord,
  currency,
  dealsQuery,
  formatDate,
  formatDateTime,
  fullName,
  type ActivityType,
} from "@/lib/crm";
import { activityFields, contactFields } from "@/components/crm/field-defs";
import { teamMembers } from "@/components/crm/nav-data";
import type { ContactWithAccount } from "@/lib/crm";
import { ContactImportDialog } from "@/components/crm/contact-import-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill, activityTone, bdTone } from "@/components/crm/status-pill";

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Client Contacts — Zodiac HR Consultants" },
      {
        name: "description",
        content:
          "Browse, filter, and manage every sales contact with account, owner, and activity detail.",
      },
      { property: "og:title", content: "Client Contacts — Zodiac HR Consultants" },
      {
        property: "og:description",
        content:
          "Browse, filter, and manage every sales contact with account, owner, and activity detail.",
      },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const contacts = useQuery(contactsQuery());
  const accounts = useQuery(accountsQuery());
  const activities = useQuery(activitiesQuery());
  const deals = useQuery(dealsQuery());
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [systemFilter, setSystemFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<ContactWithAccount | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState<ModuleTab>("records");
  const [importOpen, setImportOpen] = useState(false);
  const [openContact, setOpenContact] = useState<ContactWithAccount | null>(null);
  const [profileTab, setProfileTab] = useState<"details" | "activity" | "related">("details");
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>("Task");
  const [activityTitle, setActivityTitle] = useState("Follow up");
  const [note, setNote] = useState("");

  const all = useMemo(() => contacts.data ?? [], [contacts.data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((contact) => {
      if (systemFilter === "touched" && !contact.last_activity_date) return false;
      if (systemFilter === "untouched" && contact.last_activity_date) return false;
      if (systemFilter === "mine" && contact.owner_name !== "Alex Morgan") return false;
      if (ownerFilter !== "all" && contact.owner_name !== ownerFilter) return false;
      if (!term) return true;
      return [
        fullName(contact.first_name, contact.last_name),
        contact.email,
        contact.phone,
        contact.accounts?.name,
        contact.title,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [all, search, systemFilter, ownerFilter]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (contact: ContactWithAccount) => {
    setOpenContact(null);
    setEditing(contact);
    setDialogOpen(true);
  };

  const openProfile = (contact: ContactWithAccount) => {
    setProfileTab("details");
    setOpenContact(contact);
  };

  const contactActivities = useMemo(
    () =>
      openContact
        ? (activities.data ?? []).filter(
            (activity) =>
              activity.related_to_type === "Client Contact" &&
              activity.related_to_id === openContact.id,
          )
        : [],
    [activities.data, openContact],
  );

  const contactDeals = useMemo(
    () =>
      openContact ? (deals.data ?? []).filter((deal) => deal.contact_id === openContact.id) : [],
    [deals.data, openContact],
  );

  const logNote = useMutation({
    mutationFn: async () => {
      if (!openContact || !note.trim()) return;
      await createRecord("activities", {
        title: note.trim().slice(0, 80),
        activity_type: "Task",
        status: "Completed",
        notes: note.trim(),
        related_to_type: "Client Contact",
        related_to_id: openContact.id,
        owner_name: openContact.owner_name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      setNote("");
      toast.success("Contact note added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const scheduleActivity = (type: ActivityType, title: string) => {
    setActivityType(type);
    setActivityTitle(title);
    setActivityDialogOpen(true);
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <ModuleTabs value={tab} onChange={setTab} recordsLabel="Client Contacts" />
      {tab === "apollo" ? (
        <ApolloProspector target="contacts" />
      ) : (
        <>
          <ModuleHeader
            title="Client Contacts"
            count={rows.length}
            search={search}
            onSearchChange={setSearch}
            view={view}
            onViewChange={setView}
            availableViews={["list", "tile"]}
            onToggleFilters={() => setShowFilters((prev) => !prev)}
            action={
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                  <FileSpreadsheet className="size-4" /> Import Excel
                </Button>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="size-4" /> Create Contact
                </Button>
              </div>
            }
          />

          <div className="flex min-h-0 flex-1">
            <FilterPanel
              className={showFilters ? "block w-full lg:w-56" : "hidden lg:block"}
              activeFilter={systemFilter}
              onFilterChange={setSystemFilter}
              systemFilters={[
                { id: "all", label: "All contacts", count: all.length },
                {
                  id: "mine",
                  label: "My contacts",
                  count: all.filter((c) => c.owner_name === "Alex Morgan").length,
                },
                {
                  id: "touched",
                  label: "Touched records",
                  count: all.filter((c) => c.last_activity_date).length,
                },
                {
                  id: "untouched",
                  label: "Untouched records",
                  count: all.filter((c) => !c.last_activity_date).length,
                },
              ]}
              fieldFilters={{
                label: "owner",
                active: ownerFilter,
                onChange: setOwnerFilter,
                options: [
                  { id: "all", label: "Any owner" },
                  ...teamMembers.map((member) => ({
                    id: member,
                    label: member,
                    count: all.filter((c) => c.owner_name === member).length,
                  })),
                ],
              }}
            />

            <div
              className={
                showFilters ? "hidden flex-1 p-4 lg:block sm:p-5" : "min-w-0 flex-1 p-4 sm:p-5"
              }
            >
              {contacts.isLoading ? (
                <EmptyState message="Loading contacts…" />
              ) : rows.length === 0 ? (
                <EmptyState message="No contacts match this view." />
              ) : view === "tile" ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {rows.map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-lg border border-border bg-surface p-4 shadow-panel"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {fullName(contact.first_name, contact.last_name)}
                          </p>
                          <p className="text-xs text-muted-foreground">{contact.title ?? "—"}</p>
                        </div>
                        <RowActions
                          table="contacts"
                          id={contact.id}
                          label="Contact"
                          onEdit={() => {
                            setEditing(contact);
                            setDialogOpen(true);
                          }}
                        />
                      </div>
                      <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <div>{contact.accounts?.name ?? "No account"}</div>
                        <div>{contact.email ?? "—"}</div>
                        <div>{contact.phone ?? "—"}</div>
                        <div>Last activity {formatDate(contact.last_activity_date)}</div>
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="space-y-2.5 md:hidden">
                    {rows.map((contact) => (
                      <article
                        key={contact.id}
                        className="overflow-hidden rounded-2xl border border-border bg-surface shadow-panel"
                      >
                        <div className="flex items-start gap-3 p-3.5">
                          <button
                            type="button"
                            onClick={() => openProfile(contact)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-fuchsia-600 text-sm font-bold text-primary-foreground shadow-sm">
                              {(
                                contact.first_name?.[0] ??
                                contact.last_name?.[0] ??
                                "?"
                              ).toUpperCase()}
                              {contact.first_name && contact.last_name
                                ? contact.last_name[0]?.toUpperCase()
                                : ""}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[15px] font-semibold text-foreground">
                                {fullName(contact.first_name, contact.last_name)}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {contact.title ?? "No designation"}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {contact.accounts?.name ?? "No company linked"}
                              </span>
                            </span>
                          </button>
                          <div onClick={(event) => event.stopPropagation()}>
                            <RowActions
                              table="contacts"
                              id={contact.id}
                              label="Contact"
                              onEdit={() => openEdit(contact)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 border-t border-border bg-muted/20">
                          <ContactAction
                            href={contact.phone ? `tel:${contact.phone}` : null}
                            label="Call"
                            icon={Phone}
                          />
                          <ContactAction
                            href={
                              contact.phone
                                ? `https://wa.me/${contact.phone.replace(/\D/g, "")}`
                                : null
                            }
                            label="WhatsApp"
                            icon={MessageCircle}
                            external
                          />
                          <ContactAction
                            href={contact.phone ? `sms:${contact.phone}` : null}
                            label="SMS"
                            icon={MessageCircle}
                          />
                          <ContactAction
                            href={contact.email ? `mailto:${contact.email}` : null}
                            label="Email"
                            icon={Mail}
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="crm-table-scroll hidden overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-surface shadow-panel md:block">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <th className="w-10 px-3 py-2.5">
                            <Checkbox
                              checked={selected.length > 0 && selected.length === rows.length}
                              onCheckedChange={(checked) =>
                                setSelected(checked ? rows.map((row) => row.id) : [])
                              }
                              aria-label="Select all"
                            />
                          </th>
                          <th className="px-3 py-2.5">Contact name</th>
                          <th className="px-3 py-2.5">Account name</th>
                          <th className="px-3 py-2.5">Email</th>
                          <th className="px-3 py-2.5">Phone</th>
                          <th className="px-3 py-2.5">Owner</th>
                          <th className="px-3 py-2.5">Last activity</th>
                          <th className="w-12 px-3 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rows.map((contact) => (
                          <tr key={contact.id} className="transition-colors hover:bg-muted/40">
                            <td className="px-3 py-2.5">
                              <Checkbox
                                checked={selected.includes(contact.id)}
                                onCheckedChange={(checked) =>
                                  setSelected((prev) =>
                                    checked
                                      ? [...prev, contact.id]
                                      : prev.filter((id) => id !== contact.id),
                                  )
                                }
                                aria-label={`Select ${contact.last_name}`}
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="font-medium text-foreground">
                                {fullName(contact.first_name, contact.last_name)}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {contact.title ?? "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {contact.accounts?.name ?? "—"}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {contact.email ?? "—"}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {contact.phone ?? "—"}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {contact.owner_name ?? "—"}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {formatDate(contact.last_activity_date)}
                            </td>
                            <td className="px-3 py-2.5">
                              <RowActions
                                table="contacts"
                                id={contact.id}
                                label="Contact"
                                onEdit={() => {
                                  setEditing(contact);
                                  setDialogOpen(true);
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        table="contacts"
        title={editing ? "Edit Contact" : "Create Contact"}
        fields={contactFields(accounts.data ?? [])}
        record={editing}
      />
      <ContactImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        contacts={all}
        accounts={accounts.data ?? []}
      />
      <Sheet open={Boolean(openContact)} onOpenChange={(open) => !open && setOpenContact(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-0 p-0 sm:max-w-md md:hidden"
        >
          {openContact ? (
            <>
              <div className="bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-900 px-5 pb-6 pt-12 text-white">
                <SheetHeader className="items-center text-center">
                  <span className="flex size-20 items-center justify-center rounded-full border border-white/20 bg-white/15 text-2xl font-bold shadow-xl backdrop-blur">
                    {(
                      openContact.first_name?.[0] ??
                      openContact.last_name?.[0] ??
                      "?"
                    ).toUpperCase()}
                    {openContact.first_name && openContact.last_name
                      ? openContact.last_name[0]?.toUpperCase()
                      : ""}
                  </span>
                  <SheetTitle className="mt-3 text-xl text-white">
                    {fullName(openContact.first_name, openContact.last_name)}
                  </SheetTitle>
                  <SheetDescription className="text-white/70">
                    {[openContact.title, openContact.accounts?.name].filter(Boolean).join(" · ") ||
                      "Client contact"}
                  </SheetDescription>
                </SheetHeader>
              </div>

              <div className="grid grid-cols-5 border-b border-border bg-background px-2 py-2">
                <ContactAction
                  href={openContact.phone ? `tel:${openContact.phone}` : null}
                  label="Call"
                  icon={Phone}
                />
                <ContactAction
                  href={openContact.phone ? `sms:${openContact.phone}` : null}
                  label="SMS"
                  icon={MessageCircle}
                />
                <ContactAction
                  href={openContact.email ? `mailto:${openContact.email}` : null}
                  label="Email"
                  icon={Mail}
                />
                <ContactAction
                  href={
                    openContact.phone
                      ? `https://wa.me/${openContact.phone.replace(/\D/g, "")}`
                      : null
                  }
                  label="WhatsApp"
                  icon={MessageCircle}
                  external
                />
                <ContactAction
                  href={
                    openContact.accounts?.name
                      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(openContact.accounts.name)}`
                      : null
                  }
                  label="Map"
                  icon={MapPin}
                  external
                />
              </div>

              <div className="sticky top-0 z-10 grid grid-cols-3 border-b border-border bg-background px-3">
                {(["details", "activity", "related"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setProfileTab(item)}
                    className={`border-b-2 px-2 py-3 text-xs font-semibold capitalize ${
                      profileTab === item
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="space-y-4 p-4">
                {profileTab === "details" ? (
                  <>
                    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-panel">
                      <ContactDetail icon={Phone} label="Phone" value={openContact.phone} />
                      <ContactDetail icon={Mail} label="Email" value={openContact.email} />
                      <ContactDetail
                        icon={Building2}
                        label="Company"
                        value={openContact.accounts?.name}
                      />
                      <ContactDetail
                        icon={UserRound}
                        label="Department"
                        value={openContact.department}
                      />
                      <ContactDetail
                        icon={UserRound}
                        label="Owner"
                        value={openContact.owner_name}
                      />
                      <ContactDetail
                        icon={CalendarDays}
                        label="Last activity"
                        value={formatDate(openContact.last_activity_date)}
                        last
                      />
                    </section>

                    <Button className="w-full" onClick={() => openEdit(openContact)}>
                      <Pencil className="size-4" /> Edit contact
                    </Button>
                  </>
                ) : null}

                {profileTab === "activity" ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-auto flex-col gap-1.5 py-3 text-xs"
                        onClick={() => scheduleActivity("Call", "Call follow-up")}
                      >
                        <Phone className="size-4 text-primary" /> Log call
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-auto flex-col gap-1.5 py-3 text-xs"
                        onClick={() => scheduleActivity("Meeting", "Client meeting")}
                      >
                        <CalendarDays className="size-4 text-primary" /> Meeting
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-auto flex-col gap-1.5 py-3 text-xs"
                        onClick={() => scheduleActivity("Task", "Follow up")}
                      >
                        <Clock3 className="size-4 text-primary" /> Follow-up
                      </Button>
                    </div>

                    <section className="rounded-2xl border border-border bg-surface p-3 shadow-panel">
                      <Textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={3}
                        placeholder="Add a contact note…"
                      />
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        disabled={!note.trim() || logNote.isPending}
                        onClick={() => logNote.mutate()}
                      >
                        <NotebookPen className="size-4" /> Add note
                      </Button>
                    </section>

                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Activity timeline
                      </h3>
                      {contactActivities.length ? (
                        contactActivities.map((activity) => (
                          <article
                            key={activity.id}
                            className="rounded-xl border border-border bg-surface p-3 shadow-panel"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {activity.title}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {activity.activity_type} · {formatDateTime(activity.due_date)}
                                </p>
                              </div>
                              <StatusPill tone={activityTone(activity.status)}>
                                {activity.status}
                              </StatusPill>
                            </div>
                            {activity.notes ? (
                              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                {activity.notes}
                              </p>
                            ) : null}
                          </article>
                        ))
                      ) : (
                        <MobileEmpty message="No activity has been logged for this contact." />
                      )}
                    </section>
                  </>
                ) : null}

                {profileTab === "related" ? (
                  <>
                    <section className="rounded-2xl border border-border bg-surface p-4 shadow-panel">
                      <div className="flex items-center gap-3">
                        <Building2 className="size-5 text-primary" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Corporate client</p>
                          <p className="truncate text-sm font-semibold text-foreground">
                            {openContact.accounts?.name ?? "No company linked"}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Proposals & SLAs ({contactDeals.length})
                      </h3>
                      {contactDeals.length ? (
                        contactDeals.map((deal) => (
                          <article
                            key={deal.id}
                            className="rounded-xl border border-border bg-surface p-3 shadow-panel"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {deal.deal_name}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {currency(deal.amount)} · Close {formatDate(deal.closing_date)}
                                </p>
                              </div>
                              <StatusPill tone={bdTone(deal.stage)}>
                                {bdStageLabel(deal.stage)}
                              </StatusPill>
                            </div>
                          </article>
                        ))
                      ) : (
                        <MobileEmpty message="No proposals are linked to this contact." />
                      )}
                    </section>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <RecordDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        table="activities"
        title={activityTitle}
        fields={activityFields(activityType)}
        record={{
          title: activityTitle,
          activity_type: activityType,
          status: "Pending",
          owner_name: openContact?.owner_name ?? null,
          related_to_type: "Client Contact",
        }}
        fixedValues={
          openContact
            ? { related_to_type: "Client Contact", related_to_id: openContact.id }
            : undefined
        }
        invalidateKeys={["activities"]}
      />
    </div>
  );
}

function ContactAction({
  href,
  label,
  icon: Icon,
  external = false,
}: {
  href: string | null;
  label: string;
  icon: typeof Phone;
  external?: boolean;
}) {
  const className = `flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium ${
    href ? "text-primary" : "pointer-events-none text-muted-foreground/40"
  }`;
  return href ? (
    <a
      href={href}
      className={className}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      aria-label={label}
    >
      <Icon className="size-[18px]" />
      <span className="max-w-full truncate">{label}</span>
    </a>
  ) : (
    <span className={className} aria-disabled="true">
      <Icon className="size-[18px]" />
      <span className="max-w-full truncate">{label}</span>
    </span>
  );
}

function ContactDetail({
  icon: Icon,
  label,
  value,
  last = false,
}: {
  icon: typeof Phone;
  label: string;
  value?: string | null;
  last?: boolean;
}) {
  return (
    <div className={`flex gap-3 px-4 py-3.5 ${last ? "" : "border-b border-border"}`}>
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 break-words text-sm text-foreground">{value || "Not available"}</p>
      </div>
    </div>
  );
}

function MobileEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
