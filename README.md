# zkteco_hr

Minimal Frappe custom app for the **attendance engine MVP**:

- `Employee Checkin` is the immutable punch ledger (written by the bridge).
- This app generates persisted workflow rows in `Attendance Flag` (AUTO closeout-only).
- A simple read API returns “My Week” data (checkins + computed minutes + flags).

## Install (bench)

From your bench:

```bash
bench get-app /path/to/this/repo zkteco_hr
bench --site <site> install-app zkteco_hr
bench --site <site> migrate
```

## MVP jobs / APIs

- Daily closeout (scheduler): `zkteco_hr.attendance_engine.closeout.run_yesterday_closeout`
- Manual closeout (console):

```python
from zkteco_hr.attendance_engine.closeout import generate_auto_flags_for_date
generate_auto_flags_for_date("2026-05-28")
```

- “My Week” API (whitelisted):
  - `zkteco_hr.attendance_engine.api.get_my_week(employee, start_date, end_date)`

## HR Attendance Calendar (Desk)

- Open from Awesomebar: **HR Attendance Calendar** or route `/app/hr-attendance-calendar`
- Module sidebar: **ZKTeco HR** (Frappe v16 `Workspace Sidebar` fixture)

HR calendar API:

- `zkteco_hr.attendance_engine.hr_calendar.get_employee_calendar(employee, start_date, end_date)`
