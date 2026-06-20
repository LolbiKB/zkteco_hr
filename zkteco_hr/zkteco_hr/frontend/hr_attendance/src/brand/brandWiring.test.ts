import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("HrAppShell uses the wordmark, not the old image logo/title", () => {
  const shell = readFileSync("src/ui/HrAppShell.tsx", "utf8");
  assert.match(shell, /DeweyTimeWordmark/, "uses DeweyTimeWordmark");
  assert.ok(!shell.includes("APP_LOGO"), "drops the APP_LOGO import/usage");
  assert.ok(!shell.includes("<img"), "no <img> logo in the header");
  assert.ok(!shell.includes('title="ZKTeco HR"'), "drops the text title");
});
