/** Human labels for Attendance Flag codes (AUTO + manual). */
export const FLAG_LABELS: Record<string, string> = {
  LATE_START: "Late start",
  LATE_FROM_LUNCH: "Late from lunch",
  LEFT_EARLY: "Left early",
  NO_CHECKIN_YET: "No check-in yet",
  MISSING_LUNCH: "Missing lunch",
  MISSING_IN_OR_OUT: "Missing in or out",
  UNNOTIFIED_ABSENCE: "Unnotified absence",
  OFF_SHIFT_PUNCH: "Off-shift punch",
  NON_PRIMARY_SITE_PUNCH: "Wrong site",
  UNKNOWN_DEVICE_BRANCH: "Unknown device branch",
  DELIVERY_FAILED: "Delivery failed",
};

export function formatFlagLabel(flagCode: string): string {
  return FLAG_LABELS[flagCode] ?? flagCode.replaceAll("_", " ").toLowerCase();
}
