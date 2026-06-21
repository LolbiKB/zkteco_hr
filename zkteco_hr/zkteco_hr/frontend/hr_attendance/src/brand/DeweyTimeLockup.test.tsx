import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DeweyTimeLockup } from "./DeweyTimeLockup";

test("lockup pairs the clock dial mark with the Dewey Time wordtext", () => {
  const html = renderToStaticMarkup(<DeweyTimeLockup />);

  // the dial mark
  assert.match(html, /<svg/, "renders the dial svg");
  assert.match(html, /<circle[^>]*r="32"/, "includes the clock dial ring");

  // the wordtext (the visible text is the accessible name)
  assert.match(html, /Dewey/, "includes the Dewey wordtext");
  assert.match(html, /Time/, "includes the Time wordtext");

  // dial precedes the wordtext (icon then type)
  const dial = html.indexOf("<svg");
  const word = html.indexOf("Dewey");
  assert.ok(dial !== -1 && word !== -1 && dial < word, "dial mark sits before the wordtext");
});
