import { useEffect, useMemo, useState } from "react";
import { parseDocument } from "../../assets/markdown.js";
import { payloadFromDraft, slugFromTitle } from "./draft.js";

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initialDraft() {
  return {
    title: "",
    slug: "",
    date: localDate(),
    summary: "",
    tags: "",
    body: "",
  };
}

function LoginScreen({ message }) {
  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">SHUBH::OS / PUBLISHER</p>
        <h1>Portfolio publisher</h1>
        <p>{message}</p>
        <a className="primary-action" href="/auth/login">Sign in with GitHub</a>
        <a className="text-link" href="https://beshubh.github.io">← Return to portfolio</a>
      </section>
    </main>
  );
}

export function AdminApp() {
  const previewMode = import.meta.env.DEV && new URLSearchParams(globalThis.location.search).has("preview");
  const [session, setSession] = useState(
    previewMode ? { status: "signed-in", login: "beshubh" } : { status: "loading" },
  );
  const [draft, setDraft] = useState(initialDraft);
  const [slugWasEdited, setSlugWasEdited] = useState(false);
  const [publishState, setPublishState] = useState({ status: "idle" });

  useEffect(() => {
    if (previewMode) return undefined;
    const controller = new AbortController();
    fetch("/api/session", { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return { status: "signed-out" };
        if (!response.ok) throw new Error("Could not check the admin session.");
        const result = await response.json();
        return { status: "signed-in", login: result.login };
      })
      .then(setSession)
      .catch((error) => {
        if (error.name !== "AbortError") {
          setSession({ status: "error", message: error.message });
        }
      });
    return () => controller.abort();
  }, [previewMode]);

  const preview = useMemo(() => parseDocument(draft.body).html, [draft.body]);

  function updateField(event) {
    const { name, value } = event.target;
    setDraft((current) => {
      const next = { ...current, [name]: value };
      if (name === "title" && !slugWasEdited) next.slug = slugFromTitle(value);
      return next;
    });
    if (name === "slug") setSlugWasEdited(true);
    setPublishState({ status: "idle" });
  }

  async function publish(event) {
    event.preventDefault();
    setPublishState({ status: "publishing" });
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromDraft(draft)),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The post could not be published.");
      setPublishState({ status: "published", ...result });
    } catch (error) {
      setPublishState({ status: "error", message: error.message });
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setSession({ status: "signed-out" });
  }

  if (session.status === "loading") {
    return <LoginScreen message="Checking your GitHub session…" />;
  }
  if (session.status === "signed-out") {
    return <LoginScreen message="Sign in with the GitHub account allowed to publish this portfolio." />;
  }
  if (session.status === "error") {
    return <LoginScreen message={session.message} />;
  }

  return (
    <div className="publisher-shell">
      <header className="publisher-bar">
        <div>
          <span className="publisher-mark">&gt;_</span>
          <span>SHUBH::OS / PUBLISHER</span>
        </div>
        <div className="publisher-session">
          <span>AUTH: {session.login}</span>
          <button type="button" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="publisher-workspace">
        <form className="editor-panel" onSubmit={publish}>
          <header className="panel-heading">
            <div>
              <p className="eyebrow">NEW WRITING</p>
              <h1>Write and publish</h1>
            </div>
            <a href="https://beshubh.github.io/?page=writing">View writing ↗</a>
          </header>

          <div className="field-grid">
            <label className="field field--wide">
              <span>Title</span>
              <input name="title" value={draft.title} onChange={updateField} maxLength="180" required autoFocus />
            </label>
            <label className="field">
              <span>Slug</span>
              <input name="slug" value={draft.slug} onChange={updateField} maxLength="100" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
            </label>
            <label className="field">
              <span>Date</span>
              <input type="date" name="date" value={draft.date} onChange={updateField} required />
            </label>
            <label className="field field--wide">
              <span>Summary</span>
              <input name="summary" value={draft.summary} onChange={updateField} maxLength="320" required />
            </label>
            <label className="field field--wide">
              <span>Tags <small>comma-separated</small></span>
              <input name="tags" value={draft.tags} onChange={updateField} placeholder="systems, reliability" required />
            </label>
          </div>

          <label className="field body-field">
            <span>Markdown</span>
            <textarea
              name="body"
              value={draft.body}
              onChange={updateField}
              placeholder="Opening paragraph: establish the problem and why it matters."
              spellCheck="true"
              required
            />
          </label>

          <footer className="publish-bar">
            <div className={`publish-status publish-status--${publishState.status}`} role="status">
              {publishState.status === "idle" ? "Ready when the draft is." : null}
              {publishState.status === "publishing" ? "Publishing to GitHub…" : null}
              {publishState.status === "error" ? publishState.message : null}
              {publishState.status === "published" ? (
                <span>
                  Published. <a href={publishState.articleUrl}>Open article ↗</a>{" "}
                  <a href={publishState.commitUrl}>View commit ↗</a>
                </span>
              ) : null}
            </div>
            <button className="publish-button" type="submit" disabled={publishState.status === "publishing"}>
              {publishState.status === "publishing" ? "Publishing…" : "Publish post"}
            </button>
          </footer>
        </form>

        <section className="preview-panel" aria-label="Post preview">
          <header className="preview-chrome">
            <span>LIVE PREVIEW</span>
            <span>{draft.slug || "untitled-post"}.md</span>
          </header>
          <article className="article-preview">
            <p className="preview-path">~/writing/{draft.slug || "untitled-post"}</p>
            <h1>{draft.title || "Your post title"}</h1>
            <time dateTime={draft.date}>{draft.date}</time>
            {draft.summary ? <p className="preview-summary">{draft.summary}</p> : null}
            <div
              className="preview-body"
              dangerouslySetInnerHTML={{ __html: preview || "<p>Start writing to see the Markdown preview.</p>" }}
            />
          </article>
        </section>
      </main>
    </div>
  );
}
