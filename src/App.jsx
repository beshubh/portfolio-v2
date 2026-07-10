import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Article, MarkdownPage, NotFound, WritingIndex } from "./content/ContentViews.jsx";
import { DesktopIcon } from "./components/DesktopIcon.jsx";
import { DesktopWindow } from "./components/DesktopWindow.jsx";
import { TerminalApp } from "./components/TerminalApp.jsx";
import {
  AboutIcon,
  ArrowIcon,
  MenuIcon,
  PaletteIcon,
  ProjectsIcon,
  TerminalIcon,
  WritingIcon,
} from "./components/Icons.jsx";
import { hrefForView, idForView, viewFromSearch } from "./lib/routes.js";

const applications = [
  {
    kind: "about",
    label: "About me",
    title: "about.md",
    detail: "01 — PROFILE",
    accent: "#9ef01a",
    icon: AboutIcon,
  },
  {
    kind: "writing",
    label: "Writing",
    title: "writing/",
    detail: "02 — NOTES",
    accent: "#00c2d1",
    icon: WritingIcon,
  },
  {
    kind: "projects",
    label: "Projects",
    title: "projects.md",
    detail: "03 — BUILDS",
    accent: "#ffb000",
    icon: ProjectsIcon,
  },
  {
    kind: "terminal",
    label: "Terminal",
    title: "portfolio.shell",
    detail: "04 — COMMAND",
    accent: "#ff5c35",
    icon: TerminalIcon,
  },
];

const defaultSite = {
  name: "Shubham Kumar",
  email: "bshubh@proton.me",
  github: "https://github.com/beshubh",
  admin: "https://shubh-portfolio-admin.shubhamkumar7051.workers.dev/admin/",
};

function applicationFor(kind) {
  return applications.find((application) => application.kind === kind);
}

function windowLayout(view) {
  const viewportWidth = globalThis.innerWidth || 1440;
  const viewportHeight = globalThis.innerHeight || 900;
  const article = view.kind === "post";
  const terminal = view.kind === "terminal";
  const preferredWidth = article ? 920 : terminal ? 900 : view.kind === "about" ? 860 : view.kind === "writing" ? 820 : 760;
  const preferredHeight = article ? 720 : terminal ? 670 : view.kind === "about" ? 660 : view.kind === "writing" ? 640 : 620;
  const width = Math.min(preferredWidth, viewportWidth - 72);
  const height = Math.min(preferredHeight, viewportHeight - 150);
  const preferredX = article ? 210 : terminal ? 270 : view.kind === "about" ? 230 : view.kind === "writing" ? 310 : 360;
  const preferredY = article ? 72 : terminal ? 70 : view.kind === "about" ? 86 : view.kind === "writing" ? 82 : 100;

  return {
    x: Math.max(24, Math.min(preferredX, viewportWidth - width - 30)),
    y: Math.max(54, Math.min(preferredY, viewportHeight - height - 76)),
    width,
    height,
  };
}

function makeWindow(view, z) {
  const application = applicationFor(view.kind);
  return {
    id: idForView(view),
    view,
    title: application?.title || (view.kind === "post" ? `${view.slug}.md` : "not-found"),
    accent: application?.accent || (view.kind === "post" ? "#ff5c35" : "#9ef01a"),
    minimized: false,
    maximized: false,
    z,
    ...windowLayout(view),
  };
}

function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(new Date()), 30_000);
    return () => globalThis.clearInterval(timer);
  }, []);

  return {
    time: new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now),
    date: new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(now),
  };
}

function windowLabel(windowState) {
  if (windowState.view.kind === "post" && windowState.title.endsWith(".md")) return "Article";
  return applicationFor(windowState.view.kind)?.label || windowState.title;
}

export default function App() {
  const initialView = useMemo(() => viewFromSearch(globalThis.location.search), []);
  const initialWindow = useMemo(() => makeWindow(initialView, 1), [initialView]);
  const [windows, setWindows] = useState([initialWindow]);
  const [activeId, setActiveId] = useState(initialWindow.id);
  const [startOpen, setStartOpen] = useState(false);
  const [site, setSite] = useState(defaultSite);
  const [theme, setTheme] = useState(() => globalThis.localStorage?.getItem("shubh-os-theme") || "day");
  const zIndex = useRef(1);
  const clock = useClock();

  useEffect(() => {
    const controller = new AbortController();
    fetch("./content/site.json", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : defaultSite))
      .then(setSite)
      .catch((error) => {
        if (error.name !== "AbortError") setSite(defaultSite);
      });
    return () => controller.abort();
  }, []);

  const openView = useCallback((view, historyMode = "push") => {
    const id = idForView(view);
    const z = ++zIndex.current;
    setWindows((current) => {
      const existing = current.find((item) => item.id === id);
      if (existing) {
        return current.map((item) =>
          item.id === id ? { ...item, minimized: false, z } : item,
        );
      }
      return [...current, makeWindow(view, z)];
    });
    setActiveId(id);
    setStartOpen(false);

    if (historyMode === "push") globalThis.history.pushState({}, "", hrefForView(view));
    if (historyMode === "replace") globalThis.history.replaceState({}, "", hrefForView(view));
  }, []);

  useEffect(() => {
    function handlePopState() {
      openView(viewFromSearch(globalThis.location.search), null);
    }
    globalThis.addEventListener("popstate", handlePopState);
    return () => globalThis.removeEventListener("popstate", handlePopState);
  }, [openView]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") setStartOpen(false);
    }
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activeWindow = windows.find((item) => item.id === activeId);

  useEffect(() => {
    const title = activeWindow
      ? activeWindow.view.kind === "about"
        ? "About"
        : activeWindow.view.kind === "writing"
          ? "Writing"
          : activeWindow.view.kind === "projects"
            ? "Projects"
            : activeWindow.view.kind === "terminal"
              ? "Terminal"
            : activeWindow.title.replace(/\.md$/, "")
      : "Desktop";
    document.title = `${title} — ${site.name}`;
  }, [activeWindow, site.name]);

  const focusWindow = useCallback(
    (id, syncRoute = true) => {
      const target = windows.find((item) => item.id === id);
      if (!target) return;
      const z = ++zIndex.current;
      setWindows((current) =>
        current.map((item) =>
          item.id === id ? { ...item, minimized: false, z } : item,
        ),
      );
      setActiveId(id);
      if (syncRoute) globalThis.history.replaceState({}, "", hrefForView(target.view));
    },
    [windows],
  );

  const minimizeWindow = useCallback((id) => {
    const visible = windows
      .filter((item) => item.id !== id && !item.minimized)
      .sort((a, b) => b.z - a.z);
    setWindows((current) =>
      current.map((item) => (item.id === id ? { ...item, minimized: true } : item)),
    );
    setActiveId(visible[0]?.id || "");
    if (visible[0]) globalThis.history.replaceState({}, "", hrefForView(visible[0].view));
  }, [windows]);

  const closeWindow = useCallback((id) => {
    const visible = windows
      .filter((item) => item.id !== id && !item.minimized)
      .sort((a, b) => b.z - a.z);
    setWindows((current) => current.filter((item) => item.id !== id));
    setActiveId(visible[0]?.id || "");
    if (visible[0]) globalThis.history.replaceState({}, "", hrefForView(visible[0].view));
  }, [windows]);

  const toggleMaximize = useCallback((id) => {
    setWindows((current) =>
      current.map((item) =>
        item.id === id ? { ...item, maximized: !item.maximized } : item,
      ),
    );
  }, []);

  const moveWindow = useCallback((id, position) => {
    setWindows((current) =>
      current.map((item) => (item.id === id ? { ...item, ...position } : item)),
    );
  }, []);

  const updateMetadata = useCallback((id, metadata) => {
    if (!metadata?.title) return;
    setWindows((current) => {
      let changed = false;
      const next = current.map((item) => {
        if (item.id !== id || item.view.kind !== "post" || item.title === metadata.title) return item;
        changed = true;
        return { ...item, title: metadata.title };
      });
      return changed ? next : current;
    });
  }, []);

  function toggleTheme() {
    const next = theme === "day" ? "night" : "day";
    setTheme(next);
    globalThis.localStorage?.setItem("shubh-os-theme", next);
  }

  function contentFor(windowState) {
    const common = {
      metadataKey: windowState.id,
      onMetadata: updateMetadata,
      onNavigate: openView,
    };

    if (windowState.view.kind === "about") return <MarkdownPage page="about" {...common} />;
    if (windowState.view.kind === "projects") return <MarkdownPage page="projects" {...common} />;
    if (windowState.view.kind === "writing") return <WritingIndex onNavigate={openView} />;
    if (windowState.view.kind === "terminal") return <TerminalApp onNavigate={openView} />;
    if (windowState.view.kind === "post") {
      return <Article slug={windowState.view.slug} {...common} />;
    }
    return <NotFound />;
  }

  return (
    <div className="os-shell" data-theme={theme}>
      <a className="skip-link" href="#desktop-workspace">Skip to desktop</a>

      <header className="system-bar">
        <button
          type="button"
          className="system-brand"
          onClick={() => openView({ kind: "about" })}
          aria-label="Open About me"
        >
          <span className="system-brand__mark">SK</span>
          <span>SHUBH::OS</span>
          <span className="system-brand__version">r2</span>
        </button>
        <div className="system-location" aria-live="polite">
          <span className="system-location__dot" aria-hidden="true" />
          {activeWindow ? windowLabel(activeWindow) : "Desktop"}
        </div>
        <div className="system-status">
          <span className="system-status__label">NODE: PORTFOLIO // 2026</span>
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Toggle color theme">
            <PaletteIcon />
          </button>
        </div>
      </header>

      <main id="desktop-workspace" className="desktop-workspace">
        <div className="wallpaper-grid" aria-hidden="true" />
        <div className="wallpaper-orbit wallpaper-orbit--one" aria-hidden="true" />
        <div className="wallpaper-orbit wallpaper-orbit--two" aria-hidden="true" />
        <div className="wallpaper-sticker" aria-hidden="true">
          <span>&gt;_ SK</span>
          <small>ROOT@SHUBH</small>
        </div>
        <div className="wallpaper-status" aria-hidden="true">
          <span>KERNEL</span>
          <strong>ACTIVE</strong>
          <span>{applications.length} PROCESSES</span>
        </div>

        <nav className="desktop-icons" aria-label="Portfolio applications">
          {applications.map((application) => (
            <DesktopIcon
              key={application.kind}
              {...application}
              onOpen={() => openView({ kind: application.kind })}
            />
          ))}
        </nav>

        <div className="window-layer">
          {windows.map((windowState) => (
            <DesktopWindow
              key={windowState.id}
              windowState={windowState}
              active={windowState.id === activeId}
              onClose={() => closeWindow(windowState.id)}
              onFocus={() => focusWindow(windowState.id)}
              onMinimize={() => minimizeWindow(windowState.id)}
              onMove={(position) => moveWindow(windowState.id, position)}
              onToggleMaximize={() => toggleMaximize(windowState.id)}
            >
              {contentFor(windowState)}
            </DesktopWindow>
          ))}
        </div>
      </main>

      {startOpen ? (
        <aside className="start-menu" aria-label="ShubhOS menu">
          <div className="start-menu__header">
            <span className="start-menu__avatar">SK</span>
            <span>
              <strong>{site.name}</strong>
              <small>Portfolio</small>
            </span>
          </div>
          <nav className="start-menu__apps" aria-label="Applications">
            {applications.map(({ kind, label, icon: Icon, accent }) => (
              <button key={kind} type="button" onClick={() => openView({ kind })}>
                <span style={{ "--menu-accent": accent }}><Icon size={30} /></span>
                <strong>{label}</strong>
                <ArrowIcon />
              </button>
            ))}
          </nav>
          <footer className="start-menu__footer">
            <p>© {new Date().getFullYear()} {site.name}.</p>
            <span>
              <a href={`mailto:${site.email}`}>Email</a>
              <a href={site.github} rel="me">GitHub</a>
              <a href={site.admin}>Admin</a>
            </span>
          </footer>
        </aside>
      ) : null}

      <footer className="dock" aria-label="Taskbar">
        <button
          className={`dock-start${startOpen ? " is-open" : ""}`}
          type="button"
          onClick={() => setStartOpen((open) => !open)}
          aria-expanded={startOpen}
          aria-label="Open ShubhOS menu"
        >
          <MenuIcon />
          <span>SYS</span>
        </button>

        <div className="dock-tasks" aria-label="Open windows">
          {windows.map((windowState) => (
            <button
              className={`dock-task${windowState.id === activeId && !windowState.minimized ? " is-active" : ""}`}
              key={windowState.id}
              type="button"
              onClick={() => focusWindow(windowState.id)}
            >
              <span style={{ background: windowState.accent }} aria-hidden="true" />
              {windowLabel(windowState)}
            </button>
          ))}
        </div>

        <div className="dock-links">
          <a href={`mailto:${site.email}`}>Email</a>
          <a href={site.github} rel="me">GitHub</a>
          <a href={site.admin}>Admin</a>
        </div>
        <div className="dock-clock" aria-label={`${clock.date}, ${clock.time}`}>
          <strong>{clock.time}</strong>
          <span>{clock.date}</span>
        </div>
      </footer>
    </div>
  );
}
