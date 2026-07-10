import assert from "node:assert/strict";
import {
  externalHttpHref,
  handleExternalLinkClick,
  openExternalUrl,
} from "../src/lib/externalLinks.js";

assert.equal(
  externalHttpHref("https://sololearn.com", "https://beshubh.github.io/?page=about"),
  "https://sololearn.com/",
);
assert.equal(
  externalHttpHref("./?post=an-article", "https://beshubh.github.io/?page=about"),
  null,
);
assert.equal(
  externalHttpHref("mailto:bshubh@proton.me", "https://beshubh.github.io/?page=about"),
  null,
);

const calls = [];
const childWindow = { opener: "portfolio" };
openExternalUrl("https://sololearn.com/", (...args) => {
  calls.push(args);
  return childWindow;
});

assert.deepEqual(calls, [
  ["https://sololearn.com/", "_blank"],
]);
assert.equal(childWindow.opener, null);

let prevented = false;
const handled = handleExternalLinkClick({
  defaultPrevented: false,
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  target: {
    closest(selector) {
      assert.equal(selector, "a");
      return { href: "https://sololearn.com" };
    },
  },
  preventDefault() {
    prevented = true;
  },
}, {
  currentHref: "https://beshubh.github.io/?page=about",
  open: (...args) => {
    calls.push(args);
    return childWindow;
  },
});

assert.equal(handled, true);
assert.equal(prevented, true);
assert.deepEqual(calls.at(-1), ["https://sololearn.com/", "_blank"]);

const fallbackNavigations = [];
const blockedResult = openExternalUrl(
  "https://sololearn.com/",
  () => null,
  (href) => fallbackNavigations.push(href),
);

assert.equal(blockedResult, "fallback");
assert.deepEqual(fallbackNavigations, ["https://sololearn.com/"]);

let blockedPrevented = false;
const handlerFallbackNavigations = [];
const blockedHandled = handleExternalLinkClick({
  defaultPrevented: false,
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  target: {
    closest() {
      return { href: "https://sololearn.com" };
    },
  },
  preventDefault() {
    blockedPrevented = true;
  },
}, {
  currentHref: "https://beshubh.github.io/?page=about",
  open: () => null,
  navigate: (href) => handlerFallbackNavigations.push(href),
});

assert.equal(blockedHandled, true);
assert.equal(blockedPrevented, true);
assert.deepEqual(handlerFallbackNavigations, ["https://sololearn.com/"]);
