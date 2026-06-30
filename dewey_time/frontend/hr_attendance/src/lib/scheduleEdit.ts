import type { ReconcilePreview } from "@/types/schedule";

export type ScheduleChangeSummary = {
  hasChanges: boolean;
  leavingLabels: string[];
  addingLabels: string[];
  inactivatedCount: number;
  trimmedCount: number;
  lines: string[];
};

export function summarizeReconcile(
  reconcile: ReconcilePreview | null | undefined,
): ScheduleChangeSummary {
  const disable = reconcile?.disable_ssas ?? [];
  const affected = reconcile?.affected_assignments ?? [];
  const addingLabels = reconcile?.add_labels ?? [];
  const leavingLabels = reconcile?.leaving_labels ?? [];

  const inactivatedCount = affected.filter((a) => a.action === "inactivate").length;
  const trimmedCount = affected.filter((a) => a.action === "end_before").length;

  const lines: string[] = [];
  for (const label of leavingLabels) lines.push(`Retiring ${label}`);
  for (const label of addingLabels) {
    lines.push(`Adding ${label} from ${reconcile?.effective_from ?? "the effective date"}`);
  }
  if (inactivatedCount) {
    lines.push(`${inactivatedCount} future shift${inactivatedCount === 1 ? "" : "s"} inactivated`);
  }
  if (trimmedCount) {
    const end = reconcile?.affected_assignments.find((a) => a.action === "end_before")
      ?.proposed_end_date;
    lines.push(
      `${trimmedCount} shift${trimmedCount === 1 ? "" : "s"} trimmed${end ? ` to end ${end}` : ""}`,
    );
  }

  const hasChanges =
    disable.length > 0 ||
    affected.length > 0 ||
    addingLabels.length > 0 ||
    (reconcile?.add_identities?.length ?? 0) > 0;

  return { hasChanges, leavingLabels, addingLabels, inactivatedCount, trimmedCount, lines };
}

/** True when the edit will retire existing future shifts (disable an SSA or trim/inactivate
 * an assignment) — the case that warrants a typed confirmation. */
export function reconcileRetiresShifts(
  reconcile: ReconcilePreview | null | undefined,
): boolean {
  return Boolean(
    (reconcile?.disable_ssas?.length ?? 0) > 0 ||
      (reconcile?.affected_assignments?.length ?? 0) > 0,
  );
}

/** Trimmed, case-insensitive equality of the typed text against the employee's name.
 * Empty input never matches. */
export function confirmNameMatches(
  typed: string,
  employeeName: string | null | undefined,
): boolean {
  const a = (typed ?? "").trim().toLowerCase();
  const b = (employeeName ?? "").trim().toLowerCase();
  return a.length > 0 && a === b;
}
