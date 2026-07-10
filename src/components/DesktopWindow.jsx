import { useRef } from "react";

export function DesktopWindow({
  windowState,
  active,
  children,
  onClose,
  onFocus,
  onMinimize,
  onMove,
  onToggleMaximize,
}) {
  const drag = useRef(null);
  const titleId = `window-title-${windowState.id.replaceAll(/[^a-z0-9]/gi, "-")}`;

  function handlePointerDown(event) {
    if (windowState.maximized || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: windowState.x,
      startY: windowState.y,
    };
  }

  function handlePointerMove(event) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const maxX = Math.max(12, globalThis.innerWidth - 220);
    const maxY = Math.max(52, globalThis.innerHeight - 104);
    onMove({
      x: Math.min(maxX, Math.max(12, drag.current.startX + event.clientX - drag.current.x)),
      y: Math.min(maxY, Math.max(52, drag.current.startY + event.clientY - drag.current.y)),
    });
  }

  function handlePointerUp(event) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <section
      className={`desktop-window${active ? " is-active" : ""}${windowState.maximized ? " is-maximized" : ""}`}
      style={{
        "--window-accent": windowState.accent,
        left: windowState.x,
        top: windowState.y,
        width: windowState.width,
        height: windowState.height,
        zIndex: windowState.z,
      }}
      hidden={windowState.minimized}
      onPointerDown={onFocus}
      role="dialog"
      aria-labelledby={titleId}
    >
      <header
        className="window-titlebar"
        onDoubleClick={onToggleMaximize}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span className="window-titlebar__status" aria-hidden="true" />
        <span id={titleId} className="window-titlebar__title">
          {windowState.title}
        </span>
        <span className="window-titlebar__controls">
          <button
            type="button"
            className="window-control"
            aria-label={`Minimize ${windowState.title}`}
            title="Minimize"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onMinimize();
            }}
          >
            <span aria-hidden="true">—</span>
          </button>
          <button
            type="button"
            className="window-control"
            aria-label={`${windowState.maximized ? "Restore" : "Maximize"} ${windowState.title}`}
            title={windowState.maximized ? "Restore" : "Maximize"}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleMaximize();
            }}
          >
            <span aria-hidden="true">□</span>
          </button>
          <button
            type="button"
            className="window-control window-control--close"
            aria-label={`Close ${windowState.title}`}
            title="Close"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </span>
      </header>
      <div className="window-content">{children}</div>
      <span className="window-resize-corner" aria-hidden="true" />
    </section>
  );
}
