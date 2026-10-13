import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Clock3,
  KeyRound,
  Laptop,
  ShieldCheck,
  Smartphone,
  UserX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  generateDeviceEnrollmentCode,
  listCrmDevices,
  revokeCrmDevice,
  setDeviceEnforcement,
} from "@/lib/device-access.functions";

type AccessStatus = "pending" | "approved" | "rejected" | "suspended";
type Member = {
  id: string;
  email: string;
  display_name: string;
  access_status: AccessStatus;
  access_role: "primary_admin" | "bd_member";
  active: boolean;
  device_access_required: boolean;
  created_at: string;
};

const statusStyle: Record<AccessStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  suspended: "border-slate-200 bg-slate-100 text-slate-700",
};

export function AccessManagement({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const generateCode = useServerFn(generateDeviceEnrollmentCode);
  const listDevices = useServerFn(listCrmDevices);
  const revokeDevice = useServerFn(revokeCrmDevice);
  const setEnforcement = useServerFn(setDeviceEnforcement);
  const [activeCode, setActiveCode] = useState<{
    name: string;
    code: string;
    expiresAt: string;
  } | null>(null);
  const members = useQuery({
    queryKey: ["bd-team-access"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_team_members")
        .select(
          "id,email,display_name,access_status,access_role,active,device_access_required,created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Member[];
    },
  });
  const devices = useQuery({
    queryKey: ["crm-devices"],
    enabled: open,
    queryFn: () => listDevices(),
  });

  const deviceAction = useMutation({
    mutationFn: async (
      action:
        | { kind: "code"; member: Member }
        | { kind: "enforce"; member: Member }
        | { kind: "revoke"; deviceId: string },
    ) => {
      if (action.kind === "code") {
        const result = await generateCode({ data: { memberId: action.member.id } });
        setActiveCode({ name: action.member.display_name, ...result });
      } else if (action.kind === "enforce") {
        await setEnforcement({
          data: { memberId: action.member.id, required: !action.member.device_access_required },
        });
      } else {
        await revokeDevice({ data: { deviceId: action.deviceId } });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bd-team-access"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-devices"] });
      toast.success("Device access updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateAccess = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AccessStatus }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("bd_team_members")
        .update({
          access_status: status,
          active: status === "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: auth.user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bd-team-access"] });
      toast.success("Access updated");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Access could not be updated"),
  });

  const pending = members.data?.filter((member) => member.access_status === "pending") ?? [];
  const decided = members.data?.filter((member) => member.access_status !== "pending") ?? [];

  const MemberRow = ({ member }: { member: Member }) => {
    const protectedAdmin = member.access_role === "primary_admin";
    const memberDevices = (devices.data ?? []).filter(
      (device) => device.user_id === member.id && !device.revoked_at,
    );
    return (
      <article className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{member.display_name}</p>
            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
          </div>
          <Badge variant="outline" className={statusStyle[member.access_status]}>
            {member.access_status}
          </Badge>
        </div>
        {protectedAdmin ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary">
            <ShieldCheck className="size-3.5" />
            Primary administrator
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {member.access_status !== "approved" && (
              <Button
                size="sm"
                onClick={() => updateAccess.mutate({ id: member.id, status: "approved" })}
                disabled={updateAccess.isPending}
              >
                <Check className="mr-1 size-3.5" />
                Approve
              </Button>
            )}
            {member.access_status === "pending" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateAccess.mutate({ id: member.id, status: "rejected" })}
                disabled={updateAccess.isPending}
              >
                <UserX className="mr-1 size-3.5" />
                Reject
              </Button>
            )}
            {member.access_status === "approved" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateAccess.mutate({ id: member.id, status: "suspended" })}
                disabled={updateAccess.isPending}
              >
                Suspend
              </Button>
            )}
          </div>
        )}
        {member.access_status === "approved" ? (
          <div className="mt-4 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold">Approved work devices</p>
                <p className="text-xs text-muted-foreground">
                  {member.device_access_required
                    ? "Required for every login"
                    : "Restriction not enabled"}{" "}
                  · {memberDevices.length}/2 active
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deviceAction.mutate({ kind: "code", member })}
                >
                  <KeyRound className="mr-1 size-3.5" /> New code
                </Button>
                <Button
                  size="sm"
                  variant={member.device_access_required ? "destructive" : "default"}
                  onClick={() => deviceAction.mutate({ kind: "enforce", member })}
                >
                  {member.device_access_required ? "Disable restriction" : "Require devices"}
                </Button>
              </div>
            </div>
            {memberDevices.length ? (
              <div className="mt-3 space-y-2">
                {memberDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 p-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {device.device_type === "mobile" ? (
                        <Smartphone className="size-4 shrink-0" />
                      ) : (
                        <Laptop className="size-4 shrink-0" />
                      )}
                      <span className="truncate">{device.device_label}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deviceAction.mutate({ kind: "revoke", deviceId: device.id })}
                    >
                      <XCircle className="mr-1 size-3.5" /> Revoke
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Access Management
          </SheetTitle>
          <SheetDescription>
            Approve only Business Development team members who should use the CRM.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {activeCode ? (
            <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="text-sm font-semibold">One-time code for {activeCode.name}</p>
              <p className="my-2 text-3xl font-bold tracking-[0.3em] text-primary">
                {activeCode.code}
              </p>
              <p className="text-xs text-muted-foreground">
                Enter this directly on the company device. It expires in 10 minutes and works once.
              </p>
            </section>
          ) : null}
          {members.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading access requests…</p>
          ) : null}
          {members.isError ? (
            <p className="text-sm text-destructive">Access requests could not be loaded.</p>
          ) : null}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Clock3 className="size-4" />
              Pending requests ({pending.length})
            </h3>
            <div className="space-y-3">
              {pending.length ? (
                pending.map((member) => <MemberRow key={member.id} member={member} />)
              ) : (
                <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                  No pending access requests.
                </p>
              )}
            </div>
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold">All users</h3>
            <div className="space-y-3">
              {decided.map((member) => (
                <MemberRow key={member.id} member={member} />
              ))}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
