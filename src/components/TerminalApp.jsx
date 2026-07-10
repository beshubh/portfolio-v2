import { useEffect, useRef, useState } from "react";
import { parseDocument } from "../../assets/markdown.js";
import { formatDate, Markup } from "../content/ContentViews.jsx";
import { parseTerminalCommand, terminalHelp } from "../lib/terminal.js";

const bootEntry = {
  id: "boot",
  type: "system",
  lines: [
    "SHUBH::OS interactive portfolio shell",
    "Type `help` for commands. Start with `open about`.",
  ],
};

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function CommandGuide() {
  return (
    <div className="terminal-guide">
      {terminalHelp.map(([command, description]) => (
        <div key={command}>
          <code>{command}</code>
          <span>{description}</span>
        </div>
      ))}
    </div>
  );
}

function TerminalEntry({ entry, onNavigate }) {
  if (entry.type === "command") {
    return (
      <div className="terminal-command">
        <span aria-hidden="true">visitor@shubhos:~$</span>
        <strong>{entry.value}</strong>
      </div>
    );
  }

  if (entry.type === "system" || entry.type === "error") {
    return (
      <div className={`terminal-message terminal-message--${entry.type}`}>
        {entry.lines.map((line) => <p key={line}>{line}</p>)}
      </div>
    );
  }

  if (entry.type === "help") return <CommandGuide />;

  if (entry.type === "writing") {
    return (
      <section className="terminal-writing" aria-label="Published writing">
        <p className="terminal-output-label">~/writing</p>
        {entry.posts.map((post, index) => (
          <div className="terminal-writing-row" key={post.slug}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span>
              <strong>{post.title}</strong>
              <small>{post.slug}</small>
            </span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
          </div>
        ))}
        <p className="terminal-hint">Run `open post &lt;slug&gt;` to read an entry.</p>
      </section>
    );
  }

  if (entry.type === "document") {
    return (
      <section className="terminal-document">
        <p className="terminal-output-label">~/{entry.path}</p>
        {entry.metadata?.title && entry.kind === "post" ? (
          <header className="terminal-article-header">
            <h1>{entry.metadata.title}</h1>
            {entry.metadata.date ? <time dateTime={entry.metadata.date}>{formatDate(entry.metadata.date)}</time> : null}
          </header>
        ) : null}
        <Markup html={entry.html} className="terminal-prose" onNavigate={onNavigate} />
      </section>
    );
  }

  return null;
}

export function TerminalApp({ onNavigate }) {
  const [entries, setEntries] = useState([bootEntry]);
  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const screenRef = useRef(null);

  useEffect(() => {
    const screen = screenRef.current;
    if (screen) screen.scrollTop = screen.scrollHeight;
  }, [entries]);

  function append(entry) {
    setEntries((current) => [...current, { id: nextId(), ...entry }]);
  }

  async function loadDocument(path, kind) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error("not-found");
      const parsed = parseDocument(await response.text());
      append({
        type: "document",
        path: kind === "post" ? `writing/${path.split("/").at(-1).replace(/\.md$/, "")}` : `${kind}.md`,
        kind,
        ...parsed,
      });
    } catch {
      append({ type: "error", lines: [`Could not open ${kind}.`] });
    }
  }

  async function runCommand(rawCommand) {
    const command = rawCommand.trim();
    const parsed = parseTerminalCommand(command);
    if (parsed.type === "empty") return;
    if (parsed.type === "clear") {
      setEntries([]);
      return;
    }

    append({ type: "command", value: command });
    setCommandHistory((current) => [...current, command]);
    setHistoryIndex(-1);

    if (parsed.type === "help") {
      append({ type: "help" });
      return;
    }
    if (parsed.type === "list") {
      append({ type: "system", lines: ["about.md", "writing/", "projects.md"] });
      return;
    }
    if (parsed.type === "history") {
      append({ type: "system", lines: [...commandHistory, command].map((item, index) => `${index + 1}  ${item}`) });
      return;
    }
    if (parsed.type === "error") {
      append({ type: "error", lines: [parsed.message] });
      return;
    }
    if (parsed.type === "unknown") {
      append({ type: "error", lines: [`Command not found: ${parsed.command}`, "Run `help` to see available commands."] });
      return;
    }
    if (parsed.type === "open-page") {
      await loadDocument(`./content/pages/${parsed.page}.md`, parsed.page);
      return;
    }
    if (parsed.type === "open-post") {
      await loadDocument(`./content/writings/${encodeURIComponent(parsed.slug)}.md`, "post");
      return;
    }
    if (parsed.type === "open-writing") {
      try {
        const response = await fetch("./content/writings/index.json");
        if (!response.ok) throw new Error("not-found");
        append({ type: "writing", posts: await response.json() });
      } catch {
        append({ type: "error", lines: ["Could not open writing."] });
      }
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const command = input;
    setInput("");
    runCommand(command);
  }

  function handleKeyDown(event) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    if (!commandHistory.length) return;

    const nextIndex = event.key === "ArrowUp"
      ? Math.min(commandHistory.length - 1, historyIndex + 1)
      : Math.max(-1, historyIndex - 1);
    setHistoryIndex(nextIndex);
    setInput(nextIndex === -1 ? "" : commandHistory[commandHistory.length - 1 - nextIndex]);
  }

  return (
    <div className="terminal-app" onClick={() => document.getElementById("portfolio-terminal-input")?.focus()}>
      <div className="terminal-screen" ref={screenRef} aria-live="polite">
        {entries.map((entry) => (
          <TerminalEntry key={entry.id} entry={entry} onNavigate={onNavigate} />
        ))}
      </div>
      <form className="terminal-prompt" onSubmit={handleSubmit}>
        <label htmlFor="portfolio-terminal-input">visitor@shubhos:~$</label>
        <input
          id="portfolio-terminal-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
          aria-label="Terminal command"
          placeholder="open about"
        />
        <span className="terminal-cursor" aria-hidden="true" />
        <button type="submit" aria-label="Run command" title="Run command">↵</button>
      </form>
    </div>
  );
}
