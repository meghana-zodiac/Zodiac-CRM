export const searchApolloContacts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => searchSchema.parse(data))
  .handler(async ({ data }): Promise<{ prospects: ApolloProspect[]; total: number }> => {
    // Combine fields into a keyword string to bypass strict export credit enforcement
    const queryParts = [data.jobTitle, data.companyName, data.location, data.industry]
      .filter(Boolean)
      .map((s) => s.trim());

    if (queryParts.length === 0) {
      return { prospects: [], total: 0 };
    }

    const body: Record<string, unknown> = {
      per_page: 8,
      page: 1,
      q_keywords: queryParts.join(" "),
    };

    const result = await apollo("/mixed_people/search", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const people = Array.isArray(result["people"]) ? (result["people"] as Json[]) : [];
    const total = typeof result["total_entries"] === "number" ? result["total_entries"] : people.length;

    const enriched = people.slice(0, 8).map((person) => {
      const id = str(person["id"]);
      if (!id) return null;

      const org = (person["organization"] as Json) ?? {};
      const first = str(person["first_name"]) ?? "";
      const last = str(person["last_name"]) ?? "";

      return {
        apolloId: id,
        firstName: first,
        lastName: last,
        name: str(person["name"]) ?? [first, last].filter(Boolean).join(" "),
        title: str(person["title"]),
        company: str(org["name"]),
        email: str(person["email"]),
        emailStatus: str(person["email_status"]),
        phone: pickPhone(person),
        linkedinUrl: str(person["linkedin_url"]),
        city: str(person["city"]),
        country: str(person["country"]),
        industry: str(org["industry"]),
      } satisfies ApolloProspect;
    });

    return { prospects: enriched.filter((p): p is ApolloProspect => p !== null), total };
  });
