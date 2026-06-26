export interface LauncherTile {
  name: string;
  app_name: string;
  title: string;
  route: string;
  icon?: string;
  tile_order: number;
  enabled: number; // 0 | 1
  is_admin: number; // 0 | 1
  gate: string; // built-in name ("desk"/"roles") or a dotted path
  source_app?: string; // set ⇒ app-managed (code-owned), blank ⇒ hand-made
}

// Gates an admin can choose without code. App-registered tiles carry code-owned
// gates (often dotted paths) and are not editable here.
export const GATE_OPTIONS: string[] = ["roles", "desk"];
