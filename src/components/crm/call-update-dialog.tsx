import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { detailText, saveCallUpdates, type ReviewCall } from "@/lib/call-updates";

const outcomes = [
  "Not recorded",
  "Connected",
  "Unanswered",
  "Busy",
  "Switched Off",
  "Wrong Number",
  "Call Back Later",
  "Cancelled",
];
const nextActions = [
  "Call Again",
  "Send Proposal",
  "Send Email",
  "Schedule Meeting",
  "Close / No Action",
];

function localDateTime(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function CallUpdateDialog({ call, onClose }: { call: ReviewCall; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState(
    () => detailText(call.activity, "outcome") || "Not recorded",
  );
  const [notes, setNotes] = useState(call.activity?.notes ?? "");
  const [nextAction, setNextAction] = useState(
    () => detailText(call.activity, "next_action") || "Call Again",
  );
  const [priority, setPriority] = useState(() => detailText(call.activity, "priority") || "Medium");
  const [followUpAt, setFollowUpAt] = useState(() =>
    localDateTime(detailText(call.activity, "follow_up_at")),
  );
  const [followUpId] = useState(() => crypto.randomUUID());
  const save = useMutation({
    mutationFn: () =>
      saveCallUpdates(call, { outcome, notes, nextAction, priority, followUpAt, followUpId }),
    onSuccess: () => {
      for (const key of ["call-logs", "call-log-updates", "activities"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success("Call updates saved");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add call updates</DialogTitle>
          <DialogDescription>
            {call.phone} is already in the automatic call log. Add optional notes, an outcome or a
            follow-up. Returning to the CRM does not confirm a connection or actual talk time.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <fieldset disabled={save.isPending} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="call-update-outcome">Call outcome</Label>
              <select
                id="call-update-outcome"
                className={inputClass}
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
              >
                {outcomes.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="call-update-notes">Discussion notes</Label>
              <Textarea
                id="call-update-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What was discussed?"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="call-update-action">Next action</Label>
                <select
                  id="call-update-action"
                  className={inputClass}
                  value={nextAction}
                  onChange={(event) => setNextAction(event.target.value)}
                >
                  {nextActions.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="call-update-priority">Priority</Label>
                <select
                  id="call-update-priority"
                  className={inputClass}
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                >
                  {["Low", "Medium", "High"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="call-update-followup">Follow-up date and time (optional)</Label>
              <Input
                id="call-update-followup"
                type="datetime-local"
                value={followUpAt}
                onChange={(event) => setFollowUpAt(event.target.value)}
              />
            </div>
          </fieldset>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
              Skip updates
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save updates"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
