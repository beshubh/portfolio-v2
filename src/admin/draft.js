export function slugFromTitle(title) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

export function payloadFromDraft(draft) {
  const tags = [...new Set(
    draft.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  )];

  return {
    title: draft.title.trim(),
    slug: draft.slug.trim(),
    date: draft.date,
    summary: draft.summary.trim(),
    tags,
    body: draft.body,
  };
}
