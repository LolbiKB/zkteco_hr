import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
