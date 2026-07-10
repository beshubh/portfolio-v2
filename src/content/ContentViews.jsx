import { useEffect, useMemo, useState } from "react";
import { parseDocument } from "../../assets/markdown.js";
import { hrefForView, viewFromSearch } from "../lib/routes.js";

function useRemoteText(url) {
  const [state, setState] = useState({ status: "loading", value: "" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", value: "" });

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${url}`);
        return response.text();
      })
      .then((value) => setState({ status: "ready", value }))
      .catch((error) => {
        if (error.name !== "AbortError") setState({ status: "error", value: "" });
      });

    return () => controller.abort();
  }, [url]);

  return state;
}

export function formatDate(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function LoadingDocument() {
  return (
    <div className="document-state" role="status">
      <span className="document-state__cursor" aria-hidden="true" />
      Loading…
    </div>
  );
}

function MissingDocument() {
  return (
    <div className="document prose-document">
      <h1>Not found</h1>
      <p>The requested page could not be loaded.</p>
      <p>
        <a href="./">Return home</a>
      </p>
    </div>
  );
}

export function Markup({ html, className = "", onNavigate }) {
  function handleClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest("a");
    if (!anchor) return;

    const url = new URL(anchor.href, globalThis.location.href);
    if (url.origin !== globalThis.location.origin || url.pathname !== globalThis.location.pathname) return;
    if (!url.searchParams.has("post") && !url.searchParams.has("page")) return;

    event.preventDefault();
    onNavigate(viewFromSearch(url.search));
  }

  return (
    <div
      className={className}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function MarkdownPage({ page, metadataKey, onNavigate, onMetadata }) {
  const state = useRemoteText(`./content/pages/${page}.md`);
  const parsed = useMemo(
    () => (state.status === "ready" ? parseDocument(state.value) : null),
    [state],
  );

  useEffect(() => {
    if (parsed) onMetadata?.(metadataKey, parsed.metadata);
  }, [metadataKey, onMetadata, parsed]);

  if (state.status === "loading") return <LoadingDocument />;
  if (state.status === "error") return <MissingDocument />;

  return (
    <Markup
      html={parsed.html}
      className={`document prose-document ${page}-document`}
      onNavigate={onNavigate}
    />
  );
}

export function WritingIndex({ onNavigate }) {
  const [state, setState] = useState({ status: "loading", posts: [] });

  useEffect(() => {
    const controller = new AbortController();
    fetch("./content/writings/index.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load writing index");
        return response.json();
      })
      .then((posts) => setState({ status: "ready", posts }))
      .catch((error) => {
        if (error.name !== "AbortError") setState({ status: "error", posts: [] });
      });
    return () => controller.abort();
  }, []);

  if (state.status === "loading") return <LoadingDocument />;
  if (state.status === "error") return <MissingDocument />;

  return (
    <div className="document writing-document">
      <header className="document-heading">
        <p className="document-kicker">~/writing</p>
        <h1>Writing</h1>
      </header>
      <div className="writing-list">
        {state.posts.map((post, index) => {
          const view = { kind: "post", slug: post.slug };
          return (
            <a
              className="writing-row"
              href={hrefForView(view)}
              key={post.slug}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                onNavigate(view);
              }}
            >
              <span className="writing-row__number">{String(index + 1).padStart(2, "0")}</span>
              <span className="writing-row__copy">
                <strong>{post.title}</strong>
                {post.summary ? <small>{post.summary}</small> : null}
              </span>
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span className="writing-row__arrow" aria-hidden="true">↗</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function Article({ slug, metadataKey, onNavigate, onMetadata }) {
  const state = useRemoteText(`./content/writings/${encodeURIComponent(slug)}.md`);
  const parsed = useMemo(
    () => (state.status === "ready" ? parseDocument(state.value) : null),
    [state],
  );

  useEffect(() => {
    if (parsed) onMetadata?.(metadataKey, parsed.metadata);
  }, [metadataKey, onMetadata, parsed]);

  if (state.status === "loading") return <LoadingDocument />;
  if (state.status === "error") return <MissingDocument />;

  const { metadata, html } = parsed;

  return (
    <article className="document prose-document article-document">
      <a
        className="back-link"
        href={hrefForView({ kind: "writing" })}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onNavigate({ kind: "writing" });
        }}
      >
        ← All writing
      </a>
      <header className="article-header">
        <p className="document-kicker">~/writing/{slug}</p>
        <h1>{metadata.title}</h1>
        <p>{formatDate(metadata.date)}</p>
      </header>
      <Markup html={html} className="article-body" onNavigate={onNavigate} />
    </article>
  );
}

export function NotFound() {
  return <MissingDocument />;
}
