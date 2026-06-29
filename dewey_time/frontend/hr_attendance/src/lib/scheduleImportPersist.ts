import type {
  FeedbackRow,
  ParsedRow,
  ParseSummary,
  RowFilter,
} from "@/types/scheduleImport";

// sessionStorage persistence for the import review state, so a refresh or
// accidental navigation away does not lose a long triage. The uploaded File is
// NOT stored — the parsed rows are enough to restore the Review step. Cleared on
// successful apply or an explicit "start over".

export const IMPORT_STORAGE_KEY = "dewey:schedule-import:v1";
const VERSION = 1;

/** The in-memory review state worth restoring (selection as a plain array). */
export type ImportReviewState = {
  rows: ParsedRow[];
  summary: ParseSummary;
  feedbackRows: FeedbackRow[];
  selected: number[];
  rowFilter: RowFilter;
  effectiveFrom: string;
  groupOverrides: Record<string, string>;
};

export type PersistedImportState = ImportReviewState & { version: number };

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function serializeImportState(state: ImportReviewState): string {
  return JSON.stringify({ version: VERSION, ...state });
}

export function deserializeImportState(
  raw: string | null | undefined
): PersistedImportState | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== VERSION) return null;
  if (!Array.isArray(obj.rows) || !Array.isArray(obj.selected)) return null;
  if (!obj.summary || typeof obj.summary !== "object") return null;
  return obj as PersistedImportState;
}

export function loadImportState(storage: StorageLike): PersistedImportState | null {
  try {
    return deserializeImportState(storage.getItem(IMPORT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveImportState(storage: StorageLike, state: ImportReviewState): void {
  try {
    storage.setItem(IMPORT_STORAGE_KEY, serializeImportState(state));
  } catch {
    // Quota exceeded or storage unavailable — persistence is best-effort.
  }
}

export function clearImportState(storage: StorageLike): void {
  try {
    storage.removeItem(IMPORT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
