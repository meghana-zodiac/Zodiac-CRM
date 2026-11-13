import { supabase } from "@/integrations/supabase/client";

export type CallLogAttempt = {
  id: string;
  phone: string;
  startedAt: number;
  device: "Mobile" | "Desktop";
  relatedId?: string;
  relatedType?: string;
  save: () => Promise<void>;
};

// Associate the capture-phase log with the contact button's React click event.
const attempts = new WeakMap<Event, CallLogAttempt>();

export function callLogForEvent(event: Event) {
  return attempts.get(event);
}

export function createCallLogAttempt(phone: string, userAgent: string): CallLogAttempt {
  let saving: Promise<void> | undefined;
  const attempt: CallLogAttempt = {
    id: crypto.randomUUID(),
    phone,
    startedAt: Date.now(),
    device: /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ? "Mobile" : "Desktop",
    save: () => {
      // Share an in-flight/successful write; retry failed writes with the same ID.
      saving ??= persist().catch((error: unknown) => {
        saving = undefined;
        throw error;
      });
      return saving;
    },
  };

  async function persist() {
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!data.user) throw new Error("Sign in to save the call log.");
    const { data: member } = await supabase
      .from("bd_team_members")
      .select("display_name")
      .eq("id", data.user.id)
      .maybeSingle();
    const metadata = data.user.user_metadata;
    const repName =
      member?.display_name ||
      (typeof metadata?.["full_name"] === "string" && metadata["full_name"]) ||
      (typeof metadata?.["name"] === "string" && metadata["name"]) ||
      data.user.email ||
      null;
    const { error } = await supabase.from("call_logs").upsert(
      {
        id: attempt.id,
        phone_number: phone,
        rep_name: repName,
        call_type: `Call Initiated · ${attempt.device}`,
        duration_seconds: null,
        created_at: new Date(attempt.startedAt).toISOString(),
      },
      // A retry after a lost response must not create another call or overwrite details.
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) throw error;
  }

  return attempt;
}

export function installCallLogging(callbacks: {
  onSaved: (attempt: CallLogAttempt) => void;
  onError: (attempt: CallLogAttempt, error: unknown) => void;
  onReturn?: (attempt: CallLogAttempt, returnedAt: number) => void;
}) {
  let previous: CallLogAttempt | undefined;
  let pending: { attempt: CallLogAttempt; leftApp: boolean } | undefined;
  const markAway = () => {
    if (pending) pending.leftApp = true;
  };
  const reviewOnReturn = () => {
    if (document.visibilityState === "hidden" || !pending?.leftApp) return;
    const { attempt } = pending;
    pending = undefined;
    callbacks.onReturn?.(attempt, Date.now());
  };
  const visibilityChanged = () => {
    if (document.visibilityState === "hidden") markAway();
    else reviewOnReturn();
  };
  const track = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    const href = anchor?.getAttribute("href") ?? "";
    if (!/^tel:/i.test(href)) return;
    let phone: string;
    try {
      phone = decodeURIComponent(href.slice(4).split("?")[0] ?? "").trim();
    } catch {
      return;
    }
    if (!phone) return;
    const attempt =
      previous?.phone === phone && Date.now() - previous.startedAt < 2_000
        ? previous
        : createCallLogAttempt(phone, navigator.userAgent);
    attempts.set(event, attempt);
    if (attempt === previous) return;
    previous = attempt;
    const record = anchor?.closest("[data-call-record-id]");
    const relatedId = record?.getAttribute("data-call-record-id");
    const relatedType = record?.getAttribute("data-call-record-type");
    if (relatedId && relatedType) {
      attempt.relatedId = relatedId;
      attempt.relatedType = relatedType;
    }
    pending = { attempt, leftApp: false };
    // Keep native tel: navigation synchronous so the mobile dialler can open.
    void attempt.save().then(
      () => callbacks.onSaved(attempt),
      (error: unknown) => callbacks.onError(attempt, error),
    );
  };
  // Capture runs before React buttons/containers stop click propagation.
  document.addEventListener("click", track, true);
  document.addEventListener("visibilitychange", visibilityChanged);
  window.addEventListener("blur", markAway);
  window.addEventListener("focus", reviewOnReturn);
  return () => {
    document.removeEventListener("click", track, true);
    document.removeEventListener("visibilitychange", visibilityChanged);
    window.removeEventListener("blur", markAway);
    window.removeEventListener("focus", reviewOnReturn);
  };
}
