// Display filtering only. Database RLS independently authorizes every request.
function canonicalOwner(value: string | null | undefined) {
  const name = (value ?? "").trim().toLowerCase();
  return name === "nuzhat" ? "nuzhat k" : name;
}

export function matchesCrmOwner(filter: string, owner: string | null | undefined) {
  if (filter === "all") return true;
  const expected = canonicalOwner(filter);
  return Boolean(expected) && expected === canonicalOwner(owner);
}
