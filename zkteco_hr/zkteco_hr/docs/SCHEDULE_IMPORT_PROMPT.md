# Schedule Import — Haiku Normalisation Prompt

Use this prompt in a Claude session (claude.ai or API) to convert any raw
schedule spreadsheet into the canonical import format. Run it once per new
spreadsheet layout, save the output as a CSV, then upload via **Weekly
Schedule → Import**.

---

## The Prompt

Copy the block below, paste your spreadsheet data after "SPREADSHEET:", then
send to Claude.

---

```
Convert the schedule spreadsheet below into a CSV with exactly these 7 columns:

employee_id, email, am_from, am_to, pm_from, pm_to, days_off

Rules:
1. Times → HH:MM 24-hour format only. Examples:
   7:30am  → 07:30
   12:00pm → 12:00
   1:00pm  → 13:00
   5:00pm  → 17:00
   6:30am  → 06:30

2. pm_from / pm_to → write "off" if the employee has no afternoon shift.

3. days_off → pipe-separated list of weekday names the employee does NOT work.
   Append "(am)" to a day if the employee works that morning but not the afternoon.
   Use full weekday names: Monday Tuesday Wednesday Thursday Friday Saturday Sunday

   Examples:
     Works Mon–Fri full day, off Sat+Sun:
       days_off = Saturday|Sunday

     Works Mon–Fri full day + Sat morning only, off Sun:
       days_off = Saturday(am)|Sunday

     Works Mon–Fri mornings only, off Sat+Sun:
       pm_from = off   (already captured in column 5)
       days_off = Saturday|Sunday

4. Include a header row.
5. Output raw CSV only — no explanation, no markdown fences.

SPREADSHEET:
[paste your data here]
```

---

## Expected output

```csv
employee_id,email,am_from,am_to,pm_from,pm_to,days_off
DI-0159,boeurnraksmey@diu.edu.kh,07:30,12:00,13:00,17:00,Saturday(am)|Sunday
DI-0969,long.udomkanha@diu.edu.kh,07:00,11:00,13:00,17:00,Saturday(am)|Sunday
DI-1201,jessa.gaspar@diu.edu.kh,07:00,11:00,off,off,Saturday|Sunday
DI-0614,donnah.rose.canonoy@diu.edu.kh,07:00,11:30,off,off,Saturday|Sunday
DI-0744,moeuk.maly@diu.edu.kh,07:00,11:30,13:00,17:00,Saturday|Sunday
DI-0364,chhorm.sophal@diu.edu.kh,06:30,11:30,12:30,17:00,Saturday(am)|Sunday
```

---

## Canonical format reference

| Column | Required | Notes |
|---|---|---|
| `employee_id` | ✓ | Badge/card number exactly as stored in Frappe (e.g. `DI-0159`) |
| `email` | optional | Used as fallback employee lookup if ID doesn't match |
| `am_from` | ✓ | Morning start — `HH:MM` 24h |
| `am_to` | ✓ | Morning end — `HH:MM` 24h |
| `pm_from` | ✓ | Afternoon start — `HH:MM` 24h, or `off` |
| `pm_to` | ✓ | Afternoon end — `HH:MM` 24h, or `off` |
| `days_off` | ✓ | Pipe-separated weekday names; append `(am)` for morning-only days |

### days_off quick reference

| Situation | days_off value |
|---|---|
| Off Sat + Sun | `Saturday\|Sunday` |
| Off Sun, Sat morning only | `Saturday(am)\|Sunday` |
| Off Sat + Sun (AM-only employee) | `Saturday\|Sunday` |
| Off Fri + Sat + Sun | `Friday\|Saturday\|Sunday` |
| Never off (7 days) | *(leave blank)* |

---

## Tips

- If your spreadsheet has a different employee ID format, ask Haiku to keep the
  original value unchanged.
- If a column is missing entirely (e.g. no email), tell Haiku to leave that
  column blank.
- Run the normalised CSV through the importer's preview before applying — any
  employee IDs that don't match Frappe will show as "Not found" so you can
  correct them before committing.
