import assert from "node:assert/strict";
import { parseTerminalCommand } from "../src/lib/terminal.js";

assert.deepEqual(parseTerminalCommand("open about"), {
  type: "open-page",
  page: "about",
});
assert.deepEqual(parseTerminalCommand("open writing"), {
  type: "open-writing",
});
assert.deepEqual(parseTerminalCommand("open projects"), {
  type: "open-page",
  page: "projects",
});
assert.deepEqual(parseTerminalCommand("open post improving-resilience-at-limechat"), {
  type: "open-post",
  slug: "improving-resilience-at-limechat",
});
assert.deepEqual(parseTerminalCommand("open writing/improving-resilience-at-limechat"), {
  type: "open-post",
  slug: "improving-resilience-at-limechat",
});
assert.deepEqual(parseTerminalCommand("help"), { type: "help" });
assert.deepEqual(parseTerminalCommand("ls"), { type: "list" });
assert.deepEqual(parseTerminalCommand("clear"), { type: "clear" });
assert.deepEqual(parseTerminalCommand(""), { type: "empty" });
assert.deepEqual(parseTerminalCommand("open"), {
  type: "error",
  message: "Usage: open <about|writing|projects|post SLUG>",
});
assert.deepEqual(parseTerminalCommand("sudo hire shubham"), {
  type: "unknown",
  command: "sudo",
});
