import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDateTime } from "@/lib/crm";
import { Phone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CallLog = Tables<"call_logs">;

function duration(seconds: number | null) {
  if (!seconds && seconds !== 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function CallLogsPanel() {
  const [rows, setRows] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("call_logs").select("*");
    if (error) setError(error.message);
    else {
      setError(null);
      setRows((data ?? []) as CallLog[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Phone className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Device Call Logs</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {rows.length}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {error ? (
        <p className="px-4 py-6 text-sm text-destructive">{error}</p>
      ) : loading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading call logs…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No call logs captured yet. Incoming webhook records will appear here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Rep</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Duration</th>
                <th className="px-4 py-2 font-medium">Logged</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log) => (
                <tr key={log.id} className="border-t border-border">
                  <td className="px-4 py-2">{log.rep_name ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{log.phone_number ?? "—"}</td>
                  <td className="px-4 py-2">{log.call_type ?? "—"}</td>
                  <td className="px-4 py-2">{duration(log.duration_seconds)}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatDateTime(log.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
