import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DeweyTimeWordmark } from "./DeweyTimeWordmark";

test("renders the Dewey Time mark with green D, orange T, accessible name", () => {
  const html = renderToStaticMarkup(<DeweyTimeWordmark />);

  // Accessible name on the mark
  assert.match(html, /aria-label="Dewey Time"/);
  // Both tints present, green (D) before orange (T)
  const green = html.indexOf("color:var(--brand-primary)");
  const orange = html.indexOf("color:var(--brand-accent)");
  assert.ok(green !== -1, "green tint applied");
  assert.ok(orange !== -1, "orange tint applied");
  assert.ok(green < orange, "green D precedes orange T");
  // Full name is present in the markup (collapsed tails included)
  assert.match(html, /Dewey/);
  assert.match(html, /Time/);
});
