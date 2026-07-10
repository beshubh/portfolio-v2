export function DesktopIcon({ icon: Icon, label, detail, accent, onOpen }) {
  return (
    <button
      className="desktop-icon"
      style={{ "--icon-accent": accent }}
      type="button"
      onClick={onOpen}
      aria-label={`Open ${label}`}
    >
      <span className="desktop-icon__art">
        <Icon size={48} />
      </span>
      <span className="desktop-icon__label">{label}</span>
      <span className="desktop-icon__detail">{detail}</span>
    </button>
  );
}
