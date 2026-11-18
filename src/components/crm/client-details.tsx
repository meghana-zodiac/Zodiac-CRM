import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DesktopContactActions } from "./desktop-contact-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { bdTeamMembersQuery, currentUserEmailQuery } from "@/lib/poa";
import { type Account, type Contact, formatDateOnly } from "@/lib/crm";
import {
  commercialTerms,
  contractHistoryQuery,
  saveClientContract,
  type ClientContract,
  type ContractInput,
} from "@/lib/client-contracts";

export function ClientActivityStatus({ status }: { status?: string | undefined }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}
    >
      {status ?? "Status not set"}
    </span>
  );
}

function Detail({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{children || "—"}</dd>
    </div>
  );
}

const editLabels = {
  activity_status: "Client activity status",
  recruiter: "Assigned recruiter",
  approach_date: "Approach date(s)",
  visit_date: "Visit date",
  mandate_received_date: "Mandate received date",
  terms: "Commercial terms",
  notes: "Remarks",
} as const;

function ContractEditor({
  account,
  contract,
  owner,
  onClose,
}: {
  account: Account;
  contract?: ClientContract | undefined;
  owner: string;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<ContractInput>({
    activity_status: contract?.activity_status ?? "Active",
    recruiter: contract?.recruiter ?? "",
    approach_date: contract?.approach_date ?? "",
    visit_date: contract?.visit_date ?? "",
    mandate_received_date: contract?.mandate_received_date ?? "",
    terms: contract?.terms ?? "",
    notes: contract?.notes ?? "",
  });
  const save = useMutation({
    mutationFn: () =>
      saveClientContract(
        contract,
        account.id,
        owner,
        Object.fromEntries(
          Object.entries(draft).map(([key, value]) => [key, value?.trim() || null]),
        ) as ContractInput,
      ),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["client-contracts"] }),
        client.invalidateQueries({ queryKey: ["client-contract-history"] }),
      ]);
      toast.success("Contract details saved");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Contract Details</DialogTitle>
          <DialogDescription>
            {account.name} · BD owner: {owner}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="contract-status">Client activity status</Label>
              <select
                id="contract-status"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.activity_status}
                onChange={(e) => setDraft({ ...draft, activity_status: e.target.value })}
              >
                <option>Active</option>
                <option>Non-active</option>
              </select>
            </div>
            {(["recruiter", "approach_date", "visit_date", "mandate_received_date"] as const).map(
              (key) => (
                <div key={key}>
                  <Label htmlFor={`contract-${key}`}>{editLabels[key]}</Label>
                  <Input
                    id={`contract-${key}`}
                    className="mt-1"
                    type={key === "visit_date" || key === "mandate_received_date" ? "date" : "text"}
                    value={draft[key] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
                </div>
              ),
            )}
            {(["terms", "notes"] as const).map((key) => (
              <div key={key} className="sm:col-span-2">
                <Label htmlFor={`contract-${key}`}>{editLabels[key]}</Label>
                <Textarea
                  id={`contract-${key}`}
                  className="mt-1"
                  rows={3}
                  value={draft[key] ?? ""}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </div>
            ))}
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClientDetails({
  account,
  contract,
  contacts,
  onEditAccount,
}: {
  account: Account;
  contract?: ClientContract | undefined;
  contacts: Contact[];
  onEditAccount: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const history = useQuery(contractHistoryQuery(contract?.id));
  const members = useQuery(bdTeamMembersQuery());
  const email = useQuery(currentUserEmailQuery());
  const member = members.data?.find(
    (m) => m.email.toLowerCase() === email.data && m.active && m.access_status === "approved",
  );
  const owner = contract?.owner_name ?? account.owner_name ?? "";
  const canEdit =
    member &&
    (member.access_role === "primary_admin" ||
      member.display_name.trim().toLowerCase() === owner.trim().toLowerCase());
  const terms = commercialTerms(contract?.terms ?? null);
  const linkedContacts = contacts.filter((contact) => contact.account_id === account.id);
  return (
    <section
      className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-panel sm:p-5"
      aria-label="Client details"
    >
      <h2 className="pr-6 text-lg font-semibold">{account.name}</h2>
      <div className="mt-2">
        <ClientActivityStatus status={contract?.activity_status} />
      </div>
      <Tabs defaultValue="contract" className="mt-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contract">Contract Status</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <Detail label="BD owner">{owner}</Detail>
            <Detail label="Industry">{contract?.source_sector ?? account.industry}</Detail>
            <Detail label="Location" full>
              {contract?.source_place ?? account.city}
            </Detail>
            <Detail label="Website" full>
              {account.website}
            </Detail>
            {contract?.source_organisation && (
              <Detail label="Organisation / group in tracker" full>
                {contract.source_organisation}
              </Detail>
            )}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <DesktopContactActions phone={account.phone ?? account.phone_2} />
          </div>
          <Button className="mt-5" variant="outline" onClick={onEditAccount}>
            Edit client
          </Button>
        </TabsContent>
        <TabsContent value="contract">
          {contract ? (
            <>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <Detail label="BD owner">{contract.owner_name}</Detail>
                <Detail label="Assigned recruiter">{contract.recruiter}</Detail>
                <Detail label="Client activity status">{contract.activity_status}</Detail>
                <Detail label="Mandate received">
                  {formatDateOnly(contract.mandate_received_date)}
                </Detail>
                <Detail label="Approach date(s)">{contract.approach_date}</Detail>
                <Detail label="Visit date">{formatDateOnly(contract.visit_date)}</Detail>
                <Detail label="Fee / pricing" full>
                  {terms.fee}
                </Detail>
                <Detail label="Payment period">
                  {terms.payment ? `${terms.payment} days` : "See commercial terms"}
                </Detail>
                <Detail label="Replacement period">
                  {terms.replacement ? `${terms.replacement} days` : "See commercial terms"}
                </Detail>
                <Detail label="Commercial terms" full>
                  {contract.terms}
                </Detail>
                <Detail label="Remarks" full>
                  {contract.notes}
                </Detail>
              </dl>
            </>
          ) : (
            <p className="my-5 text-sm text-muted-foreground">
              No contract details have been recorded for this client.
            </p>
          )}
          {canEdit ? (
            <Button className="mt-5" onClick={() => setEditing(true)}>
              {contract ? "Edit Contract Details" : "Add Contract Details"}
            </Button>
          ) : (
            <p className="mt-5 text-xs text-muted-foreground">
              Contract details can be edited by the BD owner or an administrator.
            </p>
          )}
          {contract ? (
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Change history</h3>
              {history.isLoading ? (
                <p className="mt-2 text-sm">Loading history…</p>
              ) : history.isError ? (
                <Button className="mt-2" variant="outline" onClick={() => void history.refetch()}>
                  Retry history
                </Button>
              ) : (
                <ol className="mt-3 space-y-4">
                  {(history.data ?? []).map((entry) => {
                    const before = entry.previous_values as Record<string, unknown> | null;
                    const after = entry.new_values as Record<string, unknown>;
                    const changes = (
                      Object.keys(editLabels) as Array<keyof typeof editLabels>
                    ).filter((key) => before && before[key] !== after[key]);
                    return (
                      <li key={entry.id} className="text-xs">
                        <p className="font-medium">
                          {entry.actor_name} · Revision {entry.revision}
                        </p>
                        <p className="text-muted-foreground">
                          {new Date(entry.changed_at).toLocaleString("en-IN")}
                        </p>
                        {before ? (
                          <ul className="mt-1 space-y-1">
                            {changes.map((key) => (
                              <li key={key} className="whitespace-pre-wrap break-words">
                                {editLabels[key]}: {String(before[key] || "Not set")} →{" "}
                                {String(after[key] || "Not set")}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-muted-foreground">Initial contract record</p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="contacts">
          <div className="mt-5 space-y-5">
            {linkedContacts.map((c) => (
              <div key={c.id} className="border-b border-border pb-3 text-sm">
                <p className="font-medium">
                  {[c.first_name, c.last_name].filter(Boolean).join(" ")}
                </p>
                <p className="text-muted-foreground">{c.title}</p>
                <p className="break-all">{c.email}</p>
                <p>{c.phone}</p>
              </div>
            ))}
            {contract?.contact_names ? (
              <dl className="grid gap-5">
                <Detail label="Contact people from tracker">{contract.contact_names}</Detail>
                <Detail label="Designation(s)">{contract.contact_designations}</Detail>
                <Detail label="Mobile numbers">{contract.mobile_numbers}</Detail>
                <Detail label="Telephone numbers">{contract.landline_numbers}</Detail>
                <Detail label="Email addresses">{contract.email_addresses}</Detail>
              </dl>
            ) : !linkedContacts.length ? (
              <p className="text-sm text-muted-foreground">No contact details recorded.</p>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
      {editing ? (
        <ContractEditor
          account={account}
          contract={contract}
          owner={owner}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </section>
  );
}
