const pageViews = new Set(["about", "writing", "projects", "terminal"]);

export function viewFromSearch(search = "") {
  const params = new URLSearchParams(search);
  const post = params.get("post");

  if (post) return { kind: "post", slug: post };

  const page = params.get("page") || "about";
  if (pageViews.has(page)) return { kind: page };

  return { kind: "not-found" };
}

export function hrefForView(view) {
  if (view.kind === "post") {
    return `./?post=${encodeURIComponent(view.slug)}`;
  }

  if (pageViews.has(view.kind)) return `./?page=${view.kind}`;
  return "./?page=not-found";
}

export function idForView(view) {
  return view.kind === "post" ? `post:${view.slug}` : view.kind;
}
