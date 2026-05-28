app_name = "zkteco_hr"
app_title = "ZKTeco HR"
app_publisher = "ZKTeco HR"
app_description = "Attendance flags + weekly view (MVP)"
app_email = "noreply@example.com"
app_license = "MIT"

# Scheduled job (closeout-only MVP)
scheduler_events = {
    "daily": [
        "zkteco_hr.attendance_engine.closeout.run_yesterday_closeout",
    ],
}

