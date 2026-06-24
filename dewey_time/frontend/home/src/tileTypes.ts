export interface LauncherTile {
  name: string;
  app_name: string;
  title: string;
  route: string;
  icon?: string;
  tile_order: number;
  enabled: number; // 0 | 1
  is_admin: number; // 0 | 1
  gate: "hr_or_employee" | "adms" | "desk" | "roles";
}

// "roles" is supported by the backend (gate + visible_to_roles child) but is
// intentionally NOT offered in the admin dialog yet: there is no role-picker UI,
// so a roles-gated tile would be invisible to everyone. Re-add "roles" here once
// the visible_to_roles editor ships (alongside the "Access & roles" page).
export const GATE_OPTIONS: LauncherTile["gate"][] = ["hr_or_employee", "adms", "desk"];
