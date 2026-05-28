frappe.pages["hr-attendance-calendar-react"].on_page_load = function (wrapper) {
  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: "HR Attendance Calendar (React)",
    single_column: true,
  });

  const root = document.createElement("div");
  root.id = "root";
  page.main.get(0).appendChild(root);

  // Use Frappe asset resolution (works after `bench build` on Cloud).
  frappe.require(["hr_attendance.bundle.css", "hr_attendance.bundle.js"]).catch(() => {
    root.innerHTML =
      "<div class='text-muted' style='padding:16px'>HR Attendance bundle not found. Run <code>npm run build</code> in the app, commit <code>public/hr_attendance.bundle.*</code>, then <code>bench build --app zkteco_hr</code> on the site.</div>";
  });
};
