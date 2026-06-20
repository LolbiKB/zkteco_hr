import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("brand layer is imported after dewey-ui and its files exist", () => {
  const css = readFileSync("src/index.css", "utf8");
  const dewey = css.indexOf("@lolbikb/dewey-ui/theme.css");
  const tokens = css.indexOf("./brand/tokens.css");
  const base = css.indexOf("./brand/base.css");

  assert.ok(dewey !== -1, "dewey-ui theme import present");
  assert.ok(tokens !== -1, "brand tokens import present");
  assert.ok(base !== -1, "brand base import present");
  assert.ok(tokens > dewey, "tokens.css imported AFTER dewey-ui theme");
  assert.ok(base > dewey, "base.css imported AFTER dewey-ui theme");

  assert.ok(existsSync("src/brand/tokens.css"), "tokens.css file exists");
  assert.ok(existsSync("src/brand/base.css"), "base.css file exists");
});
