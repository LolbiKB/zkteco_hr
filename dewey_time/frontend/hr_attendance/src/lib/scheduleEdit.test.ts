import { test } from "node:test";
import assert from "node:assert/strict";

import { summarizeReconcile } from "@/lib/scheduleEdit";
import type { ReconcilePreview } from "@/types/schedule";

const EMPTY: ReconcilePreview = {
  effective_from: "2026-07-01",
  disable_ssas: [],
  add_identities: [],
  unchanged_identities: [],
  add_labels: [],
  leaving_labels: [],
  affected_assignments: [],
};

test("empty reconcile reports no changes", () => {
  const s = summarizeReconcile(EMPTY);
  assert.equal(s.hasChanges, false);
  assert.deepEqual(s.lines, []);
});

test("null reconcile is safe", () => {
  const s = summarizeReconcile(null);
  assert.equal(s.hasChanges, false);
});

test("counts inactivated and trimmed with pluralization", () => {
  const r: ReconcilePreview = {
    ...EMPTY,
    disable_ssas: [{ name: "SSA-B", shift_schedule: "PAT_B" }],
    leaving_labels: ["FRI 09–17"],
    add_labels: ["SAT 08–12"],
    affected_assignments: [
      { name: "A1", start_date: "2026-07-05", action: "inactivate" },
      { name: "A2", start_date: "2026-07-12", action: "inactivate" },
      { name: "A3", start_date: "2026-06-20", action: "end_before", proposed_end_date: "2026-06-30" },
    ],
  };
  const s = summarizeReconcile(r);
  assert.equal(s.hasChanges, true);
  assert.equal(s.inactivatedCount, 2);
  assert.equal(s.trimmedCount, 1);
  assert.deepEqual(s.leavingLabels, ["FRI 09–17"]);
  assert.deepEqual(s.addingLabels, ["SAT 08–12"]);
  assert.ok(s.lines.some((l) => l.includes("2 future shifts inactivated")));
  assert.ok(s.lines.some((l) => l.includes("1 shift trimmed")));
});
