import { useQuery } from "@tanstack/react-query";
import { bdTeamMembersQuery, currentUserEmailQuery } from "@/lib/poa";

export function useCrmIdentity() {
  const members = useQuery(bdTeamMembersQuery());
  const email = useQuery(currentUserEmailQuery());
  const member = members.data?.find(
    (candidate) =>
      candidate.email.toLowerCase() === email.data &&
      candidate.active &&
      candidate.access_status === "approved",
  );
  return {
    member,
    isAdmin: member?.access_role === "primary_admin",
    isLoading: members.isLoading || email.isLoading,
  };
}
