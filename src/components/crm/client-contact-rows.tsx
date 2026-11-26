import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ClientContactDraft } from "@/lib/client-group-paste";
export function ClientContactRows({
  rows,
  onChange,
  disabled,
}: {
  rows: ClientContactDraft[];
  onChange: (rows: ClientContactDraft[]) => void;
  disabled: boolean;
}) {
  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">HR / Contact people</h3>
      <p className="text-xs text-muted-foreground">
        Each person is saved under this company. Review who each email belongs to; shared emails
        stay in the company section.
      </p>
      {rows.map((row, i) => (
        <div key={row.id} className="space-y-2 rounded-lg border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["name", "Contact name"],
                ["title", "Designation / department"],
                ["phone", "Mobile"],
                ["landline", "Telephone / board"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-xs">
                {label}
                <Input
                  className="mt-1"
                  disabled={disabled}
                  value={row[key]}
                  onChange={(e) =>
                    onChange(
                      rows.map((r, index) => (index === i ? { ...r, [key]: e.target.value } : r)),
                    )
                  }
                />
              </label>
            ))}
            <label className="text-xs sm:col-span-2">
              Email address(es)
              <Textarea
                className="mt-1"
                disabled={disabled}
                value={row.emails}
                rows={2}
                onChange={(e) =>
                  onChange(
                    rows.map((r, index) => (index === i ? { ...r, emails: e.target.value } : r)),
                  )
                }
              />
            </label>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onChange(rows.filter((_, index) => index !== i))}
          >
            Remove contact
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...rows,
            { id: crypto.randomUUID(), name: "", title: "", phone: "", landline: "", emails: "" },
          ])
        }
      >
        Add HR / contact
      </Button>
    </section>
  );
}
