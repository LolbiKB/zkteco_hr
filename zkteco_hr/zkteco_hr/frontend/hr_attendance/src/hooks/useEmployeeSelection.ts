import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

import { useDefaultEmployee } from "@/hooks/useHrAttendanceData";
import type { CalendarEmployee } from "@/types/calendar";

/** Shared employee picker state — kept in ?employee= so Attendance and Schedule stay in sync. */
export function useEmployeeSelection(employees: CalendarEmployee[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const employee = searchParams.get("employee");

  const setEmployee = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) {
            next.set("employee", id);
          } else {
            next.delete("employee");
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useDefaultEmployee(employees, employee, (id) => setEmployee(id));

  const selectEmployee = useCallback((id: string) => setEmployee(id), [setEmployee]);

  return { employee, setEmployee, selectEmployee };
}
