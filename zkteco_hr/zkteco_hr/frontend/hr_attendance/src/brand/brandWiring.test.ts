import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("HrAppShell uses the wordmark, not the old image logo/title", () => {
  const shell = readFileSync(resolve(PKG, "src/ui/HrAppShell.tsx"), "utf8");
  assert.match(shell, /DeweyTimeWordmark/, "uses DeweyTimeWordmark");
  assert.ok(!shell.includes("APP_LOGO"), "drops the APP_LOGO import/usage");
  assert.ok(!shell.includes("<img"), "no <img> logo in the header");
  assert.ok(!shell.includes('title="ZKTeco HR"'), "drops the text title");
});

test("Dewey Time dial SVG exists and is the adaptive clock mark", () => {
  const p = resolve(PKG, "../../public/images/dewey-time.svg");
  assert.ok(existsSync(p), "public/images/dewey-time.svg present");
  const svg = readFileSync(p, "utf8");
  assert.match(svg, /<circle[^>]*r="32"/, "has the dial ring (r=32)");
  assert.match(svg, /prefers-color-scheme:\s*dark/, "has the light/dark swap");
  assert.match(svg, /#066031/, "Forest green present");
  assert.match(svg, /#C2410C/i, "brand orange present");
});
