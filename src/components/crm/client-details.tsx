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
import {
  CONTRACT_FIELD_LABELS,
  mergeContractPaste,
  parseContractPaste,
  type ContractPasteConflict,
  type ContractPasteResult,
} from "@/lib/contract-smart-paste";

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

const editLabels = CONTRACT_FIELD_LABELS;

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
    activity_status: contract?.activity_status ?? "",
    recruiter: contract?.recruiter ?? "",
    approach_date: contract?.approach_date ?? "",
    visit_date: contract?.visit_date ?? "",
    mandate_received_date: contract?.mandate_received_date ?? "",
    terms: contract?.terms ?? "",
    notes: contract?.notes ?? "",
  });
  const [pasteText, setPasteText] = useState("");
  const [pasteResult, setPasteResult] = useState<ContractPasteResult | null>(null);
  const [pasteConflicts, setPasteConflicts] = useState<ContractPasteConflict[]>([]);
  const [filledFields, setFilledFields] = useState<string[]>([]);
  const preview = commercialTerms(draft.terms);
  const sortPaste = () => {
    const result = parseContractPaste(pasteText);
    const merged = mergeContractPaste(draft, result.values);
    setDraft(merged.draft);
    setPasteResult(result);
    setPasteConflicts(merged.conflicts);
    setFilledFields(merged.filled);
  };
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
          <DialogTitle>{contract ? "Edit Contract Details" : "Add Contract Details"}</DialogTitle>
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
          <section className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Label htmlFor="contract-smart-paste" className="text-sm font-semibold">
              Paste contract details
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Paste labelled details: client activity status, assigned recruiter, approach date(s),
              visit date, mandate received date, fee / pricing, payment period, replacement period
              and remarks. Use DD.MM.YYYY for dates. Review the fields before saving.
            </p>
            <Textarea
              id="contract-smart-paste"
              className="mt-2"
              rows={5}
              placeholder={
                "Client activity status: Non-active\nAssigned recruiter: Prerna\nMandate received date: 08.05.2026\nFee / pricing: 8.33%\nPayment period: 30 days\nReplacement period: 90 days\nRemarks: Agreement signed digitally"
              }
              value={pasteText}
              disabled={save.isPending}
              onChange={(event) => setPasteText(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2"
              disabled={save.isPending || !pasteText.trim()}
              onClick={sortPaste}
            >
              Sort into fields
            </Button>
            {pasteResult ? (
              <div className="mt-3 space-y-3 border-t border-primary/15 pt-3 text-xs">
                <p>
                  {filledFields.length} {filledFields.length === 1 ? "field" : "fields"} filled
                  {filledFields.length
                    ? `: ${filledFields.join(", ")}`
                    : ". No empty fields were filled."}{" "}
                  Changes are saved only when you choose Save changes.
                </p>
                {pasteResult.warnings.length ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-amber-950">
                    <p className="font-semibold">Please review</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {pasteResult.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {pasteResult.unclassified.length ? (
                  <div className="rounded-md border border-border bg-background p-2.5">
                    <p className="font-semibold">Details needing manual entry</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {pasteResult.unclassified.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {pasteConflicts.map((conflict) => (
                  <div
                    key={conflict.field}
                    className="rounded-md border border-border bg-background p-2.5"
                  >
                    <p className="font-semibold">{editLabels[conflict.field]}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words">
                      Current: {draft[conflict.field] || "Not set"}
                    </p>
                    <p className="whitespace-pre-wrap break-words">Pasted: {conflict.incoming}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={save.isPending}
                      onClick={() => {
                        setDraft((current) => ({
                          ...current,
                          [conflict.field]: conflict.incoming,
                        }));
                        setPasteConflicts((current) =>
                          current.filter((item) => item.field !== conflict.field),
                        );
                        setFilledFields((current) => [
                          ...new Set([...current, editLabels[conflict.field]]),
                        ]);
                      }}
                    >
                      Use pasted value
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
          <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="contract-status">Client activity status</Label>
              <select
                id="contract-status"
                required
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.activity_status}
                onChange={(e) => setDraft({ ...draft, activity_status: e.target.value })}
              >
                <option value="" disabled>
                  Select status
                </option>
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
                {key === "terms" ? (
                  <dl
                    className="mt-3 grid gap-3 rounded-md bg-muted/50 p-3 sm:grid-cols-3"
                    aria-label="Commercial terms preview"
                  >
                    <Detail label="Fee / pricing">{preview.fee}</Detail>
                    <Detail label="Payment period">
                      {preview.payment ? `${preview.payment} days` : "Not recorded"}
                    </Detail>
                    <Detail label="Replacement period">
                      {preview.replacement ? `${preview.replacement} days` : "Not recorded"}
                    </Detail>
                  </dl>
                ) : null}
                {key === "terms" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    The preview comes from Commercial terms above. Edit that field to change these
                    values.
                  </p>
                ) : null}
              </div>
            ))}
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !draft.activity_status}>
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
