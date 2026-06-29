import assert from "node:assert/strict";
import test from "node:test";

import {
  IMPORT_STORAGE_KEY,
  clearImportState,
  deserializeImportState,
  loadImportState,
  saveImportState,
  serializeImportState,
  type ImportReviewState,
} from "@/lib/scheduleImportPersist";
import type { ParseSummary } from "@/types/scheduleImport";

function summary(): ParseSummary {
  return {
    total_rows: 2,
    importable: 1,
    matched: 2,
    unmatched: 0,
    errors: 0,
    warnings: 1,
    garbage_rows: 0,
    by_code: { EMPLOYMENT_TYPE_DERIVED: 1 },
  };
}

function sampleState(): ImportReviewState {
  return {
    rows: [
      {
        row_number: 1,
        id_card: "DI-001",
        email: "a@x.io",
        employee: "HR-EMP-001",
        employee_name: "Jane Cruz",
        matched: true,
        am_from: "07:00",
        am_to: "11:00",
        pm_from: "13:00",
        pm_to: "17:00",
        day_off: { full_off: ["Sunday"], afternoon_off: [] },
        week_pattern: { frequency: "Every Week", days: [] },
        schedule_shape: "full_day",
        issues: [],
        importable: true,
        warnings: [],
      },
    ],
    summary: summary(),
    feedbackRows: [],
    selected: [0],
    rowFilter: "importable",
    effectiveFrom: "2026-07-01",
    groupOverrides: { '{"k":1}': "2026-08-01" },
  };
}

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

test("serialize → deserialize round-trips and stamps version 1", () => {
  const state = sampleState();
  const back = deserializeImportState(serializeImportState(state));
  assert.deepEqual(back, { version: 1, ...state });
});

test("deserialize rejects a stale version", () => {
  const raw = JSON.stringify({ version: 2, ...sampleState() });
  assert.equal(deserializeImportState(raw), null);
});

test("deserialize rejects invalid / empty input", () => {
  assert.equal(deserializeImportState(null), null);
  assert.equal(deserializeImportState(""), null);
  assert.equal(deserializeImportState("{not json"), null);
  assert.equal(deserializeImportState(JSON.stringify({ version: 1 })), null); // missing rows
});

test("loadImportState reads back what saveImportState wrote", () => {
  const storage = fakeStorage();
  const state = sampleState();
  saveImportState(storage, state);
  assert.ok(storage.map.has(IMPORT_STORAGE_KEY));
  assert.deepEqual(loadImportState(storage), { version: 1, ...state });
});

test("clearImportState removes the entry", () => {
  const storage = fakeStorage();
  saveImportState(storage, sampleState());
  clearImportState(storage);
  assert.equal(loadImportState(storage), null);
});

test("saveImportState fails soft when storage throws (e.g. quota)", () => {
  const throwing = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceeded");
    },
    removeItem: () => {},
  };
  assert.doesNotThrow(() => saveImportState(throwing, sampleState()));
});
