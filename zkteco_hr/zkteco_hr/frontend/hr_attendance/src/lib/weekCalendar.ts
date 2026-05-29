import { format } from "date-fns";

import type { Day } from "@/types/calendar";

export function countWeekAssignedShiftDays(weekDates: Date[], daysByDate: Map<string, Day>) {
  let assigned = 0;
  for (const date of weekDates) {
    const key = format(date, "yyyy-MM-dd");
    if (daysByDate.get(key)?.shift?.shift_assigned) assigned += 1;
  }
  return assigned;
}
