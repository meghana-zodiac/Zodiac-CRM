import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Linkedin, Loader2, Mail, Phone, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/crm/status-pill";
import { BD_OWNERS } from "@/components/crm/nav-data";
import { createRecord } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { searchApolloContacts, type ApolloProspect } from "@/lib/apollo.functions";

type Target = "contacts" | "leads";

export function ApolloProspector({ target }: { target: Target }) {
  const runSearch = useServerFn(searchApolloContacts);
  const queryClient = useQueryClient();

  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [owner, setOwner] = useState<string>(BD_OWNERS[0]);
  const [prospects, setProspects] = useState<ApolloProspect[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const search = useMutation({
    mutationFn: () => runSearch({ data: { jobTitle, companyName, location, industry } }),
    onSuccess: (result) => {
      setProspects(result.prospects);
      setSearched(true);
      if (result.prospects.length === 0) toast.info("No matching contacts found in Apollo.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const save = async (prospect: ApolloProspect) => {
    setSavingId(prospect.apolloId);
    try {
      if (target === "contacts") {
        await createRecord("contacts", {
          first_name: prospect.firstName || null,
          last_name: prospect.lastName || prospect.name || "Unknown",
          email: prospect.email,
          phone: prospect.phone,
          title: prospect.title,
          department: prospect.company,
          owner_name: owner,
        });
        await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      } else {
        await createRecord("leads", {
          company_name: prospect.company ?? prospect.name,
          contact_name: prospect.name,
          email: prospect.email,
          phone: prospect.phone,
          industry: prospect.industry ?? (industry || null),
          city: prospect.city,
          source: "Apollo.io",
          status: "New",
          owner_name: owner,
          notes: prospect.linkedinUrl ? `LinkedIn: ${prospect.linkedinUrl}` : null,
        });
        await queryClient.invalidateQueries({ queryKey: ["leads"] });
      }
      setSaved((prev) => [...prev, prospect.apolloId]);
      toast.success(`${prospect.name} saved to ${target === "contacts" ? "Client Contacts" : "Corporate Leads"} for ${owner}`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="rounded-xl border border-border bg-surface p-4 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Find Contacts via Apollo</h2>
            <p className="text-xs text-muted-foreground">
              Prospect verified decision-makers and store them in the CRM in one click.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Assign to</span>
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
              {BD_OWNERS.map((rep) => (
                <button
                  key={rep}
                  type="button"
                  onClick={() => setOwner(rep)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    owner === rep
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {rep}
                </button>
              ))}
            </div>
          </div>
        </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Job title" value={jobTitle} onChange={setJobTitle} placeholder="HR" />
        <Field label="Company name" value={companyName} onChange={setCompanyName} placeholder="Vivo" />
        <Field label="Location" value={location} onChange={setLocation} placeholder="Bengaluru, India" />
        <Field label="Industry" value={industry} onChange={setIndustry} placeholder="Information Technology" />
      </div>
      <div className="mt-4">

        <div className="mt-4">
          <Button size="sm" onClick={() => search.mutate()} disabled={search.isPending}>
            {search.isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Apollo Search
          </Button>
        </div>
      </div>

      {search.isPending ? (
        <p className="text-sm text-muted-foreground">Searching Apollo…</p>
      ) : prospects.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {prospects.map((prospect) => {
            const isSaved = saved.includes(prospect.apolloId);
            return (
              <div
                key={prospect.apolloId}
                className="rounded-xl border border-border bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{prospect.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {prospect.title ?? "—"} · {prospect.company ?? "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[prospect.city, prospect.country].filter(Boolean).join(", ") || "—"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isSaved ? "outline" : "default"}
                    disabled={isSaved || savingId === prospect.apolloId}
                    onClick={() => save(prospect)}
                  >
                    {savingId === prospect.apolloId ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : isSaved ? (
                      <Check className="size-4" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    {isSaved ? "Saved" : "Save to CRM"}
                  </Button>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{prospect.email ?? "No email available"}</span>
                    {prospect.emailStatus === "verified" ? (
                      <StatusPill tone="success">Verified</StatusPill>
                    ) : null}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Phone className="size-3.5 shrink-0" />
                    <span className="truncate">{prospect.phone ?? "No phone available"}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Linkedin className="size-3.5 shrink-0" />
                    {prospect.linkedinUrl ? (
                      <a
                        href={prospect.linkedinUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="truncate text-primary underline-offset-2 hover:underline"
                      >
                        {prospect.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    ) : (
                      <span>No LinkedIn profile</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : searched ? (
        <p className="text-sm text-muted-foreground">No prospects matched that search.</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Enter at least one search field above, then run an Apollo search.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}
