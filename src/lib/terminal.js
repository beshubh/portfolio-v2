const pages = new Set(["about", "projects"]);

export const terminalHelp = [
  ["open about", "read the profile"],
  ["open writing", "list published writing"],
  ["open projects", "read the project list"],
  ["open post <slug>", "read a writing entry"],
  ["ls", "list available destinations"],
  ["history", "show command history"],
  ["clear", "clear the terminal"],
  ["help", "show this command guide"],
];

export function parseTerminalCommand(input) {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { type: "empty" };

  const command = tokens[0].toLowerCase();
  if (command === "help") return { type: "help" };
  if (command === "ls") return { type: "list" };
  if (command === "clear") return { type: "clear" };
  if (command === "history") return { type: "history" };

  if (command !== "open") return { type: "unknown", command };

  const target = tokens[1]?.toLowerCase();
  if (!target) {
    return {
      type: "error",
      message: "Usage: open <about|writing|projects|post SLUG>",
    };
  }

  if (pages.has(target)) return { type: "open-page", page: target };
  if (target === "writing" && tokens.length === 2) return { type: "open-writing" };

  const writingPath = target.match(/^writing\/(.+)$/);
  if (writingPath) return { type: "open-post", slug: writingPath[1] };

  if (target === "post" && tokens[2]) {
    return { type: "open-post", slug: tokens.slice(2).join("-") };
  }

  return {
    type: "error",
    message: "Usage: open <about|writing|projects|post SLUG>",
  };
}
