export function externalHttpHref(href, currentHref = globalThis.location?.href) {
  try {
    const current = new URL(currentHref);
    const target = new URL(href, current);
    if (!/^https?:$/.test(target.protocol) || target.origin === current.origin) return null;
    return target.href;
  } catch {
    return null;
  }
}

export function openExternalUrl(href, open = globalThis.open?.bind(globalThis)) {
  if (!open) return;
  const childWindow = open(href, "_blank");
  if (childWindow) childWindow.opener = null;
}

export function handleExternalLinkClick(
  event,
  {
    currentHref = globalThis.location?.href,
    open = globalThis.open?.bind(globalThis),
  } = {},
) {
  if (
    event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  ) return false;

  const anchor = event.target.closest("a");
  if (!anchor) return false;
  const href = externalHttpHref(anchor.href, currentHref);
  if (!href) return false;

  event.preventDefault();
  openExternalUrl(href, open);
  return true;
}
